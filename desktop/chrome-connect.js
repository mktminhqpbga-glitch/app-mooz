/* Only the companion Chrome extension shows this entry point. */
(() => {
  if (window.workflowDesktop || !globalThis.chrome?.runtime?.id) return;
  const button = document.createElement('button');
  button.type = 'button'; button.textContent = 'Kết nối app desktop';
  button.title = 'Ghép nối app Workflow với các tab AI đang mở trong Chrome';
  button.onclick = () => chrome.tabs.create({url: chrome.runtime.getURL('desktop/connect.html')});
  document.querySelector('.toolbar-actions')?.prepend(button);
})();
