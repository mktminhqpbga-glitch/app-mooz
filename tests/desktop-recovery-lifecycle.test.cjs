'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const P=require('../chrome-remote-protocol.js'),D=require('../chrome-remote-diagnostics.js');
const settle=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};
function fixture(){
 let now=0,nextTimer=0,allowed=true;const timers=new Map(),sockets=[];
 class Clock extends Date{static now(){return now;}}
 class Socket{
  static OPEN=1;
  constructor(url){this.url=url;this.readyState=0;this.bufferedAmount=0;this.sent=[];sockets.push(this);}
  send(text){this.sent.push(JSON.parse(text));}
  close(code=1000){if(this.readyState===3)return;this.readyState=3;this.onclose?.({code});}
  open(){this.readyState=1;this.onopen?.();}
  ready(remote=false){this.onmessage({data:JSON.stringify({type:'ready',protocol:1,resultRecovery:1,...(remote?{remoteProtocol:1,sessionToken:'e'.repeat(64)}:{})})});}
 }
 const chrome={runtime:{id:'a'.repeat(32),getURL:p=>'chrome-extension://'+'a'.repeat(32)+'/'+p,getManifest:()=>({version:'1.9.1'}),onMessage:{addListener(){}}},permissions:{contains:async()=>allowed},storage:{session:{get:async()=>({}),set:async()=>{},remove:async()=>{}}},tabs:{onUpdated:{addListener(){}},onCreated:{addListener(){}},onRemoved:{addListener(){}}}};
 const context={chrome,WebSocket:Socket,WorkflowRemoteProtocol:P,WorkflowRemoteDiagnostics:D,Date:Clock,URL,TextEncoder,console,setTimeout:(fn,delay)=>{const id=++nextTimer;timers.set(id,{fn,due:now+delay});return id;},clearTimeout:id=>timers.delete(id),setInterval:()=>++nextTimer,clearInterval(){}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../desktop/chrome-relay-worker.js'),'utf8'),context);
 return {worker:context.WorkflowChromeRelay,sockets,deny:()=>{allowed=false;},advance(ms){now+=ms;for(const [id,timer] of [...timers])if(timer.due<=now){timers.delete(id);timer.fn();}}};
}
async function connect(f,remote=false){
 const code=remote?P.pairing('wss://owned.example/remote','b'.repeat(64),Date.now()+600000):'workflow-connect://127.0.0.1:54321/'+'b'.repeat(64);
 const connected=f.worker.connect(code);await settle();f.sockets[0].open();f.sockets[0].ready(remote);await connected;
}

test('a stalled authentication attempt continues bounded recovery instead of closing normally',async()=>{
 const f=fixture();await connect(f);f.sockets[0].close(1006);assert.equal(f.worker.status().state,'reconnecting');
 f.advance(1000);await settle();assert.equal(f.sockets.length,2);f.sockets[1].open();
 f.advance(15000);await settle();assert.equal(f.worker.status().state,'reconnecting');
 f.advance(2000);await settle();assert.equal(f.sockets.length,3);f.sockets[2].open();f.sockets[2].ready();assert.equal(f.worker.status().connected,true);
 await f.worker.disconnect();
});

test('permission removed during reconnect leaves an actionable state instead of a stuck spinner',async()=>{
 const f=fixture();await connect(f,true);f.sockets[0].close(1006);f.deny();f.advance(1000);await settle();
 const status=f.worker.status();assert.equal(status.state,'disconnected');assert.equal(status.canReconnect,true);assert.match(status.error,/Chưa cấp quyền/);assert.equal(f.sockets.length,1);
 await f.worker.disconnect();
});

test('an abandoned socket cannot authenticate after the user disconnects',async()=>{
 const f=fixture(),connected=f.worker.connect('workflow-connect://127.0.0.1:54321/'+'b'.repeat(64)),rejected=assert.rejects(connected,/đóng/);
 await settle();const old=f.sockets[0];await f.worker.disconnect();old.open();assert.equal(old.sent.length,0);assert.equal(old.readyState,3);assert.equal(f.worker.status().connected,false);await rejected;
});
