/* Run only after electron-builder creates the Windows package. No live AI calls. */
'use strict';
const {_electron: electron} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

(async () => {
  assert.equal(process.platform, 'win32', 'This check must run on a real Windows runner.');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mooz-win-package-'));
  const review = process.env.MOOZ_UI_AUDIT_DIR || path.join(root, 'review');
  const exe = process.env.MOOZ_INSTALLED_EXE||path.resolve('dist/win-unpacked/MooZ Agent.exe');
  const userData=process.env.MOOZ_WINDOWS_USER_DATA||path.join(root,'data');
  const version = require('../package.json').version;
  const env = {...process.env};
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.WORKFLOW_DESKTOP_TEST;
  delete env.WORKFLOW_TEST_DATA;
  let application;
  async function launch() {
    application = await electron.launch({
      executablePath: exe,
      args: ['--disable-gpu', '--user-data-dir=' + userData],
      env,
      timeout: 60000
    });
    const home = await application.firstWindow();
    home.setDefaultTimeout(25000);await home.waitForSelector('#newProject', {timeout: 60000});console.log('Windows QA: library ready');
    return home;
  }
  async function close() {
    if(!application)return;const current=application;let child;try{child=current.process();}catch{}application=null;
    console.log('Windows QA: exit application');
    await Promise.race([current.evaluate(({app})=>app.exit(0)).catch(()=>{}),new Promise(resolve=>setTimeout(resolve,5000))]);
    await Promise.race([current.close().catch(()=>{}),new Promise(resolve=>setTimeout(resolve,5000))]);
    if(child&&child.exitCode===null){require('node:child_process').spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore'});}
    console.log('Windows QA: application exited');
  }
  try {
    await fs.mkdir(review, {recursive: true});
    await fs.access(exe);
    let home = await launch();
    const info = await application.evaluate(({app}) => ({
      packaged: app.isPackaged,
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      testHook: typeof globalThis.workflowTest
    }));
    assert.deepEqual(info, {packaged: true, version, platform: 'win32', arch: 'x64', testHook: 'undefined'});
    assert.equal(await application.evaluate(({app}) => app.getName()), 'MooZ Agent');
    if(process.env.MOOZ_WINDOWS_UPGRADE_PROJECT){const projects=await home.evaluate(()=>workflowHome.listProjects());assert.ok(projects.some(p=>p.id===process.env.MOOZ_WINDOWS_UPGRADE_PROJECT));assert.equal(await home.locator('html').getAttribute('data-ui-theme'),'violet');}
    await home.click('#desktopUpdateButton');assert.match(await home.locator('#desktopUpdateStatus').innerText(),/Windows cập nhật thủ công/);assert.equal(await home.locator('#desktopUpdateChannel').innerText(),'Tải bản cài Windows');await home.screenshot({path:path.join(review,'windows-manual-update.png')});await home.locator('#desktopUpdateDialog button').filter({hasText:'Đóng'}).click();
    const guideOpen = await home.locator('#homeGuide').evaluate(node => node.open);
    for (let attempt = 0; attempt < 3; attempt++) {
      await home.click('#connectChrome');
      await home.waitForSelector('#chromeDialog[open]');
      await home.click('#closeChrome');
      assert.equal(await home.locator('#homeGuide').evaluate(node => node.open), guideOpen);
    }
    console.log('Windows QA: settings');await home.click('#connectionsOpen');
    await home.waitForFunction(() => document.querySelector('#connectionsVersion').textContent.includes('1.8.1'));
    assert.equal(await home.locator('#extensionManualGuide').getAttribute('open'), '');
    for (const name of ['Mở Grok', 'Mở Google Flow / Veo']) {
      const button = home.getByRole('button', {name, exact: true});
      await button.scrollIntoViewIfNeeded();
      assert.equal(await button.isVisible(), true);
      assert.equal(await button.isEnabled(), true);
    }
    await home.screenshot({path: path.join(review, 'windows-settings.png')});
    await home.click('#connectionsClose');
    const remote = await home.evaluate(() => workflowDesktop.call('remoteChrome.status'));
    assert.equal(remote.enabled, false, 'Public connections must not start during installation.');
    console.log('Windows QA: affiliate');const affiliateOpened = application.waitForEvent('window');
    await home.click('#aiAppsAffiliate');
    const affiliate = await affiliateOpened;
    await affiliate.waitForSelector('#sourceMode');
    assert.equal(await affiliate.inputValue('#sourceMode'), 'chrome');
    assert.equal(await affiliate.locator('#openShopee').isVisible(), true);
    assert.equal(await affiliate.locator('#refreshShopeeTabs').isVisible(), true);
    assert.equal(await affiliate.locator('#create').isDisabled(), true, 'Chrome capture needs a connected, explicitly selected product tab.');
    await affiliate.selectOption('#sourceMode', 'public');
    assert.equal(await affiliate.locator('#create').isDisabled(), true, 'Public capture needs a product link.');
    await affiliate.fill('#productLink', 'https://shopee.vn/product/123/456');
    assert.equal(await affiliate.locator('#create').isDisabled(), false);
    await affiliate.screenshot({path: path.join(review, 'windows-shopee-source.png')});
    console.log('Windows QA: close affiliate tab');const affiliateClosed=affiliate.waitForEvent('close');await home.evaluate(()=>workflowDesktop.call('workspace.close',{key:'affiliate'}));await affiliateClosed;
    console.log('Windows QA: batch');const batchOpened = application.waitForEvent('window');
    await home.click('#aiAppsBatch');
    const batch = await batchOpened;
    await batch.waitForFunction(() => window.MooZBatch);
    await batch.fill('#batchPrompts', 'Bản nháp trên Windows, chưa gửi AI.');
    await batch.selectOption('#composerDuration', '10');
    await batch.click('[data-composer-ratio="16:9"]');
    assert.equal(await batch.locator('#composerSubmit').isEnabled(), true);
    assert.equal(await batch.locator('#taskHistory').isVisible(), true);
    await batch.screenshot({path: path.join(review, 'windows-batch-composer.png')});
    await batch.click('[data-view=workflow]');await batch.click('#workflowCommonPrompt');await batch.fill('#commonPromptValue','Ánh sáng tự nhiên, giữ đúng sản phẩm.');await batch.screenshot({path:path.join(review,'windows-common-prompt.png')});await batch.locator('#commonPromptForm [type=submit]').click();assert.equal(await batch.evaluate(()=>MooZBatch.state.workflow.commonVideoPrompt),'Ánh sáng tự nhiên, giữ đúng sản phẩm.');await batch.click('[data-view=production]');
    if(process.env.MOOZ_WINDOWS_NATIVE_PICKER==='1'){
      const {promisify}=require('node:util'),exec=promisify(require('node:child_process').execFile),file=path.join(root,'ảnh-sản-phẩm.png'),bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR4nGNwaDjwH4QZYAwAVPQJ/Q4itk8AAAAASUVORK5CYII=','base64');await fs.writeFile(file,bytes);
      await batch.click('[data-composer-mode=images]');await batch.click('#addProducts');
      const owner=await application.evaluate(({BrowserWindow})=>{const handle=BrowserWindow.getAllWindows()[0].getNativeWindowHandle();return {pid:process.pid,hwnd:(handle.length>=8?handle.readBigUInt64LE(0):BigInt(handle.readUInt32LE(0))).toString()};});console.log('Windows QA native owner',owner);async function pick(cancel){const selecting=exec('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'windows-native-picker.ps1'),'-AppProcessId',String(owner.pid),'-AppWindowHandle',owner.hwnd,'-FilePath',file,'-Screenshot',path.join(review,cancel?'windows-picker-cancel.png':'windows-native-file-picker.png'),...(cancel?['-Cancel']:[])],{timeout:25000,windowsHide:true});const session=await batch.context().newCDPSession(batch);await session.send('Page.setInterceptFileChooserDialog',{enabled:false});try{await Promise.all([batch.locator('#productDrop').click(),selecting]);}finally{await session.detach();}}
      await pick(true);assert.equal(await batch.evaluate(()=>MooZBatch.state.jobs.length),0,'Cancel must not import anything');await pick(false);await batch.waitForFunction(()=>MooZBatch.state.jobs.length===1);const imported=await batch.evaluate(async()=>{const a=MooZBatch.assets.find(a=>a.origin==='upload');return {name:a.name,bytes:[...new Uint8Array(await a.blob.arrayBuffer())]};});assert.equal(imported.name,path.basename(file));assert.deepEqual(Buffer.from(imported.bytes),bytes);if(await batch.locator('#productDialog').evaluate(d=>d.open))await batch.locator('[data-close=productDialog]').last().click();await batch.screenshot({path:path.join(review,'windows-native-import-result.png')});
    }

    console.log('Windows QA: close batch tab');const batchClosed=batch.waitForEvent('close');await home.evaluate(()=>workflowDesktop.call('workspace.close',{key:'batch'}));await batchClosed;
    console.log('Windows QA: project');const project = await home.evaluate(() => workflowHome.createProject('Windows packaged QA'));
    const next = application.waitForEvent('window');
    await home.evaluate(id => workflowHome.openProject(id), project.id);
    const canvas = await next;
    await canvas.waitForSelector('#canvas');
    assert.doesNotMatch(await canvas.locator('#handTool').getAttribute('title'), /⌘/);
    await canvas.click('#addNodeMenuBtn');
    await canvas.fill('#nodeSearch', 'generateVideo');
    await canvas.locator('[data-add=generateVideo]').click();
    const provider = canvas.locator('.node[data-type=generateVideo]').last().locator('select').first();
    await provider.selectOption('flow');
    await canvas.locator('.node[data-type=generateVideo]').last().locator('select').first().selectOption('grok');
    await canvas.click('#addNodeMenuBtn');
    await canvas.fill('#nodeSearch', 'scriptSplit');
    await canvas.locator('[data-add=scriptSplit]').click();
    await canvas.locator('.node[data-type=scriptSplit]').last().getByRole('button', {name: 'Cấu trúc, quy tắc & xem kết quả', exact: true}).click();
    assert.equal(await canvas.locator('#scriptSplitParse').isDisabled(), true);
    await canvas.locator('#scriptSplitApprove').click();
    assert.match(await canvas.locator('#scriptSplitApproval').innerText(), /đã xác nhận/);
    await canvas.screenshot({path: path.join(review, 'windows-script-split.png')});
    await canvas.locator('#scriptSplitDrawer header button').click();
    await canvas.keyboard.press('Control+s');await canvas.waitForFunction(()=>document.querySelector('#runStatus')?.textContent==='Đã lưu.');await canvas.evaluate(() => WorkflowDesktopLifecycle.flush());
    await canvas.screenshot({path: path.join(review, 'windows-canvas.png')});
    console.log('Windows QA: restart');await close();
    home = await launch();
    const projects = await home.evaluate(() => workflowHome.listProjects());
    assert.ok(projects.some(p => p.id === project.id && p.name === 'Windows packaged QA'));
    await fs.writeFile(path.join(review, 'windows-package.json'), JSON.stringify({
      ...info,
      projectSurvivesRestart: true,
      commonVideoPrompt: true,
      grokAndFlowOptions: true,
      remoteOffByDefault: true,
      nativeFilePicker:process.env.MOOZ_WINDOWS_NATIVE_PICKER==='1',keyboardSave:true,installedExecutable:!!process.env.MOOZ_INSTALLED_EXE,liveAIRequests: 0
    }, null, 2));
    console.log('PASS actual packaged Windows app: correct version/x64, no test hooks, project create/restart, Grok/Flow controls, remote off by default. No live AI request.');
  } finally {
    await close();
    await fs.rm(root,{recursive:true,force:true,maxRetries:10,retryDelay:200}).catch(error=>{if(['EBUSY','EPERM'].includes(error.code))console.warn('Windows QA: temporary test profile remains locked after exit; functional checks and report are complete.');else throw error;});
  }
// Dispose the test driver even if its detached view channels retain handles.
// The success path is reached only after every assertion, restart and report.
})().then(()=>process.exit(0),error=>{console.error(error);process.exit(1);});
