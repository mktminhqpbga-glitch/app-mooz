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
  const exe = path.resolve('dist/win-unpacked/Workflow.exe');
  const version = require('../package.json').version;
  const env = {...process.env};
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.WORKFLOW_DESKTOP_TEST;
  delete env.WORKFLOW_TEST_DATA;
  let application;
  async function launch() {
    application = await electron.launch({
      executablePath: exe,
      args: ['--disable-gpu', '--user-data-dir=' + path.join(root, 'data')],
      env,
      timeout: 60000
    });
    const home = await application.firstWindow();
    await home.waitForSelector('#newProject', {timeout: 60000});
    return home;
  }
  async function close() {
    await application?.evaluate(({app}) => app.exit(0)).catch(() => {});
    await application?.close().catch(() => {});
    application = null;
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
    await home.click('#connectionsOpen');
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
    const project = await home.evaluate(() => workflowHome.createProject('Windows packaged QA'));
    const next = application.waitForEvent('window');
    await home.evaluate(id => workflowHome.openProject(id), project.id);
    const canvas = await next;
    await canvas.waitForSelector('#canvas');
    await canvas.click('#addNodeMenuBtn');
    await canvas.fill('#nodeSearch', 'generateVideo');
    await canvas.locator('[data-add=generateVideo]').click();
    const provider = canvas.locator('.node[data-type=generateVideo]').last().locator('select').first();
    await provider.selectOption('flow');
    await canvas.locator('.node[data-type=generateVideo]').last().locator('select').first().selectOption('grok');
    await canvas.evaluate(() => WorkflowDesktopLifecycle.flush());
    await canvas.screenshot({path: path.join(review, 'windows-canvas.png')});
    await close();
    home = await launch();
    const projects = await home.evaluate(() => workflowHome.listProjects());
    assert.ok(projects.some(p => p.id === project.id && p.name === 'Windows packaged QA'));
    await fs.writeFile(path.join(review, 'windows-package.json'), JSON.stringify({
      ...info,
      projectSurvivesRestart: true,
      grokAndFlowOptions: true,
      remoteOffByDefault: true,
      liveAIRequests: 0
    }, null, 2));
    console.log('PASS actual packaged Windows app: correct version/x64, no test hooks, project create/restart, Grok/Flow controls, remote off by default. No live AI request.');
  } finally {
    await close();
    await fs.rm(root, {recursive: true, force: true});
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
