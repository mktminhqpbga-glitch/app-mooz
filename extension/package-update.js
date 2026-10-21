(() => {
  const button = document.querySelector('#packageUpdateBtn');
  if (!button) return;
  button.addEventListener('click', async () => {
    const status = document.querySelector('#status') || document.querySelector('#runStatus');
    button.disabled = true;
    try {
      await chrome.downloads.download({
        url: `https://raw.githubusercontent.com/mktminhqpbga-glitch/workflow/main/downloads/Workflow-extension.zip?t=${Date.now()}`,
        filename: 'Workflow-extension-latest.zip',
        conflictAction: 'uniquify',
        saveAs: true
      });
      status.textContent = 'Đã bắt đầu tải ZIP. Khi tải xong, giải nén đè vào thư mục cài đặt (có manifest.json), rồi bấm Tải lại tại chrome://extensions hoặc edge://extensions. Chưa thay đổi mã extension đang chạy.';
    } catch (error) {
      status.textContent = `Chưa tải được bản cập nhật: ${error.message}. Nếu vừa nâng cấp, hãy tải lại extension để cấp quyền tải xuống.`;
    } finally {
      button.disabled = false;
    }
  });
})();
