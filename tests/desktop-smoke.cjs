/* Real Electron host + real renderer. Provider response below is a local fixture.
   Clipboard checks need a desktop session on Linux (for example xvfb-run -a). */
const {_electron:electron}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
(async()=>{
 const data=await fs.mkdtemp(path.join(os.tmpdir(),'workflow-desktop-'));let application,clipboardBefore;
 try{
  const env={...process.env,WORKFLOW_DESKTOP_TEST:'1',WORKFLOW_TEST_DATA:data,XDG_CACHE_HOME:path.join(data,'cache')};delete env.ELECTRON_RUN_AS_NODE;
  application=await electron.launch({args:['--no-sandbox',...(process.platform==='linux'&&!env.DISPLAY?['--ozone-platform=headless','--disable-gpu']:[]),path.resolve(__dirname,'..')],env,timeout:60000});
  const home=await application.firstWindow();home.setDefaultTimeout(20000);const errors=[];home.on('pageerror',error=>errors.push(error.message));
  await home.waitForSelector('#newProject');
  await fs.mkdir(path.join(data,'exports'));await application.evaluate(({app},directory)=>app.setPath('downloads',directory),path.join(data,'exports'));
  clipboardBefore=await application.evaluate(({clipboard})=>clipboard.readText());
  async function clipboardMatches(expected){for(let i=0;i<60;i++){if(await application.evaluate(async({clipboard},value)=>(await clipboard.readText())===value,expected))return true;await new Promise(resolve=>setTimeout(resolve,40));}return false;}


  await home.click('#desktopUpdateButton');await home.waitForSelector('#desktopUpdateDialog[open]');assert.match(await home.locator('#desktopUpdateStatus').innerText(),/bản cài macOS/);await application.evaluate(()=>globalThis.workflowTest.updater.set({mode:'native',state:'downloading',latestVersion:'0.32.0',progress:{percent:42},message:'Đang tải bản cập nhật trong nền…'}));
  await home.waitForFunction(()=>document.querySelector('#desktopUpdateDialog progress').value===42);assert.equal(await home.locator('#desktopCheckUpdate').isDisabled(),true);
  await application.evaluate(()=>globalThis.workflowTest.updater.set({state:'downloaded',progress:null,message:'Bản mới đã tải xong.'}));await home.waitForSelector('#desktopInstallUpdate:visible');
  await application.evaluate(()=>globalThis.workflowTest.updater.set({mode:'unavailable',state:'disabled',latestVersion:null,message:'Cập nhật ứng dụng dùng trong bản cài macOS.'}));
  await home.locator('#desktopUpdateDialog button').filter({hasText:'Đóng'}).click();
  // Keep web clipboard unavailable; explicit pairing copies must use native Electron IPC.
  await home.evaluate(()=>{window.webClipboardCalls=0;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{window.webClipboardCalls++;throw Error('Web clipboard blocked');}}});});
  await home.click('#connectChrome');await home.waitForSelector('#chromeDialog[open]');const homePair=await home.locator('#chromePairing').inputValue();assert.equal(await home.locator('#chromePairing').getAttribute('type'),'password');await home.click('#copyChrome');await home.waitForFunction(()=>document.querySelector('#chromeStatus').textContent.includes('Đã sao chép'));assert.ok(await clipboardMatches(homePair),'Home copy writes the exact pairing URI to the native clipboard');assert.equal(await home.evaluate(()=>webClipboardCalls),0);await home.click('#revealChrome');assert.equal(await home.locator('#chromePairing').getAttribute('type'),'text');await home.click('#closeChrome');await home.waitForFunction(()=>document.querySelector('#chromePairing').value==='');assert.ok((await home.locator('#chromePairing').inputValue())==='');assert.equal(await home.locator('#chromePairing').getAttribute('type'),'password');
  const project=await home.evaluate(()=>window.workflowHome.createProject('Dự án kiểm thử desktop'));
  assert.equal(await home.locator('#aiAppsVoice').isDisabled(),true);await home.click('#aiAppsChat');await home.waitForSelector('#appProjectDialog[open]');await home.locator('#appProjectSelect').selectOption(project.id);const canvasPromise=application.waitForEvent('window');await home.click('#appProjectOpen');const canvas=await canvasPromise;canvas.setDefaultTimeout(20000);canvas.on('pageerror',error=>errors.push(error.message));
  await canvas.waitForSelector('.node');
  await canvas.waitForSelector('#workflowChatPanel:visible');assert.equal(await canvas.locator('#workflowChatPanel').isVisible(),true);assert.equal(await canvas.locator('#workflowChatAuto').isChecked(),false);await canvas.click('#workflowChatMinimize');

  await canvas.evaluate(()=>{window.webClipboardCalls=0;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{window.webClipboardCalls++;throw Error('Web clipboard blocked');}}});});
  await canvas.click('#desktopConnectChrome');await canvas.waitForSelector('#canvasChromeDialog[open]');const canvasPair=await canvas.locator('#canvasChromePairing').inputValue();assert.match(canvasPair,/^workflow-connect:\/\/127\.0\.0\.1:/);await application.evaluate(({clipboard})=>clipboard.writeText('clipboard-test-sentinel'));await canvas.click('#canvasChromeCopy');await canvas.waitForFunction(()=>document.querySelector('#canvasChromeStatus').textContent.includes('Đã sao chép'));assert.ok(await clipboardMatches(canvasPair),'Canvas copy writes the exact pairing URI to native clipboard');assert.equal(await canvas.evaluate(()=>webClipboardCalls),0);
  await canvas.click('#canvasChromeReveal');assert.equal(await canvas.locator('#canvasChromePairing').getAttribute('type'),'text');await application.evaluate(async({clipboard,BrowserWindow})=>{await clipboard.writeText('manual-copy-sentinel');BrowserWindow.getAllWindows().find(w=>w.projectId).webContents.copy();});assert.ok(await clipboardMatches(canvasPair),'Revealed readonly text supports native manual copy');await canvas.click('#canvasChromeClose');await canvas.waitForFunction(()=>document.querySelector('#canvasChromePairing').value==='');assert.ok((await canvas.locator('#canvasChromePairing').inputValue())==='');assert.equal(await canvas.locator('#canvasChromePairing').getAttribute('type'),'password');
  await home.click('#newProject');await home.locator('#projectName').focus();await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>!w.projectId).webContents.paste());await home.waitForFunction(value=>document.querySelector('#projectName').value===value,canvasPair);assert.ok((await home.locator('#projectName').inputValue())===canvasPair,'Pairing code can be pasted into another app window');await home.click('#cancelName');


  assert.equal(await canvas.evaluate(()=>chrome.runtime.getManifest().version),require('../package.json').version);
  await canvas.evaluate(()=>chrome.storage.local.set({desktopSmoke:'saved',museflow:{nodes:[],edges:[],groups:[],notes:[],settings:{}}}));
  await canvas.reload();await canvas.waitForSelector('#canvas');assert.equal(await canvas.evaluate(async()=>(await chrome.storage.local.get('desktopSmoke')).desktopSmoke),'saved');
  const isolated=await home.evaluate(()=>window.workflowHome.createProject('Dự án độc lập'));
  await application.evaluate(async(_,{id})=>{const data=await globalThis.workflowTest.store.readStorage(id);if(data.desktopSmoke)throw Error('Cross-project data leak');},{id:isolated.id});
  const info=await canvas.evaluate(()=>window.workflowDesktop.call('project.info'));assert.equal(info.id,project.id);
  const savedFile=path.join(data,'chat-result.txt');await application.evaluate(({dialog},filePath)=>{globalThis.workflowTest.previousSaveDialog=dialog.showSaveDialog;dialog.showSaveDialog=async()=>({canceled:false,filePath});},savedFile);
  try{await canvas.evaluate(async()=>{const url=URL.createObjectURL(new Blob(['Chat download verified'],{type:'text/plain'}));try{await chrome.downloads.download({url,filename:'chat-result.txt',saveAs:true});}finally{URL.revokeObjectURL(url);}});assert.equal(await fs.readFile(savedFile,'utf8'),'Chat download verified');}finally{await application.evaluate(({dialog})=>{dialog.showSaveDialog=globalThis.workflowTest.previousSaveDialog;delete globalThis.workflowTest.previousSaveDialog;});}

  // Native anchors + explicit downloads stream blob data without whole-file IPC or save dialogs.
  await application.evaluate(({dialog})=>{globalThis.workflowTest.previousSaveDialog=dialog.showSaveDialog;dialog.showSaveDialog=async()=>{throw Error('Unexpected save dialog for automatic export');};});
  try{
   await fs.writeFile(path.join(data,'exports','NODE-result.mp4'),'keep existing video');
   await canvas.evaluate(async()=>{const url=URL.createObjectURL(new Blob([new Uint8Array(32*1024*1024).fill(17)],{type:'video/mp4'}));try{const ids=await Promise.all([chrome.downloads.download({url,filename:'NODE-result.mp4',saveAs:false}),chrome.downloads.download({url,filename:'NODE-result.mp4',saveAs:false})]);if(ids[0]!==ids[1])throw Error('Repeated click created duplicate exports');}finally{URL.revokeObjectURL(url);}});
   assert.equal(await fs.readFile(path.join(data,'exports','NODE-result.mp4'),'utf8'),'keep existing video');
   const bytes=await fs.readFile(path.join(data,'exports','NODE-result (1).mp4'));assert.equal(bytes.length,32*1024*1024);assert.ok(bytes.every(x=>x===17));
   assert.equal((await fs.readdir(path.join(data,'exports'))).length,2);
   await canvas.evaluate(()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['anchor export'],{type:'text/plain'}));a.download='anchor.txt';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000);});
   await canvas.waitForFunction(()=>document.querySelector('#desktopDownloadStatus').textContent==='Đã lưu: anchor.txt');assert.equal(await fs.readFile(path.join(data,'exports','anchor.txt'),'utf8'),'anchor export');
   assert.equal(await canvas.locator('#desktopRevealDownload').isVisible(),true);
   await canvas.evaluate(()=>chrome.downloads.download({url:'data:text/plain;base64,ZGF0YSBleHBvcnQ=',filename:'data.txt',saveAs:false}));assert.equal(await fs.readFile(path.join(data,'exports','data.txt'),'utf8'),'data export');await canvas.screenshot({path:path.join(os.tmpdir(),'workflow-export-status.png')});
   await assert.rejects(()=>canvas.evaluate(()=>chrome.downloads.download({url:'file:///etc/passwd'})),/chưa được cho phép/);
  }finally{await application.evaluate(({dialog})=>{dialog.showSaveDialog=globalThis.workflowTest.previousSaveDialog;delete globalThis.workflowTest.previousSaveDialog;});}

  await assert.rejects(()=>canvas.evaluate(()=>window.workflowDesktop.call('network.fetch',{url:'http://169.254.169.254/latest/meta-data',requestId:'blocked'})),/chưa được cho phép/);
  // Intercept a supported origin inside the managed browser, with no login/API call.
  await application.evaluate(async({session})=>{
    const ses=session.fromPartition('persist:workflow-ai-chatgpt');
    await ses.protocol.handle('https',()=>new Response('<!doctype html><html><head><title>AI fixture</title></head><body><textarea placeholder="Message ChatGPT"></textarea><button id="send" data-testid="send-button">Send</button><section id="messages"></section><script>document.getElementById("send").onclick=()=>{const box=document.querySelector("textarea");const prompt=box.value;box.value="";const user=document.createElement("div");user.dataset.messageAuthorRole="user";user.textContent=prompt;document.getElementById("messages").append(user);setTimeout(()=>{const reply=document.createElement("div");reply.dataset.messageAuthorRole="assistant";reply.textContent="Desktop bridge verified";document.getElementById("messages").append(reply);},100);};</script></body></html>',{headers:{'content-type':'text/html'}}));
  });
  const aiPromise=application.waitForEvent('window');const tab=await canvas.evaluate(()=>window.workflowDesktop.call('provider.open',{provider:'chatgpt'}));const ai=await aiPromise;await ai.waitForSelector('textarea');
  assert.equal(await ai.evaluate(()=>typeof require),'undefined');assert.equal(await ai.evaluate(()=>typeof window.workflowDesktop),'undefined');
  const tabs=await canvas.evaluate(()=>chrome.tabs.query({url:['https://chatgpt.com/*']}));assert.ok(tabs.some(item=>item.id===tab.id));
  await canvas.evaluate(id=>chrome.scripting.executeScript({target:{tabId:id},files:['ai-activity.js','composer-controls.js','ai-bridge.js']}),tab.id);
  const check=await canvas.evaluate(id=>chrome.tabs.sendMessage(id,{type:'WORKFLOW_AI_CHECK'}),tab.id);assert.equal(check.composer,true);
  assert.equal(check.backgroundProtocol,1);
  await application.evaluate(({BrowserWindow})=>{for(const win of BrowserWindow.getAllWindows()){if(win.webContents.getBackgroundThrottling()!==false)throw Error('Managed window still throttles background work');if(win.projectId||win.webContents.getURL().startsWith('https://chatgpt.com'))win.hide();}});
  const result=await canvas.evaluate(id=>chrome.tabs.sendMessage(id,{type:'WORKFLOW_AI_GENERATE',requestId:'desktop-smoke',mediaType:'text',prompt:'Describe the workflow',sendMode:'auto'}),tab.id);assert.equal(result.ok,true);assert.equal(result.text,'Desktop bridge verified');
  await application.evaluate(({BrowserWindow})=>{for(const win of BrowserWindow.getAllWindows())if(win.projectId)win.show();});
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
  // Deletion is explicit, library-only, blocked for open projects and reversible.
  await assert.rejects(()=>canvas.evaluate(id=>window.workflowDesktop.call('projects.trash',{id}),isolated.id),/Open project library/);
  await home.getByRole('button',{name:'Xóa dự án '+project.name,exact:true}).click();
  await home.waitForSelector('#deleteDialog[open]');
  await home.click('#confirmDelete');await home.waitForFunction(()=>document.querySelector('#deleteError').textContent.includes('Đóng cửa sổ'));
  assert.equal((await home.evaluate(()=>window.workflowHome.listProjects())).length,2);await home.click('#cancelDelete');
  await application.evaluate(async(_,{id})=>globalThis.workflowTest.store.writeStorage(id,{keep:'deleted project content'}),{id:isolated.id});
  await home.getByRole('button',{name:'Xóa dự án '+isolated.name,exact:true}).click();
  assert.equal(await home.locator('#cancelDelete').evaluate(el=>el===document.activeElement),true);
  await home.click('#cancelDelete');assert.equal((await home.evaluate(()=>window.workflowHome.listProjects())).length,2);
  await home.getByRole('button',{name:'Xóa dự án '+isolated.name,exact:true}).click();await home.click('#confirmDelete');
  await home.waitForFunction(()=>document.querySelectorAll('.project-card').length===1&&!document.querySelector('#deleteNotice').hidden);
  await home.screenshot({path:path.join(os.tmpdir(),'workflow-project-delete.png')});
  await home.click('#undoDelete');await home.waitForFunction(()=>document.querySelectorAll('.project-card').length===2&&document.querySelector('#deleteNotice').hidden);
  assert.equal(await application.evaluate(async(_,id)=>(await globalThis.workflowTest.store.readStorage(id)).keep,isolated.id),'deleted project content');
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
  console.log('PASS real Electron: home, canvas, IPC storage + restart, project isolation, network refusal, isolated AI window, bridge send/receive and authenticated Chrome relay routing, native pairing copy/paste with web clipboard blocked, reveal/reset controls and project-scoped Chat AI app launch and native attachment/result save transport, 32 MB Blob export without a modal, duplicate click coalescing, filename collision preservation, anchor and data URL downloads. AI response fixture only.');
 }finally{if(application&&clipboardBefore!==undefined)try{await application.evaluate(({clipboard},value)=>clipboard.writeText(value),clipboardBefore);}catch{}await application?.close();await fs.rm(data,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
