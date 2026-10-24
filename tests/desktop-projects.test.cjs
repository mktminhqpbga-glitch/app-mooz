'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { ProjectStore } = require('../desktop/project-store.cjs');

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-projects-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return { root, store: new ProjectStore(root) };
}

test('projects isolate local storage and persist through a fresh store instance', async t => {
  const { root, store } = await fixture(t);
  const first = await store.create(' Video sản phẩm ');
  const second = await store.create('Kịch bản khác');
  assert.equal(first.name, 'Video sản phẩm');
  assert.notEqual(first.id, second.id);
  await store.writeStorage(first.id, { museflow: { nodes: [{ id: 'same-node', data: { text: 'First' } }], edges: [] } });
  await store.writeStorage(second.id, { museflow: { nodes: [{ id: 'same-node', data: { text: 'Second' } }], edges: [] } });
  const reopened = new ProjectStore(root);
  assert.equal((await reopened.readStorage(first.id)).museflow.nodes[0].data.text, 'First');
  assert.equal((await reopened.readStorage(second.id)).museflow.nodes[0].data.text, 'Second');
  assert.equal((await reopened.list()).length, 2);
  await reopened.rename(first.id, 'Tên đã sửa');
  assert.equal((await reopened.list()).find(p => p.id === first.id).name, 'Tên đã sửa');
  assert.equal((await reopened.readStorage(first.id)).museflow.nodes[0].data.text, 'First');
});

test('concurrent storage patches serialize and snapshot caller values before enqueueing', async t => {
  const { store } = await fixture(t);
  const project = await store.create('Serial writes');
  const patch = { mutable: { text: 'before' } };
  const first = store.writeStorage(project.id, patch);
  patch.mutable.text = 'after';
  await Promise.all([first, ...Array.from({ length: 20 }, (_, i) => store.writeStorage(project.id, { ['key' + i]: i }))]);
  const result = await store.readStorage(project.id);
  assert.equal(result.mutable.text, 'before');
  for (let i = 0; i < 20; i++) assert.equal(result['key' + i], i);
});

test('saved empty canvas remains empty after reload', async t => {
  const { store, root } = await fixture(t);
  const project = await store.create('Empty project');
  await store.writeStorage(project.id, { museflow: { nodes: [], edges: [], notes: [] } });
  assert.deepEqual((await new ProjectStore(root).readStorage(project.id)).museflow, { nodes: [], edges: [], notes: [] });
});

test('corrupt current file refuses reads and writes, stays visible, and can restore without losing corrupt bytes', async t => {
  const { root, store } = await fixture(t);
  const project = await store.create('Recoverable');
  await store.writeStorage(project.id, { content: 'first revision' });
  await store.writeStorage(project.id, { content: 'second revision' });
  const file = path.join(root, project.id, 'project.json');
  const damaged = '{"not finished';
  await fs.writeFile(file, damaged);
  await assert.rejects(store.readStorage(project.id), /Không đọc được/);
  await assert.rejects(store.writeStorage(project.id, { content: 'would erase data' }), /Không đọc được/);
  assert.equal(await fs.readFile(file, 'utf8'), damaged);
  const item = (await store.list())[0];
  assert.equal(item.recoveryRequired, true);
  assert.equal(item.canRestore, true);
  assert.equal(item.name, 'Recoverable');
  await store.restore(project.id);
  assert.equal((await store.readStorage(project.id)).content, 'first revision');
  const retained = (await fs.readdir(path.dirname(file))).find(name => name.startsWith('project.json.before-restore-'));
  assert.ok(retained);
  assert.equal(await fs.readFile(path.join(path.dirname(file), retained), 'utf8'), damaged);
});

test('valid backup restore replaces the most recent state and preserves the replaced file', async t => {
  const { store } = await fixture(t);
  const project = await store.create('Restore');
  await store.writeStorage(project.id, { version: 'old' });
  await store.writeStorage(project.id, { version: 'new' });
  const restored = await store.restore(project.id);
  assert.equal(restored.id, project.id);
  assert.equal((await store.readStorage(project.id)).version, 'old');
});

