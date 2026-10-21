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
  const store={};window.testStore=store;window.testMessages=[];window.testDownloads=[];
  const storage={get:async key=>({[key]:structuredClone(store[key])}),set:async value=>Object.assign(store,structuredClone(value))};
  window.chrome={downloads:{download:async options=>{testDownloads.push(options);return 1;}},runtime:{id:'test',getManifest:()=>({version:'0.6.0'}),getURL:p=>location.origin+'/'+p},storage:{local:storage,session:{get:async()=>({}),set:async()=>{}}},scripting:{executeScript:async()=>{}},tabs:{query:async()=>[{id:1,active:true,url:'https://gemini.google.com/app'}],sendMessage:async(id,msg)=>{window.testMessages.push(msg);if(msg.type==='WORKFLOW_AI_STOP'){window.testPending?.({ok:false,error:'Stopped'});return {ok:true};}if(window.testDelayNext&&msg.type==='WORKFLOW_AI_GENERATE'){window.testDelayNext=false;return new Promise(resolve=>{window.testPending=resolve;});}if(msg.mediaType==='image')return {ok:true,url:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='};if(msg.type.includes('CHECK'))return {ok:true,signedIn:true,composer:true};return {ok:true,text:'Kịch bản mới từ video gốc'};},create:async()=>{},onUpdated:{addListener(){}},onCreated:{addListener(){}}}};
 });
 await page.goto(origin+'/app.html');await page.waitForSelector('.node');
 assert.equal(await page.locator('.node').count(),3);await page.click('#packageUpdateBtn');const downloads=await page.evaluate(()=>testDownloads);assert.equal(downloads.length,1);assert.ok(downloads[0].url.startsWith('https://raw.githubusercontent.com/mktminhqpbga-glitch/workflow/main/downloads/Workflow-extension.zip'));assert.equal(downloads[0].saveAs,true);
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
 await page.click('#scriptImportBtn');await page.fill('#scriptAIPrompt','Viết kịch bản hai cảnh');await page.click('#scriptAIButton');await page.waitForFunction(()=>document.querySelector('#scriptInput').value==='Kịch bản mới từ video gốc');const script=await page.evaluate(()=>testMessages.filter(m=>m.type==='WORKFLOW_AI_GENERATE').at(-1));assert.ok(script.rules.includes('CẢNH'));
 await page.evaluate(()=>{window.testDelayNext=true;});await page.click('#scriptAIButton');await page.waitForFunction(()=>!!window.testPending);await page.click('#scriptAIButton');await page.waitForFunction(()=>document.querySelector('#scriptImportStatus').textContent==='Đã dừng tạo kịch bản.');
 assert.equal(await page.evaluate(()=>testMessages.filter(m=>m.type==='WORKFLOW_AI_STOP').length),1,'Script cancellation must also stop the provider tab');await page.click('#cancelScriptImport');
 const chained={nodes:[{id:'cp',type:'prompt',x:20,y:20,data:{text:'Viết prompt ảnh'}},{id:'ct',type:'generateText',x:350,y:20,data:{provider:'gemini'}},{id:'ci',type:'generateImage',x:700,y:20,data:{provider:'gemini',size:'1:1'}}],edges:[{id:'ce1',source:'cp',sourcePort:'text',target:'ct',targetPort:'prompt'},{id:'ce2',source:'ct',sourcePort:'text',target:'ci',targetPort:'prompt'}]};
 await page.locator('#workflowFileInput').setInputFiles({name:'chain.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(chained))});await page.waitForSelector('.node[data-id="ci"]');await page.locator('.node[data-id="ci"] .node-run-button').click();await page.waitForFunction(()=>document.querySelector('.node[data-id="ci"] .status').classList.contains('success'));const imageRequest=await page.evaluate(()=>testMessages.findLast(m=>m.mediaType==='image'));assert.equal(imageRequest.prompt.includes('Kịch bản mới từ video gốc'),true);await page.click('#saveBtn');await page.waitForFunction(()=>testStore.museflow?.nodes.find(n=>n.id==='ci')?.data.asset?.url);assert.equal((await page.evaluate(()=>testStore.museflow.nodes.find(n=>n.id==='ct').data.text)),'Kịch bản mới từ video gốc');
 // Exercise the bundled FFmpeg WASM with real, locally generated video/audio.
 const {execFileSync}=require('node:child_process');const {mkdtempSync,readFileSync,rmSync}=require('node:fs');const temp=mkdtempSync(path.join(require('node:os').tmpdir(),'workflow-video-test-'));
 try {
  const assets=[];
  for(let i=0;i<2;i++){const output=path.join(temp,`clip${i}.mp4`);execFileSync('ffmpeg',['-v','error','-f','lavfi','-i',`color=c=${i?'blue':'red'}:s=${i?'160x120':'160x90'}:r=24:d=1`,'-f','lavfi','-i',`sine=frequency=${i?880:440}:duration=1`,'-shortest','-c:v','libx264','-threads','1','-pix_fmt','yuv420p','-c:a','aac','-ar','48000','-ac','2','-y',output]);assets.push('data:video/mp4;base64,'+readFileSync(output).toString('base64'));}
  const timeline={nodes:assets.map((url,i)=>({id:'clip'+i,type:'generateVideo',x:20+i*350,y:20,data:{status:'success',duration:1,size:'16:9',asset:{id:'asset'+i,kind:'video',url}}})),edges:[]};timeline.nodes.push({id:'tl',type:'timeline',x:0,y:0,data:{dockOnly:true,clipOrder:['clip0','clip1'],durations:{clip0:1,clip1:1}}});
  await page.locator('#workflowFileInput').setInputFiles({name:'timeline.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(timeline))});await page.waitForSelector('.node[data-id="clip1"]');await page.selectOption('#timelineExportFormat','mp4');
  const download=page.waitForEvent('download',{timeout:60000});await page.click('#timelineExportBtn');const file=await download;assert.equal(await file.failure(),null);const output=await file.path();const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','stream=codec_type,codec_name:format=duration','-of','json',output],{encoding:'utf8'}));
  assert.ok(probe.streams.some(s=>s.codec_type==='video'&&s.codec_name==='h264'));assert.ok(probe.streams.some(s=>s.codec_type==='audio'&&s.codec_name==='aac'));assert.ok(Number(probe.format.duration)>=1.9&&Number(probe.format.duration)<2.5);console.log('PASS actual FFmpeg WASM export: two different-size clips, H.264 + AAC, ~2s output.');
 }finally{rmSync(temp,{recursive:true,force:true});}
 assert.deepEqual(errors,[]);console.log('PASS UI: node creation, duration options, connections, import, text generation, original-video transport, rerun, save; no page errors.');
 await page.screenshot({path:'/tmp/workflow-verified.png'});
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
