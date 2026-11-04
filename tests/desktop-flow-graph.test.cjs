'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const G=require('../desktop/batch/flow-graph.js'),M=require('../desktop/batch/model.js'),Runner=require('../desktop/batch/flow-runner.js');
const find=(f,type)=>f.nodes.find(n=>n.type===type),input=(f,type)=>f.nodes.find(n=>n.kind==='input'&&n.dataType===type),flush=()=>new Promise(r=>setImmediate(r));
test('saved presets compile in dependency order independent of card order and position',()=>{
 for(const kind of ['sales','video','script','write']){const f=G.preset(kind,'Luồng '+kind),plan=G.compile(f);assert.equal(plan.steps.at(-1).type,'graphResult');assert.equal(M.validate(plan,[],{requireTabs:false}),true);const reversed=G.copy(f);reversed.nodes.reverse();for(const n of reversed.nodes){n.x+=250;n.y+=160;}const p=G.compile(reversed),indices=new Map(p.steps.map((s,i)=>[s.id,i]));for(const s of p.steps)for(const sources of Object.values(s.bindings))for(const id of sources)if(indices.has(id))assert.ok(indices.get(id)<indices.get(s.id));}
 assert.throws(()=>G.compile(G.preset('blank')),/chưa có đường|nối đầu vào/);
});
test('typed wiring rejects cycles, reversed ports and invalid result types without mutating graph',()=>{
 const f=G.preset('write'),before=JSON.stringify(f),a=input(f,'text'),w=find(f,'write'),z=f.nodes.find(n=>n.kind==='output');
 assert.throws(()=>G.connect(f,w.id,w.id,'context'),/chính nó/);assert.throws(()=>G.connect(f,z.id,w.id,'context'),/hai cổng|nối ngược/);
 const second=G.process('write');f.nodes.push(second);let next=G.connect(f,w.id,second.id,'context');assert.throws(()=>G.connect(next,second.id,w.id,'context'),/vòng lặp/);
 f.nodes.pop();assert.equal(JSON.stringify(f),before);const image=G.input('image','B');f.nodes.push(image);assert.throws(()=>G.connect(f,image.id,w.id,'prompt'),/khác loại/);
 z.dataType='video';assert.throws(()=>G.compile(f),/sai loại/);a.id='constructor';assert.throws(()=>G.schema(f),/Mã node/);
});
test('required input form checks actual assets, optional empties and aggregate reference limits before queueing',()=>{
 const f=G.preset('sales'),p=G.compile(f),values=G.defaults(p),a=input(f,'image'),character=f.nodes.find(n=>n.name.startsWith('C'));
 assert.throws(()=>G.validateValues(p,values),e=>e.inputId===a.id&&/bắt buộc/.test(e.message));values[a.id].assets=['product'];
 assert.equal(G.validateValues(p,values,id=>({blob:new Blob(['x']),kind:'image'})),true);assert.throws(()=>G.validateValues(p,values,id=>({blob:new Blob(['x']),kind:'video'})),/sai loại/);assert.throws(()=>G.validateValues(p,values,id=>({blob:new Blob(['x']),kind:'image',deleted:true})),/không còn trong kho/);
 values[a.id].assets=Array.from({length:8},(_,i)=>'product-'+i);values[character.id].assets=['person'];assert.throws(()=>G.validateValues(p,values),/vượt 8 ảnh/);values[character.id].assets=[];assert.equal(G.validateValues(p,values),true);
});
test('compiler rejects disconnected paid nodes, missing scene contracts and video-source/provider mismatch',()=>{
 const f=G.preset('sales');f.scenes=2;const image=find(f,'image');f.edges=f.edges.filter(e=>!(e.to===image.id&&e.port==='script'));assert.throws(()=>G.compile(f),/từ 2 cảnh/);
 const a=G.preset('video'),unused=G.process('write');a.nodes.push(unused);assert.throws(()=>G.compile(a),/đường nối/);a.nodes.pop();const v=find(a,'video'),src=G.input('video','C · Video gốc');a.nodes.push(src);a.edges.push({id:crypto.randomUUID(),from:src.id,to:v.id,port:'video'});v.provider='grok';assert.throws(()=>G.compile(a),/cần AI Muse|một AI hỗ trợ toàn bộ/);
});
test('single-valued ports replace their wire atomically; draft validation preserves undo source',()=>{
 const f=G.preset('write'),first=input(f,'text'),next=G.input('text','B · Yêu cầu khác'),w=find(f,'write');f.nodes.push(next);
 const result=G.connect(f,next.id,w.id,'prompt');assert.equal(result.edges.filter(e=>e.to===w.id&&e.port==='prompt').length,2,'Text prompt ports explicitly support multiple inputs');
 const other=G.process('write');result.nodes.push(other);const z=result.nodes.find(n=>n.kind==='output'),replaced=G.connect(result,other.id,z.id,'result');assert.equal(replaced.edges.filter(e=>e.to===z.id).length,1);assert.equal(result.edges.find(e=>e.to===z.id).from,w.id);assert.equal(first.defaultText,'');
});
test('own script is split without AI and requires exact scene count and complete structured scenes',()=>{
 const p=G.compile(G.preset('script'));p.scenes=2;
 assert.equal(G.splitScript('Cảnh đầu\n\nCảnh sau',p).length,2);assert.throws(()=>G.splitScript('Chỉ một cảnh',p),/đúng 2 cảnh/);assert.throws(()=>G.splitScript('{bad json',p),/JSON/);assert.throws(()=>G.splitScript(JSON.stringify({scenes:[{scene:1}]}),p),/đúng 2 cảnh/);
});
test('queue freezes each flow, values, graph bindings and whole-task tab choice; failed validation cannot partially enqueue',()=>{
 const f=G.preset('write'),w=find(f,'write');w.workerId='native:pinned';const p=G.compile(f),a=input(f,'text'),va=G.defaults(p),vb=G.defaults(p);va[a.id].text='PRODUCT_A';
 const data={workflow:M.defaultWorkflow(),jobs:[{id:'a',name:'A',inputMode:'graph',images:[],draftPlan:p,requestedWorkerId:'native:pinned',flowValues:va,state:'draft',logs:[]},{id:'b',name:'B',inputMode:'graph',images:[],draftPlan:G.copy(p),requestedWorkerId:'native:pinned',flowValues:vb,state:'draft',logs:[]}],workers:M.defaultWorkers(),running:false,maxConcurrent:2};const e=M.create(data);
 assert.throws(()=>e.enqueue(['a','b'],data.workflow),/bắt buộc/);assert.ok(data.jobs.every(j=>j.state==='draft'));
 vb[a.id].text='PRODUCT_B';assert.equal(e.enqueue(['a','b'],data.workflow),2);p.steps[0].prompt='CHANGED';va[a.id].text='OTHER';f.nodes.find(n=>n.id===w.id).workerId='native:other';assert.equal(data.jobs[0].flowInputSnapshot[a.id].text,'PRODUCT_A');assert.equal(data.jobs[1].flowInputSnapshot[a.id].text,'PRODUCT_B');assert.equal(data.jobs[0].plan.steps[0].workerId,undefined);assert.ok(data.jobs[0].plan.flow.nodes.every(n=>!n.workerId));assert.equal(data.jobs[0].workerPreferenceSnapshot.workerId,'native:pinned');
 e.unqueue('a');assert.equal(data.jobs[0].flowInputSnapshot,null);assert.equal(data.jobs[0].draftPlan.schema,'mooz-flow-plan-v1');assert.throws(()=>e.setImages('a',['different']),/form đầu vào/);
});
test('compiled plan tampering is rejected before AI requests',()=>{const p=G.compile(G.preset('video'));p.steps.reverse();assert.throws(()=>M.validate(p,[],{requireTabs:false}),/không khớp graph/);});
test('runner reads only connected text, stores text Z, and does not pull unrelated job outputs',async()=>{
 const f=G.preset('write'),plan=G.compile(f),a=input(f,'text'),values=G.defaults(plan);values[a.id].text='OWN_PRODUCT';const calls=[],assets=new Map();let id=0;
 const run=Runner.create({asset:id=>assets.get(id),dataURL:async()=>assert.fail('No image wire'),saveResult:async(blob,kind,name)=>{const a={id:'result-'+(++id),blob,kind,name,origin:'result',text:await blob.text()};assets.set(a.id,a);return a;},generate:async req=>{calls.push(req);return {text:'OWN_RESULT'};},processLocal:async()=>assert.fail('No FFmpeg node'),parseScenes:M.parseScenes});
 const j={id:'job',sku:'MZ-A',plan,flowInputSnapshot:values,outputs:{unrelated:{text:'FOREIGN_PRODUCT_SECRET'}},state:'running'};let result;for(const s of plan.steps)result=await run(j,s,{id:'native:one'},()=>{});
 assert.equal(calls.length,1);assert.match(calls[0].prompt,/OWN_PRODUCT/);assert.doesNotMatch(calls[0].prompt,/FOREIGN/);assert.equal(assets.get(result.resultId).kind,'text');assert.equal(await assets.get(result.resultId).blob.text(),'OWN_RESULT');
});
test('branching media runner binds each scene and optional character without ambient input fallback',async()=>{
 const f=G.preset('script');f.scenes=2;const plan=G.compile(f),values=G.defaults(plan),script=input(f,'text'),character=input(f,'image');values[script.id].text='SCENE_ONE\n\nSCENE_TWO';values[character.id].assets=['PERSON'];const assets=new Map([['PERSON',{id:'PERSON',kind:'image',blob:new Blob(['person'])}]]),calls=[],processed=[];let n=0;
 const run=Runner.create({asset:id=>assets.get(id),dataURL:async a=>'data:image/png;base64,'+Buffer.from(a.id).toString('base64'),saveResult:async(blob,kind,name)=>{const a={id:'result-'+(++n),blob,kind,name,origin:'result'};assets.set(a.id,a);return a;},generate:async req=>{calls.push(req);return {dataUrl:'data:'+req.mediaType+'/'+(req.mediaType==='video'?'mp4':'png')+';base64,eA=='};},processLocal:async(type,data)=>{processed.push({type,ids:data.videos.map(a=>a.id)});return {blob:new Blob(['assembled'],{type:'video/mp4'})};},parseScenes:M.parseScenes});
 const j={id:'j',sku:'MZ-A',plan,flowInputSnapshot:values,outputs:{foreign:{items:['FOREIGN']}},inputSnapshot:['WRONG_PRODUCT'],state:'running'};let result;for(const s of plan.steps)result=await run(j,s,{id:'native:one'},()=>{});
 const images=calls.filter(c=>c.mediaType==='image'),videos=calls.filter(c=>c.mediaType==='video');assert.equal(images.length,2);assert.equal(videos.length,2);assert.ok(images.every(c=>c.referenceImages.length===1));assert.ok(videos.every(c=>c.referenceImages.length===2));assert.notEqual(videos[0].referenceImages[0],videos[1].referenceImages[0]);assert.match(images[0].prompt,/SCENE_ONE/);assert.doesNotMatch(images[0].prompt,/SCENE_TWO/);assert.equal(processed[0].type,'videoAssembly');assert.equal(processed[0].ids.length,2);assert.equal(assets.get(result.resultId).kind,'video');
});
test('queued graph leases remain held after stop until the worker settles; late results never complete the job',async()=>{
 const flow=G.preset('write'),plan=G.compile(flow),values=G.defaults(plan);values[input(flow,'text').id].text='one';const jobs=['a','b'].map(id=>({id,name:id,inputMode:'graph',images:[],draftPlan:G.copy(plan),flowValues:G.copy(values),state:'draft',logs:[]})),data={jobs,workers:[{id:'native:one',provider:'muse',selected:true,online:true},...M.defaultWorkers()],workflow:M.defaultWorkflow(),running:false,maxConcurrent:1};let finish,calls=0;
 const e=M.create(data,{run:async()=>{calls++;await new Promise(r=>finish=r);return {};}});e.enqueue(['a','b'],plan);data.running=true;e.tick();await flush();e.stop('a');e.tick();assert.equal(calls,1);assert.throws(()=>e.retry('a'),/đang chờ/i);data.running=false;finish();await flush();assert.equal(jobs[0].state,'stopped');assert.equal(jobs[0].step,0);assert.equal(jobs[0].completed.length,0);
});
test('AI scene script follows its wired product facts, then image/video requests receive only their own scene',async()=>{
 const f=G.preset('sales');f.scenes=2;const plan=G.compile(f),values=G.defaults(plan),product=input(f,'image'),character=f.nodes.find(n=>n.name.startsWith('C'));
 values[product.id].assets=['PRODUCT'];values[character.id].assets=['PERSON'];
 const assets=new Map(['PRODUCT','PERSON'].map(id=>[id,{id,kind:'image',blob:new Blob([id])}])),calls=[];let count=0;
 const rows=[1,2].map(scene=>({scene,title:'Cảnh '+scene,voiceover:'Lời '+scene,imagePrompt:'IMAGE_SCENE_'+scene,videoPrompt:'VIDEO_SCENE_'+scene,duration:null,size:'9:16'}));
 const run=Runner.create({asset:id=>assets.get(id),dataURL:async a=>'data:image/png;base64,'+Buffer.from(a.id).toString('base64'),saveResult:async(blob,kind)=>{const a={id:'file-'+(++count),blob,kind,origin:'result'};assets.set(a.id,a);return a;},generate:async req=>{calls.push(req);if(req.mediaType==='text')return {text:calls.length===1?'FACTS_OWN_PRODUCT':JSON.stringify({scenes:rows})};return {dataUrl:'data:'+req.mediaType+'/'+(req.mediaType==='image'?'png':'mp4')+';base64,eA=='};},processLocal:async()=>({blob:new Blob(['assembled'],{type:'video/mp4'})}),parseScenes:M.parseScenes});
 const j={id:'sales',sku:'MZ-S',plan,flowInputSnapshot:values,outputs:{},state:'running'};for(const step of plan.steps)await run(j,step,{id:'native:one'},()=>{});
 assert.equal(calls.length,6);assert.match(calls[1].prompt,/FACTS_OWN_PRODUCT/);assert.match(calls[1].prompt,/JSON/);assert.ok(calls.slice(0,2).every(c=>c.referenceImages.length===1));
 const images=calls.filter(c=>c.mediaType==='image'),videos=calls.filter(c=>c.mediaType==='video');for(let i=0;i<2;i++){assert.match(images[i].prompt,new RegExp('IMAGE_SCENE_'+(i+1)));assert.doesNotMatch(images[i].prompt,new RegExp('IMAGE_SCENE_'+(2-i)));assert.match(videos[i].prompt,new RegExp('VIDEO_SCENE_'+(i+1)));assert.equal(images[i].referenceImages.length,2);assert.equal(videos[i].referenceImages.length,2);assert.equal(images[i].referenceImages[1],videos[i].referenceImages[1]);}assert.notEqual(videos[0].referenceImages[0],videos[1].referenceImages[0]);
});

