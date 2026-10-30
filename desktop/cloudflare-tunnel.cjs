'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const {execFile, spawn} = require('node:child_process');
const {promisify} = require('node:util');
const {createHash, randomUUID} = require('node:crypto');
const {gunzipSync} = require('node:zlib');

const DOWNLOADS = 'https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/';
const GUIDE = 'https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/';
const RELEASE = 'https://api.github.com/repos/cloudflare/cloudflared/releases/latest';

function assetName(platform, arch) {
  if (!['arm64', 'x64'].includes(arch)) throw Error('Chưa có bộ cài tự động cho kiến trúc máy này. Dùng trang tải Cloudflare.');
  const cpu = arch === 'x64' ? 'amd64' : 'arm64';
  if (platform === 'darwin') return `cloudflared-darwin-${cpu}.tgz`;
  if (platform === 'linux') return `cloudflared-linux-${cpu}`;
  if (platform === 'win32' && arch === 'x64') return 'cloudflared-windows-amd64.exe';
  throw Error('Chưa có bộ cài tự động cho hệ điều hành này. Dùng trang tải Cloudflare.');
}

// Extract one regular file into memory; never extract archive paths/symlinks.
function macBinary(archive) {
  const tar = gunzipSync(archive, {maxOutputLength: 128 * 1024 * 1024});
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every(b => b === 0)) break;
    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/s, '');
    const sizeText = header.subarray(124, 136).toString('ascii').replace(/\0.*$/s, '').trim();
    if (!/^[0-7]+$/.test(sizeText)) throw Error('Bộ cài cloudflared không đúng định dạng TAR.');
    const size = parseInt(sizeText, 8), start = offset + 512;
    if (size < 1 || start + size > tar.length) throw Error('Bộ cài cloudflared bị thiếu dữ liệu.');
    if (['cloudflared', './cloudflared'].includes(name) && [0, 48].includes(header[156]) && header.subarray(345, 500).every(b => b === 0)) return tar.subarray(start, start + size);
    offset = start + Math.ceil(size / 512) * 512;
  }
  throw Error('Bộ cài không chứa tệp cloudflared hợp lệ.');
}

async function bytes(response, maximum) {
  if (!response.ok || Number(response.headers.get('content-length')) > maximum) throw Error('Chưa tải được bộ cài Cloudflare hoặc tệp vượt giới hạn.');
  const reader = response.body.getReader(), chunks = [];
  let size = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.length;
      if (size > maximum) throw Error('Bộ cài Cloudflare vượt giới hạn tải.');
      chunks.push(Buffer.from(next.value));
    }
    return Buffer.concat(chunks);
  } finally { await reader.cancel().catch(() => {}); }
}

