'use strict';

const MESSAGES={
 AUTH_EXPIRED:'Kết nối đã hết hạn hoặc bị thu hồi. Kết nối lại tài khoản.',
 PERMISSION_DENIED:'Ứng dụng hoặc tài khoản chưa có quyền đăng. Kiểm tra quyền và trạng thái xét duyệt của nền tảng.',
 RATE_LIMIT:'Nền tảng đang giới hạn lượt gọi hoặc lượt đăng. Chọn lịch muộn hơn rồi thử lại.',
 MEDIA_UNSUPPORTED:'Tệp hoặc thông tin đăng chưa đáp ứng yêu cầu của nền tảng. Kiểm tra định dạng, kích thước và nội dung.',
 ACCOUNT_UNAVAILABLE:'Không tìm thấy tài khoản/kênh được cấp quyền.',
 NETWORK:'Không kết nối được nền tảng. Kiểm tra mạng; không tự gửi lại khi chưa rõ kết quả.',
 PROVIDER_5XX:'Máy chủ nền tảng gặp lỗi. Kiểm tra bài đã đăng trước khi thử lại.',
 INVALID_RESPONSE:'Nền tảng trả phản hồi chưa xác nhận được kết quả.'
};

function problem(code,message,{rejected=false}={}){
 return Object.assign(new Error(message||MESSAGES[code]||MESSAGES.INVALID_RESPONSE),{code,rejected});
}

const META_MESSAGES={
 USER_TOKEN_REQUIRED:'Đây là token của Page. Để lấy danh sách nhiều Page, dùng User access token có pages_show_list. Muốn nối một Page, dùng Facebook Page trực tiếp.',
 APP_SECRET_PROOF_REQUIRED:'Ứng dụng Meta yêu cầu appsecret_proof. Kết nối bằng dịch vụ Meta OAuth đã cấu hình để tạo proof; nhập token thủ công chưa đáp ứng yêu cầu này.',
 META_INVALID_REQUEST:'Meta chưa chấp nhận yêu cầu. Kiểm tra loại token, các quyền Page và cấu hình ứng dụng Meta.'
};
function metaProblem(value,status=400){
 const error=value?.error||{},number=Number.isSafeInteger(error.code)?error.code:null,subcode=Number.isSafeInteger(error.error_subcode)?error.error_subcode:null,detail=typeof error.message==='string'?error.message.slice(0,4096):'';
 let code=status>=500?'PROVIDER_5XX':status===401||[102,190].includes(number)?'AUTH_EXPIRED':/appsecret_proof/i.test(detail)?'APP_SECRET_PROOF_REQUIRED':number===100&&/accounts|permissions/i.test(detail)&&/\bpage\b/i.test(detail)&&/nonexisting|cannot query|does not exist|unknown field/i.test(detail)?'USER_TOKEN_REQUIRED':[10,200,294].includes(number)||status===403?'PERMISSION_DENIED':[4,17,32,341,613].includes(number)||status===429?'RATE_LIMIT':'META_INVALID_REQUEST';
 let message=META_MESSAGES[code]||MESSAGES[code];if(code==='AUTH_EXPIRED')message='Token Facebook đã hết hạn, bị thu hồi hoặc không hợp lệ. Tạo token mới và cấp lại quyền cho các Page.';
 if(code==='PERMISSION_DENIED')message='Meta chưa cấp đủ quyền Page hoặc tài khoản chưa có vai trò phù hợp. Kiểm tra pages_show_list, pages_read_engagement, pages_manage_posts và quyền của ứng dụng.';
 const suffix=number!==null?' [Meta '+number+(subcode!==null?'/'+subcode:'')+']':' [HTTP '+status+']';
 return Object.assign(problem(code,message+suffix,{rejected:status<500}),{metaCode:number,metaSubcode:subcode,httpStatus:status});
}

async function json(response,provider='Nền tảng',{maxBytes=1024*1024}={}){
 let text='';const decoder=new TextDecoder();
 if(response.body?.getReader){
  const reader=response.body.getReader();let size=0;
  try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>Math.min(maxBytes,16*1024*1024)){await reader.cancel();throw problem('INVALID_RESPONSE');}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}
  finally{reader.releaseLock();}
 }else text=await response.text();
 let value;try{value=JSON.parse(text);}catch{throw problem(response.status>=500?'PROVIDER_5XX':'INVALID_RESPONSE',provider+': phản hồi không đọc được.');}
 if(provider==='Meta'&&(!response.ok||value?.error))throw metaProblem(value,response.status);
 if(!response.ok){
  const reason=value.error?.errors?.[0]?.reason||value.error;
  const code=response.status===401||['invalid_grant','invalid_token'].includes(reason)?'AUTH_EXPIRED':/quota|LimitExceeded|rateLimit/i.test(typeof reason==='string'?reason:'')?'RATE_LIMIT':response.status===403?'PERMISSION_DENIED':response.status===429?'RATE_LIMIT':response.status>=500?'PROVIDER_5XX':'MEDIA_UNSUPPORTED';
  throw problem(code,provider+': '+MESSAGES[code],{rejected:response.status>=400&&response.status<500});
 }
 return value;
}

async function request(fetch,url,options={}){
 options.signal?.throwIfAborted();
 const signal=options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(options.timeout||30000)]):AbortSignal.timeout(options.timeout||30000);
 try{return await fetch(url,{...options,signal,credentials:'omit',redirect:'error'});}
 catch(error){if(options.signal?.aborted)throw new DOMException('Đã dừng.','AbortError');throw problem('NETWORK');}
}

function uploadURL(value,platform){
 let url;try{url=new URL(value);}catch{throw problem('INVALID_RESPONSE','Địa chỉ tải lên do nền tảng trả về không hợp lệ.');}
 const allowed=platform==='youtube'?['www.googleapis.com','youtube.googleapis.com'].includes(url.hostname)&&url.pathname.startsWith('/upload/youtube/'):
  platform==='tiktok'?(url.hostname==='open-upload.tiktokapis.com'||/^upload(?:[.-][a-z0-9-]+)*\.tiktokapis\.com$/.test(url.hostname)):false;
 if(!allowed||url.protocol!=='https:'||url.port||url.username||url.password)throw problem('INVALID_RESPONSE','Nền tảng trả máy chủ tải lên chưa được cho phép.');
 return url.href;
}

function sleep(ms,signal){return new Promise((resolve,reject)=>{
 if(signal?.aborted){reject(new DOMException('Đã dừng.','AbortError'));return;}
 const finish=()=>{signal?.removeEventListener('abort',cancel);resolve();},timer=setTimeout(finish,ms),cancel=()=>{clearTimeout(timer);signal?.removeEventListener('abort',cancel);reject(new DOMException('Đã dừng.','AbortError'));};
 signal?.addEventListener('abort',cancel,{once:true});
});}

module.exports={MESSAGES,META_MESSAGES,metaProblem,problem,json,request,uploadURL,sleep};
