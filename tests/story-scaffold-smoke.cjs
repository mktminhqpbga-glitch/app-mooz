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

 const n=(id,type,x,data={})=>({id,type,x,y:50,data}),e=(id,source,target,targetPort='text')=>({id,source,sourcePort:'text',target,targetPort});
 async function load(nodes,edges=[]){await page.locator('#workflowFileInput').setInputFiles({name:'story-scaffold.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({nodes,edges}))});await page.waitForSelector('.node[data-id="manual-act"]');}
 const scope=id=>page.locator(`.node[data-id="${id}"]`),action=(id,text)=>scope(id).getByRole('button',{name:text,exact:true}).evaluate(b=>b.click());
 async function graph(){await toolbarAction(page,'#saveBtn');return page.evaluate(()=>structuredClone(testStore.museflow));}
 await load([n('manual-act','actScript',400)]);
 assert.match(await scope('manual-act').innerText(),/chưa thuộc kịch bản tổng/);
 assert.equal(await scope('manual-act').getByRole('button',{name:'Về kịch bản tổng',exact:true}).isEnabled(),false);
 assert.equal(await scope('manual-act').getByRole('button',{name:'Thêm kịch bản tổng',exact:true}).isEnabled(),true);
 await action('manual-act','Thêm kịch bản tổng');await page.waitForFunction(()=>[...document.querySelectorAll('.node-title')].some(el=>el.textContent==='Kịch bản tổng'));
 await load([n('master','masterScript',40),n('manual-act','actScript',400,{customName:'Hồi của tôi'}),n('manual-part','partScript',750),n('manual-segment','segmentScript',1100),n('manual-prompt','storyPrompt',1450),n('keep','storyPrompt',1800,{text:'Không được thay nội dung này'})],[e('ma','master','manual-act'),e('ap','manual-act','manual-part'),e('ps','manual-part','manual-segment'),e('sp','manual-segment','manual-prompt','context')]);
 await page.waitForSelector('.node[data-id="master"]');
 assert.equal(await scope('manual-segment').getByRole('button',{name:'Về kịch bản tổng',exact:true}).isEnabled(),true);
 await action('manual-segment','Về kịch bản tổng');assert.ok((await scope('master').boundingBox()).x>=0);
 await action('manual-part','Tạo cấu trúc từ kịch bản tổng');await page.waitForFunction(()=>document.querySelector('#runStatus').textContent.includes('Nhập kịch bản tổng trước'));
 let saved=await graph();assert.equal(saved.nodes.filter(n=>n.type!=='timeline').length,6);assert.ok(saved.nodes.every(n=>!n.data.storyMasterId),'Invalid input does not partly adopt scaffolds');
 const script='HỒI 1: Ra đường\nPHẦN 1: Buổi sáng\nĐOẠN 1: Khởi đầu\nCẢNH 1 (0:00–0:06): Bước ra cửa\nPrompt ảnh: Người đàn ông trước cửa nhà.\nPrompt video: Anh bước ra ngoài.';
 await scope('master').locator('textarea[aria-label="Kịch bản tổng"]').fill(script);
 await action('manual-part','Tạo cấu trúc từ kịch bản tổng');await page.waitForFunction(()=>!!document.querySelector('.node[data-id="manual-act"] textarea'));
 saved=await graph();
 for(const id of ['manual-act','manual-part','manual-segment','manual-prompt'])assert.equal(saved.nodes.find(n=>n.id===id).data.storyMasterId,'master','Use the existing empty connected node');
 assert.equal(saved.nodes.find(n=>n.id==='manual-act').data.customName,'Hồi của tôi');
 assert.equal(saved.nodes.find(n=>n.id==='keep').data.text,'Không được thay nội dung này');
 assert.equal(saved.nodes.filter(n=>n.type==='actScript').length,1);assert.equal(saved.nodes.filter(n=>n.type==='partScript').length,1);assert.equal(saved.nodes.filter(n=>n.type==='segmentScript').length,1);
 assert.equal(new Set(saved.edges.map(e=>[e.source,e.sourcePort,e.target,e.targetPort].join(':'))).size,saved.edges.length);
 assert.equal(saved.nodes.filter(n=>n.type==='generateImage').length,1);assert.equal(saved.nodes.filter(n=>n.type==='generateVideo').length,1);assert.equal(saved.nodes.filter(n=>n.type==='videoAssembly').length,3);
 for(const id of ['manual-act','manual-part','manual-segment']){
  const group=saved.nodes.find(n=>n.id===id);assert.ok(group.data.assemblyId);assert.ok(group.data.text.length);assert.equal(await scope(id).getByRole('button',{name:/Chạy .* này/}).isEnabled(),true);assert.equal(await scope(id).getByRole('button',{name:/Tải video/}).isEnabled(),false);
 }
 assert.equal(await page.evaluate(()=>testMessages.filter(m=>m.type==='WORKFLOW_AI_GENERATE'||m.type==='MUSEFLOW_GENERATE').length),0);
 await page.keyboard.press('Control+z');saved=await graph();assert.equal(saved.nodes.filter(n=>n.type!=='timeline').length,6);assert.ok(!saved.nodes.find(n=>n.id==='manual-act').data.storyMasterId);assert.equal(saved.nodes.find(n=>n.id==='master').data.script,script);assert.equal(saved.edges.length,4);assert.deepEqual(errors,[]);
 const preserved=structuredClone(saved);preserved.nodes.find(n=>n.id==='manual-act').data.text='Nội dung hồi tự nhập cần giữ';preserved.nodes.find(n=>n.id==='master').data.script=script.replace('Ra đường','Bản 2');
 await page.locator('#workflowFileInput').setInputFiles({name:'keep-authored.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(preserved))});await page.waitForFunction(()=>document.querySelector('.node[data-id="master"] textarea')?.value.includes('Bản 2'));
 await action('master','Tạo node cho các hồi');await page.waitForFunction(()=>document.querySelectorAll('.node video').length===0&&[...document.querySelectorAll('.node-title')].some(el=>el.textContent.includes('Hồi/Chương 1')));
 saved=await graph();assert.equal(saved.nodes.find(n=>n.id==='manual-act').data.text,'Nội dung hồi tự nhập cần giữ');assert.ok(!saved.nodes.find(n=>n.id==='manual-act').data.storyMasterId);assert.equal(saved.nodes.filter(n=>n.type==='actScript').length,2);assert.equal(await scope('manual-act').getByRole('button',{name:'Xem node đã tạo',exact:true}).isEnabled(),true);assert.deepEqual(errors,[]);
 console.log('PASS story scaffold UI: missing-parent guidance, ancestor navigation, empty-script validation without partial mutation, reuses connected empty hierarchy IDs, preserves authored text/names, creates image-to-video and assemblies, enables scoped Run, downloads locked until output, no AI on build, one-step undo.');
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
