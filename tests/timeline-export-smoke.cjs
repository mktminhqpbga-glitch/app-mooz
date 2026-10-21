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

 const {execFileSync}=require('node:child_process');
 const images=await page.evaluate(()=>['red','blue'].map(color=>{const canvas=document.createElement('canvas');canvas.width=160;canvas.height=90;canvas.getContext('2d').fillStyle=color;canvas.getContext('2d').fillRect(0,0,160,90);return canvas.toDataURL();}));
 const graph={nodes:images.map((url,i)=>({id:'image'+i,type:'imageInput',x:20+i*350,y:20,data:{localDataUrl:url,customName:'Scene '+i}})),edges:[]};
 async function load(value){await page.locator('#workflowFileInput').setInputFiles({name:'timeline.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});await page.waitForSelector('.node[data-id="image0"]');}
 await load(graph);await page.click('#timelineAddVideoBtn');await page.locator('#timelineOutputMenu button').first().click();await page.click('#timelineAddVideoBtn');await page.locator('#timelineOutputMenu button').first().click();
 if(await page.locator('#timelineDock').evaluate(el=>el.classList.contains('collapsed')))await page.click('#timelineToggleBtn');
 assert.equal(await page.locator('.dock-clip').count(),2);
 for(const [id,duration] of [['image0','1'],['image1','2']]){await page.locator(`.dock-clip[data-clip="${id}"] input`).fill(duration);await page.locator(`.dock-clip[data-clip="${id}"] input`).dispatchEvent('change');}
 await page.evaluate(()=>{const dt=new DataTransfer();dt.setData('application/x-museflow-video-node','image1');document.querySelector('.dock-clip[data-clip="image0"]').dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:dt}));});
 assert.deepEqual(await page.locator('.dock-clip').evaluateAll(nodes=>nodes.map(n=>n.dataset.clip)),['image1','image0']);
 await page.click('#timelinePlayBtn');await page.waitForSelector('#timelineStill:not([hidden])');assert.equal(await page.locator('#timelineStill').getAttribute('src'),images[1]);await page.click('#closeTimelinePreview');
 const downloads=[];page.on('download',file=>downloads.push(file));async function waitDownloads(expected){if(downloads.length<expected)await page.waitForEvent('download',{predicate:()=>downloads.length>=expected,timeout:5000});}
 const probe=file=>JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','stream=codec_type,codec_name:format=duration','-of','json',file],{encoding:'utf8'}));
 async function waitDone(){await page.waitForFunction(()=>!document.querySelector('#timelineExportBtn').disabled,{},{timeout:60000});}
 await page.selectOption('#timelineExportFormat','mp4');let pending=page.waitForEvent('download',{timeout:60000});await page.click('#timelineExportBtn');let file=await pending;await waitDone();let output=await file.path(),info=probe(output);assert.ok(info.streams.some(s=>s.codec_name==='h264'));assert.ok(Number(info.format.duration)>=2.9&&Number(info.format.duration)<3.3);
 const color=time=>execFileSync('ffmpeg',['-v','error','-ss',String(time),'-i',output,'-frames:v','1','-vf','scale=1:1','-pix_fmt','rgb24','-f','rawvideo','pipe:1']);let pixel=color(.5);assert.ok(pixel[2]>pixel[0]+100,'Blue image must appear first after reordering');pixel=color(2.5);assert.ok(pixel[0]>pixel[2]+100,'Red image must appear second');
 const start=downloads.length;await page.click('#timelineExportSingleBtn');await page.waitForFunction(()=>document.querySelector('#runStatus').textContent.includes('Đã xuất riêng 2 clip'),{},{timeout:60000});await waitDownloads(start+2);assert.equal(downloads.length,start+2);for(let i=0;i<2;i++){const file=downloads[start+i];assert.ok(file.suggestedFilename().startsWith(String(i+1).padStart(2,'0')+'-'));const duration=Number(probe(await file.path()).format.duration);assert.ok(Math.abs(duration-(i===0?2:1))<.3);}
 await page.selectOption('#timelineExportFormat','webm');pending=page.waitForEvent('download',{timeout:60000});await page.click('#timelineExportBtn');file=await pending;await waitDone();info=probe(await file.path());assert.ok(info.streams.some(s=>s.codec_name==='vp8'));assert.ok(Math.abs(Number(info.format.duration)-3)<.3);
 const beforeStop=downloads.length;await page.click('#timelineExportSingleBtn');await page.waitForSelector('#timelineExportStopBtn:not(.hidden)');await page.click('#timelineExportStopBtn');await waitDone();await page.waitForTimeout(300);assert.equal(downloads.length,beforeStop,'Stop batch must prevent remaining downloads');

 const videoData=['yellow','green'].map(color=>'data:video/mp4;base64,'+execFileSync('ffmpeg',['-v','error','-f','lavfi','-i',`color=c=${color}:s=160x90:r=24:d=1`,'-f','lavfi','-i','sine=frequency=440:duration=1','-shortest','-c:v','libx264','-threads','1','-pix_fmt','yuv420p','-c:a','aac','-ar','48000','-ac','2','-f','mp4','-movflags','frag_keyframe+empty_moov','pipe:1']).toString('base64'));
 const mixed={nodes:[graph.nodes[0],...videoData.map((url,i)=>({id:'video'+i,type:'generateVideo',x:350+i*350,y:20,data:{status:'success',duration:1,asset:{kind:'video',url}}})),{id:'tl',type:'timeline',x:0,y:0,data:{dockOnly:true,clipOrder:['video0','image0','video1'],durations:{video0:1,image0:1,video1:1}}}],edges:[]};
 await load(mixed);await page.waitForSelector('.node[data-id="video1"]');assert.equal(await page.locator('.dock-clip').count(),3);
 await page.selectOption('#timelineExportFormat','mp4');pending=page.waitForEvent('download',{timeout:60000});await page.click('#timelineExportBtn');file=await pending;await waitDone();info=probe(await file.path());assert.ok(Math.abs(Number(info.format.duration)-3)<.3);assert.ok(info.streams.some(s=>s.codec_name==='aac'));
 const mixedStart=downloads.length;await page.click('#timelineExportSingleBtn');await page.waitForFunction(()=>document.querySelector('#runStatus').textContent.includes('Đã xuất riêng 3 clip'),{},{timeout:60000});await waitDownloads(mixedStart+3);assert.equal(downloads.length,mixedStart+3);for(const file of downloads.slice(mixedStart)){const info=probe(await file.path());assert.ok(Math.abs(Number(info.format.duration)-1)<.3);assert.ok(info.streams.some(s=>s.codec_name==='h264'));}
 assert.deepEqual(errors,[]);console.log('PASS timeline: add image inputs, duration edits, reorder, still preview, real FFmpeg MP4/WebM slideshow, frame colors verify order, individual files/durations, batch cancellation.');
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
