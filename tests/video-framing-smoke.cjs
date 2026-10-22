const {toolbarAction}=require('./toolbar-actions.cjs');
/* UI integration harness: real Chromium DOM with simulated chrome.* APIs.
   Does not claim a signed-in provider or a load-unpacked installation was tested. */
const {chromium}=require('playwright');
const {createServer}=require('node:http');
const {readFile}=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const base=path.resolve(__dirname,'..');
 const server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname;const file=path.resolve(base,'.'+pathname);if(!file.startsWith(base+path.sep))throw Error();const data=await readFile(file);res.setHeader('Content-Type',file.endsWith('.js')||file.endsWith('.mjs')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(data);}catch{res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:1500,height:950}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.route('https://**/*',route=>route.fulfill({status:404,body:''}));
 await page.addInitScript(({sessionFail})=>{
  const store={};window.testStore=store;window.testMessages=[];window.testDownloads=[];window.testTargets=[];
  const storage={get:async key=>({[key]:structuredClone(store[key])}),set:async value=>Object.assign(store,structuredClone(value))};
  window.chrome={downloads:{download:async options=>{testDownloads.push(options);return 1;}},runtime:{id:'test',getManifest:()=>({version:'0.6.0'}),getURL:p=>location.origin+'/'+p},storage:{local:storage,session:{get:async()=>{if(sessionFail)throw new Error('session unavailable');return {};},set:async()=>{}}},scripting:{executeScript:async options=>options.func&&window.testPickerResult?[{result:window.testPickerResult}]:[]},tabs:{update:async id=>{window.testTabActivated=id;return {id};},query:async()=>window.testTabs||[{id:1,active:true,url:'https://gemini.google.com/app'}],sendMessage:async(id,msg)=>{window.testMessages.push(msg);window.testTargets.push({id,type:msg.type});if(msg.type==='WORKFLOW_AI_CHECK'&&window.testRequireActivation&&window.testTabActivated!==id)return {ok:true,composer:false,signedIn:false};if(msg.type==='WORKFLOW_AI_CHECK'&&window.testUnavailableIds?.includes(id))return {ok:true,composer:false,signedIn:false};if(msg.type==='WORKFLOW_AI_USE_RESULT'){window.testPending?.({ok:true,text:msg.text});return {ok:true};}if(msg.type==='WORKFLOW_AI_STOP'){window.testPending?.({ok:false,error:'Stopped'});return {ok:true};}if(window.testDelayNext&&msg.type==='WORKFLOW_AI_GENERATE'){window.testDelayNext=false;return new Promise(resolve=>{window.testPending=resolve;});}if(msg.mediaType==='video'&&window.testVideoURL)return {ok:true,url:window.testVideoURL};if(msg.mediaType==='image')return {ok:true,url:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='};if(msg.type.includes('CHECK'))return {ok:true,signedIn:true,composer:true};return {ok:true,text:'Kịch bản mới từ video gốc'};},create:async()=>{},onUpdated:{addListener(){}},onCreated:{addListener(){}}}};
 },{sessionFail:!!process.env.FAIL_SESSION_STORAGE});
 await page.goto(origin+'/app.html');await page.waitForSelector('.node');assert.equal(await page.locator('#buyCoffeeBtn,#donationModal').count(),0);await page.keyboard.press('Escape');
 assert.equal(await page.locator('.node').count(),3);assert.equal(await page.locator('.node-header .node-component-id').count(),3);assert.equal(await page.locator('.node-body .node-component-id').count(),0);assert.ok(await page.locator('.node-component-id').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize)<=10));await toolbarAction(page,'#packageUpdateBtn');const downloads=await page.evaluate(()=>testDownloads);assert.equal(downloads.length,1);assert.ok(downloads[0].url.startsWith('https://raw.githubusercontent.com/mktminhqpbga-glitch/workflow/main/downloads/Workflow-extension.zip'));assert.equal(downloads[0].saveAs,true);
 for(const type of ['generateText','videoInput','generateVideo']){await toolbarAction(page,'#addNodeMenuBtn');await page.click(`[data-add="${type}"]`);}
 assert.equal(await page.locator('.node').count(),6);
 assert.deepEqual(await page.locator('.video-controls select').nth(1).locator('option').allTextContents(),['4s','5s','6s','8s','10s','15s','20s','30s','60s']);
 await toolbarAction(page,'#settingsBtn');await page.waitForFunction(()=>document.querySelector('#aiConnections').innerText.includes('chưa nhập khóa'));
 assert.equal(await page.locator('#apiSettings input[type="password"]').count(),3);
 await page.click('#closeSettingsBtn');
 // Stable component IDs and an explicit ordered map for two image references.
 const {execFileSync}=require('node:child_process'),{writeFileSync,mkdtempSync,rmSync}=require('node:fs');const temp=mkdtempSync('/tmp/workflow-framing-');
 try{
 const square='data:video/mp4;base64,'+execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=red:s=480x480:r=24:d=1','-f','lavfi','-i','sine=frequency=440:duration=1','-shortest','-c:v','libx264','-threads','1','-pix_fmt','yuv420p','-c:a','aac','-f','mp4','-movflags','frag_keyframe+empty_moov','pipe:1']).toString('base64');
 await page.evaluate(url=>window.testVideoURL=url,square);
 const graph={nodes:[{id:'p',type:'prompt',x:20,y:20,data:{text:'Chuyển động nhẹ'}},{id:'v',type:'generateVideo',x:350,y:20,data:{provider:'muse',size:'9:16',duration:1}}],edges:[{id:'pv',source:'p',sourcePort:'text',target:'v',targetPort:'prompt'}]};
 await page.locator('#workflowFileInput').setInputFiles({name:'square.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(graph))});await page.waitForSelector('.node[data-id="v"]');await page.locator('.node[data-id="v"] .node-run-button.primary').click();await page.waitForFunction(()=>document.querySelector('.node[data-id="v"] .status.success'),{},{timeout:60000});await toolbarAction(page,'#saveBtn');await page.waitForFunction(()=>testStore.museflow?.nodes.find(n=>n.id==='v')?.data.asset);const result=await page.evaluate(()=>testStore.museflow.nodes.find(n=>n.id==='v').data);assert.equal(result.asset.sizeMismatch,false);assert.ok(Math.abs(result.asset.width/result.asset.height-9/16)<.01);assert.match(result.error,/480 × 480/);assert.match(result.error,/viền đệm/);assert.ok(result.endFrame?.url);
 const file=path.join(temp,'portrait.mp4');const mediaURL=await page.locator('.node[data-id="v"] video').getAttribute('src');const bytes=await page.evaluate(async url=>[...new Uint8Array(await (await fetch(url)).arrayBuffer())],mediaURL);writeFileSync(file,Buffer.from(bytes));const info=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','stream=codec_type,width,height:format=duration','-of','json',file],{encoding:'utf8'}));assert.ok(info.streams.some(x=>x.codec_type==='audio'));assert.ok(Math.abs(Number(info.format.duration)-1)<.15);const pixels=execFileSync('ffmpeg',['-v','error','-ss','0.3','-i',file,'-frames:v','1','-pix_fmt','rgb24','-f','rawvideo','pipe:1'],{maxBuffer:4*1024*1024});const width=result.asset.width,height=result.asset.height,at=(x,y)=>[...pixels.subarray((y*width+x)*3,(y*width+x)*3+3)];assert.ok(at(Math.floor(width/2),20).every(x=>x<15),'Top padding is black');const center=at(Math.floor(width/2),Math.floor(height/2));assert.ok(center[0]>200&&center[1]<30,'Original image remains in center');assert.deepEqual(errors,[]);console.log('PASS square Muse output automatically reframed to 9:16 MP4; no aspect-ratio failure, full image retained with padding, audio/duration/end frame preserved. Provider response mocked; FFmpeg real.');
 }finally{rmSync(temp,{recursive:true,force:true});}
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
