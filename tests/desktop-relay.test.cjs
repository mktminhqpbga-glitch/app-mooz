const test=require('node:test');
const assert=require('node:assert/strict');
const {once}=require('node:events');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const {WebSocket}=require('ws');
const {ChromeRelay}=require('../desktop/chrome-relay.cjs');
const ORIGIN='chrome-extension://'+'a'.repeat(32);
const pause=()=>new Promise(resolve=>setImmediate(resolve));
async function open(relay,origin=ORIGIN){const socket=new WebSocket(`ws://127.0.0.1:${relay.status().port}/`,origin?{origin}:{});socket.on('error',()=>{});await once(socket,'open');return socket;}
async function authenticate(relay,socket){const response=once(socket,'message');socket.send(JSON.stringify({type:'auth',token:new URL(relay.pairingURI()).pathname.slice(1)}));assert.equal(JSON.parse((await response)[0]).type,'ready');}

test('relay binds loopback and requires an approved extension Origin',async t=>{
 const relay=new ChromeRelay();await relay.start();t.after(()=>relay.close());
 assert.match(relay.pairingURI(),/^workflow-connect:\/\/127\.0\.0\.1:\d+\/[a-f0-9]{64}$/);
 await assert.rejects(open(relay,null),/401/);
 await assert.rejects(open(relay,'https://example.com'),/401/);
 await assert.rejects(open(relay,'chrome-extension://'+'z'.repeat(32)),/401/);
 assert.equal(relay.isConnected,false);
});

test('invalid authentication cannot acquire the relay',async t=>{
 const relay=new ChromeRelay();await relay.start();t.after(()=>relay.close());
 const socket=await open(relay),closed=once(socket,'close');socket.send(JSON.stringify({type:'auth',token:'0'.repeat(64)}));
 assert.equal((await closed)[0],1008);assert.equal(relay.isConnected,false);
 await assert.rejects(relay.request('tabs.query',{url:['https://chatgpt.com/*']}),/Chưa kết nối/);
});
test('app and companion versions differ safely when relay protocol matches; unsupported protocol is rejected',async t=>{
 const relay=new ChromeRelay({version:'99.0.0'});await relay.start();t.after(()=>relay.close());const socket=await open(relay),ready=once(socket,'message');socket.send(JSON.stringify({type:'auth',token:new URL(relay.pairingURI()).pathname.slice(1),protocol:1,extensionVersion:'1.0.0'}));const hello=JSON.parse((await ready)[0]);assert.equal(hello.protocol,1);assert.equal(hello.appVersion,'99.0.0');assert.equal(relay.status().companion.version,'1.0.0');const closed=once(socket,'close');socket.close();await closed;const bad=await open(relay),rejected=once(bad,'close');bad.send(JSON.stringify({type:'auth',token:new URL(relay.pairingURI()).pathname.slice(1),protocol:9,extensionVersion:'1.0.0'}));assert.equal((await rejected)[0],1008);assert.equal(relay.isConnected,false);
});

test('authenticated RPC returns tab results and forwards AI progress',async t=>{
 const events=[],relay=new ChromeRelay(event=>events.push(event));await relay.start();t.after(()=>relay.close());
 const socket=await open(relay);await authenticate(relay,socket);
 assert.equal(relay.status().extensionId,'a'.repeat(32));assert.equal(relay.isConnected,true);
 const received=once(socket,'message'),result=relay.request('tabs.query',{url:['https://gemini.google.com/*']});
 const request=JSON.parse((await received)[0]);assert.equal(request.operation,'tabs.query');assert.deepEqual(request.payload.url,['https://gemini.google.com/*']);
 socket.send(JSON.stringify({type:'response',id:request.id,result:[{id:9,url:'https://gemini.google.com/app'}]}));
 assert.deepEqual(await result,[{id:9,url:'https://gemini.google.com/app'}]);
 socket.send(JSON.stringify({type:'notification',event:{type:'message',tabId:9,message:{type:'WORKFLOW_AI_PROGRESS',requestId:'run',text:'Working'}}}));
 await new Promise(resolve=>{const check=()=>events.some(event=>event.type==='message')?resolve():setImmediate(check);check();});
 assert.equal(events.find(event=>event.type==='message').message.text,'Working');
 await assert.rejects(relay.request('arbitrary.exec',{}),/không được phép/);
});

test('disconnect rejects in-flight requests without replaying them',async t=>{
 const relay=new ChromeRelay();await relay.start();t.after(()=>relay.close());
 const socket=await open(relay);await authenticate(relay,socket);
 const received=once(socket,'message'),result=relay.request('tabs.message',{id:3,message:{type:'WORKFLOW_AI_GENERATE',requestId:'once'}});
 await received;const rejected=assert.rejects(result,/ngắt kết nối/);socket.close();await rejected;
 assert.equal(relay.isConnected,false);assert.equal(relay.pending.size,0);
 const replacement=await open(relay);await authenticate(relay,replacement);assert.equal(relay.pending.size,0);
});

test('a second authenticated client cannot displace an active client',async t=>{
 const relay=new ChromeRelay();await relay.start();t.after(()=>relay.close());
 const first=await open(relay);await authenticate(relay,first);const owner=relay.client;
 const second=await open(relay),closed=once(second,'close');second.send(JSON.stringify({type:'auth',token:new URL(relay.pairingURI()).pathname.slice(1)}));
 assert.equal((await closed)[0],1013);assert.equal(relay.client,owner);assert.equal(relay.isConnected,true);
});

