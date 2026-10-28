/* Deterministic preview scheduler. No AI, browser automation or network operations. */
(function(root){
 const copy=value=>JSON.parse(JSON.stringify(value));
 const capabilities={muse:['vision','text','image','video'],gemini:['vision','text','image'],chatgpt:['vision','text','image'],local:['assemble']};
 const labels={vision:'Đọc ảnh sản phẩm',text:'Viết kịch bản',image:'Tạo ảnh',video:'Tạo video',assemble:'Ghép thành phẩm'};
 const defaultWorkflow=()=>({id:'fashion',name:'Video bán hàng · Ảnh → Thành phẩm',version:1,ratio:'9:16',scenes:3,duration:null,steps:Object.entries(labels).map(([type,name],i)=>({id:'step-'+i,type,name,provider:type==='assemble'?'local':'muse',prompt:type==='text'?'Viết kịch bản tiếng Việt theo thông tin sản phẩm. Không tự tạo giá bán hoặc công dụng.':type==='video'?'Giữ đúng sản phẩm, màu sắc và nhân vật. Chuyển động tự nhiên, máy quay ổn định.':''}))});
 const defaultWorkers=()=>[...Array.from({length:4},(_,i)=>({id:'muse-'+(i+1),name:'Muse · Tab '+String(i+1).padStart(2,'0'),provider:'muse',selected:true,online:true})),...Array.from({length:2},(_,i)=>({id:'gemini-'+(i+1),name:'Gemini · Tab '+(i+1),provider:'gemini',selected:false,online:true})),{id:'chatgpt-1',name:'ChatGPT · Tab 1',provider:'chatgpt',selected:false,online:true},{id:'local',name:'Trên máy',provider:'local',selected:true,online:true}];
 function validate(workflow,workers){if(!String(workflow.name||'').trim())throw Error('Đặt tên cho luồng trước khi lưu.');if(workflow.steps?.length>12)throw Error('Bản xem trước hỗ trợ tối đa 12 bước.');if(workflow.steps?.filter(s=>s.type==='assemble').length>1)throw Error('Luồng mẫu chỉ dùng một bước Ghép thành phẩm ở cuối.');if(!workflow.steps?.length)throw Error('Luồng cần ít nhất một bước.');if(workflow.steps.at(-1).type!=='assemble')throw Error('Bước cuối cần là Ghép thành phẩm.');if(!workflow.steps.some(s=>s.type==='video'))throw Error('Luồng cần có bước Tạo video.');for(const step of workflow.steps){if(!capabilities[step.provider]?.includes(step.type))throw Error(step.name+': AI đã chọn không hỗ trợ bước này.');if(!workers.some(w=>w.selected&&w.online&&w.provider===step.provider))throw Error(step.name+': chưa chọn tab '+step.provider+' đang sẵn sàng.');}return true;}
 function create(data,{onEvent=()=>{}}={}){
  let sequence=0;const event=(job,message,kind='info')=>{job.logs=job.logs||[];job.logs.push({at:new Date().toISOString(),message,kind});job.logs=job.logs.slice(-80);onEvent(job,message,kind);};
  const release=job=>{job.active=null;};
  const enqueue=(ids,workflow)=>{const jobs=data.jobs.filter(j=>ids.includes(j.id)&&j.state==='draft');if(!jobs.length)return 0;validate(workflow,data.workers);for(const job of jobs){if(!job.images?.length)throw Error(job.name+': chưa có ảnh sản phẩm.');}for(const job of jobs){job.plan=copy(workflow);job.inputSnapshot=copy(job.images);job.state='queued';job.step=0;job.progress=0;job.error='';job.active=null;job.attempts={};job.completed=[];job.resultId=null;event(job,'Đã chốt luồng v'+workflow.version+' và ảnh đầu vào. Chưa gửi AI.');}return jobs.length;};
  const retry=id=>{const job=data.jobs.find(j=>j.id===id);if(!job||!['error','stopped'].includes(job.state))return;job.state='queued';job.error='';job.active=null;event(job,'Chạy tiếp từ bước chưa đạt; giữ các bước đã hoàn tất.');};
  const stop=id=>{const job=data.jobs.find(j=>j.id===id);if(!job||!['running','queued'].includes(job.state))return;release(job);job.state='stopped';event(job,'Đã dừng tác vụ mô phỏng.','warning');};
  const tick=milliseconds=>{
   const delta=Math.max(0,Math.min(1000,milliseconds));
   for(const job of data.jobs){if(!job.active)continue;const attempt=job.active,step=job.plan.steps[job.step];attempt.elapsed+=delta;job.progress=(job.step+Math.min(1,attempt.elapsed/attempt.total))/job.plan.steps.length*100;if(attempt.elapsed<attempt.total)continue;
    if(job.failNext){job.failNext=false;job.progress=job.step/job.plan.steps.length*100;job.state='error';job.error='Mô phỏng: tab mất phản hồi ở bước “'+step.name+'”. Kiểm tra tab rồi chạy lại riêng bước này.';event(job,job.error,'error');release(job);continue;}
    job.completed=job.completed||[];job.completed.push({stepId:step.id,attemptId:attempt.id,workerId:attempt.workerId,inputProductId:job.id});event(job,step.name+' hoàn tất · '+attempt.workerName);release(job);job.step++;
    if(job.step===job.plan.steps.length){job.state='done';job.progress=100;job.resultId='demo-video';event(job,'Luồng mô phỏng hoàn tất. Clip xem trước là video mẫu 12 giây, không phải kết quả AI.','success');}else job.state='queued';
   }
   if(!data.running)return;
   const busy=new Set(data.jobs.filter(j=>j.active).map(j=>j.active.workerId));let activeAI=data.jobs.filter(j=>j.active&&j.active.provider!=='local').length;
   for(const job of data.jobs){if(job.state!=='queued'||job.active)continue;const step=job.plan?.steps[job.step];if(!step)continue;if(step.provider!=='local'&&activeAI>=data.maxConcurrent)continue;
    const worker=data.workers.find(w=>w.provider===step.provider&&w.selected&&w.online&&!busy.has(w.id));if(!worker)continue;
    job.attempts=job.attempts||{};job.attempts[step.id]=(job.attempts[step.id]||0)+1;job.active={id:'attempt-'+(++sequence)+'-'+job.id,workerId:worker.id,workerName:worker.name,provider:worker.provider,elapsed:0,total:data.speed*(step.type==='video'?1.7:step.type==='assemble'?.6:1)};job.state='running';busy.add(worker.id);if(worker.provider!=='local')activeAI++;event(job,step.name+' → '+worker.name+' · ngữ cảnh riêng '+job.sku);
   }
   if(!data.jobs.some(j=>['running','queued'].includes(j.state)))data.running=false;
  };
  return {enqueue,retry,stop,tick,validate:()=>validate(data.workflow,data.workers)};
 }
 const api={copy,capabilities,labels,defaultWorkflow,defaultWorkers,validate,create};if(typeof module!=='undefined')module.exports=api;else root.MooZBatchModel=api;
})(globalThis);
