/* Companion transport for the installed Chrome extension. No page can pair it. */
(() => {
 if(globalThis.WorkflowChromeRelay)return;
 const ALLOWED_FILES=new Set(['ai-activity.js','composer-controls.js','ai-bridge.js','muse-bridge.js','result-picker.js','muse-support.js']);
 const ALLOWED_TYPES=new Set(['WORKFLOW_AI_CHECK','WORKFLOW_AI_GENERATE','WORKFLOW_AI_STOP','WORKFLOW_AI_SEND_NOW','WORKFLOW_AI_USE_RESULT','MUSEFLOW_CHECK_SESSION','MUSEFLOW_GENERATE','MUSEFLOW_STOP_GENERATION','MUSEFLOW_JOB_START','MUSEFLOW_JOB_STATUS','MUSEFLOW_JOB_ACK']);
 const SETTINGS='workflowDesktopRelay',DIAGNOSTIC='workflowDesktopRelayDiagnostic';
 let restoredReport=null,diagnosticWrites=Promise.resolve(),lifecycle=0;
 let lastDiagnostic=null,diagnosticTask=null,lastTransport=null;
 let socket=null,connection=null,state='disconnected',heartbeat=null,appVersion=null,lastSeen=0,lastError='';
 const Remote=globalThis.WorkflowRemoteProtocol;
 const remoteMode=v=>v?.mode==='remote'||v?.mode==='relay';
 const PROTOCOL=1,releaseURL='https://raw.githubusercontent.com/mktminhqpbga-glitch/app-mooz/main/extension/companion-release.json';
 let updateInfo=null,updateTask=null,lastUpdateAttempt=0;
 const knownTabs=new Set(),gateCalls=new Map();
 const responses=new Map(),seenRequests=new Set();let responseBytes=0,resultRecovery=false,responseEpoch=0,retryTimer=null,retryCount=0,recoveryUntil=0;
 function resetRecovery(){clearTimeout(retryTimer);retryTimer=null;retryCount=0;recoveryUntil=0;resultRecovery=false;responseEpoch++;responses.clear();seenRequests.clear();responseBytes=0;}
 function flushResponse(record){if(!record.text||state!=='connected'||socket?.readyState!==1)return;try{socket.send(record.text);}catch{socket.close(4001,'Response transport interrupted');}}
 function rememberResponse(id,value,epoch){
  if(epoch!==responseEpoch)return;const record=responses.get(id);if(!record)return;
  let text;try{text=JSON.stringify(value);}catch{text=JSON.stringify({type:'response',id,error:'Không mã hóa được kết quả Chrome.'});}
  if(responseBytes+new TextEncoder().encode(text).length>128*1024*1024)text=JSON.stringify({type:'response',id,error:'Kết quả đang chờ vượt giới hạn 128 MB. Kiểm tra kết quả trên tab AI; chưa gửi lại yêu cầu.'});
  record.text=text;record.bytes=new TextEncoder().encode(text).length;responseBytes+=record.bytes;flushResponse(record);
 }
 function scheduleReconnect(code){
  if(!resultRecovery||!connection||![1001,1005,1006,1011,1012,1013,4001].includes(code)||retryCount>=8||Date.now()>=recoveryUntil)return false;
  const delay=Math.min(15000,1000*2**retryCount);if(Date.now()+delay>=recoveryUntil)return false;
  state='reconnecting';lastError='Mất đường truyền · đang nối lại phiên và chờ kết quả cũ. Không gửi lại yêu cầu AI.';
  const epoch=lifecycle;retryCount++;retryTimer=setTimeout(()=>{retryTimer=null;if(lifecycle!==epoch||!connection)return;void connectState(connection,{recover:true}).catch(()=>{});},delay);return true;
 }

 function supportedURL(value){return !!globalThis.WorkflowAISites?.providerForURL(value);}
 function parseURI(value){
  if(Remote)return Remote.parseURI(value);
  const uri=new URL(String(value||''));
  if(uri.protocol!=='workflow-connect:'||uri.hostname!=='127.0.0.1'||!/^\d+$/.test(uri.port)||Number(uri.port)<1||Number(uri.port)>65535||uri.username||uri.password||uri.search||uri.hash||!/^\/[a-f0-9]{64}$/.test(uri.pathname))throw Error('Mã kết nối không hợp lệ. Sao chép lại từ ứng dụng Workflow.');
  return {port:Number(uri.port),token:uri.pathname.slice(1)};
 }
 function status(){return {museBackground:globalThis.WorkflowMuseBackground?.snapshot(),connected:state==='connected',state,retryCount,pendingResults:responses.size,port:connection?.port||null,protocol:PROTOCOL,appVersion,extensionVersion:chrome.runtime.getManifest?.()?.version||'',update:updateInfo,mode:connection?.mode||restoredReport?.mode||'local',endpoint:remoteMode(connection)?connection.endpoint:restoredReport?.endpoint||null,canReconnect:!!connection&&state!=='connected'&&state!=='connecting'&&state!=='reconnecting',error:lastError||undefined,diagnostics:lastDiagnostic,transport:lastTransport?{stage:lastTransport.stage,socketOpened:lastTransport.socketOpened,roomJoined:lastTransport.roomJoined,appAuthenticated:lastTransport.appAuthenticated,closeCode:lastTransport.closeCode,failure:lastTransport.failure,elapsedMs:(lastTransport.endedAt||Date.now())-lastTransport.startedAt}:restoredReport?.connection||null};}
 function rememberDiagnostic(){const report=globalThis.WorkflowRemoteDiagnostics.connectionReport(status());restoredReport=report;diagnosticWrites=diagnosticWrites.catch(()=>{}).then(()=>chrome.storage.session.set({[DIAGNOSTIC]:report}));void diagnosticWrites.catch(()=>{});}
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
  if(operation.startsWith('shopee.')){
   const source=globalThis.WorkflowShopeeSource;if(!source)throw Error('Cập nhật Workflow Connect 1.5.0 để đọc Shopee.');
   if(operation==='shopee.open'){const url=source.checked(payload.url||'https://shopee.vn/');return publicTab(await chrome.tabs.create({url,active:true}));}
   if(operation==='shopee.tabs'){const tabs=await chrome.tabs.query({url:['https://shopee.vn/*','https://*.shopee.vn/*','https://shp.ee/*','https://*.shp.ee/*']});return tabs.filter(t=>{try{return !!source.checked(t.url);}catch{return false;}}).map(publicTab);}
   if(operation!=='shopee.read')throw Error('Thao tác Shopee không được phép.');
   if(!Number.isInteger(payload.id)||payload.id<0||typeof payload.expectedURL!=='string')throw Error('Chọn tab sản phẩm Shopee trước.');
   const tab=await chrome.tabs.get(payload.id);source.checked(tab.url);if(tab.url!==source.checked(payload.expectedURL))throw Error('Tab Shopee đã đổi trang. Làm mới danh sách và chọn lại sản phẩm.');
   await chrome.scripting.executeScript({target:{tabId:tab.id},files:['shopee-source.js']});
   const rows=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>{try{return {product:WorkflowShopeeSource.capture(document,location.href)};}catch(e){return {error:e.message};}}});
   const result=rows?.[0]?.result;if(result?.error)throw Error(result.error);const product=result?.product;
   if(!product||product.sourceURL!==tab.url)throw Error('Trang sản phẩm đã thay đổi trong lúc đọc. Làm mới danh sách rồi thử lại.');
   const images=[];let total=0;for(const url of product.imageURLs){try{const img=await source.image(url);total+=img.bytes;if(total>20*1024*1024)break;images.push({url:img.url,data:img.data});}catch{}}
   if(!images.length)throw Error('Không tải được ảnh trên CDN Shopee. Kiểm tra ảnh trên Chrome và thử lại; chưa gọi AI.');
   if((await chrome.tabs.get(tab.id)).url!==tab.url)throw Error('Tab Shopee đã đổi sản phẩm trong lúc tải ảnh. Chọn lại và thử lại.');
   return {product,images};
  }
  if(operation==='tabs.query'){
   if(payload.url!==undefined&&typeof payload.url!=='string'&&(!Array.isArray(payload.url)||payload.url.some(url=>typeof url!=='string')))throw Error('Bộ lọc tab không hợp lệ.');
   const tabs=await chrome.tabs.query(payload.url===undefined?{}:{url:payload.url});return tabs.filter(tab=>supportedURL(tab.url)).map(tab=>{knownTabs.add(tab.id);return publicTab(tab);});
  }
  const tab=await checkedTab(payload.id);
  if(operation==='tabs.get')return publicTab(tab);
  if(operation==='tabs.focus'){await chrome.tabs.update(tab.id,{active:true});if(tab.windowId!==undefined)await chrome.windows.update(tab.windowId,{focused:true});return publicTab(await checkedTab(tab.id));}
  if(operation==='tabs.message'){
   if(!payload.message||!ALLOWED_TYPES.has(payload.message.type))throw Error('Loại yêu cầu AI không được phép.');
   if(['MUSEFLOW_JOB_START','MUSEFLOW_GENERATE'].includes(payload.message.type))await globalThis.WorkflowMuseBackground?.prepare(tab.id);
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
 async function disconnect(){lifecycle++;resetRecovery();restoredReport=null;lastDiagnostic=null;diagnosticTask=null;clearGates();lastError='';lastTransport=null;appVersion=null;const previous=socket;socket=null;connection=null;state='disconnected';clearInterval(heartbeat);heartbeat=null;previous?.close();await diagnosticWrites.catch(()=>{});await chrome.storage.session.remove([SETTINGS,DIAGNOSTIC]);return status();}
 async function connect(uri){return connectState(parseURI(uri));}
 async function connectState(next,{recover=false}={}){
  const before=lifecycle;
  if(remoteMode(next)){
   if(!Remote||next.mode==='relay'&&!globalThis.WorkflowRelayChannel)throw Error('Cập nhật Workflow Connect 1.3.0 để kết nối relay.');next=Remote.saved(next);
   if(!await chrome.permissions.contains({origins:[Remote.origin(next.endpoint)]}))throw Error('Chưa cấp quyền kết nối tới máy MooZ. Dán mã và bấm Kết nối để cấp quyền.');
  }
  if(lifecycle!==before)throw Error('Kết nối đã được thay đổi.');
  if(!recover){await disconnect();if(lifecycle!==before+1)throw Error('Kết nối đã được thay đổi.');}else{clearTimeout(retryTimer);retryTimer=null;}connection=next;state='connecting';lastError='';
  return new Promise((resolve,reject)=>{
   const trace={stage:'opening_socket',socketOpened:false,roomJoined:false,appAuthenticated:false,closeCode:null,failure:null,startedAt:Date.now(),endedAt:null};lastTransport=trace;
   const phase=stage=>{trace.stage=stage;trace.socketOpened=true;if(stage==='authenticating_app')trace.roomJoined=true;};
   let current;try{current=next.mode==='relay'?new globalThis.WorkflowRelayChannel.RelaySocket(next,chrome.runtime.id,{onStage:phase}):new WebSocket(remoteMode(next)?next.endpoint:`ws://127.0.0.1:${next.port}/`);}catch{trace.failure='SOCKET_CONSTRUCTION_FAILED';trace.endedAt=Date.now();state='disconnected';lastError='Chrome không khởi tạo được WebSocket. Kiểm tra quyền truy cập địa chỉ và tải lại tiện ích.';rememberDiagnostic();reject(Error(lastError));return;}socket=current;
   const fail=(text,code)=>{trace.failure=code||'TRANSPORT_CLOSED';trace.endedAt=Date.now();lastError=text;rememberDiagnostic();reject(Error(text));};
   const timeout=setTimeout(()=>{if(socket!==current)return;const failure=globalThis.WorkflowRemoteDiagnostics.connectionFailure(trace,'timeout');fail(failure.message,failure.code);current.close();},remoteMode(next)?45000:15000);
   current.onopen=()=>{trace.socketOpened=true;trace.stage='authenticating_app';current.send(JSON.stringify({type:'auth',token:next.token,protocol:PROTOCOL,resultRecovery:1,extensionVersion:chrome.runtime.getManifest?.()?.version||'',...(remoteMode(next)?{remoteProtocol:1}:{})}));};
   current.onmessage=event=>{
    if(socket!==current)return;let message;try{if(typeof event.data!=='string'||event.data.length>128*1024*1024)throw Error();message=JSON.parse(event.data);}catch{current.close(1008,'Invalid message');return;}lastSeen=Date.now();
    if(message.type==='response-ack'&&typeof message.id==='string'){const record=responses.get(message.id);if(record){responseBytes-=record.bytes||0;responses.delete(message.id);}return;}
    if(message.type==='gate-result'){const p=gateCalls.get(message.callId);if(p){clearTimeout(p.timer);gateCalls.delete(message.callId);p.reply(message.result);}return;}
    if(message.type==='ready'){
     if(message.protocol!==undefined&&message.protocol!==PROTOCOL||remoteMode(next)&&(message.remoteProtocol!==1||!/^[a-f0-9]{64}$/.test(message.sessionToken||''))){clearTimeout(timeout);current.close();fail('App và tiện ích cần cập nhật giao thức kết nối tương thích.','RELAY_PROTOCOL_ERROR');return;}
     if(state==='connected')return;resultRecovery=message.resultRecovery===1;retryCount=0;recoveryUntil=0;appVersion=typeof message.appVersion==='string'?message.appVersion:null;
     if(remoteMode(next)){connection=next.mode==='relay'?{...current.state(),token:message.sessionToken,expiresAt:null}:{mode:'remote',endpoint:next.endpoint,token:message.sessionToken,expiresAt:null};}
     clearTimeout(timeout);trace.stage='connected';trace.appAuthenticated=true;trace.endedAt=Date.now();state='connected';lastError='';
     if(resultRecovery){for(const id of Array.isArray(message.pendingRequests)?message.pendingRequests.slice(0,64):[]){if(typeof id==='string'&&!responses.has(id)){responses.set(id,{bytes:0});rememberResponse(id,{type:'response',id,error:'Chrome đã khởi động lại và không còn phản hồi đang chờ. Kiểm tra kết quả trên tab AI; app không tự gửi lại.'},responseEpoch);}}for(const record of responses.values())flushResponse(record);}
     void chrome.storage.session.set({[SETTINGS]:connection});heartbeat=setInterval(()=>{if(Date.now()-lastSeen>60000){current.close(4001,'Heartbeat timed out');return;}try{send({type:'ping'});}catch{}void checkUpdate();},20000);resolve(status());return;
    }
    if(state!=='connected'||message.type!=='request'||typeof message.id!=='string')return;
    if(!resultRecovery){void perform(message.operation,message.payload).then(result=>{if(socket===current)send({type:'response',id:message.id,result});},error=>{if(socket===current)send({type:'response',id:message.id,error:error?.message||'Không thực hiện được thao tác Chrome.'});}).catch(()=>{});return;}
    if(responses.has(message.id)){flushResponse(responses.get(message.id));return;}
    if(seenRequests.has(message.id)||responses.size>=64){send({type:'response',id:message.id,error:'Yêu cầu đã xử lý hoặc quá nhiều kết quả đang chờ. Không gửi lại AI.'});return;}
    seenRequests.add(message.id);if(seenRequests.size>512)seenRequests.delete(seenRequests.values().next().value);responses.set(message.id,{bytes:0});const epoch=responseEpoch;
    void perform(message.operation,message.payload).then(result=>rememberResponse(message.id,{type:'response',id:message.id,result},epoch),error=>rememberResponse(message.id,{type:'response',id:message.id,error:error?.message||'Không thực hiện được thao tác Chrome.'},epoch)).catch(()=>{});
   };
   current.onerror=()=>{if(socket!==current)return;clearTimeout(timeout);const failure=globalThis.WorkflowRemoteDiagnostics.connectionFailure(trace);fail(remoteMode(next)?failure.message:'Không kết nối được ứng dụng Workflow. Kiểm tra ứng dụng đã mở và mã còn hiệu lực.',failure.code);current.close(4001,'Transport interrupted');};
   current.onclose=event=>{clearTimeout(timeout);if(socket===current){socket=null;state='disconnected';clearInterval(heartbeat);heartbeat=null;clearGates();trace.closeCode=event?.code;trace.endedAt=Date.now();if(trace.appAuthenticated&&resultRecovery)recoveryUntil=Date.now()+90000;if(!lastError){const failure=globalThis.WorkflowRemoteDiagnostics.connectionFailure(trace);trace.failure=failure.code;lastError=failure.message;}scheduleReconnect(event?.code);rememberDiagnostic();}reject(Error(lastError||'Kết nối đã đóng.'));};
  });
 }
 async function reconnect(){if(!connection)throw Error('Dán mã mới từ MooZ trước.');return connectState(Remote?Remote.saved(connection):connection,{recover:resultRecovery&&recoveryUntil>Date.now()});}
 async function diagnose(){
  const target=connection||(restoredReport?.endpoint?{mode:restoredReport.mode,endpoint:restoredReport.endpoint}:null),epoch=lifecycle;if(!remoteMode(target))throw Error('Dán mã từ xa và bấm Kết nối trước khi kiểm tra.');
  if(!globalThis.WorkflowRemoteDiagnostics)throw Error('Cập nhật tiện ích để kiểm tra đường truyền.');
  if(!await chrome.permissions.contains({origins:[Remote.origin(target.endpoint)]}))throw Error('Chưa cấp quyền tới địa chỉ này. Dán mã và bấm Kết nối trước.');
  if(diagnosticTask)return diagnosticTask;
  const task=(async()=>{const result=await (target.mode==='relay'?globalThis.WorkflowRemoteDiagnostics.checkRelayTransport:globalThis.WorkflowRemoteDiagnostics.check)(target.endpoint);if(lifecycle===epoch){lastDiagnostic=result;rememberDiagnostic();}return status();})();diagnosticTask=task;try{return await task;}finally{if(diagnosticTask===task)diagnosticTask=null;}
 }
 function extensionPage(sender){const prefix=chrome.runtime.getURL('');return sender.id===chrome.runtime.id&&typeof sender.url==='string'&&sender.url.startsWith(prefix)&&(!sender.tab?.url||sender.tab.url.startsWith(prefix));}
 chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message?.type==='WORKFLOW_AI_GATE'){
   if(sender.id!==chrome.runtime.id||!Number.isInteger(sender.tab?.id)||!supportedURL(sender.tab.url)){reply({ok:false,error:'Nguồn xin quyền gửi không hợp lệ.'});return false;}
   if(state!=='connected'||socket?.readyState!==WebSocket.OPEN){reply({ok:false,error:'Kết nối lại app trước khi gửi AI.'});return false;}
   const callId=crypto.randomUUID(),timer=setTimeout(()=>{gateCalls.delete(callId);reply({ok:false,error:'Mất kết nối điều phối; chưa gửi AI.'});},10000);gateCalls.set(callId,{reply,timer});
   try{send({type:'gate',callId,tabId:sender.tab.id,message});}catch{clearTimeout(timer);gateCalls.delete(callId);reply({ok:false,error:'Chưa chuyển được quyền gửi đến app.'});}return true;
  }
  if(['DESKTOP_CONNECT','DESKTOP_STATUS','DESKTOP_DISCONNECT','DESKTOP_RECONNECT','DESKTOP_CHECK_UPDATE','DESKTOP_DIAGNOSE','DESKTOP_MUSE_BACKGROUND','DESKTOP_MUSE_PREPARE'].includes(message?.type)){
   if(!extensionPage(sender)){reply({ok:false,error:'Chỉ trang tiện ích Workflow được phép ghép nối.'});return false;}
   const action=message.type==='DESKTOP_CONNECT'?()=>connect(message.uri):message.type==='DESKTOP_DISCONNECT'?disconnect:message.type==='DESKTOP_RECONNECT'?reconnect:message.type==='DESKTOP_CHECK_UPDATE'?checkUpdate:message.type==='DESKTOP_DIAGNOSE'?diagnose:message.type==='DESKTOP_MUSE_BACKGROUND'?async()=>({museBackground:await WorkflowMuseBackground.configure(message.enabled)}):message.type==='DESKTOP_MUSE_PREPARE'?async()=>({museBackground:await WorkflowMuseBackground.prepareAll()}):async()=>{await globalThis.WorkflowMuseBackground?.ready;return status();};
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
 const startupEpoch=lifecycle;
 void chrome.storage.session.get([SETTINGS,DIAGNOSTIC]).then(saved=>{
  if(lifecycle!==startupEpoch)return;
  const prior=saved[DIAGNOSTIC];if(prior&&!socket&&!connection){
   restoredReport=globalThis.WorkflowRemoteDiagnostics.connectionReport({...prior,transport:prior.connection,diagnostics:{https:prior.checks?.https,websocket:prior.checks?.websocket}});
   const c=restoredReport.connection;if(c.failure)lastError=globalThis.WorkflowRemoteDiagnostics.connectionFailure(c,c.failure==='CONNECT_TIMEOUT'?'timeout':'closed').message;
   const probes=restoredReport.checks;if(probes.https)lastDiagnostic={...probes,ok:probes.https.ok&&probes.websocket?.ok,message:'Kết quả lần kiểm tra trước: HTTPS '+(probes.https.ok?'tới được':'chưa đạt')+' · WebSocket '+(probes.websocket?.ok?'mở được':'chưa xác nhận')+'. Bấm Kiểm tra đường truyền để cập nhật.'};
  }
  const last=saved[SETTINGS];if(last&&!socket&&!connection)return connectState(Remote?Remote.saved(last):last);
 }).catch(()=>{});
})();
