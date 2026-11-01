'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const P=require('../chrome-remote-protocol.js'),D=require('../chrome-remote-diagnostics.js');
const ID='a'.repeat(32),DIAG='workflowDesktopRelayDiagnostic',ENDPOINT='wss://relay.example/remote';
async function worker(memory){
 let listener,probes=0,sockets=0;
 const chrome={runtime:{id:ID,getURL:p=>'chrome-extension://'+ID+'/'+p,getManifest:()=>({version:'1.5.1'}),onMessage:{addListener:f=>listener=f}},permissions:{contains:async()=>true},storage:{session:{get:async keys=>Object.fromEntries((Array.isArray(keys)?keys:[keys]).filter(k=>memory[k]).map(k=>[k,memory[k]])),set:async patch=>Object.assign(memory,patch),remove:async keys=>{for(const k of [keys].flat())delete memory[k];}}},tabs:{onUpdated:{addListener:()=>{}},onCreated:{addListener:()=>{}},onRemoved:{addListener:()=>{}}}};
 const context=vm.createContext({chrome,URL,crypto:globalThis.crypto,setTimeout,clearTimeout,setInterval,clearInterval,WorkflowRemoteProtocol:P,WorkflowRemoteDiagnostics:{...D,checkRelayTransport:async endpoint=>{assert.equal(endpoint,ENDPOINT);probes++;return {ok:true,code:'ready',message:'HTTPS and WSS fixture ready',https:{ok:true,status:200,code:'ready'},websocket:{ok:true,code:'websocket_ready'}};}},WebSocket:class{constructor(){sockets++;throw Error('Must not replay failed pairing.');}}});
 vm.runInContext(fs.readFileSync(require.resolve('../desktop/chrome-relay-worker.js'),'utf8'),context);
 await new Promise(r=>setImmediate(r));
 const call=type=>new Promise(resolve=>listener({type},{id:ID,url:chrome.runtime.getURL('desktop/connect.html')},resolve));
 return {call,probes:()=>probes,sockets:()=>sockets};
}
test('worker restart retains safe failed-attempt evidence and can diagnose without retaining or replaying a pairing code',async()=>{
 const secret='do-not-store-pairing-secret',memory={[DIAG]:D.connectionReport({mode:'relay',endpoint:ENDPOINT,extensionVersion:'1.5.1',error:secret,transport:{stage:'joining_relay',socketOpened:true,roomJoined:false,appAuthenticated:false,closeCode:1008,failure:'RELAY_JOIN_REJECTED',elapsedMs:42,invite:secret}})};
 const first=await worker(memory),status=await first.call('DESKTOP_STATUS');assert.equal(status.connected,false);assert.equal(status.mode,'relay');assert.equal(status.endpoint,ENDPOINT);assert.equal(status.transport.stage,'joining_relay');assert.equal(status.transport.failure,'RELAY_JOIN_REJECTED');assert.equal(status.canReconnect,false);assert.equal(first.sockets(),0);
 const checked=await first.call('DESKTOP_DIAGNOSE');assert.equal(checked.ok,true);assert.equal(checked.diagnostics.websocket.ok,true);assert.equal(first.probes(),1);await new Promise(r=>setImmediate(r));assert.equal(JSON.stringify(memory).includes(secret),false);assert.equal(memory.workflowDesktopRelay,undefined);
 const second=await worker(memory),restored=await second.call('DESKTOP_STATUS');assert.equal(restored.transport.closeCode,1008);assert.match(restored.diagnostics.message,/lần kiểm tra trước/);assert.equal(second.sockets(),0);const repeated=await second.call('DESKTOP_DIAGNOSE');assert.equal(repeated.ok,true);assert.equal(second.probes(),1);
});
test('explicit disconnect clears saved diagnostic target and does not leave a reconnect credential',async()=>{
 const memory={[DIAG]:D.connectionReport({mode:'relay',endpoint:ENDPOINT,transport:{stage:'opening_socket',failure:'WSS_CONNECT_FAILED'}})},w=await worker(memory);
 const result=await w.call('DESKTOP_DISCONNECT');assert.equal(result.ok,true);assert.equal(result.endpoint,null);assert.equal(result.mode,'local');assert.equal(result.transport,null);assert.deepEqual(memory,{});
});
