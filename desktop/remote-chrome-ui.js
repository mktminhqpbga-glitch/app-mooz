/* Shared remote-pairing panel. Host-generated codes never enter saved preferences. */
(() => {
 'use strict';
 const host = window.workflowDesktop;
 if (!host) return;
 const dialog = document.createElement('dialog');
 dialog.id = 'remoteChromeDialog';
 dialog.className = 'connections-dialog remote-chrome-dialog';
 dialog.setAttribute('aria-labelledby', 'remoteChromeTitle');
 dialog.innerHTML = `
 <header><div><small>KẾT NỐI HAI MÁY</small><h2 id="remoteChromeTitle">Chrome ở máy khác</h2></div><button id="remoteChromeClose" type="button">Đóng</button></header>
 <section>
  <p>MooZ điều phối và xuất video trên máy này. Máy còn lại chỉ cần Chrome, Workflow Connect 1.2.0 trở lên và các tab AI đã đăng nhập.</p>
  <h3>Cloudflare Tunnel <span class="remote-tag">Không cần Tailscale</span></h3>
  <ol class="remote-steps">
   <li><strong>1. Trên máy MooZ:</strong> bấm Tải cloudflared một lần. App chọn đúng bản cho máy và kiểm tra SHA256 từ nguồn phát hành chính thức. Không cần Homebrew hay quyền quản trị.</li>
   <li><strong>2. Bấm Bắt đầu:</strong> MooZ chạy Quick Tunnel, rồi bật nút tạo mã khi đường kết nối đã khởi động.</li>
   <li><strong>3. Trên máy Chrome:</strong> cài tiện ích, dán mã và bấm Kết nối. Sau đó làm mới danh sách tab AI trong MooZ.</li>
  </ol>
  <p id="remoteChromeTool" role="status"></p>
  <div class="connections-actions">
   <button id="remoteChromeCloudflareInstall" type="button">⇩ Tải cloudflared</button>
   <button id="remoteChromeCloudflareInspect" type="button">Kiểm tra công cụ</button>
   <button id="remoteChromeCloudflareStart" class="primary" type="button">Bắt đầu Cloudflare Tunnel</button>
  </div>
  <p class="remote-help">Giữ MooZ và máy này hoạt động. Quick Tunnel đổi địa chỉ mỗi lần khởi động, không có bảo đảm thời gian hoạt động. Máy Chrome không cần cài cloudflared. Cloudflare chuyển tiếp dữ liệu qua TLS; đây không phải đường mã hóa đầu cuối giữa hai máy.</p>
  <div class="connections-actions">
   <button id="remoteChromeExtension" type="button">⇩ Tải tiện ích Chrome</button>
   <button id="remoteChromeCloudflareDownloads" type="button">Trang tải chính thức ↗</button>
   <button id="remoteChromeCloudflareGuide" type="button">Hướng dẫn Cloudflare ↗</button>
  </div>
 </section>
 <section>
  <p id="remoteChromeState" role="status" aria-live="polite"></p>
  <p id="remoteChromeEndpoint" class="remote-endpoint"></p>
  <p id="remoteChromeWarning" class="error" hidden></p>
  <div class="connections-actions">
   <button id="remoteChromeDisconnect" type="button" hidden>Ngắt Chrome cùng máy</button>
   <button id="remoteChromePair" class="primary" type="button">Tạo mã từ xa</button>
   <button id="remoteChromeCopy" type="button">Tạo & sao chép mã</button>
   <button id="remoteChromeCheck" type="button">Kiểm tra kết nối</button>
  </div>
  <label>Mã ghép cặp · dùng một lần, hiệu lực 10 phút<input id="remoteChromeCode" type="password" readonly autocomplete="off" spellcheck="false"></label>
  <div class="connections-actions">
   <button id="remoteChromeReveal" type="button" aria-pressed="false">Hiện mã</button>
   <button id="remoteChromeRevoke" type="button">Thu hồi phiên từ xa</button>
   <button id="remoteChromeDisable" type="button">Dừng kết nối từ xa</button>
  </div>
  <p>Chỉ chia sẻ mã với máy Chrome của bạn. Mỗi lần kết nối một Chrome. Mất kết nối: kiểm tra kết quả AI trước khi thử lại; app không tự gửi lại prompt. Khởi động lại MooZ cần ghép mã mới.</p>
 </section>
 <details id="remoteChromeTailscale"><summary>Tailscale · mạng riêng thay thế</summary>
  <p>Cài, mở Tailscale trên cả hai máy và đăng nhập cùng mạng riêng. Nếu được yêu cầu, bật HTTPS trong phần quản trị rồi thiết lập lại.</p>
  <div class="connections-actions"><button id="remoteChromeInstall" type="button">Tải Tailscale ↗</button><button id="remoteChromeAdmin" type="button">Quản trị HTTPS ↗</button><button id="remoteChromeSetup" type="button">Thiết lập Tailscale</button></div>
 </details>
 <details id="remoteChromeAdvanced"><summary>Đường WSS có sẵn · nâng cao</summary>
  <p>Dùng đường WebSocket TLS tin cậy của bạn, chuyển tiếp tới máy này. Không dùng ws:// hay tắt kiểm tra chứng chỉ. Tunnel có tên cố định phù hợp hơn cho công việc thường xuyên.</p>
  <p id="remoteChromeBackend"></p>
  <label>Địa chỉ từ xa<input id="remoteChromeCustomURL" type="url" placeholder="wss://may-cua-ban.example/mooz/remote" autocomplete="off"></label><button id="remoteChromeCustom" type="button">Dùng đường WSS này</button>
 </details>
 <section id="remoteChromeRecovery" hidden><p>Cấu hình từ xa bị lỗi; bản gốc sẽ được sao lưu trước khi tạo lại.</p><button id="remoteChromeReset" type="button">Sao lưu & tạo lại cấu hình</button></section>
 <p id="remoteChromeNotice" role="status" aria-live="polite"></p>`;
 document.body.append(dialog);
 const $ = id => dialog.querySelector('#' + id), call = (name, data) => host.call('remoteChrome.' + name, data);
 let busy = false, lastEndpoint = null;
 const notice = (s, error = false) => {
  $('remoteChromeNotice').textContent = String(s || '').replace(/^Error invoking remote method '[^']+': Error: /, '');
  $('remoteChromeNotice').classList.toggle('error', error);
 };
 function clear() {
  $('remoteChromeCode').value = '';
  $('remoteChromeCode').type = 'password';
  $('remoteChromeReveal').textContent = 'Hiện mã';
  $('remoteChromeReveal').setAttribute('aria-pressed', 'false');
 }
 function render(s) {
  if (lastEndpoint !== s.endpoint || s.connected) clear();
  lastEndpoint = s.endpoint;
  const cf = s.cloudflare || {}, transport = s.mode === 'cloudflare' ? 'Cloudflare' : s.mode === 'tailscale' ? 'Tailscale' : 'WSS';
  $('remoteChromeTool').textContent = cf.running ? 'Cloudflare Tunnel đang chạy · cloudflared ' + cf.version : cf.starting ? 'Đang chờ Cloudflare cấp đường kết nối…' : cf.installed ? 'Đã có cloudflared ' + cf.version + '. Có thể bấm Bắt đầu.' : 'Chưa tìm thấy cloudflared. Bấm Tải cloudflared hoặc Kiểm tra công cụ nếu đã cài.';
  $('remoteChromeState').textContent = s.connected ? 'Đã kết nối Chrome từ xa qua ' + transport + (s.companionVersion ? ' · Tiện ích ' + s.companionVersion : '') : s.connectionMode === 'local' ? 'Chrome cùng máy đang kết nối. Ngắt kết nối đó trước khi ghép máy khác.' : s.enabled ? 'Đường ' + transport + ' đã khởi động. Tạo mã và kết nối trên máy Chrome để xác nhận đường truyền.' : 'Chưa bật kết nối từ xa. Bắt đầu Cloudflare Tunnel để tạo mã.';
  $('remoteChromeEndpoint').textContent = s.endpoint || '';
  $('remoteChromeBackend').textContent = s.remoteIngressPort ? 'Đích nội bộ chỉ nhận từ xa: http://127.0.0.1:' + s.remoteIngressPort + ' · WebSocket nhận đường dẫn /remote.' : s.listenPort ? 'Đích nội bộ: http://127.0.0.1:' + s.listenPort + ' · WebSocket nhận đường dẫn /remote.' : '';
  $('remoteChromeWarning').textContent = s.warning || '';
  $('remoteChromeWarning').hidden = !s.warning;
  $('remoteChromeDisconnect').hidden = s.connectionMode !== 'local';
  $('remoteChromeRecovery').hidden = !s.recoveryRequired;
  const blocked = busy || s.busy || s.recoveryRequired;
  for (const id of ['remoteChromeSetup', 'remoteChromeCustom', 'remoteChromeCloudflareInspect']) $(id).disabled = blocked;
  $('remoteChromeCloudflareInstall').disabled = blocked || cf.running;
  $('remoteChromeCloudflareStart').disabled = blocked || cf.running || !cf.installed;
  for (const id of ['remoteChromePair', 'remoteChromeCopy', 'remoteChromeCheck', 'remoteChromeRevoke', 'remoteChromeDisable']) $(id).disabled = blocked || !s.enabled;
  $('remoteChromeReveal').disabled = !$('remoteChromeCode').value;
 }
 async function sync() { render(await call('status')); }
 async function act(fn) {
  if (busy) return;
  busy = true;
  try { await sync(); notice('Đang xử lý…'); await fn(); }
  catch (e) { notice(e.message, true); }
  finally { busy = false; await sync().catch(() => {}); }
 }
 async function open() {
  document.getElementById('connectionsDialog')?.close();
  document.getElementById('canvasChromeDialog')?.close();
  document.getElementById('chromeDialog')?.close();
  if (!dialog.open) dialog.showModal();
  await sync();
  await call('cloudflareInspect');
  await sync();
 }
 $('remoteChromeClose').onclick = () => dialog.close();
 dialog.addEventListener('close', () => { clear(); notice(''); });
 for (const [id, method] of [['remoteChromeInstall', 'guide'], ['remoteChromeAdmin', 'admin'], ['remoteChromeCloudflareDownloads', 'cloudflareDownloads'], ['remoteChromeCloudflareGuide', 'cloudflareGuide']]) $(id).onclick = () => void act(async () => { await call(method); notice('Đã mở hướng dẫn chính thức.'); });
 $('remoteChromeExtension').onclick = () => void act(async () => { await host.call('extension.download'); notice('Đã tải tiện ích. Chuyển ZIP sang máy Chrome để giải nén và cài.'); });
 $('remoteChromeCloudflareInspect').onclick = () => void act(async () => { const result = await call('cloudflareInspect'); notice(result.installed ? 'Đã tìm thấy cloudflared ' + result.version + '.' : 'Chưa có cloudflared. Bấm Tải cloudflared; không cần cài Homebrew.'); });
 $('remoteChromeCloudflareInstall').onclick = () => void act(async () => { notice('Đang tải cloudflared từ nguồn chính thức và kiểm tra SHA256…'); await call('cloudflareInstall'); notice('Đã cài công cụ cho MooZ. Bấm Bắt đầu Cloudflare Tunnel.'); });
 $('remoteChromeCloudflareStart').onclick = () => void act(async () => { clear(); notice('Đang khởi động Cloudflare Tunnel, có thể mất khoảng một phút…'); await call('cloudflareStart'); notice('Đã khởi động tunnel. Bấm Tạo & sao chép mã để ghép máy Chrome.'); });
 $('remoteChromeSetup').onclick = () => void act(async () => { clear(); await call('setup'); notice('Đã thiết lập đường riêng qua Tailscale. Tạo mã để ghép máy Chrome.'); });
 $('remoteChromeCustom').onclick = () => void act(async () => { clear(); await call('custom', {endpoint: $('remoteChromeCustomURL').value.trim()}); notice('Đã lưu đường WSS. Kết nối từ máy Chrome để xác nhận đường truyền.'); });
 $('remoteChromeDisconnect').onclick = () => void act(async () => { await host.call('relay.disconnect'); notice('Đã ngắt Chrome cùng máy và thu hồi mã cũ. Có thể ghép máy Chrome khác.'); });
 $('remoteChromeCheck').onclick = () => void act(async () => { await call('check'); notice('Đã kiểm tra cấu hình trên máy này. Kết nối từ máy Chrome để xác nhận đường truyền hai chiều.'); });
 function showPair(p) { clear(); $('remoteChromeCode').value = p.url; $('remoteChromeReveal').disabled = false; }
 $('remoteChromePair').onclick = () => void act(async () => { const p = await call('pair'); showPair(p); notice('Mã mới có hiệu lực đến ' + new Date(p.expiresAt).toLocaleTimeString('vi-VN') + '. Mã cũ chưa dùng đã bị hủy.'); });
 $('remoteChromeCopy').onclick = () => void act(async () => { const p = await call('copy'); showPair(p); notice('Đã tạo và sao chép mã. Dán vào tiện ích trên máy Chrome trước ' + new Date(p.expiresAt).toLocaleTimeString('vi-VN') + '.'); });
 $('remoteChromeReveal').onclick = () => {
  const show = $('remoteChromeCode').type === 'password';
  $('remoteChromeCode').type = show ? 'text' : 'password';
  $('remoteChromeReveal').textContent = show ? 'Ẩn mã' : 'Hiện mã';
  $('remoteChromeReveal').setAttribute('aria-pressed', String(show));
  if (show) { $('remoteChromeCode').focus(); $('remoteChromeCode').select(); }
 };
 for (const [id, method] of [['remoteChromeRevoke', 'revoke'], ['remoteChromeDisable', 'disable'], ['remoteChromeReset', 'reset']]) $(id).onclick = () => void act(async () => { clear(); await call(method); notice(method === 'reset' ? 'Đã sao lưu và tạo lại cấu hình.' : 'Đã ngắt phiên từ xa. Kiểm tra tác vụ đang chạy trước khi thử lại.'); });
 function install() {
  const near = document.getElementById('connectionsPair');
  if (near && !document.getElementById('connectionsRemote')) {
   const b = document.createElement('button');
   b.id = 'connectionsRemote'; b.type = 'button'; b.textContent = 'Chrome ở máy khác';
   b.onclick = () => void open().catch(e => notice(e.message, true)); near.after(b);
  }
  for (const id of ['canvasChromeDialog', 'chromeDialog']) {
   const local = document.getElementById(id);
   if (!local || local.querySelector('[data-open-remote]')) continue;
   const b = document.createElement('button');
   b.dataset.openRemote = 'true'; b.type = 'button'; b.textContent = 'Kết nối Chrome ở máy khác';
   b.onclick = () => void open().catch(e => notice(e.message, true)); local.append(b);
  }
 }
 window.MooZRemoteChrome = {open};
 if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
 host.onEvent(e => { if (dialog.open && ['remoteChrome', 'relay'].includes(e.type)) void sync().catch(() => {}); });
})();
