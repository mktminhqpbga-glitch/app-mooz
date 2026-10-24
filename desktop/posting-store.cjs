'use strict';
const fs=require('node:fs/promises');
const {constants}=require('node:fs');
const path=require('node:path');
const {randomUUID,createHash}=require('node:crypto');
const ID=/^[a-f0-9-]{36}$/;
const MIME={'image/png':'png','image/jpeg':'jpg','video/mp4':'mp4','video/webm':'webm','video/quicktime':'mov'};
const MAX=128*1024*1024;
class PostingStore{
 constructor(root){this.root=root;this.drafts=new Map();this.queue=Promise.resolve();}
 serial(fn){const next=this.queue.catch(()=>{}).then(fn);this.queue=next;return next;}
 folder(id){if(!ID.test(id||''))throw Error('Mã bài không hợp lệ.');return path.join(this.root,'jobs',id);}
 async init(){await fs.mkdir(path.join(this.root,'jobs'),{recursive:true});await fs.rm(path.join(this.root,'.staging'),{recursive:true,force:true});await fs.mkdir(path.join(this.root,'.staging'),{recursive:true});for(const job of await this.list()){if(['publishing','captioning','uploading'].includes(job.status)){const old=job.status;job.status=old==='publishing'?'uncertain':old==='uploading'?'error':'draft';job.error=job.status==='uncertain'?'Ứng dụng dừng trong lúc gửi bài. Kiểm tra nền tảng trước khi xử lý tiếp.':old==='uploading'?'Tải media bị gián đoạn trước bước gửi bài. Có thể xếp lại hàng chờ.':'Lượt viết content đã dừng; chưa gửi lại.';job.autoPublish=false;await this.save(job);}}}
 async list(){let names;try{names=await fs.readdir(path.join(this.root,'jobs'));}catch(error){if(error.code==='ENOENT')return [];throw error;}const jobs=[];for(const id of names){if(!ID.test(id))continue;try{jobs.push(await this.read(id));}catch{jobs.push({id,title:'Bài cần khôi phục',status:'error',error:'Không đọc được bản lưu của bài này. Dữ liệu gốc được giữ nguyên trên máy.',recoveryRequired:true,media:[],createdAt:'1970-01-01T00:00:00.000Z'});}}return jobs.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));}
 async read(id){return JSON.parse(await fs.readFile(path.join(this.folder(id),'job.json'),'utf8'));}
 async save(job){job.updatedAt=new Date().toISOString();const file=path.join(this.folder(job.id),'job.json'),temp=file+'.tmp';await fs.writeFile(temp,JSON.stringify(job,null,2),{mode:0o600});await fs.rename(temp,file);return job;}
 begin(owner,projectId,data){return this.serial(async()=>{
  const media=data.media;if(!Array.isArray(media)||!media.length||media.length>11)throw Error('Một bài nhận tối đa 8 ảnh hoặc 1 video và 3 khung minh họa.');
  const outputs=media.filter(x=>x.role!=='preview');if(!outputs.length||outputs.length>8||outputs.some(x=>!['image','video'].includes(x.kind))||outputs.some(x=>x.kind==='video')&&outputs.length!==1)throw Error('Chọn tối đa 8 ảnh hoặc một video cho mỗi bài.');
  let total=0;for(const m of media){if(!MIME[m.mime]||!Number.isSafeInteger(m.size)||m.size<=0||m.size>MAX||m.kind==='image'&&!m.mime.startsWith('image/')||m.kind==='video'&&!m.mime.startsWith('video/')||m.role==='preview'&&m.kind!=='image')throw Error('Tệp ảnh/video không hợp lệ hoặc vượt 128 MB.');total+=m.size;}
  if(total>256*1024*1024)throw Error('Tổng tệp của một bài tối đa 256 MB.');
  const sourceKey=String(projectId)+':'+String(data.sourceKey||'').slice(0,1000);
  const id=randomUUID(),folder=path.join(this.root,'.staging',id);await fs.mkdir(folder);
  const job={id,sourceKey,title:String(data.title||'Bài mới').slice(0,160),projectId,sourcePrompt:String(data.sourcePrompt||'').slice(0,12000),createdAt:new Date().toISOString(),status:'draft',caption:'',connectionId:'',autoPublish:false,media:media.map((m,i)=>({kind:m.kind,mime:m.mime,size:m.size,name:String(m.name||'Tệp '+(i+1)).slice(0,160),role:m.role==='preview'?'preview':'output',file:i+'.'+MIME[m.mime]}))};
  this.drafts.set(id,{owner,folder,job,sizes:media.map(()=>0),hashes:media.map(()=>createHash('sha256'))});return {id,existing:false};
 });}
 append(owner,{id,index,offset,bytes}){return this.serial(async()=>{const draft=this.drafts.get(id);if(!draft||draft.owner!==owner)throw Error('Lượt nhập tệp đã hết hạn.');if(!Number.isInteger(index)||!draft.job.media[index]||offset!==draft.sizes[index]||!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>1024*1024||offset+bytes.length>draft.job.media[index].size)throw Error('Khối tệp không hợp lệ.');await fs.appendFile(path.join(draft.folder,draft.job.media[index].file),bytes,{mode:0o600});draft.hashes[index].update(bytes);draft.sizes[index]+=bytes.length;});}
 commit(owner,id){return this.serial(async()=>{const d=this.drafts.get(id);if(!d||d.owner!==owner||d.job.media.some((m,i)=>m.size!==d.sizes[i]))throw Error('Chưa nhận đủ tệp; bài chưa được thêm.');d.job.mediaHash=d.hashes.map((h,i)=>d.job.media[i].mime+':'+d.job.media[i].role+':'+h.digest('hex')).join('|');const existing=(await this.list()).find(j=>j.sourceKey===d.job.sourceKey&&j.mediaHash===d.job.mediaHash);if(existing){await fs.rm(d.folder,{recursive:true,force:true});this.drafts.delete(id);return existing;}d.job.updatedAt=new Date().toISOString();await fs.writeFile(path.join(d.folder,'job.json'),JSON.stringify(d.job),{mode:0o600});await fs.rename(d.folder,this.folder(id));this.drafts.delete(id);return d.job;});}
 abort(owner,id){return this.serial(async()=>{const d=this.drafts.get(id);if(d?.owner===owner){this.drafts.delete(id);await fs.rm(d.folder,{recursive:true,force:true});}});}
 async cleanup(owner){for(const [id,d]of this.drafts)if(d.owner===owner)await this.abort(owner,id);}
 async mediaPath(id,index){const j=await this.read(id);if(!Number.isInteger(index)||!j.media[index])throw Error('Không tìm thấy tệp.');return path.join(this.folder(id),j.media[index].file);}
 async remove(id){await fs.mkdir(path.join(this.root,'.trash'),{recursive:true});await fs.rename(this.folder(id),path.join(this.root,'.trash',id));}
 async destination(source,connectionId,scheduledAt){
  const existing=(await this.list()).find(j=>j.parentId===source.id&&j.connectionId===connectionId);if(existing)return existing;
  const id=randomUUID(),folder=path.join(this.root,'.staging',id);await fs.mkdir(folder);try{for(const m of source.media)await fs.copyFile(path.join(this.folder(source.id),m.file),path.join(folder,m.file),constants.COPYFILE_FICLONE);const job={...structuredClone(source),id,parentId:source.id,sourceKey:source.id+':'+connectionId,connectionId,autoPublish:false,status:scheduledAt?'scheduled':'queued',scheduledAt:scheduledAt||null,result:null,error:'',createdAt:new Date().toISOString()};job.updatedAt=new Date().toISOString();await fs.writeFile(path.join(folder,'job.json'),JSON.stringify(job),{mode:0o600});await fs.rename(folder,this.folder(id));return job;}catch(error){await fs.rm(folder,{recursive:true,force:true});throw error;}
 }
 async copyDraft(source){const id=randomUUID(),folder=path.join(this.root,'.staging',id);await fs.mkdir(folder);try{for(const m of source.media)await fs.copyFile(path.join(this.folder(source.id),m.file),path.join(folder,m.file),constants.COPYFILE_FICLONE);const job={...structuredClone(source),id,sourceKey:'copy:'+id,parentId:null,connectionId:'',connectionIds:[],autoPublish:false,status:'draft',scheduledAt:null,result:null,error:'',deliveryError:'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};await fs.writeFile(path.join(folder,'job.json'),JSON.stringify(job),{mode:0o600});await fs.rename(folder,this.folder(id));return job;}catch(error){await fs.rm(folder,{recursive:true,force:true});throw error;}}
}
module.exports={PostingStore,MIME};
