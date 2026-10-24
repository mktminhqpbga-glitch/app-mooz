'use strict';

const http=require('node:http');
const {randomBytes,createHash,timingSafeEqual}=require('node:crypto');
const {request,json,problem}=require('./posting-http.cjs');
const GOOGLE_AUTH='https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN='https://oauth2.googleapis.com/token';
const GOOGLE_SCOPES=['https://www.googleapis.com/auth/youtube.upload','https://www.googleapis.com/auth/youtube.readonly'];

function clientConfig(input){
 let value=input;if(typeof value==='string'){if(value.length>20000)throw Error('Tệp cấu hình OAuth quá lớn.');try{value=JSON.parse(value);}catch{throw Error('Dán nội dung JSON OAuth của ứng dụng Desktop từ Google Cloud.');}}
 const client=value?.installed;
 if(!client||typeof client.client_id!=='string'||!/^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(client.client_id)||typeof client.client_secret!=='string'||!client.client_secret||client.client_secret.length>512)throw Error('Cần cấu hình OAuth loại Desktop app, gồm client_id và client_secret.');
 return {clientId:client.client_id,clientSecret:client.client_secret};
}

class PostingOAuth{
 constructor({fetch,openExternal}){Object.assign(this,{fetch,openExternal});this.sessions=new Set();}
 async google(input,{signal,timeout=180000}={}){
  if(this.sessions.size)throw Error('Đang kết nối YouTube. Hoàn tất hoặc hủy lượt trước.');
  const client=clientConfig(input),state=randomBytes(32).toString('base64url'),verifier=randomBytes(48).toString('base64url'),challenge=createHash('sha256').update(verifier).digest('base64url');
  let complete,rejectCode,timer,used=false;
  const codePromise=new Promise((resolve,reject)=>{complete=resolve;rejectCode=reject;});
  // Register a rejection handler before opening the browser so cancellations cannot become unhandled.
  void codePromise.catch(()=>{});
  const server=http.createServer((req,res)=>{
   const no=()=>{res.writeHead(400,{'Content-Type':'text/plain;charset=utf-8','Cache-Control':'no-store'});res.end('Yêu cầu xác thực không hợp lệ.');};
   let url;try{url=new URL(req.url,'http://127.0.0.1');}catch{return no();}
   const actual=url.searchParams.get('state')||'';
   if(req.method!=='GET'||url.pathname!=='/oauth/callback'||Buffer.byteLength(actual)!==Buffer.byteLength(state)||!timingSafeEqual(Buffer.from(actual),Buffer.from(state))||used)return no();
   used=true;res.writeHead(200,{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",'Referrer-Policy':'no-referrer'});
   res.end('<!doctype html><meta charset="utf-8"><title>Workflow</title><p>Bạn có thể đóng tab này và quay lại Workflow.</p>');
   if(url.searchParams.has('error'))rejectCode(problem('PERMISSION_DENIED','Bạn đã hủy hoặc chưa cấp đủ quyền YouTube.'));
   else{const code=url.searchParams.get('code');if(!code||code.length>4096)rejectCode(problem('INVALID_RESPONSE'));else complete(code);}
  });
  const controller=new AbortController(),transportSignal=signal?AbortSignal.any([signal,controller.signal]):controller.signal;
  const cancel=()=>{controller.abort();rejectCode(new DOMException('Đã hủy kết nối.','AbortError'));};
  this.sessions.add(cancel);signal?.addEventListener('abort',cancel,{once:true});
  try{
   await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
   const redirectURI='http://127.0.0.1:'+server.address().port+'/oauth/callback';
   const auth=new URL(GOOGLE_AUTH);for(const [key,value]of Object.entries({client_id:client.clientId,redirect_uri:redirectURI,response_type:'code',scope:GOOGLE_SCOPES.join(' '),state,code_challenge:challenge,code_challenge_method:'S256',access_type:'offline',prompt:'consent'}))auth.searchParams.set(key,value);
   timer=setTimeout(()=>rejectCode(Error('Hết thời gian kết nối YouTube. Bấm kết nối lại khi sẵn sàng.')),timeout);
   if(signal?.aborted)cancel();else await this.openExternal(auth.href);
   const code=await codePromise;
   const response=await request(this.fetch,GOOGLE_TOKEN,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:client.clientId,client_secret:client.clientSecret,code,code_verifier:verifier,redirect_uri:redirectURI,grant_type:'authorization_code'}).toString(),signal:transportSignal});
   const tokens=await json(response,'Google');if(typeof tokens.access_token!=='string'||!tokens.access_token||!tokens.refresh_token)throw Error('Google chưa cấp token làm mới. Thu hồi quyền cũ rồi kết nối lại với đầy đủ quyền YouTube.');
   const scopes=new Set(String(tokens.scope||'').split(' '));if(tokens.scope&&GOOGLE_SCOPES.some(scope=>!scopes.has(scope)))throw Error('Google chưa cấp đủ quyền tải video và đọc kênh YouTube. Kết nối lại và chọn đủ các quyền.');
   return {...client,accessToken:tokens.access_token,refreshToken:tokens.refresh_token,expiresAt:Date.now()+Number(tokens.expires_in||3600)*1000};
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);this.sessions.delete(cancel);server.closeAllConnections();if(server.listening)await new Promise(resolve=>server.close(resolve));}
 }
 cancel(){for(const cancel of this.sessions)cancel();}
}

module.exports={PostingOAuth,clientConfig,GOOGLE_AUTH,GOOGLE_TOKEN,GOOGLE_SCOPES};
