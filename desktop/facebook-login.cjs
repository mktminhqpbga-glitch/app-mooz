'use strict';
const {randomBytes,createHash}=require('node:crypto');
const {request,json,sleep,MESSAGES,META_MESSAGES}=require('./posting-http.cjs');
class FacebookLogin{
 constructor({fetch,openExternal,pages,allowLocal=false}){Object.assign(this,{fetch,openExternal,pages,allowLocal});}
 endpoint(base){
  if(typeof base!=='string'||!base.trim())throw Error('Chưa cấu hình dịch vụ đăng nhập Facebook. Dùng mục User access token để kết nối trước, hoặc triển khai dịch vụ Meta OAuth theo hướng dẫn.');
  let url;try{url=new URL(base);}catch{throw Error('Nhập URL HTTPS của dịch vụ Meta OAuth đã triển khai, ví dụ https://meta.ten-mien-cua-ban.com/.');}
  if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||url.protocol!=='https:'&&!(this.allowLocal&&url.protocol==='http:'&&url.hostname==='127.0.0.1'))throw Error('Dùng URL gốc HTTPS của dịch vụ Meta OAuth, không thêm đường dẫn hay token.');
  if(url.hostname==='facebook.com'||url.hostname.endsWith('.facebook.com'))throw Error('Cần URL dịch vụ Meta OAuth của bạn, không phải địa chỉ trang Facebook. Nếu chưa có dịch vụ, dùng mục User access token.');
  return url;
 }
 async check(base,{signal}={}){
  const url=this.endpoint(base);let response;try{response=await request(this.fetch,new URL('/health',url).href,{timeout:10000,signal});}catch(error){if(signal?.aborted)throw error;throw Error('Chưa kết nối được dịch vụ Meta OAuth. Kiểm tra URL, mạng và máy chủ HTTPS đã chạy.');}
  let value;try{value=await json(response,'Dịch vụ Meta');}catch{throw Error('URL này chưa trả dịch vụ Meta OAuth hợp lệ tại /health. Kiểm tra địa chỉ triển khai và cấu hình proxy/hosting.');}
  if(value?.ok!==true||value.protocol!=='workflow-meta-oauth-v1')throw Error('Máy chủ này chưa hỗ trợ workflow-meta-oauth-v1. Triển khai dịch vụ Meta OAuth đi kèm repo rồi thử lại.');
  return {ready:true,url:url.origin+'/'};
 }
 async login(base){
  if(this.controller)throw Error('Đang đăng nhập Facebook. Hoàn tất hoặc hủy lượt trước.');
  const url=this.endpoint(base);
  const controller=new AbortController();this.controller=controller;const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(10*60000)]),verifier=randomBytes(48).toString('base64url'),challenge=createHash('sha256').update(verifier).digest('base64url');
  try{
   await this.check(base,{signal});signal.throwIfAborted();
   const start=await json(await request(this.fetch,new URL('/sessions',url).href,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({challenge}),signal}),'Dịch vụ Meta');
   if(!/^[A-Za-z0-9_-]{43}$/.test(start.id||'')||!/^[A-Za-z0-9_-]{43}$/.test(start.ticket||''))throw Error('Dịch vụ trả phiên đăng nhập không hợp lệ.');
   const auth=new URL(start.authURL);if(auth.protocol!=='https:'||auth.hostname!=='www.facebook.com'||auth.username||auth.password||auth.port||!/^\/v\d+\.\d+\/dialog\/oauth$/.test(auth.pathname)||auth.searchParams.get('redirect_uri')!==new URL('/oauth/callback',url).href)throw Error('Dịch vụ trả địa chỉ đăng nhập chưa được cho phép.');
   await this.openExternal(auth.href);
   for(;;){signal.throwIfAborted();const result=await json(await request(this.fetch,new URL('/sessions/poll',url).href,{method:'POST',headers:{Authorization:'Bearer '+start.ticket,'Content-Type':'application/json'},body:JSON.stringify({id:start.id,verifier}),signal}),'Dịch vụ Meta',{maxBytes:16*1024*1024});if(result.status==='ready')return this.pages.stage(result.pages);if(result.status==='error'){const reason=result.errorCode==='CONSENT_DENIED'?'Bạn đã hủy hoặc chưa cấp quyền Facebook. Đăng nhập lại và chọn Page muốn kết nối.':Object.hasOwn(META_MESSAGES,result.errorCode)?META_MESSAGES[result.errorCode]:Object.hasOwn(MESSAGES,result.errorCode)?MESSAGES[result.errorCode]:'Facebook chưa kết nối được. Kiểm tra quyền Page và cấu hình dịch vụ Meta OAuth.';const suffix=Number.isSafeInteger(result.metaCode)?' [Meta '+result.metaCode+(Number.isSafeInteger(result.metaSubcode)?'/'+result.metaSubcode:'')+']':'';throw Error(reason+suffix);}if(result.status!=='waiting')throw Error('Dịch vụ trả trạng thái không hợp lệ.');await sleep(2000,signal);}
  }catch(error){if(controller.signal.aborted)throw new DOMException('Đã hủy đăng nhập Facebook.','AbortError');if(signal.aborted)throw Error('Hết thời gian đăng nhập Facebook. Bấm đăng nhập lại khi sẵn sàng.');throw error;}finally{if(this.controller===controller)this.controller=null;}
 }
 cancel(){this.controller?.abort();}
}
module.exports={FacebookLogin};
