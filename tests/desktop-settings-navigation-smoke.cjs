/* Real Electron settings navigation. No API requests, browser pairing or social publication. */
'use strict';
const {_electron:electron}=require('playwright'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'mooz-settings-review-')),out=path.join(process.env.MOOZ_UI_AUDIT_DIR||'/tmp/mooz-067','settings');let app;
 const errors=[],checks=[];
 try{
  await fs.mkdir(out,{recursive:true});const env={...process.env,WORKFLOW_DESKTOP_TEST:'1',WORKFLOW_TEST_DATA:root};delete env.ELECTRON_RUN_AS_NODE;
  app=await electron.launch({args:['--no-sandbox',path.resolve(__dirname,'..')],env,timeout:60000});app.on('window',page=>page.on('pageerror',e=>errors.push(e.message)));const home=await app.firstWindow();home.setDefaultTimeout(20000);await home.waitForSelector('#newProject');
  const project=await home.evaluate(()=>workflowHome.createProject('Settings review')),pages={home};
  for(const [name,method]of [['canvas','openProject'],['batch','openBatch'],['posting','openPosting'],['affiliate','openAffiliate']]){const opened=app.waitForEvent('window');await app.evaluate((_,v)=>workflowTest[v.method](...(v.method==='openProject'?[v.id]:[])),{method,id:project.id});pages[name]=await opened;}
  const activate=name=>home.evaluate(key=>workflowDesktop.call('workspace.activate',{key}),name==='home'?'home':name==='canvas'?project.id:name);
  for(const [name,page]of Object.entries(pages)){console.log('QA settings',name);
   page.setDefaultTimeout(20000);await activate(name);await page.waitForSelector('#connectionsOpen');await page.click('#connectionsOpen');await page.waitForSelector('#connectionsDialog[open]');
   assert.equal(await page.locator('#connectionsAPI').evaluate(e=>e.open),false,name+' API defaults collapsed');
   assert.equal(await page.locator('#aiDispatchPanel').evaluate(e=>e.open),false,name+' pacing defaults collapsed');
   assert.equal(await page.locator('#extensionManualGuide').evaluate(e=>e.open),false,name+' installation help defaults collapsed');
   await page.locator('#connectionsAPI>summary').click();await page.fill('#connectionName','Draft '+name);await page.fill('#connectionKey','fixture-not-submitted');
   await page.locator('#connectionsAPI>summary').click();assert.equal(await page.locator('#connectionName').isVisible(),false);await page.locator('#connectionsAPI>summary').click();assert.equal(await page.inputValue('#connectionName'),'Draft '+name);
   await page.click('#connectionsClose');await page.waitForFunction(()=>document.querySelector('#connectionKey').value==='');assert.equal(await page.inputValue('#connectionKey'),'','Closing settings clears the unsaved key');
   await page.click('#connectionsOpen');await page.click('#connectionsPair');
   const own=name==='canvas',batch=name==='batch',target=own||batch?page:home,dialog=own?'#canvasChromeDialog':'#chromeDialog',input=own?'#canvasChromePairing':batch?'#chromeCode':'#chromePairing';
   await target.waitForSelector(dialog+'[open]');assert.match(await target.inputValue(input),/^workflow-connect:\/\/127\.0\.0\.1:\d+\/[a-f0-9]{64}$/);
   assert.equal(await page.locator('#connectionsDialog').evaluate(e=>e.open),false);await target.locator(own?'#canvasChromeClose':batch?'#chromeDialog [data-close]':'#closeChrome').first().click();await target.waitForFunction(selector=>document.querySelector(selector).value==='',input);assert.equal(await target.inputValue(input),'','Closing pairing clears its code');checks.push(name+': compact defaults, preserved draft, cleared key and working Chrome pairing route');
  }
  // Editing an existing API configuration must reveal its collapsed form.
  await home.evaluate(()=>workflowDesktop.call('aiConnections.save',{name:'Saved review',model:'fixture-model',baseURL:'https://review.example/v1',vision:false}));await activate('home');await home.click('#connectionsOpen');
  await home.locator('#connectionsAPI').evaluate(e=>e.open=false);await home.locator('#connectionList button').filter({hasText:'Sửa'}).click();assert.equal(await home.locator('#connectionsAPI').evaluate(e=>e.open),true);assert.equal(await home.inputValue('#connectionName'),'Saved review');await home.click('#connectionsClose');
  await activate('canvas');await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1008,760));await home.evaluate(()=>workflowDesktop.call('appearance.save',{theme:'dark',size:'large',accent:'#9b87f5',colors:{}}));const canvas=pages.canvas;await canvas.waitForFunction(()=>document.documentElement.dataset.uiSize==='large');
  const header=await canvas.locator('.compact-toolbar').boundingBox();assert.ok(header.height<120,'Compact canvas header leaves room for canvas');await canvas.click('#canvasAISummary');assert.equal(await canvas.locator('#checkAllAIBtn').isVisible(),true);await canvas.locator('#canvasAISummary').press('Escape');assert.equal(await canvas.locator('#canvasAIStatus').evaluate(e=>e.open),false);await canvas.click('#canvasAISummary');await canvas.click('#saveBtn');assert.equal(await canvas.locator('#canvasAIStatus').evaluate(e=>e.open),false);await canvas.screenshot({path:path.join(out,'canvas-header-1008-large.png')});await activate('home');
  await activate('canvas');await pages.canvas.evaluate(()=>{const status=document.querySelector('#runStatus');status.classList.remove('error');status.textContent='Đã lưu.';});await pages.canvas.waitForFunction(()=>document.querySelector('.studio-run-notice').hidden);assert.equal(await pages.canvas.locator('.studio-run-notice').isVisible(),false,'Desktop save status is not repeated in a large notice');
  await pages.canvas.evaluate(()=>{const status=document.querySelector('#runStatus');status.classList.add('error');status.textContent='Lỗi kết quả cần kiểm tra.';});await pages.canvas.waitForFunction(()=>!document.querySelector('.studio-run-notice').hidden);assert.equal(await pages.canvas.locator('#runStatusDetails').isVisible(),true,'Error details remain accessible');await pages.canvas.evaluate(()=>{const status=document.querySelector('#runStatus');status.classList.remove('error');status.textContent='';});
  const styles=[];
  for(const theme of ['light','dark']){
   await home.evaluate(theme=>workflowDesktop.call('appearance.save',{theme,size:'standard',accent:'#9b87f5',colors:{}}),theme);await home.waitForFunction(theme=>document.documentElement.dataset.uiTheme===theme,theme);
   // Color transitions are intentional; inspect their settled value, not an in-between frame.
   await home.waitForTimeout(300);styles.push(await home.locator('#appearanceOpen').evaluate(e=>{const s=getComputedStyle(e);return {theme:document.documentElement.dataset.uiTheme,background:s.backgroundColor,color:s.color,panel:s.getPropertyValue('--mooz-panel')};}));
   await home.click('#connectionsOpen');assert.ok(await home.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await home.screenshot({path:path.join(out,'settings-'+theme+'.png')});await home.click('#connectionsClose');
  }
  assert.deepEqual(errors,[]);await fs.writeFile(path.join(out,'checks.json'),JSON.stringify({checks,styles,rendererErrors:errors,aiSubmissions:0},null,2));
  console.log('PASS settings: all five surfaces open actual Chrome pairing, collapsed setup/API/pacing, draft preserved, unsaved secrets cleared, editing API reveals its form, light/dark settings without horizontal overflow. No AI/API submission.');
 }finally{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});await fs.rm(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
