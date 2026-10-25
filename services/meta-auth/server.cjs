'use strict';
// Deploy behind an HTTPS reverse proxy. Secrets and OAuth codes never enter the renderer.
const http=require('node:http');
const {randomBytes,createHash,timingSafeEqual}=require('node:crypto');
const {discoverPages}=require('../../desktop/facebook-pages.cjs');
const {request,json,problem,MESSAGES,META_MESSAGES}=require('../../desktop/posting-http.cjs');
function same(a,b){return typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));}
function createBroker({appId,appSecret,publicURL,fetch=globalThis.fetch,allowLocal=false,ttl=10*60000,maxSessions=200,configId=''}){
 const origin=new URL(publicURL);if(!/^\d{4,30}$/.test(appId||'')||typeof appSecret!=='string'||appSecret.length<16||origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/'||origin.protocol!=='https:'&&!(allowLocal&&origin.hostname==='127.0.0.1'&&origin.protocol==='http:'))throw Error('Set META_APP_ID, META_APP_SECRET and HTTPS META_PUBLIC_URL (origin only).');
 if(configId&&!/^\d{4,30}$/.test(configId))throw Error('META_CONFIG_ID must be a Meta login configuration ID.');
 const sessions=new Map(),rates=new Map(),redirect=origin.origin+'/oauth/callback';
 const clean=()=>{for(const [id,s]of sessions)if(s.expiresAt<=Date.now())sessions.delete(id);for(const [ip,r]of rates)if(r.until<=Date.now())rates.delete(ip);};
 const timer=setInterval(clean,30000);timer.unref();
 const send=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",'Referrer-Policy':'no-referrer'});res.end(JSON.stringify(value));};
 async function body(req){let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>8192)throw Error('Request too large');}return JSON.parse(text||'{}');}
 const server=http.createServer(async(req,res)=>{try{
  clean();const url=new URL(req.url,origin);
  if(req.method==='GET'&&url.pathname==='/health')return send(res,200,{ok:true,protocol:'workflow-meta-oauth-v1'});
  if(req.method==='POST'&&url.pathname==='/sessions'){
   if(req.headers.origin)return send(res,403,{error:'Browser session creation is not supported.'});
   const ip=req.socket.remoteAddress||'unknown',r=rates.get(ip)||{count:0,until:Date.now()+60000};if(++r.count>20||sessions.size>=maxSessions)return send(res,429,{error:'Too many requests. Try again later.'});rates.set(ip,r);
   const input=await body(req);if(!/^[A-Za-z0-9_-]{43}$/.test(input.challenge||''))return send(res,400,{error:'Invalid challenge.'});
   const id=randomBytes(32).toString('base64url'),ticket=randomBytes(32).toString('base64url'),state=randomBytes(32).toString('base64url');sessions.set(id,{id,ticket,state,challenge:input.challenge,expiresAt:Date.now()+ttl,status:'waiting'});
   const auth=new URL('https://www.facebook.com/v24.0/dialog/oauth');for(const [key,value]of Object.entries({client_id:appId,redirect_uri:redirect,state,response_type:'code',...(configId?{config_id:configId,override_default_response_type:'true'}:{scope:'pages_show_list,pages_read_engagement,pages_manage_posts',auth_type:'rerequest'})}))auth.searchParams.set(key,value);
   return send(res,200,{id,ticket,authURL:auth.href,expiresIn:Math.floor(ttl/1000)});
  }
  if(req.method==='GET'&&url.pathname==='/oauth/callback'){
   const state=url.searchParams.get('state')||'',s=[...sessions.values()].find(s=>same(s.state,state)&&s.status==='waiting');if(!s)return send(res,400,{error:'Session invalid or expired.'});s.status='exchanging';
   try{
    const code=url.searchParams.get('code');if(url.searchParams.has('error')||!code||code.length>4096)throw problem('CONSENT_DENIED','Consent declined.');
    const tokens=await json(await request(fetch,'https://graph.facebook.com/v24.0/oauth/access_token',{method:'POST',body:new URLSearchParams({client_id:appId,client_secret:appSecret,redirect_uri:redirect,code})}),'Meta');
    const longLived=await json(await request(fetch,'https://graph.facebook.com/v24.0/oauth/access_token',{method:'POST',body:new URLSearchParams({grant_type:'fb_exchange_token',client_id:appId,client_secret:appSecret,fb_exchange_token:tokens.access_token})}),'Meta');
    s.pages=await discoverPages({fetch,token:longLived.access_token,appSecret});s.status='ready';
   }catch(error){s.status='error';s.errorCode=error.code==='CONSENT_DENIED'||Object.hasOwn(MESSAGES,error.code)||Object.hasOwn(META_MESSAGES,error.code)?error.code:'META_SETUP_ERROR';s.metaCode=Number.isSafeInteger(error.metaCode)?error.metaCode:null;s.metaSubcode=Number.isSafeInteger(error.metaSubcode)?error.metaSubcode:null;s.error='Meta chưa cấp đủ quyền hoặc không đọc được Page. Kiểm tra cấu hình ứng dụng, vai trò và đăng nhập lại.';}
   res.writeHead(200,{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",'Referrer-Policy':'no-referrer'});res.end('<!doctype html><meta charset="utf-8"><title>Workflow</title><p>Quay lại Workflow để xem kết quả kết nối. Bạn có thể đóng tab này.</p>');return;
  }
  if(req.method==='POST'&&url.pathname==='/sessions/poll'){
   if(req.headers.origin)return send(res,403,{error:'Native client required.'});const input=await body(req),s=sessions.get(input.id),auth=req.headers.authorization?.replace(/^Bearer /,'');if(!s||!same(auth,s.ticket)||!/^[A-Za-z0-9_-]{43,128}$/.test(input.verifier||'')||!same(createHash('sha256').update(input.verifier).digest('base64url'),s.challenge))return send(res,403,{error:'Session invalid or expired.'});
   if(s.status==='ready'){sessions.delete(s.id);return send(res,200,{status:'ready',pages:s.pages});}if(s.status==='error'){sessions.delete(s.id);return send(res,200,{status:'error',error:s.error,errorCode:s.errorCode,metaCode:s.metaCode,metaSubcode:s.metaSubcode});}return send(res,200,{status:'waiting'});
  }
  send(res,404,{error:'Not found.'});
 }catch{if(!res.headersSent)send(res,400,{error:'Request invalid or provider unavailable.'});else res.end();}});
 server.requestTimeout=15000;server.headersTimeout=10000;server.keepAliveTimeout=5000;server.on('close',()=>{clearInterval(timer);sessions.clear();rates.clear();});return server;
}
if(require.main===module){const server=createBroker({appId:process.env.META_APP_ID,appSecret:process.env.META_APP_SECRET,publicURL:process.env.META_PUBLIC_URL,configId:process.env.META_CONFIG_ID||''});server.listen(Number(process.env.PORT||8080),'0.0.0.0',()=>process.stdout.write('Workflow Meta OAuth broker ready\n'));}
module.exports={createBroker};
