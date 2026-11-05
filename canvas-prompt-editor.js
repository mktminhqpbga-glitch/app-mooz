/* Floating prompt composer backed by the real canvas graph and tab runner. */
(function(root){
 'use strict';
 const supported=new Set(['prompt','negativePrompt','generateText','generateImage','generateVideo']),drafts=new Map();
 const $=id=>document.getElementById(id),make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
 let dialog,state=null,saveTimer,sequence=0;
 const api=()=>root.MooZCanvasStudio;
 function button(text,cls,fn){const b=make('button',cls,text);b.type='button';b.onclick=fn;return b;}
 function node(id){return api().snapshot().nodes.find(n=>n.id===id);}
 function message(text,error=false){const status=$('canvasPromptStatus');status.textContent=text||'';status.classList.toggle('error',error);}
 function remember(s){drafts.set(s.id,Object.fromEntries(Object.entries(s.draft).filter(([,value])=>value!==undefined)));}
 function change(patch){
  const s=state;if(!s||s.running)return;
  Object.assign(s.draft,patch);Object.assign(s.pending,patch);remember(s);message('Đang lưu…');clearTimeout(saveTimer);
  saveTimer=setTimeout(()=>{void flush(s).catch(()=>{});},180);
 }
 async function flush(s=state){
  clearTimeout(saveTimer);if(!s)return;const patch=s.pending;s.pending={};
  if(Object.keys(patch).length){
   s.writes=s.writes.catch(()=>{}).then(async()=>{
    try{await api().action('updateNode',{id:s.id,patch});if(state===s)message('Đã lưu');}
    catch(error){s.pending={...patch,...s.pending};remember(s);if(state===s)message(error.message||'Chưa lưu được bản nháp.',true);throw error;}
   });
  }
  await s.writes;
 }
 async function close(){
  const s=state;if(!s)return;
  try{await flush(s);if(!Object.keys(s.pending).length)drafts.delete(s.id);}catch{}
  if(state===s){dialog.close();state=null;}
 }
 const compatible=(output,input)=>output===input||input==='media'&&['image','video','audio','media'].includes(output);
 function findPair(source,target){for(const out of source.outputs||[]){const input=(target.inputs||[]).find(p=>compatible(out.type,p.type));if(input)return {source:source.id,sourcePort:out.id,target:target.id,targetPort:input.id};}return null;}
 function media(n,port){
  if(n.type==='referenceBoard'){
   const slot=/^image(\d+)$/.exec(port||''),images=(n.data?.referenceImages||[]).filter(r=>r.enabled!==false&&(!slot||r.slot===Number(slot[1])));
   return images.map(r=>({kind:'image',url:r.url,name:r.name||n.title}));
  }
  const asset=port==='endFrame'?n.data?.endFrame:n.media||n.data?.asset;
  return asset?.url?[{...asset,name:asset.name||n.title}]:[];
 }
 function thumbnail(asset){
  const visual=make(asset.kind==='video'?'video':'img');
  visual.src=asset.url;if(asset.kind==='video'){visual.preload='metadata';visual.muted=true;visual.setAttribute('playsinline','');}
  else visual.alt=asset.name||'Ảnh tham chiếu';return visual;
 }
 function renderReferences(){
  if(!state)return;const snapshot=api().snapshot(),sources=new Map(snapshot.nodes.map(n=>[n.id,n])),host=$('canvasPromptReferences');host.replaceChildren();let count=0;
  for(const edge of snapshot.edges.filter(e=>e.target===state.id)){
   const source=sources.get(edge.source);if(!source)continue;
   const assets=media(source,edge.sourcePort),label=source.title||'Nguồn đã nối';
   for(const asset of assets.slice(0,8-count)){
    if(!['image','video'].includes(asset.kind))continue;
    const tile=button('', 'canvas-prompt-reference',()=>{api().select([source.id]);void api().action('focus',{ids:[source.id]});});tile.title=label;tile.setAttribute('aria-label','Xem nguồn '+label);tile.append(thumbnail(asset));host.append(tile);count++;
   }
   if(!assets.length){const chip=make('span','canvas-prompt-source',label);chip.title='Nguồn đã nối vào prompt';host.append(chip);}
  }
  host.hidden=!host.childElementCount;
 }
 function renderChooser(){
  if(!state)return;const target=node(state.id),snapshot=api().snapshot(),host=$('canvasPromptSourceList');host.replaceChildren();
  const query=$('canvasPromptSourceSearch').value.toLocaleLowerCase('vi');
  for(const source of snapshot.nodes){
   if(source.id===target.id||query&&!(source.title||'').toLocaleLowerCase('vi').includes(query))continue;
   const edge=findPair(source,target);if(!edge)continue;
   const row=button('','canvas-prompt-source-choice',async()=>{
    if(!state||state.running)return;row.disabled=true;
    try{await flush();await api().connect(edge);$('canvasPromptSourceChooser').hidden=true;renderReferences();message('Đã nối nguồn tham chiếu.');}
    catch(error){message(error.message,true);}finally{if(row.isConnected)row.disabled=false;}
   });
   const asset=media(source,edge.sourcePort)[0];if(asset&&['image','video'].includes(asset.kind))row.append(thumbnail(asset));else row.append(make('span','canvas-prompt-source-type',(source.outputs||[]).find(p=>p.id===edge.sourcePort)?.type==='text'?'T':'↗'));
   const text=make('span');text.append(make('strong','',source.title),make('small','',(target.inputs||[]).find(p=>p.id===edge.targetPort)?.label||edge.targetPort));row.append(text);host.append(row);
  }
  if(!host.childElementCount)host.append(make('p','canvas-prompt-empty','Chưa có nguồn phù hợp trên canvas.'));
 }
 function refreshFields(n){
  const s=state,kind=n.type==='generateVideo'?'video':n.type==='generateImage'?'image':'text',isPrompt=['prompt','negativePrompt'].includes(n.type);
  $('canvasPromptTitle').textContent=isPrompt?(n.type==='negativePrompt'?'Loại trừ':'Prompt'):kind==='video'?'Tạo video':kind==='image'?'Tạo ảnh':'Tạo văn bản';
  $('canvasPromptText').value=s.draft[s.field]||'';
  $('canvasPromptText').placeholder=isPrompt?(n.type==='negativePrompt'?'Nhập nội dung cần loại trừ…':'Nhập prompt dùng chung…'):'Nhập yêu cầu cho bước này…';
  const provider=$('canvasPromptProvider');provider.replaceChildren();provider.append(new Option('Chọn AI…',''));
  for(const item of api().snapshot().providers.filter(p=>p.types?.includes(kind)))provider.append(new Option(item.name,item.id));
  provider.value=s.draft.provider||(n.type==='generateText'?'gemini':'muse');provider.hidden=isPrompt;
  const size=$('canvasPromptSize');size.replaceChildren();for(const ratio of kind==='video'?['16:9','9:16','1:1']:['1:1','16:9','9:16','4:3','3:4'])size.append(new Option(ratio,ratio));
  size.value=s.draft.size||(kind==='video'?'16:9':'1:1');size.hidden=isPrompt||kind==='text';
  const duration=$('canvasPromptDuration'),choices=[5,10,15,30,40];duration.replaceChildren(new Option('Tự chọn thời lượng',''));
  if(Number.isFinite(s.draft.duration)&&s.draft.duration>0&&!choices.includes(s.draft.duration))choices.push(s.draft.duration);
  choices.sort((a,b)=>a-b).forEach(value=>duration.append(new Option(value+' giây',String(value))));duration.value=s.draft.duration==null?'':String(s.draft.duration);duration.hidden=kind!=='video'||isPrompt;
  $('canvasPromptInputLabel').textContent=isPrompt?'Văn bản đầu vào':'Yêu cầu';
  $('canvasPromptSubmit').title=isPrompt?'Lưu prompt':kind==='video'?'Tạo video':kind==='image'?'Tạo ảnh':'Chạy bước AI';
  $('canvasPromptSubmit').setAttribute('aria-label',$('canvasPromptSubmit').title);
  const accepts=(n.inputs||[]).map(p=>p.type),types=['image','video','audio'].filter(t=>accepts.includes(t)||accepts.includes('media'));
  $('canvasPromptFiles').accept=types.map(t=>t+'/*').join(',');$('canvasPromptUpload').disabled=!types.length;
  $('canvasPromptCanvasRefs').disabled=!(n.inputs||[]).length;
  renderReferences();
 }
 function setRunning(running){for(const el of dialog.querySelectorAll('textarea,select,#canvasPromptUpload,#canvasPromptCanvasRefs,#canvasPromptSubmit'))el.disabled=running;$('canvasPromptSubmit').classList.toggle('running',running);}
 async function submit(){
  const s=state;if(!s||s.running)return;s.running=true;setRunning(true);
  try{
   await flush(s);
   if(['prompt','negativePrompt'].includes(s.type)){await close();return;}
   if(!$('canvasPromptProvider').value)throw Error('Chọn AI qua tab đã đăng nhập trước khi chạy.');
   message('Đang chạy trên tab AI…');await api().action('runSelection',{ids:[s.id]});
   const result=node(s.id);if(result?.data?.status==='error')throw Error(result.data.error||'Tác vụ chưa hoàn tất.');
   if(state===s)message(result?.data?.status==='stopped'?'Đã dừng.':'Đã nhận kết quả.');
  }catch(error){remember(s);if(state===s)message(error.message||'Chưa chạy được tác vụ.',true);}
  finally{if(state===s){s.running=false;setRunning(false);refreshAvailability();}}
 }
 function refreshAvailability(){if(!state)return;const n=node(state.id);if(!n)return;const accepts=(n.inputs||[]).map(p=>p.type);$('canvasPromptUpload').disabled=state.running||!accepts.some(t=>['image','video','audio','media'].includes(t));$('canvasPromptCanvasRefs').disabled=state.running||!(n.inputs||[]).length;}
 async function upload(files){
  const s=state;if(!s||s.running||!files.length)return;const target=node(s.id),before=new Set(api().snapshot().nodes.map(n=>n.id));$('canvasPromptUpload').disabled=true;
  try{
   await flush(s);await api().importFiles(files);
   const added=api().snapshot().nodes.filter(n=>!before.has(n.id)&&['imageInput','videoInput','audioInput'].includes(n.type));let connected=0;
   for(const source of added){const edge=findPair(source,target);if(edge){await api().connect(edge);connected++;}}
   if(state===s){renderReferences();message(connected?'Đã tải và nối '+connected+' nguồn.':'Tệp đã được thêm vào canvas; loại này không nối được vào bước đang chọn.',!connected);}
  }catch(error){if(state===s)message(error.message,true);}
  finally{if(state===s)refreshAvailability();}
 }
 function build(){
  if(dialog)return;dialog=make('dialog','canvas-prompt-editor');dialog.id='canvasPromptEditor';dialog.setAttribute('aria-labelledby','canvasPromptTitle');
  const header=make('header'),heading=make('strong','','Tạo ảnh');heading.id='canvasPromptTitle';header.append(heading);
  const advanced=button('Thiết lập','canvas-prompt-tool',async()=>{const id=state?.id;if(!id)return;await close();void api().action('edit',{id,advanced:true});});advanced.id='canvasPromptAdvanced';
  const closeButton=button('×','canvas-prompt-close',()=>void close());closeButton.id='canvasPromptClose';closeButton.setAttribute('aria-label','Đóng prompt');header.append(advanced,closeButton);dialog.append(header);
  const tools=make('div','canvas-prompt-tools'),uploadButton=button('＋ Tải tệp','canvas-prompt-tool',()=>$('canvasPromptFiles').click());uploadButton.id='canvasPromptUpload';
  const canvasRefs=button('↗ Tham chiếu từ canvas','canvas-prompt-tool',()=>{const chooser=$('canvasPromptSourceChooser');chooser.hidden=!chooser.hidden;if(!chooser.hidden){renderChooser();$('canvasPromptSourceSearch').focus();}});canvasRefs.id='canvasPromptCanvasRefs';
  const files=make('input');files.type='file';files.multiple=true;files.hidden=true;files.id='canvasPromptFiles';files.onchange=()=>{const next=[...files.files];files.value='';void upload(next);};tools.append(uploadButton,canvasRefs,files);dialog.append(tools);
  const references=make('div','canvas-prompt-references');references.id='canvasPromptReferences';references.hidden=true;dialog.append(references);
  const chooser=make('section','canvas-prompt-source-chooser');chooser.id='canvasPromptSourceChooser';chooser.hidden=true;
  const sourceSearch=make('input');sourceSearch.type='search';sourceSearch.id='canvasPromptSourceSearch';sourceSearch.placeholder='Tìm nguồn trên canvas…';sourceSearch.setAttribute('aria-label','Tìm nguồn tham chiếu');sourceSearch.oninput=renderChooser;const sources=make('div','canvas-prompt-source-list');sources.id='canvasPromptSourceList';chooser.append(sourceSearch,sources);dialog.append(chooser);
  const label=make('label','canvas-prompt-input-label','Yêu cầu');label.id='canvasPromptInputLabel';label.htmlFor='canvasPromptText';dialog.append(label);
  const text=make('textarea');text.id='canvasPromptText';text.rows=9;text.maxLength=50000;text.setAttribute('aria-label','Nội dung prompt');text.oninput=()=>change({[state.field]:text.value});dialog.append(text);
  const footer=make('footer'),provider=make('select');provider.id='canvasPromptProvider';provider.setAttribute('aria-label','AI thực hiện');provider.title='Dùng model đang chọn trong tab AI';provider.onchange=()=>change({provider:provider.value});
  const size=make('select');size.id='canvasPromptSize';size.setAttribute('aria-label','Tỷ lệ khung hình');size.onchange=()=>change({size:size.value});
  const duration=make('select');duration.id='canvasPromptDuration';duration.setAttribute('aria-label','Thời lượng yêu cầu');duration.title='Thời lượng yêu cầu; khả năng thực tế phụ thuộc dịch vụ AI';duration.onchange=()=>change({duration:duration.value===''?null:Number(duration.value)});
  const send=button('↑','canvas-prompt-submit',()=>void submit());send.id='canvasPromptSubmit';footer.append(provider,size,duration,send);dialog.append(footer);
  const status=make('p','canvas-prompt-status');status.id='canvasPromptStatus';status.setAttribute('role','status');dialog.append(status);
  dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();void close();}if((event.metaKey||event.ctrlKey)&&event.key==='Enter'){event.preventDefault();void submit();}});
  dialog.addEventListener('cancel',event=>{event.preventDefault();void close();});
  header.addEventListener('pointerdown',event=>{
   if(event.button!==0||event.target.closest('button'))return;event.preventDefault();const rect=dialog.getBoundingClientRect(),sx=event.clientX,sy=event.clientY;dialog.style.transform='none';dialog.style.left=rect.left+'px';dialog.style.top=rect.top+'px';header.setPointerCapture(event.pointerId);
   const move=e=>{dialog.style.left=Math.max(8,Math.min(innerWidth-rect.width-8,rect.left+e.clientX-sx))+'px';dialog.style.top=Math.max(8,Math.min(innerHeight-80,rect.top+e.clientY-sy))+'px';};
   const stop=()=>{header.removeEventListener('pointermove',move);header.removeEventListener('pointerup',stop);header.removeEventListener('pointercancel',stop);};header.addEventListener('pointermove',move);header.addEventListener('pointerup',stop);header.addEventListener('pointercancel',stop);
  });document.body.append(dialog);
 }
 async function open(id){
  if(!api())throw Error('Canvas chưa sẵn sàng.');await api().ready;const n=node(id);if(!n||!supported.has(n.type))throw Error('Chọn node prompt hoặc bước tạo ảnh/video/văn bản.');
  if(state?.id===id&&dialog?.open){$('canvasPromptText').focus();return;}
  if(state)await close();build();
  const field=['prompt','negativePrompt'].includes(n.type)?'text':'studioPrompt',stored=drafts.get(id)||{};
  state={id,type:n.type,field,session:++sequence,draft:{[field]:n.data?.[field]||'',provider:n.data?.provider,size:n.data?.size,duration:n.data?.duration,...stored},pending:{...stored},writes:Promise.resolve(),running:false};
  $('canvasPromptSourceChooser').hidden=true;setRunning(false);refreshFields(n);message('');dialog.style.removeProperty('left');dialog.style.removeProperty('top');dialog.style.removeProperty('transform');dialog.show();$('canvasPromptText').focus({preventScroll:true});
 }
 root.MooZPromptEditor={open,close,flush:()=>flush()};
})(globalThis);
