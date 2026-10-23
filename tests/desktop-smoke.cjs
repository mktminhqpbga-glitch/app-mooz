/* Real Electron host + real renderer. Provider response below is a local fixture. */
const {_electron:electron}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
(async()=>{
 const data=await fs.mkdtemp(path.join(os.tmpdir(),'workflow-desktop-'));let application;
 try{
  const env={...process.env,WORKFLOW_DESKTOP_TEST:'1',WORKFLOW_TEST_DATA:data,XDG_CACHE_HOME:path.join(data,'cache')};delete env.ELECTRON_RUN_AS_NODE;
  application=await electron.launch({args:['--no-sandbox',...(process.platform==='linux'&&!env.DISPLAY?['--ozone-platform=headless','--disable-gpu']:[]),path.resolve(__dirname,'..')],env,timeout:60000});
  const home=await application.firstWindow();home.setDefaultTimeout(20000);const errors=[];home.on('pageerror',error=>errors.push(error.message));
  await home.waitForSelector('#newProject');
  await home.click('#desktopUpdateButton');await home.waitForSelector('#desktopUpdateDialog[open]');assert.match(await home.locator('#desktopUpdateStatus').innerText(),/bản cài macOS/);await application.evaluate(()=>globalThis.workflowTest.updater.set({mode:'native',state:'downloading',latestVersion:'0.32.0',progress:{percent:42},message:'Đang tải bản cập nhật trong nền…'}));
  await home.waitForFunction(()=>document.querySelector('#desktopUpdateDialog progress').value===42);assert.equal(await home.locator('#desktopCheckUpdate').isDisabled(),true);
  await application.evaluate(()=>globalThis.workflowTest.updater.set({state:'downloaded',progress:null,message:'Bản mới đã tải xong.'}));await home.waitForSelector('#desktopInstallUpdate:visible');
  await application.evaluate(()=>globalThis.workflowTest.updater.set({mode:'unavailable',state:'disabled',latestVersion:null,message:'Cập nhật ứng dụng dùng trong bản cài macOS.'}));
  await home.locator('#desktopUpdateDialog button').filter({hasText:'Đóng'}).click();
  const project=await home.evaluate(()=>window.workflowHome.createProject('Dự án kiểm thử desktop'));
  const canvasPromise=application.waitForEvent('window');await home.evaluate(id=>window.workflowHome.openProject(id),project.id);const canvas=await canvasPromise;canvas.setDefaultTimeout(20000);canvas.on('pageerror',error=>errors.push(error.message));
  await canvas.waitForSelector('.node');
  await canvas.click('#desktopConnectChrome');await canvas.waitForSelector('#canvasChromeDialog[open]');assert.match(await canvas.locator('#canvasChromePairing').inputValue(),/^workflow-connect:\/\/127\.0\.0\.1:/);await canvas.click('#canvasChromeClose');assert.equal(await canvas.locator('#canvasChromePairing').inputValue(),'');

  assert.equal(await canvas.evaluate(()=>chrome.runtime.getManifest().version),require('../package.json').version);
  await canvas.evaluate(()=>chrome.storage.local.set({desktopSmoke:'saved',museflow:{nodes:[],edges:[],groups:[],notes:[],settings:{}}}));
  await canvas.reload();await canvas.waitForSelector('#canvas');assert.equal(await canvas.evaluate(async()=>(await chrome.storage.local.get('desktopSmoke')).desktopSmoke),'saved');
  const isolated=await home.evaluate(()=>window.workflowHome.createProject('Dự án độc lập'));
  await application.evaluate(async(_,{id})=>{const data=await globalThis.workflowTest.store.readStorage(id);if(data.desktopSmoke)throw Error('Cross-project data leak');},{id:isolated.id});
  const info=await canvas.evaluate(()=>window.workflowDesktop.call('project.info'));assert.equal(info.id,project.id);
  await assert.rejects(()=>canvas.evaluate(()=>window.workflowDesktop.call('network.fetch',{url:'http://169.254.169.254/latest/meta-data',requestId:'blocked'})),/chưa được cho phép/);
  // Intercept a supported origin inside the managed browser, with no login/API call.
  await application.evaluate(async({session})=>{
    const ses=session.fromPartition('persist:workflow-ai-chatgpt');
    await ses.protocol.handle('https',()=>new Response('<!doctype html><html><head><title>AI fixture</title></head><body><textarea placeholder="Message ChatGPT"></textarea><button id="send" data-testid="send-button">Send</button><section id="messages"></section><script>document.getElementById("send").onclick=()=>{const box=document.querySelector("textarea");const prompt=box.value;box.value="";const user=document.createElement("div");user.dataset.messageAuthorRole="user";user.textContent=prompt;document.getElementById("messages").append(user);setTimeout(()=>{const reply=document.createElement("div");reply.dataset.messageAuthorRole="assistant";reply.textContent="Desktop bridge verified";document.getElementById("messages").append(reply);},100);};</script></body></html>',{headers:{'content-type':'text/html'}}));
  });
  const aiPromise=application.waitForEvent('window');const tab=await canvas.evaluate(()=>window.workflowDesktop.call('provider.open',{provider:'chatgpt'}));const ai=await aiPromise;await ai.waitForSelector('textarea');
  assert.equal(await ai.evaluate(()=>typeof require),'undefined');assert.equal(await ai.evaluate(()=>typeof window.workflowDesktop),'undefined');
  const tabs=await canvas.evaluate(()=>chrome.tabs.query({url:['https://chatgpt.com/*']}));assert.ok(tabs.some(item=>item.id===tab.id));
  await canvas.evaluate(id=>chrome.scripting.executeScript({target:{tabId:id},files:['composer-controls.js','ai-bridge.js']}),tab.id);
  const check=await canvas.evaluate(id=>chrome.tabs.sendMessage(id,{type:'WORKFLOW_AI_CHECK'}),tab.id);assert.equal(check.composer,true);
  const result=await canvas.evaluate(id=>chrome.tabs.sendMessage(id,{type:'WORKFLOW_AI_GENERATE',requestId:'desktop-smoke',mediaType:'text',prompt:'Describe the workflow',sendMode:'auto'}),tab.id);assert.equal(result.ok,true);assert.equal(result.text,'Desktop bridge verified');
  // Exercise the authenticated Chrome relay through the real Electron IPC path.
  const {WebSocket}=require('ws');const {once}=require('node:events');
  const pair=await home.evaluate(()=>window.workflowHome.connectChrome());const pairURL=new URL(pair.url);
  const peer=new WebSocket('ws://127.0.0.1:'+pairURL.port+'/',{origin:'chrome-extension://'+'a'.repeat(32)});
  await once(peer,'open');const ready=once(peer,'message');peer.send(JSON.stringify({type:'auth',token:pairURL.pathname.slice(1)}));await ready;
  peer.on('message',bytes=>{const message=JSON.parse(bytes);if(message.type==='request'){const result=message.operation==='tabs.query'?[{id:909,windowId:707,url:'https://chatgpt.com/c/existing',title:'Chrome fixture'}]:{id:909,windowId:707,url:'https://chatgpt.com/c/existing'};peer.send(JSON.stringify({type:'response',id:message.id,result}));}});
  const chromeTabs=await canvas.evaluate(()=>chrome.tabs.query({url:['https://chatgpt.com/*']}));assert.equal(chromeTabs[0].id,909);
  await canvas.evaluate(async()=>{await chrome.tabs.update(909,{active:true});await chrome.windows.update(707,{focused:true});});
  peer.close();await once(peer,'close');
  await home.reload();await home.waitForSelector('.project-card');
  await home.screenshot({path:path.join(os.tmpdir(),'workflow-desktop-home.png')});
  // Closing the canvas must flush a change that has not reached the debounce timer.
  const {toolbarAction}=require('./toolbar-actions.cjs');
  await toolbarAction(canvas,'#addNodeMenuBtn');await canvas.click('[data-add="prompt"]');
  await canvas.locator('.node textarea').first().fill('Edit immediately before native close');
  const closing=canvas.waitForEvent('close');
  await application.evaluate(async({BrowserWindow})=>{const win=BrowserWindow.getAllWindows().find(w=>w.projectId);win.close();});
  await closing;
  const reopened=application.waitForEvent('window');await home.evaluate(id=>window.workflowHome.openProject(id),project.id);const restored=await reopened;await restored.waitForSelector('.node textarea');
  assert.equal(await restored.locator('.node textarea').first().inputValue(),'Edit immediately before native close');

  // An update must never accept the normal close-without-saving fallback.
  await application.evaluate(async({dialog,BrowserWindow})=>{
    const t=globalThis.workflowTest;const original=t.store.writeStorage,show=dialog.showMessageBox;
    try{t.store.writeStorage=async()=>{throw Error('simulated disk failure');};dialog.showMessageBox=async()=>({response:0});const win=BrowserWindow.getAllWindows().find(w=>w.projectId);if(await win.prepareToClose({requireSaved:true}))throw Error('Update proceeded despite save failure');if(win.isDestroyed())throw Error('Project closed despite failed update save');}
    finally{t.store.writeStorage=original;dialog.showMessageBox=show;}
  });
  assert.deepEqual(errors,[]);
  console.log('PASS real Electron: home, canvas, IPC storage + restart, project isolation, network refusal, isolated AI window, bridge send/receive and authenticated Chrome relay routing. AI response fixture only.');
 }finally{await application?.close();await fs.rm(data,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
