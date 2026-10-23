/* Companion transport for the installed Chrome extension. No page can pair it. */
(() => {
 if(globalThis.WorkflowChromeRelay)return;
 const ALLOWED_FILES=new Set(['composer-controls.js','ai-bridge.js','muse-bridge.js','result-picker.js','muse-support.js']);
 const ALLOWED_TYPES=new Set(['WORKFLOW_AI_CHECK','WORKFLOW_AI_GENERATE','WORKFLOW_AI_STOP','WORKFLOW_AI_SEND_NOW','WORKFLOW_AI_USE_RESULT','MUSEFLOW_CHECK_SESSION','MUSEFLOW_GENERATE','MUSEFLOW_STOP_GENERATION','MUSEFLOW_JOB_START','MUSEFLOW_JOB_STATUS','MUSEFLOW_JOB_ACK']);
 const SETTINGS='workflowDesktopRelay';
 let socket=null,connection=null,state='disconnected',heartbeat=null;
 const knownTabs=new Set();
 function supportedURL(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&(/^(?:chatgpt\.com|www\.chatgpt\.com|chat\.openai\.com|gemini\.google\.com|(?:[a-z0-9-]+\.)*muse\.ai)$/.test(url.hostname));}catch{return false;}}
 function parseURI(value){
  const uri=new URL(String(value||''));
  if(uri.protocol!=='workflow-connect:'||uri.hostname!=='127.0.0.1'||!/^\d+$/.test(uri.port)||Number(uri.port)<1||Number(uri.port)>65535||uri.username||uri.password||uri.search||uri.hash||!/^\/[a-f0-9]{64}$/.test(uri.pathname))throw Error('Mã kết nối không hợp lệ. Sao chép lại từ ứng dụng Workflow.');
  return {port:Number(uri.port),token:uri.pathname.slice(1)};
 }
 function status(){return {connected:state==='connected',state,port:connection?.port||null};}
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
 async function disconnect(){const previous=socket;socket=null;connection=null;state='disconnected';clearInterval(heartbeat);heartbeat=null;previous?.close();await chrome.storage.session.remove(SETTINGS);return status();}
 async function connect(uri){
  const next=parseURI(uri);await disconnect();connection=next;state='connecting';
  return new Promise((resolve,reject)=>{
   const current=new WebSocket(`ws://127.0.0.1:${next.port}/`);socket=current;
   const timeout=setTimeout(()=>{current.close();reject(Error('Không kết nối được ứng dụng Workflow. Mở ứng dụng và lấy mã mới.'));},7000);
   current.onopen=()=>current.send(JSON.stringify({type:'auth',token:next.token}));
   current.onmessage=event=>{
    let message;try{message=JSON.parse(event.data);}catch{return;}
    if(message.type==='ready'){
     if(socket!==current)return;clearTimeout(timeout);state='connected';void chrome.storage.session.set({[SETTINGS]:next});heartbeat=setInterval(()=>{try{send({type:'ping'});}catch{}},20000);resolve(status());return;
    }
    if(state!=='connected'||socket!==current||message.type!=='request'||typeof message.id!=='string')return;
    void perform(message.operation,message.payload).then(result=>{if(socket===current)send({type:'response',id:message.id,result});},error=>{if(socket===current)send({type:'response',id:message.id,error:error?.message||'Không thực hiện được thao tác Chrome.'});}).catch(()=>{});
   };
   current.onerror=()=>{clearTimeout(timeout);reject(Error('Không kết nối được ứng dụng Workflow. Kiểm tra ứng dụng đã mở và mã kết nối còn hiệu lực.'));};
   current.onclose=()=>{clearTimeout(timeout);if(socket===current){socket=null;state='disconnected';clearInterval(heartbeat);heartbeat=null;}reject(Error('Kết nối đã đóng. Lấy mã mới trong ứng dụng Workflow và kết nối lại.'));};
  });
 }
 function extensionPage(sender){const prefix=chrome.runtime.getURL('');return sender.id===chrome.runtime.id&&typeof sender.url==='string'&&sender.url.startsWith(prefix)&&(!sender.tab?.url||sender.tab.url.startsWith(prefix));}
 chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(['DESKTOP_CONNECT','DESKTOP_STATUS','DESKTOP_DISCONNECT'].includes(message?.type)){
   if(!extensionPage(sender)){reply({ok:false,error:'Chỉ trang tiện ích Workflow được phép ghép nối.'});return false;}
   const action=message.type==='DESKTOP_CONNECT'?()=>connect(message.uri):message.type==='DESKTOP_DISCONNECT'?disconnect:async()=>status();
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
 globalThis.WorkflowChromeRelay={connect,disconnect,status};
 // A restarted service worker attempts its existing session once, never an endless retry loop.
 void chrome.storage.session.get(SETTINGS).then(saved=>{const last=saved[SETTINGS];if(last&&!socket)return connect(`workflow-connect://127.0.0.1:${last.port}/${last.token}`);}).catch(()=>{});
})();
