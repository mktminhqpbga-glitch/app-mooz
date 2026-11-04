/* Reusable canvas graphs contain inputs and instructions, never live sessions or AI results. */
(function(root){
 'use strict';
 const FORMAT='mooz-canvas-preset',VERSION=1,MAX_BYTES=20*1024*1024;
 const INPUTS=new Set(['imageInput','videoInput','audioInput','imageEdit']);
 const PRIVATE_KEYS=new Set(['apikey','apikeys','workflowapikeys','accesstoken','refreshtoken','sessiontoken','relaykey','password','secret','credentials','authorization','auth','token','adminkey','invite','resume','cookie','cookies','chattarget','chattargets','aichattargets','workerid','requestedworkerid','tabassignment','workerpreferencesnapshot','dispatchtoken','dispatchprotocol','requestid','generationrequestid','generationid','agentrunid','agentstepid','agentattemptid','batchtaskid','flowcardid','endframe','lockedasset','error','progress','report','createdids','storyapprovedassetid','lastscenetext','lastscenemode','approved','approvedconfig','reviewstate','sourceassetid','sourcenodeid']);
 const BAD_KEYS=new Set(['__proto__','prototype','constructor']);
 const tokenKey=key=>String(key).replace(/[-_]/g,'').toLowerCase();
 const plain=value=>value&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
 const fail=message=>{throw Error(message);};
 function id(value,label='Mã node'){if(typeof value!=='string'||!value||value.length>180||/[\x00-\x1f]/.test(value))fail(label+' không hợp lệ.');return value;}
 function position(value,label){if(!Number.isFinite(value)||Math.abs(value)>1e8)fail(label+' không hợp lệ.');return value;}
 function mediaURL(value){
  if(typeof value!=='string'||!value)fail('Đường dẫn media trong mẫu không hợp lệ.');
  if(/^data:(?:image\/(?:png|jpeg|webp|gif|avif)|video\/(?:mp4|webm|quicktime)|audio\/(?:mpeg|mp3|wav|x-wav|ogg|webm|mp4|x-m4a));base64,[A-Za-z0-9+/]+={0,2}$/.test(value))return value;
  if(/^(?:blob:|idb:|museflow-media:|workflow:|file:)/i.test(value))fail('Nhúng tệp media vào mẫu trước khi lưu; không dùng đường dẫn tạm hoặc nội bộ.');
  let url;try{url=new URL(value);}catch{fail('Đường dẫn media trong mẫu không hợp lệ.');}
  const host=url.hostname.toLowerCase().replace(/^\[|\]$/g,'');
  if(url.protocol!=='https:'||url.username||url.password||url.hash||/^(?:localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host)||host==='::1'||/^f[cd][a-f\d]{2}:|^fe80:/i.test(host)||host.endsWith('.localhost')||host.endsWith('.local'))fail('Mẫu chỉ nhận media đã nhúng hoặc HTTPS công khai.');
  for(const key of url.searchParams.keys())if(/token|password|secret|authorization|signature|credential|(?:^|[-_])(?:key|sig|auth)(?:$|[-_])/i.test(key))fail('Nhúng media có đường dẫn ký/xác thực trước khi lưu mẫu.');
  return value;
 }
 function clean(value,key='',depth=0){
  if(depth>35)fail('Cấu trúc mẫu quá sâu.');
  if(value===null||typeof value==='boolean')return value;
  if(typeof value==='number'){if(!Number.isFinite(value))fail('Mẫu có số không hợp lệ.');return value;}
  if(typeof value==='string'){
   if(/^(?:url|src|localdataurl|dataurl|poster|thumbnail|thumbnailurl|logourl|sourceurl)$/i.test(key)&&value)return mediaURL(value);
   return value;
  }
  if(Array.isArray(value))return value.map(item=>clean(item,key,depth+1));
  if(!plain(value))fail('Mẫu chứa dữ liệu không được hỗ trợ.');
  const out={};for(const [name,item]of Object.entries(value)){if(BAD_KEYS.has(name)||PRIVATE_KEYS.has(tokenKey(name))||item===undefined)continue;out[name]=clean(item,name,depth+1);}return out;
 }
 function sanitize(raw,nodeDefs){
  if(!plain(raw)||!Array.isArray(raw.nodes)||!raw.nodes.length||raw.nodes.length>1000||!Array.isArray(raw.edges)||raw.edges.length>6000)fail('Mẫu cần từ 1 đến 1.000 node và tối đa 6.000 dây nối.');
  const ids=new Set(),nodes=raw.nodes.map(original=>{
   if(!plain(original)||!plain(original.data))fail('Node trong mẫu không hợp lệ.');
   const nodeId=id(original.id);if(ids.has(nodeId))fail('Mã node trong mẫu bị trùng.');ids.add(nodeId);
   if(typeof original.type!=='string'||!original.type||original.type.length>100||nodeDefs&&!Object.hasOwn(nodeDefs,original.type))fail('Loại node trong mẫu không được hỗ trợ.');
   const data={};for(const [key,value]of Object.entries(original.data)){if(key==='asset'&&!INPUTS.has(original.type)||key==='status'||PRIVATE_KEYS.has(tokenKey(key))||BAD_KEYS.has(key)||value===undefined)continue;data[key]=clean(value,key);}
   data.status='idle';if(original.type==='generateText')data.text='';
   return {id:nodeId,type:original.type,x:position(original.x,'Vị trí X'),y:position(original.y,'Vị trí Y'),data};
  });
  const edgeIds=new Set(),edges=raw.edges.map(original=>{
   if(!plain(original))fail('Dây nối trong mẫu không hợp lệ.');
   const edgeId=id(original.id,'Mã dây nối');if(edgeIds.has(edgeId))fail('Mã dây nối trong mẫu bị trùng.');edgeIds.add(edgeId);
   if(!ids.has(original.source)||!ids.has(original.target)||original.source===original.target)fail('Dây nối trong mẫu phải nối hai node thuộc mẫu.');
   id(original.sourcePort,'Cổng ra');id(original.targetPort,'Cổng vào');
   return clean(original);
  });
  const outgoing=new Map(nodes.map(n=>[n.id,[]])),degree=new Map(nodes.map(n=>[n.id,0]));for(const edge of edges){outgoing.get(edge.source).push(edge.target);degree.set(edge.target,degree.get(edge.target)+1);}
  const ready=[...degree].filter(([,n])=>!n).map(([nodeId])=>nodeId);let visited=0;while(ready.length){const current=ready.pop();visited++;for(const target of outgoing.get(current)){degree.set(target,degree.get(target)-1);if(degree.get(target)===0)ready.push(target);}}if(visited!==nodes.length)fail('Mẫu có vòng lặp dây nối.');
  const groups=[];if(raw.groups!==undefined){if(!Array.isArray(raw.groups)||raw.groups.length>1000)fail('Danh sách nhóm không hợp lệ.');const groupIds=new Set();for(const original of raw.groups){if(!plain(original)||!Array.isArray(original.nodeIds))fail('Nhóm trong mẫu không hợp lệ.');const groupId=id(original.id,'Mã nhóm');if(groupIds.has(groupId))fail('Mã nhóm trong mẫu bị trùng.');groupIds.add(groupId);const members=[...new Set(original.nodeIds.filter(nodeId=>ids.has(nodeId)))];if(!members.length)continue;const group=clean(original);group.nodeIds=members;for(const key of ['x','y','width','height'])position(group[key],'Kích thước nhóm');if(group.width<=0||group.height<=0)fail('Kích thước nhóm không hợp lệ.');groups.push(group);}}
  const result={format:FORMAT,version:VERSION,nodes,edges,groups};
  if(raw.notes!==undefined){if(!Array.isArray(raw.notes)||raw.notes.length>1000)fail('Danh sách ghi chú không hợp lệ.');result.notes=raw.notes.map(note=>{if(!plain(note))fail('Ghi chú không hợp lệ.');id(note.id,'Mã ghi chú');position(note.x,'Vị trí ghi chú');position(note.y,'Vị trí ghi chú');return clean(note);});}
  if(raw.name!==undefined){if(typeof raw.name!=='string'||!raw.name.trim()||raw.name.length>100)fail('Tên mẫu cần từ 1 đến 100 ký tự.');result.name=raw.name.trim();}
  const serialized=JSON.stringify(result),bytes=typeof TextEncoder==='function'?new TextEncoder().encode(serialized).length:serialized.length*2;if(bytes>MAX_BYTES)fail('Mẫu vượt 20 MB. Giảm tệp đầu vào hoặc lưu mẫu không kèm media.');return result;
 }
 function validate(raw,nodeDefs){if(!plain(raw)||raw.format!==FORMAT||raw.version!==VERSION)fail('Định dạng hoặc phiên bản mẫu không được hỗ trợ.');return sanitize(raw,nodeDefs);}
 const api=Object.freeze({FORMAT,VERSION,MAX_BYTES,sanitize,validate,mediaURL});if(typeof module!=='undefined')module.exports=api;else root.MooZCanvasPresets=api;
})(globalThis);
