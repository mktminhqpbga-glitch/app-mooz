/* Real workflow UI, queue snapshots, IPC and local MP4 assembly; remote AI replies are fixtures. */
'use strict';
const {_electron:electron}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'mooz-common-prompt-'));
 const review=path.join(process.env.MOOZ_UI_AUDIT_DIR||'/tmp/mooz-0614-audit','common-prompt');
 let app;
 const errors=[];
 try{
  await fs.mkdir(review,{recursive:true});
  const env={...process.env,WORKFLOW_DESKTOP_TEST:'1',WORKFLOW_TEST_DATA:root};delete env.ELECTRON_RUN_AS_NODE;
  app=await electron.launch({args:['--no-sandbox',path.resolve(__dirname,'..')],env,timeout:60000});
  const home=await app.firstWindow();await home.waitForSelector('#aiAppsBatch');
  const video=(await fs.readFile(path.join(__dirname,'fixtures/posting-sample.mp4'))).toString('base64');
  await app.evaluate((_,video)=>{
   const t=workflowTest;t.commonCalls=[];t.commonResults=new Map();t.holdVideos=true;
   t.postingAI.tabs=async()=>[{id:321,transport:'native',provider:'muse',title:'Muse common prompt fixture',url:'https://muse.ai/chat/common'}];
   t.ai.script=async()=>{};
   t.ai.message=async(id,m)=>{
    if(m.type==='MUSEFLOW_CHECK_SESSION')return {composer:true,signedIn:true,sendProtocol:1,jobProtocol:1,resultProtocol:2,videoResultProtocol:1,videoReferenceProtocol:1,textProtocol:1,modeProtocol:1,backgroundProtocol:2,visibility:'hidden'};
    if(m.type==='MUSEFLOW_JOB_START'){
     t.commonCalls.push(m);
     const rows=[1,2].map(n=>({scene:n,title:'Cảnh '+n,voiceover:'Lời đọc '+n,imagePrompt:'SCENE_IMAGE_'+n,videoPrompt:'SCENE_VIDEO_'+n,duration:null,size:'9:16'}));
     t.commonResults.set(m.requestId,{mediaType:m.mediaType,result:m.mediaType==='text'?{ok:true,text:JSON.stringify({scenes:rows})}:{ok:true,url:'data:video/mp4;base64,'+video}});
     return {ok:true};
    }
    if(m.type==='MUSEFLOW_JOB_STATUS'){const saved=t.commonResults.get(m.requestId);return t.holdVideos&&saved.mediaType==='video'?{ok:true,state:'running'}:{ok:true,state:'done',result:saved.result};}
    return {ok:true};
   };
  },video);
  const pending=app.waitForEvent('window');await home.click('#aiAppsBatch');const p=await pending;
  p.setDefaultTimeout(30000);p.on('pageerror',e=>errors.push(e.message));
  await p.waitForFunction(()=>window.MooZBatch);
  await p.click('#openPool');await p.click('#refreshTabs');await p.locator('[data-worker-select]').check();await p.locator('[data-close=poolDialog]').last().click();
  await p.click('#editWorkflow');
  await p.click('#removeStep'); // Remove product analysis; retain strict scene script.
  await p.click('[data-step="1"]');await p.click('#removeStep'); // Remove optional generated images.
  await p.fill('#workflowScenes','2');await p.locator('#workflowScenes').blur();
  await p.click('#workflowCommonPrompt');
  await p.fill('#commonPromptValue','COMMON_A: Ánh sáng tự nhiên, chuyển động chậm.');
  await p.locator('#commonPromptForm [type=submit]').click();
  assert.equal(await p.evaluate(()=>MooZBatch.state.workflow.commonVideoPromptMode),'append');
  await p.reload();await p.waitForFunction(()=>window.MooZBatch);
  await p.click('[data-view=workflow]');await p.click('#workflowCommonPrompt');
  assert.match(await p.inputValue('#commonPromptValue'),/COMMON_A/);
  await p.fill('#commonPromptValue','CANCELLED_PROMPT');await p.locator('[data-close=commonPromptDialog]').last().click();
  assert.match(await p.evaluate(()=>MooZBatch.state.workflow.commonVideoPrompt),/COMMON_A/,'Cancel preserves saved prompt');
  const importProduct=async(name,color)=>{
   await p.click('[data-view=production]');await p.click('[data-composer-mode=images]');await p.click('#addProducts');
   const base64=await p.evaluate(color=>{const c=document.createElement('canvas');c.width=c.height=32;c.getContext('2d').fillStyle=color;c.getContext('2d').fillRect(0,0,32,32);return c.toDataURL().split(',')[1];},color);
   await p.setInputFiles('#productFiles',{name,mimeType:'image/png',buffer:Buffer.from(base64,'base64')});
   await p.waitForFunction(()=>!document.querySelector('#productDialog').open);
  };
  await importProduct('Product-A.png','#cc3322');await p.click('#composerSubmit');
  await app.evaluate(()=>new Promise((resolve,reject)=>{const started=Date.now(),timer=setInterval(()=>{if(workflowTest.commonCalls.some(c=>c.mediaType==='video')){clearInterval(timer);resolve();}else if(Date.now()-started>60000){clearInterval(timer);reject(Error('No video request'));}},50);}));
  const firstId=await p.evaluate(()=>MooZBatch.state.jobs[0].id);
  await p.click('#editWorkflow');await p.click('#workflowCommonPrompt');
  await p.fill('#commonPromptValue','COMMON_B: Góc quay cố định.');await p.selectOption('#commonPromptMode','replace');
  await p.locator('#commonPromptForm [type=submit]').click();
  assert.match(await p.evaluate(()=>MooZBatch.state.jobs[0].plan.commonVideoPrompt),/COMMON_A/,'Running product retains its own saved prompt');
  await app.evaluate(()=>workflowTest.holdVideos=false);
  await p.waitForFunction(id=>MooZBatch.state.jobs.find(j=>j.id===id).state==='done',firstId,{timeout:120000});
  await importProduct('Product-B.png','#2244bb');await p.click('#composerSubmit');
  await p.waitForFunction(()=>MooZBatch.state.jobs.length===2&&MooZBatch.state.jobs.every(j=>j.state==='done'),null,{timeout:120000});
  const calls=await app.evaluate(()=>workflowTest.commonCalls),videos=calls.filter(c=>c.mediaType==='video');
  assert.equal(videos.length,4);
  assert.ok(calls.filter(c=>c.mediaType==='text').every(c=>!c.prompt.includes('COMMON_')),'Shared video instructions are not sent to script generation');
  for(let i=0;i<2;i++){
   assert.match(videos[i].prompt,/COMMON_A/);assert.doesNotMatch(videos[i].prompt,/COMMON_B/);
   assert.ok(videos[i].prompt.includes('SCENE_VIDEO_'+(i+1)),'Append retains the correct scene prompt');
   assert.ok(!videos[i].prompt.includes('SCENE_VIDEO_'+(2-i)),'No other scene prompt leaks into this request');
  }
  for(const call of videos.slice(2)){assert.match(call.prompt,/COMMON_B/);assert.doesNotMatch(call.prompt,/COMMON_A|SCENE_VIDEO_/);}
  assert.ok(videos.every(c=>c.referenceImages.length===1));
  assert.equal(videos[0].referenceImages[0],videos[1].referenceImages[0]);
  assert.notEqual(videos[0].referenceImages[0],videos[2].referenceImages[0],'Different products retain distinct reference images');
  await p.click('#editWorkflow');await p.click('#workflowCommonPrompt');
  await p.screenshot({path:path.join(review,'common-video-prompt.png')});
  await p.fill('#commonPromptValue','');await p.locator('#commonPromptForm [type=submit]').click();
  assert.equal(await p.evaluate(()=>MooZBatch.state.workflow.commonVideoPrompt),'');
  assert.match(await p.evaluate(()=>MooZBatch.state.jobs[1].plan.commonVideoPrompt),/COMMON_B/,'Removing the shared prompt only affects future jobs');
  await p.reload();await p.waitForFunction(()=>window.MooZBatch);
  assert.equal(await p.evaluate(()=>MooZBatch.state.workflow.commonVideoPrompt),'');
  assert.ok(await p.evaluate(()=>MooZBatch.state.jobs.every(j=>j.resultId&&MooZBatch.assets.some(a=>a.id===j.resultId&&a.blob.size>0))));
  assert.deepEqual(errors,[]);
  console.log('PASS common video prompt: visible button/dialog, save/cancel/reload/remove, append/replace across two scenes, immutable in-flight snapshots, product image isolation, four actual IPC requests and two saved MP4 assemblies. AI transport fixture only.');
 }finally{
  await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});await fs.rm(root,{recursive:true,force:true});
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
