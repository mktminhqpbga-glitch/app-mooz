'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),{once}=require('node:events');
const {WebSocket}=require('ws'),{ChromeRelay}=require('../desktop/chrome-relay.cjs');
const {ChromeDevices}=require('../desktop/chrome-devices.cjs'),{RemoteChrome}=require('../desktop/remote-chrome.cjs');
const {createRelayServer}=require('../relay-server/server.cjs'),{RelaySocket}=require('../chrome-relay-channel.js');
const ORIGIN='chrome-extension://'+'a'.repeat(32),ENDPOINT='wss://recovery.example/remote',ADMIN='fixture-'+ 'b'.repeat(48);
const wait=async predicate=>{for(let i=0;i<700;i++){if(predicate())return;await new Promise(r=>setTimeout(r,10));}throw Error('Recovery fixture timed out');};
async function fixture(t,{remote=false,recoveryMs=90000,clockSkew=0,serverClockSkew=0}={}){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'mooz-recovery-')),relay=new ChromeRelay({version:'0.66.0',recoveryMs});await relay.start();
 let broker,controller,code=relay.pairingURI(),sockets=[],calls=0,resolveResult;
 const result=new Promise(resolve=>resolveResult=resolve);
 class DirectSocket extends WebSocket{constructor(url){super(url,{origin:ORIGIN});sockets.push(this);}}
 let RelayClass;
 if(remote){
  broker=createRelayServer({adminKey:ADMIN,heartbeatMs:1000});const port=await broker.listen();await relay.startRemoteIngress();
  if(serverClockSkew)broker.wss.on('connection',ws=>{const send=ws.send.bind(ws);ws.send=(text,...args)=>{const message=JSON.parse(String(text));if(message.type==='room')message.expiresAt+=serverClockSkew;return send(JSON.stringify(message),...args);};});
  controller=new RemoteChrome({root,relay,fetchImpl:(url,options)=>fetch('http://127.0.0.1:'+port+new URL(url).pathname,options)});await controller.init();controller.attach(relay);
  controller.broker.WebSocketClass=class extends WebSocket{constructor(url,options){super('ws://127.0.0.1:'+port+'/remote',options);}};
  class GuestSocket extends WebSocket{constructor(){super('ws://127.0.0.1:'+port+'/remote',{origin:ORIGIN});sockets.push(this);}}
  RelayClass=class extends RelaySocket{constructor(next,id,options){super(next,id,{...options,WebSocketClass:GuestSocket});}};
  await controller.relaySetup(ENDPOINT,ADMIN);code=(await controller.pair()).url;
 }
 const devices=new ChromeDevices({primary:relay,remote:controller,root});
 const chrome={runtime:{id:'a'.repeat(32),getManifest:()=>({version:'1.9.0'}),getURL:p=>ORIGIN+'/'+p,onMessage:{addListener(){}}},permissions:{contains:async()=>true},storage:{session:{get:async()=>({}),set:async()=>{},remove:async()=>{}}},tabs:{get:async id=>({id,url:'https://chatgpt.com/c/recovery'}),query:async()=>[{id:7,url:'https://chatgpt.com/c/recovery'}],sendMessage:async()=>{calls++;return result;},onUpdated:{addListener(){}},onCreated:{addListener(){}},onRemoved:{addListener(){}}}};
 class GuestDate extends Date{static now(){return Date.now()+clockSkew;}}
 const context={TextEncoder,Date:GuestDate,chrome,WebSocket:DirectSocket,WorkflowRelayChannel:{RelaySocket:RelayClass},WorkflowAISites:require('../ai-sites.js'),WorkflowRemoteDiagnostics:require('../chrome-remote-diagnostics.js'),URL,console,setTimeout,clearTimeout,setInterval,clearInterval};
 vm.runInNewContext(await fs.readFile(path.join(__dirname,'../chrome-remote-protocol.js'),'utf8'),context);
 vm.runInNewContext(await fs.readFile(path.join(__dirname,'../desktop/chrome-relay-worker.js'),'utf8'),context);
 const worker=context.WorkflowChromeRelay;
 t.after(async()=>{resolveResult({ok:false});await worker.disconnect();await controller?.close();await devices.close();await broker?.close();await fs.rm(root,{recursive:true,force:true});});
 await worker.connect(code);return {root,relay,devices,worker,broker,controller,sockets,chrome,context,get calls(){return calls;},finish:resolveResult};
}

for(const remote of [false,true])test((remote?'encrypted relay':'direct Chrome')+' resumes an interrupted result without another AI send',async t=>{
 const f=await fixture(t,{remote}),expected={ok:true,text:'Đúng lượt 🦋',data:'x'.repeat(1024*1024)};
 const pending=f.devices.rawRequest('tabs.message',{id:7,message:{type:'WORKFLOW_AI_GENERATE',requestId:'only-once'}});
 await wait(()=>f.calls===1);
 if(remote){for(const room of f.broker.rooms.values())room.leaseAt=Date.now()-1;await new Promise(r=>setTimeout(r,1100));assert.equal(f.broker.rooms.size,1,'An authenticated room must outlive the invitation.');}
 f.sockets[0].terminate();await wait(()=>f.relay.status().recovering&&f.worker.status().state==='reconnecting');
 const query=f.devices.rawRequest('tabs.get',{id:7});
 await assert.rejects(f.relay.rawRequest('tabs.message',{id:7,message:{type:'WORKFLOW_AI_GENERATE'}}),/chưa gửi/);
 f.finish(expected);assert.deepEqual(await pending,expected);assert.equal((await query).id,7);
 await wait(()=>f.worker.status().pendingResults===0);assert.equal(f.calls,1);assert.equal(f.worker.status().connected,true);assert.equal(f.relay.pending.size,0);
});

