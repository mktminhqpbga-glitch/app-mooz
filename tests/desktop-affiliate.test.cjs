'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {checkedURL,download,parseProduct}=require('../desktop/affiliate-source.cjs');
const {buildStory,duplicate}=require('../desktop/affiliate-story.cjs');
const {AffiliateService}=require('../desktop/affiliate-service.cjs');
const {PostingStore}=require('../desktop/posting-store.cjs');
const {affiliate,image,sourceHTML,answer}=require('./fixtures/affiliate-fixture.cjs');
const source=()=>({url:'https://shopee.vn/product/123/456',type:'text/html',bytes:Buffer.from(sourceHTML)});
const product=async()=>({...await parseProduct(source()),images:[image]});
test('Shopee source accepts affiliate redirects only within approved HTTPS hosts',async()=>{
 for(const value of ['http://shopee.vn/','https://shopee.vn.evil.invalid/x','https://shopee.vn@127.0.0.1/x','https://shopee.vn:444/','https://127.0.0.1/'])assert.throws(()=>checkedURL(value));
 let calls=0;await assert.rejects(download(affiliate,{fetchImpl:async()=>{calls++;return new Response(null,{status:302,headers:{location:'https://127.0.0.1/private'}});}}),/Dán link HTTPS/);assert.equal(calls,1);
 const result=await download(affiliate,{fetchImpl:async(url,options)=>{assert.equal(options.redirect,'manual');assert.equal(options.credentials,'omit');return url.includes('s.shopee.vn')?new Response(null,{status:302,headers:{location:'https://shopee.vn/product/123/456'}}):new Response(sourceHTML,{headers:{'content-type':'text/html'}});}});assert.equal((await parseProduct(result)).key,'123:456');
});
test('Shopee JSON-LD parser handles graph nodes and HTML entities without executing source',async()=>{
 const p=await product();assert.equal(p.title,'Áo cotton MooZ');assert.equal(p.images.length,1);assert.match(p.sourceHash,/^[a-f0-9]{64}$/);
 const og={...source(),bytes:Buffer.from('<meta property="og:title" content="Áo &amp; quần | Shopee"><meta property="og:image" content="https://down-vn.img.susercontent.com/file/photo">')};assert.equal((await parseProduct(og)).title,'Áo & quần');
 await assert.rejects(parseProduct({...source(),url:'https://s.shopee.vn/unresolved'}),/chưa mở tới sản phẩm/);
 await assert.rejects(parseProduct({...source(),bytes:Buffer.from('<meta property="og:title" content="Đăng nhập Shopee">')}),/chưa cung cấp/);
 await assert.rejects(parseProduct({...source(),bytes:Buffer.from(sourceHTML.replace('https://down-vn.img.susercontent.com/file/product-photo','https://attacker.invalid/private'))}),/Không tìm thấy ảnh/);
});
test('Shopee denied/oversized sources stop with actionable errors',async()=>{
 await assert.rejects(download(affiliate,{fetchImpl:async()=>new Response('Denied',{status:403})}),/từ chối.*403/);
 await assert.rejects(download(affiliate,{fetchImpl:async()=>new Response(new Uint8Array(6*1024*1024+1))}),/vượt giới hạn/);
});
test('affiliate story validates sourced quotes, exact hook, complete review and original images',async()=>{
 const phases=[],story=await buildStory(await product(),[],async prompt=>JSON.stringify(answer(prompt)),async phase=>phases.push(phase),new AbortController().signal);
 assert.deepEqual(phases,['profile','director','writer','review','review']);assert.equal(story.review.approved,true);assert.equal(story.scenes.length,3);
 await assert.rejects(buildStory(await product(),[],async prompt=>{const a=answer(prompt);if(a.facts)a.facts[0].quote='Bảo hành 10 năm';return JSON.stringify(a);},async()=>{},new AbortController().signal),/không có trong nguồn/);
 await assert.rejects(buildStory(await product(),[],async prompt=>{const a=answer(prompt);if(a.scenes)a.scenes[0].image_index=5;return JSON.stringify(a);},async()=>{},new AbortController().signal),/ảnh\/thời lượng/);
 await assert.rejects(buildStory(await product(),[],async prompt=>{const a=answer(prompt);if(a.reviewed_scene_ids)a.reviewed_scene_ids=[1];return JSON.stringify(a);},async()=>{},new AbortController().signal),/đủ mọi cảnh/);
});
test('affiliate story rejects negative review and duplicate scripts with renamed products',async()=>{
 await assert.rejects(buildStory(await product(),[],async prompt=>{const a=answer(prompt);if(a.reviewed_scene_ids){a.approved=false;a.issues=['Cảnh 2 chưa có nguồn.'];}return JSON.stringify(a);},async()=>{},new AbortController().signal),/Cảnh 2/);
 assert.equal(duplicate({plan:{hook:'Sản phẩm A là lựa chọn trong câu chuyện này'},scenes:[{narration:'Một cảnh riêng'}]},'Sản phẩm A',[{title:'Sản phẩm B',hook:'Sản phẩm B là lựa chọn trong câu chuyện này',narration:'Khác'}]),true);
});
async function fixture(t,overrides={}){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'affiliate-unit-'));let calls=0;
 const ai={tabs:async()=>[{id:1,transport:'native',url:'https://chatgpt.com/c/affiliate'}],ask:async(_job,prompt,_target,_signal,options)=>{assert.match(options.rules,/JSON/);calls++;return JSON.stringify(answer(prompt));}};
 const service=new AffiliateService({root,ai,decodeImage:async()=>image,fetchImpl:async url=>url.includes('s.shopee.vn')?new Response(null,{status:302,headers:{location:'https://shopee.vn/product/123/456'}}):url.includes('shopee.vn/product')?new Response(sourceHTML,{headers:{'content-type':'text/html'}}):new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'image/png'}}),...overrides});await service.init();t.after(async()=>{await service.close();await fs.rm(root,{recursive:true,force:true});});return {root,service,ai,calls:()=>calls};
}
async function done(service,id){for(let i=0;i<300;i++){const job=await service.get(id);if(['ready','error','cancelled'].includes(job.status))return job;await new Promise(resolve=>setTimeout(resolve,5));}throw Error('Affiliate fixture did not settle');}
test('durable affiliate job completes four AI steps, preserves tracking link and does not publish',async t=>{
 const {service,calls,root}=await fixture(t),{id}=await service.create({url:affiliate,target:{id:1,transport:'native'}}),job=await done(service,id);
 assert.equal(job.status,'ready',job.error);assert.equal(calls(),4);assert.ok(job.caption.endsWith(affiliate));assert.equal(job.affiliate,affiliate);assert.equal(job.story.scenes.length,3);assert.equal((await service.snapshot()).jobs[0].sceneCount,3);
 await service.archive(id);assert.equal((await service.snapshot()).jobs.length,0);assert.equal((await service.history()).length,1,'Archived jobs still protect script history');
 await service.close();const reopened=new AffiliateService({root,ai:service.ai,decodeImage:async()=>image});await reopened.init();assert.equal((await reopened.get(id)).caption,job.caption);assert.equal(reopened.paused,true);await reopened.close();
});
test('missing source and invalid AI are durable failures without automatic retries',async t=>{
 const {service,calls}=await fixture(t,{fetchImpl:async()=>new Response('Denied',{status:403})}),{id}=await service.create({url:affiliate,target:{id:1,transport:'native'}}),job=await done(service,id);assert.equal(job.status,'error');assert.match(job.error,/403/);assert.equal(calls(),0);assert.equal(service.controllers.size,0);
});
test('cancel interrupts active AI, persists cancellation and does not advance to more phases',async t=>{
 let started;const ready=new Promise(r=>started=r);let calls=0;
 const {service}=await fixture(t,{ai:{tabs:async()=>[{id:1,transport:'native',url:'https://chatgpt.com/c/affiliate'}],ask:async(_j,_p,_t,signal)=>{calls++;started();await new Promise((_r,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));}}}),{id}=await service.create({url:affiliate,target:{id:1,transport:'native'}});await ready;await service.cancel(id);const job=await done(service,id);assert.equal(job.status,'cancelled');assert.equal(calls,1);assert.equal(job.story.profile,null);
});
test('source caption is copied into a draft and retains the exact affiliate URL',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'affiliate-posting-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const store=new PostingStore(root);await store.init();const {id}=await store.begin(1,'project',{caption:'Có liên kết tiếp thị\n'+affiliate,media:[{kind:'image',mime:'image/png',size:3}]});await store.append(1,{id,index:0,offset:0,bytes:new Uint8Array([1,2,3])});const job=await store.commit(1,id);assert.equal(job.caption,'Có liên kết tiếp thị\n'+affiliate);assert.equal(job.status,'draft');assert.equal(job.autoPublish,false);
});
test('paused queued work survives an active cancellation and runs only after resume',async t=>{
 let started;const ready=new Promise(r=>started=r);let calls=0;
 const {service}=await fixture(t,{ai:{tabs:async()=>[{id:1,transport:'native',url:'https://chatgpt.com/c/affiliate'}],ask:async(_j,prompt,_t,signal)=>{if(++calls===1){started();await new Promise((_r,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));}return JSON.stringify(answer(prompt));}}});
 const first=await service.create({url:affiliate,target:{id:1,transport:'native'}});await ready;const second=await service.create({url:affiliate,target:{id:1,transport:'native'}});await service.pause(true);await service.cancel(first.id);await done(service,first.id);assert.equal((await service.get(second.id)).status,'queued');assert.equal(calls,1);
 await service.pause(false);assert.equal((await done(service,second.id)).status,'ready');assert.equal(calls,5);
});
test('restart marks interrupted work without replaying AI and a damaged job does not hide healthy jobs',async t=>{
 const {service,root,calls}=await fixture(t),j=await service.create({url:affiliate,target:{id:1,transport:'native'}});await done(service,j.id);await service.save(j.id,{status:'writer'});await service.close();
 const orphan=await service.store.create('Tác vụ chưa ghi xong');const restarted=new AffiliateService({root,ai:service.ai,decodeImage:async()=>image});await restarted.init();assert.equal((await restarted.get(j.id)).status,'error');assert.equal((await restarted.snapshot()).jobs.length,2);assert.equal((await restarted.snapshot()).jobs.find(j=>j.id===orphan.id).recoveryRequired,true);assert.equal(calls(),4);assert.equal(restarted.paused,true);await restarted.close();
});
