'use strict';

const STATES=new Set(['draft','ready','captioning','prepared','staged','queued','scheduled','uploading','publishing','submitted','published','error','uncertain']);
const PRIVACY=['PUBLIC_TO_EVERYONE','MUTUAL_FOLLOW_FRIENDS','FOLLOWER_OF_CREATOR','SELF_ONLY'];

function options(value={}){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Thiết lập đăng bài không hợp lệ.');
 const result={};
 if(value.youtube){
  const v=value.youtube;if(!['','private','unlisted','public'].includes(v.privacy||'')||![undefined,null,true,false].includes(v.madeForKids))throw Error('Thiết lập YouTube không hợp lệ.');
  result.youtube={title:String(v.title||'').slice(0,100),privacy:v.privacy||'',madeForKids:typeof v.madeForKids==='boolean'?v.madeForKids:null,synthetic:v.synthetic===true};
 }
 if(value.tiktok){
  const v=value.tiktok;if(v.privacy&&!PRIVACY.includes(v.privacy))throw Error('Thiết lập quyền riêng tư TikTok không hợp lệ.');
  result.tiktok={privacy:v.privacy||'',musicRights:v.musicRights===true,synthetic:v.synthetic===true,branded:v.branded===true,ownBrand:v.ownBrand===true,disableComment:v.disableComment!==false,disableDuet:v.disableDuet!==false,disableStitch:v.disableStitch!==false};
 }
 return result;
}

function event(job,status,message='',code=''){
 job.history=Array.isArray(job.history)?job.history.slice(-79):[];
 job.history.push({at:new Date().toISOString(),status,message:String(message||'').slice(0,500),code:/^[A-Z0-9_]{1,50}$/.test(code)?code:''});
}

function revisionSource(job){const value=String(job.sourceKey||job.id),prefix=String(job.projectId)+':';return value.startsWith(prefix)?prefix+value.slice(prefix.length).split(':')[0]:value;}
function summary(job){
 const {sourceKey,sourcePrompt,mediaHash,internal,dispatch,...safe}=job;
 safe.revisionGroup=job.sourceKey?require('node:crypto').createHash('sha256').update(revisionSource(job)).digest('hex').slice(0,24):job.id;
 safe.media=(job.media||[]).map(({file,...media})=>media);
 return safe;
}

function validateJob(job,id){
 if(!job||Array.isArray(job)||job.id!==id||!STATES.has(job.status)||typeof job.title!=='string'||(typeof job.createdAt!=='string'||!Number.isFinite(Date.parse(job.createdAt)))||!Array.isArray(job.media)||!job.media.length||job.media.length>11)throw Error('Bản lưu bài đăng không hợp lệ.');
 for(const [index,m]of job.media.entries()){
  if(!m||(m.kind==='image'&&!m.mime?.startsWith('image/'))||(m.kind==='video'&&!m.mime?.startsWith('video/'))||(m.role==='preview'&&m.kind!=='image')||!['image','video'].includes(m.kind)||!['output','preview'].includes(m.role)||!['image/png','image/jpeg','video/mp4','video/webm','video/quicktime'].includes(m.mime)||!Number.isSafeInteger(m.size)||m.size<1||m.size>128*1024*1024||!new RegExp('^'+index+'\\.(?:png|jpg|mp4|webm|mov)$').test(m.file||''))throw Error('Thông tin tệp của bài đăng không hợp lệ.');
 }
 return job;
}

module.exports={STATES,PRIVACY,options,event,summary,validateJob,revisionSource};
