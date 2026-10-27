'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{randomUUID,createHash}=require('node:crypto');
function redact(value,secrets=[]){
 let text=String(value||'').slice(0,16000);
 for(const secret of secrets)if(typeof secret==='string'&&secret.length>=6)text=text.split(secret).join('[secret]');
 return text.replace(/(?:https?|workflow-connect|workflow|file|blob|data):[^\s<>"']+/gi,'[url]')
  .replace(/\bBearer\s+[^\s,"'}]+/gi,'Bearer [secret]')
  .replace(/(["']?(?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|password|secret|authorization|cookie)["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;}]+)/gi,'$1[secret]')
  .replace(/\b(?:sk-|gsk_|AIza|gh[pousr]_|EAAB)[A-Za-z0-9_\-]{8,}/g,'[secret]')
  .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,'[secret]')
  .replace(/(?:[A-Z]:\\|\/(?:Users|home|workspace|tmp|private|var|Volumes|Applications|opt)\/)[^\s<>"')]+/gi,'[path]')
  .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[email]');
}
class Diagnostics{
 constructor(directory,{version,secretValues=()=>[]}={}){this.file=path.join(directory,'diagnostics.json');this.version=version||'unknown';this.secretValues=secretValues;this.records=[];this.writes=Promise.resolve();this.warning='';}
 clean(value,max=2000){return redact(value,this.secretValues()).slice(0,max);}
 async init(){try{const stat=await fs.stat(this.file);if(stat.size>2*1024*1024)throw Error('size');const value=JSON.parse(await fs.readFile(this.file,'utf8'));if(value.version!==1||!Array.isArray(value.records)||value.records.length>200)throw Error('schema');for(const r of value.records){if(!r||typeof r.id!=='string'||!/^([a-f0-9]{8}-){1}[a-f0-9-]{27}$/i.test(r.id)||!['open','resolved'].includes(r.status)||typeof r.message!=='string'||!Number.isFinite(Date.parse(r.firstAt))||!Number.isFinite(Date.parse(r.lastAt)))throw Error('record');}this.records=value.records.map(r=>this.normalise(r));}catch(e){if(e.code!=='ENOENT'){this.records=[];try{await fs.rename(this.file,this.file+'.invalid-'+randomUUID());this.warning='Tệp báo lỗi cũ không đọc được; đã giữ bản sao, danh sách mới sẵn sàng.';}catch{this.warning='Chưa đọc được lịch sử báo lỗi. App vẫn hoạt động; kiểm tra quyền lưu tệp.';}}}return this.snapshot();}
 normalise(r){const message=this.clean(r.message),source=this.clean(r.source||'app',100),surface=['library','canvas','affiliate','posting','desktop'].includes(r.surface)?r.surface:'desktop';return {id:r.id,source,surface,message,notes:this.clean(r.notes),status:r.status,firstAt:r.firstAt,lastAt:r.lastAt,count:Number.isInteger(r.count)&&r.count>0?Math.min(r.count,100000):1,appVersion:this.clean(r.appVersion||this.version,40),fingerprint:createHash('sha256').update([surface,source,message].join('\n')).digest('hex')};}
 snapshot(){return {records:this.records.map(r=>{const {fingerprint,...publicRecord}=this.normalise(r);return publicRecord;}),warning:this.warning,open:this.records.filter(r=>r.status==='open').length};}
 mutate(fn){const task=this.writes.catch(()=>{}).then(async()=>{fn();this.records=this.records.slice(-200);try{await fs.mkdir(path.dirname(this.file),{recursive:true});const temp=this.file+'.tmp';await fs.writeFile(temp,JSON.stringify({version:1,records:this.records.map(r=>this.normalise(r))}),{mode:0o600});await fs.rename(temp,this.file);this.warning='';}catch{this.warning='Chưa lưu được báo lỗi xuống đĩa; danh sách hiện chỉ giữ trong phiên này.';}return this.snapshot();});this.writes=task;return task;}
 record(input={}){if(typeof input.message!=='string'||!input.message.trim())return Promise.reject(Error('Nhập mô tả lỗi.'));const now=new Date().toISOString(),entry=this.normalise({id:randomUUID(),source:input.source,surface:input.surface,message:input.message,notes:input.notes,status:'open',count:1,appVersion:this.version,firstAt:now,lastAt:now});return this.mutate(()=>{const old=this.records.find(r=>r.fingerprint===entry.fingerprint);if(old){old.count++;old.lastAt=now;old.status='open';if(entry.notes)old.notes=entry.notes;}else this.records.push(entry);});}
 update({id,status,notes}){if(!['open','resolved'].includes(status)||notes!==undefined&&typeof notes!=='string')return Promise.reject(Error('Trạng thái báo lỗi không hợp lệ.'));return this.mutate(()=>{const row=this.records.find(r=>r.id===id);if(!row)throw Error('Không tìm thấy báo lỗi.');row.status=status;if(notes!==undefined)row.notes=this.clean(notes);});}
 clearResolved(){return this.mutate(()=>{this.records=this.records.filter(r=>r.status!=='resolved');});}
 async report(){await this.writes.catch(()=>{});return JSON.stringify({format:'mooz-error-report',version:1,appVersion:this.version,system:{platform:process.platform,release:os.release(),arch:process.arch},exportedAt:new Date().toISOString(),...this.snapshot()},null,2);}
}
module.exports={Diagnostics,redact};
