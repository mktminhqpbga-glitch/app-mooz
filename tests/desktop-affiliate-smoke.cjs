/* Native UI, parser, image decoder, storage and queue; Shopee/AI are fixtures. */
const {_electron:electron}=require('playwright'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {affiliate,image,sourceHTML,answer}=require('./fixtures/affiliate-fixture.cjs');
(async()=>{
 const data=await fs.mkdtemp(path.join(os.tmpdir(),'workflow-affiliate-ui-'));let application;
 try{
  const env={...process.env,WORKFLOW_DESKTOP_TEST:'1',WORKFLOW_TEST_DATA:data};delete env.ELECTRON_RUN_AS_NODE;
  application=await electron.launch({args:['--no-sandbox',path.resolve(__dirname,'..')],env,timeout:60000});
  const home=await application.firstWindow();await home.waitForSelector('#aiAppsAffiliate');
  const answers=['Lập hồ sơ JSON','Đề xuất 3 góc','Viết 3–5 cảnh','Kiểm tra từng cảnh'].map(key=>({key,value:answer(key)}));
  await application.evaluate((_args,{sourceHTML,image,answers})=>{
   const t=globalThis.workflowTest;t.affiliateCalls=0;t.postCalls=0;t.posting.publisher.fetch=async()=>{t.postCalls++;throw Error('No social request expected');};
   t.postingAI.tabs=async()=>[{id:991,transport:'native',title:'ChatGPT · Affiliate fixture',url:'https://chatgpt.com/c/affiliate'}];
   t.postingAI.ask=async(_job,prompt,_target,_signal,options)=>{if(!options.rules.includes('JSON'))throw Error('Lost JSON rule');t.affiliateCalls++;return JSON.stringify(answers.find(a=>prompt.includes(a.key)).value);};
   t.affiliate.fetchImpl=async url=>url.includes('blocked')?new Response('Denied',{status:403}):url.includes('s.shopee.vn')?new Response(null,{status:302,headers:{location:'https://shopee.vn/product/123/456'}}):url.includes('/product/')?new Response(sourceHTML,{headers:{'content-type':'text/html'}}):new Response(Buffer.from(image.split(',')[1],'base64'),{headers:{'content-type':'image/png'}});
  },{sourceHTML,image,answers});
  const promise=application.waitForEvent('window');await home.click('#aiAppsAffiliate');const studio=await promise;studio.setDefaultTimeout(25000);const errors=[];studio.on('pageerror',e=>errors.push(e.message));await studio.waitForSelector('#productLink');
  await studio.fill('#productLink',affiliate);await studio.click('#create');await studio.waitForSelector('#storySetup:visible');assert.equal(await application.evaluate(()=>globalThis.workflowTest.affiliateCalls),0);await studio.selectOption('#chatTarget','native:991');await studio.click('#generateStory');await studio.waitForSelector('#buildWorkflow').catch(async error=>{console.log(await studio.locator('#detail').innerText(),await studio.locator('#message').innerText());console.log(await application.evaluate(async()=>globalThis.workflowTest.affiliate.snapshot()));throw error;});
  assert.equal(await studio.locator('.scene').count(),3);assert.equal(await studio.locator('.images img').count(),1);assert.ok((await studio.inputValue('#affiliateCaption')).endsWith(affiliate));assert.equal(await studio.locator('#includeVoice').isChecked(),false);assert.equal(await application.evaluate(()=>globalThis.workflowTest.affiliateCalls),4);
  const original=await studio.evaluate(async()=> (await workflowDesktop.call('affiliate.snapshot')).jobs[0].id);const saved=await studio.evaluate(id=>workflowDesktop.call('affiliate.get',{id}),original);assert.match(saved.product.images[0],/^workflow:\/\/app\/affiliate-media\//);const decoded=await studio.evaluate(async url=>[...new Uint8Array(await (await fetch(url)).arrayBuffer()).slice(0,2)],saved.product.images[0]);assert.deepEqual(decoded,[255,216],'Actual Electron decoder writes JPEG bytes');
  for(const [width,height]of [[1000,700],[1420,950]]){await studio.setViewportSize({width,height});assert.equal(await studio.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await studio.locator('#buildWorkflow').scrollIntoViewIfNeeded();assert.equal(await studio.locator('#buildWorkflow').isVisible(),true);}
  await studio.screenshot({path:'/tmp/workflow-affiliate-studio.png',fullPage:true});await studio.locator('.workspace').evaluate(node=>node.scrollTop=0);await studio.screenshot({path:'/tmp/workflow-affiliate-overview.png'});
  await studio.check('#includeVoice');const canvasPromise=application.waitForEvent('window');await studio.click('#buildWorkflow');const canvas=await canvasPromise;canvas.setDefaultTimeout(25000);canvas.on('pageerror',e=>errors.push(e.message));await canvas.waitForSelector('.node[data-type="voiceSync"]');
  assert.equal(await canvas.locator('.node[data-type="generateVideo"]').count(),3);assert.equal(await canvas.locator('.node[data-type="voiceover"]').count(),3);assert.equal(await canvas.locator('.node[data-type="imageInput"]').count(),3);assert.equal(await canvas.locator('.node').count(),14,'No unrelated starter nodes');
  // Rendering precedes the IndexedDB/project-file commit. Assert the durable
  // snapshot only after the host operation has acknowledged its save.
  await studio.waitForFunction(()=>document.querySelector('#message').textContent.includes('Đã mở workflow'));
  const graph=await canvas.evaluate(async()=> (await chrome.storage.local.get('museflow')).museflow);assert.equal(graph.edges.filter(e=>e.targetPort==='reference').length,3);assert.equal(graph.nodes.find(n=>n.type==='voiceSync').data.affiliateCaption,saved.caption);assert.ok(graph.nodes.every(n=>n.data.status!=='running'));
  await studio.click('#buildWorkflow');assert.equal((await home.evaluate(()=>workflowHome.listProjects())).length,1);assert.equal(await canvas.locator('.node').count(),14,'Repeated opening must not create duplicate nodes/projects');
  await studio.reload();await studio.waitForSelector('#buildWorkflow');assert.equal(await studio.inputValue('#affiliateCaption'),saved.caption);
  await assert.rejects(()=>home.evaluate(()=>workflowDesktop.call('affiliate.create',{url:'https://s.shopee.vn/test'})),/Mở ứng dụng Affiliate/);
  // Restore a completed local video snapshot to test the same final-node handoff a user clicks.
  const video=await fs.readFile(path.join(__dirname,'fixtures/posting-sample.mp4'));
  const result={nodes:[{id:'affiliate-final',type:'voiceSync',x:40,y:40,data:{customName:'Affiliate hoàn chỉnh',affiliateCaption:saved.caption,status:'success',asset:{id:'result',kind:'video',url:'data:video/mp4;base64,'+video.toString('base64')}}}],edges:[]};
  await canvas.evaluate(async graph=>{await WorkflowDesktopLifecycle.flush();await chrome.storage.local.set({museflow:graph});},result);await canvas.reload();await canvas.waitForSelector('.node[data-id="affiliate-final"] video');
  const postingPromise=application.waitForEvent('window');await canvas.locator('.node[data-id="affiliate-final"] button').filter({hasText:'Thêm vào hàng chờ'}).click();const posting=await postingPromise;await posting.waitForSelector('.post-card textarea');assert.equal(await posting.locator('.post-card textarea').first().inputValue(),saved.caption);assert.equal(await application.evaluate(()=>globalThis.workflowTest.postCalls),0);
  const queued=await application.evaluate(async()=> (await globalThis.workflowTest.posting.store.list())[0]);assert.equal(queued.status,'draft');assert.equal(queued.caption,saved.caption);assert.equal(queued.autoPublish,false);
  // A later source failure remains visible and does not invoke any AI step.
  await studio.fill('#productLink','https://s.shopee.vn/blocked');await studio.click('#create');await studio.waitForSelector('.error-box');assert.match(await studio.locator('.error-box').innerText(),/403/);assert.equal(await application.evaluate(()=>globalThis.workflowTest.affiliateCalls),4);
  assert.deepEqual(errors,[]);console.log('PASS Electron Affiliate Shopee: app catalog → parsed source + native image decode → four validated AI phases → responsive storyboard → idempotent 14-node video/voice workflow → preserved tracking URL/content in durable posting draft; blocked source visible, no extra AI call, no social post. Providers mocked.');
 }finally{await application?.close();await fs.rm(data,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
