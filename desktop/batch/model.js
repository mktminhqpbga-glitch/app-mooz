/* Real asynchronous batch scheduler. Persist an intent before sending to an AI. */
(function(root){'use strict';
 const copy=value=>JSON.parse(JSON.stringify(value));
 const Graph=typeof module!=='undefined'?require('./flow-graph.js'):root.MooZFlowGraph;
 const capabilities={muse:['vision','text','image','video'],gemini:['vision','text','image'],chatgpt:['vision','text','image'],grok:['vision','text','image','video'],flow:['image','video'],local:['assemble']};
 const Split=typeof module!=='undefined'?require('../../script-splitter.js'):root.WorkflowScriptSplitter;
 const labels={vision:'Đọc ảnh sản phẩm',text:'Viết kịch bản',image:'Tạo ảnh',video:'Tạo video',assemble:'Ghép thành phẩm'};
 const defaultWorkers=()=>[{id:'local',name:'Trên máy',provider:'local',selected:true,online:true}];
 const defaultWorkflow=()=>({id:'sales',name:'Video bán hàng · Ảnh → Thành phẩm',version:1,execution:'single-tab',provider:'muse',ratio:'9:16',scenes:3,duration:null,steps:Object.entries(labels).map(([type,name],i)=>({id:'step-'+i,type,name,provider:type==='assemble'?'local':'muse',prompt:type==='text'?'Viết kịch bản tiếng Việt theo thông tin sản phẩm; chia rõ từng cảnh. Không tự tạo giá bán hoặc công dụng.':type==='video'?'Giữ đúng sản phẩm, màu sắc và nhân vật. Chuyển động tự nhiên, máy quay ổn định.':''}))});
 const descriptions={vision:{input:'Ảnh gốc + yêu cầu riêng',output:'Đặc điểm quan sát được của sản phẩm'},text:{input:'Thông tin sản phẩm + số cảnh',output:'JSON đã kiểm tra: lời thoại, prompt ảnh/video cho từng cảnh'},image:{input:'Ảnh gốc + prompt riêng từng cảnh',output:'Một ảnh riêng cho mỗi cảnh'},video:{input:'Ảnh của cảnh + prompt video của đúng cảnh',output:'Các clip đã tải về máy, giữ đúng thứ tự'},assemble:{input:'Đủ clip của tất cả cảnh',output:'Một MP4 thành phẩm lưu trên máy'}};
 function scriptConfig(w){return {...Split.defaults(),maxScenes:w.scenes,defaultSize:w.ratio,rules:'Trả đúng '+w.scenes+' cảnh. Chỉ dùng thông tin quan sát được hoặc được người dùng xác nhận; giữ đúng sản phẩm. '+(w.duration===null?'duration phải là null; không tự yêu cầu số giây.':'Mục tiêu mỗi cảnh '+w.duration+' giây; không khẳng định AI chắc chắn trả đúng thời lượng.')};}
 function scriptInstructions(w){return Split.instructions(scriptConfig(w));}
 function parseScenes(text,w){const rows=Split.parse(text,scriptConfig(w)).rows;if(rows.length!==w.scenes)throw Error('Kịch bản cần đúng '+w.scenes+' cảnh; AI trả '+rows.length+' cảnh. Chưa gửi tạo ảnh/video.');return rows;}
 function ready(w){return w.selected&&w.online&&w.ready!==false;}
 function suitable(w,step,bound=false){return (bound?w.online&&w.ready!==false:ready(w))&&(!['image','video'].includes(step.type)||w.modeProtocol===1||!['image','video'].includes(w.mediaMode)||w.mediaMode===step.type);}
 function providerForPlan(plan){const providers=[...new Set((plan?.steps||[]).filter(s=>s.provider!=='local').map(s=>s.provider))];return providers.length>1?null:providers[0]||'local';}
 function validateWorkerChoice(plan,workerId,workers){const provider=providerForPlan(plan);if(provider===null)throw Error('Chọn một AI cho toàn bộ luồng, không chia AI theo từng bước.');if(workerId!=null&&workerId!==''&&(typeof workerId!=='string'||workerId.length>200))throw Error('Tab chạy luồng chưa hợp lệ.');const preferred=workerId&&workers.find(w=>w.id===workerId);if(preferred&&preferred.provider!==provider)throw Error('Tab đã chọn không thuộc AI của luồng. Chọn lại tab.');return provider;}
 function allowedProviders(w){const steps=(w.steps||[]).filter(s=>s.provider!=='local');return steps.length?Object.keys(capabilities).filter(p=>p!=='local'&&steps.every(s=>capabilities[p].includes(s.type))):['local'];}
 function singleTab(w,provider){const next=copy(w),allowed=allowedProviders(next),old=providerForPlan(next);next.execution='single-tab';next.provider=provider!==undefined?provider:allowed[0]==='local'?'local':allowed.includes(next.provider)?next.provider:old&&allowed.includes(old)?old:'';for(const step of next.steps){delete step.workerId;if(step.provider!=='local'&&allowed.includes(next.provider))step.provider=next.provider;}return next;}
 function reservations(data,leases){const owners=new Map();if(leases)for(const [id,lease]of leases)if(lease.worker.provider!=='local')owners.set(lease.worker.id,id);for(const j of data.jobs)if(j.active?.workerId&&j.active.workerId!=='local'&&j.active.provider!=='local'&&!owners.has(j.active.workerId))owners.set(j.active.workerId,j.id);for(const j of data.jobs)if(['queued','running'].includes(j.state)&&j.tabAssignment?.workerId&&!owners.has(j.tabAssignment.workerId))owners.set(j.tabAssignment.workerId,j.id);return owners;}
 function waitingReason(j,data){
  if(j.state!=='queued')return '';
  const step=j.plan?.steps?.[j.step];if(!step)return 'Luồng đã chốt thiếu bước thực hiện. Cần kiểm tra cấu hình.';
  if(providerForPlan(j.plan)===null)return 'Luồng cũ dùng nhiều AI. Chọn một AI cho toàn bộ mẫu rồi tạo tác vụ mới.';
  const hold=data.providerHolds?.[step.provider];if(hold)return 'AI tạm dừng: '+(hold.message||hold.code||'Mở cài đặt AI để kiểm tra và tiếp tục.');
  const assignment=step.provider!=='local'?j.tabAssignment:null,requested=step.provider==='local'?null:assignment?.workerId||j.workerPreferenceSnapshot?.workerId,owners=reservations(data);
  const selected=data.workers.filter(w=>w.provider===step.provider&&(requested?w.id===requested:w.selected));
  if(!selected.length)return assignment?'Luồng đang giữ tab '+assignment.workerName+'. Tab chưa kết nối lại; không đổi sang tab khác.':requested?'Tab đã chọn chưa được bật trong Nhóm tab AI. Bật lại tab để tác vụ tiếp tục chờ đúng tab.':'Chưa chọn tab '+step.provider+' cho luồng. Mở Nhóm tab AI.';
  if(!selected.some(w=>w.online))return assignment?'Tab '+assignment.workerName+' đã mất kết nối. Luồng chờ đúng tab này; không tự chuyển tab.':'Tab đã chọn đã đóng hoặc mất kết nối. Cập nhật danh sách tab.';
  if(!selected.some(w=>w.online&&w.ready!==false))return selected.find(w=>w.online)?.reason||'Tab đang mở nhưng chưa xác nhận sẵn sàng. Kiểm tra đăng nhập và ô chat.';
  if(!selected.some(w=>suitable(w,step,!!assignment||!!requested)))return 'Chế độ Ảnh/Video không khớp. Chuyển chế độ trên tab đang dùng cho luồng.';
  if(!data.running)return 'Hàng chờ đang tạm dừng. Bấm Chạy hàng chờ để tiếp tục.';
  const active=data.jobs.filter(x=>x.active),busy=new Set(active.map(x=>x.active.workerId));
  if(selected.filter(w=>suitable(w,step,!!assignment||!!requested)).every(w=>busy.has(w.id)||(step.provider!=='local'&&owners.has(w.id)&&owners.get(w.id)!==j.id)))return requested?'Tab đã chọn đang bận với luồng khác; tác vụ xếp hàng chờ đúng tab đó.':'Các tab phù hợp đang bận; tác vụ xếp hàng chờ tab trống.';
  if(step.provider!=='local'&&(!assignment&&owners.size>=data.maxConcurrent||active.filter(x=>x.active.provider!=='local').length>=data.maxConcurrent))return 'Đã đủ số luồng AI đồng thời; chờ một luồng hoàn tất.';
  return assignment?'Luồng tiếp tục trên tab '+assignment.workerName+'.':'Đang chờ bộ điều phối cấp một tab cho toàn bộ luồng.';
 }
 function validate(w,workers,{requireTabs=true}={}){
  if(w?.schema==='mooz-flow-plan-v1'){Graph.validatePlan(w);if(requireTabs)for(const s of w.steps)if(!workers.some(t=>t.selected&&t.online&&t.provider===s.provider))throw Error(s.name+': chưa chọn tab '+s.provider+' đang mở.');return true;}
  if(w.execution==='single-tab'&&(!allowedProviders(w).includes(w.provider)||providerForPlan(w)!==w.provider))throw Error('Chọn một AI hỗ trợ toàn bộ các bước của luồng.');
  if(!String(w.name||'').trim()||!w.steps?.length||w.steps.length>12)throw Error('Đặt tên luồng và chọn từ 1 đến 12 bước.');
  if(!Number.isInteger(w.scenes)||w.scenes<1||w.scenes>12)throw Error('Số cảnh từ 1 đến 12.');
  if(w.commonVideoPrompt!==undefined&&(typeof w.commonVideoPrompt!=='string'||w.commonVideoPrompt.length>4000)||w.commonVideoPromptMode!==undefined&&!['append','replace'].includes(w.commonVideoPromptMode))throw Error('Prompt chung cần là văn bản tối đa 4.000 ký tự và cách dùng hợp lệ.');
  if(!['9:16','16:9','1:1'].includes(w.ratio)||w.duration!==null&&![5,10,15,30,40].includes(w.duration))throw Error('Tỷ lệ hoặc thời lượng không hợp lệ.');
  if(w.steps.filter(s=>s.type==='assemble').length!==1||w.steps.at(-1).type!=='assemble'||!w.steps.some(s=>s.type==='video'))throw Error('Cần bước Tạo video và một bước Ghép thành phẩm ở cuối.');
  let media=false,video=false;for(const s of w.steps){if(['vision','text'].includes(s.type)&&media)throw Error(s.name+': đặt bước phân tích/kịch bản trước bước tạo ảnh và video.');if(s.type==='image'&&video)throw Error('Đặt bước Tạo ảnh trước Tạo video.');if(['image','video'].includes(s.type))media=true;if(s.type==='video')video=true;}
  if(w.scenes>1&&!w.steps.some(s=>s.type==='text'))throw Error('Từ 2 cảnh trở lên cần bước Viết kịch bản trước khi tạo ảnh/video để tách đúng từng cảnh.');
  if(w.characterReferenceEnabled!==undefined&&typeof w.characterReferenceEnabled!=='boolean'||w.characterReferenceId!==undefined&&(typeof w.characterReferenceId!=='string'||w.characterReferenceId.length>200)||w.characterReferenceEnabled&&!w.characterReferenceId?.trim())throw Error('Chọn ảnh nhân vật tham chiếu hoặc tắt sử dụng ảnh nhân vật.');
  if(new Set(w.steps.map(s=>s.id)).size!==w.steps.length)throw Error('Mã bước bị trùng.');
  for(const s of w.steps){if(!capabilities[s.provider]?.includes(s.type))throw Error(s.name+': AI không hỗ trợ loại bước này.');if(requireTabs&&!workers.some(t=>t.selected&&t.online&&t.provider===s.provider))throw Error(s.name+': chưa chọn tab '+s.provider+' đang mở.');}return true;
 }
 function refreshWorkers(previous,tabs){
  const old=new Map(previous.map(w=>[w.id,w])),next=tabs.map(t=>{const id=t.transport+':'+t.id,p=old.get(id);return {id,tabId:t.id,transport:t.transport,provider:t.provider,name:p?.customName||t.title||t.provider,url:t.url,selected:p?.selected||false,online:true,ready:t.ready!==false,health:t.health||'unchecked',reason:t.reason||'',visibility:t.visibility||'unknown',mediaMode:t.mediaMode||'unknown',modeProtocol:t.modeProtocol||0,checkedAt:t.checkedAt||null,customName:p?.customName};});
  // Retain missing identities for saved pins and leases; selectors show only current connections.
  for(const w of previous)if(w.provider!=='local'&&!next.some(t=>t.id===w.id))next.push({...w,online:false,ready:false,health:'offline',reason:'Tab đã đóng hoặc mất kết nối.'});
  return [...next,...defaultWorkers()];
 }
 function create(data,{onEvent=()=>{},persist=()=>{},run=async()=>{throw Error('Chưa kết nối bộ chạy.');},validateInput=()=>{},cancel=()=>{}}={}){
  const leases=new Map();
  const event=(j,message,kind='info')=>{j.logs||=[];j.logs.push({at:new Date().toISOString(),message,kind});j.logs=j.logs.slice(-100);persist();onEvent(j,message,kind);};
  // Recover actual tab ownership, never a per-step configuration pin. A pending
  // request remains uncertain on restart and is never automatically submitted.
  for(const j of data.jobs){
   const provider=providerForPlan(j.plan||j.draftPlan),previous=j.active;
   if(!j.tabAssignment&&provider&&provider!=='local'){
    const last=[...(j.completed||[])].reverse().find(c=>(c.provider||j.plan?.steps.find(s=>s.id===c.stepId)?.provider)!=='local'&&c.workerId&&c.workerId!=='local');
    const current=j.plan?.steps?.[j.step],oldAttempt=current?.workerId&&j.attempts?.[current.id]>0&&j.plan?.execution!=='single-tab'?{workerId:current.workerId}:null;
    const actual=previous?.workerId&&previous.workerId!=='local'?previous:oldAttempt||last;
    if(actual)j.tabAssignment={workerId:actual.workerId,workerName:actual.workerName||data.workers.find(w=>w.id===actual.workerId)?.name||'Tab của luồng',provider};
   }
   if(j.state==='running'){j.state='error';j.error='Phiên chạy bị gián đoạn. Kiểm tra kết quả trong tab AI trước khi bấm chạy tiếp để tránh tạo trùng.';j.active=null;}else if(j.active)j.active=null;
   if(j.plan&&provider===null&&['queued','running'].includes(j.state)){j.state='error';j.error='Luồng cũ dùng nhiều AI. Chọn một AI cho toàn bộ mẫu rồi tạo tác vụ mới; kết quả cũ được giữ.';}
  }
  const enqueue=(ids,w)=>{const jobs=data.jobs.filter(j=>ids.includes(j.id)&&j.state==='draft');if(!jobs.length)return 0;
   for(const j of jobs){const plan=j.draftPlan||w;validate(plan,data.workers,{requireTabs:false});validateWorkerChoice(plan,j.requestedWorkerId,data.workers);if(j.inputMode==='graph'){if(plan.schema!=='mooz-flow-plan-v1')throw Error('Chọn lại luồng canvas trước khi xếp hàng.');Graph.validateValues(plan,j.flowValues);}else if(j.inputMode==='text'){if(typeof j.note!=='string'||!j.note.trim()||j.note.length>4000||plan.scenes!==1||plan.steps.some(s=>!['video','assemble'].includes(s.type)))throw Error(j.name+': yêu cầu văn bản chưa hợp lệ.');}else if(!j.images?.length||j.images.length>8)throw Error(j.name+': cần từ 1 đến 8 ảnh tham chiếu.');if(plan.characterReferenceEnabled&&j.images?.length>7)throw Error(j.name+': tối đa 7 ảnh sản phẩm khi dùng thêm ảnh nhân vật (tổng tối đa 8 ảnh).');validateInput(j,plan);}
   for(const j of jobs){const plan=j.draftPlan||w;Object.assign(j,{plan:{...copy(plan),sceneContract:1},tabAssignment:null,workerPreferenceSnapshot:{provider:providerForPlan(plan),workerId:j.requestedWorkerId||null},inputSnapshot:copy(j.images||[]),referenceVideoSnapshot:copy(j.referenceVideoIds||[]),...(j.inputMode==='graph'?{flowInputSnapshot:copy(j.flowValues)}:{}),nameSnapshot:j.name,noteSnapshot:j.note,state:'queued',step:0,progress:0,error:'',active:null,attempts:{},completed:[],outputs:{},resultId:null});event(j,'Đã chốt luồng v'+plan.version+' và đầu vào riêng. Chưa gửi AI.');}return jobs.length;};
  const setImages=(id,images)=>{const j=data.jobs.find(j=>j.id===id);if(!j||j.state!=='draft'||leases.has(id))throw Error('Rút sản phẩm về nháp trước khi sửa ảnh đã chốt.');if(j.inputMode==='graph')throw Error('Sửa ảnh trong form đầu vào của luồng canvas.');if(!Array.isArray(images)||images.length>8||images.some(x=>typeof x!=='string'||!x))throw Error('Mỗi sản phẩm tối đa 8 ảnh hợp lệ.');const before=j.images;j.images=[...new Set(images)];try{persist();}catch(e){j.images=before;throw e;}onEvent(j,'Đã cập nhật ảnh riêng của sản phẩm.');};
  const unqueue=id=>{const j=data.jobs.find(j=>j.id===id);if(!j||j.state!=='queued'||leases.has(id)||j.completed?.length||Object.values(j.attempts||{}).some(n=>n>0))throw Error('Chỉ rút về nháp khi sản phẩm chưa gửi bước AI nào. Dừng tác vụ trước khi kiểm tra.');Object.assign(j,{state:'draft',tabAssignment:null,workerPreferenceSnapshot:null,plan:null,inputSnapshot:null,flowInputSnapshot:null,step:0,progress:0,active:null,error:'',outputs:{},resultId:null});if(!['text','graph'].includes(j.inputMode))delete j.draftPlan;event(j,'Đã rút về nháp. Có thể sửa ảnh/yêu cầu rồi chốt luồng mới.');};
  const retry=id=>{const j=data.jobs.find(j=>j.id===id);if(!j||!['error','stopped'].includes(j.state))return;if(leases.has(j.id))throw Error('Đang chờ tab xác nhận dừng.');if(providerForPlan(j.plan)===null)throw Error('Luồng cũ dùng nhiều AI. Chọn một AI trong mẫu và tạo tác vụ mới.');j.state='queued';j.error='';event(j,'Tiếp tục từ cảnh/bước chưa hoàn tất; giữ kết quả đã lưu.');};
  const stop=id=>{const j=data.jobs.find(j=>j.id===id);if(!j||!['queued','running'].includes(j.state))return;j.state='stopped';if(j.active)cancel(j.active.workerId);event(j,'Đã yêu cầu dừng. Tab chỉ được nhận việc mới khi yêu cầu cũ kết thúc.','warning');};
  const remove=id=>{const j=data.jobs.find(j=>j.id===id);if(!j)return false;stop(id);data.jobs=data.jobs.filter(item=>item.id!==id);persist();onEvent(j,'Đã xóa thẻ; tệp đã lưu vẫn ở Kho media.');return true;};
  function tick(){
   if(!data.running)return;
   const busy=new Set([...leases.values()].map(l=>l.worker.id)),owners=reservations(data,leases);let ai=[...leases.values()].filter(l=>l.worker.provider!=='local').length;
   for(const j of data.jobs){if(j.state!=='queued'||leases.has(j.id))continue;const step=j.plan?.steps[j.step];if(!step||data.providerHolds?.[step.provider])continue;
    if(providerForPlan(j.plan)===null){j.state='error';j.error='Chọn một AI cho toàn bộ luồng trước khi chạy.';persist();continue;}
    const assignment=step.provider!=='local'?j.tabAssignment:null,requested=step.provider==='local'?null:assignment?.workerId||j.workerPreferenceSnapshot?.workerId;
    if(step.provider!=='local'&&(ai>=data.maxConcurrent||!assignment&&owners.size>=data.maxConcurrent))continue;
    const worker=data.workers.find(w=>w.provider===step.provider&&suitable(w,step,!!assignment||!!requested)&&!busy.has(w.id)&&(step.provider==='local'||(!requested||w.id===requested)&&(!owners.has(w.id)||owners.get(w.id)===j.id)));if(!worker)continue;
    if(step.provider!=='local'&&!j.tabAssignment){j.tabAssignment={workerId:worker.id,workerName:worker.name,provider:worker.provider};owners.set(worker.id,j.id);}
    const lease={id:crypto.randomUUID(),worker:copy(worker)};leases.set(j.id,lease);busy.add(worker.id);if(worker.provider!=='local')ai++;j.attempts||={};j.attempts[step.id]=(j.attempts[step.id]||0)+1;j.active={id:lease.id,workerId:worker.id,workerName:worker.name,provider:worker.provider,elapsed:0,total:1};j.state='running';
    try{event(j,step.name+' → '+worker.name);}catch(error){leases.delete(j.id);j.state='error';j.active=null;j.error='Không lưu được nhật ký; chưa gửi AI: '+error.message;data.running=false;break;}
    Promise.resolve().then(()=>run(j,step,lease.worker,()=>{if(j.state==='stopped')throw Error('Đã dừng.');persist();})).then(result=>{if(j.state==='stopped')return;if(j.step===j.plan.steps.length-1&&!result?.resultId)throw Error('Chưa có tệp kết quả đã lưu.');j.completed.push({stepId:step.id,attemptId:lease.id,workerId:worker.id,provider:worker.provider,inputProductId:j.id});j.step++;j.progress=j.step/j.plan.steps.length*100;j.active=null;if(j.step===j.plan.steps.length){j.resultId=result.resultId;j.state='done';event(j,j.inputMode==='graph'?'Đã lưu kết quả của luồng canvas.':'Đã lưu video thành phẩm. Sẵn sàng xem và hậu kỳ.','success');}else{j.state='queued';event(j,step.name+' hoàn tất.');}}).catch(error=>{if(j.state!=='stopped'){j.state='error';j.error=error.message;try{event(j,error.message,'error');}catch{data.running=false;}}}).finally(()=>{j.active=null;leases.delete(j.id);try{persist();}catch{data.running=false;}tick();});
   }
   if(!leases.size&&!data.jobs.some(j=>j.state==='queued'))data.running=false;
  }
  return {workerOwner:id=>{const owner=reservations(data,leases).get(id);return owner?(data.jobs.find(j=>j.id===owner)||{id:owner,name:'Yêu cầu đang dừng'}):null;},enqueue,setImages,unqueue,retry,stop,remove,tick,waitingReason:j=>waitingReason(j,data),validate:()=>validate(data.workflow,data.workers),get busy(){return leases.size>0;}};
 }
 const api={copy,capabilities,labels,descriptions,scriptInstructions,parseScenes,providerForPlan,validateWorkerChoice,allowedProviders,singleTab,waitingReason,defaultWorkers,defaultWorkflow,validate,refreshWorkers,create};if(typeof module!=='undefined')module.exports=api;else root.MooZBatchModel=api;
})(globalThis);
