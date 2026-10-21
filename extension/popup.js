import { download } from './updater.mjs';

const repository = document.querySelector('#repository');
const branch = document.querySelector('#branch');
const status = document.querySelector('#status');
const button = document.querySelector('#update');
function render(snapshot) {
  document.querySelector('#details').textContent = snapshot
    ? `${snapshot.repository} • ${snapshot.branch} • ${snapshot.commit.slice(0, 7)} • ${new Date(snapshot.updatedAt).toLocaleString('vi-VN')}`
    : 'Chưa có dữ liệu được lưu.';
  document.querySelector('#files').replaceChildren(...Object.keys(snapshot?.files || {}).map(path => {
    const li = document.createElement('li');
    li.textContent = path;
    return li;
  }));
}
document.querySelector('#settings').addEventListener('submit', async event => {
  event.preventDefault();
  button.disabled = true;
  repository.disabled = branch.disabled = true;
  status.textContent = 'Đang tải… Giữ cửa sổ này mở đến khi hoàn tất.';
  try {
    const snapshot = await download(repository.value.trim(), branch.value.trim());
    await chrome.storage.local.set({ snapshot });
    render(snapshot);
    status.textContent = 'Đã cập nhật và lưu dữ liệu.';
  } catch (error) {
    status.textContent = `Cập nhật thất bại: ${error.message} Dữ liệu đã lưu được giữ nguyên.`;
  } finally {
    button.disabled = false;
    repository.disabled = branch.disabled = false;
  }
});
try {
  const { snapshot } = await chrome.storage.local.get('snapshot');
  repository.value = snapshot?.repository || 'mktminhqpbga-glitch/workflow';
  branch.value = snapshot?.branch || 'main';
  render(snapshot);
} catch (error) { status.textContent = `Không đọc được bộ nhớ: ${error.message}`; }
