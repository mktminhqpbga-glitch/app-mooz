/* Real asynchronous batch scheduler. Persist an intent before sending to an AI. */
(function(root){'use strict';
 const copy=value=>JSON.parse(JSON.stringify(value));
 const capabilities={muse:['vision','text','image','video'],gemini:['vision','text','image'],chatgpt:['vision','text','image'],grok:['vision','text','image','video'],flow:['image','video'],local:['assemble']};
 const Split=typeof module!=='undefined'?require('../../script-splitter.js'):root.WorkflowScriptSplitter;
 const labels={vision:'Đọc ảnh sản phẩm',text:'Viết kịch bản',image:'Tạo ảnh',video:'Tạo video',assemble:'Ghép thành phẩm'};
 const defaultWorkers=()=>[{id:'local',name:'Trên máy',provider:'local',selected:true,online:true}];
 const defaultWorkflow=()=>({id:'sales',name:'Video bán hàng · Ảnh → Thành phẩm',version:1,ratio:'9:16',scenes:3,duration:null,steps:Object.entries(labels).map(([type,name],i)=>({id:'step-'+i,type,name,provider:type==='assemble'?'local':'muse',prompt:type==='text'?'Viết kịch bản tiếng Việt theo thông tin sản phẩm; chia rõ từng cảnh. Không tự tạo giá bán hoặc công dụng.':type==='video'?'Giữ đúng sản phẩm, màu sắc và nhân vật. Chuyển động tự nhiên, máy quay ổn định.':''}))});
 const descriptions={vision:{input:'Ảnh gốc + yêu cầu riêng',output:'Đặc điểm quan sát được của sản phẩm'},text:{input:'Thông tin sản phẩm + số cảnh',output:'JSON đã kiểm tra: lời thoại, prompt ảnh/video cho từng cảnh'},image:{input:'Ảnh gốc + prompt riêng từng cảnh',output:'Một ảnh riêng cho mỗi cảnh'},video:{input:'Ảnh của cảnh + prompt video của đúng cảnh',output:'Các clip đã tải về máy, giữ đúng thứ tự'},assemble:{input:'Đủ clip của tất cả cảnh',output:'Một MP4 thành phẩm lưu trên máy'}};
 function scriptConfig(w){return {...Split.defaults(),maxScenes:w.scenes,defaultSize:w.ratio,rules:'Trả đúng '+w.scenes+' cảnh. Chỉ dùng thông tin quan sát được hoặc được người dùng xác nhận; giữ đúng sản phẩm. '+(w.duration===null?'duration phải là null; không tự yêu cầu số giây.':'Mục tiêu mỗi cảnh '+w.duration+' giây; không khẳng định AI chắc chắn trả đúng thời lượng.')};}
 function scriptInstructions(w){return Split.instructions(scriptConfig(w));}
 function parseScenes(text,w){const rows=Split.parse(text,scriptConfig(w)).rows;if(rows.length!==w.scenes)throw Error('Kịch bản cần đúng '+w.scenes+' cảnh; AI trả '+rows.length+' cảnh. Chưa gửi tạo ảnh/video.');return rows;}
 function ready(w){return w.selected&&w.online&&w.ready!==false;}
 function suitable(w,step){return ready(w)&&(!step.workerId||step.workerId===w.id)&&(!['image','video'].includes(step.type)||w.modeProtocol===1||!['image','video'].includes(w.mediaMode)||w.mediaMode===step.type);}
 function waitingReason(j,data){
  if(j.state!=='queued')return '';
  const step=j.plan?.steps?.[j.step];if(!step)return 'Luồng đã chốt thiếu bước thực hiện. Cần kiểm tra cấu hình.';
  const hold=data.providerHolds?.[step.provider];if(hold)return 'AI tạm dừng: '+(hold.message||hold.code||'Mở cài đặt AI để kiểm tra và tiếp tục.');
  const selected=data.workers.filter(w=>w.selected&&w.provider===step.provider&&(!step.workerId||step.workerId===w.id));
  if(!selected.length)return 'Chưa chọn tab '+step.provider+' cho bước '+step.name+'. Mở Nhóm tab AI.';
  if(!selected.some(w=>w.online))return 'Các tab '+step.provider+' đã đóng hoặc mất kết nối. Cập nhật danh sách tab.';
  if(!selected.some(ready))return selected.find(w=>w.online)?.reason||'Tab đang mở nhưng chưa xác nhận sẵn sàng. Kiểm tra đăng nhập và ô chat.';
  if(!selected.some(w=>suitable(w,step)))return 'Tab đã mở nhưng chế độ Ảnh/Video không khớp bước này. Chuyển chế độ trên Muse hoặc chọn tab khác.';
  if(!data.running)return 'Hàng chờ đang tạm dừng. Bấm Chạy hàng chờ để tiếp tục.';
  const active=data.jobs.filter(x=>x.active),busy=new Set(active.map(x=>x.active.workerId));
  if(selected.filter(w=>suitable(w,step)).every(w=>busy.has(w.id)))return 'Các tab phù hợp đang bận; chờ lượt, không gửi trùng.';
  if(step.provider!=='local'&&active.filter(x=>x.active.provider!=='local').length>=data.maxConcurrent)return 'Đã đủ số tác vụ đồng thời của lô; chờ tác vụ hiện tại kết thúc.';
  return 'Đang chờ bộ điều phối cấp lượt.';
 }
 function validate(w,workers,{requireTabs=true}={}){
  if(!String(w.name||'').trim()||!w.steps?.length||w.steps.length>12)throw Error('Đặt tên luồng và chọn từ 1 đến 12 bước.');
  if(!Number.isInteger(w.scenes)||w.scenes<1||w.scenes>12)throw Error('Số cảnh từ 1 đến 12.');
  if(w.commonVideoPrompt!==undefined&&(typeof w.commonVideoPrompt!=='string'||w.commonVideoPrompt.length>4000)||w.commonVideoPromptMode!==undefined&&!['append','replace'].includes(w.commonVideoPromptMode))throw Error('Prompt chung cần là văn bản tối đa 4.000 ký tự và cách dùng hợp lệ.');
  if(!['9:16','16:9','1:1'].includes(w.ratio)||w.duration!==null&&![5,10,15,30,40].includes(w.duration))throw Error('Tỷ lệ hoặc thời lượng không hợp lệ.');
  if(w.steps.filter(s=>s.type==='assemble').length!==1||w.steps.at(-1).type!=='assemble'||!w.steps.some(s=>s.type==='video'))throw Error('Cần bước Tạo video và một bước Ghép thành phẩm ở cuối.');
  let media=false,video=false;for(const s of w.steps){if(['vision','text'].includes(s.type)&&media)throw Error(s.name+': đặt bước phân tích/kịch bản trước bước tạo ảnh và video.');if(s.type==='image'&&video)throw Error('Đặt bước Tạo ảnh trước Tạo video.');if(['image','video'].includes(s.type))media=true;if(s.type==='video')video=true;}
  if(w.scenes>1&&!w.steps.some(s=>s.type==='text'))throw Error('Từ 2 cảnh trở lên cần bước Viết kịch bản trước khi tạo ảnh/video để tách đúng từng cảnh.');
  if(new Set(w.steps.map(s=>s.id)).size!==w.steps.length)throw Error('Mã bước bị trùng.');
  for(const s of w.steps){if(!capabilities[s.provider]?.includes(s.type))throw Error(s.name+': AI không hỗ trợ loại bước này.');if(requireTabs&&!workers.some(t=>t.selected&&t.online&&t.provider===s.provider))throw Error(s.name+': chưa chọn tab '+s.provider+' đang mở.');}return true;
 }
 function refreshWorkers(previous,tabs){
  const old=new Map(previous.map(w=>[w.id,w])),next=tabs.map(t=>{const id=t.transport+':'+t.id,p=old.get(id);return {id,tabId:t.id,transport:t.transport,provider:t.provider,name:p?.customName||t.title||t.provider,url:t.url,selected:p?.selected||false,online:true,ready:t.ready!==false,health:t.health||'unchecked',reason:t.reason||'',visibility:t.visibility||'unknown',mediaMode:t.mediaMode||'unknown',modeProtocol:t.modeProtocol||0,checkedAt:t.checkedAt||null,customName:p?.customName};});
  // Retain missing identities for saved pins and leases; selectors show only current connections.
  for(const w of previous)if(w.provider!=='local'&&!next.some(t=>t.id===w.id))next.push({...w,online:false,ready:false,health:'offline',reason:'Tab đã đóng hoặc mất kết nối.'});
  return [...next,...defaultWorkers()];
 }
 function create(data,{onEvent=()=>{},persist=()=>{},run=async()=>{throw Error('Chưa kết nối bộ chạy.');},cancel=()=>{}}={}){
  const leases=new Map();
  const event=(j,message,kind='info')=>{j.logs||=[];j.logs.push({at:new Date().toISOString(),message,kind});j.logs=j.logs.slice(-100);persist();onEvent(j,message,kind);};
  // A crashed/incomplete request is uncertain. It must never be sent again automatically.
  for(const j of data.jobs){if(j.state==='running'){j.state='error';j.error='Phiên chạy bị gián đoạn. Kiểm tra kết quả trong tab AI trước khi bấm chạy tiếp để tránh tạo trùng.';j.active=null;}else if(j.active)j.active=null;}
  const enqueue=(ids,w)=>{const jobs=data.jobs.filter(j=>ids.includes(j.id)&&j.state==='draft');if(!jobs.length)return 0;
   for(const j of jobs){const plan=j.draftPlan||w;validate(plan,data.workers,{requireTabs:false});if(j.inputMode==='text'){if(typeof j.note!=='string'||!j.note.trim()||j.note.length>4000||plan.scenes!==1||plan.steps.some(s=>!['video','assemble'].includes(s.type)))throw Error(j.name+': yêu cầu văn bản chưa hợp lệ.');}else if(!j.images?.length||j.images.length>8)throw Error(j.name+': cần từ 1 đến 8 ảnh tham chiếu.');}
   for(const j of jobs){const plan=j.draftPlan||w;Object.assign(j,{plan:{...copy(plan),sceneContract:1},inputSnapshot:copy(j.images||[]),referenceVideoSnapshot:copy(j.referenceVideoIds||[]),nameSnapshot:j.name,noteSnapshot:j.note,state:'queued',step:0,progress:0,error:'',active:null,attempts:{},completed:[],outputs:{},resultId:null});event(j,'Đã chốt luồng v'+plan.version+' và đầu vào riêng. Chưa gửi AI.');}return jobs.length;};
  const setImages=(id,images)=>{const j=data.jobs.find(j=>j.id===id);if(!j||j.state!=='draft'||leases.has(id))throw Error('Rút sản phẩm về nháp trước khi sửa ảnh đã chốt.');if(!Array.isArray(images)||images.length>8||images.some(x=>typeof x!=='string'||!x))throw Error('Mỗi sản phẩm tối đa 8 ảnh hợp lệ.');const before=j.images;j.images=[...new Set(images)];try{persist();}catch(e){j.images=before;throw e;}onEvent(j,'Đã cập nhật ảnh riêng của sản phẩm.');};
  const unqueue=id=>{const j=data.jobs.find(j=>j.id===id);if(!j||j.state!=='queued'||leases.has(id)||j.completed?.length||Object.values(j.attempts||{}).some(n=>n>0))throw Error('Chỉ rút về nháp khi sản phẩm chưa gửi bước AI nào. Dừng tác vụ trước khi kiểm tra.');Object.assign(j,{state:'draft',plan:null,inputSnapshot:null,step:0,progress:0,active:null,error:'',outputs:{},resultId:null});if(j.inputMode!=='text')delete j.draftPlan;event(j,'Đã rút về nháp. Có thể sửa ảnh/yêu cầu rồi chốt luồng mới.');};
  const retry=id=>{const j=data.jobs.find(j=>j.id===id);if(!j||!['error','stopped'].includes(j.state))return;if(leases.has(j.id))throw Error('Đang chờ tab xác nhận dừng.');j.state='queued';j.error='';event(j,'Tiếp tục từ cảnh/bước chưa hoàn tất; giữ kết quả đã lưu.');};
  const stop=id=>{const j=data.jobs.find(j=>j.id===id);if(!j||!['queued','running'].includes(j.state))return;j.state='stopped';if(j.active)cancel(j.active.workerId);event(j,'Đã yêu cầu dừng. Tab chỉ được nhận việc mới khi yêu cầu cũ kết thúc.','warning');};
  const remove=id=>{const j=data.jobs.find(j=>j.id===id);if(!j)return false;stop(id);data.jobs=data.jobs.filter(item=>item.id!==id);persist();onEvent(j,'Đã xóa thẻ; tệp đã lưu vẫn ở Kho media.');return true;};
  function tick(){
   if(!data.running)return;
   const busy=new Set([...leases.values()].map(l=>l.worker.id));let ai=[...leases.values()].filter(l=>l.worker.provider!=='local').length;
   for(const j of data.jobs){if(j.state!=='queued'||leases.has(j.id))continue;const step=j.plan?.steps[j.step];if(!step||data.providerHolds?.[step.provider])continue;if(step.provider!=='local'&&ai>=data.maxConcurrent)continue;const worker=data.workers.find(w=>suitable(w,step)&&w.provider===step.provider&&!busy.has(w.id));if(!worker)continue;
    const lease={id:crypto.randomUUID(),worker:copy(worker)};leases.set(j.id,lease);busy.add(worker.id);if(worker.provider!=='local')ai++;j.attempts||={};j.attempts[step.id]=(j.attempts[step.id]||0)+1;j.active={id:lease.id,workerId:worker.id,workerName:worker.name,provider:worker.provider,elapsed:0,total:1};j.state='running';
    try{event(j,step.name+' → '+worker.name);}catch(error){leases.delete(j.id);j.state='error';j.active=null;j.error='Không lưu được nhật ký; chưa gửi AI: '+error.message;data.running=false;continue;}
    Promise.resolve().then(()=>run(j,step,lease.worker,()=>{if(j.state==='stopped')throw Error('Đã dừng.');persist();})).then(result=>{if(j.state==='stopped')return;if(j.step===j.plan.steps.length-1&&!result?.resultId)throw Error('Chưa có tệp video đã lưu.');j.completed.push({stepId:step.id,attemptId:lease.id,workerId:worker.id,inputProductId:j.id});j.step++;j.progress=j.step/j.plan.steps.length*100;j.active=null;if(j.step===j.plan.steps.length){j.resultId=result.resultId;j.state='done';event(j,'Đã lưu video thành phẩm. Sẵn sàng xem và hậu kỳ.','success');}else{j.state='queued';event(j,step.name+' hoàn tất.');}}).catch(error=>{if(j.state!=='stopped'){j.state='error';j.error=error.message;try{event(j,error.message,'error');}catch{data.running=false;}}}).finally(()=>{j.active=null;leases.delete(j.id);try{persist();}catch{data.running=false;}tick();});
   }
   if(!leases.size&&!data.jobs.some(j=>j.state==='queued'))data.running=false;
  }
  return {enqueue,setImages,unqueue,retry,stop,remove,tick,waitingReason:j=>waitingReason(j,data),validate:()=>validate(data.workflow,data.workers),get busy(){return leases.size>0;}};
 }
 const api={copy,capabilities,labels,descriptions,scriptInstructions,parseScenes,waitingReason,defaultWorkers,defaultWorkflow,validate,refreshWorkers,create};if(typeof module!=='undefined')module.exports=api;else root.MooZBatchModel=api;
})(globalThis);
