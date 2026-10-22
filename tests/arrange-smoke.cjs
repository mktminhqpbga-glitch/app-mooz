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

 const graph={nodes:[{id:'p',type:'prompt',x:500,y:500,data:{text:'Write script'}},{id:'t',type:'generateText',x:500,y:500,data:{provider:'gemini'}},{id:'v',type:'generateVideo',x:500,y:500,data:{provider:'muse'}},{id:'q',type:'prompt',x:500,y:500,data:{text:'Other input'}},{id:'a',type:'imageInput',x:500,y:500,data:{}}],edges:[{id:'e1',source:'p',sourcePort:'text',target:'t',targetPort:'prompt'},{id:'e2',source:'t',sourcePort:'text',target:'v',targetPort:'prompt'},{id:'e3',source:'q',sourcePort:'text',target:'v',targetPort:'prompt'}]};
 await page.locator('#workflowFileInput').setInputFiles({name:'layout.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(graph))});await page.waitForSelector('.node[data-id="v"]');await toolbarAction(page,'#arrangeNodesBtn');await page.waitForFunction(()=>document.querySelector('#runStatus').textContent.includes('Đã sắp xếp 5 node'));
 const boxes=await page.locator('.node').evaluateAll(nodes=>nodes.map(el=>({id:el.dataset.id,x:parseFloat(el.style.left),y:parseFloat(el.style.top),w:el.offsetWidth,h:el.offsetHeight})));const box=id=>boxes.find(b=>b.id===id);assert.ok(box('p').x<box('t').x&&box('t').x<box('v').x);assert.ok(box('q').x<box('v').x);for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y,'Overlapping '+a.id+' and '+b.id);}
 await page.waitForFunction(()=>testStore.museflow?.nodes.find(n=>n.id==='p')?.x===70);await page.keyboard.press('Control+z');await page.waitForFunction(()=>[...document.querySelectorAll('.node')].every(n=>parseFloat(n.style.left)===500&&parseFloat(n.style.top)===500));assert.deepEqual(errors,[]);console.log('PASS quick layout: toolbar button, dependency direction, variable-sized nodes do not overlap, autosave, undo restores original positions.');
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