test('missing or corrupt recovery copy never replaces current data', async t => {
  const { root, store } = await fixture(t);
  const project = await store.create('No recovery');
  await assert.rejects(store.restore(project.id), { code: 'ENOENT' });
  await store.writeStorage(project.id, { keep: true });
  const file = path.join(root, project.id, 'project.json');
  const current = await fs.readFile(file, 'utf8');
  await fs.writeFile(file + '.previous', 'invalid');
  await assert.rejects(store.restore(project.id), /Không đọc được/);
  assert.equal(await fs.readFile(file, 'utf8'), current);
});

test('invalid IDs, traversal, symbolic project paths, and invalid names are refused', async t => {
  const { root, store } = await fixture(t);
  for (const id of ['../outside', '/etc', '', null, 'not-a-uuid']) {
    await assert.rejects(store.readStorage(id), /Mã dự án/);
    await assert.rejects(store.writeStorage(id, {}), /Mã dự án/);
  }
  for (const name of ['', ' ', 'x'.repeat(101), 'bad\nname', 12]) await assert.rejects(store.create(name), /Tên dự án/);
  const project = await store.create('Linked');
  await fs.rm(path.join(root, project.id), { recursive: true });
  await fs.symlink(os.tmpdir(), path.join(root, project.id));
  await assert.rejects(store.readStorage(project.id), /Thư mục dự án/);
  await assert.rejects(store.list(), /đường dẫn dự án/);
});

test('deleting hides only the chosen project and undo preserves saved state and recovery bytes', async t => {
  const { root, store } = await fixture(t);
  const first = await store.create('Xóa rồi hoàn tác');
  const other = await store.create('Giữ lại');
  const pending = store.writeStorage(first.id, { content: 'latest pending save' });
  const removal = store.trash(first.id);
  await Promise.all([pending, removal]);
  assert.deepEqual((await store.list()).map(p => p.id), [other.id]);
  await assert.rejects(store.readStorage(first.id), { code: 'ENOENT' });
  const archived = path.join(root, '.trash', first.id);
  const before = await fs.readFile(path.join(archived, 'project.json'), 'utf8');
  const backup = await fs.readFile(path.join(archived, 'project.json.previous'), 'utf8');
  // A fresh store can recover the hidden project after restarting the application.
  const fresh = new ProjectStore(root);
  await fresh.undoTrash(first.id);
  assert.equal((await fresh.readStorage(first.id)).content, 'latest pending save');
  assert.equal(await fs.readFile(path.join(root, first.id, 'project.json'), 'utf8'), before);
  assert.equal(await fs.readFile(path.join(root, first.id, 'project.json.previous'), 'utf8'), backup);
  assert.equal((await fresh.list()).length, 2);
});

test('deletion preserves corrupt files and undo refuses to overwrite an existing project', async t => {
  const { root, store } = await fixture(t);
  const project = await store.create('Damaged');
  await fs.writeFile(path.join(root, project.id, 'project.json'), '{broken');
  await store.trash(project.id);
  await fs.mkdir(path.join(root, project.id));
  await assert.rejects(store.undoTrash(project.id), /không thể ghi đè/);
  assert.equal(await fs.readFile(path.join(root, '.trash', project.id, 'project.json'), 'utf8'), '{broken');
  await fs.rmdir(path.join(root, project.id));
  await store.undoTrash(project.id);
  assert.equal((await store.list())[0].recoveryRequired, true);
});

test('delete and undo reject traversal and linked directories without touching external files', async t => {
  const { root, store } = await fixture(t);
  for (const id of ['../outside', '/etc', null, 'not-a-uuid']) {
    await assert.rejects(store.trash(id), /Mã dự án/);
    await assert.rejects(store.undoTrash(id), /Mã dự án/);
  }
  const project = await store.create('Linked trash');
  await fs.symlink(os.tmpdir(), path.join(root, '.trash'));
  await assert.rejects(store.trash(project.id), /Thư mục đã xóa/);
  assert.equal((await store.list()).length, 1);
});
