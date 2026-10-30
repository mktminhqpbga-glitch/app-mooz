/* Real asynchronous batch scheduler. Persist an intent before sending to an AI. */
(function(root){'use strict';
 const copy=value=>JSON.parse(JSON.stringify(value));
 const capabilities={muse:['vision','text','image','video'],gemini:['vision','text','image'],chatgpt:['vision','text','image'],grok:['vision','text','image','video'],flow:['image','video'],local:['assemble']};
 const labels={vision:'Đọc ảnh sản phẩm',text:'Viết kịch bản',image:'Tạo ảnh',video:'Tạo video',assemble:'Ghép thành phẩm'};
 const defaultWorkers=()=>[{id:'local',name:'Trên máy',provider:'local',selected:true,online:true}];
 const defaultWorkflow=()=>({id:'sales',name:'Video bán hàng · Ảnh → Thành phẩm',version:1,ratio:'9:16',scenes:3,duration:null,steps:Object.entries(labels).map(([type,name],i)=>({id:'step-'+i,type,name,provider:type==='assemble'?'local':'muse',prompt:type==='text'?'Viết kịch bản tiếng Việt theo thông tin sản phẩm; chia rõ từng cảnh. Không tự tạo giá bán hoặc công dụng.':type==='video'?'Giữ đúng sản phẩm, màu sắc và nhân vật. Chuyển động tự nhiên, máy quay ổn định.':''}))});
 function validate(w,workers,{requireTabs=true}={}){
  if(!String(w.name||'').trim()||!w.steps?.length||w.steps.length>12)throw Error('Đặt tên luồng và chọn từ 1 đến 12 bước.');
  if(!Number.isInteger(w.scenes)||w.scenes<1||w.scenes>12)throw Error('Số cảnh từ 1 đến 12.');
  if(!['9:16','16:9','1:1'].includes(w.ratio)||w.duration!==null&&![5,10,15,30,40].includes(w.duration))throw Error('Tỷ lệ hoặc thời lượng không hợp lệ.');
  if(w.steps.filter(s=>s.type==='assemble').length!==1||w.steps.at(-1).type!=='assemble'||!w.steps.some(s=>s.type==='video'))throw Error('Cần bước Tạo video và một bước Ghép thành phẩm ở cuối.');
  if(new Set(w.steps.map(s=>s.id)).size!==w.steps.length)throw Error('Mã bước bị trùng.');
  for(const s of w.steps){if(!capabilities[s.provider]?.includes(s.type))throw Error(s.name+': AI không hỗ trợ loại bước này.');if(requireTabs&&!workers.some(t=>t.selected&&t.online&&t.provider===s.provider))throw Error(s.name+': chưa chọn tab '+s.provider+' đang mở.');}return true;
 }
 function refreshWorkers(previous,tabs){
  const old=new Map(previous.map(w=>[w.id,w])),next=tabs.map(t=>{const id=t.transport+':'+t.id,p=old.get(id);return {id,tabId:t.id,transport:t.transport,provider:t.provider,name:p?.customName||t.title||t.provider,url:t.url,selected:p?.selected||false,online:true,customName:p?.customName};});
  // Keep missing selections visible so queued jobs never silently switch providers.
  for(const w of previous)if(w.provider!=='local'&&!next.some(t=>t.id===w.id))next.push({...w,online:false});
  return [...next,...defaultWorkers()];
 }
 function create(data,{onEvent=()=>{},persist=()=>{},run=async()=>{throw Error('Chưa kết nối bộ chạy.');},cancel=()=>{}}={}){
  const leases=new Map();
  const event=(j,message,kind='info')=>{j.logs||=[];j.logs.push({at:new Date().toISOString(),message,kind});j.logs=j.logs.slice(-100);persist();onEvent(j,message,kind);};
  // A crashed/incomplete request is uncertain. It must never be sent again automatically.
  for(const j of data.jobs){if(j.state==='running'){j.state='error';j.error='Phiên chạy bị gián đoạn. Kiểm tra kết quả trong tab AI trước khi bấm chạy tiếp để tránh tạo trùng.';j.active=null;}else if(j.active)j.active=null;}
  const enqueue=(ids,w)=>{const jobs=data.jobs.filter(j=>ids.includes(j.id)&&j.state==='draft');if(!jobs.length)return 0;validate(w,data.workers);for(const j of jobs)if(!j.images?.length||j.images.length>8)throw Error(j.name+': cần từ 1 đến 8 ảnh tham chiếu.');for(const j of jobs){Object.assign(j,{plan:copy(w),inputSnapshot:copy(j.images),nameSnapshot:j.name,noteSnapshot:j.note,state:'queued',step:0,progress:0,error:'',active:null,attempts:{},completed:[],outputs:{},resultId:null});event(j,'Đã chốt luồng v'+w.version+' và đầu vào riêng. Chưa gửi AI.');}return jobs.length;};
  const retry=id=>{const j=data.jobs.find(j=>j.id===id);if(!j||!['error','stopped'].includes(j.state))return;if(leases.has(j.id))throw Error('Đang chờ tab xác nhận dừng.');j.state='queued';j.error='';event(j,'Tiếp tục từ cảnh/bước chưa hoàn tất; giữ kết quả đã lưu.');};
  const stop=id=>{const j=data.jobs.find(j=>j.id===id);if(!j||!['queued','running'].includes(j.state))return;j.state='stopped';if(j.active)cancel(j.active.workerId);event(j,'Đã yêu cầu dừng. Tab chỉ được nhận việc mới khi yêu cầu cũ kết thúc.','warning');};
  function tick(){
   if(!data.running)return;
   const busy=new Set([...leases.values()].map(l=>l.worker.id));let ai=[...leases.values()].filter(l=>l.worker.provider!=='local').length;
   for(const j of data.jobs){if(j.state!=='queued'||leases.has(j.id))continue;const step=j.plan?.steps[j.step];if(!step||data.providerHolds?.[step.provider])continue;if(step.provider!=='local'&&ai>=data.maxConcurrent)continue;const worker=data.workers.find(w=>w.selected&&w.online&&w.provider===step.provider&&!busy.has(w.id));if(!worker)continue;
    const lease={id:crypto.randomUUID(),worker:copy(worker)};leases.set(j.id,lease);busy.add(worker.id);if(worker.provider!=='local')ai++;j.attempts||={};j.attempts[step.id]=(j.attempts[step.id]||0)+1;j.active={id:lease.id,workerId:worker.id,workerName:worker.name,provider:worker.provider,elapsed:0,total:1};j.state='running';
    try{event(j,step.name+' → '+worker.name);}catch(error){leases.delete(j.id);j.state='error';j.active=null;j.error='Không lưu được nhật ký; chưa gửi AI: '+error.message;data.running=false;continue;}
    Promise.resolve().then(()=>run(j,step,lease.worker,()=>{if(j.state==='stopped')throw Error('Đã dừng.');persist();})).then(result=>{if(j.state==='stopped')return;if(j.step===j.plan.steps.length-1&&!result?.resultId)throw Error('Chưa có tệp video đã lưu.');j.completed.push({stepId:step.id,attemptId:lease.id,workerId:worker.id,inputProductId:j.id});j.step++;j.progress=j.step/j.plan.steps.length*100;j.active=null;if(j.step===j.plan.steps.length){j.resultId=result.resultId;j.state='done';event(j,'Đã lưu video thành phẩm. Sẵn sàng xem và hậu kỳ.','success');}else{j.state='queued';event(j,step.name+' hoàn tất.');}}).catch(error=>{if(j.state!=='stopped'){j.state='error';j.error=error.message;try{event(j,error.message,'error');}catch{data.running=false;}}}).finally(()=>{j.active=null;leases.delete(j.id);try{persist();}catch{data.running=false;}tick();});
   }
   if(!leases.size&&!data.jobs.some(j=>j.state==='queued'))data.running=false;
  }
  return {enqueue,retry,stop,tick,validate:()=>validate(data.workflow,data.workers),get busy(){return leases.size>0;}};
 }
 const api={copy,capabilities,labels,defaultWorkers,defaultWorkflow,validate,refreshWorkers,create};if(typeof module!=='undefined')module.exports=api;else root.MooZBatchModel=api;
})(globalThis);
