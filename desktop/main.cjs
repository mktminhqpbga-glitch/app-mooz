const {app,BrowserWindow,ipcMain,protocol,net,dialog,Menu,shell,session,clipboard,nativeImage} = require('electron');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {ProjectStore}=require('./project-store.cjs');
const {providerForURL,allowedNetworkURL,resolveAppPath}=require('./policy.cjs');
const {AIWindows}=require('./ai-windows.cjs');
const {ChromeRelay}=require('./chrome-relay.cjs');
const {Downloads}=require('./downloads.cjs');
const {PostingStore}=require('./posting-store.cjs');
const {FacebookPublisher}=require('./facebook-publisher.cjs');
const {PostingService}=require('./posting-service.cjs');
const {PostingAI}=require('./posting-ai.cjs');
const {PostingOAuth}=require('./posting-oauth.cjs');
const {BrandStore}=require('./brand-store.cjs');
const {ChatStore}=require('./chat-store.cjs');
const {FacebookPages}=require('./facebook-pages.cjs');
const {FacebookLogin}=require('./facebook-login.cjs');
const {AffiliateService}=require('./affiliate-service.cjs');
const {checkedURL:affiliateURL}=require('./affiliate-source.cjs');
const {UpdateService,isDeveloperIDSigned,latestPublicRelease}=require('./updater.cjs');
const version=require('../package.json').version;
const root=path.resolve(__dirname,'..');
protocol.registerSchemesAsPrivileged([{scheme:'workflow',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true}}]);
const testMode=process.env.WORKFLOW_DESKTOP_TEST==='1'&&!app.isPackaged;
if(testMode){if(!process.env.WORKFLOW_TEST_DATA)throw Error('Missing test data directory');app.setPath('userData',path.resolve(process.env.WORKFLOW_TEST_DATA));}
if(!app.requestSingleInstanceLock())app.exit(0);
app.on('second-instance',()=>{if(home&&!home.isDestroyed()){home.show();home.focus();}});
let store,home,ai,relay,updater,downloads,posting,postingAI,postingOAuth,brands,chats,facebookPages,facebookLogin,postingWindow,affiliate,affiliateWindow,chromeEverConnected=false;
const managedProjects=new Set();
const canvases=new Map(),sessionData=new Map(),requests=new Map(),installedSessions=new WeakSet();
const projectTransitions=new Set(),affiliateTransitions=new Set();
function notify(value){if(affiliateWindow&&!affiliateWindow.isDestroyed())affiliateWindow.webContents.send('workflow:event',value);if(postingWindow&&!postingWindow.isDestroyed())postingWindow.webContents.send('workflow:event',value);if(['update','brands'].includes(value.type)&&home&&!home.isDestroyed())home.webContents.send('workflow:event',value);if(value.type==='relay'&&value.connected){chromeEverConnected=true;managedProjects.clear();}for(const win of canvases.values())if(!win.isDestroyed())win.webContents.send('workflow:event',value);}
async function setupSession(ses){
  if(installedSessions.has(ses))return;installedSessions.add(ses);
  downloads.install(ses);
  ses.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  ses.protocol.handle('workflow',async request=>{
    try{
      const media=/^workflow:\/\/app\/posting-media\/([a-f0-9-]{36})\/(\d{1,2})$/.exec(request.url);
      const affiliateMedia=/^workflow:\/\/app\/affiliate-media\/([a-f0-9-]{36})\/([0-4])$/.exec(request.url);
      const brandMedia=/^workflow:\/\/app\/brand-media\/([a-f0-9-]{36})\/([a-f0-9-]{36})$/.exec(request.url);
      const file=affiliateMedia?await affiliate.mediaPath(affiliateMedia[1],Number(affiliateMedia[2])):media?await posting.store.mediaPath(media[1],Number(media[2])):brandMedia?await brands.assetPath(brandMedia[1],brandMedia[2]):resolveAppPath(root,request.url);if(!file)return new Response('Not found',{status:404});
      const response=await net.fetch(pathToFileURL(file).href,{headers:request.headers.get('Range')?{Range:request.headers.get('Range')}:{}});
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
async function openPosting(){
 if(postingWindow&&!postingWindow.isDestroyed()){postingWindow.show();postingWindow.focus();return;}
 postingWindow=new BrowserWindow({width:1400,height:930,minWidth:900,minHeight:680,title:'Đăng bài · Workflow',backgroundColor:'#111723',webPreferences:{preload:path.join(__dirname,'preload.cjs'),additionalArguments:['--workflow-version='+version],backgroundThrottling:false,contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true}});protect(postingWindow);postingWindow.on('closed',()=>{postingOAuth?.cancel();facebookLogin?.cancel();facebookPages?.clear();postingWindow=null;});await setupSession(session.defaultSession);await postingWindow.loadURL('workflow://app/desktop/posting.html');
}
async function openHome(){
  if(home&&!home.isDestroyed()){home.show();home.focus();return;}
  await setupSession(session.defaultSession);
  home=new BrowserWindow({width:1200,height:830,minWidth:860,minHeight:650,backgroundColor:'#0d111b',title:'Workflow',webPreferences:{preload:path.join(__dirname,'preload.cjs'),additionalArguments:['--workflow-version='+version],backgroundThrottling:false,contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true}});
  protect(home);home.on('closed',()=>{home=null;});await home.loadURL('workflow://app/desktop/home.html');
}
async function openAffiliate(){
 if(affiliateWindow&&!affiliateWindow.isDestroyed()){affiliateWindow.show();affiliateWindow.focus();return;}
 await setupSession(session.defaultSession);
 affiliateWindow=new BrowserWindow({width:1420,height:950,minWidth:1000,minHeight:700,title:'Affiliate Shopee · Workflow',backgroundColor:'#10131d',webPreferences:{preload:path.join(__dirname,'preload.cjs'),additionalArguments:['--workflow-version='+version],backgroundThrottling:false,contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true}});
 protect(affiliateWindow);affiliateWindow.on('closed',()=>{affiliateWindow=null;});await affiliateWindow.loadURL('workflow://app/desktop/affiliate.html');
}
async function openProject(id){
  if(projectTransitions.has(id))throw Error('Dự án đang được xử lý. Vui lòng thử lại.');
  projectTransitions.add(id);
  try{
  const info=(await store.list()).find(item=>item.id===id);if(!info)throw Error('Không tìm thấy dự án.');
  await store.readStorage(id); // Refuse corrupt project rather than replacing it with a blank one.
  const existing=canvases.get(id);if(existing&&!existing.isDestroyed()){existing.show();existing.focus();return info;}
  const ses=session.fromPartition('persist:workflow-project-'+id);await setupSession(ses);
  const win=new BrowserWindow({width:1500,height:960,minWidth:1000,minHeight:700,title:info.name,backgroundColor:'#111723',webPreferences:{session:ses,preload:path.join(__dirname,'preload.cjs'),additionalArguments:['--workflow-version='+version],backgroundThrottling:false,contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true}});
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
  const postingOwner=win.webContents.id;win.on('closed',()=>{canvases.delete(id);sessionData.delete(id);void posting.store.cleanup(postingOwner);for(const [key,value]of requests)if(key.startsWith(id+':'))value.abort();});
  await win.loadURL('workflow://app/app.html');return info;
  }finally{projectTransitions.delete(id);}
}
function context(event){
  const frame=event.senderFrame;if(!frame||frame!==event.sender.mainFrame)throw Error('Only the application window can request desktop actions.');
  const url=new URL(frame.url);if(url.protocol!=='workflow:'||url.host!=='app')throw Error('Untrusted caller.');
  const win=BrowserWindow.fromWebContents(event.sender);if(!win)throw Error('Unknown window.');return {win,id:win.projectId,home:url.pathname==='/desktop/home.html',posting:win===postingWindow&&url.pathname==='/desktop/posting.html',affiliate:win===affiliateWindow&&url.pathname==='/desktop/affiliate.html'};
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
ipcMain.handle('workflow:call',async(event,method,data={})=>{
  const ctx=context(event),{win,id}=ctx;
  if(method==='affiliate.open'){await openAffiliate();return;}
  if(method.startsWith('affiliate.')){
   if(!ctx.affiliate)throw Error('Mở ứng dụng Affiliate Shopee trước.');
   if(method==='affiliate.snapshot')return affiliate.snapshot();
   if(method==='affiliate.get')return affiliate.get(data.id);
   if(method==='affiliate.tabs')return postingAI.tabs();
   if(method==='affiliate.openAI')return ai.open('chatgpt');
   if(method==='affiliate.create')return affiliate.create(data);
   if(method==='affiliate.pause')return affiliate.pause(data.paused);
   if(method==='affiliate.cancel')return affiliate.cancel(data.id);
   if(method==='affiliate.archive')return affiliate.archive(data.id);
   if(method==='affiliate.source'){const job=await affiliate.get(data.id);await shell.openExternal(affiliateURL(job.affiliate));return;}
   if(method==='affiliate.workflow'){
    if(affiliateTransitions.has(data.id))throw Error('Workflow affiliate đang được mở.');affiliateTransitions.add(data.id);
    try{
     const job=await affiliate.get(data.id);if(!job.story?.review?.approved||job.status!=='ready')throw Error('Hoàn tất kịch bản và kiểm tra trước khi tạo workflow.');
     if(!['muse','google'].includes(data.videoProvider||'muse'))throw Error('AI video không hợp lệ.');
     let project=job.projectId&&(await store.list()).find(p=>p.id===job.projectId);
     if(!project){project=await store.create(('Affiliate · '+job.product.title).slice(0,100));await store.writeStorage(project.id,{museflow:{nodes:[],edges:[],groups:[],notes:[],settings:{}}});await affiliate.save(job.id,{projectId:project.id});}
     try{await openProject(project.id);await canvases.get(project.id).webContents.executeJavaScript('window.WorkflowAffiliate.create('+JSON.stringify({jobId:job.id,title:job.product.title,affiliate:job.affiliate,caption:job.caption,scenes:job.story.scenes,images:await affiliate.readImages(job.id),videoProvider:data.videoProvider||'muse',voice:!!data.voice})+')');await affiliate.save(job.id,{workflowError:''});return {id:project.id};}
     catch(error){await affiliate.save(job.id,{workflowError:'Tạo workflow bị gián đoạn. Bấm Mở / khôi phục workflow để kiểm tra và tiếp tục trong cùng dự án.'});throw error;}
    }finally{affiliateTransitions.delete(data.id);}
   }
   throw Error('Thao tác affiliate không hợp lệ.');
  }
  if(method==='posting.open'){await openPosting();if(data.view)postingWindow.webContents.send('workflow:event',{type:'posting.view',view:data.view});return;}
  if(method.startsWith('brands.')){
   if(!ctx.home&&!ctx.posting&&!id)throw Error('Mở không gian làm việc trước.');
   if(method==='brands.list')return (await brands.list()).map(b=>brands.public(b));
   if(method==='brands.get')return brands.public(await brands.get(data.id));
   if(method==='brands.project'){if(!id)throw Error('Mở dự án trước.');const saved=await store.readStorage(id);return {brandId:saved.workflowBrandId||''};}
   if(method==='brands.select'){if(!id)throw Error('Mở dự án trước.');if(data.id)await brands.snapshot(data.id);await store.writeStorage(id,{workflowBrandId:data.id||''});return;}
   if(!ctx.home&&!ctx.posting)throw Error('Sửa thương hiệu trong Trung tâm điều hành.');
   let result;if(method==='brands.save')result=await brands.save(data);else if(method==='brands.asset.add')result=await brands.addAsset(data);else if(method==='brands.asset.remove')result=await brands.removeAsset(data.id,data.assetId,data.expectedUpdatedAt);else if(method==='brands.archive')result=await brands.archive(data.id);else throw Error('Thao tác thương hiệu không hợp lệ.');notify({type:'brands'});return brands.public(result);
  }
  if(method.startsWith('chat.')){if(!id)throw Error('Hội thoại thuộc từng dự án.');if(method==='chat.get')return chats.get(id);if(method==='chat.save')return chats.save(id,data);throw Error('Thao tác hội thoại không hợp lệ.');}
  if(method.startsWith('posting.')){
   if(['posting.begin','posting.append','posting.commit','posting.abort'].includes(method)){
    if(!id)throw Error('Thêm kết quả từ cửa sổ dự án.');
    if(method==='posting.begin'){const saved=await store.readStorage(id);const job=await posting.store.begin(win.webContents.id,id,data);const draft=posting.store.drafts.get(job.id);if(saved.workflowBrandId&&draft){try{draft.job.brandSnapshot=await brands.snapshot(saved.workflowBrandId);draft.job.brandId=saved.workflowBrandId;}catch{}}return job;}
    if(method==='posting.append')return posting.store.append(win.webContents.id,data);
    if(method==='posting.abort')return posting.store.abort(win.webContents.id,data.id);
    const job=await posting.store.commit(win.webContents.id,data.id);await posting.changed();return {id:job.id};
   }
   if(!ctx.posting)throw Error('Mở ứng dụng Đăng bài trước.');
   if(method==='posting.snapshot')return posting.snapshot();
   if(method==='posting.tabs')return postingAI.tabs();
   if(method==='posting.openAI')return ai.open('chatgpt');
   if(method==='posting.facebook.check')return facebookLogin.check(data.url);
   if(method==='posting.facebook.login')return facebookLogin.login(data.url);
   if(method==='posting.facebook.discover')return facebookPages.discover(data.token);
   if(method==='posting.facebook.import'){if(data.brandId)await brands.snapshot(data.brandId);return facebookPages.import(data);}
   if(method==='posting.facebook.clear'){facebookLogin.cancel();facebookPages.clear();return;}
   if(method==='posting.connection.brand'){if(data.brandId)await brands.snapshot(data.brandId);return posting.publisher.assignBrand(data.id,data.brandId||'');}
   if(method==='posting.finishing'){const j=await posting.store.read(data.id),outputs=j.media.map((m,index)=>({...m,index})).filter(m=>m.role==='output');if(!['frameFit','subtitles','watermark'].includes(data.kind)||outputs.length!==1||outputs[0].kind!=='video')throw Error('Chọn một video và công cụ hậu kỳ hợp lệ.');let logoURL;if(data.kind==='watermark'){if(!j.brandId)throw Error('Gắn thương hiệu có logo trên thẻ Soạn bài trước.');const b=brands.public(await brands.get(j.brandId)),logo=b.assets.find(a=>a.role==='logo');if(!logo)throw Error('Thương hiệu này chưa có logo.');logoURL=logo.url;}const projects=await store.list();let project=projects.find(p=>p.id===j.projectId);if(!project)project=await store.create('Hậu kỳ · '+j.title);await openProject(project.id);return canvases.get(project.id).webContents.executeJavaScript('window.WorkflowFinishing.create('+JSON.stringify({mediaURL:'workflow://app/posting-media/'+j.id+'/'+outputs[0].index,title:j.title,kind:data.kind,logoURL})+')');}
   if(method==='posting.reschedule')return posting.reschedule(data.id,data);
   if(method==='posting.approve')return posting.approve(data.id);
   if(method==='posting.catalog')return posting.catalog(data.id,data);
   if(method==='posting.metrics')return posting.metrics(data.id);
   if(method==='posting.connect')return posting.publisher.connect(data);
   if(method==='posting.youtube'){const credentials=await postingOAuth.google(data.config);return posting.publisher.connectYouTube(credentials);}
   if(method==='posting.oauth.cancel'){postingOAuth.cancel();return;}
   if(method==='posting.instagram')return posting.publisher.connectInstagram(data);
   if(method==='posting.tiktok')return posting.publisher.connectTikTok(data);
   if(method==='posting.storage')return posting.publisher.connectStorage(data);
   if(method==='posting.verify')return posting.publisher.verify(data.id);
   if(method==='posting.webhook')return posting.publisher.connectWebhook(data);
   if(method==='posting.disconnect'){if(posting.busy())throw Error('Chờ tác vụ đăng bài hoàn tất.');return posting.publisher.disconnect(data.id);}
   if(method==='posting.settings')return posting.settingsSave(data);
   if(method==='posting.edit')return posting.edit(data.id,data.patch||{});
   if(method==='posting.caption')return posting.caption(data.id,data.target);
   if(method==='posting.publish')return posting.publish(data.id);
   if(method==='posting.queue'){const result=await posting.queuePost(data.id,data);void posting.tick().catch(()=>{});return result;}
   if(method==='posting.unqueue')return posting.unqueue(data.id);
   if(method==='posting.resolve')return posting.resolve(data.id,data.confirmed);
   if(method==='posting.stop')return posting.stop(data.id);
   if(method==='posting.remove')return posting.remove(data.id);
   if(method==='posting.copy')return posting.copy(data.id);
   throw Error('Thao tác đăng bài không được hỗ trợ.');
  }
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
  if(method==='projects.trash'||method==='projects.undoTrash'){
    if(!ctx.home)throw Error('Open project library first.');
    if(canvases.has(data.id))throw Error('Đóng cửa sổ dự án trước khi xóa hoặc hoàn tác.');
    if(projectTransitions.has(data.id))throw Error('Dự án đang được xử lý. Vui lòng thử lại.');
    projectTransitions.add(data.id);
    try{return await (method==='projects.trash'?store.trash(data.id):store.undoTrash(data.id));}
    finally{projectTransitions.delete(data.id);}
  }
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
  if(method==='download.url')return downloads.download(win,data);
  if(method==='download.reveal')return downloads.show(win,data.id);
  throw Error('Unknown desktop operation.');
});
app.whenReady().then(async()=>{
  downloads=new Downloads({directory:()=>app.getPath('downloads'),windowFor:contents=>contents?BrowserWindow.fromWebContents(contents):null,dialog,notify:send,reveal:file=>shell.showItemInFolder(file)});
  store=new ProjectStore(path.join(app.getPath('userData'),'projects'));
  relay=new ChromeRelay(notify);await relay.start();
  ai=new AIWindows(root,version,notify,async projectId=>projectId?(await store.readStorage(projectId)).workflowMuseSendTarget:null);
  const postingRoot=path.join(app.getPath('userData'),'posting');
  const postingStore=new PostingStore(postingRoot),publisher=new FacebookPublisher({root:postingRoot,fetch:net.fetch.bind(net),safeStorage:require('electron').safeStorage});
  brands=new BrandStore(path.join(app.getPath('userData'),'brands'));await brands.init();chats=new ChatStore(path.join(app.getPath('userData'),'chats'));
  facebookPages=new FacebookPages(publisher);facebookLogin=new FacebookLogin({fetch:net.fetch.bind(net),openExternal:url=>shell.openExternal(url),pages:facebookPages});
  postingOAuth=new PostingOAuth({fetch:net.fetch.bind(net),openExternal:url=>shell.openExternal(url)});
  postingAI=new PostingAI({ai,relay,store:postingStore});posting=new PostingService({store:postingStore,publisher,brands,ask:(...args)=>postingAI.ask(...args),notify:()=>notify({type:'posting'})});await posting.init();posting.start();
  affiliate=new AffiliateService({root:path.join(app.getPath('userData'),'affiliate'),ai:postingAI,fetchImpl:net.fetch.bind(net),notify:()=>notify({type:'affiliate'}),decodeImage:bytes=>{let image=nativeImage.createFromBuffer(bytes);if(image.isEmpty())throw Error('Không giải mã được ảnh sản phẩm.');const {width,height}=image.getSize();if(width*height>25000000)throw Error('Ảnh sản phẩm quá lớn.');const scale=Math.min(1,1600/Math.max(width,height));if(scale<1)image=image.resize({width:Math.round(width*scale),height:Math.round(height*scale),quality:'best'});const jpeg=image.toJPEG(90);if(jpeg.length>4*1024*1024)throw Error('Ảnh sản phẩm sau thu nhỏ vẫn quá lớn.');return 'data:image/jpeg;base64,'+jpeg.toString('base64');}});await affiliate.init();
  const signed=app.isPackaged&&process.platform==='darwin'&&await isDeveloperIDSigned(path.dirname(path.dirname(path.dirname(process.execPath))));
  updater=new UpdateService({version,packaged:app.isPackaged,platform:process.platform,signed,engine:signed?require('electron-updater').autoUpdater:null,fetchRelease:()=>latestPublicRelease(net.fetch.bind(net)),
    prepareInstall:async()=>{
      posting.hold=true;try{
      if(affiliate?.working){await dialog.showMessageBox({type:'info',buttons:['Đóng'],message:'Dừng hoặc đợi tác vụ Affiliate Shopee hoàn tất trước khi cài cập nhật.'});return false;}
      if(posting?.busy()){await dialog.showMessageBox({type:'info',buttons:['Đóng'],message:'Chờ tác vụ đăng bài hoàn tất trước khi cài cập nhật.'});return false;}
      const answer=await dialog.showMessageBox({type:'question',buttons:['Để sau','Lưu và cài'],defaultId:0,cancelId:0,message:'Lưu công việc, dừng các workflow rồi cài và khởi động lại?',detail:'Dự án và thiết lập vẫn được giữ trên máy.'});
      if(answer.response!==1)return false;
      for(const win of [...canvases.values()])if(!await win.prepareToClose({requireSaved:true}))return false;
      return true;
      }finally{if(!quitApproved)posting.hold=false;}
    },onInstallStart:()=>{posting.hold=true;quitApproved=true;},onInstallFailed:()=>{posting.hold=false;quitApproved=false;}});
  updater.on('status',status=>notify({type:'update',status}));updater.start();
  if(testMode)globalThis.workflowTest={store,ai,relay,updater,posting,postingAI,postingOAuth,brands,chats,facebookPages,facebookLogin,affiliate,openProject,openHome,openPosting,openAffiliate};
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
  if(quitApproved)return;event.preventDefault();if(quitInProgress)return;quitInProgress=true;if(posting)posting.hold=true;
  void(async()=>{try{await brands?.writes.catch(()=>{});if(chats)await Promise.allSettled([...chats.writes.values()]);if(posting?.busy()){const answer=await dialog.showMessageBox({type:'warning',buttons:['Ở lại','Thoát ứng dụng'],defaultId:0,cancelId:0,message:'Đăng bài đang xử lý. Thoát có thể làm gián đoạn gửi bài; kiểm tra nền tảng trước khi thử lại.'});if(answer.response!==1)return;}for(const win of [...canvases.values()])if(!await win.prepareToClose())return;await affiliate?.close();quitApproved=true;app.quit();}finally{quitInProgress=false;if(posting&&!quitApproved)posting.hold=false;}})();
});
app.on('will-quit',()=>{postingOAuth?.cancel();facebookLogin?.cancel();facebookPages?.clear();posting?.close();updater?.stop();void relay?.close();for(const controller of requests.values())controller.abort();});
