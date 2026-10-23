const {BrowserWindow} = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const {providerForURL, matchesPattern} = require('./policy.cjs');
const WORLD = 1001;
const FILES = new Set(['composer-controls.js', 'ai-bridge.js', 'muse-bridge.js', 'result-picker.js', 'muse-support.js']);
const TYPES = new Set(['WORKFLOW_AI_CHECK', 'WORKFLOW_AI_GENERATE', 'WORKFLOW_AI_STOP', 'WORKFLOW_AI_SEND_NOW', 'WORKFLOW_AI_USE_RESULT', 'MUSEFLOW_CHECK_SESSION', 'MUSEFLOW_GENERATE', 'MUSEFLOW_STOP_GENERATION', 'MUSEFLOW_JOB_STATUS', 'MUSEFLOW_JOB_START', 'MUSEFLOW_JOB_ACK']);
const URLS = {chatgpt: 'https://chatgpt.com/', gemini: 'https://gemini.google.com/app', muse: 'https://muse.ai/'};
class AIWindows {
  constructor(root, version, notify, readPreferred) {this.root=root; this.version=version; this.notify=notify; this.readPreferred=readPreferred; this.windows=new Map();}
  tab(win) {return {id:win.webContents.id, windowId:win.webContents.id, url:win.webContents.getURL(), title:win.webContents.getTitle()};}
  find(id) {const win=this.windows.get(id); if(!win || win.isDestroyed())throw Error('Cửa sổ AI đã đóng. Mở lại và chọn cuộc trò chuyện.'); if(!providerForURL(win.webContents.getURL()))throw Error('Cửa sổ chưa ở trang AI được hỗ trợ.');return win;}
  list(patterns) {return [...this.windows.values()].filter(win=>!win.isDestroyed() && providerForURL(win.webContents.getURL())).map(win=>this.tab(win)).filter(tab=>!patterns || (Array.isArray(patterns)?patterns:[patterns]).some(pattern=>matchesPattern(tab.url,pattern)));}
  open(provider) {
    if(!Object.hasOwn(URLS,provider))throw Error('AI không được hỗ trợ.');
    const win=new BrowserWindow({width:1100,height:850,title:provider,webPreferences:{partition:'persist:workflow-ai-'+provider,contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true}});
    const id=win.webContents.id;this.windows.set(id,win);
    win.webContents.setWindowOpenHandler(({url})=>{
      if(!/^https:\/\//.test(url))return {action:'deny'};
      return {action:'allow',overrideBrowserWindowOptions:{webPreferences:{partition:'persist:workflow-ai-'+provider,contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true}}};
    });
    win.webContents.on('will-navigate',(event,url)=>{if(!/^https:\/\//.test(url))event.preventDefault();});
    win.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
    win.webContents.on('did-navigate',()=>this.notify({type:'updated',tab:this.tab(win),changeInfo:{status:'complete',url:win.webContents.getURL()}}));
    win.webContents.on('did-navigate-in-page',()=>this.notify({type:'updated',tab:this.tab(win),changeInfo:{url:win.webContents.getURL()}}));
    win.webContents.on('page-title-updated',()=>this.notify({type:'updated',tab:this.tab(win),changeInfo:{title:win.webContents.getTitle()}}));
    win.webContents.on('console-message',(_event,details,oldMessage)=>{
      const message=typeof details==='object'?details.message:oldMessage;
      if(typeof message!=='string'||!message.startsWith('__WORKFLOW_PROGRESS__'))return;
      try{const value=JSON.parse(message.slice(21));if(value.type==='WORKFLOW_AI_PROGRESS'&&typeof value.requestId==='string'&&typeof value.text==='string')this.notify({type:'message',tabId:id,message:value});}catch{}
    });
    win.on('closed',()=>this.windows.delete(id));
    win.loadURL(URLS[provider]).catch(()=>{});
    const result={id,windowId:id,url:URLS[provider],title:provider};this.notify({type:'created',tab:result});return result;
  }
  focus(id) {const win=this.find(id);if(win.isMinimized())win.restore();win.show();win.focus();return this.tab(win);}
  async boot(win, projectId) {
    const preferred=await this.readPreferred(projectId);
    const code=`if(!globalThis.__workflowHost){
      const listeners=[];
      globalThis.chrome={runtime:{id:'workflow-desktop',getManifest:()=>({version:${JSON.stringify(this.version)}}),onMessage:{addListener:fn=>listeners.push(fn)},sendMessage:async value=>{console.log('__WORKFLOW_PROGRESS__'+JSON.stringify(value));}},storage:{local:{get:async()=>({workflowMuseSendTarget:globalThis.__workflowHost.preferred})}}};
      globalThis.__workflowHost={dispatch:request=>new Promise((resolve,reject)=>{let handled=false;for(const listener of listeners){try{const result=listener(request,{id:'workflow-desktop'},resolve);if(result===true)handled=true;}catch(error){reject(error);return;}}if(!handled)resolve({ok:false,error:'Bộ kết nối chưa xử lý yêu cầu.'});})};
    }
    globalThis.__workflowHost.preferred=${JSON.stringify(preferred ?? null)};
    void 0;`;
    await win.webContents.executeJavaScriptInIsolatedWorld(WORLD,[{code}],true);
  }
  async script(id, files, operation, projectId) {
    const win=this.find(id);await this.boot(win,projectId);
    if(files){if(!Array.isArray(files)||files.some(file=>!FILES.has(file)))throw Error('Tệp kết nối không được phép.');
      for(const file of files){if(!providerForURL(win.webContents.getURL()))throw Error('Trang AI đã thay đổi.');const code=await fs.readFile(path.join(this.root,file),'utf8');await win.webContents.executeJavaScriptInIsolatedWorld(WORLD,[{code}],true);}}
    let code;
    if(operation==='pick')code='WorkflowResultPicker.pick()';
    else if(operation==='composer')code='!!globalThis.WorkflowComposer?.scopeFor';
    else if(operation==='bind')code='WorkflowMuseSupport.bindSend()';
    else if(operation==='diagnostics')code='WorkflowMuseSupport.diagnostics()';
    else if(operation)throw Error('Thao tác không được phép.');
    const result=code?await win.webContents.executeJavaScriptInIsolatedWorld(WORLD,[{code}],true):null;
    return [{result}];
  }
  async message(id,message,projectId) {if(!message||!TYPES.has(message.type))throw Error('Loại yêu cầu AI không được phép.');const win=this.find(id);await this.boot(win,projectId);return win.webContents.executeJavaScriptInIsolatedWorld(WORLD,[{code:`globalThis.__workflowHost.dispatch(${JSON.stringify(message)})`}],true);}
  closeAll() {for(const win of this.windows.values())if(!win.isDestroyed())win.close();}
}
module.exports={AIWindows};
