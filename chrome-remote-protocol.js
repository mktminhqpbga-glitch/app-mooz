/* Pairing formats shared by desktop and companion; never lower remote transport to ws/http. */
(function(root){'use strict';
 const TOKEN=/^[a-f0-9]{64}$/;
 function endpoint(value){if(typeof value!=='string'||value.length>1500)throw Error('Địa chỉ kết nối từ xa không hợp lệ.');let u;try{u=new URL(value);}catch{throw Error('Nhập địa chỉ wss:// của máy chạy MooZ.');}if(u.protocol!=='wss:'||u.username||u.password||u.search||u.hash||!u.hostname||!u.pathname.endsWith('/remote')||/%|\\|\/\//.test(u.pathname)||u.href!==value)throw Error('Kết nối từ xa cần wss://, đường dẫn kết thúc /remote, không chứa tài khoản hay tham số.');return u.href;}
 function origin(value){const u=new URL(endpoint(value));return 'https://'+u.hostname+'/*';}
 function parseURI(value){if(typeof value!=='string'||value.length>4096)throw Error('Mã kết nối không hợp lệ.');let u;try{u=new URL(value);}catch{throw Error('Mã kết nối không hợp lệ. Sao chép lại từ MooZ.');}
  if(u.protocol!=='workflow-connect:'||u.username||u.password||u.hash)throw Error('Mã kết nối không hợp lệ.');
  if(u.hostname==='127.0.0.1'&&/^\d+$/.test(u.port)&&Number(u.port)>0&&Number(u.port)<=65535&&!u.search&&/^\/[a-f0-9]{64}$/.test(u.pathname))return {port:Number(u.port),token:u.pathname.slice(1)};
  const keys=[...u.searchParams.keys()];if(u.hostname!=='remote'||u.port||u.pathname&&u.pathname!=='/'||keys.length!==3||new Set(keys).size!==3||keys.some(k=>!['endpoint','token','expires'].includes(k))||!TOKEN.test(u.searchParams.get('token')||''))throw Error('Mã kết nối không hợp lệ. Cần Workflow Connect 1.2.0 để kết nối từ xa.');
  const expiresAt=Number(u.searchParams.get('expires'));if(!Number.isSafeInteger(expiresAt)||expiresAt<=Date.now()||expiresAt>Date.now()+15*60*1000)throw Error('Mã từ xa đã hết hạn. Tạo mã mới trong MooZ.');return {mode:'remote',endpoint:endpoint(u.searchParams.get('endpoint')),token:u.searchParams.get('token'),expiresAt};
 }
 function saved(v){if(!v||typeof v!=='object'||!TOKEN.test(v.token||''))throw Error('Phiên kết nối không hợp lệ.');if(v.mode==='remote')return {mode:'remote',endpoint:endpoint(v.endpoint),token:v.token,expiresAt:v.expiresAt??null};if(!Number.isInteger(v.port)||v.port<1||v.port>65535)throw Error('Cổng kết nối không hợp lệ.');return {port:v.port,token:v.token};}
 function pairing(value,token,expiresAt){const u=new URL('workflow-connect://remote');u.searchParams.set('endpoint',endpoint(value));if(!TOKEN.test(token))throw Error('Thiếu khóa ghép cặp.');u.searchParams.set('token',token);u.searchParams.set('expires',String(expiresAt));return u.href;}
 const api={endpoint,origin,parseURI,saved,pairing};if(typeof module!=='undefined')module.exports=api;else root.WorkflowRemoteProtocol=api;
})(globalThis);
