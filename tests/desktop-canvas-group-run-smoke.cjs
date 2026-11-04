/* The real canvas runner uses one selected tab for the complete group; AI replies are fixtures. */
'use strict';
const {_electron:electron}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'mooz-canvas-group-'));let app;
 try{
  const env={...process.env,WORKFLOW_DESKTOP_TEST:'1',WORKFLOW_TEST_DATA:root};delete env.ELECTRON_RUN_AS_NODE;
  app=await electron.launch({args:['--no-sandbox',path.resolve(__dirname,'..')],env,timeout:60000});const home=await app.firstWindow();home.setDefaultTimeout(20000);await home.waitForSelector('#newProject');const project=await home.evaluate(()=>workflowHome.createProject('One group one tab')),opened=app.waitForEvent('window');await home.evaluate(id=>workflowHome.openProject(id),project.id);const page=await opened;page.setDefaultTimeout(20000);const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.waitForFunction(()=>!!window.MooZCanvasStudio);await page.evaluate(()=>MooZCanvasStudio.ready);
  const graph={nodes:[{id:'source',type:'prompt',x:40,y:100,data:{text:'Đầu vào của nhóm'}},{id:'first',type:'generateText',x:400,y:100,data:{provider:'muse',text:''}},{id:'second',type:'generateText',x:800,y:100,data:{provider:'gemini',text:''}}],edges:[{id:'one',source:'source',sourcePort:'text',target:'first',targetPort:'prompt'},{id:'two',source:'first',sourcePort:'text',target:'second',targetPort:'prompt'}]};
  await page.setInputFiles('#workflowFileInput',{name:'group.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(graph))});await page.waitForSelector('.node[data-id=second]');
  await page.evaluate(()=>{
   window.groupFixture={sent:[],tabs:[{id:8,title:'Chosen Gemini',url:'https://gemini.google.com/app/chosen'},{id:9,title:'Other Gemini',url:'https://gemini.google.com/app/other'}]};
   chrome.tabs.query=async()=>groupFixture.tabs.slice();chrome.tabs.get=async id=>groupFixture.tabs.find(t=>t.id===id);chrome.scripting.executeScript=async()=>[{result:true}];
   chrome.tabs.sendMessage=async(id,message)=>{
    if(message.type==='WORKFLOW_AI_CHECK'||message.type==='MUSEFLOW_CHECK_SESSION')return {ok:true,composer:true,signedIn:true,busy:false};
    if(message.type==='WORKFLOW_AI_GENERATE'){groupFixture.sent.push({id,message:structuredClone(message)});groupFixture.tabs.reverse();return {ok:true,text:groupFixture.sent.length===1?'Nội dung bước một':'Kết quả bước hai'};}
    return {ok:true};
   };
  });
  const empty=await page.evaluate(async()=>{try{await MooZCanvasStudio.action('runSelection',{ids:['source']});return '';}catch(e){return e.message;}});assert.match(empty,/bước xử lý/);assert.equal((await page.evaluate(()=>MooZCanvasStudio.snapshot())).tasks.length,0,'Inputs alone cannot create a successful task');
  const mixed=await page.evaluate(async()=>{try{await MooZCanvasStudio.action('runSelection',{ids:['second']});return '';}catch(e){return e.message;}});assert.match(mixed,/nhiều AI/);assert.equal(await page.evaluate(()=>groupFixture.sent.length),0);
  await page.evaluate(()=>MooZCanvasStudio.action('setFlowAI',{ids:['second'],provider:'gemini',chatTarget:{tabId:8,url:'https://gemini.google.com/app/chosen'}}));
  await page.evaluate(()=>MooZCanvasStudio.select(['source','first','second']));await page.waitForSelector('#canvasStudioContext:not([hidden])');await page.click('#canvasStudioEdit');await page.waitForFunction(()=>document.querySelector('#canvasStudioFlowTab')?.value==='chrome:8'&&!document.querySelector('#canvasStudioFlowTab').disabled);assert.match(await page.locator('#canvasStudioFlowTab option:checked').innerText(),/Chosen Gemini/,'Saved tab remains selected as connected when the group inspector reopens');await page.click('#canvasStudioInspectorClose');
  await page.evaluate(()=>MooZCanvasStudio.action('runSelection',{ids:['second']}));
  const result=await page.evaluate(()=>({calls:groupFixture.sent,state:MooZCanvasStudio.snapshot()}));assert.equal(result.calls.length,2);assert.deepEqual(result.calls.map(c=>c.id),[8,8],'Changing tab list order cannot move the second step');assert.ok(result.calls.every(c=>c.message.chatTarget.tabId===8));assert.match(result.calls[1].message.prompt,/Nội dung bước một/);assert.equal(result.state.nodes.find(n=>n.id==='first').data.text,'Nội dung bước một');assert.equal(result.state.nodes.find(n=>n.id==='second').data.text,'Kết quả bước hai');assert.equal(result.state.isRunning,false);assert.equal(result.state.tasks[0].status,'success');assert.deepEqual(result.state.tasks[0].nodeIds.sort(),['first','second','source']);assert.deepEqual(errors,[]);
  await page.evaluate(()=>WorkflowDesktopLifecycle.flush());await page.reload();await page.waitForFunction(()=>!!window.MooZCanvasStudio);await page.evaluate(()=>MooZCanvasStudio.ready);const restored=await page.evaluate(()=>MooZCanvasStudio.snapshot());assert.equal(restored.nodes.find(n=>n.id==='second').data.text,'Kết quả bước hai');assert.equal(restored.isRunning,false);assert.equal(restored.tasks[0].status,'success');
  console.log('PASS canvas group runner: mixed-provider group rejected before send; one provider and selected tab8 retained across two real runner steps despite tab order changes; second step receives first output; successful results persist after reload. Browser AI transport mocked, no paid or network AI call.');
 }finally{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});await fs.rm(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
