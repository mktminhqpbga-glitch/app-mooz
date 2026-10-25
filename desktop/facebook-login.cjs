'use strict';
const {randomBytes,createHash}=require('node:crypto');
const {request,json,sleep}=require('./posting-http.cjs');
class FacebookLogin{
 constructor({fetch,openExternal,pages,allowLocal=false}){Object.assign(this,{fetch,openExternal,pages,allowLocal});}
 async login(base){
  if(this.controller)throw Error('Đang đăng nhập Facebook. Hoàn tất hoặc hủy lượt trước.');
  let url;try{url=new URL(base);}catch{throw Error('Nhập URL HTTPS của dịch vụ Meta OAuth đã cấu hình.');}
  if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||url.protocol!=='https:'&&!(this.allowLocal&&url.protocol==='http:'&&url.hostname==='127.0.0.1'))throw Error('Dùng URL gốc HTTPS của dịch vụ Meta OAuth.');
  const controller=new AbortController();this.controller=controller;const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(10*60000)]),verifier=randomBytes(48).toString('base64url'),challenge=createHash('sha256').update(verifier).digest('base64url');
  try{
   const start=await json(await request(this.fetch,new URL('/sessions',url).href,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({challenge}),signal}),'Dịch vụ Meta');
   if(!/^[A-Za-z0-9_-]{43}$/.test(start.id||'')||!/^[A-Za-z0-9_-]{43}$/.test(start.ticket||''))throw Error('Dịch vụ trả phiên đăng nhập không hợp lệ.');
   const auth=new URL(start.authURL);if(auth.protocol!=='https:'||auth.hostname!=='www.facebook.com'||auth.username||auth.password||auth.port||!/^\/v\d+\.\d+\/dialog\/oauth$/.test(auth.pathname)||auth.searchParams.get('redirect_uri')!==new URL('/oauth/callback',url).href)throw Error('Dịch vụ trả địa chỉ đăng nhập chưa được cho phép.');
   await this.openExternal(auth.href);
   for(;;){signal.throwIfAborted();const result=await json(await request(this.fetch,new URL('/sessions/poll',url).href,{method:'POST',headers:{Authorization:'Bearer '+start.ticket,'Content-Type':'application/json'},body:JSON.stringify({id:start.id,verifier}),signal}),'Dịch vụ Meta',{maxBytes:16*1024*1024});if(result.status==='ready')return this.pages.stage(result.pages);if(result.status==='error')throw Error('Facebook chưa kết nối được. Kiểm tra quyền Page và cấu hình dịch vụ Meta OAuth.');if(result.status!=='waiting')throw Error('Dịch vụ trả trạng thái không hợp lệ.');await sleep(2000,signal);}
  }catch(error){if(controller.signal.aborted)throw new DOMException('Đã hủy đăng nhập Facebook.','AbortError');if(signal.aborted)throw Error('Hết thời gian đăng nhập Facebook. Bấm đăng nhập lại khi sẵn sàng.');throw error;}finally{if(this.controller===controller)this.controller=null;}
 }
 cancel(){this.controller?.abort();}
}
module.exports={FacebookLogin};