function candidates(platform = process.platform) {
  if (platform === 'darwin') return ['/opt/homebrew/bin/cloudflared', '/usr/local/bin/cloudflared', 'cloudflared'];
  if (platform === 'win32') return [
    ...(process.env.ProgramFiles ? [path.join(process.env.ProgramFiles, 'cloudflared', 'cloudflared.exe')] : []),
    ...(process.env.LOCALAPPDATA ? [path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Links', 'cloudflared.exe')] : []),
    'cloudflared.exe'
  ];
  return ['/usr/local/bin/cloudflared', '/usr/bin/cloudflared', 'cloudflared'];
}

function installCommand(platform = process.platform) {
  return platform === 'darwin' ? 'brew install cloudflared' : platform === 'win32' ? 'winget install --id Cloudflare.cloudflared --exact' : null;
}

function failureHint(log) {
  if (/x509|certificate|unknown authority/i.test(log)) return 'Cloudflared chưa xác minh được chứng chỉ. Kiểm tra ngày giờ máy và mạng; không tắt kiểm tra chứng chỉ.';
  if (/429|rate.limit|too many requests/i.test(log)) return 'Cloudflare đang giới hạn tạo Quick Tunnel. Đợi rồi bấm Bắt đầu lại.';
  if (/flag provided but not defined|unknown flag/i.test(log)) return 'Cloudflared quá cũ hoặc không hỗ trợ tùy chọn này. Cập nhật từ trang tải chính thức rồi thử lại.';
  if (/dial tcp|timeout|timed out|no such host|network is unreachable|proxyconnect|7844/i.test(log)) return 'Chưa kết nối được Cloudflare. Kiểm tra Internet, DNS và việc mạng cho phép cloudflared kết nối ra cổng TCP 7844.';
  return 'Cloudflare Tunnel đã dừng hoặc chưa sẵn sàng. Kiểm tra Internet, cập nhật cloudflared rồi bấm Bắt đầu lại.';
}

// Owns only the child it launches. Never runs a shell, installs software, reads
// Cloudflare credentials, or changes the user's existing tunnel configuration.
class CloudflareTunnel {
  constructor({root, notify = () => {}, execute = promisify(execFile), spawnProcess = spawn, platform = process.platform, arch = process.arch, fetchImpl = globalThis.fetch, startupTimeout = 60000, stopTimeout = 3000} = {}) {
    Object.assign(this, {root, notify, execute, spawnProcess, platform, arch, fetchImpl, startupTimeout, stopTimeout});
    this.current = null;
    this.binary = null;
    this.version = null;
    this.error = '';
    this.installing = null;
  }

  status() {
    return {running: !!this.current?.ready, starting: !!this.current && !this.current.ready, installed: !!this.binary, version: this.version, error: this.error};
  }

  get endpoint() { return this.current?.ready ? this.current.endpoint : null; }
  changed() { this.notify(this.status()); }

  async inspect() {
    for (const file of [path.join(this.root, 'tools', this.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared'), ...candidates(this.platform)]) {
      try {
        const {stdout, stderr} = await this.execute(file, ['--version'], {timeout: 5000, maxBuffer: 65536, windowsHide: true});
        const version = /\bcloudflared version (\d{4}\.\d{1,2}\.\d+)\b/.exec(String(stdout || '') + String(stderr || ''))?.[1];
        if (!version) continue;
        this.binary = file;
        this.version = version;
        this.changed();
        return {...this.status(), installCommand: installCommand(this.platform)};
      } catch (error) {
        if (!['ENOENT', 'EACCES'].includes(error.code)) continue;
      }
    }
    this.binary = null;
    this.version = null;
    this.changed();
    return {...this.status(), installCommand: installCommand(this.platform)};
  }

  async install() {
    if (this.current || this.installing) throw Error('Dừng Cloudflare Tunnel hoặc đợi tải công cụ xong trước khi cài lại.');
    const name = assetName(this.platform, this.arch), controller = new AbortController();
    this.installing = controller;
    const timer = setTimeout(() => controller.abort(), 120000);
    let temporary;
    try {
      const metadata = await this.fetchImpl(RELEASE, {headers: {'User-Agent': 'MooZ-Agent', 'Accept': 'application/vnd.github+json'}, credentials: 'omit', redirect: 'error', signal: controller.signal});
      const release = JSON.parse((await bytes(metadata, 1024 * 1024)).toString('utf8'));
      const asset = release.assets?.find(a => a.name === name);
      if (!/^\d{4}\.\d{1,2}\.\d+$/.test(release.tag_name || '') || !asset || !/^sha256:[a-f0-9]{64}$/.test(asset.digest || '') || !Number.isSafeInteger(asset.size) || asset.size < 1 || asset.size > 64 * 1024 * 1024 || asset.browser_download_url !== `https://github.com/cloudflare/cloudflared/releases/download/${release.tag_name}/${name}`) throw Error('Không xác minh được bộ cài chính thức và SHA256 từ Cloudflare. Dùng trang tải hướng dẫn.');
      const response = await this.fetchImpl(asset.browser_download_url, {credentials: 'omit', redirect: 'follow', signal: controller.signal});
      const final = new URL(response.url || asset.browser_download_url);
      if (final.protocol !== 'https:' || !['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com'].includes(final.hostname)) throw Error('Địa chỉ tải cloudflared không thuộc nguồn phát hành chính thức.');
      const data = await bytes(response, 64 * 1024 * 1024);
      if (data.length !== asset.size || 'sha256:' + createHash('sha256').update(data).digest('hex') !== asset.digest) throw Error('SHA256 bộ cài Cloudflare không khớp. Tệp chưa được cài hay chạy. Thử tải lại.');
      const binary = this.platform === 'darwin' ? macBinary(data) : data;
      const directory = path.join(this.root, 'tools');
      await fs.mkdir(directory, {recursive: true, mode: 0o700});
      temporary = path.join(directory, 'cloudflared-' + randomUUID() + (this.platform === 'win32' ? '.exe' : ''));
      await fs.writeFile(temporary, binary, {mode: 0o700, flag: 'wx'});
      const {stdout, stderr} = await this.execute(temporary, ['--version'], {timeout: 5000, maxBuffer: 65536, windowsHide: true});
      if (!(String(stdout || '') + String(stderr || '')).includes('cloudflared version ' + release.tag_name)) throw Error('Phiên bản công cụ tải về chưa xác minh được. Chưa thay công cụ hiện có.');
      const target = path.join(directory, this.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared');
      await fs.rename(temporary, target);
      this.binary = target;
      this.version = release.tag_name;
      this.error = '';
      this.changed();
      return this.status();
    } catch (error) {
      if (error.name === 'AbortError') throw Error('Đã dừng hoặc hết thời gian tải cloudflared. Kiểm tra Internet rồi thử lại.');
      throw error;
    } finally {
      clearTimeout(timer);
      this.installing = null;
      if (temporary) await fs.rm(temporary, {force: true});
    }
  }

  async start(port) {
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Cổng kết nối MooZ chưa sẵn sàng.');
    if (this.current?.ready) return this.endpoint;
    if (this.current) throw Error('Cloudflare Tunnel đang khởi động.');
    if (!(await this.inspect()).installed) throw Error('Chưa tìm thấy cloudflared. Cài theo hướng dẫn Cloudflare, rồi bấm Kiểm tra công cụ. Trên Mac có Homebrew: brew install cloudflared.');

    const directory = path.join(this.root, 'cloudflare-runtime');
    await fs.mkdir(directory, {recursive: true, mode: 0o700});
    const config = path.join(directory, 'quick-tunnel.yml');
    // Explicit empty config isolates Quick Tunnel from ~/.cloudflared/config.yml.
    await fs.writeFile(config, '{}\n', {mode: 0o600});
    this.error = '';
    return new Promise((resolve, reject) => {
      let child;
      try {
        child = this.spawnProcess(this.binary, ['tunnel', '--config', config, '--no-autoupdate', '--protocol', 'http2', '--metrics', '127.0.0.1:0', '--url', 'http://127.0.0.1:' + port], {cwd: directory, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']});
      } catch {
        reject(Error('Không khởi động được cloudflared. Cài lại công cụ từ trang chính thức.'));
        return;
      }
      const run = {child, ready: false, endpoint: null, candidate: null, registered: false, settled: false, buffers: new Map(), log: '', timer: null, reject};
      this.current = run;
      const finish = (error) => {
        if (this.current !== run) return;
        this.current = null;
        clearTimeout(run.timer);
        this.error = error;
        if (!run.settled) { run.settled = true; reject(Error(error)); }
        this.terminate(run);
        this.changed();
      };
      const line = value => {
        if (this.current !== run) return;
        run.log = (run.log + value + '\n').slice(-16384);
        const match = /(?:^|[\s|])(https:\/\/([a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com))(?=[\s|]|$)/i.exec(value);
        if (match && match[2].length <= 253) run.candidate = 'wss://' + match[2].toLowerCase() + '/remote';
        if (/Registered tunnel connection\b/.test(value)) run.registered = true;
        if (run.ready && /Unregistered tunnel connection\b|no more connections active and exiting/i.test(value)) {
          finish('Cloudflare Tunnel bị gián đoạn. Mã và phiên đã được thu hồi; kiểm tra kết quả AI trước khi tạo đường kết nối mới.');
          return;
        }
        if (!run.ready && run.candidate && run.registered) {
          run.endpoint = run.candidate;
          run.ready = true;
          run.settled = true;
          clearTimeout(run.timer);
          this.changed();
          resolve(run.endpoint);
        }
      };
      for (const stream of [child.stdout, child.stderr].filter(Boolean)) {
        stream.on('data', chunk => {
          const text = (run.buffers.get(stream) || '') + chunk.toString('utf8');
          const lines = text.split(/\r?\n/);
          run.buffers.set(stream, lines.pop().slice(-16384));
          for (const item of lines) line(item);
        });
      }
      child.once('error', () => finish('Không chạy được cloudflared. Kiểm tra công cụ đã cài và quyền thực thi.'));
      child.once('exit', () => finish(failureHint(run.log)));
      run.timer = setTimeout(() => finish(failureHint(run.log)), this.startupTimeout);
      run.timer.unref?.();
      this.changed();
    });
  }

  terminate(run) {
    if (run.child.exitCode !== null && run.child.exitCode !== undefined) return;
    try { run.child.kill('SIGTERM'); } catch {}
    const timer = setTimeout(() => { try { run.child.kill('SIGKILL'); } catch {} }, this.stopTimeout);
    timer.unref?.();
    run.child.once('exit', () => clearTimeout(timer));
  }

  async stop() {
    const run = this.current;
    if (!run) return;
    this.current = null;
    clearTimeout(run.timer);
    if (!run.settled) { run.settled = true; run.reject(Error('Đã dừng khởi động Cloudflare Tunnel.')); }
    const closed = new Promise(resolve => {
      if (run.child.exitCode !== null && run.child.exitCode !== undefined) { resolve(); return; }
      const timer = setTimeout(resolve, this.stopTimeout + 200);
      run.child.once('exit', () => { clearTimeout(timer); resolve(); });
    });
    this.terminate(run);
    this.changed();
    await closed;
  }
}

module.exports = {CloudflareTunnel, candidates, installCommand, assetName, macBinary, DOWNLOADS, GUIDE};
