'use strict';
const {randomBytes,timingSafeEqual,randomUUID}=require('node:crypto');
const {WebSocketServer,WebSocket}=require('ws');
const MAX_BYTES=128*1024*1024;
const OPERATIONS=new Set(['tabs.query','tabs.get','tabs.focus','tabs.script','tabs.message']);
const EXTENSION_ORIGIN=/^chrome-extension:\/\/([a-p]{32})$/;

class ChromeRelay {
 constructor(options={}) {
  this.notify=typeof options==='function'?options:options.notify||(()=>{});
  this.server=null;this.client=null;this.extensionId=null;this.port=null;this.token=null;this.pending=new Map();
 }
 get isConnected(){return this.client?.readyState===WebSocket.OPEN;}
 status(){return {connected:!!this.isConnected,port:this.port,extensionId:this.extensionId};}
 async start(){
  if(this.server)return this.status();
  this.token=randomBytes(32).toString('hex');
  const server=new WebSocketServer({host:'127.0.0.1',port:0,maxPayload:MAX_BYTES,perMessageDeflate:false,verifyClient:({origin,req})=>EXTENSION_ORIGIN.test(origin||'')&&req.url==='/'});
  this.server=server;
  server.on('connection',(socket,request)=>this.accept(socket,request));
  await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
  this.port=server.address().port;return this.status();
 }
 pairingURI(){if(!this.port||!this.token)throw Error('Kết nối Chrome chưa được khởi tạo.');return `workflow-connect://127.0.0.1:${this.port}/${this.token}`;}
 changed(){try{this.notify({type:'relay',...this.status()});}catch{}}
 send(socket,value){
  const text=JSON.stringify(value);
  if(Buffer.byteLength(text)>MAX_BYTES||socket.bufferedAmount+Buffer.byteLength(text)>MAX_BYTES){socket.terminate();throw Error('Dữ liệu kết nối Chrome vượt giới hạn 128 MB.');}
  socket.send(text);
 }
 accept(socket,request){
  let authenticated=false;
  const authTimer=setTimeout(()=>socket.close(1008,'Authentication required'),5000);authTimer.unref?.();
  socket.on('error',()=>{});
  socket.on('close',()=>{clearTimeout(authTimer);if(this.client===socket)this.clearClient();});
  socket.on('message',bytes=>{
   let message;try{message=JSON.parse(bytes.toString());}catch{socket.close(1008,'Invalid message');return;}
   if(!message||typeof message!=='object'||Array.isArray(message)){socket.close(1008,'Invalid message');return;}
   if(!authenticated){
    const supplied=typeof message.token==='string'&&/^[a-f0-9]{64}$/.test(message.token)?Buffer.from(message.token,'hex'):null;
    if(message.type!=='auth'||!supplied||!this.token||!timingSafeEqual(supplied,Buffer.from(this.token,'hex'))){socket.close(1008,'Authentication failed');return;}
    if(this.isConnected){socket.close(1013,'Already connected');return;}
    authenticated=true;clearTimeout(authTimer);this.client=socket;this.extensionId=EXTENSION_ORIGIN.exec(request.headers.origin)[1];
    this.send(socket,{type:'ready'});this.changed();return;
   }
   if(socket!==this.client)return;
   if(message.type==='ping'){try{this.send(socket,{type:'pong'});}catch{}return;}
   if(message.type==='response'&&typeof message.id==='string'){
    const item=this.pending.get(message.id);if(!item)return;clearTimeout(item.timer);this.pending.delete(message.id);
    if(typeof message.error==='string')item.reject(Error(message.error));else item.resolve(message.result);
   }else if(message.type==='notification'){
    const event=message.event;
    if(!event||!['message','created','updated','removed'].includes(event.type))return;
    if(event.type==='message'&&(event.message?.type!=='WORKFLOW_AI_PROGRESS'||typeof event.message.requestId!=='string'||typeof event.message.text!=='string'||!Number.isInteger(event.tabId)))return;
    try{this.notify(event);}catch{}
   }
  });
 }
 clearClient(){
  this.client=null;this.extensionId=null;
  for(const item of this.pending.values()){clearTimeout(item.timer);item.reject(Error('Chrome đã ngắt kết nối. Kiểm tra tab AI trước khi chạy lại; không tự gửi lại yêu cầu.'));}
  this.pending.clear();this.changed();
 }
 request(operation,payload={}){
  if(!OPERATIONS.has(operation))return Promise.reject(Error('Thao tác Chrome không được phép.'));
  if(!this.isConnected)return Promise.reject(Error('Chưa kết nối tiện ích Workflow trong Chrome.'));
  if(this.pending.size>=64)return Promise.reject(Error('Có quá nhiều yêu cầu Chrome đang chờ.'));
  const id=randomUUID(),timeout=operation==='tabs.message'&&/GENERATE/.test(payload?.message?.type||'')?11*60*1000:30000;
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('Chrome chưa trả kết quả trong thời gian cho phép. Kiểm tra tab AI trước khi chạy lại.'));},timeout);timer.unref?.();
   this.pending.set(id,{resolve,reject,timer});
   try{this.send(this.client,{type:'request',id,operation,payload});}catch(error){clearTimeout(timer);this.pending.delete(id);reject(error);}
  });
 }
 disconnect(){if(this.client){const socket=this.client;this.clearClient();socket.close(1000,'Disconnected');}}
 async close(){
  this.disconnect();const server=this.server;this.server=null;this.token=null;this.port=null;
  if(server){for(const socket of server.clients)socket.terminate();await new Promise(resolve=>server.close(resolve));}
 }
}
module.exports={ChromeRelay};
