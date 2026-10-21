import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../batch-images.js';
const {parsePrompts}=globalThis.WorkflowBatch;
test('batch parses lines, copies and preserves duplicate prompts',()=>{
 assert.deepEqual(parsePrompts('A\r\nB',2).map(x=>x.prompt),['A','A','B','B']);
 assert.equal(parsePrompts('A\nA').length,2);
});
test('blank lines separate multiline prompts',()=>{
 assert.deepEqual(parsePrompts('Nhân vật\nTrang phục\n\nBối cảnh\nÁnh sáng').map(x=>x.prompt),['Nhân vật\nTrang phục','Bối cảnh\nÁnh sáng']);
});
test('empty or oversized batches and invalid copy counts are rejected',()=>{
 assert.throws(()=>parsePrompts(' '));for(const n of [0,11,1.5,NaN])assert.throws(()=>parsePrompts('A',n));
 assert.throws(()=>parsePrompts(Array(26).fill('A').join('\n'),2));assert.equal(parsePrompts(Array(25).fill('A').join('\n'),2).length,50);
});
