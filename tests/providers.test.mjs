import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import '../ai-providers.js';
const {validate,api}=globalThis.WorkflowAI;
const originalFetch=globalThis.fetch;
afterEach(()=>globalThis.fetch=originalFetch);
// FileReader browser shim allows verifying exact media bytes in adapter requests.
globalThis.FileReader=class {readAsDataURL(blob){blob.arrayBuffer().then(bytes=>{this.result=`data:${blob.type};base64,${Buffer.from(bytes).toString('base64')}`;this.onload();},()=>this.onerror());}};
const response=data=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
test('capabilities reject unsupported output and incomplete motion control',()=>{
 assert.throws(()=>validate('chatgpt',{mediaType:'video'}));
 assert.throws(()=>validate('openai',{mediaType:'text',referenceVideos:['video']}));
 assert.throws(()=>validate('google',{mediaType:'video',duration:60}));
 assert.throws(()=>validate('fal',{mediaType:'video',referenceImages:['image'],referenceVideos:[]}));
 assert.doesNotThrow(()=>validate('fal',{mediaType:'video',referenceImages:['image'],referenceVideos:['video']}));
});
test('Gemini receives original video bytes, not extracted frames',async()=>{
 let body;
 globalThis.fetch=async(url,options)=>url.startsWith('data:')?originalFetch(url):((body=JSON.parse(options.body)),response({candidates:[{content:{parts:[{text:'Phân tích video'}]}}]}));
 const result=await api('google',{mediaType:'text',prompt:'Phân tích',referenceVideos:['data:video/mp4;base64,AQID']},'test-key');
 assert.equal(result.text,'Phân tích video');
 assert.deepEqual(body.contents[0].parts[1],{inlineData:{mimeType:'video/mp4',data:'AQID'}});
});
test('Gemini image generation preserves reference image and returns image',async()=>{
 let body;globalThis.fetch=async(url,options)=>url.startsWith('data:')?originalFetch(url):((body=JSON.parse(options.body)),response({candidates:[{content:{parts:[{inlineData:{mimeType:'image/png',data:'AQID'}}]}}]}));
 const result=await api('google',{mediaType:'image',prompt:'Ảnh',referenceImages:['data:image/png;base64,AQID']},'test-key');
 assert.equal(result.url,'data:image/png;base64,AQID');assert.equal(body.contents[0].parts[1].inlineData.mimeType,'image/png');
});
test('OpenAI receives rules and image content in Responses request',async()=>{
 let body;globalThis.fetch=async(url,options)=>url.startsWith('data:')?originalFetch(url):((body=JSON.parse(options.body)),response({output:[{content:[{type:'output_text',text:'Kịch bản'}]}]}));
 const result=await api('openai',{mediaType:'text',prompt:'Mô tả',rules:'Tiếng Việt',referenceImages:['data:image/png;base64,AQID']},'test-key');
 assert.equal(result.text,'Kịch bản');assert.equal(body.instructions,'Tiếng Việt');assert.equal(body.input[0].content[1].type,'input_image');
});
test('API rejects empty outputs, permission failures and missing keys',async()=>{
 await assert.rejects(api('google',{mediaType:'text'},''),/API key/);
 globalThis.fetch=async()=>new Response('',{status:403});await assert.rejects(api('google',{mediaType:'text',prompt:'a'},'key'),/HTTP 403/);
 globalThis.fetch=async()=>response({candidates:[]});await assert.rejects(api('google',{mediaType:'text',prompt:'a'},'key'),/không trả về/);
});
test('fal motion control uploads full video and image, follows queue result',async()=>{
 let body;globalThis.fetch=async(url,options)=>{
  if(url.startsWith('data:'))return originalFetch(url);
  if(options.method==='POST'){body=JSON.parse(options.body);return response({status_url:'https://queue.fal.run/status/1',response_url:'https://queue.fal.run/result/1'});}
  if(url.includes('/status/'))return response({status:'COMPLETED'});
  return response({video:{url:'https://example.com/video.mp4'}});
 };
 const result=await api('fal',{mediaType:'video',prompt:'Chuyển động',referenceImages:['data:image/png;base64,AQID'],referenceVideos:['data:video/mp4;base64,BAUG']},'test-key');
 assert.equal(body.video_url,'data:video/mp4;base64,BAUG');assert.equal(body.image_url,'data:image/png;base64,AQID');assert.equal(body.character_orientation,'video');assert.equal(result.url,'https://example.com/video.mp4');
});
test('fal rejects cross-origin job endpoints before sending credentials',async()=>{
 globalThis.fetch=async(url)=>url.startsWith('data:')?originalFetch(url):response({status_url:'https://attacker.example/status',response_url:'https://queue.fal.run/result'});
 await assert.rejects(api('fal',{mediaType:'video',referenceImages:['data:image/png;base64,AQID'],referenceVideos:['data:video/mp4;base64,AQID']},'key'),/không hợp lệ/);
});
test('aborted API requests stop before network traffic',async()=>{
 const controller=new AbortController();controller.abort();let called=false;globalThis.fetch=async()=>{called=true;return response({});};
 await assert.rejects(api('google',{mediaType:'text'},'key',controller.signal),{name:'AbortError'});assert.equal(called,false);
});
test('Veo submits supported duration and downloads video using provider credentials',async()=>{
 let body;globalThis.fetch=async(url,options)=>{
  if(url.includes(':predictLongRunning')){body=JSON.parse(options.body);return response({done:true,response:{generateVideoResponse:{generatedSamples:[{video:{uri:'https://generativelanguage.googleapis.com/v1beta/files/video:download'}}]}}});}
  assert.equal(options.headers['x-goog-api-key'],'test-key');assert.equal(options.redirect,'error');return new Response(new Blob(['video'],{type:'video/mp4'}));
 };
 const result=await api('google',{mediaType:'video',duration:8,size:'16:9',prompt:'Scene'},'test-key');
 assert.equal(body.parameters.durationSeconds,8);assert.equal(body.instances[0].prompt,'Scene');assert.ok(result.url.startsWith('blob:'));URL.revokeObjectURL(result.url);
});
test('Veo never sends its key to a foreign media endpoint',async()=>{
 let calls=0;globalThis.fetch=async()=>{calls++;return response({done:true,response:{generateVideoResponse:{generatedSamples:[{video:{uri:'https://attacker.example/video'}}]}}});};
 await assert.rejects(api('google',{mediaType:'video',duration:8,prompt:'Scene'},'key'),/an toàn/);assert.equal(calls,1);
});
test('OpenAI image generation returns persisted base64 image',async()=>{
 globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/images/generations');assert.equal(JSON.parse(options.body).size,'1536x1024');return response({data:[{b64_json:'AQID'}]});};
 const result=await api('openai',{mediaType:'image',prompt:'Scene',size:'16:9'},'key');assert.equal(result.url,'data:image/png;base64,AQID');
});
