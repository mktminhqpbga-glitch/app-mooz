'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),{randomUUID}=require('node:crypto');
const C=require('../agent-contract.js'),{createHash}=require('node:crypto');
const ID=/^[a-f0-9-]{36}$/;
class AgentStore{
 constructor(root){this.root=root;this.writes=Promise.resolve();}
 directory(project){if(!ID.test(project||''))throw Error('Dự án Agent không hợp lệ.');return path.join(this.root,project);}
 file(project,id){if(!ID.test(id||''))throw Error('Nhiệm vụ Agent không hợp lệ.');return path.join(this.directory(project),id+'.json');}
 async read(project,id){const r=JSON.parse(await fs.readFile(this.file(project,id),'utf8'));if(r.version!==1||r.id!==id||r.projectId!==project||!Array.isArray(r.events)||!Array.isArray(r.steps)||!r.brief)throw Error('Nhật ký Agent bị lỗi; giữ nguyên bản gốc, chưa chạy lại.');
  C.brief(r.brief,{allowPast:true});if(!r.used||!['aiCalls','repairs','elapsedMs'].every(k=>Number.isFinite(r.used[k])&&r.used[k]>=0))throw Error('Hạn mức trong nhật ký không hợp lệ.');
  if(r.plan){const checked=C.plan({summary:r.plan.summary,steps:r.plan.steps},r.brief);if(JSON.stringify(checked)!==JSON.stringify(r.plan)||createHash('sha256').update(JSON.stringify(r.plan)).digest('hex')!==r.planHash||r.approvedHash&&r.approvedHash!==r.planHash)throw Error('Kế hoạch trong nhật ký đã thay đổi; chưa chạy lại.');if(r.steps.length!==r.plan.steps.length||r.steps.some((s,i)=>s.id!==r.plan.steps[i].id||s.tool!==r.plan.steps[i].tool||!Array.isArray(s.attempts)))throw Error('Các bước trong nhật ký chưa khớp kế hoạch.');}
  return r;}
 async list(project){let names;try{names=await fs.readdir(this.directory(project));}catch(e){if(e.code==='ENOENT')return [];throw e;}const result=[];for(const n of names)if(/^[a-f0-9-]{36}\.json$/.test(n)){try{result.push(await this.read(project,n.slice(0,-5)));}catch{result.push({id:n.slice(0,-5),status:'corrupt',goal:'Nhiệm vụ cần khôi phục',error:'Không đọc được nhật ký; dữ liệu gốc được giữ nguyên.'});}}return result.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));}
 save(r){const copy=structuredClone(r);if(Buffer.byteLength(JSON.stringify(copy))>4*1024*1024)return Promise.reject(Error('Nhật ký Agent vượt 4 MB.'));const task=this.writes.catch(()=>{}).then(async()=>{await fs.mkdir(this.directory(copy.projectId),{recursive:true});copy.updatedAt=new Date().toISOString();const file=this.file(copy.projectId,copy.id),temp=file+'.'+randomUUID()+'.tmp';try{await fs.writeFile(temp,JSON.stringify(copy),{mode:0o600});await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true});}});this.writes=task;return task;}
 async recover(){let projects;try{projects=await fs.readdir(this.root);}catch(e){if(e.code==='ENOENT')return;throw e;}for(const p of projects.filter(x=>ID.test(x)))for(const r of await this.list(p)){if(['planning','running','verifying','repairing'].includes(r.status)){r.status='paused';r.error='App dừng giữa tác vụ. Đối chiếu đầu ra trước khi tiếp tục; không tự gửi lại.';for(const s of r.steps)if(['running','verifying'].includes(s.status)){s.status='unknown';s.error=r.error;}r.current=null;await this.save(r);}}}
 async memory(project){const runs=await this.list(project);return runs.filter(r=>r.status==='completed').slice(0,5).map(r=>({goal:r.brief.goal.slice(0,500),summary:r.plan?.summary.slice(0,500),artifacts:r.steps.filter(s=>s.result?.artifact).map(s=>{const a=s.result.artifact;return {kind:a.kind,width:a.width,height:a.height,duration:a.duration};}).slice(-6)}));}
}
module.exports={AgentStore};
