'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../desktop/batch/composer.js'),M=require('../desktop/batch/model.js');
test('Composer preserves line order and whole-prompt mode; empty and excessive input are refused',()=>{
 assert.deepEqual(C.prompts('  A \r\n\r\n B  '),['A','B']);assert.deepEqual(C.prompts('A\nB',false),['A\nB']);
 assert.throws(()=>C.prompts('  '),/Nhập/);assert.throws(()=>C.prompts('x'.repeat(4001)),/4.000/);assert.throws(()=>C.prompts(Array(101).fill('x').join('\n')),/100/);
});
test('Each text job keeps its exact provider/ratio/duration/prompt, independent of the image workflow',()=>{
 const plan=C.textPlan('First product',{provider:'grok',ratio:'16:9',duration:null}),w=M.defaultWorkflow();
 assert.equal(plan.steps.length,2);assert.equal(plan.duration,null);M.validate(plan,[],{requireTabs:false});
 const data={jobs:[{id:'a',name:'A',inputMode:'text',images:[],note:'First product',state:'draft',draftPlan:plan},{id:'b',name:'B',images:[],state:'draft'}],workers:M.defaultWorkers(),workflow:w};
 const e=M.create(data);assert.throws(()=>e.enqueue(['a','b'],w),/ảnh tham chiếu/);assert.equal(data.jobs[0].state,'draft','Validate the entire selection before changing any job');
 e.enqueue(['a'],w);plan.ratio='1:1';plan.steps[0].prompt='Changed';w.steps[0].provider='chatgpt';
 const j=data.jobs[0];assert.equal(j.plan.ratio,'16:9');assert.equal(j.plan.steps[0].provider,'grok');assert.equal(j.plan.steps[0].prompt,'First product');assert.deepEqual(j.inputSnapshot,[]);assert.equal(j.noteSnapshot,'First product');
 e.unqueue('a');j.note='';assert.throws(()=>e.enqueue(['a'],w),/văn bản/);
});
test('Text mode does not bypass an image-dependent plan; provider and duration choices remain explicit',()=>{
 const data={jobs:[{id:'a',name:'A',inputMode:'text',note:'Prompt',images:[],state:'draft'}],workers:[]};const e=M.create(data);
 assert.throws(()=>e.enqueue(['a'],M.defaultWorkflow()),/văn bản/);
 assert.throws(()=>C.textPlan('A',{provider:'seedance'}),/AI/);assert.throws(()=>C.textPlan('A',{duration:8}),/thời lượng/);
 assert.equal(C.textPlan('A',{duration:10}).duration,10);assert.equal(C.draft({duration:8}).duration,null);
});
