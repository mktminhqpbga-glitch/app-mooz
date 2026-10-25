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

async function json(response,provider='Nền tảng',{maxBytes=1024*1024}={}){
 let text='';const decoder=new TextDecoder();
 if(response.body?.getReader){
  const reader=response.body.getReader();let size=0;
  try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>Math.min(maxBytes,16*1024*1024)){await reader.cancel();throw problem('INVALID_RESPONSE');}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}
  finally{reader.releaseLock();}
 }else text=await response.text();
 let value;try{value=JSON.parse(text);}catch{throw problem(response.status>=500?'PROVIDER_5XX':'INVALID_RESPONSE',provider+': phản hồi không đọc được.');}
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

module.exports={MESSAGES,problem,json,request,uploadURL,sleep};
