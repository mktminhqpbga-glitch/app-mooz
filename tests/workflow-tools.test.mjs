import {readFileSync} from 'node:fs';import vm from 'node:vm';import test from 'node:test';import assert from 'node:assert/strict';
const context={};vm.runInNewContext(readFileSync(new URL('../workflow-tools.js',import.meta.url),'utf8'),context);const tools=context.WorkflowTools;
test('technical report distinguishes failed ratio, duration and absent audio; rejects invalid settings',()=>{
 const report=tools.assess({kind:'video',width:720,height:1280,duration:8,hasAudio:false},{expectedRatio:'16:9',expectedDuration:5,requireAudio:true});assert.equal(report.passed,false);assert.ok(report.checks.every(c=>!c.pass));assert.throws(()=>tools.assess({kind:'image',width:1,height:1},{expectedRatio:'wrong'}));assert.throws(()=>tools.assess({kind:'image',width:1,height:1},{expectedRatio:'0:9'}));
});
test('variants accept structured or numbered outputs, preserve complete paragraphs and refuse unsplit text',()=>{
 assert.equal(tools.variants('```json\n{"variants":["First","Second"]}\n```')[1],'Second');assert.equal(tools.variants('1. First\nMore detail\n2. Second')[0],'First\nMore detail');assert.equal(tools.variants('A single unsplit idea').length,0);
});
test('bundle names cannot create path traversal and rules identify original-video analysis',()=>{assert.ok(!tools.safeName('../../unsafe/collection').includes('/'));assert.ok(!tools.safeName('..').includes('..'));assert.ok(tools.rules({toolKind:'videoAnalysis'}).includes('video gốc'));assert.ok(tools.rules({toolKind:'promptVariants',variantCount:99}).includes('10 biến thể'));});
test('simple image prompt preserves user text and omits unused ID boilerplate',()=>{
 const original='tách nền sản phẩm ra nền trắng giữ đúng chi tiết và màu sắc';assert.equal(tools.imagePrompt(original,'1:1'),original+'\nTạo 1 ảnh, tỷ lệ 1:1.');assert.equal(tools.referenceNote([{componentId:'IMG-A',roles:[],instructions:''}],original),'');assert.equal(tools.imagePrompt(original,'16:9','chữ, logo'),original+'\nTạo 1 ảnh, tỷ lệ 16:9.\nTránh: chữ, logo');
});
test('reference IDs remain when needed for multiple images, explicit IDs, roles or locks',()=>{
 const first={componentId:'IMG-A',roles:[],instructions:''},second={componentId:'IMG-B',roles:['Bối cảnh'],instructions:''};assert.ok(tools.referenceNote([first,second],'Ghép ảnh').includes('Attached image 2 = [IMG-B]'));assert.ok(tools.referenceNote([first],'Dùng [IMG-A]').includes('[IMG-A]'));assert.ok(tools.referenceNote([second],'Tạo ảnh').includes('Bối cảnh'));assert.ok(tools.referenceNote([{...first,instructions:'Giữ tóc đen'}],'Tạo ảnh').includes('Giữ tóc đen'));
});
