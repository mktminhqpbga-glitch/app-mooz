/* Pure contracts for the production composer; no provider calls here. */
(function(root){'use strict';
 const providers={muse:'Muse',grok:'Grok',flow:'Google Flow / Veo'};
 function prompts(text,eachLine=true){
  const rows=(eachLine?String(text||'').split(/\r?\n/):[String(text||'')]).map(s=>s.trim()).filter(Boolean);
  if(!rows.length)throw Error('Nhập ít nhất một yêu cầu tạo video.');
  if(rows.length>100)throw Error('Một lượt tối đa 100 yêu cầu.');
  if(rows.some(s=>s.length>4000))throw Error('Mỗi yêu cầu tối đa 4.000 ký tự.');
  return rows;
 }
 function textPlan(prompt,{provider='muse',ratio='9:16',duration=null}={}){
  if(!providers[provider])throw Error('Chọn AI có hỗ trợ tạo video.');
  if(!['9:16','16:9','1:1'].includes(ratio)||duration!==null&&![5,10,15,30,40].includes(duration))throw Error('Tỷ lệ hoặc thời lượng không hợp lệ.');
  const [text]=prompts(prompt,false);
  return {id:'text-video',name:'Văn bản → Video',version:1,ratio,duration,scenes:1,steps:[{id:'video',type:'video',name:'Tạo video',provider,prompt:text},{id:'assemble',type:'assemble',name:'Lưu thành phẩm',provider:'local',prompt:''}]};
 }
 function draft(value={}){return {mode:['images','frames','extend'].includes(value.mode)?value.mode:'text',firstFrame:typeof value.firstFrame==='string'?value.firstFrame:'',lastFrame:typeof value.lastFrame==='string'?value.lastFrame:'',sourceVideo:typeof value.sourceVideo==='string'?value.sourceVideo:'',text:String(value.text||''),note:String(value.note||''),eachLine:value.eachLine!==false,provider:providers[value.provider]?value.provider:'muse',ratio:['9:16','16:9','1:1'].includes(value.ratio)?value.ratio:'9:16',duration:[5,10,15,30,40].includes(value.duration)?value.duration:null};}
 const api={providers,prompts,textPlan,draft};if(typeof module!=='undefined')module.exports=api;else root.MooZBatchComposer=api;
})(globalThis);
