/* UI integration harness: real Chromium DOM with simulated chrome.* APIs.
   Does not claim a signed-in provider or a load-unpacked installation was tested. */
const {chromium}=require('playwright');
const {createServer}=require('node:http');
const {readFile}=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const base=path.resolve(__dirname,'..');
 const server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname;const file=path.resolve(base,'.'+pathname);if(!file.startsWith(base+path.sep))throw Error();const data=await readFile(file);res.setHeader('Content-Type',file.endsWith('.js')||file.endsWith('.mjs')?'text/javascript':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(data);}catch{res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:1500,height:950}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.route('https://**/*',route=>route.fulfill({status:404,body:''}));
 await page.addInitScript(({sessionFail})=>{
  const store={};window.testStore=store;window.testMessages=[];window.testDownloads=[];window.testTargets=[];
  const storage={get:async key=>({[key]:structuredClone(store[key])}),set:async value=>Object.assign(store,structuredClone(value))};
  window.chrome={downloads:{download:async options=>{testDownloads.push(options);return 1;}},runtime:{id:'test',getManifest:()=>({version:'0.6.0'}),getURL:p=>location.origin+'/'+p},storage:{local:storage,session:{get:async()=>{if(sessionFail)throw new Error('session unavailable');return {};},set:async()=>{}}},scripting:{executeScript:async options=>options.func&&window.testPickerResult?[{result:window.testPickerResult}]:[]},tabs:{update:async id=>{window.testTabActivated=id;return {id};},query:async()=>window.testTabs||[{id:1,active:true,url:'https://gemini.google.com/app'}],sendMessage:async(id,msg)=>{window.testMessages.push(msg);window.testTargets.push({id,type:msg.type});if(msg.type==='WORKFLOW_AI_CHECK'&&window.testRequireActivation&&window.testTabActivated!==id)return {ok:true,composer:false,signedIn:false};if(msg.type==='WORKFLOW_AI_CHECK'&&window.testUnavailableIds?.includes(id))return {ok:true,composer:false,signedIn:false};if(msg.type==='WORKFLOW_AI_USE_RESULT'){window.testPending?.({ok:true,text:msg.text});return {ok:true};}if(msg.type==='WORKFLOW_AI_STOP'){window.testPending?.({ok:false,error:'Stopped'});return {ok:true};}if(window.testDelayNext&&msg.type==='WORKFLOW_AI_GENERATE'){window.testDelayNext=false;return new Promise(resolve=>{window.testPending=resolve;});}if(msg.mediaType==='video'&&window.testVideoURL)return {ok:true,url:window.testVideoURL};if(msg.mediaType==='image')return {ok:true,url:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='};if(msg.type.includes('CHECK'))return {ok:true,signedIn:true,composer:true};return {ok:true,text:'Kịch bản mới từ video gốc'};},create:async options=>{window.testCreatedTab=options.url;},onUpdated:{addListener(){}},onCreated:{addListener(){}}}};
 },{sessionFail:!!process.env.FAIL_SESSION_STORAGE});
 await page.goto(origin+'/app.html');await page.waitForSelector('.node');assert.equal(await page.locator('#buyCoffeeBtn,#donationModal').count(),0);await page.keyboard.press('Escape');
 await page.click('#desktopConnectBtn');assert.equal(await page.evaluate(()=>window.testCreatedTab),origin+'/desktop/connect.html','Companion pairing must remain visible after toolbar restructuring');
 assert.equal(await page.locator('.compact-toggle').count(),1);assert.equal(await page.locator('.toolbar-popover:visible').count(),0);
 for(const id of ['saveBtn','runBtn','addNodeMenuBtn','masterScriptBtn'])assert.equal(await page.locator('#'+id).isVisible(),true,id+' must be directly visible');assert.equal(await page.locator('.studio-sidebar-group #referenceBoardBtn').count(),1,'Menu chính nằm ở sidebar trái');
 await page.click('#saveBtn');await page.waitForFunction(()=>testStore.museflow?.nodes.length>0);
 await page.click('#toolbar-create');assert.equal(await page.locator('#promptLibraryBtn').isVisible(),true);await page.keyboard.press('Escape');assert.equal(await page.locator('.toolbar-popover:visible').count(),0);assert.equal(await page.evaluate(()=>document.activeElement.id),'toolbar-create');await page.keyboard.press('ArrowDown');assert.equal(await page.evaluate(()=>document.activeElement.id),'appearanceOpen');await page.keyboard.press('Escape');
 await page.click('#toolbar-create');await page.click('#promptLibraryBtn');assert.equal(await page.locator('#promptLibraryDialog').isVisible(),true);await page.click('#promptCloseBtn');
 await page.click('#toolbar-create');await page.click('#settingsBtn');assert.equal(await page.locator('#settingsModal').isVisible(),true);await page.click('#closeSettingsBtn');
 await page.click('#addNodeMenuBtn');assert.equal(await page.locator('#addNodeMenu').isVisible(),true);await page.keyboard.press('Escape');assert.equal(await page.locator('#addNodeMenu').isVisible(),false);
 const count=await page.locator('.node').count();await page.click('#masterScriptBtn');assert.equal(await page.locator('.node').count(),count+1);
 for(const width of [1500,1000,800,620,390,320]){await page.setViewportSize({width,height:850});const sidebar=await page.locator('.studio-sidebar').boundingBox(),viewport=await page.locator('#viewport').boundingBox();assert.ok(viewport.width>100,'Canvas remains usable at '+width);assert.ok(sidebar.x+sidebar.width<=viewport.x+1,'Sidebar must not cover canvas');await page.locator('#toolbar-create').scrollIntoViewIfNeeded();await page.click('#toolbar-create');const bounds=await page.locator('#toolbar-panel-create').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width);assert.equal(await page.locator('#clearPromptsBtn').isVisible(),true);await page.keyboard.press('Escape');}
 await page.setViewportSize({width:1200,height:850});await page.screenshot({path:'/tmp/workflow-toolbar-clear.png'});assert.deepEqual(errors,[]);console.log('PASS toolbar: directly visible Add node/Master script/Save/Run, one secondary menu, keyboard dismissal, existing actions, responsive 320–1500px.');

 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
