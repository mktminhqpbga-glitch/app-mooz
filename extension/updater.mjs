const MAX_BYTES = 2 * 1024 * 1024;

async function read(url, fetcher) {
  const response = await fetcher(url, { cache: 'no-store', credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`GitHub trả về HTTP ${response.status}. Kiểm tra repository công khai, nhánh và tệp dữ liệu.`);
  if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('Tệp vượt giới hạn 2 MB.');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) { await reader.cancel(); throw new Error('Tệp vượt giới hạn 2 MB.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export async function download(repository, branch, fetcher = fetch) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || !branch.trim()) throw new Error('Nhập repository dạng owner/repository và tên nhánh.');
  const commit = JSON.parse(await read(`https://api.github.com/repos/${repository}/commits/${encodeURIComponent(branch)}`, fetcher));
  if (!/^[a-f0-9]{40}$/.test(commit.sha)) throw new Error('Commit GitHub không hợp lệ.');
  const base = `https://raw.githubusercontent.com/${repository}/${commit.sha}/`;
  const index = JSON.parse(await read(`${base}data/index.json`, fetcher));
  if (!Array.isArray(index.files) || index.files.length === 0 || index.files.length > 50 || new Set(index.files).size !== index.files.length) throw new Error('Danh sách dữ liệu cần có 1–50 đường dẫn duy nhất.');
  const files = {};
  let total = 0;
  for (const path of index.files) {
    if (typeof path !== 'string' || !/^data\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(json|txt|csv|md)$/.test(path) || path === 'data/index.json') throw new Error('Đường dẫn dữ liệu không hợp lệ.');
    const content = await read(base + path, fetcher);
    total += new TextEncoder().encode(content).length;
    if (total > MAX_BYTES) throw new Error('Tổng dữ liệu vượt giới hạn 2 MB.');
    if (path.endsWith('.json')) JSON.parse(content);
    files[path] = content;
  }
  return { repository, branch, commit: commit.sha, updatedAt: new Date().toISOString(), files };
}