function worker(){
 const sockets=[],listeners=[],calls=[];
 class FakeSocket{static OPEN=1;constructor(url){this.url=url;this.readyState=1;this.bufferedAmount=0;this.sent=[];sockets.push(this);}send(text){this.sent.push(JSON.parse(text));}close(){this.readyState=3;this.onclose?.();}}
 const tabs=[{id:1,windowId:1,url:'https://chatgpt.com/c/existing',title:'Existing chat'},{id:2,windowId:1,url:'https://unrelated.example/private',title:'Private'}];
 const chrome={runtime:{id:'a'.repeat(32),getURL:path=>ORIGIN+'/'+path,onMessage:{addListener:fn=>listeners.push(fn)}},storage:{session:{get:async()=>({}),set:async()=>{},remove:async()=>{}}},tabs:{query:async()=>tabs,get:async id=>tabs.find(tab=>tab.id===id),update:async()=>{},sendMessage:async(id,message)=>{calls.push({type:'message',id,message});return {ok:true};},onUpdated:{addListener(){}},onCreated:{addListener(){}},onRemoved:{addListener(){}}},windows:{update:async()=>{}},scripting:{executeScript:async options=>{calls.push({type:'script',options});return [{result:true}];}}};
 const context={chrome,WebSocket:FakeSocket,URL,setTimeout,clearTimeout,setInterval,clearInterval,console};vm.runInNewContext(readFileSync(require.resolve('../chrome-remote-protocol.js'),'utf8'),context);vm.runInNewContext(readFileSync(require.resolve('../desktop/chrome-relay-worker.js'),'utf8'),context);
 return {context,sockets,listeners,calls};
}
async function connectWorker(instance){const ready=instance.context.WorkflowChromeRelay.connect('workflow-connect://127.0.0.1:54321/'+'b'.repeat(64));await pause();const socket=instance.sockets[0];socket.onopen();socket.onmessage({data:JSON.stringify({type:'ready'})});await ready;return socket;}
async function invoke(socket,id,operation,payload){socket.onmessage({data:JSON.stringify({type:'request',id,operation,payload})});for(let i=0;i<5;i++)await pause();return socket.sent.find(message=>message.type==='response'&&message.id===id);}

test('companion worker exposes only supported AI tabs and fixed bridge scripts',async()=>{
 const instance=worker(),socket=await connectWorker(instance);
 let reply=await invoke(socket,'list','tabs.query',{});assert.equal(reply.result.length,1);assert.equal(reply.result[0].id,1);
 reply=await invoke(socket,'private','tabs.message',{id:2,message:{type:'WORKFLOW_AI_CHECK'}});assert.match(reply.error,/không thuộc/);
 reply=await invoke(socket,'script','tabs.script',{id:1,files:['arbitrary.js']});assert.match(reply.error,/không được phép/);
 reply=await invoke(socket,'type','tabs.message',{id:1,message:{type:'EXECUTE_JAVASCRIPT'}});assert.match(reply.error,/không được phép/);
 reply=await invoke(socket,'ok','tabs.script',{id:1,files:['composer-controls.js','ai-bridge.js'],operation:'composer'});assert.equal(reply.result[0].result,true);
 assert.equal(instance.calls.length,2,'Only the approved script injection and composer check execute');
 for(const type of ['MUSEFLOW_JOB_START','MUSEFLOW_JOB_STATUS','MUSEFLOW_JOB_ACK']){
  reply=await invoke(socket,type,'tabs.message',{id:1,message:{type,requestId:'job'}});assert.equal(reply.result.ok,true,'Muse protocol operation '+type+' must be forwarded');
 }
 await instance.context.WorkflowChromeRelay.disconnect();
});

test('web pages and content scripts cannot initiate pairing',async()=>{
 const instance=worker();let result;
 const handled=instance.listeners[0]({type:'DESKTOP_CONNECT',uri:'workflow-connect://127.0.0.1:54321/'+'b'.repeat(64)},{id:'a'.repeat(32),url:'https://chatgpt.com/',tab:{id:1,url:'https://chatgpt.com/'}},value=>result=value);
 assert.equal(handled,false);assert.equal(result.ok,false);assert.equal(instance.sockets.length,0);
 await assert.rejects(instance.context.WorkflowChromeRelay.connect('workflow-connect://example.com:54321/'+'b'.repeat(64)),/không hợp lệ/);
});

test('remote companion requires explicit host permission before opening socket and stores only rotated session credentials',async()=>{
 const i=worker(),P=require('../chrome-remote-protocol.js'),endpoint='wss://computer.tail123.ts.net:9443/mooz/remote',code=P.pairing(endpoint,'c'.repeat(64),Date.now()+600000);i.context.chrome.permissions={contains:async()=>false};await assert.rejects(()=>i.context.WorkflowChromeRelay.connect(code),/Chưa cấp quyền/);assert.equal(i.sockets.length,0);let saved;i.context.chrome.storage.session.set=async value=>{saved=value;};i.context.chrome.permissions.contains=async value=>{assert.equal(value.origins[0],'https://computer.tail123.ts.net/*');return true;};const connected=i.context.WorkflowChromeRelay.connect(code);await pause();const socket=i.sockets[0];assert.equal(socket.url,endpoint);socket.onopen();assert.equal(socket.sent[0].remoteProtocol,1);socket.onmessage({data:JSON.stringify({type:'ready',protocol:1,remoteProtocol:1,sessionToken:'d'.repeat(64)})});await connected;assert.equal(saved.workflowDesktopRelay.token,'d'.repeat(64));assert.equal(JSON.stringify(i.context.WorkflowChromeRelay.status()).includes('d'.repeat(64)),false);await i.context.WorkflowChromeRelay.disconnect();
});
