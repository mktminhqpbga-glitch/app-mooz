import {test} from 'node:test';
import assert from 'node:assert/strict';
import diagram from '../canvas-diagram.js';
test('canvas description preserves typed connections and content opt-out without exporting sessions or media',()=>{
 const graph={nodes:[{id:'a',type:'prompt',data:{text:'Sản phẩm áo trắng',apiKey:'SECRET_API',chatTarget:{url:'https://private.example/session'}}},{id:'b',type:'generateImage',data:{provider:'muse',prompt:'Use workflow-connect://relay/private-secret and Bearer secret',asset:{url:'data:image/png;base64,SECRET_MEDIA',name:'Ảnh kết quả'},referenceImages:[{name:'Áo.jpg',url:'blob:secret'}]}}],edges:[{source:'a',sourcePort:'text',target:'b',targetPort:'prompt'}]};
 const text=diagram.describe(graph,{prompt:{title:'Yêu cầu',outputs:[{id:'text',label:'Văn bản'}]},generateImage:{title:'Tạo ảnh',inputs:[{id:'prompt',label:'Yêu cầu'}]}});
 assert.match(text,/N1 -->\|"Văn bản → Yêu cầu"\| N2/);assert.match(text,/Sản phẩm áo trắng/);assert.match(text,/N1 → N2/);assert.match(text,/Áo.jpg/);
 for(const value of ['SECRET_API','SECRET_MEDIA','private-secret','https://private.example/session','Bearer secret','blob:secret'])assert.equal(text.includes(value),false,value);
 const structure=diagram.describe(graph,{},false);assert.equal(structure.includes('Sản phẩm áo trắng'),false);assert.match(structure,/generateImage/);
});
test('canvas description reports cycles and dangling wires without pretending the workflow can run',()=>{
 const text=diagram.describe({nodes:[{id:'a',type:'text',data:{}},{id:'b',type:'text',data:{}}],edges:[{source:'a',target:'b'},{source:'b',target:'a'},{source:'a',target:'missing'}]});assert.match(text,/vòng lặp/);assert.match(text,/1 dây nối tới node không còn/);
});
