'use strict';
// Independent authenticated transports; tab IDs exposed to the app never collide.
const fs=require('node:fs/promises'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {ChromeRelay}=require('./chrome-relay.cjs'),{OutboundRelay}=require('./outbound-relay.cjs'),P=require('../chrome-remote-protocol.js');
const BASE=2**40,MAX_DEVICES=8;
const label=value=>{if(typeof value!=='string'||!value.trim()||value.trim().length>60||/[\x00-\x1f\x7f]/.test(value))throw Error('Tên Chrome cần từ 1 đến 60 ký tự.');return value.trim();};
class ChromeDevices{
 constructor({primary,remote,root,notify=()=>{}}){
  Object.assign(this,{primary,remote,notify});this.file=path.join(root,'chrome-devices.json');this.devices=new Map();this.routes=new Map();this.nextSlot=1;this.busy=false;this.writes=Promise.resolve();this.warning='';
  this.register({id:'primary',name:'Chrome chính',kind:'primary',relay:primary});
  // Existing local/tunnel pairing continues to target the primary transport.
  for(const key of ['port','token','client','instanceId','pending','remoteEndpoint','remoteLease','remoteSession','connectionMode','remoteIngressPort','extensionId','appVersion','server','remoteServer'])Object.defineProperty(this,key,{get:()=>primary[key]});
 }
 register(device){
  device.tabs=new Map();device.lastSeen=null;this.devices.set(device.id,device);
  const relay=device.relay;if(!relay)return device;
  relay.tabKey=id=>'chrome:'+this.virtualId(device,id);
  relay.ownsTabKey=key=>{const id=Number(key.slice(7));return device.id==='primary'?Number.isSafeInteger(id)&&id<BASE:this.routes.get(id)?.deviceId===device.id;};
  relay.dispatch=this._dispatch;
  relay.notify=event=>{
   if(event.type==='relay'){if(event.connected)device.lastSeen=Date.now();this.changed();return;}
   const next={...event,deviceId:device.id,deviceName:device.name};
   if(event.tab)next.tab=this.publicTab(device,event.tab);
   if(Number.isInteger(event.tabId))next.tabId=this.virtualId(device,event.tabId);
   this.notify(next);
  };
  return device;
 }
 async init(){
  try{const data=JSON.parse(await fs.readFile(this.file,'utf8'));if(data.version!==1||!Array.isArray(data.devices)||data.devices.length>=MAX_DEVICES)throw Error('invalid');
   const seen=new Set(['primary']),items=data.devices.map(d=>{if(!/^[a-f0-9-]{36}$/.test(d.id)||seen.has(d.id)||!['local','relay'].includes(d.kind)||!Number.isInteger(d.slot)||d.slot<1||d.slot>1000000||data.devices.some(v=>v!==d&&v.slot===d.slot))throw Error('invalid');seen.add(d.id);return {id:d.id,name:label(d.name),kind:d.kind,slot:d.slot,relay:null};});
   if(!Number.isInteger(data.nextSlot)||data.nextSlot<1||data.nextSlot>1000001||items.some(d=>d.slot>=data.nextSlot))throw Error('invalid');this.nextSlot=data.nextSlot;this.devices.get('primary').name=label(data.primaryName);for(const d of items)this.register(d);
  }catch(e){if(e.code!=='ENOENT')this.warning='Không đọc được danh sách Chrome đã lưu. Kết nối chính vẫn dùng được; sao lưu chrome-devices.json trước khi chỉnh lại.';}
  return this.status();
 }
 set dispatch(value){this._dispatch=value;for(const d of this.devices.values())if(d.relay)d.relay.dispatch=value;}
 get dispatch(){return this._dispatch;}
 get isConnected(){return [...this.devices.values()].some(d=>d.relay?.isConnected);}
 get companion(){const list=[...this.devices.values()].filter(d=>d.relay?.isConnected).map(d=>d.relay.companion);return list.sort((a,b)=>(a?.version||'0').localeCompare(b?.version||'0',undefined,{numeric:true}))[0]||null;}
 status(){return {...this.primary.status(),connected:this.isConnected,companion:this.companion,deviceCount:[...this.devices.values()].filter(d=>d.relay?.isConnected).length,devices:[...this.devices.values()].map(d=>({id:d.id,name:d.name,kind:d.kind,connected:!!d.relay?.isConnected,recovering:!!d.relay?.recovery,mode:d.relay?.connectionMode||d.kind,version:d.relay?.companion?.version||null,lastSeen:d.lastSeen,error:d.broker?.error||'',waiting:!!(d.broker?.room||d.relay?.token)&&!d.relay?.isConnected})),warning:this.warning};}
 changed(){try{this.notify({type:'relay',...this.status()});}catch{}}
 async save(){if(this.warning)throw Error(this.warning);const value={version:1,nextSlot:this.nextSlot,primaryName:this.devices.get('primary').name,devices:[...this.devices.values()].filter(d=>d.id!=='primary').map(({id,name,kind,slot})=>({id,name,kind,slot}))};
  const write=this.writes.catch(()=>{}).then(async()=>{await fs.mkdir(path.dirname(this.file),{recursive:true});const tmp=this.file+'.'+randomUUID()+'.tmp';try{await fs.writeFile(tmp,JSON.stringify(value),{mode:0o600});await fs.rename(tmp,this.file);}finally{await fs.rm(tmp,{force:true});}});this.writes=write;await write;
 }
 async locked(fn){if(this.busy)throw Error('Đang xử lý thiết bị Chrome.');this.busy=true;try{return await fn();}finally{this.busy=false;this.changed();}}
 device(id){const d=this.devices.get(id);if(!d)throw Error('Không tìm thấy thiết bị Chrome.');return d;}
 virtualId(d,id){if(!Number.isInteger(id)||id<0||id>=2**32)throw Error('ID tab Chrome không hợp lệ.');if(d.id==='primary')return id;if(!d.tabs.has(id)){const virtual=BASE+d.slot*2**32+id;d.tabs.set(id,virtual);this.routes.set(virtual,{deviceId:d.id,id});}return d.tabs.get(id);}
 publicTab(d,tab){if(!tab||!Number.isInteger(tab.id))throw Error('Chrome trả tab không hợp lệ.');return {...tab,id:this.virtualId(d,tab.id),deviceId:d.id,deviceName:d.name,title:(tab.title||'Tab AI')+' · '+d.name};}
 route(id){if(!Number.isSafeInteger(id)||id<0)throw Error('ID tab Chrome không hợp lệ.');const r=id<BASE?{deviceId:'primary',id}:this.routes.get(id);if(!r)throw Error('Tab không thuộc phiên Chrome này. Cập nhật danh sách tab.');const d=this.devices.get(r.deviceId);if(!d?.relay?.isConnected&&!d?.relay?.recovery)throw Error('Chrome của tab này đã ngắt kết nối. Kiểm tra tác vụ trước khi chạy lại; không tự gửi sang máy khác.');return {d,id:r.id};}
 async operate(raw,operation,payload={}){
  if(['tabs.query','shopee.tabs'].includes(operation)){
   const devices=[...this.devices.values()].filter(d=>d.relay?.isConnected&&(!payload.deviceId||d.id===payload.deviceId));
   if(!devices.length)throw Error('Chưa kết nối tiện ích Workflow trong Chrome.');
   // A failed device is surfaced, rather than presenting its tabs as ready.
   const results=await Promise.all(devices.map(async d=>(await d.relay[raw?'rawRequest':'request'](operation,payload)).map(t=>this.publicTab(d,t))));return results.flat();
  }
  let d,id;
  if(operation==='shopee.open'){d=payload.deviceId?this.device(payload.deviceId):this.primary.isConnected?this.device('primary'):null;if(!d){const online=[...this.devices.values()].filter(v=>v.relay?.isConnected);if(online.length!==1)throw Error('Chọn Chrome để mở Shopee.');d=online[0];}}
  else({d,id}=this.route(payload.id));
  const result=await d.relay[raw?'rawRequest':'request'](operation,{...payload,...(id===undefined?{}:{id})});
  return ['tabs.get','tabs.focus','shopee.open'].includes(operation)?this.publicTab(d,result):result;
 }
 request(op,payload){return this.operate(false,op,payload);}
 rawRequest(op,payload){return this.operate(true,op,payload);}
 pairingURI(){return this.primary.pairingURI();}
 revokeLocal(){return this.primary.revokeLocal();}
 revokeRemote(){return this.primary.revokeRemote();}
 disconnect(){return this.primary.disconnect();}
 async prepare(d){if(d.relay)return;const relay=new ChromeRelay({version:this.primary.appVersion});d.relay=relay;this.register(d);try{await relay.start();}catch(e){d.relay=null;throw e;}}
 async pairDevice(d,{endpoint,key}={}){
  if(d.id==='primary')throw Error('Dùng mã kết nối chính trong Cài đặt để ghép Chrome chính.');
  if(d.relay?.recovery)throw Error('Chrome đang nối lại phiên; thu hồi phiên trước khi tạo mã khác.');
  if(d.relay?.isConnected)throw Error('Chrome này đã kết nối. Thêm thiết bị mới để giữ nguyên phiên đang chạy.');
  d.lastPair=null;
  await this.prepare(d);
  if(d.kind==='local'){d.relay.revokeLocal();return d.lastPair={deviceId:d.id,url:d.relay.pairingURI(),expiresAt:null};}
  const source=this.remote.broker,other=[...this.devices.values()].find(v=>v.broker?.adminKey)?.broker;
  const address=P.relayAddress(endpoint||d.broker?.endpoint||source.endpoint||other?.endpoint||this.remote.config.endpoint);
  const credential=key||d.broker?.adminKey||source.adminKey||other?.adminKey;
  if(!credential)throw Error('Nhập khóa relay để ghép thêm Chrome. Khóa chỉ giữ trong phiên app.');
  if(!d.broker)d.broker=new OutboundRelay({relay:d.relay,fetchImpl:this.remote.fetchImpl,socketOptions:source.socketOptions,notify:()=>{d.relay.configureRemote(d.broker.ready?d.broker.endpoint:null);this.changed();}});
  await d.relay.startRemoteIngress();
  if(!d.broker.ready||d.broker.endpoint!==P.relayEndpoint(address))await d.broker.start(address,credential);
  d.relay.configureRemote(address);d.relay.revokeRemote();const room=await d.broker.newRoom(),pair=d.relay.remotePairingURI(),expiresAt=Math.min(room.expiresAt,pair.expiresAt);
  return d.lastPair={deviceId:d.id,url:P.relayPairing(address,{...room,token:d.relay.remoteLease.token,expiresAt}),expiresAt};
 }
 add(data){return this.locked(async()=>{if(this.warning)throw Error(this.warning);if(this.devices.size>=MAX_DEVICES)throw Error('Tối đa 8 Chrome. Relay mặc định hỗ trợ 4 Chrome từ xa cùng lúc.');if(!['local','relay'].includes(data.kind))throw Error('Chọn kết nối cùng máy hoặc relay.');const d=this.register({id:randomUUID(),name:label(data.name),kind:data.kind,slot:this.nextSlot++,relay:null});try{await this.save();return await this.pairDevice(d,data);}catch(e){this.devices.delete(d.id);await d.broker?.stop();await d.relay?.close();await this.save();throw e;}});}
 pair(id,data={}){return this.locked(()=>this.pairDevice(this.device(id),data));}
 pairCode(id){const d=this.device(id),p=d.lastPair;if(!p||d.relay?.isConnected||d.relay?.recovery||p.expiresAt&&p.expiresAt<=Date.now())throw Error('Mã đã dùng, hết hạn hoặc bị thu hồi. Tạo mã mới cho thiết bị chưa kết nối.');return p.url;}
 rename(id,name){return this.locked(async()=>{const d=this.device(id),old=d.name;d.name=label(name);try{await this.save();}catch(e){d.name=old;throw e;}return this.status();});}
 revoke(id){return this.locked(async()=>{const d=this.device(id);d.lastPair=null;if(id==='primary'){d.relay.revokeLocal();this.remote.revoke();}else{d.relay?.revokeLocal();d.relay?.revokeRemote();await d.broker?.stop();}return this.status();});}
 remove(id){return this.locked(async()=>{if(id==='primary')throw Error('Chrome chính có thể đổi tên hoặc thu hồi.');const d=this.device(id);await d.broker?.stop();await d.relay?.close();this.devices.delete(id);try{await this.save();}catch(e){this.devices.set(id,d);throw e;}return this.status();});}
 async close(){for(const d of this.devices.values()){await d.broker?.stop();await d.relay?.close();}await this.writes.catch(()=>{});}
}
module.exports={ChromeDevices,MAX_DEVICES};
