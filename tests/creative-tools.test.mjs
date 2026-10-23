import test from 'node:test';import assert from 'node:assert/strict';
import '../batch-manager.js';import '../workflow-tools.js';import '../creative-tools.js';import '../reference-board.js';
const {parse}=WorkflowCreative;
test('typed AI answers keep image and video prompts in one scene and preserve multiline strings',()=>{
 const rows=parse(JSON.stringify({scenes:[{title:'Mở đầu',imagePrompt:'Image\nmore',videoPrompt:'Move camera',duration:8,size:'16:9'},{title:'Tiếp',videoPrompt:'Follow subject'}]}));assert.equal(rows.length,2);assert.equal(rows[0].imagePrompt,'Image\nmore');assert.equal(rows[0].videoPrompt,'Move camera');assert.equal(rows[0].duration,8);assert.equal(rows[1].imagePrompt,'');assert.equal(rows[1].duration,5);
});
test('bracket prompts, numbered answers, JSON variants and scene scripts use explicit boundaries',()=>{
 assert.deepEqual(parse('[First\nsecond line]\n[Next]','image').map(r=>r.imagePrompt),['First\nsecond line','Next']);assert.deepEqual(parse('1. First\nMore\n2. Second').map(r=>r.videoPrompt),['First\nMore','Second']);assert.deepEqual(parse('```json\n{"variants":["First","Second"]}\n```','image').map(r=>r.imagePrompt),['First','Second']);const rows=parse('CẢNH 1 (0:00–0:05): Test','video',()=>[{title:'Test',hasImagePrompt:true,imagePrompt:'image',hasVideoPrompt:true,videoPrompt:'video',seconds:5,size:'9:16'}]);assert.equal(rows[0].imagePrompt,'image');assert.equal(rows[0].videoPrompt,'video');
});
test('malformed and unstructured AI answers cannot silently create partial tasks',()=>{
 for(const input of ['','A single answer','{"scenes":[}','["first",]','{"scenes":[{}]}','{"scenes":[{"videoPrompt":true}]}',JSON.stringify({scenes:[{videoPrompt:'x',duration:-1}]}),JSON.stringify({scenes:[{videoPrompt:'x',size:'anything'}]}),JSON.stringify(Array(51).fill('x'))])assert.throws(()=>parse(input),input);assert.equal(parse('[repeat]\n[repeat]').length,2);assert.equal(parse('[[IMG-1] in garden]','image')[0].imagePrompt,'[IMG-1] in garden');
});
test('image output slots remain stable after deletion and input arrays are not reordered',()=>{
 const data={referenceImages:[{id:'b',slot:2,name:'B',url:'b'},{id:'a',slot:1,name:'A',url:'a'}]};assert.deepEqual(WorkflowReferences.select(data,'image').map(i=>i.id),['a','b']);assert.equal(data.referenceImages[0].id,'b');data.referenceImages=data.referenceImages.filter(i=>i.id!=='a');assert.equal(WorkflowReferences.select(data,'image1').length,0);assert.equal(WorkflowReferences.select(data,'image2')[0].id,'b');for(const slots of [[{slot:1,url:'a'},{slot:1,url:'b'}],[{slot:9,url:'a'}],[{slot:1,url:''}]])assert.throws(()=>WorkflowReferences.images({referenceImages:slots}));
});
