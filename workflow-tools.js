/* Shared definitions and deterministic validation for the production tools. */
(() => {
 const text={id:'text',label:'Văn bản',type:'text'},image={id:'image',label:'Ảnh',type:'image'};
 const definitions={
  characterLock:{title:'Khóa nhân vật',inputs:[image],outputs:[image,text]},
  imageRoles:{title:'Gán vai trò ảnh',inputs:['character','background','clothing','pose'].map((id,i)=>({id,label:['Nhân vật','Bối cảnh','Trang phục','Tư thế'][i],type:'image'})),outputs:[image]},
  sceneSplit:{title:'Chia cảnh tự động',inputs:[{id:'prompt',label:'Kịch bản',type:'text'}],outputs:[text]},
  review:{title:'Duyệt trước khi chạy',inputs:[{id:'prompt',label:'Prompt',type:'text'},{id:'reference',label:'Ảnh',type:'image'},{id:'video',label:'Video',type:'video'}],outputs:[text,image,{id:'video',label:'Video',type:'video'}]},
  qualityCheck:{title:'Kiểm tra kết quả',inputs:[{id:'media',label:'Ảnh/video',type:'media'}],outputs:[text,{id:'media',label:'Ảnh/video',type:'media'}]},
  bundleSave:{title:'Lưu theo bộ',inputs:[{id:'media',label:'Ảnh/video',type:'media'},text],outputs:[text]}
 };
 const aliases={videoAnalysis:'Phân tích video',promptVariants:'Biến thể prompt'};
 function rules(data){
  if(data.toolKind==='videoAnalysis')return 'Phân tích video gốc được đính kèm. Không suy đoán nội dung không nhìn thấy. Trả lời bằng tiếng Việt, chia rõ: nhân vật, trang phục, bối cảnh, hành động, máy quay, ánh sáng, âm thanh và các mốc thời gian. Cuối cùng viết prompt tái tạo. Nêu rõ nếu không đọc được video.';
  if(data.toolKind==='promptVariants'){const count=Math.min(10,Math.max(2,Math.floor(Number(data.variantCount)||3)));return `Viết ${count} biến thể prompt độc lập, đánh số rõ ràng; giữ các yêu cầu và ID nhân vật/ảnh. Thay đổi theo định hướng: ${String(data.variationStyle||'góc máy, ánh sáng và bối cảnh')}. Không khẳng định đã tạo ảnh/video. Trả đúng JSON {"variants":["prompt 1","prompt 2",...]} không kèm giải thích.`;}
  return '';
 }
 function assess(info,settings){
  const checks=[];const ratio=String(settings.expectedRatio||'').split(':').map(Number);
  if(settings.expectedRatio&&!/^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/.test(settings.expectedRatio))throw new Error('Tỷ lệ phải có dạng 16:9 hoặc 9:16.');
  if(settings.expectedRatio&&(!ratio.every(v=>v>0)||ratio.length!==2))throw new Error('Tỷ lệ phải lớn hơn 0.');
  if(Number(settings.expectedDuration)<0)throw new Error('Thời lượng không được âm.');
  if(ratio.length===2&&ratio.every(v=>v>0))checks.push({name:'Tỷ lệ',pass:Math.abs(info.width/info.height-ratio[0]/ratio[1])/(ratio[0]/ratio[1])<=.03,actual:`${info.width}×${info.height}`,expected:settings.expectedRatio});
  if(info.kind==='video'){
   if(Number(settings.expectedDuration)>0)checks.push({name:'Thời lượng',pass:Number.isFinite(info.duration)&&Math.abs(info.duration-Number(settings.expectedDuration))<=.5,actual:info.duration,expected:Number(settings.expectedDuration)});
   if(settings.requireAudio!==false)checks.push({name:'Luồng âm thanh',pass:info.hasAudio===true,actual:info.hasAudio===true?'Có luồng âm thanh':'Không có luồng âm thanh'});
  }
  return {passed:checks.every(c=>c.pass),info,checks,note:'Kiểm tra kỹ thuật. Có luồng âm thanh không chứng minh nghe rõ hoặc đúng nội dung. Không đánh giá khuôn mặt/hành động bằng kiểm tra này.'};
 }
 function safeName(value){return String(value||'Workflow').normalize('NFC').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/\.{2,}/g,'_').replace(/[. ]+$/g,'').slice(0,90)||'Workflow';}
 function variants(text){
  const raw=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  try{const parsed=JSON.parse(raw),values=Array.isArray(parsed)?parsed:parsed.variants;if(Array.isArray(values)&&values.length>=2&&values.length<=10&&values.every(v=>typeof v==='string'&&v.trim()))return values.map(v=>v.trim());}catch{}
  const headings=[...raw.matchAll(/^\s*(?:#{1,6}\s*)?(?:Biến thể\s*)?\d+[.):]\s+/gim)];if(headings.length<2)return [];
  return headings.slice(0,10).map((m,i)=>raw.slice(m.index+m[0].length,headings[i+1]?.index??raw.length).trim()).filter(Boolean);
 }
 globalThis.WorkflowTools={definitions,aliases,rules,assess,safeName,variants};
})();
