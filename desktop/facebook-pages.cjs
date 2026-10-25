'use strict';
const {createHmac}=require('node:crypto');
const {request,json}=require('./posting-http.cjs');
const GRAPH='https://graph.facebook.com/v24.0/';
const validToken=token=>typeof token==='string'&&token.length>=20&&token.length<=4096&&!/[\s\x00-\x1f]/.test(token);
async function discoverPages({fetch,token,appSecret,signal}){
 if(!validToken(token))throw Error('Nhập User access token có quyền pages_show_list; không dùng Page token cho bước lấy danh sách.');
 const pages=[],seen=new Set();let after='';
 for(let page=0;page<20;page++){
  const url=new URL('me/accounts',GRAPH);url.searchParams.set('fields','id,name,access_token,tasks');url.searchParams.set('limit','100');if(after)url.searchParams.set('after',after);if(appSecret)url.searchParams.set('appsecret_proof',createHmac('sha256',appSecret).update(token).digest('hex'));
  const value=await json(await request(fetch,url.href,{headers:{Authorization:'Bearer '+token},signal}),'Meta');if(value.error)throw Error('Meta chưa cấp quyền đọc Page. Kiểm tra pages_show_list và vai trò quản lý Page.');if(!Array.isArray(value.data))throw Error('Meta chưa trả danh sách Page hợp lệ.');
  for(const row of value.data){if(!/^\d{4,30}$/.test(row.id||''))continue;if(seen.has(row.id))continue;seen.add(row.id);const tasks=Array.isArray(row.tasks)?row.tasks.filter(t=>typeof t==='string'):[];pages.push({id:row.id,name:String(row.name||row.id).slice(0,160),tasks,token:validToken(row.access_token)?appSecret?JSON.stringify({accessToken:row.access_token,appSecretProof:createHmac('sha256',appSecret).update(row.access_token).digest('hex')}):row.access_token:'',canPublish:validToken(row.access_token)&&(!tasks.length||tasks.some(t=>['CREATE_CONTENT','MANAGE','PROFILE_PLUS_CREATE_CONTENT','PROFILE_PLUS_FULL_CONTROL'].includes(t)))});}
  if(!value.paging?.next)return pages;const next=value.paging?.cursors?.after;if(typeof next!=='string'||!next||next.length>4096||next===after)throw Error('Meta trả phân trang không hợp lệ. Danh sách chưa được lưu.');after=next;
 }
 throw Error('Danh sách Page vượt 2.000 mục. Thu hẹp quyền Page rồi kết nối lại.');
}
class FacebookPages{
 constructor(publisher){this.publisher=publisher;this.pending=null;this.generation=0;}
 stage(pages){if(!Array.isArray(pages)||pages.length>2000||pages.some(p=>!/^\d{4,30}$/.test(p.id)||typeof p.name!=='string'||typeof p.token!=='string'||p.token.length>8192||typeof p.canPublish!=='boolean'))throw Error('Danh sách Page không hợp lệ.');this.clear();const id=require('node:crypto').randomUUID();this.pending={id,pages:pages.map(p=>({id:p.id,name:p.name.slice(0,160),token:p.token,canPublish:p.canPublish,availability:p.canPublish?'ready':p.token?'missing_permission':'missing_token',tasks:Array.isArray(p.tasks)?p.tasks.filter(t=>typeof t==='string'&&t.length<100).slice(0,20):[]})),expiresAt:Date.now()+10*60000};this.timer=setTimeout(()=>this.clear(),10*60000);this.timer.unref?.();return {id,pages:this.pending.pages.map(({id,name,canPublish,tasks,availability})=>({id,name,canPublish,tasks,availability}))};}
 async discover(token){this.clear();const generation=this.generation,controller=new AbortController();this.controller=controller;try{const pages=await discoverPages({fetch:this.publisher.fetch,token,signal:controller.signal});if(generation!==this.generation)throw new DOMException('Đã hủy lấy Page.','AbortError');return this.stage(pages);}finally{if(this.controller===controller)this.controller=null;}}
 clear(){this.generation++;this.controller?.abort();this.controller=null;clearTimeout(this.timer);this.pending=null;}
 async import({id,pageIds,brandId=''}){
  const pending=this.pending;if(!pending||pending.id!==id||Date.now()>pending.expiresAt)throw Error('Danh sách Page đã hết hạn. Lấy lại danh sách.');if(!Array.isArray(pageIds)||!pageIds.length||pageIds.length>2000||new Set(pageIds).size!==pageIds.length)throw Error('Chọn ít nhất một Page.');const selected=pageIds.map(id=>pending.pages.find(p=>p.id===id));if(selected.some(p=>!p||!p.canPublish))throw Error('Page đã chọn không còn trong danh sách hoặc thiếu quyền tạo nội dung.');
  // One encrypted registry write: a failed save never leaves half the chosen Pages connected.
  for(let offset=0;offset<selected.length;offset+=4)await Promise.all(selected.slice(offset,offset+4).map(async page=>{const actual=await this.publisher.graph('me?fields=id',page.token);if(actual.id!==page.id)throw Error('Token Page không khớp danh sách. Đăng nhập và lấy lại Page.');}));
  const result=await this.publisher.serial(async()=>{if(this.pending!==pending||Date.now()>pending.expiresAt)throw Error('Lượt kết nối đã được hủy hoặc hết hạn.');for(const page of selected){let c=this.publisher.connections.find(c=>(c.transport||'facebook')==='facebook'&&c.pageId===page.id);if(!c)this.publisher.connections.push(c={id:require('node:crypto').randomUUID(),pageId:page.id});Object.assign(c,{token:page.token,name:page.name,platform:'facebook',transport:'facebook',brandId,verifiedAt:new Date().toISOString()});}await this.publisher.persist();return this.publisher.list();});this.clear();return result;
 }
}
module.exports={discoverPages,FacebookPages,GRAPH};
