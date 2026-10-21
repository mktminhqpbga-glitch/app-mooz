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
  const store={};window.testStore=store;window.generates=[];window.pending=new Map();window.stops=[];window.early=[];window.busyTabs=new Set();
  const tabs=[{id:1,url:'https://gemini.google.com/app/a',title:'Gemini A'},{id:2,url:'https://chatgpt.com/c/b',title:'GPT B'},{id:3,url:'https://muse.ai/chat',title:'Muse'}];
  window.chrome={runtime:{id:'test',getManifest:()=>({version:'0.10.0'}),getURL:p=>location.origin+'/'+p,onMessage:{addListener:fn=>window.progressListener=fn}},storage:{local:{get:async key=>({[key]:store[key]}),set:async value=>Object.assign(store,value)},session:{get:async()=>({}),set:async()=>{}}},scripting:{executeScript:async()=>[]},tabs:{query:async filter=>tabs.filter(tab=>filter.url.some(pattern=>new URL(tab.url).hostname.includes(pattern.includes('gemini')?'gemini.google.com':pattern.includes('chatgpt')||pattern.includes('openai')?'chatgpt.com':'muse.ai'))),get:async id=>tabs.find(tab=>tab.id===id),update:async id=>({id}),onUpdated:{addListener(){}},onCreated:{addListener(){}},sendMessage:async(id,msg)=>{
   if(msg.type.includes('CHECK')&&window.checkFailure===id)return {ok:true,signedIn:false,composer:false};
   if(msg.type.includes('CHECK'))return {ok:true,signedIn:true,composer:true,busy:busyTabs.has(id)};
   if(msg.type==='WORKFLOW_AI_SEND_NOW'){early.push(msg.requestId);return {ok:true};}
   if(msg.type.includes('STOP')){stops.push(msg.requestId);const job=pending.get(msg.requestId);if(job){pending.delete(msg.requestId);job.resolve({ok:false,error:'Stopped'});}return {ok:true};}
   if(msg.type.includes('GENERATE')){generates.push({id,msg});return new Promise(resolve=>pending.set(msg.requestId,{id,msg,resolve}));}return {ok:false};
  }}};
  window.finish=(label,text)=>{const job=[...pending.values()].find(job=>job.msg.prompt.includes(label));if(!job)throw Error('Missing pending '+label);pending.delete(job.msg.requestId);job.resolve(job.msg.mediaType==='image'?{ok:true,url:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='}:{ok:true,text:text||label+' result'});};
 });
 await page.goto(origin+'/app.html');await page.waitForSelector('.node');assert.equal(await page.locator('#buyCoffeeBtn,#donationModal').count(),0);await page.keyboard.press('Escape');
 const node=(id,type,data,x,y=20)=>({id,type,data,x,y}),edge=(a,b)=>({id:a+'-'+b,source:a,sourcePort:'text',target:b,targetPort:'prompt'});
 const target=provider=>({tabId:provider==='gemini'?1:provider==='chatgpt'?2:3,url:provider==='gemini'?'https://gemini.google.com/app/a':provider==='chatgpt'?'https://chatgpt.com/c/b':'https://muse.ai/chat'});
 const graph=(providers=['gemini','chatgpt'])=>({nodes:providers.flatMap((provider,i)=>[node('p'+i,'prompt',{text:'JOB-'+i},20,i*340+20),node('n'+i,'generateText',{provider,chatTarget:target(provider),sendMode:'delay'},350+i*330)]),edges:providers.map((_,i)=>edge('p'+i,'n'+i))});
 async function load(value){await page.locator('#workflowFileInput').setInputFiles({name:'parallel.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});await page.waitForFunction(expected=>document.querySelectorAll('.node.generate').length===expected,value.nodes.filter(n=>['generateText','generateImage'].includes(n.type)).length);await page.evaluate(()=>{generates=[];stops=[];early=[];busyTabs.clear();});}
 const run=id=>page.locator(`.node[data-id="${id}"] .node-run-button.primary`).click();
 const success=id=>page.waitForSelector(`.node[data-id="${id}"] .status.success`);
 const idle=()=>page.waitForFunction(()=>!document.querySelector('#runBtn').textContent.includes('Dừng tất cả'));

 const chip=provider=>page.locator(`.ai-health-chip[data-provider="${provider}"]`);
 await page.waitForFunction(()=>document.querySelector('.ai-health-chip[data-provider="gemini"]')?.dataset.state==='ready');
 assert.equal(await chip('chatgpt').getAttribute('data-state'),'ready');
 const chain={nodes:[node('p','prompt',{text:'ROOT'},20),node('a','generateText',{provider:'gemini',chatTarget:target('gemini'),text:'STALE A'},350),node('b','generateText',{provider:'chatgpt',chatTarget:target('chatgpt'),text:'STALE B'},680),node('c','generateImage',{provider:'muse',chatTarget:target('muse'),size:'1:1'},1010),node('d-p','prompt',{text:'INDEPENDENT'},20,400),node('d','generateText',{provider:'chatgpt',chatTarget:target('chatgpt')},680,400)],edges:[edge('p','a'),edge('a','b'),edge('b','c'),edge('d-p','d')]};
 await load(chain);await page.click('#runBtn');await page.waitForFunction(()=>pending.size===2);
 assert.deepEqual((await page.evaluate(()=>generates.map(g=>g.msg.prompt))).sort(),['INDEPENDENT','ROOT']);
 assert.equal(await chip('gemini').getAttribute('data-state'),'busy');assert.equal(await chip('chatgpt').getAttribute('data-state'),'busy');
 assert.equal(await page.locator('.node[data-id="b"] .node-run-button').isDisabled(),true);
 assert.ok((await page.evaluate(()=>generates)).every(g=>g.msg.stageBeforeSend===false));
 await page.evaluate(()=>finish('ROOT','FRESH A'));await success('a');
 await page.waitForFunction(()=>document.querySelector('.node[data-id="b"] .status').textContent.includes('Đang đợi lượt'));
 assert.equal(await page.evaluate(()=>generates.length),2,'Same GPT tab must queue downstream B until D completes');
 await page.evaluate(()=>finish('INDEPENDENT','D done'));await success('d');
 await page.waitForFunction(()=>generates.length===3&&pending.size===1);
 assert.equal(await page.evaluate(()=>generates[2].msg.prompt),'FRESH A');
 await page.evaluate(()=>finish('FRESH A','FRESH B'));await success('b');
 await page.waitForFunction(()=>generates.length===4&&pending.size===1);
 assert.ok((await page.evaluate(()=>generates[3].msg.prompt)).includes('FRESH B'));
 await page.evaluate(()=>finish('FRESH B'));await success('c');await idle();
 assert.equal(await chip('gemini').getAttribute('data-state'),'ready');assert.equal(await chip('chatgpt').getAttribute('data-state'),'ready');assert.equal(await chip('muse').getAttribute('data-state'),'ready');
 assert.equal(await page.locator('.node[data-id="a"] textarea').inputValue(),'FRESH A');
 assert.equal(await page.locator('.node[data-id="b"] textarea').inputValue(),'FRESH B');
 assert.equal(await page.evaluate(()=>generates.length),4,'Every producer runs once, ignoring stale saved output');
 await load(chain);await page.click('#runBtn');await page.waitForFunction(()=>pending.size===2);
 await page.evaluate(()=>{const job=[...pending.values()].find(job=>job.msg.prompt==='ROOT');pending.delete(job.msg.requestId);job.resolve({ok:false,error:'HTTP 500 simulated service failure'});});
 await page.waitForSelector('.node[data-id="a"] .status.error');
 await page.evaluate(()=>finish('INDEPENDENT'));await idle();
 assert.equal(await page.evaluate(()=>generates.length),2,'Failed root blocks descendants but independent branch finishes');
 assert.equal(await chip('gemini').getAttribute('data-state'),'error');
 await page.click('#checkAllAIBtn');await page.waitForFunction(()=>document.querySelector('.ai-health-chip[data-provider="gemini"]').dataset.state==='ready');
 await page.evaluate(()=>window.checkFailure=2);await page.click('#checkAllAIBtn');await page.waitForFunction(()=>document.querySelector('.ai-health-chip[data-provider="chatgpt"]').dataset.state==='check');await page.evaluate(()=>window.checkFailure=null);
 await load(chain);await page.click('#runBtn');await page.waitForFunction(()=>pending.size===2);await page.click('#runBtn');await idle();
 assert.equal(await page.evaluate(()=>pending.size),0);assert.equal(await page.evaluate(()=>generates.length),2,'Stop All prevents queued descendants from starting');
 await load(graph());await page.click('#runOptionsBtn');await page.waitForSelector('#runOrderModal:not(.hidden)');await page.click('#confirmRunOrderBtn');await page.waitForFunction(()=>pending.size===1);assert.equal(await page.evaluate(()=>generates[0].msg.prompt),'JOB-0');await page.evaluate(()=>finish('JOB-0'));await page.waitForFunction(()=>generates.length===2&&pending.size===1);assert.equal(await page.evaluate(()=>generates[1].msg.prompt),'JOB-1');await page.evaluate(()=>finish('JOB-1'));await idle();
 assert.deepEqual(errors,[]);console.log('PASS Run All: automatic DAG progression, parallel roots, FIFO same-tab, fresh text forwarded, no manual sends/picks, blocked failed descendants, Stop All, provider health states.');
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
