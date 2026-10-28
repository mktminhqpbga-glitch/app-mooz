'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {options,event,summary}=require('./posting-model.cjs');
const museSettings=require('./muse-post-settings.cjs');
const SENT=['published','submitted','uncertain'];
const FROZEN=[...SENT,'prepared','scheduled','queued','staged'];
class PostingService{
 constructor({store,publisher,ask,brands,notify=()=>{}}){
  Object.assign(this,{store,publisher,ask,brands,notify});this.active=new Map();this.accounts=new Set();this.settingsWrites=Promise.resolve();this.closed=false;
  this.settings={...museSettings.defaults,paused:false,metaBrokerURL:'',prompt:'Viết content đăng mạng xã hội bằng tiếng Việt, tự nhiên, ngắn gọn. Dựa vào hình và ngữ cảnh được cung cấp; không bịa thông số, giá, công dụng hay khuyến mãi. Thêm lời kêu gọi hành động phù hợp và tối đa 5 hashtag. Chỉ trả nội dung bài đăng.'};
 }
 async init(){
  await this.store.init();await this.publisher.init();
  try{const saved=JSON.parse(await fs.readFile(path.join(this.store.root,'settings.json'),'utf8'));if(typeof saved.prompt==='string'&&saved.prompt.trim()&&saved.prompt.length<=12000)this.settings.prompt=saved.prompt;this.settings.paused=saved.paused===true;if(saved.metaBrokerURL)this.settings.metaBrokerURL=this.brokerURL(saved.metaBrokerURL);this.settings=museSettings.apply(saved,this.settings);}
  catch(error){if(error.code!=='ENOENT'){this.settings.paused=true;this.settingsError='Không đọc được thiết lập đã lưu. Hàng chờ đã tạm dừng; lưu lại thiết lập rồi tiếp tục.';}}
  await this.recoverDispatch();
 }
 async recoverDispatch(){
  const jobs=await this.store.list();
  for(const parent of jobs.filter(j=>j.dispatch&&!this.active.has(j.id))){
   const children=jobs.filter(j=>j.parentId===parent.id&&j.status==='staged');
   if(parent.dispatch.committed){for(const child of children){child.status=child.scheduledAt?'scheduled':'queued';event(child,child.status,'Khôi phục hàng chờ đã xác nhận.');await this.store.save(child);}}
   else{if(!children.length&&parent.status==='error')continue;parent.status='error';parent.autoPublish=false;parent.error='App dừng khi chia bài cho các nền tảng. Chưa gửi bài; kiểm tra và xếp lại.';event(parent,'error',parent.error,'QUEUE_INTERRUPTED');await this.store.save(parent);for(const child of children){child.status='error';child.error=parent.error;await this.store.save(child);}}
  }
 }
 async snapshot(){return {jobs:(await this.store.list()).map(summary),connections:this.publisher.list(),brands:this.brands?(await this.brands.list()).map(b=>this.brands.public(b)):[],storage:this.publisher.storage?.()||{connected:false},settings:{...this.settings},connectionError:this.publisher.loadError||'',settingsError:this.settingsError||'',schedulerError:this.schedulerError||''};}
 async changed(){this.notify();}
 settingsSave(data){
  const write=this.settingsWrites.catch(()=>{}).then(async()=>{
   const next=museSettings.apply(data,this.settings);if(data.prompt!==undefined){if(typeof data.prompt!=='string'||!data.prompt.trim()||data.prompt.length>12000)throw Error('Prompt chung cần từ 1 đến 12.000 ký tự.');next.prompt=data.prompt;}
   if(data.paused!==undefined){if(typeof data.paused!=='boolean')throw Error('Trạng thái hàng chờ không hợp lệ.');next.paused=data.paused;}
   if(data.metaBrokerURL!==undefined)next.metaBrokerURL=this.brokerURL(data.metaBrokerURL);
   const file=path.join(this.store.root,'settings.json'),temp=file+'.'+randomUUID()+'.tmp';
   try{await fs.writeFile(temp,JSON.stringify(next),{mode:0o600});await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true});}
   this.settings=next;this.settingsError='';await this.changed();return {...next};
  });this.settingsWrites=write;return write;
 }
 brokerURL(value){if(value==='')return '';let url;try{url=new URL(value);}catch{throw Error('URL dịch vụ Meta OAuth không hợp lệ.');}if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/'||value.length>2000)throw Error('Dùng URL gốc HTTPS của dịch vụ Meta OAuth.');return url.origin+'/';}
 locked(id,fn){
  if(this.active.has(id))throw Error('Bài đang được xử lý.');const controller=new AbortController();this.active.set(id,controller);
  return Promise.resolve().then(()=>fn(controller)).finally(()=>{this.active.delete(id);void this.changed();});
 }
 async edit(id,data){return this.locked(id,async()=>{
  const j=await this.store.read(id);if(FROZEN.includes(j.status))throw Error('Rút bài khỏi hàng chờ trước khi sửa; bài đã gửi không được đăng lại.');
  if(typeof data.caption==='string'){if(data.caption.length>60000)throw Error('Content quá dài.');if(j.caption!==data.caption)j.reviewState='draft';j.caption=data.caption;j.status='draft';}
  if(data.connectionIds!==undefined){this.validateConnections(data.connectionIds,true);if(j.parentId&&(data.connectionIds.length!==1||data.connectionIds[0]!==j.connectionId))throw Error('Mỗi mục trong hàng chờ gắn với một nơi đăng. Dùng lại thành bản nháp để đổi tài khoản.');j.connectionIds=[...new Set(data.connectionIds)];j.connectionId=j.connectionIds[0]||'';}
  if(data.brandId!==undefined){if(typeof data.brandId!=='string')throw Error('Thương hiệu không hợp lệ.');const brand=data.brandId?data.brandId===j.brandId&&j.brandSnapshot&&data.refreshBrand!==true?j.brandSnapshot:await this.brands?.snapshot(data.brandId):null;if(data.brandId&&!brand)throw Error('Không tìm thấy thương hiệu.');if(j.brandId!==data.brandId||JSON.stringify(j.brandSnapshot)!==JSON.stringify(brand))j.reviewState='draft';j.brandId=data.brandId;j.brandSnapshot=brand;}
  if(data.captionVariants!==undefined){const variants=data.captionVariants;if(!variants||typeof variants!=='object'||Array.isArray(variants)||Object.keys(variants).length>8||Object.keys(variants).some(k=>!['facebook','instagram','youtube','tiktok','linkedin','pinterest','x','other'].includes(k))||Object.values(variants).some(v=>typeof v!=='string'||v.length>60000)||JSON.stringify(variants).length>128000)throw Error('Nội dung riêng theo nền tảng không hợp lệ.');if(JSON.stringify(j.captionVariants||{})!==JSON.stringify(variants))j.reviewState='draft';j.captionVariants={...variants};}
  if(data.requireApproval!==undefined)j.requireApproval=data.requireApproval===true;
  if(data.options!==undefined)j.options=options(data.options);
  if(data.autoPublish!==undefined)j.autoPublish=data.autoPublish===true;
  if(data.museDefaultSchedule!==undefined){if(typeof data.museDefaultSchedule!=='boolean')throw Error('Thiết lập lịch Muse không hợp lệ.');j.museDefaultSchedule=data.museDefaultSchedule;}
  if(data.scheduledAt!==undefined)j.scheduledAt=this.schedule(data.scheduledAt);
  j.error='';await this.store.save(j);return summary(j);
 });}
 validateConnections(ids,empty=false){if(!Array.isArray(ids)||(!empty&&!ids.length)||ids.length>10||ids.some(id=>!this.publisher.list().some(c=>c.id===id)))throw Error('Chọn ít nhất một nơi đăng đã kết nối.');}
 schedule(value){if(!value)return null;const time=new Date(value).getTime();if(!Number.isFinite(time)||time<Date.now()-60000||time>Date.now()+366*86400000)throw Error('Chọn thời gian đăng từ hiện tại đến một năm tới.');return new Date(time).toISOString();}
 async enqueueLocked(j,{connectionIds=j.connectionIds||[j.connectionId],scheduledAt=j.scheduledAt}={}){
  if(SENT.includes(j.status))throw Error('Bài đã gửi hoặc chưa rõ kết quả; không gửi lại.');
  // Repeating the parent action never requeues a previously dispatched destination.
  if(j.status==='prepared')return summary(j);
  if(j.requireApproval&&j.reviewState!=='approved')throw Error('Duyệt nội dung trước khi xếp hàng đăng.');
  this.validateConnections(connectionIds);const selected=connectionIds.map(id=>this.publisher.list().find(c=>c.id===id)),allMuse=selected.every(c=>c.transport==='muse'),musePlan={autoCaption:this.settings.museAutoCaption,prompt:this.settings.musePrompt,defaultMode:this.settings.museDefaultMode,time:this.settings.museTime,configuredAt:new Date().toISOString()};if(j.museDefaultSchedule&&!allMuse)throw Error('Lịch mặc định Muse chỉ dùng khi tất cả nơi đăng đều qua Muse.');
  const when=this.schedule(j.museDefaultSchedule?(this.settings.museDefaultMode==='slot'?museSettings.nextSlot(this.settings.museTime):null):scheduledAt);if(!j.caption?.trim()&&(!allMuse||!musePlan.autoCaption))throw Error('Viết content trước hoặc chỉ chọn Muse với chế độ tự viết content.');if(j.requireApproval&&selected.some(c=>c.transport==='muse')&&musePlan.autoCaption)throw Error('Chế độ yêu cầu duyệt content cần dùng nội dung đã soạn; tắt Muse tự viết trong cài đặt hoặc bỏ yêu cầu duyệt.');
  if(j.parentId&&(connectionIds.length!==1||connectionIds[0]!==j.connectionId))throw Error('Giữ nguyên nơi đăng của bài con. Tạo bản nháp riêng nếu muốn đổi.');
  for(const connectionId of new Set(connectionIds)){const c=this.publisher.list().find(c=>c.id===connectionId),error=this.publisher.preflight?.({...j,musePlan,connectionId,caption:j.parentId?j.caption:j.captionVariants?.[c?.platform]?.trim()||j.caption});if(error)throw Error(error);}
  for(let index=0;index<j.media.length;index++)await this.store.mediaPath(j.id,index);
  if(j.parentId){if(allMuse)j.musePlan=structuredClone(musePlan);j.scheduledAt=when;j.status=when?'scheduled':'queued';j.error='';j.autoPublish=false;event(j,j.status,'Đã xác nhận xếp hàng.');await this.store.save(j);}
  else{
   j.dispatch={connectionIds:[...new Set(connectionIds)],scheduledAt:when,committed:false};await this.store.save(j);
   const children=[];
   for(const connectionId of j.dispatch.connectionIds){
    let child=await this.store.destination(j,connectionId,when,{staged:true});
    if(!SENT.includes(child.status)&&!['uploading','publishing','queued','scheduled'].includes(child.status)){
     const c=this.publisher.list().find(c=>c.id===connectionId);child.destination=c?{id:c.id,name:c.name||c.id,platform:c.platform,transport:c.transport,pageId:c.pageId,accountId:c.accountId}:null;child.caption=j.captionVariants?.[c?.platform]?.trim()||j.caption;child.brandId=j.brandId||'';child.brandSnapshot=structuredClone(j.brandSnapshot||null);child.reviewState=j.reviewState;child.requireApproval=j.requireApproval===true;if(c.transport==='muse')child.musePlan=structuredClone(musePlan);child.options=structuredClone(j.options||{});child.scheduledAt=when;child.status='staged';child.error='';await this.store.save(child);
    }children.push(child);
   }
   j.status='prepared';j.dispatch.committed=true;j.autoPublish=false;j.error='';event(j,'prepared','Đã lưu đủ hàng chờ theo từng nền tảng.');await this.store.save(j);
   for(const child of children)if(child.status==='staged'){child.status=when?'scheduled':'queued';event(child,child.status,'Đã xác nhận xếp hàng.');await this.store.save(child);}
  }
  await this.changed();return summary(j);
 }
 queuePost(id,data){return this.locked(id,async()=>this.enqueueLocked(await this.store.read(id),data));}
 unqueue(id){return this.locked(id,async()=>{const j=await this.store.read(id);if(!['queued','scheduled','error'].includes(j.status))throw Error('Bài này không thể rút khỏi hàng chờ.');j.status='draft';delete j.musePlan;j.autoPublish=false;j.error='';event(j,'draft','Đã rút khỏi hàng chờ để sửa.');await this.store.save(j);return summary(j);});}
 caption(id,target){return this.locked(id,async controller=>{
  const j=await this.store.read(id);if(FROZEN.includes(j.status))throw Error('Rút bài khỏi hàng chờ trước khi viết lại.');if(j.autoPublish&&!(j.connectionIds||[]).length)throw Error('Chọn nơi đăng trước khi bật tự đăng.');
  j.status='captioning';j.error='';event(j,'captioning','Đang yêu cầu AI đã chọn viết content.');await this.store.save(j);await this.changed();
  try{const text=await this.ask(j,this.settings.prompt,target,controller.signal);controller.signal.throwIfAborted();if(typeof text!=='string'||!text.trim()||text.length>60000)throw Error('AI chưa trả content hợp lệ.');j.caption=text.trim();j.reviewState='draft';j.status='ready';event(j,'ready','Đã nhận content để kiểm tra.');await this.store.save(j);await this.changed();if(j.autoPublish)return await this.enqueueLocked(j);return summary(j);}
  catch(error){if(!SENT.includes(j.status)&&j.status!=='prepared'){j.status='draft';j.autoPublish=false;j.error=error.name==='AbortError'?'Đã dừng viết content.':error.message;event(j,'draft',j.error,error.code);await this.store.save(j);}throw error;}
 });}
 async publishLocked(j,controller){
  let finalRequest=false;
  try{
   controller.signal.throwIfAborted();const invalid=this.publisher.preflight?.(j);if(invalid)throw Error(invalid);
   j.status='uploading';j.error='';j.progress=null;event(j,'uploading','Đang chuẩn bị/tải media.');await this.store.save(j);await this.changed();
   const result=await this.publisher.publish(j,this.store,async(phase='publishing',detail={})=>{
    controller.signal.throwIfAborted();if(phase==='publishing'){finalRequest=true;controller.finalRequest=true;j.status='publishing';event(j,'publishing','Đã bắt đầu yêu cầu đăng.');}
    if(detail.checkpoint)j.internal={...j.internal,...detail.checkpoint};j.progress=detail.progress??null;j.progressMessage=detail.message||'';await this.store.save(j);await this.changed();
   },controller.signal);
   j.status=result.processing?'submitted':'published';j.result=result;if(result.via==='muse'&&j.musePlan?.autoCaption&&typeof result.caption==='string'&&result.caption.trim())j.caption=result.caption.slice(0,60000);j.autoPublish=false;j.progress=null;j.progressMessage='';event(j,j.status,result.via==='muse'?'Đã chuyển bài cho Muse và nhận phản hồi. Chưa xác minh bài trên nền tảng; mở Muse/kênh đích để kiểm tra.':result.processing?'Nền tảng đã nhận; đang kiểm tra xử lý.':'Nền tảng đã xác nhận bài đăng.');await this.store.save(j);return summary(j);
  }catch(error){j.status=finalRequest&&!error.rejected?'uncertain':'error';j.error=j.status==='uncertain'?'Chưa xác định nền tảng đã đăng hay chưa. Kiểm tra tài khoản; app không tự gửi lại.':error.name==='AbortError'?'Đã dừng trước bước gửi bài. Kiểm tra và xếp lại khi sẵn sàng.':error.message;j.autoPublish=false;event(j,j.status,j.error,error.code);await this.store.save(j);throw Error(j.error);}
 }
 publish(id){return this.locked(id,async controller=>{const j=await this.store.read(id);if(SENT.includes(j.status))throw Error('Bài đã gửi hoặc chưa rõ kết quả. Không tự đăng lại.');if(!['queued','scheduled'].includes(j.status))throw Error('Bài đã được rút khỏi hàng chờ.');if(this.closed||this.settings.paused||this.hold||j.scheduledAt&&Date.parse(j.scheduledAt)>Date.now())return summary(j);if(this.publisher.list().find(c=>c.id===j.connectionId)?.transport==='muse'){const reason=this.publisher.muse?.client.dispatch?.holdError('muse');if(reason){if(j.error!==reason){j.error=reason;event(j,j.status,reason);await this.store.save(j);}return summary(j);}}if(this.accounts.has(j.connectionId))return summary(j);this.accounts.add(j.connectionId);try{return await this.publishLocked(j,controller);}finally{this.accounts.delete(j.connectionId);}});}
 resolve(id,confirmed){return this.locked(id,async()=>{const j=await this.store.read(id);if(!(j.status==='uncertain'||j.status==='submitted'&&j.result?.via==='muse')||confirmed!==true)throw Error('Kiểm tra nền tảng trước khi xác nhận chưa đăng.');j.status='draft';delete j.musePlan;if(j.result?.via==='muse')j.result=null;j.autoPublish=false;j.error='Bạn đã xác nhận bài chưa được đăng. Kiểm tra content và xếp lại khi sẵn sàng.';event(j,'draft',j.error,'MANUAL_REVIEW');await this.store.save(j);return summary(j);});}
 confirmMuse(id,confirmed){return this.locked(id,async()=>{const j=await this.store.read(id);if(confirmed!==true||!['submitted','uncertain'].includes(j.status)||!(j.result?.via==='muse'||j.internal?.museRequest))throw Error('Chỉ xác nhận bài đã chuyển cho Muse sau khi kiểm tra trên nền tảng.');j.status='published';j.error='';j.deliveryError='';j.result={...(j.result||{}),id:j.result?.id||j.internal?.museRequest?.requestId||'muse-'+j.id,url:j.result?.url||j.internal?.museRequest?.chatURL,via:'muse',processing:false,verification:'manual'};event(j,'published','Người dùng đã mở nền tảng và xác nhận bài đã đăng.','MANUAL_REVIEW');await this.store.save(j);return summary(j);});}
 approve(id){return this.locked(id,async()=>{const j=await this.store.read(id);if(FROZEN.includes(j.status)||!j.caption?.trim())throw Error('Chỉ duyệt bản nháp đã có content.');for(let i=0;i<j.media.length;i++)await this.store.mediaPath(j.id,i);j.reviewState='approved';j.reviewedAt=new Date().toISOString();event(j,j.status,'Đã duyệt nội dung và các bản riêng theo nền tảng.');await this.store.save(j);return summary(j);});}
 reschedule(id,data){return this.locked(id,async()=>{const j=await this.store.read(id);if(!['queued','scheduled'].includes(j.status))throw Error('Chỉ đổi lịch bài đang chờ, chưa bắt đầu gửi.');if(data.expectedUpdatedAt!==j.updatedAt)throw Error('Bài vừa thay đổi. Làm mới lịch rồi thử lại.');const when=this.schedule(data.scheduledAt);if(!when)throw Error('Chọn ngày và giờ đăng.');j.scheduledAt=when;j.status='scheduled';event(j,'scheduled','Đã đổi lịch đăng thành '+when);await this.store.save(j);return summary(j);});}
 catalog(id,data){return this.locked(id,async()=>{const j=await this.store.read(id);if(data.favorite!==undefined)j.favorite=data.favorite===true;if(data.tags!==undefined){if(!Array.isArray(data.tags)||data.tags.length>10||data.tags.some(t=>typeof t!=='string'||!t.trim()||t.length>32))throw Error('Tối đa 10 nhãn, mỗi nhãn 32 ký tự.');j.tags=[...new Set(data.tags.map(t=>t.trim()))];}await this.store.save(j);return summary(j);});}
 metrics(id){return this.locked(id,async()=>{const j=await this.store.read(id);if(!['published','submitted'].includes(j.status)||!j.result?.id)throw Error('Chỉ đọc thống kê bài đã được nền tảng nhận.');try{const values=await this.publisher.metrics(j);j.stats={values,checkedAt:new Date().toISOString(),error:''};}catch(error){j.stats={...j.stats,error:error.message,attemptedAt:new Date().toISOString()};}await this.store.save(j);return summary(j);});}
 stop(id){const controller=this.active.get(id);if(controller?.finalRequest)throw Error('Nền tảng đang nhận yêu cầu đăng. Chờ xác nhận để tránh gửi trùng.');controller?.abort();}
 remove(id){return this.locked(id,async()=>{const j=await this.store.read(id).catch(()=>null);if(j&&['queued','scheduled','staged'].includes(j.status))throw Error('Rút bài khỏi hàng chờ trước khi xóa.');await this.store.remove(id);});}
 copy(id){return this.locked(id,async()=>summary(await this.store.copyDraft(await this.store.read(id))));}
 busy(){return this.active.size>0;}
 async check(id){return this.locked(id,async()=>{
  const job=await this.store.read(id);if(job.status!=='submitted')return;
  try{const check=await this.publisher.check(job);if(check?.state)job.status=check.state;if(check?.result)job.result=check.result;job.deliveryError=check?.error||'';if(job.status==='published'){job.result.processing=false;event(job,'published','Nền tảng đã xử lý xong.');}else if(job.deliveryError)event(job,'submitted',job.deliveryError,'PROCESSING_ERROR');}
  catch(error){job.deliveryError=error.message;}
  job.lastCheck=new Date().toISOString();await this.store.save(job);
 });}
 async tick(){
  if(this.ticking||this.closed||this.hold)return;this.ticking=true;
  try{
   let jobs=await this.store.list();if(jobs.some(j=>j.status==='staged')){await this.recoverDispatch();jobs=await this.store.list();}const pending=jobs.filter(j=>['queued','scheduled'].includes(j.status)&&(!j.scheduledAt||Date.parse(j.scheduledAt)<=Date.now())).sort((a,b)=>Date.parse(a.scheduledAt||a.createdAt)-Date.parse(b.scheduledAt||b.createdAt));
   if(!this.settings.paused){
    // Two channels may work in parallel, but each account is serialized.
    while(pending.length&&!this.closed&&!this.settings.paused&&!this.hold){const batch=[],accounts=new Set();for(let i=0;i<pending.length&&batch.length<2;){const j=pending[i];if(this.active.has(j.id)){pending.splice(i,1);continue;}if(accounts.has(j.connectionId)){i++;continue;}accounts.add(j.connectionId);batch.push(pending.splice(i,1)[0]);}if(!batch.length)break;await Promise.all(batch.map(j=>this.publish(j.id).catch(()=>{})));}
   }
   if(this.publisher.check&&!this.closed&&!this.hold){const checks=jobs.filter(j=>j.status==='submitted'&&!this.active.has(j.id)&&Date.now()-Date.parse(j.lastCheck||'1970-01-01')>60000).slice(0,2);await Promise.all(checks.map(j=>this.check(j.id).catch(()=>{})));}
   this.schedulerError='';
  }catch(error){this.schedulerError='Hàng chờ chưa chạy được: '+error.message;await this.changed();throw error;}
  finally{this.ticking=false;}
 }
 start(){this.closed=false;this.timer=setInterval(()=>void this.tick().catch(()=>{}),15000);this.timer.unref?.();void this.tick().catch(()=>{});}
 close(){this.closed=true;clearInterval(this.timer);for(const controller of this.active.values())if(!controller.finalRequest)controller.abort();}
}
module.exports={PostingService};
