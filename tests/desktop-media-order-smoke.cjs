/* Actual media imports, IndexedDB reload, search and both library picker sources. */
const assert=require('node:assert/strict'),path=require('node:path'),os=require('node:os'),fs=require('node:fs/promises');
const {_electron:electron}=require('playwright');
(async()=>{
 const data=await fs.mkdtemp(path.join(os.tmpdir(),'mooz-media-order-')),out=path.join(process.env.MOOZ_UI_AUDIT_DIR||data,'media-order');let app;
 try{
  await fs.mkdir(out,{recursive:true});const env={...process.env,WORKFLOW_DESKTOP_TEST:'1',WORKFLOW_TEST_DATA:data};delete env.ELECTRON_RUN_AS_NODE;
  app=await electron.launch({args:['--no-sandbox',path.resolve(__dirname,'..')],env,timeout:60000});const home=await app.firstWindow();await home.waitForSelector('#aiAppsBatch');const opening=app.waitForEvent('window');await home.click('#aiAppsBatch');const page=await opening;page.setDefaultTimeout(20000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.waitForFunction(()=>window.MooZBatch);
  await app.evaluate(()=>{workflowTest.mediaOrderPaidCalls=0;workflowTest.batchAI.generate=async()=>{workflowTest.mediaOrderPaidCalls++;throw Error('No paid generation in media ordering test');};});
  const png='iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR4nGNwaDjwH4QZYAwAVPQJ/Q4itk8AAAAASUVORK5CYII=';
  await page.evaluate(async png=>{
   const bytes=Uint8Array.from(atob(png),c=>c.charCodeAt(0)),request=indexedDB.open('mooz-batch-studio-media',1),db=await new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
   const tx=db.transaction('assets','readwrite'),store=tx.objectStore('assets');
   for(const [id,origin,createdAt,modified]of [['a-old-result','result',1000,0],['m-new-result','result',3000,0],['z-middle-result','result',2000,0],['a-legacy-old','upload',null,100],['z-legacy-new','upload',null,200]]){const blob=origin==='upload'?new File([bytes],id+'.png',{type:'image/png',lastModified:modified}):new Blob([bytes],{type:'image/png'});store.put({id,name:id+'.png',kind:'image',origin,blob,size:blob.size,mime:blob.type,...(createdAt?{createdAt}:{})});}
   await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
  },png);
  await page.reload();await page.waitForFunction(()=>window.MooZBatch?.assets.length===5);await page.click('[data-view=library]');
  const names=selector=>page.locator(selector+' .asset-info strong').allTextContents();
  assert.deepEqual(await names('#assetGrid'),['z-legacy-new.png','a-legacy-old.png']);
  const upload=async name=>{const count=await page.evaluate(()=>MooZBatch.assets.length);await page.locator('#libraryFiles').setInputFiles({name,mimeType:'image/png',buffer:Buffer.from(png,'base64')});await page.waitForFunction(count=>MooZBatch.assets.length===count+1,count);};
  await upload('media-first.png');await upload('media-second.png');
  assert.deepEqual(await names('#assetGrid'),['media-second.png','media-first.png','z-legacy-new.png','a-legacy-old.png']);
  const times=await page.evaluate(()=>MooZBatch.assets.filter(a=>a.name.startsWith('media-')).map(a=>a.createdAt));assert.ok(times.every(Number.isFinite));assert.ok(times[1]>times[0]);
  await page.fill('#assetSearch','media-');assert.deepEqual(await names('#assetGrid'),['media-second.png','media-first.png']);await page.fill('#assetSearch','');await page.click('#assetFilters [data-kind=image]');
  await page.locator('#assetGrid [data-rename]').first().click();await page.fill('#renameValue','media-renamed.png');await page.locator('#renameForm [type=submit]').click();await page.waitForSelector('#renameDialog',{state:'hidden'});assert.equal((await names('#assetGrid'))[0],'media-renamed.png');
  await page.click('[data-library-source=result]');assert.deepEqual(await names('#assetGrid'),['m-new-result.png','z-middle-result.png','a-old-result.png']);await page.fill('#assetSearch','result');assert.deepEqual(await names('#assetGrid'),['m-new-result.png','z-middle-result.png','a-old-result.png']);await page.fill('#assetSearch','');
  await page.reload();await page.waitForFunction(()=>window.MooZBatch?.assets.length===7);await page.click('[data-view=library]');assert.deepEqual((await names('#assetGrid')).slice(0,2),['media-renamed.png','media-first.png']);await upload('media-after-reload.png');assert.equal((await names('#assetGrid'))[0],'media-after-reload.png');
  await page.screenshot({path:path.join(out,'newest-uploads.png')});await page.click('[data-view=production]');await page.click('#addProducts');await page.click('#productFromLibrary');await page.waitForSelector('#assetPicker[open]');assert.deepEqual((await names('#pickerGrid')).slice(0,3),['media-after-reload.png','media-renamed.png','media-first.png']);
  await page.click('[data-picker-source=result]');assert.deepEqual(await names('#pickerGrid'),['m-new-result.png','z-middle-result.png','a-old-result.png']);await page.screenshot({path:path.join(out,'newest-results-picker.png')});
  assert.equal(await app.evaluate(()=>workflowTest.mediaOrderPaidCalls),0);assert.deepEqual(errors,[]);
  console.log('PASS media newest first: real uploads, creation time persisted across reload, rename keeps position, search/filter and upload/result stores plus both picker sources; legacy file-time fallback; no AI call.');
 }finally{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});await fs.rm(data,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
