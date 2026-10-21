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
 await page.addInitScript(()=>{
  const store={};window.testStore=store;window.testMessages=[];
  const storage={get:async key=>({[key]:structuredClone(store[key])}),set:async value=>Object.assign(store,structuredClone(value))};
  window.chrome={runtime:{id:'test',getManifest:()=>({version:'0.6.0'}),getURL:p=>location.origin+'/'+p},storage:{local:storage,session:{get:async()=>({}),set:async()=>{}}},scripting:{executeScript:async()=>{}},tabs:{query:async()=>[{id:1,active:true,url:'https://gemini.google.com/app'}],sendMessage:async(id,msg)=>{window.testMessages.push(msg);if(msg.type.includes('CHECK'))return {ok:true,signedIn:true,composer:true};return {ok:true,text:'Kịch bản mới từ video gốc'};},create:async()=>{},onUpdated:{addListener(){}},onCreated:{addListener(){}}}};
 });
 await page.goto(origin+'/app.html');await page.waitForSelector('.node');
 assert.equal(await page.locator('.node').count(),3);
 for(const type of ['generateText','videoInput','generateVideo']){await page.click('#addNodeMenuBtn');await page.click(`[data-add="${type}"]`);}
 assert.equal(await page.locator('.node').count(),6);
 assert.deepEqual(await page.locator('.video-controls select').nth(1).locator('option').allTextContents(),['4s','5s','6s','8s','10s','15s','20s','30s','60s']);
 await page.click('#settingsBtn');await page.waitForFunction(()=>document.querySelector('#aiConnections').innerText.includes('chưa nhập khóa'));
 assert.equal(await page.locator('#apiSettings input[type="password"]').count(),3);
 await page.click('#closeSettingsBtn');
 // Import a graph and run text generation through the UI, including an original video.
 const workflow={nodes:[{id:'p',type:'prompt',x:20,y:20,data:{text:'Phân tích video gốc'}},{id:'v',type:'videoInput',x:20,y:400,data:{localDataUrl:'data:video/mp4;base64,AQID'}},{id:'t',type:'generateText',x:430,y:20,data:{provider:'gemini'}}],edges:[{id:'e1',source:'p',sourcePort:'text',target:'t',targetPort:'prompt'},{id:'e2',source:'v',sourcePort:'video',target:'t',targetPort:'video'}]};
 await page.locator('#workflowFileInput').setInputFiles({name:'workflow.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'26flow-workflow',version:1,workflow}))});
 await page.waitForSelector('.node[data-id="t"]');
 await page.locator('.node[data-id="t"] .node-run-button').click();
 await page.waitForFunction(()=>document.querySelector('.node[data-id="t"] textarea').value==='Kịch bản mới từ video gốc');
 const sent=await page.evaluate(()=>testMessages.find(m=>m.type==='WORKFLOW_AI_GENERATE'));
 assert.deepEqual(sent.referenceVideos,['data:video/mp4;base64,AQID']);assert.deepEqual(sent.referenceImages,[]);
 assert.equal(sent.prompt,'Phân tích video gốc');
 // Run again: previous output is replaced, not appended.
 await page.locator('.node[data-id="t"] .node-run-button').click();await page.waitForFunction(()=>testMessages.filter(m=>m.type==='WORKFLOW_AI_GENERATE').length===2);
 await page.waitForFunction(()=>document.querySelector('.node[data-id="t"] textarea').value==='Kịch bản mới từ video gốc');
 await page.click('#saveBtn');await page.waitForFunction(()=>testStore.museflow?.nodes.find(n=>n.id==='t')?.data.text==='Kịch bản mới từ video gốc');
 assert.equal(JSON.stringify(await page.evaluate(()=>testStore.museflow)).includes('workflowApiKeys'),false);
 await page.click('#scriptImportBtn');await page.fill('#scriptAIPrompt','Viết kịch bản hai cảnh');await page.click('#scriptAIButton');await page.waitForFunction(()=>document.querySelector('#scriptInput').value==='Kịch bản mới từ video gốc');const script=await page.evaluate(()=>testMessages.filter(m=>m.type==='WORKFLOW_AI_GENERATE').at(-1));assert.ok(script.rules.includes('CẢNH'));await page.click('#cancelScriptImport');
 assert.deepEqual(errors,[]);console.log('PASS UI: node creation, duration options, connections, import, text generation, original-video transport, rerun, save; no page errors.');
 await page.screenshot({path:'/tmp/workflow-verified.png'});
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
