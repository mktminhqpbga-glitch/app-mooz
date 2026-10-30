/* Read-only remote reachability checks. Never send pairing/session credentials. */
(function(root){
 'use strict';
 const P=typeof module!=='undefined'?require('./chrome-remote-protocol.js'):root.WorkflowRemoteProtocol;
 const SERVICE='mooz-chrome-relay';
 async function check(endpoint,{fetchImpl=globalThis.fetch,expectedInstance,signal,timeoutMs=6000}={}){
  const url=new URL(P.endpoint(endpoint));url.protocol='https:';url.pathname+='/health';
  const nonce=globalThis.crypto.randomUUID().replace(/-/g,'');url.searchParams.set('probe',nonce);
  const result=(ok,code,message,status=null)=>({ok,code,message,status,checkedAt:Date.now()});
  try{
   const timeout=AbortSignal.timeout(timeoutMs);
   const response=await fetchImpl(url.href,{credentials:'omit',redirect:'error',cache:'no-store',signal:signal?AbortSignal.any([signal,timeout]):timeout});
   let text='',length=0;const reader=response.body?.getReader();
   try{if(reader)while(length<8192){const n=await reader.read();if(n.done)break;const part=n.value.subarray(0,8192-length);text+=new TextDecoder().decode(part);length+=part.length;}}finally{await reader?.cancel().catch(()=>{});}
   if(response.status===403||/your request was blocked/i.test(text))return result(false,'blocked','Máy này bị chặn truy cập đường Cloudflare. Cần quản trị mạng hoặc nhà cung cấp máy ảo kiểm tra quyền truy cập; tạo mã mới không xử lý được chặn mạng.',response.status);
   if(/(?:error\s*(?:code\s*)?[:=]?\s*|<[^>]*>)1033\b/i.test(text))return result(false,'tunnel_offline','Lỗi Cloudflare 1033: địa chỉ này không có tunnel đang kết nối. Đối chiếu địa chỉ hiện tại trong MooZ và kiểm tra cloudflared trên máy chạy app.',response.status);
   if([502,503,504].includes(response.status))return result(false,'origin_offline','Cloudflare chưa chuyển tiếp được tới bộ nối MooZ. Kiểm tra app, tunnel và cổng nội bộ trên máy chạy app.',response.status);
   if(response.status===426)return result(false,'legacy','Đã tới máy chủ WebSocket, nhưng chưa có kiểm tra danh tính đường truyền. Cập nhật MooZ 0.50.1 để chẩn đoán đầy đủ.',426);
   let body;try{body=JSON.parse(text);}catch{}
   if(response.status!==200||body?.service!==SERVICE||body.protocol!==1||body.probe!==nonce||!/^([a-f0-9]{8}-){1}[a-f0-9-]{27}$/.test(body.instance||''))return result(false,'wrong_service','Đường HTTPS chưa trả về bộ nối MooZ hợp lệ. Kiểm tra địa chỉ/cấu hình tunnel, trang đăng nhập hoặc lớp kiểm tra của mạng.',response.status);
   if(expectedInstance&&body.instance!==expectedInstance)return result(false,'wrong_instance','Tunnel đang tới một phiên MooZ khác. Chưa tạo mã; kiểm tra cổng đích và địa chỉ hiện tại trong app.',response.status);
   return result(true,'ready','Đã truy cập HTTPS và xác nhận bộ nối MooZ qua tunnel. Chrome vẫn cần kết nối WebSocket bằng mã ghép cặp.',200);
  }catch{
   return result(false,'unreachable','Máy này chưa truy cập được HTTPS của tunnel. Kiểm tra DNS, mạng, chứng chỉ và app đang mở; chưa thể kết luận riêng nguyên nhân từ lỗi này.');
  }
 }
 const api={check,SERVICE};if(typeof module!=='undefined')module.exports=api;else root.WorkflowRemoteDiagnostics=api;
})(globalThis);
