/* Companion transport for the installed Chrome extension. No page can pair it. */
(() => {
 if(globalThis.WorkflowChromeRelay)return;
 const ALLOWED_FILES=new Set(['ai-activity.js','composer-controls.js','ai-bridge.js','muse-bridge.js','result-picker.js','muse-support.js']);
 const ALLOWED_TYPES=new Set(['WORKFLOW_AI_CHECK','WORKFLOW_AI_GENERATE','WORKFLOW_AI_STOP','WORKFLOW_AI_SEND_NOW','WORKFLOW_AI_USE_RESULT','MUSEFLOW_CHECK_SESSION','MUSEFLOW_GENERATE','MUSEFLOW_STOP_GENERATION','MUSEFLOW_JOB_START','MUSEFLOW_JOB_STATUS','MUSEFLOW_JOB_ACK']);
 const SETTINGS='workflowDesktopRelay';
 let socket=null,connection=null,state='disconnected',heartbeat=null,appVersion=null,lastSeen=0,lastError='';
 const Remote=globalThis.WorkflowRemoteProtocol;
 const PROTOCOL=1,releaseURL='https://raw.githubusercontent.com/mktminhqpbga-glitch/app-mooz/main/extension/companion-release.json';
 let updateInfo=null,updateTask=null,lastUpdateAttempt=0;
 const knownTabs=new Set(),gateCalls=new Map();
 function supportedURL(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&(/^(?:chatgpt\.com|www\.chatgpt\.com|chat\.openai\.com|gemini\.google\.com|(?:[a-z0-9-]+\.)*muse\.ai)$/.test(url.hostname));}catch{return false;}}
 function parseURI(value){
  if(Remote)return Remote.parseURI(value);
  const uri=new URL(String(value||''));
  if(uri.protocol!=='workflow-connect:'||uri.hostname!=='127.0.0.1'||!/^\d+$/.test(uri.port)||Number(uri.port)<1||Number(uri.port)>65535||uri.username||uri.password||uri.search||uri.hash||!/^\/[a-f0-9]{64}$/.test(uri.pathname))throw Error('Mã kết nối không hợp lệ. Sao chép lại từ ứng dụng Workflow.');
  return {port:Number(uri.port),token:uri.pathname.slice(1)};
 }
 function status(){return {connected:state==='connected',state,port:connection?.port||null,protocol:PROTOCOL,appVersion,extensionVersion:chrome.runtime.getManifest?.()?.version||'',update:updateInfo,mode:connection?.mode||'local',endpoint:connection?.mode==='remote'?connection.endpoint:null,canReconnect:!!connection&&state!=='connected'&&state!=='connecting',error:lastError||undefined};}
 async function checkUpdate(){
  if(updateTask)return updateTask;if(typeof fetch!=='function')return status();
  updateTask=(async()=>{try{
   const cached=(await chrome.storage.local?.get('workflowCompanionUpdate'))?.workflowCompanionUpdate;
   if(cached&&cached.installedVersion===chrome.runtime.getManifest?.()?.version&&Date.now()-cached.checkedAt<86400000){updateInfo=cached;return;}
   if(Date.now()-lastUpdateAttempt<3600000)return;lastUpdateAttempt=Date.now();const response=await fetch(releaseURL,{credentials:'omit',redirect:'error',signal:AbortSignal.timeout(7000)});if(!response.ok)return;const raw=await response.text();if(raw.length>16000)return;const info=JSON.parse(raw);if(!/^\d+\.\d+\.\d+$/.test(info.version)||!Number.isInteger(info.protocol))return;
   const current=(chrome.runtime.getManifest?.()?.version||'0.0.0').split('.').map(Number),latest=info.version.split('.').map(Number);let available=false;for(let i=0;i<3;i++){if(latest[i]!==current[i]){available=latest[i]>current[i];break;}}
   updateInfo={installedVersion:chrome.runtime.getManifest?.()?.version||'',checkedAt:Date.now(),version:info.version,protocol:info.protocol,available};await chrome.storage.local?.set({workflowCompanionUpdate:updateInfo});
  }catch{}finally{if(updateInfo){void chrome.action?.setBadgeText?.({text:updateInfo.available?'↑':''});if(updateInfo.available)void chrome.action?.setBadgeBackgroundColor?.({color:'#7054b4'});}}})();try{await updateTask;}finally{updateTask=null;}return status();
 }
 function send(value){if(socket?.readyState!==WebSocket.OPEN)return;const text=JSON.stringify(value);if(text.length>128*1024*1024||socket.bufferedAmount+text.length>128*1024*1024){socket.close();throw Error('Dữ liệu vượt giới hạn kết nối.');}socket.send(text);}
 async function checkedTab(id){if(!Number.isInteger(id)||id<0)throw Error('Tab AI không hợp lệ.');const tab=await chrome.tabs.get(id);if(!supportedURL(tab.url))throw Error('Tab không thuộc trang AI được hỗ trợ.');knownTabs.add(id);return tab;}
 function publicTab(tab){return {id:tab.id,windowId:tab.windowId,url:tab.url,title:tab.title,active:tab.active};}
 async function perform(operation,payload={}){
  if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('Yêu cầu Chrome không hợp lệ.');
  if(operation==='tabs.query'){
   if(payload.url!==undefined&&typeof payload.url!=='string'&&(!Array.isArray(payload.url)||payload.url.some(url=>typeof url!=='string')))throw Error('Bộ lọc tab không hợp lệ.');
   const tabs=await chrome.tabs.query(payload.url===undefined?{}:{url:payload.url});return tabs.filter(tab=>supportedURL(tab.url)).map(tab=>{knownTabs.add(tab.id);return publicTab(tab);});
  }
  const tab=await checkedTab(payload.id);
  if(operation==='tabs.get')return publicTab(tab);
  if(operation==='tabs.focus'){await chrome.tabs.update(tab.id,{active:true});if(tab.windowId!==undefined)await chrome.windows.update(tab.windowId,{focused:true});return publicTab(await checkedTab(tab.id));}
  if(operation==='tabs.message'){
   if(!payload.message||!ALLOWED_TYPES.has(payload.message.type))throw Error('Loại yêu cầu AI không được phép.');
   return chrome.tabs.sendMessage(tab.id,payload.message);
  }
  if(operation==='tabs.script'){
   if(payload.files!==undefined){if(!Array.isArray(payload.files)||payload.files.some(file=>!ALLOWED_FILES.has(file)))throw Error('Tệp kết nối không được phép.');if(payload.files.length)await chrome.scripting.executeScript({target:{tabId:tab.id},files:payload.files});}
   if(!payload.operation)return [{result:null}];
   if(!['pick','composer','bind','diagnostics'].includes(payload.operation))throw Error('Thao tác script không được phép.');
   await checkedTab(tab.id);
   return chrome.scripting.executeScript({target:{tabId:tab.id},func:async operation=>{
    if(operation==='pick')return globalThis.WorkflowResultPicker.pick();
    if(operation==='composer')return !!globalThis.WorkflowComposer?.scopeFor;
    if(operation==='bind')return globalThis.WorkflowMuseSupport.bindSend();
    if(operation==='diagnostics')return globalThis.WorkflowMuseSupport.diagnostics();
   },args:[payload.operation]});
  }
  throw Error('Thao tác Chrome không được phép.');
 }
 function clearGates(){for(const p of gateCalls.values()){clearTimeout(p.timer);p.reply({ok:false,error:'Chrome đã ngắt kết nối; chưa gửi AI.'});}gateCalls.clear();}
 async function disconnect(){clearGates();lastError='';const previous=socket;socket=null;connection=null;state='disconnected';clearInterval(heartbeat);heartbeat=null;previous?.close();await chrome.storage.session.remove(SETTINGS);return status();}
 async function connect(uri){return connectState(parseURI(uri));}
 async function connectState(next){
  if(next.mode==='remote'){
   if(!Remote)throw Error('Cập nhật Workflow Connect để kết nối từ xa.');next=Remote.saved(next);
   if(next.expiresAt&&next.expiresAt<=Date.now())throw Error('Mã từ xa đã hết hạn. Tạo mã mới trong MooZ.');
   if(!await chrome.permissions.contains({origins:[Remote.origin(next.endpoint)]}))throw Error('Chưa cấp quyền kết nối tới máy MooZ. Dán mã và bấm Kết nối để cấp quyền.');
  }
  await disconnect();connection=next;state='connecting';lastError='';
  return new Promise((resolve,reject)=>{
   const current=new WebSocket(next.mode==='remote'?next.endpoint:`ws://127.0.0.1:${next.port}/`);socket=current;
   const fail=text=>{lastError=text;reject(Error(text));};
   const timeout=setTimeout(()=>{current.close();fail(next.mode==='remote'?'Không kết nối được máy MooZ. Kiểm tra app, đường Cloudflare/Tailscale và mã ghép cặp.':'Không kết nối được ứng dụng Workflow. Mở ứng dụng và lấy mã mới.');},15000);
   current.onopen=()=>current.send(JSON.stringify({type:'auth',token:next.token,protocol:PROTOCOL,extensionVersion:chrome.runtime.getManifest?.()?.version||'',...(next.mode==='remote'?{remoteProtocol:1}:{})}));
   current.onmessage=event=>{
    if(socket!==current)return;let message;try{if(typeof event.data!=='string'||event.data.length>128*1024*1024)throw Error();message=JSON.parse(event.data);}catch{current.close(1008,'Invalid message');return;}lastSeen=Date.now();
    if(message.type==='gate-result'){const p=gateCalls.get(message.callId);if(p){clearTimeout(p.timer);gateCalls.delete(message.callId);p.reply(message.result);}return;}
    if(message.type==='ready'){
     if(message.protocol!==undefined&&message.protocol!==PROTOCOL||next.mode==='remote'&&(message.remoteProtocol!==1||!/^[a-f0-9]{64}$/.test(message.sessionToken||''))){clearTimeout(timeout);current.close();fail('App và tiện ích cần cập nhật giao thức kết nối tương thích.');return;}
     if(state==='connected')return;appVersion=typeof message.appVersion==='string'?message.appVersion:null;
     if(next.mode==='remote'){connection={mode:'remote',endpoint:next.endpoint,token:message.sessionToken,expiresAt:null};}
     clearTimeout(timeout);state='connected';lastError='';void chrome.storage.session.set({[SETTINGS]:connection});heartbeat=setInterval(()=>{if(Date.now()-lastSeen>60000){current.close();return;}try{send({type:'ping'});}catch{}void checkUpdate();},20000);resolve(status());return;
    }
    if(state!=='connected'||message.type!=='request'||typeof message.id!=='string')return;
    void perform(message.operation,message.payload).then(result=>{if(socket===current)send({type:'response',id:message.id,result});},error=>{if(socket===current)send({type:'response',id:message.id,error:error?.message||'Không thực hiện được thao tác Chrome.'});}).catch(()=>{});
   };
   current.onerror=()=>{if(socket!==current)return;clearTimeout(timeout);fail(next.mode==='remote'?'Không kết nối được máy MooZ. Kiểm tra đường Cloudflare/Tailscale, HTTPS và app đang mở; không có chế độ bỏ kiểm tra chứng chỉ.':'Không kết nối được ứng dụng Workflow. Kiểm tra ứng dụng đã mở và mã còn hiệu lực.');current.close();};
   current.onclose=event=>{clearTimeout(timeout);if(socket===current){socket=null;state='disconnected';clearInterval(heartbeat);heartbeat=null;clearGates();if(!lastError)lastError=event?.code===1013?'App đã kết nối với một Chrome khác. Ngắt kết nối cũ trong MooZ trước.':event?.code===1008?'Mã hoặc phiên đã hết hiệu lực. Tạo mã mới trong MooZ.':'Kết nối đã ngắt. Kiểm tra hai máy rồi bấm Kết nối lại. App không tự gửi lại yêu cầu AI.';}reject(Error(lastError||'Kết nối đã đóng.'));};
  });
 }
 async function reconnect(){if(!connection)throw Error('Dán mã mới từ MooZ trước.');return connectState(Remote?Remote.saved(connection):connection);}
 function extensionPage(sender){const prefix=chrome.runtime.getURL('');return sender.id===chrome.runtime.id&&typeof sender.url==='string'&&sender.url.startsWith(prefix)&&(!sender.tab?.url||sender.tab.url.startsWith(prefix));}
 chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message?.type==='WORKFLOW_AI_GATE'){
   if(sender.id!==chrome.runtime.id||!Number.isInteger(sender.tab?.id)||!supportedURL(sender.tab.url)){reply({ok:false,error:'Nguồn xin quyền gửi không hợp lệ.'});return false;}
   if(state!=='connected'||socket?.readyState!==WebSocket.OPEN){reply({ok:false,error:'Kết nối lại app trước khi gửi AI.'});return false;}
   const callId=crypto.randomUUID(),timer=setTimeout(()=>{gateCalls.delete(callId);reply({ok:false,error:'Mất kết nối điều phối; chưa gửi AI.'});},10000);gateCalls.set(callId,{reply,timer});
   try{send({type:'gate',callId,tabId:sender.tab.id,message});}catch{clearTimeout(timer);gateCalls.delete(callId);reply({ok:false,error:'Chưa chuyển được quyền gửi đến app.'});}return true;
  }
  if(['DESKTOP_CONNECT','DESKTOP_STATUS','DESKTOP_DISCONNECT','DESKTOP_RECONNECT','DESKTOP_CHECK_UPDATE'].includes(message?.type)){
   if(!extensionPage(sender)){reply({ok:false,error:'Chỉ trang tiện ích Workflow được phép ghép nối.'});return false;}
   const action=message.type==='DESKTOP_CONNECT'?()=>connect(message.uri):message.type==='DESKTOP_DISCONNECT'?disconnect:message.type==='DESKTOP_RECONNECT'?reconnect:message.type==='DESKTOP_CHECK_UPDATE'?checkUpdate:async()=>status();
   void action().then(result=>reply({ok:true,...result}),error=>reply({ok:false,error:error.message}));return true;
  }
  if(message?.type==='WORKFLOW_AI_PROGRESS'&&sender.id===chrome.runtime.id&&supportedURL(sender.tab?.url)&&typeof message.requestId==='string'&&typeof message.text==='string'){
   try{send({type:'notification',event:{type:'message',tabId:sender.tab.id,senderId:sender.id,message}});}catch{}
  }
  return false;
 });
 chrome.tabs.onUpdated.addListener((id,changeInfo,tab)=>{try{if(supportedURL(tab.url)){knownTabs.add(id);send({type:'notification',event:{type:'updated',tab:publicTab(tab),changeInfo}});}else if(knownTabs.delete(id))send({type:'notification',event:{type:'removed',tabId:id}});}catch{}});
 chrome.tabs.onCreated.addListener(tab=>{if(supportedURL(tab.url)){knownTabs.add(tab.id);try{send({type:'notification',event:{type:'created',tab:publicTab(tab)}});}catch{}}});
 chrome.tabs.onRemoved.addListener(tabId=>{if(knownTabs.delete(tabId))try{send({type:'notification',event:{type:'removed',tabId}});}catch{}});
 globalThis.WorkflowChromeRelay={connect,reconnect,disconnect,status};
 if(typeof fetch==='function')setTimeout(()=>void checkUpdate(),5000);
 // A restarted service worker attempts its existing session once, never an endless retry loop.
 void chrome.storage.session.get(SETTINGS).then(saved=>{const last=saved[SETTINGS];if(last&&!socket)return connectState(Remote?Remote.saved(last):last);}).catch(()=>{});
})();
