/* Execute only explicitly wired sources from a frozen task plan. */
(function(root){'use strict';
 const G=typeof module!=='undefined'?require('./flow-graph.js'):root.MooZFlowGraph;
 function create({asset,dataURL,saveResult,generate,processLocal,parseScenes,controllers=new Map()}){
  return async function run(j,step,worker,checkpoint){
   const plan=j.plan,inputs=j.flowInputSnapshot,byId=new Map(plan.flow.nodes.map(n=>[n.id,n]));
   j.outputs||={};const out=j.outputs[step.id]||(j.outputs[step.id]={items:[]});
   const value=id=>{const n=byId.get(id);if(!n)throw Error('Dây nối trỏ đến node không tồn tại.');if(n.kind==='input'){const v=inputs[id];if(!v)throw Error('Thiếu đầu vào đã chốt: '+n.name);return {type:n.dataType,text:v.text,items:v.assets,perScene:false};}const v=j.outputs[id];if(!v)throw Error('Bước nguồn '+n.name+' chưa hoàn tất.');return {type:G.outputType(n),...v};};
   const sources=port=>(step.bindings[port]||[]).map(id=>({id,name:byId.get(id).name,...value(id)}));
   const text=port=>sources(port).map(s=>s.text||'').filter(Boolean).join('\n\n');
   const files=(port,scene=null)=>sources(port).flatMap(s=>s.perScene&&scene!==null?[s.items[scene]].filter(Boolean):s.items||[]).map(id=>{const a=asset(id);if(!a?.blob)throw Error('Không đọc được tệp đã chốt của node nguồn.');return a;});
   const store=async(blob,kind,name)=>{checkpoint();const a=await saveResult(blob,kind,name);checkpoint();return a;};
   const local=async(type,data)=>{const controller=new AbortController();controllers.set(j.id,controller);try{const result=await processLocal(type,data,controller.signal,message=>j.localProgress=message);checkpoint();return result;}finally{controllers.delete(j.id);}};
   if(step.type==='graphResult'){
    if(out.items.length)return {resultId:out.items[0]};const source=sources('result')[0];if(!source)throw Error('Chưa nối kết quả Z.');
    if(step.outputType==='text'){
     const content=source.text||JSON.stringify({scenes:source.rows||[]},null,2);if(!content.trim())throw Error('Kết quả văn bản trống.');const a=await store(new Blob([content],{type:'text/plain;charset=utf-8'}),'text',j.sku+'-ket-qua.txt');out.items=[a.id];out.text=content;
    }else{for(const a of files('result')){checkpoint();const saved=a.origin==='result'?a:await store(a.blob,a.kind,j.sku+'-ket-qua-'+(out.items.length+1)+'.'+(a.name.split('.').pop()||step.outputType));out.items.push(saved.id);checkpoint();}if(!out.items.length)throw Error('Kết quả Z chưa có tệp.');}
    return {resultId:out.items[0]};
   }
   if(step.type==='split'){
    if(out.rows)return {};out.rows=G.splitScript(text('text'),plan);out.text=JSON.stringify({scenes:out.rows});out.items=['text'];checkpoint();return {};
   }
   if(['assemble','mix'].includes(step.type)){
    if(out.items.length)return {};const videos=files(step.type==='assemble'?'videos':'video');
    if(!videos.length||videos.length>12)throw Error('Cần từ 1 đến 12 clip đã lưu để xử lý.');
    let result;
    if(step.type==='mix'){
     if(videos.length!==1)throw Error('Ghép các cảnh thành một video trước khi thêm nhạc.');const audios=files('audio');if(audios.length>1)throw Error('Chọn một tệp nhạc hoặc lời đọc.');
     if(!audios.length){out.items=[videos[0].id];checkpoint();return {};}
     result=await local('audioMix',{videos,audios,settings:{musicVolume:.4,originalVolume:1,loop:true}});
    }else result=await local('videoAssembly',{videos});
    const a=await store(result.blob,'video',j.sku+'-'+(step.type==='mix'?'co-nhac':'ghep-canh')+'.mp4');out.items=[a.id];out.perScene=false;checkpoint();return {};
   }
   const count=['image','video'].includes(step.type)?plan.scenes:1,mediaType=['vision','text','write'].includes(step.type)?'text':step.type;
   if(step.type==='text'&&out.rawText&&!out.rows){out.rows=parseScenes(out.rawText,plan);out.text=out.rawText;out.items=['text'];checkpoint();return {};}
   for(let scene=out.items.length;scene<count;scene++){
    checkpoint();const photos=files('images',scene),characters=files('characters',scene),videos=files('video',scene);
    if(photos.length+characters.length>8)throw Error(step.name+': tổng ảnh sản phẩm/cảnh và nhân vật vượt 8 ảnh.');
    if(videos.length>1)throw Error('Mỗi lượt chỉ gửi một video gốc.');
    const script=sources('script')[0],rows=script?.rows,current=rows?.[scene];if(script&&(!rows||rows.length!==plan.scenes||!current))throw Error('Kịch bản nguồn chưa đủ đúng các cảnh.');
    const prompt=[step.prompt||({vision:'Phân tích chính xác đặc điểm quan sát được của sản phẩm.',text:'Viết kịch bản tiếng Việt cho đúng sản phẩm. Không tự tạo giá hoặc công dụng.',write:'Viết nội dung theo yêu cầu và dữ kiện được cung cấp.',image:'Tạo ảnh theo yêu cầu; giữ đúng nhận diện sản phẩm và nhân vật.',video:'Tạo video theo yêu cầu; chuyển động tự nhiên, giữ đúng sản phẩm.'})[step.type],text('prompt'),text('context')?'NGỮ CẢNH TỪ NODE ĐÃ NỐI:\n'+text('context'):'',step.type==='text'?root.MooZBatchModel?.scriptInstructions(plan)||require('./model.js').scriptInstructions(plan):'',current?'CHỈ DÙNG CẢNH HIỆN TẠI: '+JSON.stringify({scene:current.scene,title:current.title,...(step.type==='image'?{imagePrompt:current.imagePrompt}:{videoPrompt:current.videoPrompt,voiceover:current.voiceover})}):'',characters.length?`VAI TRÒ ẢNH: ${photos.length?'Ảnh 1 đến '+photos.length+' là ảnh sản phẩm hoặc ảnh của đúng cảnh. ':''}Ảnh ${photos.length+1}${characters.length>1?' đến '+(photos.length+characters.length):''} là NHÂN VẬT THAM CHIẾU; giữ nhất quán nhận diện khi nhân vật xuất hiện, không thay sản phẩm bằng ảnh nhân vật.`:'',`Tỷ lệ ${plan.ratio}.`,count>1?`Chỉ tạo một ${mediaType==='image'?'ảnh':'video'} cho cảnh ${scene+1}/${count}.`:'',step.type==='video'&&plan.duration!==null?`Thời lượng yêu cầu ${plan.duration} giây.`:'',videos.length?'Tạo đoạn tiếp nối từ cuối video gốc được đính kèm.':''].filter(Boolean).join('\n\n');
    if(prompt.length>50000)throw Error('Nội dung nối vào bước vượt 50.000 ký tự. Rút ngắn nội dung trước khi chạy.');
    j.localProgress=step.name+' · '+(scene+1)+'/'+count;
    const result=await generate({workerId:worker.id,mediaType,prompt,referenceImages:await Promise.all([...photos,...characters].map(dataURL)),referenceVideos:await Promise.all(videos.map(dataURL)),size:plan.ratio,...(step.type==='video'&&plan.duration!==null?{duration:plan.duration}:{})});checkpoint();
    if(mediaType==='text'){
     out.rawText=result.text;checkpoint();if(step.type==='text')out.rows=parseScenes(result.text,plan);out.text=result.text;out.items.push('text');
    }else{const response=await fetch(result.dataUrl),blob=await response.blob();const a=await store(blob,mediaType,j.sku+'-'+step.id+'-canh-'+(scene+1)+'.'+(mediaType==='image'?(blob.type.split('/')[1]||'png'):blob.type.includes('webm')?'webm':'mp4'));out.items.push(a.id);out.perScene=true;}
    checkpoint();
   }
   return {};
  };
 }
 const api={create};if(typeof module!=='undefined')module.exports=api;else root.MooZFlowRunner=api;
})(globalThis);
