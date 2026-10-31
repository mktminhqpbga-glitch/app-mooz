/* Explicit, read-only product capture. Never reads cookies, storage or account forms. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WorkflowShopeeSource=api;})(globalThis,()=>{
 'use strict';
 function checked(value,kind='page'){
  let u;try{u=new URL(value);}catch{throw Error('Địa chỉ Shopee không hợp lệ.');}
  const hosts=kind==='image'?['susercontent.com','shopee.vn']:['shopee.vn','shp.ee'];
  if(u.protocol!=='https:'||u.username||u.password||u.port||!hosts.some(h=>u.hostname===h||u.hostname.endsWith('.'+h)))throw Error('Chỉ đọc trang Shopee Việt Nam và ảnh CDN Shopee qua HTTPS.');
  return u.href;
 }
 function productKey(value){const u=new URL(checked(value)),m=/(?:-i\.(\d+)\.(\d+)|\/product\/(\d+)\/(\d+))(?:\/|$)/.exec(u.pathname);return m?(m[1]||m[3])+':'+(m[2]||m[4]):null;}
 function capture(doc,url){
  checked(url);const key=productKey(url);
  if(!key)throw Error('Mở đúng trang sản phẩm trên Chrome. Nếu Shopee yêu cầu đăng nhập hoặc xác minh, hãy hoàn tất trên Chrome rồi bấm Lấy thông tin & ảnh.');
  const visible=e=>!!e&&!!e.getClientRects().length&&doc.defaultView.getComputedStyle(e).visibility!=='hidden';
  if([...doc.querySelectorAll('iframe[src*="captcha"], [id*="captcha"], [class*="captcha"], [role="dialog"]')].some(e=>visible(e)&&(/captcha|xác minh|verify|đăng nhập|log.?in/i.test((e.id||'')+' '+(typeof e.className==='string'?e.className:'')+' '+(e.innerText||'').slice(0,1000)))))throw Error('Shopee đang yêu cầu đăng nhập hoặc xác minh. Hoàn tất trên Chrome, đóng hộp thoại rồi lấy lại thông tin.');
  const clean=(s,n)=>typeof s==='string'?s.replace(/\s+/g,' ').trim().slice(0,n):'';
  const meta=name=>doc.querySelector('meta[property="'+name+'"]')?.content||'';
  const find=(x,d=0)=>{if(!x||typeof x!=='object'||d>10)return null;if([x['@type']].flat().includes('Product'))return x;for(const v of Object.values(x)){const p=find(v,d+1);if(p)return p;}return null;};
  let data={};for(const script of [...doc.querySelectorAll('script[type="application/ld+json"]')].slice(0,20)){if(script.textContent.length>300000)continue;try{const p=find(JSON.parse(script.textContent));if(p){data=p;break;}}catch{}}
  const heading=[...doc.querySelectorAll('h1,[data-sqe="name"]')].find(visible);
  const title=clean(heading?.innerText||data.name||meta('og:title'),180).replace(/\s*[|–-]\s*Shopee(?: Việt Nam)?\s*$/i,'');
  if(!title||/^(shopee|shopee việt nam)$/i.test(title)||/captcha|access denied|đăng nhập|verify.*human/i.test(title))throw Error('Chưa đọc được tên sản phẩm. Đợi trang tải xong, đăng nhập/xác minh trên Chrome rồi thử lại.');
  const descriptionNode=[...doc.querySelectorAll('[data-sqe="product-description"],.product-detail,[class*="product-description"]')].find(visible);
  const description=clean(descriptionNode?.innerText||data.description||meta('og:description'),5000);
  const candidates=[...[data.image||[]].flat().map(x=>typeof x==='string'?x:x?.url||x?.contentUrl),meta('og:image')];
  const scope=doc.querySelector('[data-sqe="product-image"],.product-briefing,main')||doc.querySelector('#main');
  if(scope)for(const img of scope.querySelectorAll('img'))if(visible(img)&&Math.max(img.naturalWidth,img.width)>=120&&Math.max(img.naturalHeight,img.height)>=120)candidates.push(img.currentSrc||img.src);
  const imageURLs=[];for(const raw of candidates){if(!raw)continue;try{const v=checked(new URL(raw,url).href,'image');if(!imageURLs.includes(v))imageURLs.push(v);}catch{}if(imageURLs.length===5)break;}
  if(!imageURLs.length)throw Error('Chưa tìm thấy ảnh sản phẩm. Đợi ảnh tải xong trên Chrome rồi lấy lại.');
  return {key,title,description,sourceURL:new URL(url).href,imageURLs,fetchedAt:new Date().toISOString()};
 }
 async function image(url,{fetchImpl=fetch}={}){
  let next=checked(url,'image');
  for(let redirect=0;redirect<6;redirect++){
   const r=await fetchImpl(next,{redirect:'manual',credentials:'omit',signal:AbortSignal.timeout(12000)});
   if(r.status>=300&&r.status<400){const to=r.headers.get('location');await r.body?.cancel();if(!to)throw Error('CDN ảnh thiếu địa chỉ chuyển hướng.');next=checked(new URL(to,next).href,'image');continue;}
   if(!r.ok){await r.body?.cancel();throw Error('CDN ảnh trả HTTP '+r.status+'.');}
   const type=(r.headers.get('content-type')||'').split(';')[0].toLowerCase();if(!['image/jpeg','image/png','image/webp','image/avif'].includes(type)){await r.body?.cancel();throw Error('CDN chưa trả tệp ảnh được hỗ trợ.');}
   const reader=r.body.getReader(),chunks=[];let count=0;
   try{while(true){const {done,value}=await reader.read();if(done)break;count+=value.byteLength;if(count>8*1024*1024)throw Error('Ảnh nguồn vượt 8 MB.');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
   const bytes=new Uint8Array(count);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}
   let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
   return {url,data:'data:'+type+';base64,'+btoa(binary),bytes:count};
  }
  throw Error('CDN ảnh chuyển hướng quá nhiều lần.');
 }
 return {checked,productKey,capture,image};
});
