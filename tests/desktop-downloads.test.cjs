'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {Downloads,sourceAllowed,safeName}=require('../desktop/downloads.cjs');
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'workflow-download-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const win=new EventEmitter();Object.assign(win,{projectId:'project',isDestroyed:()=>false,webContents:{id:1,downloadURL:url=>{win.calls.push(url);}}});win.calls=[];
 const events=[],revealed=[];const manager=new Downloads({directory:()=>dir,windowFor:()=>win,dialog:{showSaveDialog:async()=>({canceled:true})},notify:(_win,event)=>events.push(event),reveal:file=>revealed.push(file)});
 function receive(url,name='video.mp4',size=8){const item=new EventEmitter();Object.assign(item,{getURL:()=>url,getFilename:()=>name,getTotalBytes:()=>size,getReceivedBytes:()=>size,setSavePath:file=>{item.file=file;},cancel:()=>item.emit('done',{},'cancelled')});let prevented=false;manager.receive({preventDefault(){prevented=true;}},item,win.webContents);return {item,prevented};}
 return {dir,win,events,revealed,manager,receive};
}
test('exports reserve unique files, coalesce concurrent clicks and reveal only to the owning window',async t=>{
 const f=fixture(t),url='blob:workflow://app/first';fs.writeFileSync(path.join(f.dir,'video.mp4'),'original');
 const a=f.manager.download(f.win,{url,filename:'video.mp4'}),b=f.manager.download(f.win,{url,filename:'video.mp4'});assert.equal(a,b);assert.equal(f.win.calls.length,1);
 const {item}=f.receive(url);assert.equal(path.basename(item.file),'video (1).mp4');fs.writeFileSync(item.file,'new video');item.emit('done',{},'completed');const id=await a;assert.equal(await b,id);assert.equal(fs.readFileSync(path.join(f.dir,'video.mp4'),'utf8'),'original');
 f.manager.show(f.win,id);assert.deepEqual(f.revealed,[item.file]);assert.throws(()=>f.manager.show({},id));assert.equal(f.manager.pending.size,0);
});
test('cancelled/oversized exports remove partial files, preserve existing files and release the retry lock',async t=>{
 const f=fixture(t),url='blob:workflow://app/cancel';const promise=f.manager.download(f.win,{url,filename:'video.mp4'}),{item}=f.receive(url);fs.writeFileSync(item.file,'partial');item.cancel();await assert.rejects(promise,/hủy/);assert.equal(fs.existsSync(item.file),false);assert.equal(f.manager.pending.size,0);
 const next=f.manager.download(f.win,{url});const rejected=f.receive(url,'video.mp4',129*1024*1024);await assert.rejects(next,/128 MB/);assert.equal(rejected.prevented,true);assert.equal(f.manager.pending.size,0);
});
test('explicit Save As cancellation opens no download; automatic anchors never request a save dialog',async t=>{
 const f=fixture(t);assert.equal(await f.manager.download(f.win,{url:'blob:workflow://app/save',filename:'video.mp4',saveAs:true}),null);assert.equal(f.win.calls.length,0);
 f.manager.dialog.showSaveDialog=()=>{throw Error('Unexpected modal');};const {item}=f.receive('blob:workflow://app/anchor');fs.writeFileSync(item.file,'anchor');item.emit('done',{},'completed');assert.equal(f.events.at(-1).state,'completed');
});
test('download sources and filenames cannot request arbitrary local paths',t=>{
 const f=fixture(t);for(const url of ['file:///etc/passwd','blob:https://muse.ai/secret','blob:workflow://evil/id','javascript:alert(1)','https://evil.test/video']){assert.equal(sourceAllowed(url),false);assert.throws(()=>f.manager.download(f.win,{url}));}
 assert.equal(safeName('../../video.mp4'),'video.mp4');assert.equal(safeName('..'),'Workflow-ket-qua');
});
