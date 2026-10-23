'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BYTES = 64 * 1024 * 1024;

function projectName(value) {
  if (typeof value !== 'string') throw new Error('Tên dự án không hợp lệ.');
  const name = value.trim();
  if (!name || name.length > 100 || /[\u0000-\u001f]/.test(name)) {
    throw new Error('Tên dự án cần từ 1 đến 100 ký tự, không chứa ký tự điều khiển.');
  }
  return name;
}

function validateRecord(record, id) {
  const item = record?.project;
  if (record?.version !== 1 || !item || item.id !== id || !UUID.test(item.id) ||
      typeof item.name !== 'string' || !item.name.trim() || item.name.length > 100 ||
      !Number.isFinite(Date.parse(item.createdAt)) || !Number.isFinite(Date.parse(item.updatedAt)) ||
      !record.storage || typeof record.storage !== 'object' || Array.isArray(record.storage)) {
    throw new Error('Cấu trúc tệp dự án không hợp lệ. Dữ liệu gốc được giữ nguyên.');
  }
  return record;
}

class ProjectStore {
  constructor(root) {
    this.root = path.resolve(root);
    this.queues = new Map();
  }

  directory(id) {
    if (typeof id !== 'string' || !UUID.test(id)) throw new Error('Mã dự án không hợp lệ.');
    return path.join(this.root, id);
  }

  async ensureRoot() {
    await fs.mkdir(this.root, { recursive: true, mode: 0o700 });
    const stat = await fs.lstat(this.root);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Thư mục dự án không an toàn.');
  }

  async existingDirectory(id) {
    const dir = this.directory(id);
    const stat = await fs.lstat(dir);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Thư mục dự án không hợp lệ.');
    return dir;
  }

  async readFile(file, id) {
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_BYTES) {
      throw new Error('Tệp dự án không hợp lệ hoặc vượt giới hạn 64 MB.');
    }
    let value;
    try { value = JSON.parse(await fs.readFile(file, 'utf8')); }
    catch (error) {
      throw new Error('Không đọc được dữ liệu dự án. Tệp gốc được giữ nguyên; hãy dùng Khôi phục nếu có bản trước.', { cause: error });
    }
    return validateRecord(value, id);
  }

  async atomicWrite(file, value) {
    const content = JSON.stringify(value);
    if (Buffer.byteLength(content) > MAX_BYTES) throw new Error('Dữ liệu dự án vượt giới hạn 64 MB.');
    const temporary = file + '.' + randomUUID() + '.tmp';
    let handle;
    try {
      handle = await fs.open(temporary, 'wx', 0o600);
      await handle.writeFile(content, 'utf8');
      await handle.sync();
      await handle.close();
      handle = null;
      await fs.rename(temporary, file);
    } finally {
      await handle?.close().catch(() => {});
      await fs.unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
    }
  }

  serialize(id, action) {
    this.directory(id);
    const previous = this.queues.get(id) || Promise.resolve();
    const next = previous.catch(() => {}).then(action);
    this.queues.set(id, next);
    next.finally(() => { if (this.queues.get(id) === next) this.queues.delete(id); }).catch(() => {});
    return next;
  }

  async list() {
    await this.ensureRoot();
    const entries = await fs.readdir(this.root, { withFileTypes: true });
    const items = [];
    for (const entry of entries) {
      if (!UUID.test(entry.name)) continue;
      const id = entry.name;
      if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error('Phát hiện đường dẫn dự án không hợp lệ: ' + id);
      const dir = this.directory(id);
      try {
        const record = await this.readFile(path.join(dir, 'project.json'), id);
        items.push({ ...record.project, canRestore: await this.hasBackup(dir, id) });
      } catch (error) {
        let backup;
        try { backup = await this.readFile(path.join(dir, 'project.json.previous'), id); } catch { /* The corrupt project stays visible and readStorage still refuses it. */ }
        items.push({ id, name: backup?.project.name || 'Dự án cần khôi phục', createdAt: backup?.project.createdAt || '', updatedAt: backup?.project.updatedAt || '', recoveryRequired: true, canRestore: !!backup, error: error.message });
      }
    }
    return items.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }

  async hasBackup(dir, id) {
    try { await this.readFile(path.join(dir, 'project.json.previous'), id); return true; }
    catch (error) { return false; }
  }

  async create(name) {
    name = projectName(name);
    await this.ensureRoot();
    const id = randomUUID();
    const now = new Date().toISOString();
    const project = { id, name, createdAt: now, updatedAt: now };
    const dir = this.directory(id);
    await fs.mkdir(dir, { mode: 0o700 });
    try { await this.atomicWrite(path.join(dir, 'project.json'), { version: 1, project, storage: {} }); }
    catch (error) { await fs.rmdir(dir).catch(() => {}); throw error; }
    return { ...project };
  }

  async readStorage(id) {
    await this.queues.get(id)?.catch(() => {});
    const dir = await this.existingDirectory(id);
    const record = await this.readFile(path.join(dir, 'project.json'), id);
    return structuredClone(record.storage);
  }

  async change(id, modify) {
    return this.serialize(id, async () => {
      const dir = await this.existingDirectory(id);
      const file = path.join(dir, 'project.json');
      // Validate before writing either file. A failed read never becomes an empty project.
      const record = await this.readFile(file, id);
      const next = modify(structuredClone(record));
      next.project.updatedAt = new Date().toISOString();
      validateRecord(next, id);
      // Check serialization and size before replacing the recovery copy.
      if (Buffer.byteLength(JSON.stringify(next)) > MAX_BYTES) throw new Error('Dữ liệu dự án vượt giới hạn 64 MB.');
      await this.atomicWrite(file + '.previous', record);
      await this.atomicWrite(file, next);
      return next;
    });
  }

  async writeStorage(id, patch) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('Dữ liệu cần lưu không hợp lệ.');
    // Snapshot before queueing so the caller cannot mutate a pending save.
    const copy = JSON.parse(JSON.stringify(patch));
    await this.change(id, record => { record.storage = { ...record.storage, ...copy }; return record; });
  }

  async rename(id, name) {
    name = projectName(name);
    const record = await this.change(id, record => { record.project.name = name; return record; });
    return { ...record.project };
  }

  async restore(id) {
    return this.serialize(id, async () => {
      const dir = await this.existingDirectory(id);
      const file = path.join(dir, 'project.json');
      const previous = await this.readFile(file + '.previous', id);
      // Preserve even malformed current bytes for manual recovery.
      try {
        const current = await fs.lstat(file);
        if (!current.isFile() || current.isSymbolicLink()) throw new Error('Tệp hiện tại không an toàn để khôi phục.');
        await fs.copyFile(file, file + '.before-restore-' + randomUUID(), fs.constants.COPYFILE_EXCL);
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
      previous.project.updatedAt = new Date().toISOString();
      await this.atomicWrite(file, previous);
      return { ...previous.project };
    });
  }
}

module.exports = { ProjectStore };
