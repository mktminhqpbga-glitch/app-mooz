/* Cancellation-aware waiting and FIFO ownership of a provider tab. */
(() => {
 const aborted=()=>new DOMException('Đã dừng.','AbortError');
 function waitFor(promise,signal){
  if(signal?.aborted)return Promise.reject(aborted());
  if(!signal)return Promise.resolve(promise);
  return new Promise((resolve,reject)=>{const stop=()=>finish(reject,aborted());const finish=(fn,value)=>{signal.removeEventListener('abort',stop);fn(value);};signal.addEventListener('abort',stop,{once:true});Promise.resolve(promise).then(value=>finish(resolve,value),error=>finish(reject,error));});
 }
 function queue(){
  const tails=new Map();
  return {async acquire(key,signal,onWait){
   const previous=tails.get(key)||Promise.resolve();let release;const gate=new Promise(resolve=>{release=resolve;});const tail=previous.then(()=>gate);const waiting=tails.has(key);tails.set(key,tail);void tail.then(()=>{if(tails.get(key)===tail)tails.delete(key);});
   try{if(waiting)onWait?.();await waitFor(previous,signal);if(signal?.aborted)throw aborted();return release;}catch(error){release();throw error;}
  }};
 }
 globalThis.WorkflowRuntime={waitFor,queue};
})();
