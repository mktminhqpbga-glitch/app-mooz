const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const turn=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(saved=[]){
 const tab={id:7,url:'https://gemini.google.com/app/test',autoDiscardable:true},calls=[],messages=[],listeners=[],removed=[],storage={workflowAIActivity:saved};let tick,active=['a'];
 const chrome={runtime:{id:'own',onMessage:{addListener:fn=>listeners.push(fn)}},storage:{session:{get:async()=>storage,set:async patch=>Object.assign(storage,JSON.parse(JSON.stringify(patch)))}},tabs:{get:async()=>({...tab}),update:async(id,options)=>{calls.push({id,...JSON.parse(JSON.stringify(options))});Object.assign(tab,options);},sendMessage:async(id,msg)=>{messages.push({id,...JSON.parse(JSON.stringify(msg))});return {ok:true,activeRequestIds:active};},onRemoved:{addListener:fn=>removed.push(fn)}}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../desktop/ai-activity-worker.js'),'utf8'),{chrome,WorkflowAISites:require('../ai-sites.js'),URL,Date,setInterval:fn=>{tick=fn;return 1;},clearInterval:()=>{tick=null;}});
 const sender={id:'own',frameId:0,url:tab.url,tab:{id:7,url:tab.url}};
 async function call(type,id='a',from=sender){return new Promise(resolve=>{const handled=listeners[0]({type,requestId:id},from,resolve);if(!handled)resolve({ok:false});});}
 return {tab,calls,messages,storage,call,removed,active:value=>{active=value;},pulse:async()=>{tick?.();for(let i=0;i<20;i++)await turn();}};
}
test('active AI jobs protect only their own tab, pulse without focus, and restore discard setting after the last job',async()=>{
 const f=fixture();assert.equal((await f.call('WORKFLOW_AI_WATCH_START')).ok,true);await f.call('WORKFLOW_AI_WATCH_START','b');
 assert.equal(f.tab.autoDiscardable,false);f.active(['a','b']);await f.pulse();assert.equal(f.messages[0].type,'WORKFLOW_AI_PULSE');
 await f.call('WORKFLOW_AI_WATCH_END','a');assert.equal(f.tab.autoDiscardable,false);await f.call('WORKFLOW_AI_WATCH_END','b');assert.equal(f.tab.autoDiscardable,true);
 assert.equal(f.storage.workflowAIActivity.length,0);assert.ok(f.calls.every(call=>Object.keys(call).every(key=>['id','autoDiscardable'].includes(key))),'Never activate or focus a tab');
});
test('cancellation, tab navigation and lost content jobs release the original setting without replaying prompts',async()=>{
 const f=fixture();f.tab.autoDiscardable=false;await f.call('WORKFLOW_AI_WATCH_START');f.active([]);await f.pulse();assert.equal(f.tab.autoDiscardable,false);assert.equal(f.storage.workflowAIActivity.length,0);
 f.tab.autoDiscardable=true;await f.call('WORKFLOW_AI_WATCH_START');f.tab.url='https://example.com/';await f.pulse();assert.equal(f.tab.autoDiscardable,true);assert.ok(f.messages.every(m=>m.type==='WORKFLOW_AI_PULSE'));
});
test('service worker restart reconciles surviving jobs and restores expired leases',async()=>{
 const f=fixture([{tabId:7,original:true,expires:Date.now()+100000,ids:['a']}]);for(let i=0;i<20;i++)await turn();assert.equal(f.messages[0].type,'WORKFLOW_AI_PULSE');f.active([]);await f.pulse();assert.equal(f.tab.autoDiscardable,true);
 const expired=fixture([{tabId:7,original:true,expires:0,ids:['a']}]);for(let i=0;i<20;i++)await turn();assert.equal(expired.tab.autoDiscardable,true);assert.equal(expired.storage.workflowAIActivity.length,0);
});
test('untrusted senders, subframes, unrelated sites and malformed job IDs cannot create activity leases',async()=>{
 const f=fixture();for(const from of [{id:'other',url:f.tab.url,tab:f.tab},{id:'own',frameId:1,url:f.tab.url,tab:f.tab},{id:'own',url:'https://example.com/',tab:f.tab}])assert.equal((await f.call('WORKFLOW_AI_WATCH_START','a',from)).ok,false);
 assert.equal((await f.call('WORKFLOW_AI_WATCH_START','')).ok,false);assert.equal(f.calls.length,0);
});
