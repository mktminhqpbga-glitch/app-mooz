import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
vm.runInThisContext(readFileSync(new URL('../muse-jobs.js',import.meta.url),'utf8'));
const request={requestId:'r1',prompt:'Only once',timeoutSec:30};
const options={interval:0,messageTimeout:10,timeout:150,reconnect:15};
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
