/* Shared by the preview and workflow builder: estimates are not real voice durations. */
(function(root){
 function parse(value){
  if(typeof value!=='string'||value.length>12000)throw Error('Kịch bản cần tối đa 12.000 ký tự.');
  const paragraphs=value.trim().replace(/\r\n?/g,'\n').split(/\n\s*\n|\n(?=(?:CẢNH|Canh|Scene)\s+\d+)/i).map(s=>s.trim()).filter(Boolean);
  if(paragraphs.length>12||paragraphs.some(s=>s.length>1800))throw Error('Tối đa 12 cảnh, mỗi cảnh 1.800 ký tự; tách các cảnh bằng một dòng trống.');
  return paragraphs;
 }
 function measure(narration){const words=narration.trim().split(/\s+/).filter(Boolean).length,spokenSeconds=Math.ceil(words/2.5);return {words,characters:narration.length,spokenSeconds,seconds:Math.max(4,Math.min(15,spokenSeconds))};}
 function analyse(script){const scenes=parse(script).map((narration,i)=>({id:i+1,narration,...measure(narration)}));return {scenes,seconds:scenes.reduce((n,s)=>n+s.seconds,0),spokenSeconds:scenes.reduce((n,s)=>n+s.spokenSeconds,0),characters:scenes.reduce((n,s)=>n+s.characters,0),words:scenes.reduce((n,s)=>n+s.words,0)};}
 const api={parse,measure,analyse};if(typeof module==='object'&&module.exports)module.exports=api;else root.WorkflowAffiliateScript=api;
})(globalThis);
