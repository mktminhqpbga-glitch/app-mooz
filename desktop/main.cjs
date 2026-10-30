const {app,BrowserWindow,ipcMain,protocol,net,dialog,Menu,shell,session,clipboard,nativeImage} = require('electron');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {ProjectStore}=require('./project-store.cjs');
const {UIPreferences}=require('./ui-preferences.cjs');
const {palette}=require('./theme-colors.js');
const {Diagnostics}=require('./diagnostics.cjs');
const {AIConnections}=require('./ai-connections.cjs');
const {providerForURL,allowedNetworkURL,resolveAppPath}=require('./policy.cjs');
const {AIWindows}=require('./ai-windows.cjs');
const {ChromeRelay}=require('./chrome-relay.cjs');
const {RemoteChrome}=require('./remote-chrome.cjs');
const {Downloads}=require('./downloads.cjs');
const {PostingStore}=require('./posting-store.cjs');
const {FacebookPublisher}=require('./facebook-publisher.cjs');
const {PostingService}=require('./posting-service.cjs');
const {AgentService}=require('./agent-service.cjs');
const {PostingAI}=require('./posting-ai.cjs');
const {BatchAI}=require('./batch-ai.cjs');
const {AIDispatch}=require('./ai-dispatch.cjs');
const {MusePublishing}=require('./muse-publishing.cjs');
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
let remoteChrome,agent,diagnostics,aiConnections,uiPreferences,store,home,ai,relay,updater,downloads,posting,postingAI,postingOAuth,brands,chats,facebookPages,facebookLogin,postingWindow,affiliate,affiliateWindow,batchWindow,batchAI,aiDispatch,chromeEverConnected=false;
const managedProjects=new Set();
const canvases=new Map(),sessionData=new Map(),requests=new Map(),installedSessions=new WeakSet();
const projectTransitions=new Set(),affiliateTransitions=new Set();
function notify(value){if(value.type==='message'&&value.message?.type==='WORKFLOW_AI_PROGRESS')batchAI?.report(value.message.requestId,value.message.text);if(batchWindow&&!batchWindow.isDestroyed())batchWindow.webContents.send('workflow:event',value);if(affiliateWindow&&!affiliateWindow.isDestroyed())affiliateWindow.webContents.send('workflow:event',value);if(postingWindow&&!postingWindow.isDestroyed())postingWindow.webContents.send('workflow:event',value);if(['update','brands','projects','appearance','aiConnections','diagnostics','aiDispatch','agent','remoteChrome','relay'].includes(value.type)&&home&&!home.isDestroyed())home.webContents.send('workflow:event',value);if(value.type==='relay'&&value.connected){chromeEverConnected=true;managedProjects.clear();}for(const win of canvases.values())if(!win.isDestroyed())win.webContents.send('workflow:event',value);}
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
function appearanceURL(base){const value=uiPreferences.get(),url=new URL(base);url.searchParams.set('uiTheme',value.theme);url.searchParams.set('uiSize',value.size);url.searchParams.set('uiAccent',value.accent);return url.href;}
function appearanceBackground(){const value=uiPreferences.get();return palette(value.theme==='system'?(require('electron').nativeTheme.shouldUseDarkColors?'dark':'light'):value.theme,value.accent).bg;}
async function openPosting(){
 if(postingWindow&&!postingWindow.isDestroyed()){postingWindow.show();postingWindow.focus();return;}
 postingWindow=new BrowserWindow({width:1400,height:930,minWidth:900,minHeight:680,title:'Đăng bài & điều hành · MooZ Agent',backgroundColor:appearanceBackground(),webPreferences:{preload:path.join(__dirname,'preload.cjs'),additionalArguments:['--workflow-version='+version],backgroundThrottling:false,contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true}});protect(postingWindow);postingWindow.on('closed',()=>{postingOAuth?.cancel();facebookLogin?.cancel();facebookPages?.clear();postingWindow=null;});await setupSession(session.defaultSession);await postingWindow.loadURL(appearanceURL('workflow://app/desktop/posting.html'));
}
async function openHome(){
  if(home&&!home.isDestroyed()){home.show();home.focus();return;}
  await setupSession(session.defaultSession);
  home=new BrowserWindow({width:1200,height:830,minWidth:860,minHeight:650,backgroundColor:appearanceBackground(),title:'MooZ Agent',webPreferences:{preload:path.join(__dirname,'preload.cjs'),additionalArguments:['--workflow-version='+version],backgroundThrottling:false,contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true}});
  protect(home);home.on('closed',()=>{home=null;});await home.loadURL(appearanceURL('workflow://app/desktop/home.html'));
}
async function openBatch(){
 if(batchWindow&&!batchWindow.isDestroyed()){batchWindow.show();batchWindow.focus();return;}
 await setupSession(session.defaultSession);
 batchWindow=new BrowserWindow({width:1500,height:960,minWidth:900,minHeight:650,title:'Video hàng loạt · MooZ Agent',backgroundColor:appearanceBackground(),webPreferences:{preload:path.join(__dirname,'preload.cjs'),additionalArguments:['--workflow-version='+version],backgroundThrottling:false,contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true}});
 const win=batchWindow;protect(win);
 win.on('close',event=>{if(quitApproved||win.batchCloseAllowed)return;event.preventDefault();if(win.batchClosing)return;win.batchClosing=true;void win.webContents.executeJavaScript('!!(window.MooZBatch?.busy()||window.MooZBatch?.state.running)').then(busy=>{if(win.isDestroyed())return;if(busy)win.hide();else{win.batchCloseAllowed=true;win.close();}}).catch(()=>win.hide()).finally(()=>{win.batchClosing=false;});});
 win.on('closed',()=>{batchAI.close();batchWindow=null;});
 win.webContents.on('render-process-gone',()=>batchAI.close());
 await win.loadURL(appearanceURL('workflow://app/desktop/batch/index.html'));
}
async function openAffiliate(){
 if(affiliateWindow&&!affiliateWindow.isDestroyed()){affiliateWindow.show();affiliateWindow.focus();return;}
 await setupSession(session.defaultSession);
 affiliateWindow=new BrowserWindow({width:1420,height:950,minWidth:1000,minHeight:700,title:'Affiliate Shopee · MooZ Agent',backgroundColor:appearanceBackground(),webPreferences:{preload:path.join(__dirname,'preload.cjs'),additionalArguments:['--workflow-version='+version],backgroundThrottling:false,contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true}});
 protect(affiliateWindow);affiliateWindow.on('closed',()=>{affiliateWindow=null;});await affiliateWindow.loadURL(appearanceURL('workflow://app/desktop/affiliate.html'));
}
async function openProject(id){
  if(projectTransitions.has(id))throw Error('Dự án đang được xử lý. Vui lòng thử lại.');
  projectTransitions.add(id);
  try{
  const info=(await store.list()).find(item=>item.id===id);if(!info)throw Error('Không tìm thấy dự án.');
  await store.readStorage(id); // Refuse corrupt project rather than replacing it with a blank one.
  const existing=canvases.get(id);if(existing&&!existing.isDestroyed()){existing.show();existing.focus();return info;}
  const ses=session.fromPartition('persist:workflow-project-'+id);await setupSession(ses);
  const win=new BrowserWindow({width:1500,height:960,minWidth:1000,minHeight:700,title:info.name,backgroundColor:appearanceBackground(),webPreferences:{session:ses,preload:path.join(__dirname,'preload.cjs'),additionalArguments:['--workflow-version='+version],backgroundThrottling:false,contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true}});
  win.projectId=id;canvases.set(id,win);sessionData.set(id,{});protect(win);
  win.prepareToClose=async({requireSaved=false}={})=>{
    if(win.isDestroyed()||win.workflowCloseAllowed)return true;
    if(win.workflowClosing)return false;win.workflowClosing=true;
    try{
      const busy=await win.webContents.executeJavaScript('!!window.WorkflowDesktopLifecycle?.busy()');
      if(busy){const answer=await dialog.showMessageBox(win,{type:'warning',buttons:['Ở lại','Lưu, dừng và đóng'],defaultId:0,cancelId:0,message:'Workflow đang chạy. Bạn muốn lưu, dừng tác vụ và đóng dự án?'});if(answer.response!==1)return false;}
      await agent?.closeProject(id);await agent?.store.writes;
      await win.webContents.executeJavaScript('window.WorkflowDesktopLifecycle?.stop()');
      await win.webContents.executeJavaScript('window.WorkflowDesktopLifecycle?.flush()');
      win.workflowCloseAllowed=true;win.close();return true;
    }catch(error){if(requireSaved){await dialog.showMessageBox(win,{type:'error',buttons:['Ở lại'],message:'Chưa lưu được dự án. Bản cập nhật chưa được cài; hãy sửa lỗi lưu rồi thử lại.'});return false;}const answer=await dialog.showMessageBox(win,{type:'error',buttons:['Ở lại','Đóng, bỏ thay đổi chưa lưu'],defaultId:0,cancelId:0,message:'Chưa lưu được dự án: '+error.message});if(answer.response===1){win.workflowCloseAllowed=true;win.destroy();return true;}return false;}
    finally{win.workflowClosing=false;}
  };
  win.on('close',event=>{if(!win.workflowCloseAllowed){event.preventDefault();void win.prepareToClose();}});
  const postingOwner=win.webContents.id;win.on('closed',()=>{canvases.delete(id);sessionData.delete(id);void posting.store.cleanup(postingOwner);for(const [key,value]of requests)if(key.startsWith(id+':'))value.abort();});
  await win.loadURL(appearanceURL('workflow://app/app.html'));return info;
  }finally{projectTransitions.delete(id);}
}
function context(event){
  const frame=event.senderFrame;if(!frame||frame!==event.sender.mainFrame)throw Error('Only the application window can request desktop actions.');
  const url=new URL(frame.url);if(url.protocol!=='workflow:'||url.host!=='app')throw Error('Untrusted caller.');
  const win=BrowserWindow.fromWebContents(event.sender);if(!win)throw Error('Unknown window.');return {win,id:win.projectId,home:url.pathname==='/desktop/home.html',posting:win===postingWindow&&url.pathname==='/desktop/posting.html',batch:win===batchWindow&&url.pathname==='/desktop/batch/index.html',affiliate:win===affiliateWindow&&url.pathname==='/desktop/affiliate.html'};
}
function send(win,value){if(!win.isDestroyed())win.webContents.send('workflow:event',value);}
async function fetchBounded(id,data){
  if(!allowedNetworkURL(data.url))throw Error('Địa chỉ mạng chưa được cho phép.');
  if(!['GET','POST','PUT','DELETE'].includes(data.method||'GET'))throw Error('HTTP method not permitted.');
  const requestId=id+':'+data.requestId;if(requests.has(requestId))throw Error('Duplicate network request.');
  const controller=new AbortController();requests.set(requestId,controller);const timer=setTimeout(()=>controller.abort(),120000);
  const provider='api:'+new URL(data.url).origin;const perform=async()=>{
    let url=data.url;let response;
    for(let step=0;step<6;step++){
      response=await net.fetch(url,{method:data.method||'GET',headers:data.headers,body:data.body||undefined,signal:controller.signal,redirect:'manual',credentials:'omit'});
      if(response.status<300||response.status>=400)break;
      if(data.redirect==='error'||data.method==='POST')throw Error('API redirect refused.');
      const next=new URL(response.headers.get('location'),url);if(!allowedNetworkURL(next.href)||next.origin!==new URL(url).origin)throw Error('Unsafe redirect refused.');url=next.href;
    }
    if(response.status>=300&&response.status<400)throw Error('Too many redirects.');
    if(response.status===429)await aiDispatch.rateLimit(provider,response.headers.get('retry-after'));
    const chunks=[];let bytes=0;for await(const chunk of response.body||[]){bytes+=chunk.byteLength;if(bytes>128*1024*1024)throw Error('Tệp vượt giới hạn 128 MB.');chunks.push(Buffer.from(chunk));}
    return {status:response.status,headers:Object.fromEntries(response.headers),bytes:new Uint8Array(Buffer.concat(chunks))};
  };try{return data.method==='POST'?await aiDispatch.api(provider,controller.signal,perform):await perform();}finally{clearTimeout(timer);requests.delete(requestId);}
}
async function handleWorkflowCall(event,method,data={}){
  const ctx=context(event),{win,id}=ctx;
  if(typeof method!=='string')throw Error('Thao tác không hợp lệ.');
  if(method==='aiDispatch.snapshot')return aiDispatch.snapshot();
  if(method==='aiDispatch.save')return aiDispatch.configure(data);
  if(method==='aiDispatch.resume'){
   const provider=data.provider,h=aiDispatch.holds[provider];if(!h)return aiDispatch.snapshot();
   if(provider.startsWith('api:')){if(h.until>Date.now())throw Error('API vẫn còn thời hạn chờ của dịch vụ.');return aiDispatch.resume(provider);}
   const tabs=[...ai.list().map(t=>({...t,transport:'native'})),...(relay.status().connected?(await relay.rawRequest('tabs.query',{})).map(t=>({...t,transport:'chrome'})):[])].filter(t=>providerForURL(t.url)===provider);
   if(!tabs.length)throw Error('Mở tab AI và xử lý thông báo của dịch vụ trước khi tiếp tục.');let ready=false;
   for(const tab of tabs){const files=['ai-activity.js','composer-controls.js',provider==='muse'?'muse-bridge.js':'ai-bridge.js'];if(tab.transport==='native')await ai.script(tab.id,files,null,null);else await relay.rawRequest('tabs.script',{id:tab.id,files});const message={type:provider==='muse'?'MUSEFLOW_CHECK_SESSION':'WORKFLOW_AI_CHECK'};const result=tab.transport==='native'?await ai.rawMessage(tab.id,message,null):await relay.rawRequest('tabs.message',{id:tab.id,message});if(result?.block)throw Error(result.block.message);if(result?.composer&&result.signedIn&&!result.busy&&result.sendProtocol===1)ready=true;}
   if(!ready)throw Error('Chưa có tab AI sẵn sàng. Đăng nhập, cập nhật tiện ích và chờ tác vụ trước hoàn tất.');return aiDispatch.resume(provider);
  }
  if(method.startsWith('diagnostics.')){
   const surface=ctx.home?'library':ctx.posting?'posting':ctx.affiliate?'affiliate':'canvas';
   if(method==='diagnostics.list')return diagnostics.snapshot();
   if(method==='diagnostics.record'){const result=await diagnostics.record({...data,surface});notify({type:'diagnostics'});return result;}
   if(method==='diagnostics.update'){const result=await diagnostics.update(data);notify({type:'diagnostics'});return result;}
   if(method==='diagnostics.clearResolved'){const result=await diagnostics.clearResolved();notify({type:'diagnostics'});return result;}
   if(method==='diagnostics.report'){win.diagnosticsReport=await diagnostics.report();return win.diagnosticsReport;}
   if(method==='diagnostics.copy'){clipboard.writeText(win.diagnosticsReport||await diagnostics.report());return;}
   if(method==='diagnostics.download'){const report=win.diagnosticsReport||await diagnostics.report();return downloads.download(win,{url:'data:application/json;base64,'+Buffer.from(report).toString('base64'),filename:'MooZ-bao-loi-'+new Date(Date.now()+7*3600000).toISOString().slice(0,10)+'.json'});}
   throw Error('Thao tác báo lỗi không hợp lệ.');
  }
  if(method==='batch.open'){await openBatch();return;}
  if(method.startsWith('batch.')){
   if(!ctx.batch)throw Error('Mở Video hàng loạt trước.');
   if(method==='batch.tabs')return batchAI.tabs();
   if(method==='batch.generate')return batchAI.generate(data);
   if(method==='batch.stop'){batchAI.stop(data.workerId);return;}
   if(method==='batch.openAI'){if(!['muse','gemini','chatgpt'].includes(data.provider))throw Error('AI không hợp lệ.');return ai.open(data.provider);}
   if(method==='batch.download')return downloads.download(win,{url:data.url,filename:data.filename,saveAs:false});
   throw Error('Thao tác Video hàng loạt không hợp lệ.');
  }
  if(method==='affiliate.open'){await openAffiliate();return;}
  if(method.startsWith('affiliate.')){
   if(!ctx.affiliate)throw Error('Mở ứng dụng Affiliate Shopee trước.');
   if(method==='affiliate.snapshot')return affiliate.snapshot();
   if(method==='affiliate.get')return affiliate.get(data.id);
   if(method==='affiliate.tabs')return postingAI.tabs();
   if(method==='affiliate.openAI')return ai.open(data.provider||'chatgpt');
   if(method==='affiliate.create')return affiliate.create(data);
   if(method==='affiliate.generate')return affiliate.generate(data);
   if(method==='affiliate.draft')return affiliate.saveDraft(data);
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
     if(!project){project=await store.create(('Affiliate · '+job.product.title).slice(0,100));await store.writeStorage(project.id,{museflow:{nodes:[],edges:[],groups:[],notes:[],settings:{}}});await affiliate.save(job.id,{projectId:project.id});notify({type:'projects'});}
     try{await openProject(project.id);await canvases.get(project.id).webContents.executeJavaScript('window.WorkflowAffiliate.create('+JSON.stringify({jobId:job.id,title:job.product.title,affiliate:job.affiliate,caption:job.caption,scenes:job.story.scenes,scriptOrigin:job.story.origin||'ai',images:await affiliate.readImages(job.id),videoProvider:data.videoProvider||'muse',voice:!!data.voice})+')');await affiliate.save(job.id,{workflowError:''});return {id:project.id};}
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
   if(method==='posting.muse.tabs')return posting.publisher.muse.tabs();
   if(method==='posting.muse.connect')return posting.publisher.connectMuse(data);
   if(method==='posting.muse.confirm')return posting.confirmMuse(data.id,data.confirmed);
   if(method==='posting.openAI')return ai.open(data.provider||'chatgpt');
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
  if(method==='relay.disconnect'){if(relay.connectionMode==='local')relay.revokeLocal();else relay.revokeRemote();return relay.status();}
  if(method==='remoteChrome.status')return remoteChrome.status();
  if(method==='remoteChrome.setup')return remoteChrome.setup();
  if(method==='remoteChrome.cloudflareInspect')return remoteChrome.locked(()=>remoteChrome.tunnel.inspect());
  if(method==='remoteChrome.cloudflareInstall')return remoteChrome.locked(()=>remoteChrome.tunnel.install());
  if(method==='remoteChrome.cloudflareStart')return remoteChrome.cloudflareStart();
  if(method==='remoteChrome.cloudflareDownloads'){await shell.openExternal(require('./cloudflare-tunnel.cjs').DOWNLOADS);return;}
  if(method==='remoteChrome.cloudflareGuide'){await shell.openExternal(require('./cloudflare-tunnel.cjs').GUIDE);return;}
  if(method==='remoteChrome.custom')return remoteChrome.custom(data.endpoint);
  if(method==='remoteChrome.check')return remoteChrome.check();
  if(method==='remoteChrome.pair')return remoteChrome.pair();
  if(method==='remoteChrome.copy'){const pair=remoteChrome.pair();await clipboard.writeText(pair.url);return {copied:true,url:pair.url,expiresAt:pair.expiresAt};}
  if(method==='remoteChrome.revoke')return remoteChrome.revoke();
  if(method==='remoteChrome.disable')return remoteChrome.disable();
  if(method==='remoteChrome.reset')return remoteChrome.reset();
  if(method==='remoteChrome.guide'){await shell.openExternal('https://tailscale.com/download');return;}
  if(method==='remoteChrome.admin'){await shell.openExternal('https://login.tailscale.com/admin/dns');return;}
  if(method==='projects.list')return store.list();
  if(method==='projects.create'){if(!ctx.home)throw Error('Open project library first.');const project=await store.create(data.name);notify({type:'projects'});return project;}
  if(method==='projects.open'){if(!ctx.home)throw Error('Open project library first.');const info=await openProject(data.id);if(data.view==='agent')await canvases.get(data.id).webContents.executeJavaScript('window.MooZAgent?.open()');if(data.view==='chat')await canvases.get(data.id).webContents.executeJavaScript('window.WorkflowChat?.open()');if(data.view==='voiceover')await canvases.get(data.id).webContents.executeJavaScript('window.WorkflowVoice?.open()');return info;}
  if(method==='projects.rename'){if(!ctx.home)throw Error('Open project library first.');const project=await store.rename(data.id,data.name);notify({type:'projects'});return project;}
  if(method==='projects.restore'){if(!ctx.home)throw Error('Open project library first.');if(canvases.has(data.id))throw Error('Đóng cửa sổ dự án trước khi khôi phục.');const project=await store.restore(data.id);notify({type:'projects'});return project;}
  if(method==='projects.trash'||method==='projects.undoTrash'){
    if(!ctx.home)throw Error('Open project library first.');
    if(canvases.has(data.id))throw Error('Đóng cửa sổ dự án trước khi xóa hoặc hoàn tác.');
    if(projectTransitions.has(data.id))throw Error('Dự án đang được xử lý. Vui lòng thử lại.');
    projectTransitions.add(data.id);
    try{const result=await (method==='projects.trash'?store.trash(data.id):store.undoTrash(data.id));notify({type:'projects'});return result;}
    finally{projectTransitions.delete(data.id);}
  }
  if(method==='aiConnections.list')return aiConnections.list();
  if(method==='aiConnections.status')return aiConnections.status();
  if(method==='aiConnections.reset'){const result=await aiConnections.reset();notify({type:'aiConnections'});return result;}
  if(method==='aiConnections.save'||method==='aiConnections.remove'){const result=await (method.endsWith('save')?aiConnections.save(data):aiConnections.remove(data.id));notify({type:'aiConnections'});return result;}
  if(method==='aiConnections.ask'){const key=event.sender.id+':custom:'+data.requestId;if(typeof data.requestId!=='string'||data.requestId.length>100||requests.has(key))throw Error('Mã yêu cầu AI không hợp lệ.');const controller=new AbortController(),cancel=()=>controller.abort();event.sender.once('destroyed',cancel);requests.set(key,controller);try{return await aiConnections.ask(data.id,data.request,controller.signal);}finally{requests.delete(key);event.sender.removeListener('destroyed',cancel);}}
  if(method==='aiConnections.cancel'){requests.get(event.sender.id+':custom:'+data.requestId)?.abort();return;}
  if(method==='extension.download')return downloads.download(win,{url:'data:application/octet-stream;base64,'+(await require('node:fs/promises').readFile(path.join(root,'extension/Workflow-Connect.zip'))).toString('base64'),filename:'Workflow-Connect.zip',saveAs:false});
  if(method==='appearance.get')return uiPreferences.get();
  if(method==='appearance.save'){const value=await uiPreferences.save(data);notify({type:'appearance',value});return value;}
  if(method==='windows.list')return [...(home&&!home.isDestroyed()?[{key:'home',name:'Thư viện dự án',win:home}]:[]),...(postingWindow&&!postingWindow.isDestroyed()?[{key:'posting',name:'Đăng bài / Điều hành',win:postingWindow}]:[]),...(batchWindow&&!batchWindow.isDestroyed()?[{key:'batch',name:'Video hàng loạt',win:batchWindow}]:[]),...(affiliateWindow&&!affiliateWindow.isDestroyed()?[{key:'affiliate',name:'Affiliate Shopee',win:affiliateWindow}]:[]),...[...canvases].filter(([,w])=>!w.isDestroyed()).map(([key,w])=>({key,name:w.getTitle(),win:w}))].map(w=>({key:w.key,name:w.name,active:w.win===win}));
  if(method==='windows.focus'){const target=data.key==='home'?home:data.key==='posting'?postingWindow:data.key==='affiliate'?affiliateWindow:data.key==='batch'?batchWindow:canvases.get(data.key);if(!target||target.isDestroyed())throw Error('Cửa sổ đã đóng.');target.show();if(target.isMinimized())target.restore();target.focus();return;}
  if(method==='home.open'){await openHome();return;}
  if(!id)throw Error('Project context required.');
  if(method.startsWith('agent.')){
    if(method==='agent.options')return {connections:(await posting.publisher.list()).map(c=>({id:c.id,name:c.name,platform:c.platform}))};
    if(method==='agent.list')return agent.list(id);
    if(method==='agent.create')return agent.create(id,data);
    if(method==='agent.get')return agent.get(id,data.id);
    if(method==='agent.edit')return agent.edit(id,data.id,data.plan);
    if(method==='agent.approve')return agent.approve(id,data.id,data);
    if(method==='agent.resume')return agent.resume(id,data.id,data);
    if(method==='agent.pause')return agent.pause(id,data.id);
    if(method==='agent.retryUnknown')return agent.retryUnknown(id,data.id,data);
    if(method==='agent.receipt')return agent.receipt(id,data);
    throw Error('Thao tác Agent không được hỗ trợ.');
  }
  if(method==='project.info')return (await store.list()).find(item=>item.id===id);
  if(method==='storage.get')return data.area==='session'?(sessionData.get(id)||{}):store.readStorage(id);
  if(method==='storage.set'){
    if(!data.patch||typeof data.patch!=='object'||Array.isArray(data.patch))throw Error('Invalid storage data.');
    if(data.area==='session'){sessionData.set(id,{...sessionData.get(id),...data.patch});return;}
    if(Object.hasOwn(data.patch,'workflowApiKeys'))throw Error('API keys may only be stored in session memory.');
    send(win,{type:'storage',state:'saving'});
    try{await store.writeStorage(id,data.patch);send(win,{type:'storage',state:'saved'});notify({type:'projects'});}catch(error){send(win,{type:'storage',state:'error',error:error.message});throw error;}return;
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
}
ipcMain.handle('workflow:call',async(event,method,data={})=>{
 const ctx=context(event);
 try{return await handleWorkflowCall(event,method,data);}
 catch(error){if(diagnostics&&typeof method==='string'&&!method.startsWith('diagnostics.'))void diagnostics.record({source:'IPC '+method,surface:ctx.home?'library':ctx.posting?'posting':ctx.affiliate?'affiliate':'canvas',message:String(error.message||error)}).then(()=>notify({type:'diagnostics'})).catch(()=>{});throw error;}
});
app.whenReady().then(async()=>{
  downloads=new Downloads({directory:()=>app.getPath('downloads'),windowFor:contents=>contents?BrowserWindow.fromWebContents(contents):null,dialog,notify:send,reveal:file=>shell.showItemInFolder(file)});
  store=new ProjectStore(path.join(app.getPath('userData'),'projects'));
  uiPreferences=new UIPreferences(app.getPath('userData'));await uiPreferences.load();
  diagnostics=new Diagnostics(app.getPath('userData'),{version,secretValues:()=>[...(aiConnections?.keys?.values()||[]),...[...sessionData.values()].flatMap(v=>Object.values(v?.workflowApiKeys||{}))]});await diagnostics.init();
  aiDispatch=new AIDispatch(app.getPath('userData'),{notify});await aiDispatch.init();
  remoteChrome=new RemoteChrome({root:app.getPath('userData'),notify});remoteChrome.tunnel.fetchImpl=net.fetch.bind(net);await remoteChrome.init();relay=new ChromeRelay({notify,version});let portUnavailable=false;try{await relay.start({port:remoteChrome.config.enabled?remoteChrome.config.listenPort:0});}catch(e){if(e.code!=='EADDRINUSE')throw e;portUnavailable=true;await relay.start();}try{await relay.startRemoteIngress({port:remoteChrome.config.enabled?remoteChrome.config.remotePort||0:0});}catch(e){if(e.code!=='EADDRINUSE')throw e;if(remoteChrome.config.mode==='custom')portUnavailable=true;await relay.startRemoteIngress();}remoteChrome.attach(relay,{portUnavailable});
  ai=new AIWindows(root,version,notify,async projectId=>projectId?(await store.readStorage(projectId)).workflowMuseSendTarget:null);
  ai.dispatch=aiDispatch;relay.dispatch=aiDispatch;
  const postingRoot=path.join(app.getPath('userData'),'posting');
  const postingStore=new PostingStore(postingRoot),publisher=new FacebookPublisher({root:postingRoot,fetch:net.fetch.bind(net),safeStorage:require('electron').safeStorage});
  brands=new BrandStore(path.join(app.getPath('userData'),'brands'));await brands.init();chats=new ChatStore(path.join(app.getPath('userData'),'chats'));
  facebookPages=new FacebookPages(publisher);facebookLogin=new FacebookLogin({fetch:net.fetch.bind(net),openExternal:url=>shell.openExternal(url),pages:facebookPages});
  postingOAuth=new PostingOAuth({fetch:net.fetch.bind(net),openExternal:url=>shell.openExternal(url)});
  aiConnections=new AIConnections(app.getPath('userData'),net.fetch.bind(net));await aiConnections.init();aiConnections.dispatch=aiDispatch;
  postingAI=new PostingAI({ai,relay,store:postingStore,connections:aiConnections});postingAI.dispatch=aiDispatch;batchAI=new BatchAI({client:postingAI,ai,relay,onProgress:notify});publisher.muse=new MusePublishing({client:postingAI});posting=new PostingService({store:postingStore,publisher,brands,ask:(...args)=>postingAI.ask(...args),notify:()=>notify({type:'posting'})});await posting.init();posting.start();
  agent=new AgentService({root:path.join(app.getPath('userData'),'agent-runs'),posting,dispatch:aiDispatch,notify,invoke:async(project,packet)=>{const win=canvases.get(project);if(!win||win.isDestroyed())throw Error('Dự án đã đóng; chưa gửi công cụ mới.');return win.webContents.executeJavaScript('window.MooZAgentRuntime.invoke('+JSON.stringify(packet)+')');}});await agent.init();
  affiliate=new AffiliateService({root:path.join(app.getPath('userData'),'affiliate'),ai:postingAI,fetchImpl:net.fetch.bind(net),notify:()=>notify({type:'affiliate'}),decodeImage:bytes=>{let image=nativeImage.createFromBuffer(bytes);if(image.isEmpty())throw Error('Không giải mã được ảnh sản phẩm.');const {width,height}=image.getSize();if(width*height>25000000)throw Error('Ảnh sản phẩm quá lớn.');const scale=Math.min(1,1600/Math.max(width,height));if(scale<1)image=image.resize({width:Math.round(width*scale),height:Math.round(height*scale),quality:'best'});const jpeg=image.toJPEG(90);if(jpeg.length>4*1024*1024)throw Error('Ảnh sản phẩm sau thu nhỏ vẫn quá lớn.');return 'data:image/jpeg;base64,'+jpeg.toString('base64');}});await affiliate.init();
  const signed=app.isPackaged&&process.platform==='darwin'&&await isDeveloperIDSigned(path.dirname(path.dirname(path.dirname(process.execPath))));
  updater=new UpdateService({version,packaged:app.isPackaged,platform:process.platform,signed,engine:signed?require('electron-updater').autoUpdater:null,fetchRelease:()=>latestPublicRelease(net.fetch.bind(net)),
    prepareInstall:async()=>{
      posting.hold=true;try{
      if(batchAI?.running.size){await dialog.showMessageBox({type:'info',buttons:['Đóng'],message:'Chờ hoặc dừng Video hàng loạt trước khi cài cập nhật.'});return false;}
      if(affiliate?.working){await dialog.showMessageBox({type:'info',buttons:['Đóng'],message:'Dừng hoặc đợi tác vụ Affiliate Shopee hoàn tất trước khi cài cập nhật.'});return false;}
      if(posting?.busy()){await dialog.showMessageBox({type:'info',buttons:['Đóng'],message:'Chờ tác vụ đăng bài hoàn tất trước khi cài cập nhật.'});return false;}
      const answer=await dialog.showMessageBox({type:'question',buttons:['Để sau','Lưu và cài'],defaultId:0,cancelId:0,message:'Lưu công việc, dừng các workflow rồi cài và khởi động lại?',detail:'Dự án và thiết lập vẫn được giữ trên máy.'});
      if(answer.response!==1)return false;
      for(const win of [...canvases.values()])if(!await win.prepareToClose({requireSaved:true}))return false;
      return true;
      }finally{if(!quitApproved)posting.hold=false;}
    },onInstallStart:()=>{posting.hold=true;quitApproved=true;},onInstallFailed:()=>{posting.hold=false;quitApproved=false;}});
  updater.on('status',status=>notify({type:'update',status}));updater.start();
  if(testMode)globalThis.workflowTest={remoteChrome,agent,diagnostics,aiConnections,store,ai,relay,updater,posting,postingAI,postingOAuth,brands,chats,facebookPages,facebookLogin,affiliate,batchAI,aiDispatch,openBatch,openProject,openHome,openPosting,openAffiliate};
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform==='darwin'?[{role:'appMenu'}]:[]),
    {label:'Dự án',submenu:[{label:'Thư viện dự án',accelerator:'CmdOrCtrl+Shift+P',click:()=>void openHome()},{role:'close'},{role:'quit'}]},
    {role:'editMenu'},{label:'Hiển thị',submenu:[{role:'reload'},{role:'toggleDevTools'},{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'}]},
    {label:'AI',submenu:Object.entries({chatgpt:'ChatGPT',gemini:'Gemini',muse:'Muse'}).map(([id,label])=>({label:'Mở '+label,click:()=>ai.open(id)}))}
  ]));
  await openHome();
// A user can quit as soon as the library is visible, before loadURL settles.
// Navigation cancellation during shutdown must not open a blocking error box.
}).catch(error=>{if(quitInProgress||quitApproved)return;dialog.showErrorBox('Không mở được MooZ Agent',error.message);app.quit();});
app.on('activate',()=>{if(!home||home.isDestroyed())void openHome();});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
let quitApproved=false,quitInProgress=false;
app.on('before-quit',event=>{
  if(quitApproved)return;event.preventDefault();if(quitInProgress)return;quitInProgress=true;if(posting)posting.hold=true;
  void(async()=>{try{await aiDispatch?.writes.catch(()=>{});await diagnostics?.writes.catch(()=>{});await brands?.writes.catch(()=>{});if(chats)await Promise.allSettled([...chats.writes.values()]);if(posting?.busy()){const answer=await dialog.showMessageBox({type:'warning',buttons:['Ở lại','Thoát ứng dụng'],defaultId:0,cancelId:0,message:'Đăng bài đang xử lý. Thoát có thể làm gián đoạn gửi bài; kiểm tra nền tảng trước khi thử lại.'});if(answer.response!==1)return;}for(const win of [...canvases.values()])if(!await win.prepareToClose())return;if(batchWindow&&!batchWindow.isDestroyed()){const busy=await batchWindow.webContents.executeJavaScript('!!window.MooZBatch?.busy()');if(busy){const answer=await dialog.showMessageBox(batchWindow,{type:'warning',buttons:['Ở lại','Lưu, dừng và thoát'],defaultId:0,cancelId:0,message:'Video hàng loạt đang chạy. Dừng và thoát? Kiểm tra tab AI trước khi chạy tiếp tác vụ bị gián đoạn.'});if(answer.response!==1)return;}await batchWindow.webContents.executeJavaScript('window.MooZBatch?.flushAndStop()');}batchAI?.close();await affiliate?.close();for(const key of new Set([...aiDispatch.records.values()].filter(r=>r.stage!=='done').map(r=>r.key)))await aiDispatch.disconnect(key);await aiDispatch.writes.catch(()=>{});await remoteChrome?.close();quitApproved=true;app.quit();}finally{quitInProgress=false;if(posting&&!quitApproved)posting.hold=false;}})();
});
app.on('will-quit',()=>{postingOAuth?.cancel();facebookLogin?.cancel();facebookPages?.clear();posting?.close();updater?.stop();void remoteChrome?.close();void relay?.close();for(const controller of requests.values())controller.abort();});
