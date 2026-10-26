/* Short, idempotent messages for long Muse tasks. Status retries never submit prompts. */
(()=>{
 const abort=signal=>{if(signal?.aborted)throw new DOMException('Đã dừng.','AbortError');};
 const pause=(ms,signal)=>new Promise((resolve,reject)=>{abort(signal);const stop=()=>{clearTimeout(timer);signal?.removeEventListener('abort',stop);reject(new DOMException('Đã dừng.','AbortError'));};const timer=setTimeout(()=>{signal?.removeEventListener('abort',stop);resolve();},ms);signal?.addEventListener('abort',stop,{once:true});});
 async function short(send,message,signal,timeout){abort(signal);let timer,stop;try{return await Promise.race([Promise.resolve().then(()=>{abort(signal);return send(message);}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Kết nối Muse tạm thời không phản hồi.')),timeout);stop=()=>reject(new DOMException('Đã dừng.','AbortError'));signal?.addEventListener('abort',stop,{once:true});})]);}finally{clearTimeout(timer);signal?.removeEventListener('abort',stop);}}
 async function run(send,request,signal,{interval=1000,messageTimeout=12000,timeout=Math.min(900,Math.max(30,Number(request.timeoutSec)||600))*1000+((request.referenceImages?.length||0)+(request.referenceVideos?.length||0))*120000+180000,reconnect=25000,onReconnect=()=>{},onProgress=()=>{}}={}){
  const id=request.requestId;if(typeof id!=='string'||!id)throw Error('Thiếu mã tác vụ Muse.');
  let started;try{started=await short(send,{...request,type:'MUSEFLOW_JOB_START'},signal,messageTimeout);}catch(error){if(error.name==='AbortError')throw error;onReconnect();}
  if(started?.ok===false)throw Error(started.error||'Muse chưa nhận tác vụ.');
  const deadline=Date.now()+timeout;let disconnectedAt=0;
  while(Date.now()<deadline){
   abort(signal);let status;
   try{status=await short(send,{type:'MUSEFLOW_JOB_STATUS',requestId:id},signal,messageTimeout);disconnectedAt=0;}
   catch(error){if(error.name==='AbortError')throw error;if(!disconnectedAt)disconnectedAt=Date.now();onReconnect();if(Date.now()-disconnectedAt>=reconnect)throw Error('Mất kết nối tới tab Muse. Không gửi lại prompt vì Muse có thể đã tạo xong. Giữ tab mở; có thể tải video từ Muse rồi dùng Nhập video kết quả trong Công cụ.');await pause(interval,signal);continue;}
   if(!status?.ok||status.state==='missing')throw Error(status?.error||'Tab Muse đã tải lại hoặc mất mã tác vụ. Không tự gửi lại prompt; có thể nhập video đã tạo từ Muse.');
   if(typeof status.progress==='string'&&status.progress)onProgress(status.progress);
   if(status.state==='done'){
    const result=status.result;if(!result||typeof result.ok!=='boolean')throw Error('Kết quả tác vụ Muse không hợp lệ.');abort(signal);
    // A lost ACK is harmless: reading status is non-destructive.
    void Promise.resolve().then(()=>send({type:'MUSEFLOW_JOB_ACK',requestId:id})).catch(()=>{});return result;
   }
   if(status.state!=='running')throw Error('Trạng thái tác vụ Muse không hợp lệ.');await pause(interval,signal);
  }
  throw Error('Hết thời gian chờ Muse. Không gửi lại prompt; kiểm tra kết quả trên tab Muse trước khi chạy lại.');
 }
 globalThis.WorkflowMuseJobs={run};
 if(typeof module!=='undefined'&&module.exports)module.exports={run};
})();
