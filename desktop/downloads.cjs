'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {allowedNetworkURL}=require('./policy.cjs');
const MAX_BYTES=128*1024*1024;
function sourceAllowed(url){return typeof url==='string'&&(/^blob:workflow:\/\/app\/[\w-]+$/.test(url)||/^data:(?:image\/|video\/|audio\/|text\/|application\/(?:json|octet-stream))/.test(url)||allowedNetworkURL(url));}
function safeName(value){const name=path.basename(String(value||'Workflow-ket-qua')).replace(/[\\/:\x00-\x1f\x7f]/g,'-').slice(0,180);return !name||name==='.'||name==='..'?'Workflow-ket-qua':name;}
// Reserve with wx: another window/download cannot choose the same destination.
function reserve(directory,name){const ext=path.extname(name),stem=path.basename(name,ext);for(let n=0;n<10000;n++){const file=path.join(directory,n?`${stem} (${n})${ext}`:name);try{const fd=fs.openSync(file,'wx',0o600);fs.closeSync(fd);return file;}catch(error){if(error.code!=='EEXIST')throw error;}}throw Error('Quá nhiều tệp trùng tên.');}
class Downloads{
 constructor({directory,windowFor,dialog,notify,reveal}){Object.assign(this,{directory,windowFor,dialog,notify,reveal});this.sessions=new WeakSet();this.pending=new Map();this.completed=new Map();}
 install(session){if(this.sessions.has(session))return;this.sessions.add(session);session.on('will-download',(event,item,contents)=>this.receive(event,item,contents));}
 key(win,url){return win.webContents.id+':'+url;}
 download(win,data){
  if(!sourceAllowed(data.url)||! /^(?:blob:|data:)/.test(data.url))throw Error('Nguồn tải chưa được cho phép trên desktop.');
  const key=this.key(win,data.url),existing=this.pending.get(key);if(existing)return existing.promise;
  const entry={win,key,name:data.filename||data.name,saveAs:data.saveAs===true,id:randomUUID()};
  entry.promise=new Promise((resolve,reject)=>Object.assign(entry,{resolve,reject}));this.pending.set(key,entry);
  void(async()=>{try{
   if(entry.saveAs){const choice=await this.dialog.showSaveDialog(win,{defaultPath:path.join(this.directory(),safeName(entry.name))});if(choice.canceled){this.pending.delete(key);entry.resolve(null);return;}entry.destination=choice.filePath;}
   if(win.isDestroyed())throw Error('Cửa sổ đã đóng.');
   entry.timer=setTimeout(()=>this.fail(entry,Error('Không bắt đầu được tải tệp.')),15000);win.webContents.downloadURL(data.url);
  }catch(error){this.fail(entry,error);}})();return entry.promise;
 }
 fail(entry,error){clearTimeout(entry.timer);if(this.pending.get(entry.key)===entry)this.pending.delete(entry.key);entry.reject?.(error);this.notify(entry.win,{type:'download',id:entry.id,state:'error',name:entry.name,message:error.message});}
 receive(event,item,contents){
  const win=this.windowFor(contents),url=item.getURL();
  if(!win?.projectId||!sourceAllowed(url)){event.preventDefault();return;}
  const key=this.key(win,url);let entry=this.pending.get(key);
  // Native anchor downloads use the same manager as explicit chrome.downloads calls.
  if(entry?.item){event.preventDefault();return;}
  if(!entry){entry={win,key,id:randomUUID(),saveAs:false};entry.promise=new Promise((resolve,reject)=>Object.assign(entry,{resolve,reject}));void entry.promise.catch(()=>{});this.pending.set(key,entry);}
  entry.item=item;clearTimeout(entry.timer);entry.name=safeName(entry.name||item.getFilename());
  if(item.getTotalBytes()>MAX_BYTES){event.preventDefault();this.fail(entry,Error('Tệp vượt giới hạn 128 MB.'));return;}
  const emit=(state,extra={})=>this.notify(win,{type:'download',id:entry.id,state,name:entry.name,...extra});
  let destination,reserved=false,lastProgress=0,tooLarge=false;
  const closed=()=>item.cancel();win.once('closed',closed);
  item.on('updated',()=>{if(item.getReceivedBytes()>MAX_BYTES){tooLarge=true;item.cancel();return;}if(Date.now()-lastProgress>250){lastProgress=Date.now();emit('saving',{received:item.getReceivedBytes(),total:item.getTotalBytes()});}});
  item.once('done',(_event,state)=>{
   win.removeListener('closed',closed);if(this.pending.get(key)===entry)this.pending.delete(key);
   if(state==='completed'){
    this.completed.set(entry.id,{win,path:destination});if(this.completed.size>100)this.completed.delete(this.completed.keys().next().value);
    emit('completed');entry.resolve?.(entry.id);
   }else{
    if(reserved)try{fs.unlinkSync(destination);}catch{}
    const error=Error(tooLarge?'Tệp vượt giới hạn 128 MB.':state==='cancelled'?'Đã hủy lưu tệp.':'Lưu tệp bị gián đoạn.');
    emit(state==='cancelled'?'cancelled':'error',{message:error.message});entry.reject?.(error);
   }
  });
  {
   try{destination=entry.destination||reserve(this.directory(),entry.name);reserved=!entry.destination;entry.name=path.basename(destination);item.setSavePath(destination);emit('saving');}
   catch(error){this.fail(entry,error);item.cancel();}
  }
 }
 show(win,id){const saved=this.completed.get(id);if(!saved||saved.win!==win)throw Error('Không tìm thấy tệp đã lưu trong cửa sổ này.');return this.reveal(saved.path);}
}
module.exports={Downloads,sourceAllowed,safeName,reserve};
