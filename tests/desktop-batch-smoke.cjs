/* Actual desktop window, IPC, batch bridge, IndexedDB, FFmpeg and downloads.
 * Only the remote AI transport is a fixture; no paid calls or social posts. */
const {_electron:electron}=require('playwright'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
(async()=>{const root=await fs.mkdtemp(path.join(os.tmpdir(),'mooz-batch-'));let app;const errors=[];
 try{
  const env={...process.env,WORKFLOW_DESKTOP_TEST:'1',WORKFLOW_TEST_DATA:root};delete env.ELECTRON_RUN_AS_NODE;
  app=await electron.launch({args:['--no-sandbox',path.resolve(__dirname,'..')],env,timeout:60000});const home=await app.firstWindow();await home.waitForSelector('#aiAppsBatch');
  const video=(await fs.readFile(path.join(__dirname,'fixtures/posting-sample.mp4'))).toString('base64');
  await fs.mkdir(path.join(root,'downloads'));
  await app.evaluate(({app},{video,root})=>{
   app.setPath('downloads',root+'/downloads');const t=globalThis.workflowTest;t.fixtureTabs=[];t.fixtureMessages=[];t.fixtureResults=new Map();
   t.postingAI.tabs=async()=>t.fixtureTabs;
   t.ai.script=async()=>{};
   t.ai.message=async(id,message)=>{
    if(message.type==='MUSEFLOW_CHECK_SESSION')return {composer:true,signedIn:true,jobProtocol:1,resultProtocol:2,textProtocol:1};
    if(message.type==='MUSEFLOW_JOB_START'){t.fixtureMessages.push({id,...message});t.fixtureResults.set(message.requestId,message.mediaType==='text'?{ok:true,text:'Kịch bản cho đúng sản phẩm.'}:{ok:true,url:'data:video/mp4;base64,'+video});return {ok:true};}
    if(message.type==='MUSEFLOW_JOB_STATUS')return {ok:true,state:'done',result:t.fixtureResults.get(message.requestId)};
    return {ok:true};
   };
  },{video,root});
  const promise=app.waitForEvent('window');await home.click('#aiAppsBatch');const page=await promise;page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));await page.waitForFunction(()=>window.MooZBatch);
  assert.equal(await page.evaluate(()=>MooZBatch.state.jobs.length),0);assert.equal(await page.evaluate(()=>MooZBatch.assets.length),0);assert.equal(await page.locator('text=PREVIEW · KHÔNG GỌI AI').count(),0);
  await page.click('#openPool');await page.click('#refreshTabs');assert.match(await page.locator('#tabsStatus').innerText(),/0 tab/);
  const tabs=n=>Array.from({length:n},(_,i)=>({id:100+i,transport:'native',provider:'muse',title:'Muse test '+(i+1),url:'https://muse.ai/chat/test-'+i}));
  await app.evaluate((_,tabs)=>globalThis.workflowTest.fixtureTabs=tabs,tabs(4));await page.click('#refreshTabs');assert.equal(await page.locator('[data-worker-select]').count(),4);assert.equal(await page.locator('[data-worker-select]:checked').count(),0);
  for(const checkbox of await page.locator('[data-worker-select]').all())await checkbox.check();
  await app.evaluate((_,tabs)=>globalThis.workflowTest.fixtureTabs=tabs,tabs(5));await page.click('#refreshTabs');assert.equal(await page.locator('[data-worker-select]').count(),5);assert.equal(await page.locator('[data-worker-select]:checked').count(),4);
  await page.locator('[data-close=poolDialog]').last().click();
  await page.click('#editWorkflow');
  // Remove vision, text and image for this video/assembly fixture. UI uses actual edited workflow.
  for(let i=0;i<3;i++)await page.click('#removeStep');
  await page.fill('#workflowScenes','1');await page.locator('#workflowScenes').blur();await page.selectOption('#workflowDuration','');await page.click('#workflowSave');
  await page.click('[data-view=production]');await page.click('#addProducts');
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j7ZkAAAAASUVORK5CYII=','base64');
  await page.setInputFiles('#productFiles',Array.from({length:13},(_,i)=>({name:'San-pham-'+(i+1)+'.png',mimeType:'image/png',buffer:png})));
  await page.waitForFunction(()=>MooZBatch.state.jobs.length===13);if(await page.locator('#productDialog').evaluate(d=>d.open))await page.locator('[data-close=productDialog]').last().click();
  console.log('Batch UI ready; running 13 real local fixture jobs.');await page.click('#runBatch');await page.waitForFunction(()=>MooZBatch.state.jobs.every(j=>j.state==='done'),null,{timeout:180000}).catch(async e=>{console.log(await page.evaluate(()=>MooZBatch.state));throw e;});
  const jobs=await page.evaluate(()=>MooZBatch.state.jobs);assert.ok(jobs.every(j=>j.completed.length===2&&j.resultId&&!j.resultId.startsWith('demo')));assert.equal(new Set(jobs.map(j=>j.resultId)).size,13);
  const calls=await app.evaluate(()=>globalThis.workflowTest.fixtureMessages);assert.equal(calls.length,13);assert.equal(new Set(calls.map(m=>m.id)).size,4);assert.ok(calls.every(m=>!Object.hasOwn(m,'duration')&&m.referenceImages.length===1));assert.ok(calls.every(m=>m.prompt.includes('DỮ LIỆU RIÊNG CỦA SẢN PHẨM')));
  assert.equal(await page.evaluate(()=>MooZBatch.assets.filter(a=>a.kind==='video').length),26);
  await page.locator('.row-action').first().click();await page.waitForSelector('#editVideo');await page.waitForFunction(()=>document.querySelector('#editVideo').readyState>=2);
  await page.click('[data-view=library]');
  const wav=Buffer.alloc(44+16000*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(16000,24);wav.writeUInt32LE(32000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);for(let i=0;i<16000;i++)wav.writeInt16LE(Math.round(Math.sin(i/16000*Math.PI*2*(i<8000?220:440))*12000),44+i*2);
  await page.setInputFiles('#libraryFiles',{name:'Nhac-thu.wav',mimeType:'audio/wav',buffer:wav});await page.waitForFunction(()=>MooZBatch.assets.some(a=>a.kind==='audio'));await page.click('[data-view=editor]');await page.click('#pickMusic');await page.locator('[data-pick]').first().click();await page.fill('#audioStart','0.5');await page.locator('#audioStart').blur();await page.check('#loopMusic');await page.locator('#originalVolume').fill('0');await page.locator('#musicVolume').fill('50');
  await page.fill('#videoEnd','0.6');await page.locator('#videoEnd').blur();await page.click('[data-preset=mono]');await page.screenshot({path:'/tmp/mooz-batch-editor.png',fullPage:true});await page.click('#exportVideo');await page.waitForSelector('#downloadLast');
  const files=await fs.readdir(path.join(root,'downloads'));assert.equal(files.length,1);assert.ok(files[0].endsWith('.mp4'));assert.ok((await fs.stat(path.join(root,'downloads',files[0]))).size>1000);
  const exported=await page.evaluate(()=>MooZBatch.assets.filter(a=>a.exportSettings).at(-1));assert.equal(exported.mime,'video/mp4');assert.ok(Math.abs(exported.duration-.6)<.1);assert.equal(exported.exportSettings.saturation,0);
  const encoded=await page.evaluate(async()=>{const a=MooZBatch.assets.filter(a=>a.exportSettings).at(-1),v=document.createElement('video');v.src=a.url;await new Promise(resolve=>v.onloadeddata=resolve);v.currentTime=.2;await new Promise(resolve=>v.onseeked=resolve);const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').drawImage(v,0,0);const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let difference=0;for(let i=0;i<pixels.length;i+=4)difference+=Math.abs(pixels[i]-pixels[i+1])+Math.abs(pixels[i+1]-pixels[i+2]);const ac=new AudioContext(),decoded=await ac.decodeAudioData(await a.blob.arrayBuffer());await ac.close();const samples=decoded.getChannelData(0),rate=decoded.sampleRate;const power=f=>{let x=0,y=0;for(let i=200;i<Math.min(samples.length,8000);i++){x+=samples[i]*Math.sin(i/rate*2*Math.PI*f);y+=samples[i]*Math.cos(i/rate*2*Math.PI*f);}return x*x+y*y;};return {difference:difference/(pixels.length/4),rms:Math.sqrt(samples.reduce((sum,x)=>sum+x*x,0)/samples.length),p440:power(440),p220:power(220)};});
  assert.ok(encoded.difference<8,JSON.stringify(encoded));assert.ok(encoded.rms>.02,JSON.stringify(encoded));assert.ok(encoded.p440>encoded.p220*10,'Encoded AAC uses selected second half of the music, not its start');
  await page.click('#downloadLast');await page.waitForFunction(()=>!document.querySelector('#exportDialog').open);await new Promise(resolve=>setTimeout(resolve,300));assert.equal((await fs.readdir(path.join(root,'downloads'))).length,2,'Duplicate export names use unique native paths without replace prompts');
  await page.reload();await page.waitForFunction(()=>window.MooZBatch);assert.equal(await page.evaluate(()=>MooZBatch.state.jobs.filter(j=>j.state==='done').length),13);assert.equal(await page.evaluate(()=>MooZBatch.assets.filter(a=>a.kind==='video').length),27);
  await page.click('#openPool');await app.evaluate((_,tabs)=>globalThis.workflowTest.fixtureTabs=tabs,tabs(3));await page.click('#refreshTabs');assert.equal(await page.evaluate(()=>MooZBatch.state.workers.find(w=>w.id==='native:103').online),false);
  await page.locator('[data-close=poolDialog]').last().click();
  for(const [width,height]of [[1024,768],[1500,960]]){await page.setViewportSize({width,height});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
  await fs.mkdir('/tmp/mooz-batch-review',{recursive:true});await page.screenshot({path:'/tmp/mooz-batch-review/production.png'});
  await assert.rejects(()=>home.evaluate(()=>workflowDesktop.call('batch.generate',{workerId:'native:100',mediaType:'video',prompt:'No'})),/Mở Video hàng loạt/);
  assert.deepEqual(errors,[]);console.log('PASS desktop batch: empty real studio → refresh 4/5 tabs with opt-in → custom workflow → 13 products across 4 tabs → 26 actual local videos → native trimmed monochrome MP4 with decoded 440 Hz selected music + collision-free downloads → reload persists jobs/assets → closed tabs offline; provider transport mocked.');
 }finally{await app?.close();await fs.rm(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
