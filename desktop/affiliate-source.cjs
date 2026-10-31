'use strict';
const {createHash}=require('node:crypto');
const PRODUCT_HOSTS=['shopee.vn','shp.ee'],IMAGE_HOSTS=['susercontent.com','shopee.vn'];
function checkedURL(value,kind='product'){
 let url;try{url=new URL(value);}catch{throw Error('Link không hợp lệ.');}
 const hosts=kind==='image'?IMAGE_HOSTS:PRODUCT_HOSTS;
 if(url.protocol!=='https:'||url.username||url.password||url.port||!hosts.some(host=>url.hostname===host||url.hostname.endsWith('.'+host)))throw Error(kind==='image'?'Ảnh phải thuộc CDN Shopee được hỗ trợ.':'Dán link HTTPS của Shopee Việt Nam hoặc shp.ee.');
 return url.href;
}
async function download(url,{kind='product',fetchImpl=fetch,signal}={}){
 let next=checkedURL(url,kind);const limit=kind==='image'?8*1024*1024:6*1024*1024;
 for(let i=0;i<6;i++){
  let response;try{response=await fetchImpl(next,{redirect:'manual',credentials:'omit',headers:{'Accept-Language':'vi-VN,vi;q=0.9'},signal:AbortSignal.any([signal||new AbortController().signal,AbortSignal.timeout(25000)])});}
  catch(error){if(signal?.aborted)throw error;throw Error(error.name==='TimeoutError'?'Nguồn Shopee/CDN không phản hồi trong 25 giây. Thử lại sau hoặc kiểm tra nguồn dữ liệu.':'Không kết nối được Shopee/CDN. Kiểm tra mạng và quyền truy cập nguồn dữ liệu; chưa gọi AI.');}
  if(response.status>=300&&response.status<400){const location=response.headers.get('location');await response.body?.cancel();if(!location)throw Error('Nguồn chuyển hướng nhưng thiếu địa chỉ đích.');next=checkedURL(new URL(location,next).href,kind);continue;}
  if(!response.ok){await response.body?.cancel();throw Error([401,403,429].includes(response.status)?'Shopee/CDN từ chối truy cập hoặc giới hạn lượt đọc (HTTP '+response.status+'). Cần nguồn dữ liệu được cấp quyền; app không vượt đăng nhập/CAPTCHA.':'Nguồn sản phẩm/ảnh trả HTTP '+response.status+'.');}
  const chunks=[];let count=0;
  try{for await(const chunk of response.body||[]){count+=chunk.byteLength;if(count>limit)throw Error('Dữ liệu nguồn vượt giới hạn cho phép.');chunks.push(Buffer.from(chunk));}}catch(error){throw error;}
  return {bytes:Buffer.concat(chunks),url:next,type:(response.headers.get('content-type')||'').split(';')[0].toLowerCase()};
 }
 throw Error('Link chuyển hướng quá nhiều lần.');
}
async function parseProduct(source){
 const url=new URL(checkedURL(source.url)),ids=/(?:-i\.(\d+)\.(\d+)|\/product\/(\d+)\/(\d+))(?:\/|$)/.exec(url.pathname);
 if(!ids)throw Error('Link chưa mở tới sản phẩm. Link có thể hết hạn, yêu cầu đăng nhập hoặc chỉ mở trong app Shopee.');
 if(!['text/html','application/xhtml+xml'].includes(source.type))throw Error('Nguồn Shopee không trả trang thông tin sản phẩm.');
 const {parse,parseFragment}=await import('parse5'),document=parse(source.bytes.toString('utf8')),meta={},documents=[];
 const text=node=>(node.nodeName==='#text'?node.value:(node.childNodes||[]).map(text).join(' '));
 const clean=(value,limit)=>typeof value==='string'?text(parseFragment(value)).replace(/\s+/g,' ').trim().slice(0,limit):'';
 function visit(node){const attrs=Object.fromEntries((node.attrs||[]).map(a=>[a.name,a.value]));if(node.nodeName==='meta'){const key=attrs.property||attrs.name;if(key&&attrs.content)meta[key.toLowerCase()]=attrs.content;}if(node.nodeName==='script'&&attrs.type?.toLowerCase()==='application/ld+json'){try{documents.push(JSON.parse(text(node)));}catch{}}for(const child of node.childNodes||[])visit(child);}
 visit(document);
 function product(node,depth=0){if(!node||typeof node!=='object'||depth>12)return null;if([node['@type']].flat().includes('Product'))return node;for(const value of Object.values(node)){if(value&&typeof value==='object'){const found=product(value,depth+1);if(found)return found;}}return null;}
 const data=documents.map(doc=>product(doc)).find(Boolean)||{};
 const title=clean(data.name||meta['og:title'],180).replace(/\s*[|–-]\s*Shopee(?: Việt Nam)?\s*$/i,'').trim();
 if(!title||/^(?:shopee|shopee việt nam)$/i.test(title)||/captcha|access denied|đăng nhập|verify.*human/i.test(title))throw Error('Shopee chưa cung cấp dữ liệu sản phẩm công khai. Có thể cần JavaScript, đăng nhập hoặc CAPTCHA. Chưa gọi AI; cần kiểm tra nguồn dữ liệu được cấp quyền.');
 const rawImages=[data.image||meta['og:image']||[]].flat(),imageURLs=[];
 for(const raw of rawImages){const value=typeof raw==='string'?raw:raw?.url||raw?.contentUrl;if(typeof value!=='string')continue;try{const image=checkedURL(new URL(value,url).href,'image');if(!imageURLs.includes(image))imageURLs.push(image);}catch{}if(imageURLs.length===5)break;}
 if(!imageURLs.length)throw Error('Không tìm thấy ảnh sản phẩm công khai trên CDN Shopee. Chưa gọi AI.');
 return {key:(ids[1]||ids[3])+':'+(ids[2]||ids[4]),title,description:clean(data.description||meta['og:description']||'',5000),sourceURL:url.href,imageURLs,fetchedAt:new Date().toISOString(),sourceHash:createHash('sha256').update(source.bytes).digest('hex')};
}
function parseBrowserCapture(capture,expectedURL){
 const S=require('../shopee-source.js'),p=capture?.product;
 if(!p||typeof p!=='object'||p.sourceURL!==expectedURL||!S.productKey(p.sourceURL))throw Error('Kết quả Chrome không còn khớp trang sản phẩm đã chọn. Làm mới danh sách tab.');
 if(typeof p.title!=='string'||!p.title.trim()||p.title.length>180||typeof p.description!=='string'||p.description.length>5000||!Array.isArray(p.imageURLs)||!p.imageURLs.length||p.imageURLs.length>5)throw Error('Thông tin sản phẩm Chrome thiếu tên, mô tả hoặc ảnh hợp lệ.');
 const imageURLs=[...new Set(p.imageURLs.map(url=>checkedURL(url,'image')))];
 if(!Array.isArray(capture.images)||!capture.images.length||capture.images.length>5)throw Error('Chrome chưa gửi ảnh sản phẩm.');
 const images=new Map();let total=0;
 for(const img of capture.images){
  if(!img||!imageURLs.includes(img.url)||images.has(img.url)||typeof img.data!=='string'||img.data.length>12*1024*1024)throw Error('Ảnh Chrome không khớp nguồn sản phẩm.');
  const m=/^data:image\/(?:jpeg|png|webp|avif);base64,([A-Za-z0-9+/]+={0,2})$/.exec(img.data);if(!m||m[1].length%4)throw Error('Dữ liệu ảnh Chrome không hợp lệ.');
  const bytes=Buffer.from(m[1],'base64');total+=bytes.length;if(!bytes.length||bytes.length>8*1024*1024||total>20*1024*1024)throw Error('Ảnh Chrome vượt giới hạn 8 MB/ảnh hoặc 20 MB/sản phẩm.');images.set(img.url,{bytes});
 }
 const product={key:S.productKey(p.sourceURL),title:p.title.trim(),description:p.description,sourceURL:checkedURL(p.sourceURL),imageURLs,fetchedAt:new Date().toISOString(),sourceMode:'chrome'};
 const {fetchedAt:_,...hashData}=product;product.sourceHash=createHash('sha256').update(JSON.stringify(hashData)).digest('hex');
 return {product,images};
}
module.exports={checkedURL,download,parseProduct,parseBrowserCapture};
