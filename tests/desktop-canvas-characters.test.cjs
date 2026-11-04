'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {validate,imageBytes,limits}=require('../canvas-characters.js');
const png='data:image/png;base64,iVBORw0KGgo=';
test('character metadata keeps reference images and normalizes only names/tags',()=>{
 const value=validate({name:'  Linh  ',description:'Giữ nguyên\n trang phục ',tags:[' Áo dài ','Áo dài',''],images:[png]});
 assert.equal(value.name,'Linh');assert.equal(value.description,'Giữ nguyên\n trang phục ');assert.deepEqual(value.tags,['Áo dài']);assert.deepEqual(value.images,[png]);assert.equal(value.bytes,8);
});
test('character library rejects unsupported, oversized or empty reference payloads',()=>{
 for(const images of [[],Array(9).fill(png),['https://external.example/portrait.png'],['data:image/svg+xml;base64,AAAA'],['data:image/png;base64,abc']])assert.throws(()=>validate({name:'Linh',images}));
 assert.throws(()=>imageBytes('data:image/png;base64,'+'A'.repeat(Math.ceil((limits.image+1)/3)*4)),/8 MB/);
 const large='data:image/png;base64,'+'A'.repeat(8*1024*1024);assert.throws(()=>validate({name:'Linh',images:Array(4).fill(large)}),/20 MB/);
});
test('character schema bounds prevent metadata corruption and excessive filters',()=>{
 for(const input of [{name:'',images:[png]},{name:'a'.repeat(101),images:[png]},{name:'Linh',description:'a'.repeat(4001),images:[png]},{name:'Linh',tags:[{}],images:[png]},{name:'Linh',tags:Array.from({length:9},(_,i)=>String(i)),images:[png]}])assert.throws(()=>validate(input));
});
