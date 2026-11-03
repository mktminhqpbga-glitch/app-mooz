/* Real workflow/import UI, IPC and local assembly. Only OS selection and remote AI replies are fixtures. */
'use strict';
const {_electron:electron}=require('playwright'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'mooz-character-')),review=path.join(process.env.MOOZ_UI_AUDIT_DIR||'/tmp/mooz-0615-audit','character-reference');
 let app;const errors=[];
 try{
  await fs.mkdir(review,{recursive:true});
  const env={...process.env,WORKFLOW_DESKTOP_TEST:'1',WORKFLOW_TEST_DATA:path.join(root,'data')};delete env.ELECTRON_RUN_AS_NODE;
  app=await electron.launch({args:['--no-sandbox',path.resolve(__dirname,'..')],env,timeout:60000});
  const home=await app.firstWindow();await home.waitForSelector('#aiAppsBatch');
  const image=async color=>home.evaluate(color=>{const c=document.createElement('canvas');c.width=c.height=32;const x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,32,32);return c.toDataURL();},color);
  const [personA,personB,productA,productB,generated1,generated2]=await Promise.all(['#ee3322','#2222ee','#22bb33','#aabb33','#33bbbb','#bb33bb'].map(image));
  const selected=path.join(root,'nhân-vật-A.png');await fs.writeFile(selected,Buffer.from(personA.split(',')[1],'base64'));
  const bad=path.join(root,'hỏng.png');await fs.writeFile(bad,'not an image');
  const video=(await fs.readFile(path.join(__dirname,'fixtures/posting-sample.mp4'))).toString('base64');
  await app.evaluate(({dialog,BrowserWindow},{video,generated1,generated2,selected})=>{
   const t=workflowTest;t.characterCalls=[];t.characterResults=new Map();t.holdVideos=true;t.characterSelection=selected;t.characterDialogs=[];t.cancelCharacter=false;
   dialog.showOpenDialog=async(owner,options)=>{t.characterDialogs.push({owner:owner===BrowserWindow.getAllWindows()[0],options});return t.cancelCharacter?{canceled:true,filePaths:[]}:{canceled:false,filePaths:[t.characterSelection]};};
   t.postingAI.tabs=async()=>[{id:421,transport:'native',provider:'muse',title:'Muse character fixture',url:'https://muse.ai/chat/character'}];t.ai.script=async()=>{};
   t.ai.message=async(id,m)=>{
    if(m.type==='MUSEFLOW_CHECK_SESSION')return {composer:true,signedIn:true,sendProtocol:1,jobProtocol:1,resultProtocol:2,videoResultProtocol:1,textProtocol:1,modeProtocol:1,backgroundProtocol:2,visibility:'hidden'};
    if(m.type==='MUSEFLOW_JOB_START'){
     t.characterCalls.push(m);
     const rows=[1,2].map(n=>({scene:n,title:'Cảnh '+n,voiceover:'Lời '+n,imagePrompt:'SCENE_IMAGE_'+n,videoPrompt:'SCENE_VIDEO_'+n,duration:null,size:'9:16'}));
     const result=m.mediaType==='text'?{ok:true,text:JSON.stringify({scenes:rows})}:{ok:true,url:m.mediaType==='image'?(m.prompt.includes('SCENE_IMAGE_1')?generated1:generated2):'data:video/mp4;base64,'+video};
     t.characterResults.set(m.requestId,{mediaType:m.mediaType,result});return {ok:true};
    }
    if(m.type==='MUSEFLOW_JOB_STATUS'){const r=t.characterResults.get(m.requestId);return t.holdVideos&&r.mediaType==='video'?{ok:true,state:'running'}:{ok:true,state:'done',result:r.result};}return {ok:true};
   };
  },{video,generated1,generated2,selected});
  const pending=app.waitForEvent('window');await home.click('#aiAppsBatch');const p=await pending;p.setDefaultTimeout(30000);p.on('pageerror',e=>errors.push(e.message));await p.waitForFunction(()=>window.MooZBatch);
  await p.click('#editWorkflow');await p.click('#removeStep');await p.fill('#workflowScenes','2');await p.locator('#workflowScenes').blur();
  await p.click('#workflowCharacterReference');assert.equal(await p.locator('#characterReferenceEnabled').isChecked(),false);
  await p.click('#characterReferenceLibrary');assert.match(await p.locator('#characterReferenceStatus').innerText(),/Kho chưa có ảnh/);
  await p.check('#characterReferenceEnabled');await p.click('#characterReferenceSave');assert.match(await p.locator('#characterReferenceStatus').innerText(),/Chọn ảnh nhân vật/);
  await app.evaluate(()=>workflowTest.cancelCharacter=true);await p.click('#characterReferenceUpload');await p.waitForFunction(()=>!document.querySelector('#characterReferenceUpload').disabled);assert.match(await p.locator('#characterReferenceStatus').innerText(),/Chưa chọn ảnh/);
  await app.evaluate((_,bad)=>{workflowTest.cancelCharacter=false;workflowTest.characterSelection=bad;},bad);await p.click('#characterReferenceUpload');await p.waitForFunction(()=>document.querySelector('#characterReferenceStatus').classList.contains('error')&&!document.querySelector('#characterReferenceUpload').disabled);assert.match(await p.locator('#characterReferenceStatus').innerText(),/Không đọc được ảnh/);
  await app.evaluate((_,selected)=>workflowTest.characterSelection=selected,selected);await p.click('#characterReferenceUpload');await p.waitForFunction(()=>document.querySelector('#characterReferencePreview img')?.naturalWidth>0&&!document.querySelector('#characterReferenceUpload').disabled);
  await p.click('#characterReferenceSave');const personAId=await p.evaluate(()=>MooZBatch.state.workflow.characterReferenceId);assert.equal(await p.evaluate(()=>MooZBatch.state.jobs.length),0,'Uploading character never creates a product');
  await p.reload();await p.waitForFunction(()=>window.MooZBatch);await p.click('[data-view=workflow]');await p.click('#workflowCharacterReference');assert.equal(await p.locator('#characterReferenceEnabled').isChecked(),true);assert.ok(await p.locator('#characterReferencePreview img').evaluate(i=>i.complete&&i.naturalWidth>0));
  await p.uncheck('#characterReferenceEnabled');await p.locator('[data-close=characterReferenceDialog]').last().click();assert.equal(await p.evaluate(()=>MooZBatch.state.workflow.characterReferenceEnabled),true,'Cancel leaves enabled setting intact');
  await p.click('[data-view=production]');await p.click('#openPool');await p.click('#refreshTabs');await p.locator('[data-worker-select]').check();await p.locator('[data-close=poolDialog]').last().click();
  const importProduct=async(name,data)=>{await p.click('[data-view=production]');await p.click('[data-composer-mode=images]');await p.click('#addProducts');await p.setInputFiles('#productFiles',{name,mimeType:'image/png',buffer:Buffer.from(data.split(',')[1],'base64')});await p.waitForFunction(()=>!document.querySelector('#productDialog').open);};
  await importProduct('Sản phẩm A.png',productA);await p.click('#composerSubmit');await p.waitForFunction(()=>MooZBatch.state.jobs[0]?.active&&MooZBatch.state.jobs[0].plan.steps[MooZBatch.state.jobs[0].step].type==='video',null,{timeout:120000});
  // Change the character while A is running: both of its video scenes must retain A.
  await p.click('#editWorkflow');await p.click('#workflowCharacterReference');
  const second=path.join(root,'nhân-vật-B.png');await fs.writeFile(second,Buffer.from(personB.split(',')[1],'base64'));await app.evaluate((_,file)=>workflowTest.characterSelection=file,second);await p.click('#characterReferenceUpload');await p.waitForFunction(()=>document.querySelector('#characterReferencePreview').textContent.includes('nhân-vật-B.png')&&!document.querySelector('#characterReferenceUpload').disabled);await p.click('#characterReferenceSave');
  const personBId=await p.evaluate(()=>MooZBatch.state.workflow.characterReferenceId);assert.notEqual(personAId,personBId);assert.equal(await p.evaluate(()=>MooZBatch.state.jobs[0].plan.characterReferenceId),personAId);
  await app.evaluate(()=>workflowTest.holdVideos=false);await p.waitForFunction(()=>MooZBatch.state.jobs[0].state==='done',null,{timeout:120000});
  await importProduct('Sản phẩm B.png',productB);await p.click('#composerSubmit');await p.waitForFunction(()=>MooZBatch.state.jobs.length===2&&MooZBatch.state.jobs[1].state==='done',null,{timeout:120000});
  await p.click('#editWorkflow');await p.click('#workflowCharacterReference');await p.uncheck('#characterReferenceEnabled');await p.click('#characterReferenceSave');assert.equal(await p.evaluate(()=>MooZBatch.state.workflow.characterReferenceId),personBId,'Disabling retains the selected photo for later');
  await importProduct('Không dùng nhân vật.png',productA);await p.click('#composerSubmit');await p.waitForFunction(()=>MooZBatch.state.jobs.length===3&&MooZBatch.state.jobs[2].state==='done',null,{timeout:120000});
  const calls=await app.evaluate(()=>workflowTest.characterCalls),texts=calls.filter(c=>c.mediaType==='text'),images=calls.filter(c=>c.mediaType==='image'),videos=calls.filter(c=>c.mediaType==='video');
  assert.equal(texts.length,3);assert.equal(images.length,6);assert.equal(videos.length,6);assert.ok(texts.every(c=>c.referenceImages.length===1&&!c.prompt.includes('VAI TRÒ ẢNH THAM CHIẾU')));
  const aRef=images[0].referenceImages[1],bRef=images[2].referenceImages[1];assert.notEqual(aRef,bRef);
  for(let i=0;i<4;i++){assert.equal(images[i].referenceImages.length,2);assert.equal(videos[i].referenceImages.length,2);assert.equal(images[i].referenceImages[1],i<2?aRef:bRef);assert.equal(videos[i].referenceImages[1],i<2?aRef:bRef);assert.match(videos[i].prompt,/Ảnh 2 là NHÂN VẬT THAM CHIẾU/);}
  assert.notEqual(images[0].referenceImages[0],images[2].referenceImages[0],'Product source photos remain separate');assert.notEqual(videos[0].referenceImages[0],videos[1].referenceImages[0],'Each video receives its own generated scene image');
  for(const c of [...images.slice(4),...videos.slice(4)]){assert.equal(c.referenceImages.length,1);assert.doesNotMatch(c.prompt,/VAI TRÒ ẢNH THAM CHIẾU/);}
  await p.click('#editWorkflow');await p.click('#workflowCharacterReference');await p.click('#characterReferenceLibrary');await p.locator('[data-pick="'+personAId+'"]').click();await p.click('#characterReferenceSave');assert.equal(await p.evaluate(()=>MooZBatch.state.workflow.characterReferenceId),personAId);
  await p.click('#workflowCharacterReference');await p.screenshot({path:path.join(review,'character-enabled.png')});await p.click('#characterReferenceRemove');await p.click('#characterReferenceSave');assert.equal(await p.evaluate(()=>MooZBatch.state.workflow.characterReferenceEnabled),false);assert.equal(await p.evaluate(()=>MooZBatch.state.workflow.characterReferenceId),'');assert.equal(await p.evaluate(()=>MooZBatch.state.jobs[0].plan.characterReferenceId),personAId);
  await p.click('#workflowCharacterReference');await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(640,650));await p.locator('#characterReferenceSave').scrollIntoViewIfNeeded();assert.ok(await p.locator('#characterReferenceSave').isVisible());assert.ok(await p.locator('#characterReferenceDialog').evaluate(d=>d.scrollWidth<=d.clientWidth+1));await p.screenshot({path:path.join(review,'character-optional-compact.png')});
  assert.ok(await app.evaluate(()=>workflowTest.characterDialogs.every(d=>d.owner&&d.options.properties.length===1&&d.options.title.includes('nhân vật'))));assert.deepEqual(errors,[]);
  console.log('PASS optional character reference: default off, empty/cancel/corrupt feedback, one-image native owner IPC, preview/library/save/cancel/reload/remove; separate product/character/scene roles in six image and six video requests, immutable running snapshots, disabled character never sent, three real local MP4 assemblies. Remote AI and OS selection fixtures only.');
 }catch(error){for(const [i,p]of(app?.windows()||[]).entries())await p.screenshot({path:path.join(review,'failure-'+i+'.png')}).catch(()=>{});throw error;}
 finally{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});await fs.rm(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
