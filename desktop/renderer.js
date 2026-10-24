/* Host adapter. In the Chrome extension this file deliberately has no effect. */
(() => {
  const host = window.workflowDesktop;
  if (!host) return;
  const call = (method, data) => host.call(method, data);
  const listeners = {message: new Set(), updated: new Set(), created: new Set()};
  const event = name => ({addListener: fn => listeners[name].add(fn), removeListener: fn => listeners[name].delete(fn)});
  const get = async (area, keys) => {
    const all = await call('storage.get', {area});
    if (keys == null) return all;
    if (typeof keys === 'string') return {[keys]: all[keys]};
    return Object.fromEntries((Array.isArray(keys) ? keys : Object.keys(keys)).map(key => [key, all[key] ?? keys[key]]));
  };
  const storage = area => ({get: keys => get(area, keys), set: patch => call('storage.set', {area, patch})});
  window.chrome = {
    runtime: {
      id: 'workflow-desktop',
      getManifest: () => ({version: host.version}),
      getURL: path => new URL(path, 'workflow://app/').href,
      onMessage: event('message')
    },
    storage: {local: storage('local'), session: storage('session')},
    tabs: {
      query: options => call('tabs.query', options),
      get: id => call('tabs.get', {id}),
      update: (id, options) => call('tabs.focus', {id, ...options}),
      create: options => call('tabs.create', options),
      sendMessage: (id, message) => call('tabs.message', {id, message}),
      onUpdated: event('updated'), onCreated: event('created')
    },
    // tabs.update already focuses the owning native/Chrome window.
    windows: {update: async id => ({id, focused:true})},
    scripting: {executeScript: async details => {
      let operation;
      if (details.func) {
        const source = details.func.toString().replace(/\s+/g, '');
        if (source.includes('WorkflowResultPicker.pick()')) operation = 'pick';
        else if (source.includes('WorkflowComposer?.scopeFor')) operation = 'composer';
        else if (source.includes('WorkflowMuseSupport.bindSend()')) operation = details.args?.[0] === 'bind' ? 'bind' : 'diagnostics';
        else throw Error('Thao tác trình duyệt chưa được hỗ trợ trên desktop.');
      }
      return call('tabs.script', {id: details.target?.tabId, files: details.files, operation});
    }},
    downloads: {download: async options => {
      if (/^(blob:|data:)/.test(options.url)) {
        const blob = await (await fetch(options.url)).blob();
        return call('download.bytes', {bytes: new Uint8Array(await blob.arrayBuffer()), name: options.filename, saveAs: options.saveAs});
      }
      return call('download.url', options);
    }}
  };
  host.onEvent(value => {
    if (value.type === 'message') for (const fn of listeners.message) fn(value.message, {id: 'workflow-desktop', tab: {id: value.tabId}});
    if (value.type === 'updated') for (const fn of listeners.updated) fn(value.tab.id, value.changeInfo, value.tab);
    if (value.type === 'created') for (const fn of listeners.created) fn(value.tab);
  });
  // Route provider API requests through the bounded, allowlisted desktop transport.
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, options = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!/^https:\/\/(api\.openai\.com|generativelanguage\.googleapis\.com|queue\.fal\.run)\//.test(url) && !/^http:\/\/127\.0\.0\.1:9473\//.test(url)) return originalFetch(input, options);
    const requestId = crypto.randomUUID();
    const signal = options.signal;
    if (signal?.aborted) throw new DOMException('Đã dừng.', 'AbortError');
    const cancel = () => void call('network.cancel', {requestId}).catch(() => {});
    signal?.addEventListener('abort', cancel, {once: true});
    try {
      const result = await call('network.fetch', {requestId, url, method: options.method || 'GET', headers: Object.fromEntries(new Headers(options.headers)), body: options.body, redirect: options.redirect});
      if (signal?.aborted) throw new DOMException('Đã dừng.', 'AbortError');
      return new Response(result.bytes, {status: result.status, headers: result.headers});
    } finally { signal?.removeEventListener('abort', cancel); }
  };
  window.addEventListener('DOMContentLoaded', async () => {
    if (!document.querySelector('#canvas')) return;
    const style = document.createElement('style');
    style.textContent = '.desktop-bar{display:flex;gap:10px;align-items:center;padding:8px 16px;background:#171b26;border-bottom:1px solid #333b4e;color:#d9e1f2;font:12px system-ui}.desktop-bar strong{margin-right:auto}.desktop-bar button{background:#252e43;border:1px solid #45516d;color:inherit;border-radius:6px;padding:5px 10px;cursor:pointer}.desktop-save[data-state="error"]{color:#ff9c9c}';
    document.head.append(style);
    const bar = document.createElement('nav'); bar.className = 'desktop-bar'; bar.setAttribute('aria-label', 'Ứng dụng desktop');
    const title = document.createElement('strong'); title.textContent = 'Workflow Desktop';
    const status = document.createElement('span'); status.className = 'desktop-save'; status.textContent = 'Dữ liệu cục bộ';
    const projects = document.createElement('button'); projects.textContent = 'Dự án'; projects.onclick = () => void call('home.open');
    const connect=document.createElement('button');connect.id='desktopConnectChrome';connect.className='studio-connect';connect.textContent='Kết nối Chrome';
    const pairingDialog=document.createElement('dialog');pairingDialog.className='connection-dialog';pairingDialog.id='canvasChromeDialog';
    pairingDialog.innerHTML='<span class="studio-eyebrow">KẾT NỐI TRÌNH DUYỆT</span><h2>Dùng các tab AI trong Chrome</h2><ol><li>Cài tiện ích Workflow trong Chrome.</li><li>Mở tiện ích, bấm <strong>Kết nối app desktop</strong>.</li><li>Dán mã bên dưới, kết nối rồi chọn tab AI trong node.</li></ol><label>Mã kết nối phiên này<input id="canvasChromePairing" type="password" readonly autocomplete="off" spellcheck="false" aria-label="Mã kết nối Chrome"></label><p>Giữ app và Chrome cùng mở. Chỉ dán mã vào tiện ích Workflow trên máy của bạn.</p><p id="canvasChromeStatus" role="status" aria-live="polite"></p><div class="dialog-actions"><button id="canvasChromeReveal" type="button" aria-pressed="false">Hiện mã</button><button id="canvasChromeClose" type="button">Đóng</button><button id="canvasChromeCopy" class="primary" type="button">Sao chép mã</button></div>';
    document.body.append(pairingDialog);const pairingInput=pairingDialog.querySelector('input'),pairingStatus=pairingDialog.querySelector('[role="status"]');
    connect.onclick=async()=>{connect.disabled=true;try{const pair=await call('relay.pair');pairingInput.value=pair.url;const state=await call('relay.status');pairingStatus.textContent=state.connected?'Chrome đã kết nối.':'Sao chép mã rồi dán vào tiện ích trong Chrome.';pairingDialog.showModal();}catch(error){status.textContent=error.message;status.dataset.state='error';}finally{connect.disabled=false;}};
    pairingDialog.querySelector('#canvasChromeClose').onclick=()=>pairingDialog.close();pairingDialog.addEventListener('close',()=>{pairingInput.value='';pairingInput.type='password';reveal.textContent='Hiện mã';reveal.setAttribute('aria-pressed','false');});const reveal=pairingDialog.querySelector('#canvasChromeReveal');reveal.onclick=()=>{const show=pairingInput.type==='password';pairingInput.type=show?'text':'password';reveal.textContent=show?'Ẩn mã':'Hiện mã';reveal.setAttribute('aria-pressed',String(show));if(show){pairingInput.focus();pairingInput.select();}};
    pairingDialog.querySelector('#canvasChromeCopy').onclick=async()=>{try{await call('relay.copy');pairingStatus.textContent='Đã sao chép. Dán vào Kết nối app desktop trong Chrome.';}catch{pairingStatus.textContent='Chưa sao chép được. Bấm Hiện mã, chọn mã rồi nhấn ⌘C trên Mac hoặc Ctrl+C.';}};
    (document.getElementById('studioConnections')||bar).append(connect);
    bar.append(title, status, projects);
    for (const [id, label] of [['chatgpt', 'Mở ChatGPT'], ['gemini', 'Mở Gemini'], ['muse', 'Mở Muse']]) {
      const button = document.createElement('button'); button.textContent = label;
      button.onclick = async () => {try {await call('provider.open', {provider: id});} catch(error) {status.textContent = error.message; status.dataset.state = 'error';}};
      bar.append(button);
    }
    document.body.prepend(bar);
    try {const info = await call('project.info'); title.textContent = info.name;} catch(error) {status.textContent = error.message;}
    for (const id of ['packageUpdateBtn', 'dataUpdateBtn']) {const button = document.getElementById(id); if (button) button.hidden = true;}
    host.onEvent(value => {if (value.type === 'storage') {status.textContent = value.state === 'saved' ? 'Đã lưu · ' + new Date().toLocaleTimeString('vi-VN') : value.state === 'saving' ? 'Đang lưu…' : 'Lưu lỗi: ' + value.error; status.dataset.state = value.state;}});
  });
})();