test('recovery deadline fails pending results and explicit stop cancels retry without replay',async t=>{
 const f=await fixture(t,{recoveryMs:80});const pending=f.relay.rawRequest('tabs.message',{id:7,message:{type:'WORKFLOW_AI_GENERATE'}}),failed=assert.rejects(pending,/ngắt kết nối/);
 await wait(()=>f.calls===1);f.sockets[0].terminate();await failed;assert.equal(f.relay.recovery,null);assert.equal(f.relay.pending.size,0);
 await f.worker.disconnect();f.finish({ok:true,text:'Late response'});await new Promise(r=>setTimeout(r,1100));assert.equal(f.sockets.length,1);assert.equal(f.worker.status().pendingResults,0);
});

test('an unrelated extension cannot acquire responses held for the original Chrome',async t=>{
 const f=await fixture(t);const pending=f.relay.rawRequest('tabs.message',{id:7,message:{type:'WORKFLOW_AI_GENERATE'}});await wait(()=>f.calls===1);
 f.sockets[0].terminate();await wait(()=>f.relay.recovery);
 const stranger=new WebSocket('ws://127.0.0.1:'+f.relay.port+'/',{origin:'chrome-extension://'+'c'.repeat(32)});await once(stranger,'open');const closed=once(stranger,'close');
 stranger.send(JSON.stringify({type:'auth',token:f.relay.token,protocol:1,resultRecovery:1}));assert.equal((await closed)[0],1008);assert.ok(f.relay.recovery);
 f.finish({ok:true,text:'Owner only'});assert.equal((await pending).text,'Owner only');assert.equal(f.calls,1);
});

test('revoking a remote session during recovery cancels waiting RPC immediately',async t=>{
 const f=await fixture(t,{remote:true}),pending=f.relay.rawRequest('tabs.message',{id:7,message:{type:'WORKFLOW_AI_GENERATE'}}),failed=assert.rejects(pending,/ngắt kết nối/);
 await wait(()=>f.calls===1);f.sockets[0].terminate();await wait(()=>f.relay.recovery);f.controller.revoke();await failed;
 assert.equal(f.relay.recovery,null);assert.equal(f.relay.remoteSession,null);f.finish({ok:true,text:'Revoked result'});
 await new Promise(r=>setTimeout(r,1200));assert.equal(f.worker.status().connected,false);assert.equal(f.calls,1);
});

test('duplicate transport request IDs never run an AI operation twice and ACK releases the response',async t=>{
 const f=await fixture(t);const socket=f.relay.client,request={type:'request',id:'same-wire-id',operation:'tabs.message',payload:{id:7,message:{type:'WORKFLOW_AI_GENERATE'}}};
 socket.send(JSON.stringify(request));socket.send(JSON.stringify(request));await wait(()=>f.calls===1);f.finish({ok:true,text:'Once'});
 await wait(()=>f.worker.status().pendingResults===0);socket.send(JSON.stringify(request));await new Promise(r=>setTimeout(r,20));assert.equal(f.calls,1);
});

for(const clockSkew of [-86400000,86400000])test('valid relay pairing works when the Chrome clock differs by '+clockSkew+' ms',async t=>{
 const f=await fixture(t,{remote:true,clockSkew});assert.equal(f.worker.status().connected,true);assert.equal(f.relay.isConnected,true);
});

test('expiry timestamps are validated structurally while the issuing server still rejects actual expiry',()=>{
 const P=require('../chrome-remote-protocol.js'),future=Date.now()+86400000,past=Date.now()-86400000;
 for(const expiry of [past,future])assert.equal(P.parseURI(P.pairing(ENDPOINT,'a'.repeat(64),expiry)).expiresAt,expiry);
 for(const expiry of [0,-1,Infinity,8640000000000001])assert.throws(()=>P.parseURI(P.pairing(ENDPOINT,'a'.repeat(64),expiry)));
});

test('room creation uses remaining lifetime rather than comparing clocks with the relay',async t=>{
 const f=await fixture(t,{remote:true,serverClockSkew:-86400000});assert.equal(f.worker.status().connected,true);assert.equal(f.relay.isConnected,true);
});

test('a lost result ACK only repeats the response, never the AI command or task completion',async t=>{
 const f=await fixture(t),send=f.relay.client.send.bind(f.relay.client);f.relay.client.send=(text,...args)=>{if(JSON.parse(String(text)).type==='response-ack')return;send(text,...args);};
 const pending=f.relay.rawRequest('tabs.message',{id:7,message:{type:'WORKFLOW_AI_GENERATE'}});await wait(()=>f.calls===1);f.finish({ok:true,text:'Already delivered'});assert.equal((await pending).text,'Already delivered');assert.equal(f.worker.status().pendingResults,1);
 f.sockets[0].terminate();await wait(()=>f.sockets.length===2&&f.worker.status().connected&&f.worker.status().pendingResults===0);assert.equal(f.calls,1);assert.equal(f.relay.pending.size,0);
});
