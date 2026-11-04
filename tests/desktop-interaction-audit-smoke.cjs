/* Actual Electron views and production IPC. Invalid credentials only; no external posts or AI calls. */
'use strict';
const {_electron:electron}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');

(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'mooz-interactions-'));
 const review=path.join(process.env.MOOZ_UI_AUDIT_DIR||'/tmp/mooz-0614-audit','interactions');
 let app;
 const errors=[],checks=[];
 try{
  await fs.mkdir(review,{recursive:true});
  const env={...process.env,WORKFLOW_DESKTOP_TEST:'1',WORKFLOW_TEST_DATA:root};
  delete env.ELECTRON_RUN_AS_NODE;
  app=await electron.launch({args:['--no-sandbox',path.resolve(__dirname,'..')],env,timeout:60000});
  const home=await app.firstWindow();
  await home.waitForSelector('#newProject');
  const pages={};
  for(const [name,method]of [['posting','openPosting'],['batch','openBatch'],['affiliate','openAffiliate']]){
   const pending=app.waitForEvent('window');
   await app.evaluate((_,method)=>workflowTest[method](),method);
   const page=pages[name]=await pending;
   page.setDefaultTimeout(20000);
   page.on('pageerror',error=>errors.push(error.message));
   await page.waitForLoadState();
  }
  const activate=key=>home.evaluate(key=>workflowDesktop.call('workspace.activate',{key}),key);
  const resize=(width,height)=>app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(...size),[width,height]);
  const {posting,batch,affiliate}=pages;
  await activate('posting');
  await posting.click('#postingConnections');
  await posting.selectOption('#postingTransport','webhook');
  await posting.fill('#postingWebhookURL','not a URL');
  await posting.selectOption('#postingTransport','facebook');
  assert.equal(await posting.locator('#postingWebhookURL').isDisabled(),true);
  await posting.click('#postingConnectionSubmit');
  await posting.waitForFunction(()=>document.querySelector('#postingConnectionError').textContent.includes('Page ID'));
  assert.match(await posting.locator('#postingConnectionError').innerText(),/token/);
  assert.equal(await posting.locator('#facebookManualFields').getAttribute('open'),'');
  checks.push('Invalid hidden webhook URL cannot block Facebook submission; manual fields and explanation appear.');
  await posting.screenshot({path:path.join(review,'facebook-feedback.png')});

  for(const type of ['youtube','instagram','tiktok','storage','muse','webhook']){
   await posting.selectOption('#postingTransport',type);
   assert.equal(await posting.locator('#postingConnectionError').textContent(),'','Old errors clear when changing transport');
   const fields=await posting.locator('[data-transport]').evaluateAll(sections=>sections.map(s=>({type:s.dataset.transport,hidden:s.hidden,disabled:[...s.querySelectorAll('input,select,textarea,button')].every(f=>f.disabled)})));
   assert.ok(fields.every(s=>s.type===type?!s.hidden:s.hidden&&s.disabled),'Only the current transport has active inputs');
   await posting.click('#postingConnectionSubmit');
   await posting.waitForFunction(()=>{const e=document.querySelector('#postingConnectionError');return e.textContent.trim()&&!e.textContent.includes('Đang kiểm tra');});
   assert.equal(await posting.locator('#postingConnectionError').isVisible(),true);
   assert.equal(await posting.locator('#postingConnectionSubmit').isEnabled(),true);
   assert.equal(await posting.locator('#postingTransport').isEnabled(),true);
   assert.doesNotMatch(await posting.locator('#postingConnectionError').textContent(),/Đã kết nối/);
   checks.push(type+': missing/invalid setup gives visible feedback and releases the button.');
  }
  assert.equal(await posting.inputValue('#postingWebhookURL'),'not a URL','Switching transports preserves unfinished input');
  await posting.click('#postingConnectionClose');
  await posting.waitForFunction(()=>document.querySelector('#postingWebhookURL').value==='');
  assert.equal(await posting.inputValue('#postingWebhookURL'),'','Closing clears secrets');
  await posting.click('#postingConnections');
  assert.equal(await posting.locator('#postingConnectionError').textContent(),'','Reopening clears stale feedback');
  await posting.click('#postingConnectionClose');

  for(const [width,height]of [[1500,850],[1100,650],[1008,600],[640,650]]){
   await resize(width,height);
   await activate('batch');
   if(width>1050){
    const bounds=await batch.locator('.brand span').evaluate(e=>{const r=e.getBoundingClientRect(),brand=e.closest('.brand').getBoundingClientRect();return {left:r.left,right:r.right,brandLeft:brand.left,brandRight:brand.right};});
    assert.ok(bounds.left>=bounds.brandLeft&&bounds.right<=bounds.brandRight+1,'Batch tagline fits the whole brand row');
    await batch.screenshot({path:path.join(review,'batch-brand-'+width+'.png')});
   }
   await activate('affiliate');
   await affiliate.selectOption('#sourceMode','chrome');
   await affiliate.waitForFunction(()=>!document.querySelector('#refreshShopeeTabs').disabled);
   assert.equal(await affiliate.locator('#create').isDisabled(),true);
   assert.equal(await affiliate.locator('#create').getAttribute('title'),null,'Disabled reason has no native tooltip covering its text');
   assert.match(await affiliate.locator('#sourceActionHelp').innerText(),/tab sản phẩm/);
   await affiliate.locator('#shopeeTab').scrollIntoViewIfNeeded();
   await affiliate.click('#shopeeTab');
   await affiliate.keyboard.press('Escape');
   const hit=await affiliate.locator('#shopeeTab').evaluate(e=>{const r=e.getBoundingClientRect();return document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)===e;});
   assert.equal(hit,true,'Source action footer must not cover the product tab picker');
   await affiliate.click('#refreshShopeeTabs');
   await affiliate.waitForFunction(()=>!document.querySelector('#refreshShopeeTabs').disabled);
   if(width>820){
    const bounds=await affiliate.locator('.affiliate-source-actions').evaluate(e=>{const r=e.getBoundingClientRect(),scroll=document.querySelector('.affiliate-intake-scroll');return {top:r.top,bottom:r.bottom,height:innerHeight,scrollBottom:scroll.getBoundingClientRect().bottom};});
    assert.ok(bounds.bottom<=bounds.height+1,'Affiliate action and reason remain in the viewport');
    assert.ok(bounds.scrollBottom<=bounds.top+1,'Source fields scroll above, never underneath, the action footer');
   }else{
    await affiliate.locator('#sourceActionHelp').scrollIntoViewIfNeeded();
    const bounds=await affiliate.locator('#sourceActionHelp').boundingBox();
    assert.ok(bounds.y+bounds.height<=await affiliate.evaluate(()=>innerHeight)+1,'Mobile source reason is fully reachable by scrolling');
   }
   await affiliate.screenshot({path:path.join(review,'affiliate-source-'+width+'.png')});
   checks.push(width+'px: source picker and refresh are clickable, action reason reachable, footer does not cover controls.');
  }
  await resize(1200,750);
  await affiliate.selectOption('#sourceMode','public');
  await affiliate.fill('#productLink','https://shopee.vn/product/123/456');
  assert.equal(await affiliate.locator('#create').isEnabled(),true);
  await affiliate.fill('#productLink','');
  assert.equal(await affiliate.locator('#create').isDisabled(),true);
  assert.match(await affiliate.locator('#sourceActionHelp').innerText(),/Nhập link/);
  const originalPauseLabel=await affiliate.locator('#pause').innerText();
  await affiliate.click('#pause');
  await affiliate.waitForFunction(label=>document.querySelector('#pause').textContent!==label,originalPauseLabel);
  await affiliate.click('#pause');
  await affiliate.waitForFunction(label=>document.querySelector('#pause').textContent===label,originalPauseLabel);
  await affiliate.click('#affiliateExample');
  await affiliate.waitForSelector('#affiliateExampleDialog[open]');
  await affiliate.locator('#affiliateExampleDialog button').click();
  assert.equal(await affiliate.locator('#affiliateExampleDialog').getAttribute('open'),null);
  checks.push('Affiliate source gating, pause/resume and example open/close change real UI state.');
  assert.deepEqual(errors,[]);
  await fs.writeFile(path.join(review,'checks.json'),JSON.stringify({checks,rendererErrors:errors,liveAI:false,livePublication:false},null,2));
  console.log('PASS Electron interaction audit: '+checks.length+' checks; all seven connection modes, hidden invalid fields, source controls/footer, Batch brand and four viewport sizes. No live AI or publication. '+review);
 }catch(error){
  for(const page of app?.windows()||[]){if(page.url().includes('affiliate.html')){await page.screenshot({path:path.join(review,'affiliate-failure.png')}).catch(()=>{});console.error('Affiliate failure:',await page.evaluate(()=>({message:document.querySelector('#message').textContent,pause:document.querySelector('#pause').outerHTML,queue:document.querySelector('#queueState').textContent})));}}
  throw error;
 }finally{
  await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});
  await app?.close().catch(()=>{});
  await fs.rm(root,{recursive:true,force:true});
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