test('one fixed reference belongs to the template while product defaults stay empty for new tasks',()=>{
 const f=G.preset('sales'),product=f.nodes.find(n=>n.imageRole==='product'),reference=f.nodes.find(n=>n.imageRole==='reference');product.defaultAssets=['OLD_PRODUCT'];reference.defaultAssets=['PERSON_A'];
 const plan=G.compile(f),first=G.defaults(plan),second=G.defaults(plan);assert.deepEqual(first[product.id].assets,[]);assert.deepEqual(first[reference.id].assets,['PERSON_A']);first[product.id].assets.push('PRODUCT_1');first[reference.id].assets[0]='PERSON_B';assert.deepEqual(second[product.id].assets,[]);assert.deepEqual(second[reference.id].assets,['PERSON_A']);assert.deepEqual(reference.defaultAssets,['PERSON_A']);
 reference.maxFiles=2;assert.throws(()=>G.schema(f),/một ảnh/);reference.maxFiles=1;const extra=G.input('image','Another reference');Object.assign(extra,{imageRole:'reference',maxFiles:1});f.nodes.push(extra);assert.throws(()=>G.schema(f),/một đầu vào/);
});
test('old character ports remain recognisable without rewriting queued plans',()=>{
 const f=G.preset('video'),reference=f.nodes.find(n=>n.imageRole==='reference');delete reference.imageRole;reference.defaultAssets=['PERSON'];const before=G.copy(f),plan=G.compile(f);assert.equal(G.isReference(f,reference),true);assert.deepEqual(G.defaults(plan)[reference.id].assets,['PERSON']);G.validatePlan(plan);assert.deepEqual(f,before);
});
