/* A strict, local contract for AI scripts. Never evaluates code or calls an AI. */
(function(root){'use strict';
 const roles={scene:'Số cảnh',title:'Tiêu đề',voiceover:'Lời thoại',imagePrompt:'Prompt ảnh',videoPrompt:'Prompt video',duration:'Thời lượng',size:'Tỷ lệ'};
 const unsafe=new Set(['__proto__','prototype','constructor']);
 const defaults=()=>({root:'scenes',keys:{scene:'scene',title:'title',voiceover:'voiceover',imagePrompt:'imagePrompt',videoPrompt:'videoPrompt',duration:'duration',size:'size'},requireVoice:true,requireImage:true,requireVideo:true,strictOrder:true,allowExtra:true,maxScenes:50,defaultSize:'9:16',rules:'Giữ nguyên nội dung từng cảnh. Không gộp, bỏ cảnh hoặc tự viết thêm lời thoại. Prompt ảnh và video phải thuộc đúng cảnh.'});
 function config(value=defaults()){
  if(!value||typeof value!=='object'||Array.isArray(value)||!value.keys)throw Error('Cấu trúc chưa hợp lệ.');
  const validName=(v,empty=false)=>typeof v==='string'&&(empty&&!v||/^[\p{L}_][\p{L}\p{N}_ -]{0,59}$/u.test(v))&&!unsafe.has(v);
  if(!validName(value.root,true))throw Error('Tên mảng cảnh không hợp lệ. Dùng tên trường đơn, hoặc để trống cho JSON dạng mảng.');
  const keys={};for(const role of Object.keys(roles)){const v=value.keys[role];if(!validName(v,!['scene','title'].includes(role)))throw Error('Tên trường '+roles[role]+' không hợp lệ.');keys[role]=v;}
  const names=Object.values(keys).filter(Boolean);if(new Set(names).size!==names.length)throw Error('Mỗi phần cần một tên trường riêng; đang có tên trùng nhau.');
  for(const k of ['requireVoice','requireImage','requireVideo','strictOrder','allowExtra'])if(typeof value[k]!=='boolean')throw Error('Thiếu lựa chọn '+k+'.');
  for(const [flag,role]of [['requireVoice','voiceover'],['requireImage','imagePrompt'],['requireVideo','videoPrompt']])if(value[flag]&&!keys[role])throw Error('Điền tên trường '+roles[role]+' khi bắt buộc phần này.');
  if(!Number.isInteger(value.maxScenes)||value.maxScenes<1||value.maxScenes>50)throw Error('Giới hạn từ 1 đến 50 cảnh.');
  if(!['9:16','16:9','1:1'].includes(value.defaultSize))throw Error('Tỷ lệ mặc định chưa hợp lệ.');
  if(typeof value.rules!=='string'||value.rules.length>12000)throw Error('Quy tắc tối đa 12.000 ký tự.');
  return {root:value.root,keys,...Object.fromEntries(['requireVoice','requireImage','requireVideo','strictOrder','allowExtra','maxScenes','defaultSize','rules'].map(k=>[k,value[k]]))};
 }
 const configKey=v=>JSON.stringify(config(v));
 function strictJSON(raw){
  let i=0;const error=m=>{throw Error(m+' (vị trí '+(i+1)+').');},space=()=>{while(/[\t\n\r ]/.test(raw[i]||'x'))i++;};
  function string(){const start=i++;while(i<raw.length){if(raw[i]==='\\'){i+=2;continue;}if(raw[i++]==='"'){try{return JSON.parse(raw.slice(start,i));}catch{error('Chuỗi JSON không hợp lệ');}}}error('Chuỗi JSON chưa đóng');}
  function value(depth){if(depth>16)error('JSON lồng quá nhiều cấp');space();const c=raw[i];
   if(c==='"')return string();
   if(c==='{'||c==='['){const object=c==='{',end=object?'}':']',out=object?Object.create(null):[];i++;space();if(raw[i]===end){i++;return out;}while(i<raw.length){let key;if(object){if(raw[i]!=='"')error('Tên trường phải nằm trong dấu nháy kép');key=string();if(unsafe.has(key))error('Tên trường không được phép');if(Object.hasOwn(out,key))error('Trường JSON bị lặp: '+key);space();if(raw[i++]!==':')error('Thiếu dấu hai chấm');}const v=value(depth+1);if(object)out[key]=v;else out.push(v);space();const next=raw[i++];if(next===end)return out;if(next!==',')error('Thiếu dấu phẩy hoặc dấu đóng');space();}error('JSON chưa đóng đầy đủ');}
   for(const [token,result]of [['true',true],['false',false],['null',null]])if(raw.startsWith(token,i)){i+=token.length;return result;}
   const m=/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(raw.slice(i));if(m){i+=m[0].length;const n=Number(m[0]);if(!Number.isFinite(n)||Number.isInteger(n)&&!Number.isSafeInteger(n))error('Số JSON vượt giới hạn');return n;}error('JSON không hợp lệ');
  }
  const result=value(0);space();if(i!==raw.length)error('Có nội dung ngoài JSON');return result;
 }
 function parse(text,settings){
  const c=config(settings);if(typeof text!=='string'||!text.trim()||text.length>200000)throw Error('Câu trả lời cần từ 1 đến 200.000 ký tự.');
  let raw=text.trim();if(raw.startsWith('```')){const m=/^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/i.exec(raw);if(!m)throw Error('Khối JSON chưa đầy đủ hoặc còn nội dung ngoài khối.');raw=m[1];}
  const doc=strictJSON(raw);const entries=c.root?doc&&typeof doc==='object'&&!Array.isArray(doc)&&doc[c.root]:doc;
  if(!Array.isArray(entries))throw Error(c.root?'Cần mảng "'+c.root+'" trong JSON.':'Cần JSON dạng mảng.');
  if(!entries.length||entries.length>c.maxScenes)throw Error('Cần từ 1 đến '+c.maxScenes+' cảnh.');
  const ids=new Set(),rows=entries.map((entry,index)=>{
   const where='Cảnh ở dòng '+(index+1)+': ';if(!entry||typeof entry!=='object'||Array.isArray(entry))throw Error(where+'cần một đối tượng JSON.');
   if(!c.allowExtra){const extra=Object.keys(entry).filter(k=>!Object.values(c.keys).includes(k));if(extra.length)throw Error(where+'có trường ngoài cấu trúc: '+extra.join(', '));}
   const get=role=>c.keys[role]?entry[c.keys[role]]:undefined;
   const id=get('scene');if(!Number.isSafeInteger(id)||id<1||ids.has(id))throw Error(where+'số cảnh phải là số nguyên dương, không trùng.');ids.add(id);if(c.strictOrder&&id!==index+1)throw Error(where+'số cảnh phải lần lượt từ 1, không thiếu cảnh.');
   const field=(role,required)=>{const v=get(role);if(v===undefined||v===null){if(required)throw Error(where+'thiếu '+roles[role]+'.');return '';}if(typeof v!=='string'||v.length>(role==='title'?200:20000)||required&&!v.trim())throw Error(where+roles[role]+' phải là văn bản'+(required?' không trống':'')+', tối đa '+(role==='title'?200:20000)+' ký tự.');return v;};
   const duration=get('duration');if(duration!==undefined&&duration!==null&&(typeof duration!=='number'||!Number.isFinite(duration)||duration<=0||duration>120))throw Error(where+'thời lượng phải là số lớn hơn 0 đến 120, hoặc null.');
   const size=get('size')??c.defaultSize;if(!['9:16','16:9','1:1'].includes(size))throw Error(where+'tỷ lệ chưa hợp lệ.');
   return {scene:id,title:field('title',true),voiceover:field('voiceover',c.requireVoice),imagePrompt:field('imagePrompt',c.requireImage),videoPrompt:field('videoPrompt',c.requireVideo),duration:duration??null,size,original:entry};
  });return {rows,document:doc,text:JSON.stringify(doc,null,2)};
 }
 function instructions(settings){const c=config(settings),sample={};for(const role of Object.keys(roles))if(c.keys[role])sample[c.keys[role]]=({scene:1,title:'Tên cảnh',voiceover:'Lời thoại của cảnh',imagePrompt:'Prompt tạo ảnh của cảnh',videoPrompt:'Prompt tạo video của cảnh',duration:null,size:c.defaultSize})[role];const doc=c.root?{[c.root]:[sample]}:[sample];return 'Chỉ trả một JSON đầy đủ theo cấu trúc dưới đây, không kèm lời dẫn.\n'+JSON.stringify(doc,null,2)+'\n\nQUY TẮC:\n- Mỗi cảnh là một đối tượng. Tối đa '+c.maxScenes+' cảnh.\n- Số cảnh là số nguyên dương không trùng'+(c.strictOrder?', lần lượt từ 1, không bỏ số.':'.')+'\n- Giữ đúng tên trường; không dùng tên hiển thị khác.\n- '+['Tiêu đề',...(c.requireVoice?['Lời thoại']:[]),...(c.requireImage?['Prompt ảnh']:[]),...(c.requireVideo?['Prompt video']:[])].join(', ')+' bắt buộc là văn bản không trống.\n- Thời lượng là số giây hoặc null nếu không yêu cầu.\n'+c.rules;}
 function approve(data){data.approvedConfig=configKey(data.splitConfig||defaults());invalidate(data);return data.approvedConfig;}
 function invalidate(data){delete data.splitRows;delete data.resultInput;delete data.resultConfig;delete data.reviewedResult;data.text='';data.status='idle';data.error='';data.report='';}
 function run(data,input){const c=data.splitConfig||defaults(),key=configKey(c);if(data.approvedConfig!==key)throw Error('Xác nhận cấu trúc và quy tắc trước khi tách.');const result=parse(input,c);data.splitRows=result.rows;data.resultInput=input;data.resultConfig=key;delete data.reviewedResult;data.text=result.text;data.status='success';data.error='';data.report='Đã tách '+result.rows.length+' cảnh. Xem và xác nhận kết quả trước khi tạo node.';return result.rows;}
 function fresh(data,input){try{return !!data.splitRows?.length&&data.resultInput===input&&data.resultConfig===configKey(data.splitConfig||defaults())&&data.approvedConfig===data.resultConfig;}catch{return false;}}
 const api={roles,defaults,config,configKey,parse,instructions,approve,invalidate,run,fresh};if(typeof module!=='undefined')module.exports=api;else root.WorkflowScriptSplitter=api;
})(globalThis);
