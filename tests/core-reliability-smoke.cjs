/* Browser regressions with simulated extension APIs; no signed-in AI is used. */
const assert=require('node:assert/strict');
const {createServer}=require('node:http');
const {readFile}=require('node:fs/promises');
const path=require('node:path');
const {toolbarAction}=require('./toolbar-actions.cjs');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require('playwright-core'));}

(async()=>{
 const root=path.resolve(__dirname,'..');
 const server=createServer(async(req,res)=>{try{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+path.sep))throw Error();const data=await readFile(file);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(data);}catch{res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const errors=[];
 const node=(id,type,data={},x=20)=>({id,type,data,x,y:20});
 const edge=(source,target)=>({id:source+'-'+target,source,sourcePort:'text',target,targetPort:'prompt'});
 async function open(graph,{readFailure=false}={}){
  const context=await browser.newContext({viewport:{width:1500,height:950}}),page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://**/*',route=>route.fulfill({status:404,body:''}));
  await page.addInitScript(({graph,readFailure})=>{
   const saved=sessionStorage.getItem('reliability-store');const store=saved?JSON.parse(saved):{museflow:graph};
   window.testStore=store;window.workflowWrites=0;window.testGenerates=[];
   const tab={id:7,url:'https://gemini.google.com/app/test',title:'Gemini test'};
   window.chrome={runtime:{id:'test',getManifest:()=>({version:'0.29.0'}),getURL:p=>location.origin+'/'+p,onMessage:{addListener(){}}},storage:{local:{get:async key=>{if(readFailure&&key==='museflow')throw Error('Storage temporarily unavailable');return {[key]:structuredClone(store[key])};},set:async value=>{if('museflow' in value)workflowWrites++;Object.assign(store,structuredClone(value));sessionStorage.setItem('reliability-store',JSON.stringify(store));}},session:{get:async()=>({}),set:async()=>{}}},scripting:{executeScript:async()=>[]},tabs:{query:async filter=>filter.url.some(url=>url.includes('gemini'))?[tab]:[],get:async()=>tab,update:async()=>tab,onUpdated:{addListener(){}},onCreated:{addListener(){}},sendMessage:async(id,message)=>{if(message.type.includes('CHECK'))return {ok:true,composer:true,signedIn:true};if(message.type==='WORKFLOW_AI_GENERATE'){testGenerates.push(message);return {ok:true,text:'Fresh result'};}return {ok:true};}}};
  },{graph,readFailure});
  await page.goto(origin+'/app.html');
  return {page,context};
 }
 try{
  const graph={nodes:[node('photo','imageInput',{localDataUrl:'museflow-idb:input%3Aphoto',fileName:'saved.png'}),node('prompt','prompt',{text:'Keep this graph'},350)],edges:[]};
  let {page,context}=await open(graph);
  await page.waitForFunction(()=>document.querySelector('#runStatus').textContent.includes('Bản lưu trước chưa bị thay thế'));
  assert.equal(await page.locator('.node[data-id="prompt"] textarea').inputValue(),'Keep this graph');
  assert.equal(await page.evaluate(()=>workflowWrites),0,'Missing IDB media must not overwrite the original workflow');
  assert.deepEqual(await page.evaluate(()=>testStore.museflow),graph);
  await page.locator('.node[data-id="prompt"] textarea').fill('Unsaved edit');
  await page.waitForTimeout(900); // Let the 650ms autosave debounce fire; the original recovery error stays visible.
  assert.equal(await page.evaluate(()=>workflowWrites),0,'Autosave must remain blocked after failed hydration');
  assert.deepEqual(await page.evaluate(()=>testStore.museflow),graph);
  // Repair the missing asset and verify that reloading restores the original graph.
  await page.evaluate(async()=>{const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('museflow-media',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});await new Promise((resolve,reject)=>{const tx=db.transaction('assets','readwrite');tx.objectStore('assets').put(new Blob(['restored'],{type:'image/png'}),'input:photo');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();});
  await page.reload();await page.waitForFunction(()=>workflowWrites>0);
  assert.equal(await page.locator('.node[data-id="prompt"] textarea').inputValue(),'Keep this graph');
  assert.equal(await page.evaluate(()=>testStore.museflow.nodes.find(n=>n.id==='photo').data.localDataUrl),'museflow-idb:input%3Aphoto');
  await context.close();
  console.log('PASS missing-media recovery preserves graph and pointers, blocks autosave, and recovers on reload');

  ({page,context}=await open(graph,{readFailure:true}));
  await page.waitForFunction(()=>document.querySelector('#runStatus').textContent.includes('Storage temporarily unavailable'));
  assert.equal(await page.locator('.node').count(),0,'An unreadable save must not be replaced by the starter graph');
  assert.equal(await page.evaluate(()=>workflowWrites),0);
  page.once('dialog',dialog=>dialog.dismiss());await toolbarAction(page,'#saveBtn');
  assert.equal(await page.evaluate(()=>workflowWrites),0,'Declining explicit recovery save preserves the old snapshot');
  page.once('dialog',dialog=>dialog.accept());await toolbarAction(page,'#saveBtn');
  await page.waitForFunction(()=>workflowWrites===1);
  assert.deepEqual(await page.evaluate(()=>testStore.museflow.nodes.filter(node=>!node.data?.dockOnly)),[],'Explicitly confirmed save can replace an unreadable snapshot');
  await context.close();
  console.log('PASS failed storage reads protect prior save until an explicit confirmed replacement');

  ({page,context}=await open({nodes:[],edges:[]}));
  await page.waitForFunction(()=>workflowWrites>0);
  assert.equal(await page.locator('.node').count(),0,'An intentionally empty saved canvas must stay empty');
  await context.close();
  console.log('PASS intentionally empty saved canvases survive reload');

  const cyclic={nodes:[node('source','prompt',{text:'Independent branch'}),node('good','generateText',{provider:'gemini'},350),node('cycle-a','generateText',{provider:'gemini'},680),node('cycle-b','generateText',{provider:'gemini'},1010)],edges:[edge('source','good'),edge('cycle-a','cycle-b'),edge('cycle-b','cycle-a')]};
  ({page,context}=await open(cyclic));
  await page.waitForSelector('.node[data-id="good"]');
  await page.locator('.node[data-id="good"] .node-run-button.primary').click();
  await page.waitForSelector('.node[data-id="good"] .status.success');
  assert.equal(await page.evaluate(()=>testGenerates.length),1,'An unrelated cycle must not prevent a valid independent selected node');
  await page.locator('.node[data-id="cycle-a"] .node-run-button.primary').click();
  await page.waitForFunction(()=>document.querySelector('#runStatus').textContent.includes('cycle'));
  assert.equal(await page.evaluate(()=>testGenerates.length),1,'Cycles in the selected dependency graph must still prevent any AI request');
  await context.close();
  console.log('PASS selected branches ignore unrelated cycles but reject cycles in their own dependencies');

  const pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  const imageGraph={nodes:[node('p','prompt',{text:'Generate the current image'}),node('image','generateImage',{provider:'muse',size:'9:16',status:'error',error:'Previous Muse failure',asset:{id:'old',kind:'image',url:pixel}},350)],edges:[edge('p','image')]};
  ({page,context}=await open(imageGraph));await page.waitForSelector('.node[data-id="image"] img');
  const imageNode=page.locator('.node[data-id="image"]'),provider=()=>imageNode.getByLabel('AI thực hiện',{exact:true});
  await provider().selectOption('gemini');assert.equal(await imageNode.locator('img').count(),0,'Changing provider clears the previous provider output');assert.equal(await imageNode.locator('.status.error').count(),0);
  await provider().selectOption('muse');
  await page.evaluate(()=>{
    window.imageGenerates=[];window.museStarts=0;window.currentBridge=false;
    const gemini={id:7,url:'https://gemini.google.com/app/test',title:'Gemini'},muse={id:8,url:'https://muse.ai/chat/test',title:'Muse'};
    chrome.tabs.query=async filter=>filter.url.some(url=>url.includes('muse.ai'))?[muse]:filter.url.some(url=>url.includes('gemini'))?[gemini]:[];
    chrome.tabs.get=async id=>id===7?gemini:muse;
    chrome.tabs.sendMessage=async(id,message)=>{
      if(message.type==='MUSEFLOW_CHECK_SESSION')return {ok:true,composer:true,signedIn:true,busy:true,bridgeVersion:'0.31.0',bridgeProtocol:1,jobProtocol:1};
      if(message.type==='MUSEFLOW_JOB_START'||message.type==='MUSEFLOW_GENERATE'){museStarts++;throw Error('Old Muse bridge must not receive generation');}
      if(message.type==='WORKFLOW_AI_CHECK')return {ok:true,composer:true,signedIn:true,busy:!currentBridge,bridgeVersion:currentBridge?'0.12.0':'0.11.0',...(currentBridge?{resultProtocol:2,backgroundProtocol:1}:{})};
      if(message.type==='WORKFLOW_AI_GENERATE'){imageGenerates.push(message);return new Promise(resolve=>window.finishImage=resolve);}
      return {ok:true};
    };
  });
  await imageNode.locator('.node-run-button.primary').click();await imageNode.locator('.status.error').waitFor({timeout:20000});
  assert.match(await imageNode.locator('.status.error').innerText(),/0\.31\.0.*tải lại tab/i);assert.equal(await page.evaluate(()=>museStarts),0,'Stale busy Muse must fail before submitting or waiting for the old job');
  await provider().selectOption('gemini');await imageNode.locator('.node-run-button.primary').click();await imageNode.locator('.status.error').waitFor({timeout:20000});
  assert.match(await imageNode.locator('.status.error').innerText(),/0\.11\.0.*tải lại tab/i);assert.equal(await page.evaluate(()=>imageGenerates.length),0);
  await page.evaluate(()=>window.currentBridge=true);await imageNode.locator('.node-run-button.primary').click();await page.waitForFunction(()=>imageGenerates.length===1,{},{timeout:20000});
  assert.equal(await provider().isDisabled(),true,'The active request provider cannot change mid-flight');
  await provider().evaluate(select=>{select.value='muse';select.dispatchEvent(new Event('change',{bubbles:true}));});
  assert.equal(await provider().inputValue(),'gemini','Programmatic change events also preserve the active provider');
  await page.evaluate(url=>finishImage({ok:true,url}),pixel);await imageNode.locator('.status.success').waitFor({timeout:20000});
  assert.equal(await provider().isDisabled(),false);assert.equal(await page.evaluate(()=>imageGenerates.length),1);assert.equal(await page.evaluate(()=>museStarts),0);
  await context.close();
  console.log('PASS stale bridge preflight before busy waits, no prompt sent to old Muse/Gemini, provider lock during generation, stale output reset on provider change and new result accepted');
  assert.deepEqual(errors,[],'No uncaught browser errors');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
