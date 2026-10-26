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
  window.chrome={downloads:{download:async options=>{testDownloads.push(options);return 1;}},runtime:{id:'test',getManifest:()=>({version:'0.6.0'}),getURL:p=>location.origin+'/'+p},storage:{local:storage,session:{get:async()=>{if(sessionFail)throw new Error('session unavailable');return {};},set:async()=>{}}},scripting:{executeScript:async options=>options.func&&window.testPickerResult?[{result:window.testPickerResult}]:[]},tabs:{update:async id=>{window.testTabActivated=id;return {id};},query:async()=>window.testTabs||[{id:1,active:true,url:'https://gemini.google.com/app'}],sendMessage:async(id,msg)=>{window.testMessages.push(msg);window.testTargets.push({id,type:msg.type});if(msg.type==='WORKFLOW_AI_CHECK'&&window.testRequireActivation&&window.testTabActivated!==id)return {ok:true,composer:false,signedIn:false};if(msg.type==='WORKFLOW_AI_CHECK'&&window.testUnavailableIds?.includes(id))return {ok:true,composer:false,signedIn:false};if(msg.type==='WORKFLOW_AI_USE_RESULT'){window.testPending?.({ok:true,text:msg.text});return {ok:true};}if(msg.type==='WORKFLOW_AI_STOP'){window.testPending?.({ok:false,error:'Stopped'});return {ok:true};}if(window.testDelayNext&&msg.type==='WORKFLOW_AI_GENERATE'){window.testDelayNext=false;return new Promise(resolve=>{window.testPending=resolve;});}if(msg.mediaType==='video'&&window.testVideoURL)return {ok:true,url:window.testVideoURL};if(msg.mediaType==='image')return {ok:true,url:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='};if(msg.type.includes('CHECK'))return {ok:true,signedIn:true,composer:true};return {ok:true,text:'Kịch bản mới từ video gốc'};},create:async()=>{},onUpdated:{addListener(){}},onCreated:{addListener(){}}}};
 },{sessionFail:!!process.env.FAIL_SESSION_STORAGE});
 await page.goto(origin+'/app.html');await page.waitForSelector('.node');assert.equal(await page.locator('#buyCoffeeBtn,#donationModal').count(),0);await page.keyboard.press('Escape');


 const {execFileSync}=require('node:child_process');const video='data:video/mp4;base64,'+execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=red:s=160x90:r=24:d=1','-c:v','libx264','-threads','1','-pix_fmt','yuv420p','-f','mp4','-movflags','frag_keyframe+empty_moov','pipe:1']).toString('base64');
 const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=16;return c.toDataURL();});
 const nodes=[{id:'v',type:'generateVideo',x:150,y:50,data:{provider:'muse',size:'9:16',duration:10,status:'success',error:'AI trả 480 × 480; đã thêm viền đệm để xuất 9:16, giữ toàn bộ hình gốc. Yêu cầu 10s, AI trả về 5.0s. Thời lượng clip phụ thuộc dịch vụ.',asset:{id:'video-1',kind:'video',url:video,width:480,height:854,actualDuration:5},endFrame:{id:'frame-1',sourceAssetId:'video-1',kind:'image',url:png}}},{id:'i',type:'generateImage',x:650,y:50,data:{provider:'gemini',size:'1:1',status:'success',asset:{id:'image-1',kind:'image',url:png}}},{id:'p',type:'prompt',x:1050,y:50,data:{text:'Generate'}}];
 const edges=[{id:'p1',source:'p',sourcePort:'text',target:'v',targetPort:'prompt'},{id:'p2',source:'p',sourcePort:'text',target:'i',targetPort:'prompt'},{id:'r',source:'i',sourcePort:'image',target:'v',targetPort:'reference'}];
 await page.locator('#workflowFileInput').setInputFiles({name:'compact.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({nodes,edges}))});await page.waitForSelector('.node[data-id="v"]');
 const v=page.locator('.node[data-id="v"]'),i=page.locator('.node[data-id="i"]');
 const originalHeight=(await v.boundingBox()).height;assert.ok(originalHeight<580,'Default video card must stay compact: '+originalHeight);assert.ok((await i.boundingBox()).height<500,'Image height '+(await i.boundingBox()).height+' '+JSON.stringify(await i.locator('.node-body').evaluate(el=>[...el.children].map(n=>({cls:n.className,text:n.textContent.slice(0,50),height:n.offsetHeight})))));
 assert.equal(await v.locator('.provider-controls>select').isVisible(),true);assert.equal(await v.locator('video').isVisible(),true);assert.equal(await v.locator('.node-run-button.primary').isVisible(),true);assert.equal(await v.getByRole('button',{name:'Tải ảnh khung cuối',exact:true}).isVisible(),false);assert.equal(await v.getByRole('button',{name:'Xóa kết quả cũ',exact:true}).isVisible(),false);
 const connection=v.locator('details[data-panel="connection"]');await connection.locator('summary').click();assert.equal(await v.getByRole('button',{name:'Làm mới danh sách chat',exact:true}).isVisible(),true);await v.locator('details[data-panel="connection"] summary').click();
 await v.locator('details[data-panel="frames"] summary').click();assert.equal(await v.getByRole('button',{name:'Tải ảnh khung cuối',exact:true}).isVisible(),true);assert.equal(await v.locator('.end-frame-thumb').isVisible(),true);await v.locator('details[data-panel="frames"] summary').click();assert.ok((await v.boundingBox()).height<580);
 await v.locator('details[data-panel="info"] summary').click();assert.match(await v.locator('.node-status-detail').innerText(),/480/);await v.locator('details[data-panel="info"] summary').click();
 await v.locator('details[data-panel="tools"] summary').click();await v.getByRole('button',{name:'Xóa kết quả cũ',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.node[data-id="v"] video'));assert.equal(await v.locator('details[data-panel="tools"]').getAttribute('open'),'');
 await page.screenshot({path:'/tmp/compact-generator.png'});assert.deepEqual(errors,[]);console.log('PASS compact generator cards: bounded default height, visible run/preview/basic settings, collapsed chat/frame/tools/details, native toggles, retained panel state across render, full diagnostics and functional output clearing.');
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
