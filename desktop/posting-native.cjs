'use strict';

const fs=require('node:fs/promises');
const {createHash,randomUUID}=require('node:crypto');
const {json,request,problem,uploadURL,sleep}=require('./posting-http.cjs');
const {GOOGLE_TOKEN}=require('./posting-oauth.cjs');
const GOOGLE='https://www.googleapis.com/';
const TIKTOK='https://open.tiktokapis.com/v2/';
const PRIVACY=['PUBLIC_TO_EVERYONE','MUTUAL_FOLLOW_FRIENDS','FOLLOWER_OF_CREATOR','SELF_ONLY'];
const outputs=job=>job.media.map((m,index)=>({...m,index})).filter(m=>m.role==='output');

function tikTokChunks(size){
 const chunk=Math.min(size,32*1024*1024),count=Math.max(1,Math.floor(size/chunk));
 return {chunkSize:chunk,count,ranges:Array.from({length:count},(_,i)=>({start:i*chunk,end:i===count-1?size-1:(i+1)*chunk-1}))};
}

class NativePublishers{
 constructor(owner){this.owner=owner;this.refreshes=new Map();}
 get fetch(){return this.owner.fetch;}
 secret(c){try{return JSON.parse(c.token);}catch{throw problem('AUTH_EXPIRED');}}
 async saveSecret(c,value,metadata={}){
  await this.owner.serial(async()=>{const current=this.owner.connections.find(item=>item.id===c.id);if(!current)throw problem('AUTH_EXPIRED');current.token=JSON.stringify(value);Object.assign(current,metadata);await this.owner.persist();});
  c.token=JSON.stringify(value);Object.assign(c,metadata);
 }
 async token(c,force=false){
  const value=this.secret(c);if(!force&&(!value.expiresAt||value.expiresAt>Date.now()+90000))return value.accessToken;
  if(!value.refreshToken||!c.id)throw problem('AUTH_EXPIRED');
  if(this.refreshes.has(c.id))return this.refreshes.get(c.id);
  const pending=(async()=>{
   let form,url;
   if(c.transport==='youtube'){
    url=GOOGLE_TOKEN;form={client_id:value.clientId,client_secret:value.clientSecret,refresh_token:value.refreshToken,grant_type:'refresh_token'};
   }else if(c.transport==='tiktok'){
    url=TIKTOK+'oauth/token/';form={client_key:value.clientKey,client_secret:value.clientSecret,refresh_token:value.refreshToken,grant_type:'refresh_token'};
   }else throw problem('AUTH_EXPIRED');
   const response=await request(this.fetch,url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(form).toString()});
   const result=await json(response,c.transport==='youtube'?'Google':'TikTok');
   if(!result.access_token)throw problem('AUTH_EXPIRED');
   if(c.transport==='tiktok'&&value.openId&&result.open_id!==value.openId)throw problem('AUTH_EXPIRED','TikTok trả một tài khoản khác. Dừng và kết nối lại đúng tài khoản.');
   const next={...value,accessToken:result.access_token,refreshToken:result.refresh_token||value.refreshToken,expiresAt:Date.now()+Number(result.expires_in||3600)*1000,...(result.open_id?{openId:result.open_id}:{})};
   await this.saveSecret(c,next);return next.accessToken;
  })().finally(()=>this.refreshes.delete(c.id));
  this.refreshes.set(c.id,pending);return pending;
 }
 async youtubeAPI(c,route,options={}){
  const send=async()=>json(await request(this.fetch,GOOGLE+route,{...options,headers:{Authorization:'Bearer '+await this.token(c),...options.headers}}),'YouTube');
  try{return await send();}catch(error){if(error.code!=='AUTH_EXPIRED'||options.method&&options.method!=='GET'||!this.secret(c).refreshToken)throw error;await this.token(c,true);return send();}
 }
 async tiktokAPI(c,route,body={},signal,retried=false){
  const token=await this.token(c),response=await request(this.fetch,TIKTOK+route,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json; charset=UTF-8'},body:JSON.stringify(body),signal});
  let value;try{value=await json(response,'TikTok');}catch(error){if(!retried&&error.code==='AUTH_EXPIRED'&&this.secret(c).refreshToken){await this.token(c,true);return this.tiktokAPI(c,route,body,signal,true);}throw error;}const code=value.error?.code;
  if(code!=='ok'){
   if(!retried&&/access_token|token_expired/.test(code||'')&&this.secret(c).refreshToken){await this.token(c,true);return this.tiktokAPI(c,route,body,signal,true);}
   const mapped=/access_token|token_expired|scope_not_authorized/.test(code||'')?'AUTH_EXPIRED':/unaudited|banned|permission/.test(code||'')?'PERMISSION_DENIED':/spam_risk|cap|rate_limit/.test(code||'')?'RATE_LIMIT':'MEDIA_UNSUPPORTED';
   throw problem(mapped,'TikTok: '+(code==='unaudited_client_can_only_post_to_private_accounts'?'Ứng dụng TikTok chưa được duyệt đăng công khai. Chỉ chọn quyền riêng tư do TikTok cho phép.':require('./posting-http.cjs').MESSAGES[mapped]),{rejected:true});
  }
  return value.data;
 }
 async connectYouTube(tokens){
  const candidate={transport:'youtube',token:JSON.stringify(tokens)},value=await this.youtubeAPI(candidate,'youtube/v3/channels?part=snippet&mine=true');
  if(value.items?.length!==1||!/^UC[a-zA-Z0-9_-]{22}$/.test(value.items[0].id||''))throw problem('ACCOUNT_UNAVAILABLE','Google chưa trả một kênh YouTube duy nhất. Kết nối lại và chọn đúng kênh/tài khoản thương hiệu.');
  const channel=value.items[0];return this.owner.serial(async()=>{
   let c=this.owner.connections.find(c=>c.transport==='youtube'&&c.accountId===channel.id);
   if(!c)this.owner.connections.push(c={id:randomUUID(),platform:'youtube',transport:'youtube',accountId:channel.id});
   c.name=String(channel.snippet?.title||channel.id).slice(0,160);c.token=JSON.stringify(tokens);c.verifiedAt=new Date().toISOString();
   await this.owner.persist();return this.owner.list();
  });
 }
 async connectTikTok({accessToken,refreshToken='',clientKey='',clientSecret=''}){
  if(typeof accessToken!=='string'||accessToken.length<20||accessToken.length>4096||/[\s\x00-\x1f]/.test(accessToken)||[refreshToken,clientKey,clientSecret].some(x=>typeof x!=='string'||x.length>4096))throw Error('Nhập access token TikTok đã được cấp quyền video.publish.');
  if(refreshToken&&(!clientKey||!clientSecret))throw Error('Muốn tự làm mới TikTok cần client key và client secret của ứng dụng đã cấp token.');
  const token={accessToken,refreshToken,clientKey,clientSecret},candidate={transport:'tiktok',token:JSON.stringify(token)};
  const creator=await this.tiktokAPI(candidate,'post/publish/creator_info/query/');this.validateCreator(creator);
  return this.owner.serial(async()=>{
   let c=this.owner.connections.find(c=>c.transport==='tiktok'&&c.username===creator.creator_username);
   if(!c)this.owner.connections.push(c={id:randomUUID(),platform:'tiktok',transport:'tiktok',username:creator.creator_username});
   c.name=String(creator.creator_nickname||creator.creator_username).slice(0,160);c.creator=this.creatorPublic(creator);c.token=JSON.stringify(token);c.verifiedAt=new Date().toISOString();await this.owner.persist();return this.owner.list();
  });
 }
 creatorPublic(value){return {username:value.creator_username,privacyOptions:value.privacy_level_options.filter(x=>PRIVACY.includes(x)),commentDisabled:!!value.comment_disabled,duetDisabled:!!value.duet_disabled,stitchDisabled:!!value.stitch_disabled,maxDuration:Number(value.max_video_post_duration_sec)};}
 validateCreator(value){if(!/^[a-zA-Z0-9._]{1,32}$/.test(value?.creator_username||'')||!Array.isArray(value.privacy_level_options)||!value.privacy_level_options.length||(!Number.isFinite(Number(value.max_video_post_duration_sec))||Number(value.max_video_post_duration_sec)<=0))throw problem('INVALID_RESPONSE','TikTok chưa trả đủ thông tin tài khoản và quyền đăng.');}
 async connectInstagram({facebookId}){
  const page=this.owner.connections.find(c=>c.id===facebookId&&(c.transport||'facebook')==='facebook');if(!page)throw Error('Kết nối Facebook Page trước, rồi chọn Page đã liên kết Instagram chuyên nghiệp.');
  const value=await this.owner.graph(page.pageId+'?fields=instagram_business_account{id,username}',page.token),account=value.instagram_business_account;
  if(!/^\d+$/.test(account?.id||'')||!account.username)throw Error('Page chưa liên kết tài khoản Instagram chuyên nghiệp hoặc token thiếu quyền Instagram.');
  return this.owner.serial(async()=>{
   let c=this.owner.connections.find(c=>c.transport==='instagram'&&c.accountId===account.id);
   if(!c)this.owner.connections.push(c={id:randomUUID(),platform:'instagram',transport:'instagram',accountId:account.id});
   c.pageId=page.pageId;c.name='@'+String(account.username).slice(0,100);c.username=String(account.username).slice(0,100);c.token=page.token;c.verifiedAt=new Date().toISOString();await this.owner.persist();return this.owner.list();
  });
 }
 storage(){const c=this.owner.connections.find(c=>c.transport==='cloudinary');return {connected:!!c,id:c?.id||'',name:c?.name||'',maxBytes:100*1024*1024};}
 async connectStorage({cloudName,apiKey,apiSecret}){
  if(!/^[a-z0-9_-]{1,64}$/.test(cloudName||'')||!/^\d{5,32}$/.test(apiKey||'')||typeof apiSecret!=='string'||apiSecret.length<12||apiSecret.length>256||/\s/.test(apiSecret))throw Error('Nhập cloud name, API key và API secret của Cloudinary.');
  const headers={Authorization:'Basic '+Buffer.from(apiKey+':'+apiSecret).toString('base64')};
  await json(await request(this.fetch,'https://api.cloudinary.com/v1_1/'+cloudName+'/resources/image?max_results=1',{headers}),'Cloudinary');
  return this.owner.serial(async()=>{let c=this.owner.connections.find(c=>c.transport==='cloudinary');if(!c)this.owner.connections.push(c={id:randomUUID(),platform:'storage',transport:'cloudinary'});c.name=cloudName;c.token=JSON.stringify({cloudName,apiKey,apiSecret});await this.owner.persist();return this.storage();});
 }
 async hostMedia(job,media,store,signal){
  const c=this.owner.connections.find(c=>c.transport==='cloudinary');if(!c)throw Error('Instagram cần kho media công khai. Kết nối Cloudinary trong phần Thiết lập trước.');
  if(media.size>100*1024*1024)throw Error('Tệp Instagram qua Cloudinary tối đa 100 MB. Xuất video nhỏ hơn rồi thêm lại.');
  const secret=this.secret(c),timestamp=String(Math.floor(Date.now()/1000)),publicId='workflow/'+job.id+'/'+media.index,signature=createHash('sha1').update('public_id='+publicId+'&timestamp='+timestamp+secret.apiSecret).digest('hex');
  const body=new FormData();body.set('file',new Blob([await fs.readFile(await store.mediaPath(job.id,media.index))],{type:media.mime}),media.name);for(const [key,value]of Object.entries({api_key:secret.apiKey,timestamp,public_id:publicId,signature}))body.set(key,value);
  const kind=media.kind==='video'?'video':'image',value=await json(await request(this.fetch,'https://api.cloudinary.com/v1_1/'+secret.cloudName+'/'+kind+'/upload',{method:'POST',body,signal,timeout:180000}),'Cloudinary');
  let url;try{url=new URL(value.secure_url);}catch{throw problem('INVALID_RESPONSE');}
  if(url.protocol!=='https:'||url.hostname!=='res.cloudinary.com'||url.username||url.password||!url.pathname.startsWith('/'+secret.cloudName+'/'+kind+'/upload/'))throw problem('INVALID_RESPONSE','Kho media trả URL chưa được cho phép.');
  if(kind==='image')url.pathname=url.pathname.replace('/image/upload/','/image/upload/f_jpg,q_auto/');return url.href;
 }
 preflight(job,c){
  const media=outputs(job),opts=job.options||{};
  if(['youtube','tiktok'].includes(c.transport)&&(media.length!==1||media[0].kind!=='video'))return 'Kết nối này chỉ nhận một video. Thêm kết quả video hoặc chọn nơi đăng ảnh.';
  if(c.transport==='youtube'){
   const youtube=opts.youtube||{};if(!['private','unlisted','public'].includes(youtube.privacy)||typeof youtube.madeForKids!=='boolean')return 'Chọn quyền riêng tư và xác nhận video có dành cho trẻ em hay không.';
   if((youtube.title||job.title).length>100||job.caption.length>5000)return 'YouTube: tiêu đề tối đa 100 ký tự, mô tả tối đa 5.000 ký tự.';
  }
  if(c.transport==='tiktok'){
   const tiktok=opts.tiktok||{};if(!PRIVACY.includes(tiktok.privacy)||!c.creator?.privacyOptions?.includes(tiktok.privacy))return 'Chọn quyền riêng tư TikTok mà tài khoản đang cho phép.';
   if(tiktok.musicRights!==true)return 'Xác nhận quyền sử dụng nội dung/âm nhạc trước khi đăng TikTok.';
   if(job.caption.length>2200)return 'TikTok: content tối đa 2.200 ký tự.';
   if(!media[0].duration||media[0].duration>c.creator.maxDuration)return 'TikTok: chưa có thời lượng hợp lệ hoặc video vượt giới hạn của tài khoản.';
   if(tiktok.branded&&tiktok.privacy==='SELF_ONLY')return 'TikTok không cho nội dung hợp tác thương hiệu ở chế độ chỉ mình tôi.';
  }
  if(c.transport==='instagram'){
   if(!this.storage().connected)return 'Kết nối kho media Cloudinary trước khi đăng Instagram.';
   if(media.some(m=>m.kind==='video'&&!['video/mp4','video/quicktime'].includes(m.mime)))return 'Instagram Reels cần video MP4 hoặc MOV. Xuất MP4 rồi thêm lại.';
   if(job.caption.length>2200)return 'Instagram: content tối đa 2.200 ký tự.';
   if(media.some(m=>m.size>100*1024*1024))return 'Instagram: tệp qua kho media hiện giới hạn 100 MB.';
  }
  return '';
 }
 async publish(job,store,phase,signal){
  const c=this.owner.connections.find(c=>c.id===job.connectionId);if(!c)throw problem('AUTH_EXPIRED');const error=this.preflight(job,c);if(error)throw problem('MEDIA_UNSUPPORTED',error,{rejected:true});
  if(c.transport==='youtube')return this.publishYouTube(job,c,store,phase,signal);
  if(c.transport==='tiktok')return this.publishTikTok(job,c,store,phase,signal);
  if(c.transport==='instagram')return this.publishInstagram(job,c,store,phase,signal);
  throw Error('Kết nối chưa hỗ trợ đăng trực tiếp.');
 }
 async publishYouTube(job,c,store,phase,signal){
  const me=await this.youtubeAPI(c,'youtube/v3/channels?part=id&mine=true',{signal});if(me.items?.length!==1||me.items[0].id!==c.accountId)throw problem('ACCOUNT_UNAVAILABLE','Token YouTube không còn thuộc đúng kênh đã chọn. Kết nối lại.');
  const m=outputs(job)[0],opts=job.options.youtube,token=await this.token(c),metadata={snippet:{title:opts.title||job.title,description:job.caption,categoryId:'22'},status:{privacyStatus:opts.privacy,selfDeclaredMadeForKids:opts.madeForKids,containsSyntheticMedia:opts.synthetic===true}};
  await phase('uploading',{message:'YouTube: đang tạo phiên tải video…'});
  const init=await request(this.fetch,GOOGLE+'upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json; charset=UTF-8','X-Upload-Content-Length':String(m.size),'X-Upload-Content-Type':m.mime},body:JSON.stringify(metadata),signal});
  if(!init.ok)await json(init,'YouTube');const session=uploadURL(init.headers.get('location'),'youtube');
  const file=await fs.open(await store.mediaPath(job.id,m.index),'r');
  try{for(let offset=0;offset<m.size;offset+=8*1024*1024){
   if(signal?.aborted)throw new DOMException('Đã dừng.','AbortError');const length=Math.min(8*1024*1024,m.size-offset),bytes=Buffer.alloc(length),read=await file.read(bytes,0,length,offset);if(read.bytesRead!==length)throw Error('Tệp video nguồn đã đổi trong lúc tải.');
   const final=offset+length===m.size;await phase(final?'publishing':'uploading',{message:'YouTube: tải '+Math.round((offset+length)/m.size*100)+'%',progress:Math.round((offset+length)/m.size*100)});
   const response=await request(this.fetch,session,{method:'PUT',headers:{Authorization:'Bearer '+await this.token(c),'Content-Type':m.mime,'Content-Length':String(length),'Content-Range':`bytes ${offset}-${offset+length-1}/${m.size}`},body:bytes,signal,timeout:180000});
   if(response.status===308){if(final||response.headers.get('range')!==`bytes=0-${offset+length-1}`)throw problem('INVALID_RESPONSE','YouTube chưa xác nhận đúng số byte video đã nhận.');continue;}
   const result=await json(response,'YouTube');if(!final||!/^[a-zA-Z0-9_-]{11}$/.test(result.id||''))throw problem('INVALID_RESPONSE','YouTube chưa xác nhận mã video.');return {id:result.id,url:'https://www.youtube.com/watch?v='+result.id,processing:result.status?.uploadStatus!=='processed',visibility:opts.privacy};
  }}finally{await file.close();}
  throw problem('INVALID_RESPONSE');
 }
 async publishTikTok(job,c,store,phase,signal){
  const creator=await this.tiktokAPI(c,'post/publish/creator_info/query/',{},signal);this.validateCreator(creator);if(creator.creator_username!==c.username)throw problem('ACCOUNT_UNAVAILABLE','Token TikTok không thuộc đúng tài khoản đã chọn.');
  const m=outputs(job)[0],opts=job.options.tiktok,publicCreator=this.creatorPublic(creator),freshError=this.preflight(job,{...c,creator:publicCreator});if(freshError)throw problem('PERMISSION_DENIED',freshError,{rejected:true});
  const chunks=tikTokChunks(m.size),post_info={title:job.caption,privacy_level:opts.privacy,disable_comment:creator.comment_disabled||opts.disableComment===true,disable_duet:creator.duet_disabled||opts.disableDuet===true,disable_stitch:creator.stitch_disabled||opts.disableStitch===true,brand_content_toggle:opts.branded===true,brand_organic_toggle:opts.ownBrand===true,is_aigc:opts.synthetic===true};
  await phase('uploading',{message:'TikTok: đang tạo phiên tải video…'});
  const init=await this.tiktokAPI(c,'post/publish/video/init/',{post_info,source_info:{source:'FILE_UPLOAD',video_size:m.size,chunk_size:chunks.chunkSize,total_chunk_count:chunks.count}},signal);
  if(typeof init?.publish_id!=='string'||!init.publish_id||init.publish_id.length>64)throw problem('INVALID_RESPONSE');const url=uploadURL(init.upload_url,'tiktok');
  await phase('uploading',{checkpoint:{publishId:init.publish_id},message:'TikTok: đang tải video…'});
  const file=await fs.open(await store.mediaPath(job.id,m.index),'r');try{for(const [index,range]of chunks.ranges.entries()){
   if(signal?.aborted)throw new DOMException('Đã dừng.','AbortError');const length=range.end-range.start+1,buffer=Buffer.alloc(length),read=await file.read(buffer,0,length,range.start);if(read.bytesRead!==length)throw Error('Tệp video nguồn đã đổi.');
   await phase(index===chunks.count-1?'publishing':'uploading',{message:'TikTok: tải '+Math.round((range.end+1)/m.size*100)+'%',progress:Math.round((range.end+1)/m.size*100)});
   const response=await request(this.fetch,url,{method:'PUT',headers:{'Content-Type':m.mime,'Content-Length':String(length),'Content-Range':`bytes ${range.start}-${range.end}/${m.size}`},body:buffer,signal,timeout:180000});if(!response.ok)await json(response,'TikTok');
  }}finally{await file.close();}
  return {id:init.publish_id,url:'https://www.tiktok.com/@'+encodeURIComponent(c.username),accountLink:true,processing:true,visibility:opts.privacy};
 }
 async publishInstagram(job,c,store,phase,signal){
  const media=outputs(job),urls=[];for(const [i,m]of media.entries()){await phase('uploading',{message:'Instagram: chuẩn bị tệp '+(i+1)+'/'+media.length+'…'});urls.push(await this.hostMedia(job,m,store,signal));}
  const make=async fields=>{const value=await this.owner.graph(c.accountId+'/media',c.token,{method:'POST',body:new URLSearchParams(fields),signal});if(!/^\d+$/.test(value.id||''))throw problem('INVALID_RESPONSE');return value.id;};
  const waitContainer=async id=>{for(let attempt=0;attempt<90;attempt++){const state=await this.owner.graph(id+'?fields=status_code',c.token,{signal});if(state.status_code==='FINISHED')return;if(['ERROR','EXPIRED'].includes(state.status_code))throw problem('MEDIA_UNSUPPORTED','Instagram không xử lý được tệp. Kiểm tra định dạng và giới hạn tài khoản.',{rejected:true});await sleep(2000,signal);}throw problem('MEDIA_UNSUPPORTED','Instagram chưa xử lý xong media. Chưa gửi yêu cầu đăng; thử lại sau khi kiểm tra tệp.');};
  let container;
  if(media[0].kind==='video')container=await make({media_type:'REELS',video_url:urls[0],caption:job.caption,share_to_feed:'true'});
  else if(media.length===1)container=await make({image_url:urls[0],caption:job.caption});
  else{const children=[];for(const url of urls){const id=await make({image_url:url,is_carousel_item:'true'});await waitContainer(id);children.push(id);}container=await make({media_type:'CAROUSEL',children:children.join(','),caption:job.caption});}
  await phase('uploading',{checkpoint:{containerId:container},message:'Instagram: đang xử lý media…'});
  await waitContainer(container);
  await phase('publishing',{message:'Instagram: đang gửi bài…'});const result=await this.owner.graph(c.accountId+'/media_publish',c.token,{method:'POST',body:new URLSearchParams({creation_id:container}),signal});if(!/^\d+$/.test(result.id||''))throw problem('INVALID_RESPONSE');
  let url='https://www.instagram.com/'+encodeURIComponent(c.username)+'/',accountLink=true;try{const media=await this.owner.graph(result.id+'?fields=permalink',c.token);const candidate=new URL(media.permalink);if(candidate.protocol==='https:'&&['www.instagram.com','instagram.com'].includes(candidate.hostname)&&!candidate.username&&!candidate.password){url=candidate.href;accountLink=false;}}catch{}
  return {id:result.id,url,accountLink,processing:false};
 }
 async check(job,c){
  if(c.transport==='youtube'){
   const value=await this.youtubeAPI(c,'youtube/v3/videos?part=status,processingDetails&id='+encodeURIComponent(job.result.id));const item=value.items?.find(x=>x.id===job.result.id);if(!item)return {state:'submitted',error:'YouTube chưa cho đọc trạng thái video. Kiểm tra trong YouTube Studio.'};
   if(['failed','rejected','deleted'].includes(item.status?.uploadStatus)||item.processingDetails?.processingStatus==='failed')return {state:'submitted',error:'YouTube báo xử lý/từ chối video. Mở YouTube Studio để xem lý do và chỉnh sửa.'};if(item.status?.uploadStatus==='processed'||item.processingDetails?.processingStatus==='succeeded')return {state:'published'};return null;
  }
  if(c.transport==='tiktok'){
   const state=await this.tiktokAPI(c,'post/publish/status/fetch/',{publish_id:job.result.id});if(state.status==='FAILED')return {state:'submitted',error:'TikTok từ chối xử lý bài ('+String(state.fail_reason||'unknown').replace(/[^a-zA-Z0-9_ -]/g,'').slice(0,100)+'). Kiểm tra quyền, định dạng và giới hạn tài khoản.'};
   if(state.status==='PUBLISH_COMPLETE'){
    const ids=state.publicaly_available_post_id||state.publicly_available_post_id||[],id=Array.isArray(ids)?String(ids[0]||''):'';
    const result=/^\d+$/.test(id)?{...job.result,id,url:'https://www.tiktok.com/@'+encodeURIComponent(c.username)+'/video/'+id,accountLink:false,processing:false}:{...job.result,processing:false};return {state:'published',result};
   }
   return null;
  }
  return null;
 }
 async verify(c){
  if(c.transport==='youtube'){const value=await this.youtubeAPI(c,'youtube/v3/channels?part=id&mine=true');if(value.items?.length!==1||value.items[0].id!==c.accountId)throw problem('ACCOUNT_UNAVAILABLE');}
  else if(c.transport==='tiktok'){const value=await this.tiktokAPI(c,'post/publish/creator_info/query/');this.validateCreator(value);if(value.creator_username!==c.username)throw problem('ACCOUNT_UNAVAILABLE');c.creator=this.creatorPublic(value);}
  else if(c.transport==='instagram'){const value=await this.owner.graph(c.accountId+'?fields=id,username',c.token);if(value.id!==c.accountId)throw problem('ACCOUNT_UNAVAILABLE');}
  return {verified:true};
 }
}

module.exports={NativePublishers,tikTokChunks,PRIVACY,GOOGLE,TIKTOK};
