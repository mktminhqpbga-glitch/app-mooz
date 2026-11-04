/* Typed, serializable flow contracts. Never infer a dependency from canvas position. */
(function(root){'use strict';
 const copy=v=>JSON.parse(JSON.stringify(v));
 const media=['image','video','audio'],kinds=['text',...media];
 const types={text:'Văn bản',image:'Ảnh',video:'Video',audio:'Âm thanh',script:'Kịch bản từng cảnh'};
 const port=(name,type,required=false,many=true)=>({name,type,required,many});
 const definitions={
  vision:{name:'Đọc sản phẩm',output:'text',providers:['muse','gemini','chatgpt','grok'],ports:{images:port('Ảnh sản phẩm','image',true),prompt:port('Yêu cầu','text')}},
  text:{name:'Viết kịch bản',output:'script',providers:['muse','gemini','chatgpt','grok'],ports:{context:port('Thông tin','text'),images:port('Ảnh sản phẩm','image'),prompt:port('Yêu cầu','text')}},
  write:{name:'Viết văn bản',output:'text',providers:['muse','gemini','chatgpt','grok'],ports:{context:port('Ngữ cảnh','text'),images:port('Ảnh','image'),prompt:port('Yêu cầu','text')}},
  split:{name:'Chia kịch bản có sẵn',output:'script',providers:['local'],ports:{text:port('Kịch bản','text',true,false)}},
  image:{name:'Tạo ảnh',output:'image',providers:['muse','gemini','chatgpt','grok','flow'],ports:{images:port('Ảnh sản phẩm','image'),characters:port('Nhân vật','image'),script:port('Kịch bản','script',false,false),prompt:port('Prompt ảnh','text')}},
  video:{name:'Tạo video',output:'video',providers:['muse','grok','flow'],ports:{images:port('Ảnh cảnh / sản phẩm','image'),characters:port('Nhân vật','image'),script:port('Kịch bản','script',false,false),prompt:port('Prompt video','text'),video:port('Video gốc · Muse','video',false,false)}},
  assemble:{name:'Ghép video',output:'video',providers:['local'],ports:{videos:port('Các clip','video',true)}},
  mix:{name:'Nhạc nền / lời đọc',output:'video',providers:['local'],ports:{video:port('Video thành phẩm','video',true,false),audio:port('Nhạc / lời đọc','audio',false,false)}}
 };
 const uid=()=>globalThis.crypto.randomUUID();
 const validId=id=>typeof id==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$/.test(id)&&!['constructor','prototype','__proto__'].includes(id);
 function outputType(n){return n.kind==='input'?n.dataType:n.kind==='process'?definitions[n.type]?.output:null;}
 function ports(n){return n.kind==='output'?{result:port('Kết quả',n.dataType,true,false)}:n.kind==='process'?definitions[n.type]?.ports||{}:{};}
 function compatible(from,to){return from===to||from==='script'&&to==='text';}
 function allowedProviders(f){const nodes=f.nodes.filter(n=>n.kind==='process'&&!definitions[n.type]?.providers.includes('local'));return nodes.length?['muse','gemini','chatgpt','grok','flow'].filter(p=>nodes.every(n=>definitions[n.type]?.providers.includes(p))):['local'];}
 function singleTab(f,provider){const next=copy(f),allowed=allowedProviders(next),ai=next.nodes.filter(n=>n.kind==='process'&&n.provider!=='local'),existing=[...new Set(ai.map(n=>n.provider))];next.execution='single-tab';next.provider=provider!==undefined?provider:allowed[0]==='local'?'local':allowed.includes(next.provider)?next.provider:existing.length===1&&allowed.includes(existing[0])?existing[0]:'';for(const n of next.nodes.filter(n=>n.kind==='process')){delete n.workerId;if(n.provider!=='local'&&allowed.includes(next.provider))n.provider=next.provider;}return next;}
 function schema(f){
  if(!f||f.schema!=='mooz-flow-v1'||!validId(f.id)||!Number.isInteger(f.version)||f.version<1||typeof f.name!=='string'||!f.name.trim()||f.name.length>100)throw Error('Đặt tên luồng từ 1 đến 100 ký tự.');
  if(!Array.isArray(f.nodes)||f.nodes.length<1||f.nodes.length>40||!Array.isArray(f.edges)||f.edges.length>120)throw Error('Mỗi luồng cần từ 1 đến 40 node, tối đa 120 dây nối.');
  if(!Number.isInteger(f.scenes)||f.scenes<1||f.scenes>12||!['9:16','16:9','1:1'].includes(f.ratio)||f.duration!==null&&![5,10,15,30,40].includes(f.duration))throw Error('Số cảnh, tỷ lệ hoặc thời lượng của luồng chưa hợp lệ.');
  if(f.execution!==undefined&&f.execution!=='single-tab'||f.execution==='single-tab'&&typeof f.provider!=='string')throw Error('Chọn AI cho toàn bộ luồng.');
  const ids=new Set();
  for(const n of f.nodes){
   if(!n||!validId(n.id)||ids.has(n.id))throw Error('Mã node trống hoặc bị trùng.');ids.add(n.id);
   if(typeof n.name!=='string'||!n.name.trim()||n.name.length>80||!Number.isFinite(n.x)||!Number.isFinite(n.y)||Math.abs(n.x)>10000||Math.abs(n.y)>10000)throw Error('Tên hoặc vị trí node chưa hợp lệ.');
   if(n.kind==='input'){
    if(!kinds.includes(n.dataType)||typeof n.required!=='boolean'||!Number.isInteger(n.maxFiles)||n.maxFiles<1||n.maxFiles>(n.dataType==='image'?8:1))throw Error(n.name+': loại đầu vào hoặc số tệp chưa hợp lệ.');
    if(n.imageRole!==undefined&&(n.dataType!=='image'||!['product','reference'].includes(n.imageRole)))throw Error(n.name+': vai trò ảnh chưa hợp lệ.');
    if(n.imageRole==='reference'&&n.maxFiles!==1)throw Error('Mỗi mẫu luồng dùng một ảnh nhân vật tham chiếu.');
    if(typeof n.defaultText!=='string'||n.defaultText.length>4000||!Array.isArray(n.defaultAssets)||n.defaultAssets.length>n.maxFiles||n.defaultAssets.some(id=>typeof id!=='string'||!id||id.length>200))throw Error(n.name+': giá trị mặc định chưa hợp lệ.');
   }else if(n.kind==='process'){
    if(!definitions[n.type]||!definitions[n.type].providers.includes(n.provider)||typeof n.prompt!=='string'||n.prompt.length>4000||n.workerId!==undefined&&(typeof n.workerId!=='string'||n.workerId.length>200))throw Error(n.name+': AI hoặc yêu cầu của bước chưa hợp lệ.');
   }else if(n.kind!=='output'||!kinds.includes(n.dataType))throw Error('Loại node không được hỗ trợ.');
  }
  if(f.nodes.filter(n=>isReference(f,n)).length>1&&f.nodes.some(n=>n.imageRole==='reference'))throw Error('Mỗi mẫu luồng chỉ có một đầu vào ảnh nhân vật tham chiếu.');
  const edges=new Set();for(const e of f.edges){if(!e||!validId(e.id)||edges.has(e.id)||!ids.has(e.from)||!ids.has(e.to)||typeof e.port!=='string')throw Error('Dây nối không còn đủ hai đầu hoặc mã bị trùng.');edges.add(e.id);}
  return true;
 }
 function order(f){
  const incoming=new Map(f.nodes.map(n=>[n.id,0])),next=new Map(f.nodes.map(n=>[n.id,[]]));
  for(const e of f.edges){incoming.set(e.to,incoming.get(e.to)+1);next.get(e.from).push(e.to);}
  const queue=f.nodes.filter(n=>incoming.get(n.id)===0).map(n=>n.id),result=[];
  while(queue.length){const id=queue.shift();result.push(id);for(const to of next.get(id)){incoming.set(to,incoming.get(to)-1);if(incoming.get(to)===0)queue.push(to);}}
  if(result.length!==f.nodes.length)throw Error('Luồng có vòng lặp. Xóa dây nối quay ngược để tiếp tục.');return result;
 }
 function validate(f){
  schema(f);if(f.execution==='single-tab'){const allowed=allowedProviders(f);if(!allowed.includes(f.provider)||f.nodes.some(n=>n.kind==='process'&&n.provider!=='local'&&n.provider!==f.provider))throw Error('Chọn một AI hỗ trợ toàn bộ các bước của luồng.');}
  const nodes=new Map(f.nodes.map(n=>[n.id,n])),outputs=f.nodes.filter(n=>n.kind==='output');
  if(outputs.length!==1)throw Error('Luồng cần đúng một node kết quả Z.');
  const seen=new Set();
  for(const e of f.edges){const a=nodes.get(e.from),b=nodes.get(e.to),p=ports(b)[e.port],key=e.from+'|'+e.to+'|'+e.port;
   if(a.kind==='output'||b.kind==='input'||!p||!compatible(outputType(a),p.type))throw Error('Dây nối '+a.name+' → '+b.name+' sai loại dữ liệu.');
   if(a.kind==='input'&&a.imageRole==='product'&&e.port==='characters')throw Error(a.name+': đổi Loại ảnh thành ảnh nhân vật tham chiếu trước khi nối cổng Nhân vật.');
   if(a.kind==='input'&&a.imageRole==='reference'&&e.port==='images')throw Error(a.name+': nối ảnh tham chiếu vào cổng Nhân vật; ảnh sản phẩm cần đầu vào riêng.');
   if(seen.has(key))throw Error('Dây nối bị trùng.');seen.add(key);
   if(!p.many&&f.edges.filter(x=>x.to===e.to&&x.port===e.port).length>1)throw Error(b.name+' · '+p.name+': chỉ nối một nguồn.');
   if(b.type==='video'&&e.port==='video'&&b.provider!=='muse')throw Error(b.name+': video gốc hiện cần AI Muse.');
  }
  const sorted=order(f),ancestors=new Set([outputs[0].id]);for(const id of [...sorted].reverse())if(ancestors.has(id))for(const e of f.edges.filter(e=>e.to===id))ancestors.add(e.from);
  for(const n of f.nodes){
   if(!ancestors.has(n.id))throw Error(n.name+': chưa có đường nối đến kết quả Z.');
   for(const [key,p]of Object.entries(ports(n)))if(p.required&&!f.edges.some(e=>e.to===n.id&&e.port===key))throw Error(n.name+': nối đầu vào '+p.name+' trước.');
   if(f.scenes>1&&['image','video'].includes(n.type)&&!f.edges.some(e=>e.to===n.id&&e.port==='script'))throw Error(n.name+': từ 2 cảnh cần nối cổng Kịch bản để giữ đúng từng cảnh.');
   if(n.type==='mix'){const source=nodes.get(f.edges.find(e=>e.to===n.id&&e.port==='video')?.from);if(source?.type==='video'&&f.scenes>1)throw Error(n.name+': ghép các cảnh thành một video trước khi thêm nhạc.');}
  }
  return sorted;
 }
 function connect(f,from,to,key){
  const a=f.nodes.find(n=>n.id===from),b=f.nodes.find(n=>n.id===to),p=b&&ports(b)[key];
  if(!a||!b||!p||!compatible(outputType(a),p.type))throw Error('Không nối được: hai cổng khác loại dữ liệu.');
  if(from===to||a.kind==='output'||b.kind==='input')throw Error('Không nối node vào chính nó hoặc nối ngược vào đầu vào.');
  if(f.edges.some(e=>e.from===from&&e.to===to&&e.port===key))return copy(f);
  const next=copy(f);if(!p.many)next.edges=next.edges.filter(e=>e.to!==to||e.port!==key);next.edges.push({id:uid(),from,to,port:key});order(next);return next;
 }
 function compile(f){
  const sorted=validate(f),flow=copy(f),byId=new Map(flow.nodes.map(n=>[n.id,n]));
  if(f.execution==='single-tab')for(const n of flow.nodes)if(n.kind==='process')delete n.workerId;
  const steps=sorted.map(id=>byId.get(id)).filter(n=>n.kind!=='input').map(n=>({id:n.id,type:n.kind==='output'?'graphResult':n.type,name:n.name,provider:n.kind==='output'?'local':n.provider,prompt:n.prompt||'',...(f.execution!=='single-tab'&&n.workerId?{workerId:n.workerId}:{}),bindings:Object.fromEntries(Object.keys(ports(n)).map(key=>[key,flow.edges.filter(e=>e.to===n.id&&e.port===key).map(e=>e.from)])),outputType:n.kind==='output'?n.dataType:outputType(n)}));
  return {schema:'mooz-flow-plan-v1',...(f.execution==='single-tab'?{execution:f.execution,provider:f.provider}:{}),id:f.id,name:f.name,version:f.version||1,ratio:f.ratio,scenes:f.scenes,duration:f.duration,flow,steps};
 }
 function validatePlan(plan){const expected=compile(plan.flow);for(const k of ['id','name','version','ratio','scenes','duration','steps',...(expected.execution?['execution','provider']:[])])if(JSON.stringify(plan[k])!==JSON.stringify(expected[k]))throw Error('Bản luồng đã chốt không khớp graph. Chọn lại luồng và xếp hàng.');return true;}
 function isReference(flow,n){return n.kind==='input'&&n.dataType==='image'&&(n.imageRole==='reference'||!n.imageRole&&flow.edges.some(e=>e.from===n.id&&e.port==='characters'));}
 function defaults(plan){return Object.fromEntries(plan.flow.nodes.filter(n=>n.kind==='input').map(n=>[n.id,{text:n.defaultText||'',assets:n.dataType==='image'&&!isReference(plan.flow,n)?[]:copy(n.defaultAssets||[])}]));}
 function validateValues(plan,values,getAsset){
  validatePlan(plan);if(!values||typeof values!=='object'||Array.isArray(values))throw Error('Chưa có dữ liệu đầu vào của tác vụ.');
  const nodes=new Map(plan.flow.nodes.map(n=>[n.id,n])),inputIds=new Set(plan.flow.nodes.filter(n=>n.kind==='input').map(n=>n.id));if(Object.keys(values).some(id=>!inputIds.has(id)))throw Error('Đầu vào không còn khớp mẫu luồng. Mở lại form để nhập theo mẫu mới.');
  for(const n of plan.flow.nodes.filter(n=>n.kind==='input')){
   const v=values[n.id];if(!v||typeof v.text!=='string'||v.text.length>4000||!Array.isArray(v.assets)||v.assets.some(id=>typeof id!=='string'||!id||id.length>200)||v.assets.length>n.maxFiles||new Set(v.assets).size!==v.assets.length)throw Error(n.name+': đầu vào chưa hợp lệ.');
   const empty=n.dataType==='text'?!v.text.trim():!v.assets.length;
   if(n.required&&empty)throw Object.assign(Error(n.name+': bắt buộc điền trước khi xếp hàng.'),{inputId:n.id});
   if(n.dataType==='text'&&v.assets.length||n.dataType!=='text'&&v.text)throw Error(n.name+': dữ liệu không đúng loại đầu vào.');
   if(getAsset)for(const id of v.assets){const a=getAsset(id);if(!a?.blob||a.deleted||a.kind!==n.dataType)throw Object.assign(Error(n.name+': tệp không còn trong kho hoặc sai loại. Chọn lại tệp.'),{inputId:n.id});}
   if(empty)for(const edge of plan.flow.edges.filter(e=>e.from===n.id)){const target=nodes.get(edge.to);if(ports(target)[edge.port]?.required)throw Object.assign(Error(n.name+': '+target.name+' cần đầu vào này. Điền hoặc sửa dây nối.'),{inputId:n.id});}
  }
  for(const n of plan.flow.nodes.filter(n=>n.kind==='process')){
   let refs=0;
   for(const e of plan.flow.edges.filter(e=>e.to===n.id&&['images','characters'].includes(e.port))){const src=nodes.get(e.from);refs+=src.kind==='input'?values[src.id].assets.length:1;}
   if(refs>8)throw Error(n.name+': tổng ảnh sản phẩm/cảnh và nhân vật vượt 8 ảnh.');
   if(n.type==='split'){const src=nodes.get(plan.flow.edges.find(e=>e.to===n.id&&e.port==='text').from);if(src.kind==='input')splitScript(values[src.id].text,plan);}
  }
  return true;
 }
 function splitScript(text,plan){
  let scenes;if(String(text).trim().startsWith('{')){try{scenes=JSON.parse(text).scenes;}catch{throw Error('Kịch bản JSON không hợp lệ.');}}
  else scenes=String(text).trim().split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean).map((s,i)=>({scene:i+1,title:'Cảnh '+(i+1),voiceover:s,imagePrompt:s,videoPrompt:s,duration:plan.duration,size:plan.ratio}));
  if(!Array.isArray(scenes)||scenes.length!==plan.scenes||scenes.some((s,i)=>s.scene!==i+1||!['voiceover','imagePrompt','videoPrompt'].every(k=>typeof s[k]==='string'&&s[k].trim()&&s[k].length<=4000)))throw Error('Kịch bản cần đúng '+plan.scenes+' cảnh; mỗi đoạn cách một dòng trống, hoặc JSON có voiceover/imagePrompt/videoPrompt.');
  return scenes.map(s=>({...s,duration:plan.duration,size:plan.ratio}));
 }
 function input(dataType='text',name='Đầu vào'){return {id:uid(),kind:'input',name,dataType,required:true,...(dataType==='image'?{imageRole:'product'}:{}),maxFiles:dataType==='image'?8:1,defaultText:'',defaultAssets:[],x:40,y:40};}
 function process(type='video'){const d=definitions[type];return {id:uid(),kind:'process',type,name:d.name,provider:d.providers[0],prompt:'',x:330,y:40};}
 function output(dataType='video'){return {id:uid(),kind:'output',name:'Z · Kết quả',dataType,x:620,y:40};}
 function layout(flow){const f=copy(flow);let sorted;try{sorted=order(f);}catch{sorted=f.nodes.map(n=>n.id);}let inputIndex=0,stepIndex=0;for(const id of sorted){const n=f.nodes.find(n=>n.id===id);if(n.kind==='input'){n.x=30;n.y=35+(inputIndex++)*185;}else{n.x=330+(stepIndex%3)*280;n.y=35+Math.floor(stepIndex/3)*330;stepIndex++;}}return f;}
 function preset(kind='video',name='Luồng 1'){
  const f={schema:'mooz-flow-v1',id:uid(),name,version:1,scenes:1,ratio:'9:16',duration:null,nodes:[],edges:[]};
  const add=n=>{f.nodes.push(n);return n;},wire=(a,b,p)=>f.edges.push({id:uid(),from:a.id,to:b.id,port:p});
  if(kind==='blank'){add(input('text','A · Yêu cầu'));add(output('video'));return layout(singleTab(f));}
  if(kind==='sales'){
   const a=add(input('image','A · Ảnh sản phẩm')),b=add(input('text','B · Prompt chung')),c=add(input('image','C · Nhân vật'));b.required=false;c.required=false;c.maxFiles=1;c.imageRole='reference';
   const v=add(process('vision')),s=add(process('text')),i=add(process('image')),m=add(process('video')),g=add(process('assemble')),z=add(output());
   wire(a,v,'images');wire(v,s,'context');wire(a,s,'images');wire(s,i,'script');wire(a,i,'images');wire(c,i,'characters');wire(i,m,'images');wire(s,m,'script');wire(b,m,'prompt');wire(c,m,'characters');wire(m,g,'videos');wire(g,z,'result');
  }else if(kind==='script'){
   const a=add(input('text','A · Kịch bản có sẵn')),c=add(input('image','B · Nhân vật'));c.required=false;c.maxFiles=1;c.imageRole='reference';const s=add(process('split')),i=add(process('image')),v=add(process('video')),g=add(process('assemble')),z=add(output());wire(a,s,'text');wire(s,i,'script');wire(c,i,'characters');wire(i,v,'images');wire(c,v,'characters');wire(s,v,'script');wire(v,g,'videos');wire(g,z,'result');
  }else if(kind==='write'){
   const a=add(input('text','A · Yêu cầu')),b=add(process('write')),z=add(output('text'));wire(a,b,'prompt');wire(b,z,'result');
  }else{
   const a=add(input('text','A · Prompt video')),c=add(input('image','B · Nhân vật'));c.required=false;c.maxFiles=1;c.imageRole='reference';const v=add(process('video')),g=add(process('assemble')),z=add(output());wire(a,v,'prompt');wire(c,v,'characters');wire(v,g,'videos');wire(g,z,'result');
  }
  return layout(singleTab(f));
 }
 function fromLegacy(w){
  const f=preset('sales',w.name||'Luồng 1');delete f.execution;delete f.provider;if(w.execution==='single-tab')f.provider=w.provider;f.scenes=w.scenes;f.ratio=w.ratio;f.duration=w.duration;
  f.nodes=f.nodes.filter(n=>n.kind!=='process');f.edges=[];
  const [a,b,c]=f.nodes.filter(n=>n.kind==='input'),z=f.nodes.find(n=>n.kind==='output');b.defaultText=w.commonVideoPrompt||'';c.defaultAssets=w.characterReferenceEnabled&&w.characterReferenceId?[w.characterReferenceId]:[];
  const wire=(from,to,port)=>f.edges.push({id:uid(),from:from.id,to:to.id,port});let context=null,script=null,image=null,video=null;
  for(const old of w.steps){const n={...process(old.type),id:old.id,name:old.name,provider:old.provider,prompt:old.prompt||'',...(old.workerId?{workerId:old.workerId}:{})};f.nodes.push(n);
   if(n.type==='vision'){wire(a,n,'images');context=n;}if(n.type==='text'){if(context)wire(context,n,'context');wire(a,n,'images');script=n;}
   if(n.type==='image'){wire(a,n,'images');wire(c,n,'characters');if(script)wire(script,n,'script');image=n;}
   if(n.type==='video'){wire(image||a,n,'images');wire(c,n,'characters');wire(b,n,'prompt');if(script)wire(script,n,'script');video=n;}
   if(n.type==='assemble'){if(video)wire(video,n,'videos');wire(n,z,'result');}
  }
  // Remove optional inputs with no consumers in unusual legacy flows.
  f.nodes=f.nodes.filter(n=>n.kind!=='input'||f.edges.some(e=>e?.from===n.id));return layout(singleTab(f));
 }
 const api={copy,types,kinds,definitions,outputType,ports,compatible,allowedProviders,singleTab,schema,order,validate,connect,compile,validatePlan,isReference,defaults,validateValues,splitScript,input,process,output,layout,preset,fromLegacy};
 if(typeof module!=='undefined')module.exports=api;else root.MooZFlowGraph=api;
})(globalThis);
