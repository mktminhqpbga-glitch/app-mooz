import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
vm.runInThisContext(readFileSync(new URL('../muse-jobs.js',import.meta.url),'utf8'));
const request={requestId:'r1',prompt:'Only once',timeoutSec:30};
// Allow scheduler contention from the parallel packaging/desktop suites. These
// are fixture deadlines; production uses seconds/minutes, not 10–150 ms.
const options={interval:0,messageTimeout:100,timeout:2000,reconnect:100};
test('lost start ACK and status connection recover without a second submission',async()=>{
 let starts=0,reads=0,acks=0;
 const result=await WorkflowMuseJobs.run(async msg=>{
  if(msg.type==='MUSEFLOW_JOB_START'){starts++;throw Error('channel closed after acceptance');}
  if(msg.type==='MUSEFLOW_JOB_ACK'){acks++;return {ok:true};}
  reads++;if(reads===1)throw Error('temporary closed port');if(reads===2)return {ok:true,state:'running'};return {ok:true,state:'done',result:{ok:true,url:'video-result'}};
 },request,null,options);
 await Promise.resolve();assert.equal(result.url,'video-result');assert.equal(starts,1);assert.equal(reads,3);assert.equal(acks,1);
});
test('lost result response can be read again; ACK failure does not discard received result',async()=>{
 let starts=0,reads=0;
 const result=await WorkflowMuseJobs.run(async msg=>{if(msg.type==='MUSEFLOW_JOB_START'){starts++;return {ok:true};}if(msg.type==='MUSEFLOW_JOB_ACK')throw Error('ACK lost');if(++reads===1)throw Error('result response lost');return {ok:true,state:'done',result:{ok:false,error:'Provider refused'}};},request,null,options);
 assert.equal(result.error,'Provider refused');assert.equal(starts,1);assert.equal(reads,2);
});
test('missing page job and persistent disconnect explain uncertainty without resubmitting',async()=>{
 let starts=0;await assert.rejects(WorkflowMuseJobs.run(async msg=>{if(msg.type==='MUSEFLOW_JOB_START'){starts++;return {ok:true};}return {ok:false,state:'missing'};},request,null,options),/Không tự gửi lại/);assert.equal(starts,1);
 await assert.rejects(WorkflowMuseJobs.run(async msg=>{if(msg.type==='MUSEFLOW_JOB_START')return {ok:true};throw Error('closed');},request,null,options),/Không gửi lại prompt/);
});
test('abort stops polling and rejects before work when already canceled',async()=>{
 const controller=new AbortController();let calls=0;await assert.rejects(WorkflowMuseJobs.run(async msg=>{calls++;controller.abort();return {ok:true};},request,controller.signal,options),{name:'AbortError'});assert.equal(calls,1);
 await assert.rejects(WorkflowMuseJobs.run(async()=>{throw Error('must not send');},request,controller.signal,options),{name:'AbortError'});
});

test('cancel before the scheduled send cannot start a job',async()=>{const controller=new AbortController();let calls=0;const pending=WorkflowMuseJobs.run(async()=>{calls++;return {ok:true};},request,controller.signal,options);controller.abort();await assert.rejects(pending,{name:'AbortError'});assert.equal(calls,0);});

test('polling restores the current provider progress without a broadcast',async()=>{let polls=0;const progress=[];await WorkflowMuseJobs.run(async msg=>{if(msg.type==='MUSEFLOW_JOB_START'||msg.type==='MUSEFLOW_JOB_ACK')return {ok:true};return ++polls===1?{ok:true,state:'running',progress:'Đang nhận video'}:{ok:true,state:'done',result:{ok:true,url:'video'}};},request,null,{...options,onProgress:text=>progress.push(text)});assert.deepEqual(progress,['Đang nhận video']);});

test('default polling checks once at start and every 10 seconds, returning the exact result without another generation',async t=>{
 t.mock.timers.enable({apis:['Date','setTimeout'],now:0});
 const messages=[],progress=[];const expected={ok:true,url:'data:video/mp4;base64,AAAA',conversationUrl:'https://muse.ai/chat/current'};
 let polls=0;const promise=WorkflowMuseJobs.run(async message=>{messages.push({type:message.type,at:Date.now(),id:message.requestId});if(message.type==='MUSEFLOW_JOB_START'||message.type==='MUSEFLOW_JOB_ACK')return {ok:true};return ++polls===1?{ok:true,state:'running'}:{ok:true,state:'done',result:expected};},request,null,{onProgress:text=>progress.push(text)});
 const settle=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};await settle();assert.equal(polls,1);assert.match(progress[0],/10 giây/);
 t.mock.timers.tick(9999);await settle();assert.equal(polls,1);t.mock.timers.tick(1);await settle();assert.deepEqual(await promise,expected);await settle();
 assert.deepEqual(messages.filter(m=>m.type==='MUSEFLOW_JOB_STATUS').map(m=>m.at),[0,10000]);assert.equal(messages.filter(m=>m.type==='MUSEFLOW_JOB_START').length,1);assert.equal(messages.filter(m=>m.type==='MUSEFLOW_JOB_ACK').length,1);assert.ok(messages.every(m=>m.id===request.requestId));
});
test('cancel during the 10-second pause stops the next scan immediately',async t=>{
 t.mock.timers.enable({apis:['Date','setTimeout'],now:0});const c=new AbortController();let starts=0,polls=0;
 const promise=WorkflowMuseJobs.run(async m=>{if(m.type==='MUSEFLOW_JOB_START'){starts++;return {ok:true};}polls++;return {ok:true,state:'running'};},request,c.signal);
 const rejected=assert.rejects(promise,{name:'AbortError'});for(let i=0;i<30;i++)await Promise.resolve();assert.equal(polls,1);t.mock.timers.tick(5000);c.abort();await rejected;t.mock.timers.tick(10000);for(let i=0;i<30;i++)await Promise.resolve();assert.equal(polls,1);assert.equal(starts,1);
});
test('a shorter task deadline does not wait for the entire 10-second polling period',async t=>{
 t.mock.timers.enable({apis:['Date','setTimeout'],now:0});let calls=0;const promise=WorkflowMuseJobs.run(async m=>{calls++;return m.type==='MUSEFLOW_JOB_START'?{ok:true}:{ok:true,state:'running'};},request,null,{timeout:3000});const rejected=assert.rejects(promise,/Hết thời gian/);for(let i=0;i<30;i++)await Promise.resolve();t.mock.timers.tick(3000);await rejected;assert.equal(calls,2);
});
test('a foreign result request ID is rejected without acknowledging or resubmitting it',async()=>{const sent=[];await assert.rejects(()=>WorkflowMuseJobs.run(async message=>{sent.push(message.type);if(message.type==='MUSEFLOW_JOB_START')return {ok:true};return {ok:true,state:'done',result:{ok:true,requestId:'other-request',url:'data:video/mp4;base64,AQID'}};},request,undefined,options),/không khớp/);assert.deepEqual(sent,['MUSEFLOW_JOB_START','MUSEFLOW_JOB_STATUS']);});
