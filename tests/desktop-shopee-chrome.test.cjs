'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),S=require('../shopee-source.js'),{parseBrowserCapture}=require('../desktop/affiliate-source.cjs');
const {AffiliateService}=require('../desktop/affiliate-service.cjs'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {image}=require('./fixtures/affiliate-fixture.cjs');
const url='https://shopee.vn/product/123/456',cdn='https://down-vn.img.susercontent.com/file/product-photo';
const capture=()=>({product:{title:'Áo cotton MooZ',description:'Áo cotton mềm mại.',sourceURL:url,imageURLs:[cdn]},images:[{url:cdn,data:image}]});
test('Shopee capture restricts page and CDN destinations without accepting other private tabs',()=>{
 assert.equal(S.productKey(url),'123:456');assert.equal(S.productKey('https://shopee.vn/Ao-i.123.456'),'123:456');assert.equal(S.productKey('https://shopee.vn/buyer/login'),null);
 for(const u of ['https://shopee.vn.evil.test/product/123/456','https://user@shopee.vn/product/123/456','http://shopee.vn/','https://127.0.0.1/','https://shopee.vn:444/'])assert.throws(()=>S.checked(u));
 const c=capture(),p=parseBrowserCapture(c,url);assert.equal(p.product.key,'123:456');assert.match(p.product.sourceHash,/^[a-f0-9]{64}$/);assert.equal(p.images.get(cdn).bytes.length,Buffer.from(image.split(',')[1],'base64').length);
 assert.throws(()=>parseBrowserCapture(c,'https://shopee.vn/product/123/999'),/khớp/);c.images[0].url='https://evil.test/file';assert.throws(()=>parseBrowserCapture(c,url),/khớp/);
 const hostile=capture();hostile.product.cookie='secret';hostile.account='hidden';const publicData=JSON.stringify(parseBrowserCapture(hostile,url).product);assert.equal(publicData.includes('cookie'),false);assert.equal(publicData.includes('hidden'),false);
});
test('image fetch omits login credentials, validates redirects and enforces file bounds',async()=>{
 const result=await S.image(cdn,{fetchImpl:async(_url,o)=>{assert.equal(o.credentials,'omit');assert.equal(o.redirect,'manual');return new Response(Buffer.from(image.split(',')[1],'base64'),{headers:{'content-type':'image/png'}});}});assert.equal(result.data,image);
 let calls=0;await assert.rejects(S.image(cdn,{fetchImpl:async()=>{calls++;return new Response(null,{status:302,headers:{location:'https://127.0.0.1/private'}});}}),/Chỉ đọc/);assert.equal(calls,1);
 await assert.rejects(S.image(cdn,{fetchImpl:async()=>new Response('<html>login</html>',{headers:{'content-type':'text/html'}})}),/tệp ảnh/);
 await assert.rejects(S.image(cdn,{fetchImpl:async()=>new Response(new Uint8Array(8*1024*1024+1),{headers:{'content-type':'image/png'}})}),/8 MB/);
});
test('Chrome-backed affiliate job saves source and decoded image, preserves tracking link and makes no app fetch or AI call',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'shopee-chrome-unit-'));let reads=0,aiCalls=0;
 const service=new AffiliateService({root,ai:{tabs:async()=>[],ask:async()=>{aiCalls++;throw Error('Unexpected AI');}},readChrome:async payload=>{reads++;assert.deepEqual(payload,{id:12,expectedURL:url});return capture();},fetchImpl:async()=>{throw Error('App must not fetch logged-in product');},decodeImage:async()=>image});await service.init();t.after(async()=>{await service.close();await fs.rm(root,{recursive:true,force:true});});
 const affiliate='https://s.shopee.vn/my-affiliate',j=await service.create({url:affiliate,prepareOnly:true,sourceMode:'chrome',chromeTab:{id:12,url}});let saved;
 for(let i=0;i<300;i++){saved=await service.get(j.id);if(['sourced','error'].includes(saved.status))break;await new Promise(r=>setTimeout(r,5));}
 assert.equal(saved.status,'sourced',saved.error);assert.equal(saved.affiliate,affiliate);assert.equal(saved.product.sourceMode,'chrome');assert.equal(saved.product.images.length,1);assert.equal(reads,1);assert.equal(aiCalls,0);
 await assert.rejects(service.create({url:'https://shopee.vn/product/123/999',sourceMode:'chrome',chromeTab:{id:12,url},prepareOnly:true}),/hai sản phẩm/);
 await assert.rejects(service.create({url:affiliate,sourceMode:'chrome',chromeTab:{id:12,url:'https://shopee.vn/buyer/login'},prepareOnly:true}),/Chọn tab/);
});
