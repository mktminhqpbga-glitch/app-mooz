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

 const graph={nodes:[{id:'img',type:'imageInput',x:20,y:20,data:{}},{id:'vid',type:'videoInput',x:350,y:20,data:{}},{id:'gen',type:'generateText',x:680,y:20,data:{provider:'gemini'}}],edges:[]};
 await page.locator('#workflowFileInput').setInputFiles({name:'media.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(graph))});await page.waitForSelector('.node[data-id="vid"]');
 const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=8;return c.toDataURL();});
 async function transfer(selector,kind='image',event='drop',count=1){await page.evaluate(async({selector,kind,event,count,png})=>{const bytes=await(await fetch(png)).arrayBuffer(),dt=new DataTransfer();for(let i=0;i<count;i++)dt.items.add(new File([bytes],kind==='video'?'clip.mp4':'photo.png',{type:kind==='video'?'video/mp4':'image/png'}));const target=document.querySelector(selector);target.dispatchEvent(event==='paste'?new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}):new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}));},{selector,kind,event,count,png});}
 await transfer('.node[data-id="img"] .node-body');await page.waitForSelector('.node[data-id="img"] img');assert.equal(await page.locator('.node[data-id="img"] img').getAttribute('src'),png);
 await transfer('.node[data-id="vid"] .node-body','video');await page.waitForSelector('.node[data-id="vid"] video');
 await transfer('.node[data-id="img"] .node-body','video');await page.waitForFunction(()=>document.querySelector('#runStatus').textContent.includes('Sai loại tệp'));assert.equal(await page.locator('.node[data-id="img"] img').getAttribute('src'),png);
 await transfer('.node[data-id="img"] .node-body','image','paste');await page.waitForFunction(()=>document.querySelector('#runStatus').textContent.includes('Đã thêm 1 tệp'));
 await transfer('.node[data-id="gen"] .port.in[data-port="reference"]','image','drop',2);await page.waitForFunction(()=>document.querySelector('.node[data-id="gen"] .port.in[data-port="reference"]')?.title.includes('2 connected'));
 await transfer('.node[data-id="gen"] .port.in[data-port="video"]','video');await page.waitForFunction(()=>document.querySelectorAll('.node video').length===2);
 const before=await page.locator('.node').count();await transfer('.node[data-id="gen"] textarea','image','paste');await page.waitForTimeout(100);assert.equal(await page.locator('.node').count(),before,'Paste in text editor must stay native');
 await transfer('#timelineDock','image','drop',2);await page.waitForFunction(()=>document.querySelectorAll('.dock-clip').length===2);
 await page.click('#saveBtn');await page.waitForFunction(()=>testStore.museflow?.nodes.filter(n=>n.type==='imageInput').length===5);assert.deepEqual(errors,[]);
 console.log('PASS media: image/video drops, clipboard image, wrong type preserves old file, multi-image references create connected nodes, original video port, text paste untouched, timeline file drops, persistence.');
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
