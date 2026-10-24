const {app,BrowserWindow,ipcMain,protocol,net,dialog,Menu,shell,session,clipboard} = require('electron');
const path=require('node:path');
const fs=require('node:fs/promises');
const {pathToFileURL}=require('node:url');
const {ProjectStore}=require('./project-store.cjs');
const {providerForURL,allowedNetworkURL,resolveAppPath}=require('./policy.cjs');
const {AIWindows}=require('./ai-windows.cjs');
const {ChromeRelay}=require('./chrome-relay.cjs');
const {UpdateService,isDeveloperIDSigned,latestPublicRelease}=require('./updater.cjs');
const version=require('../package.json').version;
const root=path.resolve(__dirname,'..');
protocol.registerSchemesAsPrivileged([{scheme:'workflow',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true}}]);
const testMode=process.env.WORKFLOW_DESKTOP_TEST==='1'&&!app.isPackaged;
if(testMode){if(!process.env.WORKFLOW_TEST_DATA)throw Error('Missing test data directory');app.setPath('userData',path.resolve(process.env.WORKFLOW_TEST_DATA));}
let store,home,ai,relay,updater,chromeEverConnected=false;
const managedProjects=new Set();
const canvases=new Map(),sessionData=new Map(),requests=new Map(),installedSessions=new WeakSet();
function notify(value){if(value.type==='update'&&home&&!home.isDestroyed())home.webContents.send('workflow:event',value);if(value.type==='relay'&&value.connected){chromeEverConnected=true;managedProjects.clear();}for(const win of canvases.values())if(!win.isDestroyed())win.webContents.send('workflow:event',value);}
async function setupSession(ses){
  if(installedSessions.has(ses))return;installedSessions.add(ses);
  ses.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  ses.protocol.handle('workflow',async request=>{
    try{
      const file=resolveAppPath(root,request.url);if(!file)return new Response('Not found',{status:404});
      const response=await net.fetch(pathToFileURL(file).href);
      const headers=new Headers(response.headers);
      headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' data: blob: https:; connect-src 'self' data: blob: https: http://127.0.0.1:9473; worker-src 'self' blob:; object-src 'none'; frame-src 'none'; base-uri 'none'");
      headers.set('Cross-Origin-Opener-Policy','same-origin');headers.set('Cross-Origin-Embedder-Policy','credentialless');
      return new Response(response.body,{status:response.status,headers});
    }catch{return new Response('Not found',{status:404});}
  });
}
function protect(win){
  win.webContents.setWindowOpenHandler(({url})=>{if(/^https:\/\//.test(url))void shell.openExternal(url);return {action:'deny'};});
  win.webContents.on('will-navigate',(event,url)=>{const target=new URL(url);if(target.protocol!=='workflow:'||target.hostname!=='app')event.preventDefault();});
}
async function openHome(){
  if(home&&!home.isDestroyed()){home.show();home.focus();return;}
  await setupSession(session.defaultSession);
  home=new BrowserWindow({width:1200,height:830,minWidth:860,minHeight:650,backgroundColor:'#0d111b',title:'Workflow',webPreferences:{preload:path.join(__dirname,'preload.cjs'),additionalArguments:['--workflow-version='+version],contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true}});
  protect(home);home.on('closed',()=>{home=null;});await home.loadURL('workflow://app/desktop/home.html');
}
async function openProject(id){
  const info=(await store.list()).find(item=>item.id===id);if(!info)throw Error('Không tìm thấy dự án.');
  await store.readStorage(id); // Refuse corrupt project rather than replacing it with a blank one.
  const existing=canvases.get(id);if(existing&&!existing.isDestroyed()){existing.show();existing.focus();return info;}
  const ses=session.fromPartition('persist:workflow-project-'+id);await setupSession(ses);
  const win=new BrowserWindow({width:1500,height:960,minWidth:1000,minHeight:700,title:info.name,backgroundColor:'#111723',webPreferences:{session:ses,preload:path.join(__dirname,'preload.cjs'),additionalArguments:['--workflow-version='+version],contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true}});
  win.projectId=id;canvases.set(id,win);sessionData.set(id,{});protect(win);
  win.prepareToClose=async({requireSaved=false}={})=>{
    if(win.isDestroyed()||win.workflowCloseAllowed)return true;
    if(win.workflowClosing)return false;win.workflowClosing=true;
    try{
      const busy=await win.webContents.executeJavaScript('!!window.WorkflowDesktopLifecycle?.busy()');
      if(busy){const answer=await dialog.showMessageBox(win,{type:'warning',buttons:['Ở lại','Lưu, dừng và đóng'],defaultId:0,cancelId:0,message:'Workflow đang chạy. Bạn muốn lưu, dừng tác vụ và đóng dự án?'});if(answer.response!==1)return false;}
      await win.webContents.executeJavaScript('window.WorkflowDesktopLifecycle?.stop()');
      await win.webContents.executeJavaScript('window.WorkflowDesktopLifecycle?.flush()');
      win.workflowCloseAllowed=true;win.close();return true;
    }catch(error){if(requireSaved){await dialog.showMessageBox(win,{type:'error',buttons:['Ở lại'],message:'Chưa lưu được dự án. Bản cập nhật chưa được cài; hãy sửa lỗi lưu rồi thử lại.'});return false;}const answer=await dialog.showMessageBox(win,{type:'error',buttons:['Ở lại','Đóng, bỏ thay đổi chưa lưu'],defaultId:0,cancelId:0,message:'Chưa lưu được dự án: '+error.message});if(answer.response===1){win.workflowCloseAllowed=true;win.destroy();return true;}return false;}
    finally{win.workflowClosing=false;}
  };
  win.on('close',event=>{if(!win.workflowCloseAllowed){event.preventDefault();void win.prepareToClose();}});
  win.on('closed',()=>{canvases.delete(id);sessionData.delete(id);for(const [key,value]of requests)if(key.startsWith(id+':'))value.abort();});
  await win.loadURL('workflow://app/app.html');return info;
}
function context(event){
  const frame=event.senderFrame;if(!frame||frame!==event.sender.mainFrame)throw Error('Only the application window can request desktop actions.');
  const url=new URL(frame.url);if(url.protocol!=='workflow:'||url.host!=='app')throw Error('Untrusted caller.');
  const win=BrowserWindow.fromWebContents(event.sender);if(!win)throw Error('Unknown window.');return {win,id:win.projectId,home:url.pathname==='/desktop/home.html'};
}
function send(win,value){if(!win.isDestroyed())win.webContents.send('workflow:event',value);}
async function fetchBounded(id,data){
  if(!allowedNetworkURL(data.url))throw Error('Địa chỉ mạng chưa được cho phép.');
  if(!['GET','POST','PUT','DELETE'].includes(data.method||'GET'))throw Error('HTTP method not permitted.');
  const requestId=id+':'+data.requestId;if(requests.has(requestId))throw Error('Duplicate network request.');
  const controller=new AbortController();requests.set(requestId,controller);const timer=setTimeout(()=>controller.abort(),120000);
  try{
    let url=data.url;let response;
    for(let step=0;step<6;step++){
      response=await net.fetch(url,{method:data.method||'GET',headers:data.headers,body:data.body||undefined,signal:controller.signal,redirect:'manual',credentials:'omit'});
      if(response.status<300||response.status>=400)break;
      if(data.redirect==='error')throw Error('API redirect refused.');
      const next=new URL(response.headers.get('location'),url);if(!allowedNetworkURL(next.href)||next.origin!==new URL(url).origin)throw Error('Unsafe redirect refused.');url=next.href;
    }
    if(response.status>=300&&response.status<400)throw Error('Too many redirects.');
    const chunks=[];let bytes=0;for await(const chunk of response.body||[]){bytes+=chunk.byteLength;if(bytes>128*1024*1024)throw Error('Tệp vượt giới hạn 128 MB.');chunks.push(Buffer.from(chunk));}
    return {status:response.status,headers:Object.fromEntries(response.headers),bytes:new Uint8Array(Buffer.concat(chunks))};
  }finally{clearTimeout(timer);requests.delete(requestId);}
}
async function download(win,data){
  const name=path.basename(String(data.name||data.filename||'workflow-download'));
  const choice=await dialog.showSaveDialog(win,{defaultPath:path.join(app.getPath('downloads'),name)});
  if(choice.canceled)return null;
  let bytes=data.bytes;
  if(!bytes){if(!allowedNetworkURL(data.url))throw Error('Nguồn tải chưa được cho phép trên desktop.');const result=await fetchBounded(win.projectId,{url:data.url,requestId:require('node:crypto').randomUUID(),method:'GET',redirect:'error'});if(result.status<200||result.status>=300)throw Error('Tải tệp thất bại: HTTP '+result.status);bytes=result.bytes;}
  if(bytes.byteLength>128*1024*1024)throw Error('Tệp vượt giới hạn 128 MB.');
  await fs.writeFile(choice.filePath,Buffer.from(bytes));return 1;
}
ipcMain.handle('workflow:call',async(event,method,data={})=>{
  const ctx=context(event),{win,id}=ctx;
  if(method==='updates.status')return updater.status();
  if(method==='updates.check')return updater.check();
  if(method==='updates.install')return updater.install();
  if(method==='updates.release'){await shell.openExternal(updater.releaseURL());return;}
  if(method==='relay.pair')return {url:relay.pairingURI()};
  // Copy only the host-generated pairing code; no renderer-supplied text or clipboard reads.
  if(method==='relay.copy'){await clipboard.writeText(relay.pairingURI());return {copied:true};}
  if(method==='relay.status')return relay.status();
  if(method==='projects.list')return store.list();
  if(method==='projects.create'){if(!ctx.home)throw Error('Open project library first.');return store.create(data.name);}
  if(method==='projects.open'){if(!ctx.home)throw Error('Open project library first.');const info=await openProject(data.id);if(data.view==='chat')await canvases.get(data.id).webContents.executeJavaScript('window.WorkflowChat?.open()');return info;}
  if(method==='projects.rename'){if(!ctx.home)throw Error('Open project library first.');return store.rename(data.id,data.name);}
  if(method==='projects.restore'){if(!ctx.home)throw Error('Open project library first.');if(canvases.has(data.id))throw Error('Đóng cửa sổ dự án trước khi khôi phục.');return store.restore(data.id);}
  if(method==='home.open'){await openHome();return;}
  if(!id)throw Error('Project context required.');
  if(method==='project.info')return (await store.list()).find(item=>item.id===id);
  if(method==='storage.get')return data.area==='session'?(sessionData.get(id)||{}):store.readStorage(id);
  if(method==='storage.set'){
    if(!data.patch||typeof data.patch!=='object'||Array.isArray(data.patch))throw Error('Invalid storage data.');
    if(data.area==='session'){sessionData.set(id,{...sessionData.get(id),...data.patch});return;}
    if(Object.hasOwn(data.patch,'workflowApiKeys'))throw Error('API keys may only be stored in session memory.');
    send(win,{type:'storage',state:'saving'});
    try{await store.writeStorage(id,data.patch);send(win,{type:'storage',state:'saved'});}catch(error){send(win,{type:'storage',state:'error',error:error.message});throw error;}return;
  }
  if(method==='provider.open'){managedProjects.add(id);return ai.open(data.provider);}
  if(method.startsWith('tabs.')&&!managedProjects.has(id)&&chromeEverConnected){
    if(['tabs.query','tabs.get','tabs.message','tabs.script'].includes(method))return relay.request(method,data);
    if(method==='tabs.focus')return relay.request('tabs.focus',data);
  }
  if(method==='tabs.query')return ai.list(data?.url);
  if(method==='tabs.get')return ai.tab(ai.find(data.id));
  if(method==='tabs.focus')return ai.focus(data.id);
  if(method==='tabs.message')return ai.message(data.id,data.message,id);
  if(method==='tabs.script')return ai.script(data.id,data.files,data.operation,id);
  if(method==='tabs.create'){
    const provider=providerForURL(data.url);if(provider)return ai.open(provider);
    if(String(data.url).startsWith('workflow://app/'))throw Error('Cập nhật dữ liệu tiện ích chưa hỗ trợ trong desktop.');
    throw Error('Only supported AI windows can be opened.');
  }
  if(method==='network.fetch')return fetchBounded(id,data);
  if(method==='network.cancel'){requests.get(id+':'+data.requestId)?.abort();return;}
  if(method==='download.bytes'||method==='download.url')return download(win,data);
  throw Error('Unknown desktop operation.');
});
app.whenReady().then(async()=>{
  store=new ProjectStore(path.join(app.getPath('userData'),'projects'));
  relay=new ChromeRelay(notify);await relay.start();
  ai=new AIWindows(root,version,notify,async projectId=>projectId?(await store.readStorage(projectId)).workflowMuseSendTarget:null);
  const signed=app.isPackaged&&process.platform==='darwin'&&await isDeveloperIDSigned(path.dirname(path.dirname(path.dirname(process.execPath))));
  updater=new UpdateService({version,packaged:app.isPackaged,platform:process.platform,signed,engine:signed?require('electron-updater').autoUpdater:null,fetchRelease:()=>latestPublicRelease(net.fetch.bind(net)),
    prepareInstall:async()=>{
      const answer=await dialog.showMessageBox({type:'question',buttons:['Để sau','Lưu và cài'],defaultId:0,cancelId:0,message:'Lưu công việc, dừng các workflow rồi cài và khởi động lại?',detail:'Dự án và thiết lập vẫn được giữ trên máy.'});
      if(answer.response!==1)return false;
      for(const win of [...canvases.values()])if(!await win.prepareToClose({requireSaved:true}))return false;
      return true;
    },onInstallStart:()=>{quitApproved=true;},onInstallFailed:()=>{quitApproved=false;}});
  updater.on('status',status=>notify({type:'update',status}));updater.start();
  if(testMode)globalThis.workflowTest={store,ai,relay,updater,openProject,openHome};
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform==='darwin'?[{role:'appMenu'}]:[]),
    {label:'Dự án',submenu:[{label:'Thư viện dự án',accelerator:'CmdOrCtrl+Shift+P',click:()=>void openHome()},{role:'close'},{role:'quit'}]},
    {role:'editMenu'},{label:'Hiển thị',submenu:[{role:'reload'},{role:'toggleDevTools'},{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'}]},
    {label:'AI',submenu:Object.entries({chatgpt:'ChatGPT',gemini:'Gemini',muse:'Muse'}).map(([id,label])=>({label:'Mở '+label,click:()=>ai.open(id)}))}
  ]));
  await openHome();
}).catch(error=>{dialog.showErrorBox('Không mở được Workflow',error.message);app.quit();});
app.on('activate',()=>{if(!home||home.isDestroyed())void openHome();});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
let quitApproved=false,quitInProgress=false;
app.on('before-quit',event=>{
  if(quitApproved)return;event.preventDefault();if(quitInProgress)return;quitInProgress=true;
  void(async()=>{try{for(const win of [...canvases.values()])if(!await win.prepareToClose())return;quitApproved=true;app.quit();}finally{quitInProgress=false;}})();
});
app.on('will-quit',()=>{updater?.stop();void relay?.close();for(const controller of requests.values())controller.abort();});
