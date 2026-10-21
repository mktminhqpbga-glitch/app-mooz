(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const canvas = $('#canvas');
  const edgesSvg = $('#edges');
  const runStatus = $('#runStatus');
  const backendStatus = $('#backendStatus');
  const museStatus = $('#museStatus');
  const appVersion = chrome.runtime.getManifest().version;

  function compareVersions(a,b){const left=String(a).split('.').map(Number),right=String(b).split('.').map(Number);for(let i=0;i<Math.max(left.length,right.length);i++){const delta=(left[i]||0)-(right[i]||0);if(delta)return delta;}return 0;}
  async function checkForAppUpdate(){try{const response=await fetch(`https://raw.githubusercontent.com/mktminhqpbga-glitch/workflow/main/manifest.json?check=${Date.now()}`,{cache:'no-store'});if(!response.ok)return;const latest=await response.json();if(!latest.version||compareVersions(latest.version,appVersion)<=0)return;const dismissed=(await chrome.storage.local.get('museflowDismissedUpdateVersion')).museflowDismissedUpdateVersion;if(dismissed===latest.version)return;$('#updateNoticeText').textContent=`Có phiên bản Workflow ${latest.version}`;$('#updateNotice').classList.remove('hidden');$('#dismissUpdateBtn').onclick=async()=>{await chrome.storage.local.set({museflowDismissedUpdateVersion:latest.version});$('#updateNotice').classList.add('hidden');};}catch{/* Update checks are best-effort and must not interrupt workflow use. */}}

  const state = {
    nodes: [],
    edges: [],
    groups: [],
    notes: [],
    selectedNodeId: null,
    selectedNodeIds: [],
    selectedEdgeIds: [],
    selectionMarquee: null,
    groupMarquee: null,
    groupDrawMode: false,
    noteDrag: null,
    connectingFrom: null,
    settings: {},
    isRunning: false,
    activeGenerationId: null,
    generationAbortController: null,
    generationRequestId: null,
    timelinePreviewToken: 0,
    timelinePreviewTimer: 0,
    timelinePlayheadFrame: 0,
    timelinePreviewPosition: 0,
    timelineExporting: false,
    timelineExportAbortController: null,
    timelineFFmpeg: null,
    timelineExportUrl: '',
    edgeFrame: 0,
    draggingWire: null,
    wireMoved: false,
    wireOrigin: null,
    pendingConnection: null,
    pointerId: null,
    zoom: 1,
    panX: 0,
    panY: 0,
    handMode: false,
    spaceDown: false,
    panning: null,
    suppressPortClick: false,
    contextPoint: {x:120,y:100}
  };
  const undoStack=[];
  const maxUndoSteps=40;
  let lastUndoInput=null;
  let pendingNativeUndoTarget=null;
  let pendingGenerationOrder=null;
  let pendingGenerationSelection=new Set();
  let generationCreationOrder=[];
  let draggedGenerationId=null;

  const nodeDefs = {
    videoInput: {title:'Video đầu vào',outputs:[{id:'video',label:'video gốc',type:'video'}]},
    generateText: {title:'Tạo văn bản',inputs:[{id:'prompt',label:'Yêu cầu',type:'text'},{id:'rules',label:'Quy tắc',type:'text'},{id:'reference',label:'Ảnh',type:'image'},{id:'video',label:'Video gốc',type:'video'}],outputs:[{id:'text',label:'Văn bản',type:'text'}]},
    prompt: { title: 'Prompt', outputs: [{ id: 'text', label: 'text', type: 'text' }] },
    negativePrompt: { title: 'Negative Prompt', outputs: [{ id: 'text', label: 'negative', type: 'negative' }] },
    textAppend: { title: 'Text Append', inputs: [{ id: 'text', label: 'text', type: 'text' }], outputs: [{ id: 'text', label: 'text', type: 'text' }] },
    textConcat: { title: 'Text Merge', inputs: [{ id: 'text', label: 'text', type: 'text' }], outputs: [{ id: 'text', label: 'text', type: 'text' }] },
    imageInput: { title: 'Image Input', outputs: [{ id: 'image', label: 'image', type: 'image' }] },
    references: { title: 'References', inputs: Array.from({length:8},(_,i)=>({id:`reference${i+1}`,label:`image ${i+1}`,type:'image'})), outputs: [{id:'image',label:'images',type:'image'}] },
    generateImage: {
      title: 'Generate Image',
      inputs: [{ id: 'prompt', label: 'prompt', type: 'text' }, { id: 'negative', label: 'negative', type: 'negative' }, { id: 'reference', label: 'reference', type: 'image' }],
      outputs: [{ id: 'image', label: 'image', type: 'image' }]
    },
    generateVideo: {
      title: 'Tạo video',
      inputs: [{id:'video',label:'Video chuyển động',type:'video'}, { id: 'prompt', label: 'prompt', type: 'text' }, { id: 'negative', label: 'negative', type: 'negative' }, { id: 'reference', label: 'reference', type: 'image' }],
      outputs: [{ id: 'video', label: 'video', type: 'video' }, { id: 'endFrame', label: 'end frame', type: 'image' }]
    },
    timeline: { title: 'Timeline', inputs: Array.from({length:6},(_,i)=>({id:`clip${i+1}`,label:`clip ${i+1}`,type:'video'})), outputs: [] },
    imageResize: { title: 'Image Resize', inputs: [{ id: 'image', label: 'image', type: 'image' }], outputs: [{ id: 'image', label: 'image', type: 'image' }] },
    preview: { title: 'Preview', inputs: [{ id: 'media', label: 'media', type: 'media' }] }
  };

  Object.assign(nodeDefs,WorkflowTools.definitions);
  const aiKeys={};
  let scriptAIController=null;
  const aiTabs=new Map();
  const activeRuns=new Map(),nodeClaims=new Map(),nodeOutcomes=new Map(),tabQueue=WorkflowRuntime.queue();let completionSequence=0,autoPlan=null;
  const runForNode=id=>nodeClaims.get(id)?.run||[...activeRuns.values()].find(run=>run.activeNodeId===id||run.targetId===id);
  function syncRuns(){const last=[...activeRuns.values()].at(-1);state.isRunning=activeRuns.size>0||!!autoPlan;state.activeGenerationId=last?.activeNodeId||null;state.generationRequestId=last?.requestId||null;state.generationAbortController=last?.controller||null;$('#runBtn').disabled=false;$('#runBtn').textContent=state.isRunning?`■ Dừng tất cả (${activeRuns.size||1})`:'▶ Run All';$('#runBtn').title=state.isRunning?'Dừng tất cả nhánh đang chạy và đang chờ':'Chạy workflow';}
  function progressNode(node,text){if(!node)return;node.data.progress=text;const status=document.querySelector(`.node[data-id="${CSS.escape(node.id)}"] .status`);if(status)status.textContent=text;}

  const providerJobs=new Map(),providerHealth=new Map(),healthChecks=new Set();
  const providerName=id=>({muse:'Muse',gemini:'Gemini',chatgpt:'GPT',google:'Google API',openai:'OpenAI API',fal:'fal.ai'})[id]||id;
  function setProviderHealth(provider,status,detail='',sticky=false){providerHealth.set(provider,{status,detail,sticky});renderHealth();}
  const failureHealth=message=>/chưa|đăng nhập|chọn|cuộc trò chuyện|hết thời gian|không nhận diện|timeout/i.test(message||'')?'check':'error';
  function renderHealth(){
    const host=$('#aiHealth');if(!host)return;host.replaceChildren();
    const ids=['muse','gemini','chatgpt',...['google','openai','fal'].filter(id=>aiKeys[id]||state.nodes.some(n=>n.data.provider===id))];
    for(const id of ids){const jobs=[...providerJobs.values()].filter(job=>job.provider===id),known=providerHealth.get(id)||{status:'check',detail:'Chưa kiểm tra'};
      const status=jobs.some(job=>job.phase==='busy')?'busy':jobs.length?'check':known.status;
      const text=({ready:'Đã kết nối · Rảnh',busy:'Đang làm tác vụ',error:'Lỗi',check:'Cần kiểm tra'})[status];
      const button=document.createElement('button');button.type='button';button.className='ai-health-chip';button.dataset.provider=id;button.dataset.state=status;button.textContent='● '+providerName(id);button.title=providerName(id)+' · '+text+(known.detail?' · '+known.detail:'');button.setAttribute('aria-label',providerName(id)+' · '+text);button.onclick=()=>void refreshProviderHealth(id,true);host.append(button);
    }
  }
  async function refreshProviderHealth(provider,force=false){
    if(healthChecks.has(provider))return;
    const running=[...providerJobs.values()].some(job=>job.provider===provider&&job.phase==='busy');if(running){renderHealth();return;}
    if(!force&&providerHealth.get(provider)?.sticky){renderHealth();return;}
    healthChecks.add(provider);
    try{
      const config=WorkflowAI.providers[provider];
      if(!config.urls){if(providerHealth.get(provider)?.status!=='ready')setProviderHealth(provider,'check',aiKeys[provider]?'Có khóa, cần xác minh bằng tác vụ':'Chưa nhập API key');return;}
      const tabs=await chrome.tabs.query({url:config.urls});if(!tabs.length){setProviderHealth(provider,'error','Chưa mở tab AI');return;}
      const preferred=aiChatTargets[provider],tab=tabs.find(tab=>tab.id===preferred?.tabId)||tabs.find(tab=>tab.active)||tabs[0];
      await chrome.scripting.executeScript({target:{tabId:tab.id},files:provider==='muse'?['composer-controls.js','muse-bridge.js']:['composer-controls.js','ai-bridge.js']});
      const result=await chrome.tabs.sendMessage(tab.id,{type:provider==='muse'?'MUSEFLOW_CHECK_SESSION':'WORKFLOW_AI_CHECK'});
      if(result?.busy)setProviderHealth(provider,'busy','Tab AI đang xử lý');else if(result?.ok&&result.composer&&result.signedIn!==false)setProviderHealth(provider,'ready',tab.title||'Ô chat sẵn sàng');else setProviderHealth(provider,'check','Mở chat/đăng nhập hoặc tải lại tab');
    }catch(error){setProviderHealth(provider,'error',error.message);}finally{healthChecks.delete(provider);}
  }
  function refreshHealth(force=false){return Promise.allSettled(['muse','gemini','chatgpt',...['google','openai','fal'].filter(id=>aiKeys[id]||state.nodes.some(n=>n.data.provider===id))].map(id=>refreshProviderHealth(id,force)));}

  const aiChatTabs={},aiChatTargets={};let pendingChatSelections=0;
  const chatKey=url=>{try{const value=new URL(url);return value.origin+value.pathname.replace(/\/$/,'');}catch{return '';}};
  async function refreshChatTabs(){
    await Promise.all(Object.entries(WorkflowAI.providers).filter(([,provider])=>provider.urls).map(async([id,provider])=>{try{aiChatTabs[id]=await chrome.tabs.query({url:provider.urls});if(!aiChatTargets[id]&&aiChatTabs[id].length===1){const tab=aiChatTabs[id][0];aiChatTargets[id]={tabId:tab.id,url:chatKey(tab.url)};}}catch{aiChatTabs[id]=[];}}));
    const host=$('#aiChatTargets');if(host){host.replaceChildren();for(const id of ['muse','gemini','chatgpt']){const label=document.createElement('label');label.textContent=WorkflowAI.providers[id].name;const select=chatSelector(id,aiChatTargets[id],target=>{if(target)aiChatTargets[id]=target;else delete aiChatTargets[id];void chrome.storage.local.set({workflowAIChatTargets:aiChatTargets});});label.append(select);host.append(label);}}
  }
  function chatSelector(provider,current,onChange){
    const select=document.createElement('select');select.setAttribute('aria-label','Cuộc trò chuyện AI');
    const empty=document.createElement('option');empty.value='';empty.textContent='Chọn tab cuộc trò chuyện…';select.append(empty);
    for(const tab of aiChatTabs[provider]||[]){const option=document.createElement('option');option.value=String(tab.id);option.textContent=tab.title||tab.url||`Tab ${tab.id}`;select.append(option);}
    if(current&&!select.querySelector(`option[value="${current.tabId}"]`)){const missing=document.createElement('option');missing.value=String(current.tabId);missing.textContent='Tab đã chọn không còn mở — chọn lại';select.append(missing);}
    const cached=(aiChatTabs[provider]||[]).find(tab=>tab.id===current?.tabId);
    const stale=current&&cached&&chatKey(current.url)!==chatKey(cached.url);
    if(stale)empty.textContent='Chat đã đổi — chọn lại hoặc bấm Làm mới';
    select.value=current&&!stale?String(current.tabId):'';
    select.onchange=async()=>{
      const chosen=select.value;if(!chosen){onChange(null);return;}
      pendingChatSelections++;try{const tabs=await chrome.tabs.query({url:WorkflowAI.providers[provider].urls});if(select.value!==chosen||!select.isConnected)return;const tab=tabs.find(tab=>String(tab.id)===chosen);if(!tab)throw new Error('Tab đã đóng. Bấm Làm mới danh sách chat.');onChange({tabId:tab.id,url:chatKey(tab.url)});}
      catch(error){setRunStatus(error.message,'error');}finally{pendingChatSelections--;}
    };
    return select;
  }
  function chooseChat(provider,tabs,target){
    if(target){const tab=tabs.find(tab=>tab.id===target.tabId);if(!tab)throw new Error('Tab cuộc trò chuyện đã chọn đã đóng. Chọn lại trong node hoặc Kết nối AI.');const actual=chatKey(tab.url),expected=chatKey(target.url);if(expected&&actual!==expected)throw new Error('Tab đã chuyển sang cuộc trò chuyện khác. Bấm “Làm mới danh sách chat” trong node để dùng chat hiện tại, hoặc chọn tab khác.');return tab;}
    if(tabs.length!==1)throw new Error('Có nhiều tab AI. Hãy chọn đúng cuộc trò chuyện trong node hoặc Kết nối AI trước khi chạy.');return tabs[0];
  }
  async function sendTextNow(node){
    const run=runForNode(node.id),requestId=run?.requestId,tabId=aiTabs.get(requestId);
    if(!run)return;if(!tabId){setRunStatus('Node đang chuẩn bị hoặc đợi tab AI. Bấm Gửi ngay khi đến lượt; chưa gửi thêm yêu cầu.','warn');return;}
    const reply=await chrome.tabs.sendMessage(tabId,{type:'WORKFLOW_AI_SEND_NOW',requestId});
    if(reply?.ok){node.data.progress='Đã yêu cầu gửi sớm. Vẫn đợi tệp tải xong trước khi gửi.';const status=document.querySelector(`.node[data-id="${CSS.escape(node.id)}"] .status`);if(status)status.textContent=node.data.progress;}
  }

  async function pickTextResult(node){
    const provider=node.data.provider||'gemini';
    const selectedRun=runForNode(node.id),requestId=selectedRun?.requestId;
    const tabs=await chrome.tabs.query({url:WorkflowAI.providers[provider].urls});
    if(requestId&&!aiTabs.has(requestId))throw new Error('Node đang chuẩn bị hoặc đợi tab AI. Đợi gửi xong, hoặc dừng nhánh rồi chọn kết quả.');
    const runningTab=requestId?aiTabs.get(requestId):null;
    const tab=runningTab?tabs.find(item=>item.id===runningTab):chooseChat(provider,tabs,node.data.chatTarget||aiChatTargets[provider]);
    if(!tab)throw new Error('Tab AI của lượt chạy đã đóng.');
    await chrome.scripting.executeScript({target:{tabId:tab.id},files:['result-picker.js']});
    await chrome.tabs.update(tab.id,{active:true});if(tab.windowId&&chrome.windows?.update)await chrome.windows.update(tab.windowId,{focused:true});
    const results=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>WorkflowResultPicker.pick()});
    const result=results[0]?.result;if(!result?.ok)throw new Error(result?.error||'Chưa chọn kết quả.');
    if(nodeById(node.id)!==node)throw new Error('Node đã thay đổi hoặc bị xóa. Chọn kết quả lại trên node hiện tại.');
    const current=chooseChat(provider,await chrome.tabs.query({url:WorkflowAI.providers[provider].urls}),{tabId:tab.id,url:chatKey(tab.url)});
    if(requestId&&runForNode(node.id)===selectedRun&&selectedRun.requestId===requestId&&node.data.status==='running'){
      const reply=await chrome.tabs.sendMessage(current.id,{type:'WORKFLOW_AI_USE_RESULT',requestId,text:result.text});
      if(reply?.ok)return;
      throw new Error('Lượt chạy không còn kết nối. Bấm Dừng rồi chọn kết quả lại; không cần gửi lại prompt.');
    }
    if(node.data.status==='running')throw new Error('Lượt chạy đã thay đổi. Chọn kết quả lại.');
    node.data.text=result.text;node.data.status='success';node.data.error='';node.data.progress='';render();saveState();setRunStatus('Đã nhập kết quả bạn chọn; không gửi lại prompt.','ok');
  }

  chrome.runtime.onMessage?.addListener((message,sender)=>{
    if(sender.id!==chrome.runtime.id||message?.type!=='WORKFLOW_AI_PROGRESS'||typeof message.requestId!=='string'||aiTabs.get(message.requestId)!==sender.tab?.id||typeof message.text!=='string')return false;
    if(message.requestId.startsWith('script-'))$('#scriptAIStatus').textContent=message.text;
    else{setRunStatus(message.text,'warn');renderHealth();const run=[...activeRuns.values()].find(item=>item.requestId===message.requestId);const node=nodeById(run?.activeNodeId);if(node?.data.status==='running'){node.data.progress=message.text;const status=document.querySelector(`.node[data-id="${CSS.escape(node.id)}"] .status`);if(status)status.textContent=message.text;}}
    return false;
  });
  async function runMuseSupport(mode){
    const status=$('#museSupportStatus'),buttons=[$('#diagnoseMuseBtn'),$('#bindMuseSendBtn')];
    if(mode==='bind'&&state.isRunning){status.textContent='Bấm Dừng workflow trước, rồi chọn lại nút Gửi. Bản nháp trong Muse được giữ để bạn chọn nút.';return;}
    buttons.forEach(button=>button.disabled=true);status.textContent=mode==='bind'?'Đang mở Muse. Hãy bấm đúng mũi tên Gửi theo hướng dẫn trên tab Muse.':'Đang đọc thông tin nút trên tab Muse…';
    try{
      const tabs=await chrome.tabs.query({url:['https://muse.ai/*','https://*.muse.ai/*']});
      const tab=tabs.find(t=>t.id===preferredMuseTabId)||tabs.find(t=>t.active)||tabs[0];
      if(!tab?.id)throw new Error('Mở trang chat Muse trước khi chẩn đoán hoặc chọn nút Gửi.');
      const existing=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>!!globalThis.WorkflowComposer?.scopeFor});
      if(!existing[0]?.result)await chrome.scripting.executeScript({target:{tabId:tab.id},files:['composer-controls.js']});
      await chrome.scripting.executeScript({target:{tabId:tab.id},files:['muse-support.js']});
      if(mode==='bind'){await chrome.tabs.update(tab.id,{active:true});if(tab.windowId&&chrome.windows?.update)await chrome.windows.update(tab.windowId,{focused:true});}
      const results=await chrome.scripting.executeScript({target:{tabId:tab.id},func:mode=>mode==='bind'?WorkflowMuseSupport.bindSend():WorkflowMuseSupport.diagnostics(),args:[mode]});
      const result=results[0]?.result;if(!result)throw new Error('Không nhận được báo cáo từ tab Muse.');
      if(mode==='bind'){if(!result.ok)throw new Error(result.error||'Chưa ghi nhớ được nút Gửi.');status.textContent='Đã ghi nhớ nút Gửi trên Muse. Quay lại Workflow và chạy lại node.';}
      else{$('#museSupportReport').value=JSON.stringify({extensionVersion:appVersion,capturedAt:new Date().toISOString(),...result},null,2);$('#museSupportDetails').open=true;status.textContent='Đã có báo cáo. Sao chép báo cáo để gửi khi cần hỗ trợ; không chứa prompt hoặc nội dung chat.';}
    }catch(error){status.textContent=error.message;}finally{buttons.forEach(button=>button.disabled=false);}
  }
  $('#diagnoseMuseBtn').onclick=()=>runMuseSupport('diagnostics');
  $('#bindMuseSendBtn').onclick=()=>runMuseSupport('bind');
  $('#copyMuseReportBtn').onclick=async()=>{try{await navigator.clipboard.writeText($('#museSupportReport').value);$('#museSupportStatus').textContent='Đã sao chép báo cáo chẩn đoán.';}catch{$('#museSupportReport').focus();$('#museSupportReport').select();$('#museSupportStatus').textContent='Hãy nhấn Ctrl+C để sao chép báo cáo đã chọn.';}};

  function resolveVideos(id,seen=new Set()){if(seen.has(id))return [];seen.add(id);return getIncoming(id,'video').map(sourceFor).filter(Boolean).flatMap(n=>n.type==='review'?resolveVideos(n.id,new Set(seen)):[n.data.localDataUrl||n.data.asset?.url]).filter(Boolean);}
  function providerControls(n){
    const wrap=document.createElement('div');wrap.className='provider-controls';
    const kind=n.type==='generateText'?'text':n.type==='generateVideo'?'video':'image';
    const select=document.createElement('select');select.setAttribute('aria-label','AI thực hiện');
    for(const [id,p] of Object.entries(WorkflowAI.providers)){if(!p.types.includes(kind))continue;const option=document.createElement('option');option.value=id;option.textContent=p.name;select.appendChild(option);}
    select.value=n.data.provider||(kind==='text'?'gemini':'muse');
    select.onchange=()=>{n.data.provider=select.value;n.data.apiModel='';n.data.chatTarget=null;scheduleAutoSave();render();};wrap.appendChild(select);
    const provider=select.value;if(WorkflowAI.providers[provider]?.urls){const target=n.data.chatTarget||aiChatTargets[provider];wrap.appendChild(chatSelector(provider,target,value=>{n.data.chatTarget=value;if(n.data.error?.includes('cuộc trò chuyện')){n.data.error='';n.data.status='idle';}scheduleAutoSave();}));const refresh=document.createElement('button');refresh.type='button';refresh.textContent='Làm mới danh sách chat';refresh.onclick=async()=>{
      if(runForNode(n.id)){setRunStatus('Dừng lượt đang chạy của node này trước khi đổi cuộc trò chuyện.','warn');return;}
      const selected=n.data.chatTarget||aiChatTargets[provider];await refreshChatTabs();
      const tab=(aiChatTabs[provider]||[]).find(tab=>tab.id===selected?.tabId);
      if(tab){n.data.chatTarget={tabId:tab.id,url:chatKey(tab.url)};if(n.data.error?.includes('cuộc trò chuyện')){n.data.error='';n.data.status='idle';}scheduleAutoSave();setRunStatus('Đã chọn cuộc trò chuyện hiện tại của tab: '+(tab.title||tab.url),'ok');}
      render();
    };wrap.append(refresh);if(kind==='text'){const hint=document.createElement('small');hint.textContent='Tự gửi sau khi tải tệp xong và tự lấy văn bản về node.';const mode=document.createElement('select');mode.setAttribute('aria-label','Chế độ gửi');mode.append(new Option('Tự gửi khi sẵn sàng','auto'),new Option('Chờ 2 phút trước khi gửi','delay'));mode.value=n.data.sendMode||'auto';mode.onchange=()=>{n.data.sendMode=mode.value;scheduleAutoSave();};wrap.append(mode);wrap.append(hint);}}
    if(WorkflowAI.models[provider]){const model=document.createElement('input');model.placeholder=WorkflowAI.models[provider][kind]||'Model';model.value=n.data.apiModel||'';model.setAttribute('aria-label','Model API');model.onchange=()=>{n.data.apiModel=model.value.trim();scheduleAutoSave();};wrap.appendChild(model);}
    if(kind==='video'){const hint=document.createElement('small');hint.textContent=provider==='fal'?'Motion Control: nối đúng 1 ảnh nhân vật + 1 video chuyển động. Thời lượng theo video nguồn.':provider==='google'?'Veo: clip 4/6/8 giây, cần API key có quyền model.':'15–60 giây là thời lượng yêu cầu; kết quả phụ thuộc Muse.ai.';wrap.appendChild(hint);}
    return wrap;
  }
  async function waitTabIdle(tabId,type,requestId,signal,first){
    let result=first;const end=Date.now()+600000;
    while(true){
      if(signal?.aborted)throw new DOMException('Đã dừng.','AbortError');
      result=result||await sendMuseTabMessage(tabId,{type},signal);if(!result?.busy)return result;
      if(Date.now()>end)throw new Error('Tab AI vẫn đang xử lý yêu cầu trước. Chưa gửi thêm prompt.');
      const run=[...activeRuns.values()].find(item=>item.requestId===requestId);progressNode(nodeById(run?.activeNodeId),'Đang đợi tab AI hoàn tất yêu cầu trước…');
      await WorkflowRuntime.waitFor(new Promise(resolve=>setTimeout(resolve,500)),signal);result=null;
    }
  }
  async function otherTabMessage(provider,message,signal){
    const checkAbort=()=>{if(signal?.aborted)throw new DOMException('Đã dừng.','AbortError');};
    const progress=text=>{if(message.requestId?.startsWith('script-'))$('#scriptAIStatus').textContent=text;};
    checkAbort();progress(`Đang tìm tab ${WorkflowAI.providers[provider].name}…`);
    const tabs=await chrome.tabs.query({url:WorkflowAI.providers[provider].urls});
    if(!tabs.length)throw new Error(`Chưa mở tab ${WorkflowAI.providers[provider].name}. Mở trang chat, đăng nhập rồi bấm lại.`);
    const target=message.chatTarget||aiChatTargets[provider];const ordered=message.type==='WORKFLOW_AI_CHECK'&&!target?tabs:[chooseChat(provider,tabs,target)];let chosen=null,lastError='';
    for(const tab of ordered){
      checkAbort();
      try{if(message.type==='WORKFLOW_AI_GENERATE'&&chrome.tabs.update){await chrome.tabs.update(tab.id,{active:true});if(tab.windowId&&chrome.windows?.update)await chrome.windows.update(tab.windowId,{focused:true});}await chrome.scripting.executeScript({target:{tabId:tab.id},files:['composer-controls.js','ai-bridge.js']});let check=await sendMuseTabMessage(tab.id,{type:'WORKFLOW_AI_CHECK'},signal);if(message.type==='WORKFLOW_AI_GENERATE'&&check?.busy)check=await waitTabIdle(tab.id,'WORKFLOW_AI_CHECK',message.requestId,signal,check);if(check?.ok&&check.composer&&check.signedIn!==false){chosen=tab;break;}lastError=check?.error||'Chưa tìm thấy ô chat. Nếu trang đã đăng nhập, hãy tải lại tab AI để cập nhật bộ kết nối.';}
      catch(error){if(error.name==='AbortError')throw error;lastError=error.message;}
    }
    if(!chosen)throw new Error(`${WorkflowAI.providers[provider].name}: ${lastError||'không kết nối được'}`);
    if(message.type==='WORKFLOW_AI_CHECK')return {ok:true,signedIn:true,composer:true};
    progress('Đã tìm thấy ô chat. Đang gửi yêu cầu và chờ AI trả lời…');
    // Native editing requires an active editor. Select only a verified chat tab.
    if(chrome.tabs.update)await chrome.tabs.update(chosen.id,{active:true});
    checkAbort();
    const cancel=()=>{void chrome.tabs.sendMessage(chosen.id,{type:'WORKFLOW_AI_STOP',requestId:message.requestId}).catch(()=>{});};
    if(message.requestId)aiTabs.set(message.requestId,chosen.id);signal?.addEventListener('abort',cancel,{once:true});
    try{const reply=await sendMuseTabMessage(chosen.id,message,signal);const latest=chrome.tabs.get?await chrome.tabs.get(chosen.id):chosen;return {...reply,chatTarget:{tabId:chosen.id,url:chatKey(latest.url)}};}finally{signal?.removeEventListener('abort',cancel);aiTabs.delete(message.requestId);}
  }
  async function generateWithProvider(n,request,signal){
    if(pendingChatSelections)throw new Error('Đang cập nhật cuộc trò chuyện đã chọn. Đợi một chút rồi chạy lại.');
    const references=[],canonical=new Map();
    for(const ref of n.id?resolveReferences(n.id):[]){const url=await blobAsDataUrlFromUrl(ref.url);if(signal?.aborted)throw new DOMException('Đã dừng.','AbortError');if(canonical.has(url)){const old=canonical.get(url);old.roles=[...new Set([...old.roles,...ref.roles])];old.aliases=[...new Set([...(old.aliases||[]),ref.componentId,...(ref.aliases||[])])];if(ref.instructions&&!old.instructions.includes(ref.instructions))old.instructions+='\n'+ref.instructions;}else{const copy={...ref,url,roles:[...ref.roles]};canonical.set(url,copy);references.push(copy);}}
    if(references.length)request={...request,referenceImages:references.map(ref=>ref.url)};
    const referenceNote=WorkflowTools.referenceNote(references,request.prompt);if(referenceNote)request={...request,prompt:request.prompt+'\n'+referenceNote};
    const provider=n.data.provider||(n.type==='generateText'?'gemini':'muse');request={...request,chatTarget:n.data.chatTarget||aiChatTargets[provider]};
    WorkflowAI.validate(provider,request);
    providerJobs.set(request.requestId,{provider,phase:'queued'});renderHealth();
    let release;try{
    if(['muse','chatgpt','gemini'].includes(provider)){
      const tabs=await chrome.tabs.query({url:WorkflowAI.providers[provider].urls});const tab=chooseChat(provider,tabs,request.chatTarget);
      request={...request,chatTarget:{tabId:tab.id,url:chatKey(tab.url)}};
      release=await tabQueue.acquire('tab:'+tab.id,signal,()=>progressNode(n,'Đang đợi lượt dùng tab AI này. Bạn có thể chạy nhánh ở tab khác.'));
    }
    providerJobs.get(request.requestId).phase='busy';renderHealth();
    if(release){const tabs=await chrome.tabs.query({url:WorkflowAI.providers[provider].urls});chooseChat(provider,tabs,request.chatTarget);if(signal?.aborted)throw new DOMException('Đã dừng.','AbortError');}
    if(provider==='muse'){if(request.referenceVideos?.length)throw new Error('Muse bridge chưa hỗ trợ video tham chiếu. Chọn fal.ai cho Motion Control.');const referenceImages=await Promise.all((request.referenceImages||[]).map(url=>blobAsDataUrlFromUrl(url)));const reply=await museTabMessage({...request,referenceImages,type:'MUSEFLOW_GENERATE'},preferredMuseTabId,signal);if(!reply?.ok){setProviderHealth(provider,failureHealth(reply?.error),reply?.error||'Muse không trả kết quả.',true);return reply;}setProviderHealth(provider,'ready','Đã nhận kết quả');return reply;}
    if(provider==='chatgpt'||provider==='gemini'){
      const safe={...request};safe.referenceImages=await Promise.all((request.referenceImages||[]).map(url=>blobAsDataUrlFromUrl(url)));safe.referenceVideos=await Promise.all((request.referenceVideos||[]).map(url=>blobAsDataUrlFromUrl(url)));
      try{const reply=await otherTabMessage(provider,{...safe,type:'WORKFLOW_AI_GENERATE'},signal);if(!reply?.ok){setProviderHealth(provider,failureHealth(reply?.error),reply?.error||'Chưa nhận kết quả.',true);return reply;}setProviderHealth(provider,'ready','Đã nhận kết quả');if(reply.chatTarget){n.data.chatTarget=reply.chatTarget;if(aiChatTargets[provider]?.tabId===reply.chatTarget.tabId)aiChatTargets[provider]=reply.chatTarget;}return reply;}finally{aiTabs.delete(request.requestId);}
    }
    const result=await WorkflowAI.api(provider,request,aiKeys[provider],signal);setProviderHealth(provider,'ready','API vừa trả kết quả');return result;
    }catch(error){if(error.name!=='AbortError')setProviderHealth(provider,failureHealth(error.message),error.message,true);throw error;}finally{release?.();providerJobs.delete(request.requestId);renderHealth();if(signal?.aborted)void refreshProviderHealth(provider,true);}
  }
  async function blobAsDataUrlFromUrl(url){if(url.startsWith('data:'))return url;const r=await fetch(url);if(!r.ok)throw new Error('Không tải được tệp nguồn để chuyển sang AI.');return blobAsDataUrl(await r.blob());}
  async function refreshConnections(){
    const host=$('#aiConnections');host.replaceChildren();
    for(const [id,p] of Object.entries(WorkflowAI.providers)){
      const row=document.createElement('p');row.textContent=`● ${p.name}: đang kiểm tra…`;host.appendChild(row);
      try{
        if(p.urls){const tabs=await chrome.tabs.query({url:p.urls});if(!tabs.length){row.style.color='#87909f';row.textContent=`● ${p.name}: chưa mở tab`;continue;}
          const result=id==='muse'?await museTabMessage({type:'MUSEFLOW_CHECK_SESSION'}):await otherTabMessage(id,{type:'WORKFLOW_AI_CHECK'});
          row.style.color=result?.signedIn?'#16a34a':'#ef4444';row.textContent=`● ${p.name}: ${result?.signedIn?'ô chat sẵn sàng':'cần đăng nhập / mở trang chat'}`;
        }else{row.style.color=aiKeys[id]?'#d97706':'#87909f';row.textContent=`● ${p.name}: ${aiKeys[id]?'đã có khóa, chưa xác thực yêu cầu tạo':'chưa nhập khóa'}`;}
      }catch{row.style.color='#ef4444';row.textContent=`● ${p.name}: không kết nối được`;}
    }
  }
  async function setupAISettings(){
    $('#refreshAIBtn').onclick=async()=>{await refreshChatTabs();render();await refreshConnections();};
    $('#refreshChatTabsBtn').onclick=async()=>{await refreshChatTabs();render();};
    $('#scriptAIButton').onclick=async()=>{
      if(scriptAIController){scriptAIController.abort();return;}if(state.isRunning){$('#scriptAIStatus').textContent='Dừng workflow đang chạy trước khi gọi AI viết kịch bản.';return;}
      const button=$('#scriptAIButton'),status=$('#scriptAIStatus');scriptAIController=new AbortController();button.textContent='Dừng tạo kịch bản';status.className='warn';status.textContent='Đang chuẩn bị yêu cầu…';
      try{const templateResponse=await fetch(chrome.runtime.getURL('templates/museflow-scene-script-template-vi.txt'));if(!templateResponse.ok)throw new Error('Không đọc được mẫu kịch bản trong extension.');const template=await templateResponse.text();const prompt=$('#scriptAIPrompt').value.trim();if(!prompt)throw new Error('Nhập nội dung kịch bản muốn tạo.');
        const node={type:'generateText',data:{provider:$('#scriptAIProvider').value}};const reply=await generateWithProvider(node,{requestId:uid('script'),mediaType:'text',prompt,rules:'Viết kịch bản bằng tiếng Việt theo đúng mẫu dưới đây. Giữ tiêu đề CẢNH, thứ tự trường và định dạng thời gian. Chỉ trả về kịch bản hoàn chỉnh.\n'+template},scriptAIController.signal);
        if(!reply.ok||!reply.text)throw new Error(reply.error||'AI không trả về kịch bản.');$('#scriptInput').value=reply.text;status.className='ok';status.textContent='Đã nhận kịch bản từ AI. Kiểm tra nội dung bên dưới rồi tạo node.';$('#scriptImportStatus').textContent=status.textContent;
      }catch(error){status.className=error.name==='AbortError'?'warn':'error';status.textContent=error.name==='AbortError'?'Đã dừng tạo kịch bản.':error.message;$('#scriptImportStatus').textContent=status.textContent;}finally{scriptAIController=null;button.textContent='Tạo kịch bản bằng AI';}
    };
    $('#dataUpdateBtn').onclick=()=>chrome.tabs.create({url:chrome.runtime.getURL('extension/popup.html')});
    try{Object.assign(aiChatTargets,(await chrome.storage.local.get('workflowAIChatTargets')).workflowAIChatTargets||{});}catch{}await refreshChatTabs();render();
    try{Object.assign(aiKeys,(await chrome.storage.session.get('workflowApiKeys')).workflowApiKeys||{});}catch{/* Keep tab-based generation available if session storage is unavailable. */}
    for(const id of ['google','openai','fal']){const label=document.createElement('label');label.textContent=WorkflowAI.providers[id].name;const input=document.createElement('input');input.type='password';input.autocomplete='off';input.placeholder='API key (chỉ lưu trong phiên)';input.value=aiKeys[id]||'';input.onchange=async()=>{aiKeys[id]=input.value.trim();try{await chrome.storage.session.set({workflowApiKeys:aiKeys});}catch{setRunStatus('Khóa chỉ được giữ trong tab hiện tại vì bộ nhớ phiên không khả dụng.','warn');}};label.appendChild(input);$('#apiSettings').appendChild(label);}

  }
  void setupAISettings().catch(()=>setRunStatus('Không đọc được cấu hình API trong phiên.','error'));

  async function createImageBatch(runAfterCreate=false){
    const status=$('#batchImagesStatus');
    if(state.isRunning||scriptAIController){status.textContent='Đợi hoặc dừng tác vụ AI hiện tại trước khi tạo đợt ảnh mới.';return;}
    const buttons=[$('#createBatchImages'),$('#runBatchImages')];buttons.forEach(b=>b.disabled=true);
    try{
      const items=WorkflowBatch.parsePrompts($('#batchPrompts').value,Number($('#batchCopies').value));
      const provider=$('#batchProvider').value,size=$('#batchSize').value,negative=$('#batchNegative').value.trim();
      if(!WorkflowAI.providers[provider]?.types.includes('image'))throw new Error('AI đã chọn không hỗ trợ ảnh.');
      const files=[...$('#batchReferences').files];if(files.reduce((total,file)=>total+file.size,0)>20*1024*1024)throw new Error('Tổng ảnh tham chiếu mỗi đợt không quá 20 MB.');if(files.length>8)throw new Error('Tối đa 8 ảnh tham chiếu chung.');
      if(provider==='openai'&&files.length)throw new Error('OpenAI tạo ảnh chưa hỗ trợ tham chiếu trong bản này. Chọn Gemini, ChatGPT hoặc Muse.');
      const references=[];
      for(const file of files){if(!file.type.startsWith('image/')||!file.size||file.size>20*1024*1024)throw new Error('Mỗi ảnh tham chiếu phải đọc được và không quá 20 MB.');references.push({name:file.name,url:await blobAsDataUrl(file)});}
      createUndoSnapshot('Tạo ảnh hàng loạt');
      const baseY=Math.max(40,...state.nodes.filter(n=>!n.data?.dockOnly).map(n=>n.y+450)),ids=[],batchId=uid('batch');
      const referenceNodes=references.map((ref,index)=>({id:uid('imageInput'),type:'imageInput',x:40+index*330,y:baseY,data:{localDataUrl:ref.url,fileName:ref.name}}));state.nodes.push(...referenceNodes);
      let negativeNode=null;if(negative){negativeNode={id:uid('negativePrompt'),type:'negativePrompt',x:40,y:baseY+(references.length?350:0),data:{text:negative}};state.nodes.push(negativeNode);}
      const startY=baseY+(references.length||negative?650:0);
      for(const [index,item] of items.entries()){
        const x=80+(index%3)*700,y=startY+Math.floor(index/3)*650,label=`Đợt ảnh ${item.index}.${item.copy}`;
        const prompt={id:uid('prompt'),type:'prompt',x,y,data:{text:item.prompt}};
        const image={id:uid('generateImage'),type:'generateImage',x:x+330,y,data:{provider,size,status:'idle',batchId,customName:label}};
        state.nodes.push(prompt,image);ids.push(image.id);state.edges.push({id:uid('edge'),source:prompt.id,sourcePort:'text',target:image.id,targetPort:'prompt'});
        for(const ref of referenceNodes)state.edges.push({id:uid('edge'),source:ref.id,sourcePort:'image',target:image.id,targetPort:'reference'});
        if(negativeNode)state.edges.push({id:uid('edge'),source:negativeNode.id,sourcePort:'text',target:image.id,targetPort:'negative'});
      }
      state.selectedNodeIds=ids;state.selectedNodeId=ids[0];render();await saveState();$('#batchImagesModal').classList.add('hidden');
      setRunStatus(`Đã tạo ${ids.length} node ảnh. AI: ${WorkflowAI.providers[provider].name}.`,'ok');
      if(runAfterCreate){openRunOrderModal();pendingGenerationSelection=new Set(ids);pendingGenerationOrder=[...ids,...pendingGenerationOrder.filter(id=>!ids.includes(id))];renderRunOrderList();}
    }catch(error){status.className='error';status.textContent=error.message;}finally{buttons.forEach(b=>b.disabled=false);}
  }
  $('#batchImagesBtn').onclick=()=>{$('#batchImagesStatus').textContent='';$('#batchImagesModal').classList.remove('hidden');};
  $('#cancelBatchImages').onclick=()=>$('#batchImagesModal').classList.add('hidden');
  $('#createBatchImages').onclick=()=>createImageBatch(false);
  $('#runBatchImages').onclick=()=>createImageBatch(true);

  function uid(prefix='id') { return `${prefix}-${crypto.randomUUID()}`; }

  function toolIncoming(node,port){return getIncoming(node.id,port).map(sourceFor).filter(Boolean);}
  function toolAsset(node,port='media'){
    const edge=getIncoming(node.id,port)[0],source=sourceFor(edge);if(!source)return null;
    if(edge.sourcePort==='endFrame')return source.data.endFrame||null;
    if(['imageInput','videoInput'].includes(source.type)&&source.data.localDataUrl)return {kind:source.type==='videoInput'?'video':'image',url:source.data.localDataUrl};
    if(source.type==='review')return toolAsset(source,edge.sourcePort==='video'?'video':'reference');
    if(source.type==='characterLock')return source.data.lockedAsset||null;
    return source.data.asset||(source.data.localDataUrl?{kind:source.type==='videoInput'?'video':'image',url:source.data.localDataUrl}:null);
  }
  function toolText(node,port='prompt'){return toolIncoming(node,port).map(source=>resolveText(source.id)).filter(Boolean).join('\n\n');}
  function toolField(body,node,key,label,{type='text',value='',min,max}={}){
    const wrap=document.createElement('label');wrap.textContent=label;const input=document.createElement(type==='textarea'?'textarea':'input');if(type!=='textarea')input.type=type;
    if(type==='checkbox')input.checked=node.data[key]??value;else input.value=node.data[key]??value;if(min!==undefined)input.min=min;if(max!==undefined)input.max=max;
    input.setAttribute('aria-label',label);input.oninput=()=>{node.data[key]=type==='checkbox'?input.checked:input.value;scheduleAutoSave();};wrap.append(input);body.append(wrap);return input;
  }
  function renderTool(node,body){
    const button=(label,action)=>{const el=document.createElement('button');el.type='button';el.textContent=label;el.className='tool-action';el.disabled=state.isRunning;el.onclick=()=>void Promise.resolve().then(action).catch(error=>setRunStatus(error.message,'error'));body.append(el);};
    if(node.type==='characterLock'){
      const field=toolField(body,node,'description','Đặc điểm cố định',{type:'textarea'});field.disabled=!!node.data.lockedAsset;
      if(node.data.lockedAsset){const img=new Image();img.src=node.data.lockedAsset.url;body.append(img);}
      button(node.data.lockedAsset?'Mở khóa để sửa':'Khóa ảnh và đặc điểm',async()=>{
        if(node.data.lockedAsset){delete node.data.lockedAsset;delete node.data.lockedDescription;}
        else{const asset=toolAsset(node,'image');if(!asset||asset.kind!=='image')throw new Error('Nối một ảnh chuẩn trước khi khóa.');node.data.lockedAsset={...asset,url:await blobAsDataUrlFromUrl(asset.url)};node.data.lockedDescription=String(node.data.description||'');}
        node.data.status=node.data.lockedAsset?'success':'idle';node.data.error='';render();saveState();
      });
    }
    if(node.type==='imageRoles'){const hint=document.createElement('p');hint.textContent='Nối ảnh vào đúng cổng. ID và vai trò được đưa vào prompt của node tạo nhận đầu ra này.';body.append(hint);}
    if(node.type==='sceneSplit'){
      toolField(body,node,'text','Kịch bản (hoặc nối đầu vào)',{type:'textarea'});
      const select=document.createElement('select');select.setAttribute('aria-label','Loại node cảnh');for(const [value,label] of [['both','Ảnh và video'],['images','Chỉ ảnh'],['videos','Chỉ video']]){const option=new Option(label,value);select.append(option);}select.value=node.data.sceneMode||'both';select.onchange=()=>{node.data.sceneMode=select.value;scheduleAutoSave();};body.append(select);
      const help=document.createElement('p');help.textContent='Dùng mẫu CẢNH 1 (0:00–0:05): Tên, Prompt ảnh:, Prompt video:. Tạo node rồi bấm chạy để gửi AI.';body.append(help);
      button('Tạo các node cảnh',()=>splitToolScenes(node));
    }
    if(node.type==='review'){const help=document.createElement('p');help.textContent='Nối prompt và ảnh/video vào đây, nối đầu ra sang node tạo. Mỗi lượt chạy sẽ dừng để bạn xem và duyệt.';body.append(help);button('Xem và duyệt',()=>execute(node.id));}
    if(node.type==='qualityCheck'){
      toolField(body,node,'expectedRatio','Tỷ lệ cần kiểm tra (ví dụ 16:9)');toolField(body,node,'expectedDuration','Thời lượng mong muốn (giây)',{type:'number',value:0,min:0});toolField(body,node,'requireAudio','Yêu cầu luồng âm thanh',{type:'checkbox',value:true});button('Kiểm tra tệp',()=>execute(node.id));
    }
    if(node.type==='bundleSave'){toolField(body,node,'folder','Tên thư mục tải về',{value:'Workflow'});button('Tải bộ tệp và prompt',()=>execute(node.id));}
    if(node.data.status||node.data.error){const status=document.createElement('div');status.className='status '+(node.data.status||'idle');status.textContent=node.data.error||({running:'Đang xử lý…',success:'Hoàn tất',error:'Chưa đạt — xem báo cáo',stopped:'Đã dừng',idle:'Sẵn sàng'})[node.data.status]||'Sẵn sàng';body.append(status);}
    if(node.data.report){const report=document.createElement('pre');report.className='tool-report';report.textContent=node.data.report;body.append(report);}
  }
  function splitToolScenes(node){
    if(state.isRunning)throw new Error('Dừng workflow trước khi thêm cảnh.');
    const text=toolText(node)||node.data.text||'',scenes=parseSceneScript(text);if(!scenes.length)throw new Error('Chưa đọc được cảnh. Dùng mẫu CẢNH 1 (0:00–0:05): Tên, kèm Prompt ảnh: hoặc Prompt video:.');
    if(scenes.length>50)throw new Error('Tối đa 50 cảnh mỗi lần.');
    if(node.data.lastSceneText===text&&node.data.lastSceneMode===(node.data.sceneMode||'both')&&node.data.createdIds?.some(id=>nodeById(id)))throw new Error('Kịch bản này đã tạo node. Sửa kịch bản hoặc xóa các node đã tạo trước khi tạo lại.');
    const before=new Set(state.nodes.map(n=>n.id)),oldText=$('#scriptInput').value,oldMode=$('#scriptOutputMode').value;
    try{$('#scriptInput').value=text;$('#scriptOutputMode').value=node.data.sceneMode||'both';buildSceneNodesFromScript();}
    finally{$('#scriptInput').value=oldText;$('#scriptOutputMode').value=oldMode;}
    node.data.createdIds=state.nodes.filter(n=>!before.has(n.id)).map(n=>n.id);node.data.lastSceneText=text;node.data.lastSceneMode=node.data.sceneMode||'both';node.data.report=`Đã tạo ${node.data.createdIds.length} node từ ${scenes.length} cảnh. Chưa gửi AI.`;render();saveState();
  }
  async function reviewTool(node,signal){
    const text=toolText(node);if(!text.trim())throw new Error('Nối prompt vào node duyệt trước.');
    return new Promise((resolve,reject)=>{
      const dialog=document.createElement('dialog');dialog.className='tool-review-dialog';const title=document.createElement('h2');title.textContent='Duyệt prompt và tài liệu trước khi gửi';
      const input=document.createElement('textarea');input.value=text;input.setAttribute('aria-label','Prompt chờ duyệt');dialog.append(title,input);
      for(const ref of resolveReferences(node.id)){const figure=document.createElement('figure'),img=new Image(),caption=document.createElement('figcaption');img.src=ref.url;caption.textContent=ref.componentId+' · '+(ref.roles||[]).join(', ');figure.append(img,caption);dialog.append(figure);}
      for(const url of resolveVideos(node.id)){const video=document.createElement('video');video.controls=true;video.src=url;dialog.append(video);}
      const accept=document.createElement('button'),cancel=document.createElement('button');accept.textContent='Duyệt và tiếp tục';cancel.textContent='Hủy lượt chạy';dialog.append(accept,cancel);document.body.append(dialog);
      let done=false;const finish=ok=>{if(done)return;done=true;signal.removeEventListener('abort',abort);dialog.close();dialog.remove();if(ok){node.data.approvedText=input.value;node.data.text=input.value;resolve();}else reject(new DOMException('Đã hủy duyệt.','AbortError'));};const abort=()=>finish(false);signal.addEventListener('abort',abort,{once:true});dialog.oncancel=e=>{e.preventDefault();finish(false);};cancel.onclick=()=>finish(false);accept.onclick=()=>{if(input.value.trim())finish(true);};dialog.showModal();if(signal.aborted)abort();
    });
  }
  async function checkTool(node,signal){
    const asset=toolAsset(node);if(!asset?.url)throw new Error('Nối ảnh/video có kết quả vào node kiểm tra.');
    let info;
    if(asset.kind==='image')info={kind:'image',...await mediaDimensions(asset.url,'image')};
    else{
      const ffmpeg=new FFmpegWASM.FFmpeg(),logs=[];ffmpeg.on('log',entry=>logs.push(entry.message));try{
        await ffmpeg.load({coreURL:chrome.runtime.getURL('vendor/ffmpeg/ffmpeg-core.js'),wasmURL:chrome.runtime.getURL('vendor/ffmpeg/ffmpeg-core.wasm')},{signal});
        const response=await fetch(asset.url,{signal,credentials:'include'});if(!response.ok)throw new Error('Không tải được video để kiểm tra.');const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length>100*1024*1024)throw new Error('Video kiểm tra vượt 100 MB.');await ffmpeg.writeFile('/check.bin',bytes,{signal});
        await ffmpeg.ffprobe(['-v','error','-show_entries','stream=codec_type,width,height:format=duration','-of','json','/check.bin','-o','/check.json'],-1,{signal});const raw=await ffmpeg.readFile('/check.json','utf8',{signal});const probe=JSON.parse(typeof raw==='string'?raw:new TextDecoder().decode(raw));if(probe.error)throw new Error('Không đọc được cấu trúc video: '+JSON.stringify(probe.error));const video=probe.streams?.find(s=>s.codec_type==='video');if(!video||!Number(video.width)||!Number(video.height))throw new Error('Không đọc được luồng video: '+logs.slice(-3).join(' '));info={kind:'video',width:video.width,height:video.height,duration:Number(probe.format?.duration),hasAudio:probe.streams.some(s=>s.codec_type==='audio')};
      }finally{ffmpeg.terminate();}
    }
    const result=WorkflowTools.assess(info,node.data);node.data.asset=asset;node.data.text=JSON.stringify(result,null,2);node.data.report=(result.passed?'ĐẠT':'CHƯA ĐẠT')+'\n'+node.data.text;node.data.status=result.passed?'success':'error';
  }
  async function saveTool(node,signal){
    const folder=WorkflowTools.safeName(node.data.folder),manifest={createdAt:new Date().toISOString(),files:[],prompts:[]};
    const entries=getIncoming(node.id,'media');if(!entries.length&&!getIncoming(node.id,'text').length)throw new Error('Nối ít nhất một tệp hoặc prompt cần lưu.');
    const download=async(blob,name)=>{if(signal.aborted)throw new DOMException('Đã dừng.','AbortError');const url=URL.createObjectURL(blob);try{await chrome.downloads.download({url,filename:folder+'/'+name,saveAs:false,conflictAction:'uniquify'});}finally{setTimeout(()=>URL.revokeObjectURL(url),60000);}};
    for(const edge of entries){const connected=sourceFor(edge);let source=connected;const trace=new Set();while(source?.type==='qualityCheck'&&!trace.has(source.id)){trace.add(source.id);source=sourceFor(getIncoming(source.id,'media')[0]);}const asset=connected?.type==='qualityCheck'?connected.data.asset:edge.sourcePort==='endFrame'?source?.data.endFrame:(source?.type==='characterLock'?source.data.lockedAsset:source?.data.asset)||(source?.data.localDataUrl?{url:source.data.localDataUrl,kind:source.type==='videoInput'?'video':'image'}:null);if(!asset?.url)throw new Error('Một node được nối chưa có tệp: '+(source?.data.componentId||edge.source));const response=await fetch(asset.url,{credentials:'include',signal});if(!response.ok)throw new Error('Không đọc được tệp để lưu.');const blob=await response.blob(),extension=({'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif','image/avif':'avif','video/quicktime':'mov','video/mp4':'mp4','video/webm':'webm'})[blob.type]||(asset.kind==='video'?'mp4':'png');const name=WorkflowTools.safeName((source.data.sceneLabel||source.data.customName||'Canh')+'-'+source.data.componentId+(edge.sourcePort==='endFrame'?'-END':''))+'.'+extension;await download(blob,name);manifest.files.push({name,id:source.data.componentId,kind:asset.kind});if(['generateImage','generateVideo'].includes(source.type))manifest.prompts.push({id:source.data.componentId,prompt:resolvePrompt(source.id),negative:resolveNegativePrompt(source.id),references:resolveReferences(source.id).map(ref=>({id:ref.componentId,roles:ref.roles,instructions:ref.instructions}))});}
    for(const source of toolIncoming(node,'text'))manifest.prompts.push({id:source.data.componentId,text:resolveText(source.id)});
    await download(new Blob([JSON.stringify(manifest,null,2)],{type:'application/json'}),'prompts-and-files.json');node.data.text=JSON.stringify(manifest,null,2);node.data.report=`Đã yêu cầu tải ${manifest.files.length} tệp và bản kê prompt vào thư mục ${folder}. Kiểm tra trạng thái tải của trình duyệt.`;
  }

  function createUndoSnapshot(label,{preserveRuntime=true}={}){
    const nodes=state.nodes.map(node=>{
      const data={...(node.data||{})};
      if(data.asset&&typeof data.asset==='object')data.asset={...data.asset};
      if(data.endFrame&&typeof data.endFrame==='object')data.endFrame={...data.endFrame};
      if(Array.isArray(data.clipOrder))data.clipOrder=[...data.clipOrder];
      if(data.durations&&typeof data.durations==='object')data.durations={...data.durations};
      return{...node,data};
    });
    undoStack.push({label,preserveRuntime,nodes,edges:state.edges.map(edge=>({...edge})),groups:structuredClone(state.groups||[]),notes:structuredClone(state.notes||[]),settings:structuredClone(state.settings||{})});
    if(undoStack.length>maxUndoSteps)undoStack.shift();
  }

  function undoLastChange(){
    if(state.isRunning){setRunStatus('Stop the running workflow before undoing edits.','warn');return;}
    const previous=undoStack.pop();
    if(!previous){setRunStatus('Nothing to undo.','warn');return;}
    if(previous.preserveRuntime){const runtimeById=new Map(state.nodes.map(node=>[node.id,{type:node.type,data:node.data||{}}]));
      for(const node of previous.nodes){const current=runtimeById.get(node.id);if(!current||current.type!==node.type)continue;const runtime=current.data;for(const key of ['status','error','asset','endFrame',...(node.type==='generateText'?['text']:[])]){if(Object.hasOwn(runtime,key))node.data[key]=runtime[key];else delete node.data[key];}}}
    state.nodes=previous.nodes;state.edges=previous.edges;state.groups=previous.groups||[];state.notes=previous.notes||[];state.settings=previous.settings;
    state.selectedNodeIds=[];state.selectedNodeId=null;state.selectedEdgeIds=[];state.connectingFrom=null;
    normalizeSavedGraph();syncSettingsUI();render();
    setRunStatus(`Undid: ${previous.label}.`,'ok');
  }

  function duplicateNodesForDrag(ids){
    const selected=new Set(ids),copies=new Map(),newNodes=[];
    for(const id of ids){const original=nodeById(id);if(!original)continue;const copy={...original,id:uid(original.type),data:{...(original.data||{})}};copies.set(id,copy.id);newNodes.push(copy);}
    if(!newNodes.length)return[];
    const newEdges=state.edges.filter(edge=>selected.has(edge.target)).map(edge=>({...edge,id:uid('edge'),source:copies.get(edge.source)||edge.source,target:copies.get(edge.target)}));
    state.nodes.push(...newNodes);state.edges.push(...newEdges);
    const newIds=newNodes.map(node=>node.id);state.selectedNodeIds=newIds;state.selectedNodeId=newIds.at(-1)||null;
    return newIds;
  }

  function starter() {
    return {
      nodes: [
        { id: 'prompt-1', type: 'prompt', x: 90, y: 110, data: { text: 'A cinematic portrait of a futuristic Vietnamese woman, neon rain, detailed face' } },
        { id: 'gen-1', type: 'generateImage', x: 450, y: 105, data: { model: 'muse-image', size: '1:1', status: 'idle' } },
        { id: 'preview-1', type: 'preview', x: 820, y: 110, data: {} }
      ],
      edges: [
        { id: 'e1', source: 'prompt-1', sourcePort: 'text', target: 'gen-1', targetPort: 'prompt' },
        { id: 'e2', source: 'gen-1', sourcePort: 'image', target: 'preview-1', targetPort: 'media' }
      ]
    };
  }

  function addNode(type, x=250 + Math.random()*220, y=160 + Math.random()*180) {
    const toolKind=WorkflowTools.aliases[type]?type:null;if(toolKind)type='generateText';
    const dockTimeline=type==='timeline'&&state.nodes.find(node=>node.type==='timeline'&&node.data?.dockOnly);
    if(dockTimeline){createUndoSnapshot('Add Timeline node');dockTimeline.data.dockOnly=false;dockTimeline.x=x;dockTimeline.y=y;render();if($('#timelineDock').classList.contains('collapsed'))toggleTimeline();return;}
    const data = type === 'prompt' ? { text: 'Describe what you want Muse to generate...' } :
      type === 'negativePrompt' ? { text: 'blurry, low quality, distorted anatomy, extra fingers, text, watermark' } :
      type === 'textAppend' ? { text: 'cinematic lighting, detailed composition' } :
      type === 'textConcat' ? { separator: ', ' } :
      type === 'imageResize' ? { width: 1024, height: 1024, fit: 'cover' } :
      type === 'generateText' ? {provider:'gemini',text:'',status:'idle'} :
      type === 'generateImage' ? { model: 'muse-image', size: '1:1', status: 'idle' } :
      type === 'generateVideo' ? { model: 'muse-video', size: '16:9', duration: 5, continuity: false, status: 'idle' } :
      type === 'timeline' ? { clipOrder: [], durations: {} } : {};
    if(toolKind){data.toolKind=toolKind;data.customName=WorkflowTools.aliases[toolKind];data.variantCount=3;}
    createUndoSnapshot(`Add ${nodeDefs[type]?.title||'node'}`);const node={ id: uid(type), type, x, y, data };state.nodes.push(node);
    if(type==='references')syncReferenceFanOut(node);else if(['generateImage','generateVideo','generateText'].includes(type)){const references=state.nodes.find(item=>item.type==='references');if(references)connectReferenceNode(references,node);}
    render();if(type==='timeline'){syncTimelineDock();if($('#timelineDock').classList.contains('collapsed'))toggleTimeline();}
  }

  function addTextNote(x=250+Math.random()*220,y=160+Math.random()*180){createUndoSnapshot('Add text note');const note={id:uid('note'),x,y,text:'Write a note…',width:260,height:160};state.notes.push(note);render();saveState();setRunStatus('Text note added to canvas.','ok');}

  function nodeById(id) { return state.nodes.find(n => n.id === id); }

  function generationNodeTitle(node) {
    const title = node.data?.customName?.trim();
    if (title) return title;
    const typeTitle = WorkflowTools.aliases[node.data.toolKind]||nodeDefs[node.type]?.title || 'Generate';
    const sameType = state.nodes.filter(item => item.type === node.type);
    const number = Math.max(1, sameType.findIndex(item => item.id === node.id) + 1);
    const scene = node.data?.sceneLabel?.trim();
    return `${typeTitle} ${number}${scene ? ` · ${scene}` : ''}`;
  }

  function generationCreationNumber(id) {
    return state.nodes.filter(node => ['generateImage', 'generateVideo', 'generateText'].includes(node.type)).findIndex(node => node.id === id) + 1;
  }

  function removeNode(id) {
    const existing=nodeById(id);if(!existing)return;createUndoSnapshot(`Delete ${nodeDefs[existing.type]?.title||'node'}`);
    state.nodes = state.nodes.filter(n => n.id !== id);
    state.edges = state.edges.filter(e => e.source !== id && e.target !== id);
    state.selectedNodeIds=state.selectedNodeIds.filter(nodeId=>nodeId!==id);if(state.selectedNodeId===id)state.selectedNodeId=state.selectedNodeIds.at(-1)||null;
    render();syncTimelineDock();
  }

  function selectNode(id,{toggle=false,add=false}={}){let ids=[...state.selectedNodeIds];if(toggle){ids=ids.includes(id)?ids.filter(item=>item!==id):[...ids,id];}else if(add){if(!ids.includes(id))ids.push(id);}else ids=[id];state.selectedNodeIds=ids;state.selectedNodeId=ids.at(-1)||null;document.querySelectorAll('.node').forEach(el=>el.classList.toggle('selected',ids.includes(el.dataset.id)));}
  function removeSelectedNodes(){const ids=new Set(state.selectedNodeIds);if(!ids.size&&state.selectedNodeId)ids.add(state.selectedNodeId);if(!ids.size)return;createUndoSnapshot(`Delete ${ids.size} node${ids.size===1?'':'s'}`);state.nodes=state.nodes.filter(node=>!ids.has(node.id));state.edges=state.edges.filter(edge=>!ids.has(edge.source)&&!ids.has(edge.target));state.selectedNodeIds=[];state.selectedNodeId=null;render();saveState();}

  function portCompatible(from, targetNodeId, targetPortId) {
    const sourceNode = nodeById(from.nodeId), targetNode = nodeById(targetNodeId);
    if (!sourceNode || !targetNode || sourceNode.id === targetNode.id) return false;
    const out = (nodeDefs[sourceNode.type].outputs || []).find(p => p.id === from.portId);
    const input = (nodeDefs[targetNode.type].inputs || []).find(p => p.id === targetPortId);
    return Boolean(out && input && canConnectTypes(out.type,input.type));
  }

  function connectionChoices(from){
    const source=nodeById(from.nodeId),output=nodeDefs[source?.type]?.outputs?.find(port=>port.id===from.portId);if(!source||!output)return{existing:[],create:[]};
    const existing=[];for(const target of state.nodes){if(target.id===source.id)continue;for(const input of nodeDefs[target.type]?.inputs||[]){if(!portCompatible(from,target.id,input.id))continue;if(target.type==='timeline'&&getIncoming(target.id,input.id).length)continue;if(wouldCreateCycle(source.id,target.id,isMultiInput(target.type,input.id)?null:input.id))continue;existing.push({kind:'existing',targetId:target.id,targetPort:input.id,label:`${nodeDefs[target.type].title} · ${input.label}${target.data?.dockOnly?' (Timeline dock)':''}`});}}
    const candidates=output.type==='image'?[['references','reference1','References · image 1'],['preview','media','Preview · image'],['imageResize','image','Image Resize'],['generateImage','reference','Generate Image · reference'],['generateVideo','reference','Generate Video · reference']]:output.type==='video'?[['preview','media','Preview · video'],['timeline','clip1','Timeline · add clip']]:output.type==='text'?[['generateImage','prompt','Generate Image · prompt'],['generateVideo','prompt','Generate Video · prompt'],['textAppend','text','Text Append'],['textConcat','text','Text Merge · text']]:output.type==='negative'?[['generateImage','negative','Generate Image · negative'],['generateVideo','negative','Generate Video · negative']]:[];
    const create=candidates.map(([type,port,label])=>({kind:'create',type,targetPort:port,label}));return{existing,create};
  }

  function openConnectionPicker(from,x,y){
    const output=nodeDefs[nodeById(from.nodeId)?.type]?.outputs?.find(port=>port.id===from.portId),choices=connectionChoices(from),menu=$('#canvasMenu'),viewport=$('#viewport').getBoundingClientRect();
    if(!output)return;state.pendingConnection={from:{...from},x:(x-viewport.left-state.panX)/state.zoom,y:(y-viewport.top-state.panY)/state.zoom,choices:[...choices.existing,...choices.create]};menu.innerHTML='';delete menu.dataset.nodeId;delete menu.dataset.edgeId;
    const title=document.createElement('div');title.className='menu-caption';title.textContent=`Send ${output.label} · ${output.type}`;menu.appendChild(title);
    const addSection=label=>{const section=document.createElement('div');section.className='menu-caption';section.textContent=label;menu.appendChild(section);};
    const addChoice=(choice,index)=>{const button=document.createElement('button');button.type='button';button.textContent=choice.label;button.dataset.contextAction='connect-choice';button.dataset.choice=String(index);menu.appendChild(button);};
    if(choices.existing.length){addSection('Connect existing node');choices.existing.forEach((choice,index)=>addChoice(choice,index));}
    if(choices.create.length){addSection('Create a compatible node');choices.create.forEach((choice,index)=>addChoice(choice,choices.existing.length+index));}
    if(!state.pendingConnection.choices.length){const empty=document.createElement('div');empty.className='menu-caption';empty.textContent='No compatible node actions for this output.';menu.appendChild(empty);}
    menu.classList.remove('hidden');menu.style.left=`${Math.max(8,Math.min(x,innerWidth-260))}px`;menu.style.top=`${Math.max(8,Math.min(y,innerHeight-420))}px`;
  }

  function runConnectionChoice(index){
    const pending=state.pendingConnection,choice=pending?.choices?.[index];state.pendingConnection=null;closeCanvasMenu();
    if(!pending||!choice)return;
    if(choice.kind==='existing'){
      state.connectingFrom=pending.from;connect(choice.targetId,choice.targetPort);selectNode(choice.targetId,{add:true});setRunStatus(`Connected to ${choice.label}.`,'ok');return;
    }
    const before=new Set(state.nodes.map(node=>node.id));addNode(choice.type,pending.x-135,pending.y-80);
    const target=state.nodes.find(node=>!before.has(node.id))||state.nodes.find(node=>node.type===choice.type&&node.data?.dockOnly===false&&choice.type==='timeline');if(!target||target.type!==choice.type){setRunStatus('Could not create the selected node.','error');return;}
    state.connectingFrom=pending.from;connect(target.id,choice.targetPort);selectNode(target.id);setRunStatus(`${nodeDefs[target.type].title} created and connected to ${choice.label.split(' · ').at(-1)}.`,'ok');
  }

  function connect(targetNodeId, targetPortId) {
    const from = state.connectingFrom;
    if (!from) return;
    if (!portCompatible(from, targetNodeId, targetPortId)) {
      setRunStatus('Port types are not compatible.', 'error');
      state.connectingFrom = null;
      return;
    }
    const target=nodeById(targetNodeId),source=nodeById(from.nodeId),multi=isMultiInput(target?.type,targetPortId);
    if(wouldCreateCycle(from.nodeId,targetNodeId,multi?null:targetPortId)){setRunStatus('This connection would create a workflow loop. Connect the nodes in one direction.', 'error');state.connectingFrom=null;return;}
    const duplicate=state.edges.some(edge=>edge.source===from.nodeId&&edge.sourcePort===from.portId&&edge.target===targetNodeId&&edge.targetPort===targetPortId);
    const willReplace=!multi&&state.edges.some(edge=>edge.target===targetNodeId&&edge.targetPort===targetPortId&&!(edge.source===from.nodeId&&edge.sourcePort===from.portId));
    if(!duplicate||willReplace)createUndoSnapshot('Connect nodes');
    if(!multi)state.edges=state.edges.filter(edge=>!(edge.target===targetNodeId&&edge.targetPort===targetPortId));
    if(!duplicate)state.edges.push({id:uid('edge'),source:from.nodeId,sourcePort:from.portId,target:targetNodeId,targetPort:targetPortId});
    if(target?.type==='timeline'&&targetPortId.startsWith('clip')&&source?.type==='generateVideo'){
      target.data.clipOrder=target.data.clipOrder||[];if(!target.data.clipOrder.includes(source.id))target.data.clipOrder.push(source.id);
    }
    state.connectingFrom=null;
    render();
  }

  function wouldCreateCycle(sourceId,targetId,replacedPort){const pending=[targetId],seen=new Set();while(pending.length){const id=pending.pop();if(id===sourceId)return true;if(seen.has(id))continue;seen.add(id);for(const edge of state.edges){if(edge.source===id&&!(edge.target===targetId&&edge.targetPort===replacedPort))pending.push(edge.target);}}return false;}

  function nearestCompatibleInput(x,y,from){
    let best=null,bestDistance=44;
    for(const port of document.querySelectorAll('.port.in')){
      if(!portCompatible(from,port.dataset.node,port.dataset.port))continue;
      const rect=port.getBoundingClientRect(),distance=Math.hypot(x-(rect.left+rect.width/2),y-(rect.top+rect.height/2));
      if(distance<bestDistance){best=port;bestDistance=distance;}
    }
    return best;
  }
  function canConnectTypes(outputType,inputType){return outputType===inputType||inputType==='media'&&['image','video'].includes(outputType);}
  function isMultiInput(nodeType,portId){return nodeType==='bundleSave'||nodeType==='review'&&portId==='reference'||['generateImage','generateVideo','generateText'].includes(nodeType)&&['prompt','reference'].includes(portId)||nodeType==='references'&&portId.startsWith('reference')||nodeType==='textConcat'&&portId==='text';}
  function connectReferenceNode(references,generator){if(!references||!generator||!['generateImage','generateVideo','generateText'].includes(generator.type))return;const duplicate=state.edges.some(edge=>edge.source===references.id&&edge.sourcePort==='image'&&edge.target===generator.id&&edge.targetPort==='reference');if(!duplicate)state.edges.push({id:uid('edge'),source:references.id,sourcePort:'image',target:generator.id,targetPort:'reference'});}
  function syncReferenceFanOut(references){for(const generator of state.nodes.filter(node=>['generateImage','generateVideo','generateText'].includes(node.type)))connectReferenceNode(references,generator);}

  function makeNode(type,x,y){
    const data=type==='prompt'?{text:'Describe what you want Muse to generate...'}:type==='negativePrompt'?{text:'blurry, low quality, distorted anatomy, extra fingers, text, watermark'}:type==='imageInput'?{}:type==='generateVideo'?{model:'muse-video',size:'16:9',duration:5,continuity:false,status:'idle'}:{};
    return{id:uid(type),type,x,y,data};
  }

  function scriptField(section,label,nextLabels){
    const startPattern=new RegExp(`^\\s*(?:[A-E]\\)\\s*)?(?:\\[)?${label}(?:\\])?\\s*:\\s*`,'im'),match=startPattern.exec(section);if(!match)return'';
    const start=match.index+match[0].length,tail=section.slice(start),stop=nextLabels.length?new RegExp(`^\\s*(?:[A-E]\\)\\s*)?(?:\\[)?(?:${nextLabels.join('|')})(?:\\])?\\s*:`,'im').exec(tail):null;
    return tail.slice(0,stop?stop.index:tail.length).trim();
  }
  function extractBracketLocks(text){const pattern=/^\s*\[([A-Z][A-Z0-9_]*)\][^\r\n]*:\s*$/gim,matches=[...text.matchAll(pattern)],blocks={};for(let index=0;index<matches.length;index++){const match=matches[index],start=match.index+match[0].length,nextLock=matches[index+1]?.index??text.length,tail=text.slice(start,nextLock),nextSection=/^\s*(?:\d+\.\s+\S|(?:CẢNH|SCENE)\s+\d+\s*\()/gim.exec(tail),end=nextSection?start+nextSection.index:nextLock,key=match[1].toLowerCase();blocks[key]=text.slice(start,end).trim().replace(/^(?:CHARACTER_[A-Z0-9_]+|SET_[A-Z0-9_]+)\s*:\s*/i,'');}return blocks;}
  function expandScriptLocks(text,locks){return String(text||'').replace(/\[([A-Z][A-Z0-9_ ]*)\]/gi,(token,key)=>{const normalized=key.toLowerCase(),canonical=normalized==='character lock'?'char lock':normalized;return locks[canonical]||locks[normalized.replaceAll(' ','_')]||token;});}
  function withPromptContext(prompt,context,before=true){const value=String(prompt||'').trim(),parts=context.filter(Boolean).filter(part=>!value.includes(part));return before?[...parts,value].filter(Boolean).join('\n\n'):[value,...parts].filter(Boolean).join('\n\n');}
  function parseSceneScript(text){
    const heading=/^\s*(?:#{1,6}\s*)?(?:CẢNH|SCENE)\s+(\d+)\s*\(([^)]*)\)\s*:\s*(.*?)\s*$/gim,matches=[...text.matchAll(heading)];if(!matches.length)return[];
    const preamble=text.slice(0,matches[0].index),namedLocks=extractBracketLocks(preamble),locks={...namedLocks,
      'char lock':scriptField(preamble,'(?:CHAR(?:ACTER)?\\s*LOCK|NHÂN VẬT(?:\\s+THAM GIA)?)',['STYLE\\s*LOCK','PHONG CÁCH VÀ KỸ THUẬT','SET\\s*LOCK','VIDEO\\s*SUFFIX','NEGATIVE','C\\)'])||namedLocks['char lock']||namedLocks['character lock']||'',
      'style lock':scriptField(preamble,'(?:STYLE\\s*LOCK|PHONG CÁCH VÀ KỸ THUẬT)',['SET\\s*LOCK','VIDEO\\s*SUFFIX','NEGATIVE','C\\)'])||namedLocks.style||namedLocks['style lock']||'',
      'set lock':scriptField(preamble,'(?:SET\\s*LOCK|BỐI CẢNH\\s*LOCK)',['VIDEO\\s*SUFFIX','NEGATIVE','C\\)'])||namedLocks['set lock']||'',
      'video suffix':scriptField(preamble,'VIDEO\\s*SUFFIX',['NEGATIVE','C\\)'])||namedLocks.suffix||namedLocks['video suffix']||'',
      negative:namedLocks.negative||scriptField(preamble,'(?:NEGATIVE(?:\\s+PROMPT)?|PROMPT\\s+ÂM)',['SET\\s*LOCK','VIDEO\\s*SUFFIX','C\\)'])||''
    };
    for(const key of Object.keys(locks))if(/^\[[^\]]+\]$/.test(locks[key]))locks[key]='';
    return matches.map((match,index)=>{
      const body=text.slice(match.index+match[0].length,matches[index+1]?.index??text.length),fieldStops=['Khung\\s+đầu','Khung\\s+cuối','Diễn\\s+biến','Prompt\\s+ảnh','Prompt\\s+video','Audio','Negative(?:\\s+prompt)?','Checklist','Tự\\s+kiểm\\s+tra','[A-E]\\)'];
      const opening=scriptField(body,'Khung\\s+đầu',fieldStops.filter(label=>label!=='Khung\\s+đầu')),
        ending=scriptField(body,'Khung\\s+cuối',fieldStops.filter(label=>label!=='Khung\\s+cuối')),
        beats=scriptField(body,'Diễn\\s+biến',fieldStops.filter(label=>label!=='Diễn\\s+biến')),
        rawImage=scriptField(body,'Prompt\\s+ảnh(?:\\s+khung\\s+đầu)?',['Khung\\s+cuối','Diễn\\s+biến','Prompt\\s+video','Audio','Negative(?:\\s+prompt)?','Checklist','[A-E]\\)']),
        rawVideo=scriptField(body,'Prompt\\s+video',['Audio','Negative(?:\\s+prompt)?','Checklist','[A-E]\\)']),
        audio=scriptField(body,'Audio',['Negative(?:\\s+prompt)?','Checklist','[A-E]\\)']),
        sceneNegative=scriptField(body,'(?:Negative(?:\\s+prompt)?|Prompt\\s+âm)',['Checklist','[A-E]\\)']),
        range=match[2].match(/(\d+):(\d{2})\s*(?:đến|to|[–—-])\s*(\d+):(\d{2})/i);
      const seconds=range?(Number(range[3])*60+Number(range[4]))-(Number(range[1])*60+Number(range[2])):0;
      let imagePrompt=expandScriptLocks(rawImage,locks),videoPrompt=expandScriptLocks(rawVideo,locks);
      if(rawImage)imagePrompt=withPromptContext(imagePrompt,[locks['char lock'],locks['style lock']]);
      const videoContext=[locks['set lock'],locks['char lock'],locks['style lock']];
      if(rawVideo)videoPrompt=withPromptContext(videoPrompt,videoContext);
      if(opening&&!imagePrompt.toLowerCase().includes(opening.toLowerCase()))imagePrompt=`${imagePrompt}\n\nOpening frame composition: ${opening}`.trim();
      const videoDetails=[beats?`Timed action beats:\n${beats}`:'',ending?`Final frame to reach: ${ending}`:'',audio?`Audio direction: ${audio}. No speech.`:''];
      if(rawVideo)videoPrompt=[videoPrompt,...videoDetails].filter(Boolean).join('\n\n');
      if(locks['video suffix']&&!videoPrompt.includes(locks['video suffix']))videoPrompt=`${videoPrompt}\n\n${locks['video suffix']}`.trim();
      const negative=expandScriptLocks(sceneNegative||locks.negative,locks),ratio=(imagePrompt+' '+videoPrompt+' '+preamble).match(/\b(9:16|16:9|1:1|4:3|3:4)\b/);
      return{number:Number(match[1]),title:match[3].trim(),imagePrompt,videoPrompt,hasImagePrompt:Boolean(rawImage),hasVideoPrompt:Boolean(rawVideo),negative,seconds:seconds>0?seconds:6,size:ratio?.[1]||'9:16'};
    }).filter(scene=>scene.hasImagePrompt||scene.hasVideoPrompt);
  }
  function buildSceneNodesFromScript(){
    const status=$('#scriptImportStatus'),mode=$('#scriptOutputMode').value,scenes=parseSceneScript($('#scriptInput').value).map(scene=>({...scene,hasImagePrompt:mode==='videos'?false:scene.hasImagePrompt,hasVideoPrompt:mode==='images'?false:scene.hasVideoPrompt})).filter(scene=>scene.hasImagePrompt||scene.hasVideoPrompt);
    if(!scenes.length){status.className='error';status.textContent='No scenes found. Use headings like “CẢNH 1 (0:00–0:07): Title” or “Scene 1 (0:00–0:05): Title”, then add Prompt ảnh or Prompt video.';return;}
    createUndoSnapshot('Create nodes from script');const baseY=Math.max(40,...state.nodes.filter(node=>!node.data?.dockOnly).map(node=>node.y+Math.max(360,document.querySelector(`.node[data-id="${CSS.escape(node.id)}"]`)?.offsetHeight||0)+260)),createdVideos=[];let made=0;
    scenes.forEach((scene,index)=>{
      const column=index%4,row=Math.floor(index/4),x=80+column*650,y=baseY+row*1100,label=`Scene ${scene.number}${scene.title?`: ${scene.title}`:''}`;
      let imageNode=null,videoNode=null;
      if(scene.hasImagePrompt){const prompt=makeNode('prompt',x,y);prompt.data={text:scene.imagePrompt,sceneLabel:label};const image=makeNode('generateImage',x+330,y);image.data={provider:$('#scriptImageProvider').value,model:'muse-image',size:scene.size,status:'idle',sceneLabel:label};state.nodes.push(prompt,image);state.edges.push({id:uid('edge'),source:prompt.id,sourcePort:'text',target:image.id,targetPort:'prompt'});imageNode=image;made+=2;}
      if(scene.hasVideoPrompt){const prompt=makeNode('prompt',x,y+540);prompt.data={text:scene.videoPrompt,sceneLabel:label};const requestedDuration=[4,5,6,8,10,15,20,30,60].reduce((best,value)=>Math.abs(value-scene.seconds)<Math.abs(best-scene.seconds)?value:best,5);videoNode=makeNode('generateVideo',x+330,y+540);videoNode.data={model:'muse-video',size:scene.size,duration:requestedDuration,continuity:createdVideos.length>0,status:'idle',sceneLabel:label};state.nodes.push(prompt,videoNode);state.edges.push({id:uid('edge'),source:prompt.id,sourcePort:'text',target:videoNode.id,targetPort:'prompt'});if(imageNode)state.edges.push({id:uid('edge'),source:imageNode.id,sourcePort:'image',target:videoNode.id,targetPort:'reference'});made+=2;createdVideos.push({node:videoNode,seconds:requestedDuration});}
      if(scene.negative){const negative=makeNode('negativePrompt',x,y+270);negative.data={text:scene.negative,sceneLabel:label};state.nodes.push(negative);if(imageNode)state.edges.push({id:uid('edge'),source:negative.id,sourcePort:'text',target:imageNode.id,targetPort:'negative'});if(videoNode)state.edges.push({id:uid('edge'),source:negative.id,sourcePort:'text',target:videoNode.id,targetPort:'negative'});made++;}
    });
    let references=state.nodes.find(node=>node.type==='references');if(!references){const minX=Math.min(80,...state.nodes.filter(node=>!node.data?.dockOnly).map(node=>node.x));references=makeNode('references',minX-360,baseY);references.data={};state.nodes.push(references);made++;}syncReferenceFanOut(references);
    if(createdVideos.length){const timeline=ensureDockTimeline();timeline.data.clipOrder=[...timeline.data.clipOrder,...createdVideos.map(item=>item.node.id)];timeline.data.durations=timeline.data.durations||{};createdVideos.forEach(({node,seconds})=>{timeline.data.durations[node.id]=seconds;});}
    $('#scriptModal').classList.add('hidden');render();saveState();if(createdVideos.length&&$('#timelineDock').classList.contains('collapsed'))toggleTimeline();
    setRunStatus(`Created ${scenes.length} scenes · ${made} nodes · ${createdVideos.length} video clips ordered on the Timeline.`,'ok');
  }

  function screenToCanvas(x,y){const rect=$('#viewport').getBoundingClientRect();return{x:x-rect.left,y:y-rect.top};}

  function startWire(e,nodeId,portId){
    if(e.button!==undefined&&e.button!==0)return;
    e.preventDefault();e.stopPropagation();
    state.draggingWire={nodeId,portId};state.connectingFrom={nodeId,portId};state.wireMoved=false;
    const sourceForCapture=nodeById(nodeId);
    if(!(sourceForCapture?.type==='generateVideo'&&portId==='video'))try{e.currentTarget.setPointerCapture(e.pointerId);}catch{}
    state.wirePointer={x:e.clientX,y:e.clientY};state.wireOrigin={x:e.clientX,y:e.clientY};
    document.querySelectorAll('.port.in').forEach(port=>{if(portCompatible({nodeId,portId},port.dataset.node,port.dataset.port))port.classList.add('wire-compatible');});
  }

  function startWireFromInput(e,nodeId,portId,portType){
    if(e.button!==undefined&&e.button!==0)return;e.preventDefault();e.stopPropagation();state.draggingWire={nodeId,portId,direction:'in',portType};state.wireMoved=false;state.wirePointer={x:e.clientX,y:e.clientY};state.wireOrigin={x:e.clientX,y:e.clientY};
    try{e.currentTarget.setPointerCapture(e.pointerId);}catch{}
    document.querySelectorAll('.port.out').forEach(port=>{if(portCompatible({nodeId:port.dataset.node,portId:port.dataset.port},nodeId,portId))port.classList.add('wire-compatible');});
  }

  function onWireMove(e){
    if(!state.draggingWire)return;
    if(state.wireOrigin&&Math.hypot(e.clientX-state.wireOrigin.x,e.clientY-state.wireOrigin.y)>5)state.wireMoved=true;
      const source=nodeById(state.draggingWire.nodeId),dock=$('#timelineDock'),overDock=timelineMedia(source)&&['video','image'].includes(state.draggingWire.portId)&&(()=>{const r=dock.getBoundingClientRect();return e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;})();
    dock.classList.toggle('wire-drop-target',Boolean(overDock));
    if(overDock&&dock.classList.contains('collapsed'))toggleTimeline();
    state.wirePointer={x:e.clientX,y:e.clientY};scheduleDrawEdges();
  }

  function onWireUp(e){
    if(!state.draggingWire)return;
    const from=state.draggingWire,moved=state.wireMoved,source=nodeById(from.nodeId),dock=$('#timelineDock'),r=dock.getBoundingClientRect(),droppedOnTimeline=timelineMedia(source)&&['video','image'].includes(from.portId)&&e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;
    state.draggingWire=null;state.wirePointer=null;state.wireOrigin=null;
    dock.classList.remove('wire-drop-target');
    document.querySelectorAll('.wire-compatible').forEach(port=>port.classList.remove('wire-compatible'));
    if(moved&&from.direction==='in'){
      const output=nearestCompatibleOutput(e.clientX,e.clientY,from);
      if(output){state.connectingFrom={nodeId:output.dataset.node,portId:output.dataset.port};connect(from.nodeId,from.portId);}
      else{const rect=$('#viewport').getBoundingClientRect(),emptyCanvas=!document.elementFromPoint(e.clientX,e.clientY)?.closest('.node'),inside=e.clientX>=rect.left&&e.clientX<=rect.right&&e.clientY>=rect.top&&e.clientY<=rect.bottom,type=from.portType==='negative'?'negativePrompt':'prompt';if(inside&&emptyCanvas){addNode(type,(e.clientX-rect.left-state.panX)/state.zoom-135,(e.clientY-rect.top-state.panY)/state.zoom-80);const created=state.nodes.at(-1);state.connectingFrom={nodeId:created.id,portId:'text'};connect(from.nodeId,from.portId);setRunStatus(`${nodeDefs[type].title} created and connected.`,'ok');}else setRunStatus('Drop on an output port or on empty canvas to create a prompt node.','warn');}
      state.suppressPortClick=true;setTimeout(()=>state.suppressPortClick=false,80);scheduleDrawEdges();return;
    }
    if(moved){
      if(droppedOnTimeline){addTimelineClip(ensureDockTimeline(),source.id);state.connectingFrom=null;state.suppressPortClick=true;setTimeout(()=>state.suppressPortClick=false,80);scheduleDrawEdges();return;}
      const hit=nearestCompatibleInput(e.clientX,e.clientY,from);
      if(hit){state.connectingFrom=from;connect(hit.dataset.node,hit.dataset.port);}
      else {const rect=$('#viewport').getBoundingClientRect(),inside=e.clientX>=rect.left&&e.clientX<=rect.right&&e.clientY>=rect.top&&e.clientY<=rect.bottom;if(inside)openConnectionPicker(from,e.clientX,e.clientY);else{state.connectingFrom=null;setRunStatus('Drop the output on the canvas to choose a compatible node.','warn');}}
      state.suppressPortClick=true;setTimeout(()=>state.suppressPortClick=false,80);
    }
    scheduleDrawEdges();
  }

  function nearestInputPort(x,y){
    const direct=document.elementsFromPoint(x,y).map(el=>el.closest?.('.port.in')).filter(Boolean);
    const candidates=[...new Set([...direct,...document.querySelectorAll('.port.in.wire-compatible')])];
    let best=null,distance=Infinity;
    for(const port of candidates){if(!port.classList.contains('wire-compatible'))continue;const r=port.getBoundingClientRect(),d=Math.hypot(x-(r.left+r.width/2),y-(r.top+r.height/2));if(d<distance){best=port;distance=d;}}
    return best&&distance<=38?best:null;
  }
  function nearestCompatibleOutput(x,y,target){let best=null,distance=44;for(const port of document.querySelectorAll('.port.out')){if(!portCompatible({nodeId:port.dataset.node,portId:port.dataset.port},target.nodeId,target.portId))continue;const rect=port.getBoundingClientRect(),d=Math.hypot(x-(rect.left+rect.width/2),y-(rect.top+rect.height/2));if(d<distance){best=port;distance=d;}}return best;}
  function normalizeSavedGraph(){
    const knownNodes=new Set(Object.keys(nodeDefs));
    state.notes=Array.isArray(state.notes)?state.notes:[];
    for(const legacy of state.nodes.filter(node=>node?.type==='text'))if(!state.notes.some(note=>note.id===`note-${legacy.id}`))state.notes.push({id:`note-${legacy.id}`,x:Number(legacy.x)||0,y:Number(legacy.y)||0,text:String(legacy.data?.text||''),width:260,height:160});
    state.nodes=state.nodes.filter(node=>node?.type!=='text');
    const seenNodeIds=new Set();
    state.nodes=state.nodes.filter(node=>{if(!node||!knownNodes.has(node.type)||typeof node.id!=='string'||seenNodeIds.has(node.id))return false;seenNodeIds.add(node.id);return true;});
    for(const node of state.nodes)if(!node.data||typeof node.data!=='object'||Array.isArray(node.data))node.data={};
    for(const node of state.nodes)if(node.type==='timeline'){
      node.data.clipOrder=Array.isArray(node.data.clipOrder)?[...new Set(node.data.clipOrder.filter(id=>state.nodes.some(item=>item.id===id&&timelineMedia(item))))]:[];
      if(!node.data.durations||typeof node.data.durations!=='object'||Array.isArray(node.data.durations))node.data.durations={};
    }
    const normalized=[];
    for(const raw of state.edges){
      if(!raw||typeof raw.source!=='string'||typeof raw.target!=='string')continue;
      const source=nodeById(raw.source),target=nodeById(raw.target);
      if(!source||!target||source.id===target.id)continue;
      const outputs=nodeDefs[source.type].outputs||[],inputs=nodeDefs[target.type].inputs||[];
      // Only infer port names for old single-port edges; never guess between semantic ports.
      const sourcePort=raw.sourcePort|| (outputs.length===1?outputs[0].id:null);
      const sourceDef=outputs.find(port=>port.id===sourcePort);
      const compatibleInputs=inputs.filter(port=>sourceDef&&canConnectTypes(sourceDef.type,port.type));
      const legacyMergePort=target.type==='textConcat'&&['a','b'].includes(raw.targetPort);
      const targetPort=legacyMergePort?'text':raw.targetPort|| (compatibleInputs.length===1?compatibleInputs[0].id:null);
      const inputDef=inputs.find(port=>port.id===targetPort);
      if(!sourceDef||!inputDef||!canConnectTypes(sourceDef.type,inputDef.type))continue;
      normalized.push({...raw,id:raw.id||uid('edge'),sourcePort,targetPort});
    }
    // Normal inputs are single-source; prompt and reference inputs retain distinct sources.
    const occupied=new Set(),unique=[];
    for(let index=normalized.length-1;index>=0;index--){const edge=normalized[index],key=isMultiInput(nodeById(edge.target)?.type,edge.targetPort)?`${edge.target}:${edge.targetPort}:${edge.source}:${edge.sourcePort}`:`${edge.target}:${edge.targetPort}`;if(occupied.has(key))continue;occupied.add(key);unique.push(edge);}
    state.edges=unique.reverse();
    state.groups=Array.isArray(state.groups)?state.groups.filter(group=>group&&Number.isFinite(group.x)&&Number.isFinite(group.y)&&Number.isFinite(group.width)&&Number.isFinite(group.height)&&group.width>0&&group.height>0).map(group=>({...group,id:typeof group.id==='string'?group.id:uid('group'),name:String(group.name||'Group'),nodeIds:Array.isArray(group.nodeIds)?group.nodeIds.filter(id=>seenNodeIds.has(id)):[]})):[];
  }
  function renderNode(n) {
    const el = document.createElement('section');
    el.className = `node ${['generateImage','generateVideo','generateText'].includes(n.type) ? 'generate' : ''} ${n.type==='timeline'?'timeline-node':''} ${state.selectedNodeIds.includes(n.id)||state.selectedNodeId===n.id ? 'selected' : ''}`;
    el.dataset.id = n.id;
    el.style.left = `${n.x}px`;
    el.style.top = `${n.y}px`;
    const head = document.createElement('div');
    head.className = 'node-header';
    const title=document.createElement('span');title.className='node-title';title.textContent=['generateImage','generateVideo','generateText'].includes(n.type)?generationNodeTitle(n):(n.data.customName||`${nodeDefs[n.type].title}${n.data.sceneLabel?` · ${n.data.sceneLabel}`:''}`);title.title=title.textContent;
    const rename=document.createElement('button');rename.type='button';rename.className='node-rename';rename.title='Rename node';rename.setAttribute('aria-label',`Rename ${title.textContent}`);rename.textContent='✎';
    rename.onclick=event=>{event.stopPropagation();openNodeRenameModal(n.id);};
    const close=document.createElement('span');close.className='node-close';close.title='Delete';close.textContent='×';head.append(title,rename,close);
    head.querySelector('.node-close').onclick = (e) => { e.stopPropagation(); removeNode(n.id); };
    setupDrag(head, n, el);
    el.appendChild(head);

    const body = document.createElement('div');
    body.className = 'node-body';
    const identity=document.createElement('button');identity.type='button';identity.className='node-component-id';identity.textContent=`ID: ${n.data.componentId}`;identity.title='Bấm để sao chép ID vào prompt';identity.onclick=()=>void navigator.clipboard.writeText(n.data.componentId).then(()=>setRunStatus('Đã sao chép '+n.data.componentId,'ok')).catch(()=>setRunStatus('ID: '+n.data.componentId,'warn'));head.insertBefore(identity,rename);
    if(['generateImage','generateVideo','generateText'].includes(n.type)){const refs=resolveReferences(n.id);if(refs.length){const list=document.createElement('div');list.className='reference-id-list';list.textContent=refs.map((ref,index)=>`Ảnh ${index+1}: ${ref.componentId}`).join(' · ');body.append(list);}}


    if (['prompt','negativePrompt','textAppend'].includes(n.type)) {
      const ta = document.createElement('textarea');
      ta.value = n.data.text || '';
      ta.oninput = () => n.data.text = ta.value;
      body.appendChild(ta);
      if(n.type==='negativePrompt'){const hint=document.createElement('div');hint.className='hint';hint.textContent='Connect to the negative input on an image or video node.';body.appendChild(hint);}
      if(n.type==='textAppend'){const hint=document.createElement('div');hint.className='hint';hint.textContent='Appends this text to an incoming prompt.';body.appendChild(hint);}
    }

    if(n.type==='textConcat'){
      const separator=document.createElement('input');separator.value=n.data.separator??', ';separator.placeholder='Separator';separator.oninput=()=>n.data.separator=separator.value;body.append('Join connected text inputs with:',separator);
    }

    if (n.type === 'imageInput' || n.type === 'videoInput') {
      if (n.data.localDataUrl) {
        const img = document.createElement(n.type==='videoInput'?'video':'img'); if(n.type==='videoInput')img.controls=true; img.src = n.data.localDataUrl; body.appendChild(img);
      } else {
        const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = 'Chưa chọn tệp'; body.appendChild(empty);
      }
      const label = document.createElement('label');
      label.className = 'small-btn'; label.textContent = n.type==='videoInput'?'Chọn video gốc':'Chọn ảnh';
      const input = document.createElement('input'); input.type = 'file'; input.accept = n.type==='videoInput'?'video/*':'image/*';
      input.onchange=()=>{if(input.files?.length)void importMediaFiles([...input.files],{node:n}).catch(error=>setRunStatus(error.message,'error'));};
      body.classList.add('media-input-zone');body.tabIndex=0;body.setAttribute('aria-label',n.type==='videoInput'?'Thả hoặc dán video':'Thả hoặc dán ảnh');
      const dropHint=document.createElement('small');dropHint.className='media-drop-hint';dropHint.textContent=n.type==='videoInput'?'Kéo video vào đây hoặc chọn tệp':'Kéo ảnh vào đây hoặc bấm vào node rồi Ctrl+V';body.append(dropHint);
      label.appendChild(input); body.appendChild(label);
      const hint = document.createElement('div'); hint.className = 'hint'; hint.textContent = n.type==='videoInput'?'Nối video vào cổng Video gốc của Tạo văn bản hoặc Video chuyển động của Tạo video.':'Nối ảnh vào cổng Ảnh tham chiếu của node tạo.'; body.appendChild(hint);
    }

    if(WorkflowTools.definitions[n.type])renderTool(n,body);
    if(n.type==='references'){
      const incoming=(nodeDefs.references.inputs||[]).reduce((count,input)=>count+getIncoming(n.id,input.id).length,0),badge=document.createElement('span');badge.className='ref-badge';badge.textContent=`${incoming} image source${incoming===1?'':'s'} connected`;body.appendChild(badge);
      const list=document.createElement('div');list.className='references-input-list';(nodeDefs.references.inputs||[]).forEach(input=>{const row=document.createElement('div');row.textContent=`${input.label} · connect image source`;list.appendChild(row);});body.appendChild(list);
      const hint=document.createElement('div');hint.className='hint';hint.textContent='All connected images are sent to every connected Generate Image and Generate Video node.';body.appendChild(hint);
    }

    if(['generateImage','generateVideo','generateText'].includes(n.type))body.appendChild(providerControls(n));
    if(n.type==='generateText'){
      if(n.data.toolKind==='promptVariants'){toolField(body,n,'variantCount','Số biến thể',{type:'number',value:3,min:2,max:10});toolField(body,n,'variationStyle','Định hướng biến thể',{value:'góc máy, ánh sáng và bối cảnh'});}
      if(n.data.toolKind==='promptVariants'){const variants=WorkflowTools.variants(n.data.text);if(variants.length){const select=document.createElement('select');select.setAttribute('aria-label','Biến thể dùng làm đầu ra');variants.forEach((text,index)=>select.append(new Option(`Biến thể ${index+1}: ${text.slice(0,40)}`,String(index))));select.value=String(Math.min(variants.length-1,Number(n.data.selectedVariant)||0));select.onchange=()=>{n.data.selectedVariant=Number(select.value);scheduleAutoSave();};body.append(select);}}
      const output=document.createElement('textarea');output.readOnly=true;output.value=n.data.text||'';output.placeholder='Kết quả văn bản sẽ xuất hiện tại đây';body.appendChild(output);
      const st=document.createElement('div');st.className=`status ${n.data.status||'idle'}`;st.textContent=n.data.error||(n.data.status==='running'?n.data.progress||'Đang chuẩn bị…':n.data.status)||'Sẵn sàng';body.appendChild(st);body.appendChild(createNodeRunActions(n));const use=document.createElement('button');use.textContent='Dùng kết quả làm kịch bản';use.disabled=!n.data.text;use.onclick=()=>{$('#scriptInput').value=resolveText(n.id);$('#scriptModal').classList.remove('hidden');};body.appendChild(use);
    }
    if (n.type === 'generateImage') {
      const controls = document.createElement('div'); controls.className = 'gen-controls';
      const size = document.createElement('select');
      [['1:1','Square'],['16:9','Landscape 16:9'],['9:16','Portrait 9:16'],['4:3','Landscape 4:3'],['3:4','Portrait 3:4']].forEach(([v,label]) => { const o=document.createElement('option'); o.value=v; o.textContent=label; size.appendChild(o); });
      size.value = ['1:1','16:9','9:16','4:3','3:4'].includes(n.data.size)?n.data.size:'1:1'; size.onchange = () => n.data.size = size.value;
      const model = document.createElement('input'); model.value = n.data.model || 'muse-image'; model.placeholder = 'muse-image'; model.oninput = () => n.data.model = model.value;
      controls.append(size);if((n.data.provider||'muse')==='muse')controls.append(model); body.appendChild(controls);
      const st = document.createElement('div'); st.className = `status ${n.data.status || 'idle'}`; st.textContent = n.data.status==='running'&&n.data.progress?n.data.progress:`${n.data.status || 'idle'}${n.data.error ? ' · ' + n.data.error : ''}`; body.appendChild(st);
      if(n.data.asset?.width&&n.data.asset?.height){const dimensions=document.createElement('div');dimensions.className=`hint ${n.data.asset.sizeMismatch?'error':''}`;dimensions.textContent=`Yêu cầu ${n.data.asset.requestedSize||n.data.size} · thực tế ${n.data.asset.width} × ${n.data.asset.height}${n.data.asset.actualDuration?' · '+n.data.asset.actualDuration.toFixed(1)+' giây':''}${n.data.asset.sizeMismatch?' (AI trả về tỷ lệ khác)':''}`;body.appendChild(dimensions);}
      if (n.data.asset?.url) { const a=document.createElement('a'); a.href=n.data.asset.url; a.target='_blank'; a.className='image-link'; const img=document.createElement('img'); img.src=n.data.asset.url; a.appendChild(img); body.appendChild(a); }
      const promptCount=getIncoming(n.id,'prompt').length;if(promptCount>1){const b=document.createElement('span');b.className='ref-badge';b.textContent=`${promptCount} prompt sources combined`;body.appendChild(b);}
      const referenceCount=getIncoming(n.id,'reference').length;if(referenceCount){const b=document.createElement('span');b.className='ref-badge';b.textContent=`${referenceCount} reference image${referenceCount===1?'':'s'} connected`;body.appendChild(b);}
      body.appendChild(createNodeRunActions(n));
    }

    if(n.type==='generateVideo'){
      const controls=document.createElement('div');controls.className='gen-controls video-controls';
      const ratio=document.createElement('select');[['16:9','Landscape 16:9'],['9:16','Portrait 9:16'],['1:1','Square']].forEach(([v,label])=>{const o=document.createElement('option');o.value=v;o.textContent=label;ratio.appendChild(o);});ratio.value=['16:9','9:16','1:1'].includes(n.data.size)?n.data.size:'16:9';ratio.onchange=()=>n.data.size=ratio.value;
      const duration=document.createElement('select');[4,5,6,8,10,15,20,30,60].forEach(v=>{const o=document.createElement('option');o.value=String(v);o.textContent=`${v}s`;duration.appendChild(o);});duration.value=String(n.data.duration||5);duration.onchange=()=>n.data.duration=Number(duration.value);
      controls.append(ratio,duration);body.appendChild(controls);
      const continuityLabel=document.createElement('label');continuityLabel.className='continuity-toggle';continuityLabel.htmlFor=`continuity-${n.id}`;continuityLabel.onpointerdown=event=>event.stopPropagation();const continuity=document.createElement('input');continuity.id=`continuity-${n.id}`;continuity.type='checkbox';continuity.checked=Boolean(n.data.continuity);continuity.onchange=()=>{n.data.continuity=continuity.checked;scheduleAutoSave();};continuityLabel.append(continuity,document.createTextNode('Use previous clip end frame as start reference'));body.appendChild(continuityLabel);
      if(n.data.endFrame?.url){const frame=document.createElement('img');frame.className='end-frame-thumb';frame.src=n.data.endFrame.url;frame.alt='Extracted final frame for continuity';frame.title='Video end frame · connect “end frame” to the next video reference';body.appendChild(frame);}
      const status=document.createElement('div');status.className=`status ${n.data.status||'idle'}`;status.textContent=n.data.status==='running'&&n.data.progress?n.data.progress:`${n.data.status||'idle'}${n.data.error?' · '+n.data.error:''}`;body.appendChild(status);
      if(n.data.asset?.width&&n.data.asset?.height){const dimensions=document.createElement('div');dimensions.className=`hint ${n.data.asset.sizeMismatch?'error':''}`;dimensions.textContent=`Yêu cầu ${n.data.asset.requestedSize||n.data.size} · thực tế ${n.data.asset.width} × ${n.data.asset.height}${n.data.asset.actualDuration?' · '+n.data.asset.actualDuration.toFixed(1)+' giây':''}${n.data.asset.sizeMismatch?' (AI trả về tỷ lệ khác)':''}`;body.appendChild(dimensions);}
      if(n.data.asset?.url){const video=document.createElement('video');video.controls=true;video.preload='metadata';video.src=n.data.asset.url;body.appendChild(video);}
      const timelineDrag=document.createElement('button');timelineDrag.type='button';timelineDrag.className='video-timeline-drag';timelineDrag.draggable=true;timelineDrag.innerHTML='<span aria-hidden="true">⠿</span> Drag output to Timeline';timelineDrag.title='Drag this output to the timeline';timelineDrag.ondragstart=event=>{event.dataTransfer.setData('application/x-museflow-video-node',n.id);event.dataTransfer.setData('text/plain',n.id);event.dataTransfer.effectAllowed='copy';};timelineDrag.onclick=event=>{event.stopPropagation();addTimelineClip(ensureDockTimeline(),n.id);};body.appendChild(timelineDrag);
      body.appendChild(createNodeRunActions(n));
    }
    if(n.type==='timeline')renderTimelineBody(n,body);

    if(n.type==='imageResize'){
      const incoming=sourceFor(getIncoming(n.id,'image')[0]);
      const imageUrl=incoming?.data?.localDataUrl||incoming?.data?.asset?.url||'';
      const width=document.createElement('input');width.type='number';width.min='1';width.max='4096';width.value=n.data.width||1024;width.title='Width';width.oninput=()=>n.data.width=clampDimension(width.value);
      const height=document.createElement('input');height.type='number';height.min='1';height.max='4096';height.value=n.data.height||1024;height.title='Height';height.oninput=()=>n.data.height=clampDimension(height.value);
      const fit=document.createElement('select');[['cover','Crop to fill'],['contain','Fit inside'],['stretch','Stretch']].forEach(([v,label])=>{const o=document.createElement('option');o.value=v;o.textContent=label;fit.appendChild(o);});fit.value=n.data.fit||'cover';fit.onchange=()=>n.data.fit=fit.value;
      body.append(width,height,fit);
      const out=document.createElement('canvas');out.className='resize-preview';
      if(imageUrl){const image=new Image();image.onload=()=>drawResized(image,out,n.data);image.src=imageUrl;}
      body.appendChild(out);
      const download=document.createElement('button');download.type='button';download.className='small-btn';download.textContent='Download resized image';download.disabled=!imageUrl;download.onclick=()=>{out.toBlob(blob=>{if(!blob)return;const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`museflow-${n.data.width}x${n.data.height}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);});};body.appendChild(download);
    }

    if (n.type === 'preview') {
      if (n.data.asset?.url) { if(n.data.asset.kind==='video'){const video=document.createElement('video');video.controls=true;video.src=n.data.asset.url;body.appendChild(video);}else{const a=document.createElement('a');a.href=n.data.asset.url;a.target='_blank';const img=document.createElement('img');img.src=n.data.asset.url;a.appendChild(img);body.appendChild(a);} }
      else { const empty=document.createElement('div'); empty.className='empty preview-empty'; empty.textContent='Run workflow'; body.appendChild(empty); }
    }

    el.appendChild(body);
    addPorts(el, n);
    el.onmousedown = event => {if(event.target.closest('button,input,textarea,select,.port,.node-header'))return;selectNode(n.id,{toggle:event.shiftKey||event.ctrlKey||event.metaKey});};
    return el;
  }

  function createNodeRunActions(node){
    const actions=document.createElement('div');actions.className='node-generation-actions';
    const button=document.createElement('button');button.type='button';button.className='node-run-button primary';
    if(node.data.status==='queued'&&autoPlan?.ids.has(node.id)){button.textContent='Đợi đầu vào';button.disabled=true;}else if(node.data.status==='running'){
      button.classList.add('stop');button.textContent='■ Stop';button.disabled=false;button.title='Stop this generation';button.dataset.stopGeneration=node.id;
    }else{
      button.textContent=`▶ Run ${node.type==='generateVideo'?'Video':node.type==='generateText'?'Văn bản':'Ảnh'}`;button.disabled=false;
      button.onclick=event=>{event.stopPropagation();runSingleNode(node.id);};
    }
    actions.appendChild(button);
    if(node.type==='generateText'&&['chatgpt','gemini'].includes(node.data.provider||'gemini')){const pick=document.createElement('button');pick.type='button';pick.className='node-pick-result';pick.textContent='Chọn kết quả trên tab AI';pick.onclick=()=>void pickTextResult(node).catch(error=>setRunStatus(error.message,'error'));const recovery=document.createElement('details');recovery.className='node-recovery';recovery.open=node.data.status==='error';const summary=document.createElement('summary');summary.textContent='Khôi phục thủ công';recovery.append(summary,pick);actions.append(recovery);}
    if(node.type==='generateText'&&node.data.sendMode==='delay'&&node.data.status==='running'&&['chatgpt','gemini'].includes(node.data.provider||'gemini')){const now=document.createElement('button');now.type='button';now.className='node-send-now';now.textContent='Gửi ngay';now.onclick=()=>void sendTextNow(node).catch(error=>setRunStatus(error.message,'error'));actions.append(now);}
    if(node.type==='generateVideo'){
      const again=document.createElement('button');again.type='button';again.className='node-run-button again';again.textContent='↻ Again';again.title='Regenerate this video with stronger adherence to the connected prompt and references';again.disabled=node.data.status==='running';
      again.onclick=event=>{event.stopPropagation();executeGenerationNode(node.id,{again:true});};actions.appendChild(again);
    }
    return actions;
  }

  function addPorts(el, n) {
    const def = nodeDefs[n.type];
    (def.inputs || []).forEach((p, i) => {
      const y = ['generateImage','generateVideo','generateText'].includes(n.type) ? 52+i*26 : n.type==='timeline'?58+i*42:68+i*42;
      const port = document.createElement('div'); port.className='port in'; port.dataset.node=n.id; port.dataset.port=p.id;port.dataset.type=p.type; port.style.top=`${y}px`; port.title=`Input: ${p.label} (${p.type})`;
      if(p.type==='text'||p.type==='negative')port.onpointerdown=e=>startWireFromInput(e,n.id,p.id,p.type);
      port.ondragover=e=>{if(state.connectingFrom&&portCompatible(state.connectingFrom,n.id,p.id)){e.preventDefault();port.classList.add('wire-compatible');}};
      port.onclick = (e) => { e.stopPropagation(); if(state.suppressPortClick)return; if(state.connectingFrom)connect(n.id,p.id); else setRunStatus('Start from a compatible output port, then click this input.','warn'); };
      const label=document.createElement('span'); label.className='port-label left'; label.style.top=`${y-1}px`; const count=isMultiInput(n.type,p.id)?getIncoming(n.id,p.id).length:0;label.textContent=count?`${p.label} · ${count}`:p.label;if(count)port.title=n.type==='textConcat'?`Text sources (${count} connected)`:p.id==='prompt'?`Prompt sources (${count} connected)`:`Reference images (${count} connected)`;el.append(label,port);
    });
    (def.outputs || []).forEach((p, i) => {
      const y = ['prompt','negativePrompt','textAppend'].includes(n.type) ? 80 : n.type==='generateVideo'?82+i*30:['imageInput','generateImage'].includes(n.type)?82:66+i*42;
      const port=document.createElement('div'); port.className='port out'; port.dataset.node=n.id; port.dataset.port=p.id;port.dataset.type=p.type; port.style.top=`${y}px`; port.title=`Output: ${p.label} (${p.type})`;
      port.onpointerdown=e=>startWire(e,n.id,p.id);
      if(n.type==='generateVideo'){port.classList.add('video-output-port');port.title=p.id==='endFrame'?'Connect this final frame to the next video’s reference input':'Connect video output to the Timeline or another compatible input';}
      port.onmousedown=e=>{if(e.button===0){e.stopPropagation();state.connectingFrom={nodeId:n.id,portId:p.id};setRunStatus(`Connecting ${p.type}: click a compatible input port.`,'warn');}};
      port.onclick=(e)=>{e.stopPropagation();if(state.suppressPortClick)return;if(!state.draggingWire){state.connectingFrom={nodeId:n.id,portId:p.id};setRunStatus(`Connecting ${p.type}: click a compatible input or drag to one.`,'warn');}};
      const label=document.createElement('span'); label.className='port-label right'; label.style.top=`${y-1}px`; label.textContent=p.label; el.append(label,port);
    });
  }

  function setupDrag(handle, n, el) {
    handle.onmousedown = (e) => {
      if(state.handMode||state.spaceDown)return;
      if (e.target.classList.contains('node-close')) return;
      e.preventDefault();
      const altCopy=e.altKey,modified=e.shiftKey||e.ctrlKey||e.metaKey,wasSelected=state.selectedNodeIds.includes(n.id);if(modified){selectNode(n.id,{toggle:true});if(wasSelected)return;}else if(!wasSelected)selectNode(n.id);
      const sx=e.clientX, sy=e.clientY,zoom=state.zoom;let group=state.selectedNodeIds.includes(n.id)?[...state.selectedNodeIds]:[n.id],origins=[],copied=false,undoRecorded=false,moved=false;
      const getOrigins=()=>group.map(id=>{const node=nodeById(id);return node&&{id:node.id,x:node.x,y:node.y};}).filter(Boolean);origins=getOrigins();
      const move=(ev)=>{const rawDx=ev.clientX-sx,rawDy=ev.clientY-sy;if(altCopy&&!copied){if(Math.hypot(rawDx,rawDy)<3)return;createUndoSnapshot(`Alt-drag copy ${group.length===1?'node':'nodes'}`);group=duplicateNodesForDrag(group);copied=true;undoRecorded=true;origins=getOrigins();render();}
        const dx=rawDx/zoom,dy=rawDy/zoom;if(Math.abs(dx)+Math.abs(dy)<.1)return;if(!undoRecorded){createUndoSnapshot(`Move ${group.length===1?'node':'nodes'}`);undoRecorded=true;}moved=true;
        for(const origin of origins){const node=nodeById(origin.id);if(!node)continue;node.x=origin.x+dx;node.y=origin.y+dy;const nodeEl=document.querySelector(`.node[data-id="${CSS.escape(origin.id)}"]`);if(nodeEl){nodeEl.style.left=`${node.x}px`;nodeEl.style.top=`${node.y}px`;}}scheduleDrawEdges();};
      const up=()=>{window.removeEventListener('mousemove',move);window.removeEventListener('mouseup',up);if(moved){scheduleAutoSave();if(copied)setRunStatus('Node copy created.','ok');}};
      window.addEventListener('mousemove',move); window.addEventListener('mouseup',up);
    };
  }

  function renderTimelineBody(node,body){
    const edges=getIncoming(node.id).filter(e=>e.targetPort.startsWith('clip'));
    const sources=new Map(edges.map(e=>[e.source,nodeById(e.source)]));
    const ordered=(node.data.clipOrder||[]).filter(id=>state.nodes.some(n=>n.id===id&&timelineMedia(n)));
    for(const edge of edges)if(!ordered.includes(edge.source))ordered.push(edge.source);
    for(const id of node.data.clipOrder||[])if(state.nodes.some(n=>n.id===id&&timelineMedia(n))&&!ordered.includes(id))ordered.push(id);
    node.data.clipOrder=ordered;syncTimelineDock();
    node._timelineEdges=edges;
    const bar=document.createElement('div');bar.className='timeline-toolbar';
    const count=document.createElement('span');count.textContent=`${ordered.length} clip${ordered.length===1?'':'s'}`;
    const play=document.createElement('button');play.type='button';play.className='small-btn';play.textContent='▶ Preview sequence';play.disabled=!ordered.some(id=>nodeById(id)?.data?.asset?.url);play.onclick=()=>playTimeline(node);
    bar.append(count,play);body.appendChild(bar);
    const track=document.createElement('div');track.className='timeline-track';
    if(!ordered.length){const empty=document.createElement('div');empty.className='timeline-empty';empty.textContent='Drop video nodes here or connect them to clip inputs';track.appendChild(empty);}
    ordered.forEach((id,index)=>{
      const source=nodeById(id);if(!source)return;
      const clip=document.createElement('div');clip.className='timeline-clip';clip.draggable=true;clip.dataset.clip=id;
      clip.ondragstart=e=>{e.dataTransfer.setData('text/plain',id);e.dataTransfer.effectAllowed='move';};
      clip.ondragover=e=>{e.preventDefault();};
      clip.ondrop=e=>{e.preventDefault();const moving=e.dataTransfer.getData('application/x-museflow-video-node')||e.dataTransfer.getData('text/plain'),arr=[...node.data.clipOrder],from=arr.indexOf(moving),to=arr.indexOf(id);if(from>=0&&to>=0&&from!==to){createUndoSnapshot('Reorder Timeline clips');arr.splice(from,1);arr.splice(to,0,moving);node.data.clipOrder=arr;syncTimelineDock();render();saveState();}};
      const label=document.createElement('div');label.className='timeline-clip-head';label.textContent=`${String(index+1).padStart(2,'0')} · ${source.data.asset?.name||'Video clip'}`;
      const length=document.createElement('label');length.className='clip-duration';length.textContent='Play (sec)';
      const input=document.createElement('input');input.type='number';input.min='1';input.max='60';input.value=String(node.data.durations?.[id]||source.data.duration||5);input.onchange=()=>{node.data.durations=node.data.durations||{};node.data.durations[id]=Math.max(1,Math.min(60,Number(input.value)||5));scheduleAutoSave();};length.appendChild(input);
      const status=document.createElement('span');status.className=`timeline-clip-state ${source.data.status||'idle'}`;status.textContent=source.data.status||'waiting';
      clip.append(label,length,status);track.appendChild(clip);
    });
    body.appendChild(track);
    body.appendChild(createTimelineDropZone(node));
  }

  function createTimelineDropZone(node){
    const zone=document.createElement('div');zone.className='timeline-inline-drop';zone.textContent='Drop video node here to add to timeline';
    zone.ondragover=event=>{event.preventDefault();zone.classList.add('drag-over');};zone.ondragleave=()=>zone.classList.remove('drag-over');
    zone.ondrop=event=>{event.preventDefault();zone.classList.remove('drag-over');addTimelineClip(node,event.dataTransfer.getData('application/x-museflow-video-node')||event.dataTransfer.getData('text/plain'));};return zone;
  }

  function mediaDestination(target,files,{paste=false}={}){
    if(target?.closest?.('textarea,[contenteditable="true"],input:not([type="file"])')&&paste)return null;
    const field=target?.closest?.('label')?.querySelector('input[type="file"][accept*="image"],input[type="file"][accept*="video"]');
    const element=target?.closest?.('.node'),node=nodeById(element?.dataset.id|| (paste?state.selectedNodeId:null));
    if(field&&!node)return {field};
    if(target?.closest?.('#timelineDock'))return {timeline:true};
    if(!node)return null;
    if(['imageInput','videoInput'].includes(node.type))return {node};
    const port=target?.closest?.('.port.in'),kind=files[0]?.type?.startsWith('video/')?'video':'image';
    const input=port?(nodeDefs[node.type].inputs||[]).find(p=>p.id===port.dataset.port):(nodeDefs[node.type].inputs||[]).find(p=>p.type===kind||p.type==='media');
    return input&&['image','video','media'].includes(input.type)?{node,port:input}:null;
  }
  async function importMediaFiles(files,destination){
    if(!files.length)return;
    const {node,port,field,timeline}=destination;
    if(node&&runForNode(node.id))throw new Error('Node đang chạy; đợi hoàn tất rồi thay tệp.');
    const accept=field?.accept||(port?.type==='media'||timeline?'image/,video/':port?.type==='video'||node?.type==='videoInput'?'video/':'image/');
    for(const file of files){if(!/^(image|video)\//.test(file.type)||!accept.split(',').some(type=>file.type.startsWith(type.trim().replace('*',''))))throw new Error('Sai loại tệp: ô này cần '+accept+'.');if(!file.size||file.size>100*1024*1024)throw new Error('Tệp phải có dung lượng từ 1 byte đến 100 MB.');}
    if(field){if(!field.multiple&&files.length>1)throw new Error('Ô này chỉ nhận một tệp.');const dt=new DataTransfer();const all=field.multiple?[...field.files,...files]:files;if(field.id==='batchReferences'&&(all.length>8||all.reduce((sum,f)=>sum+f.size,0)>20*1024*1024))throw new Error('Tối đa 8 ảnh, tổng 20 MB.');all.forEach(file=>dt.items.add(file));field.files=dt.files;field.dispatchEvent(new Event('change',{bubbles:true}));setRunStatus('Đã thêm tệp.','ok');return;}
    if(node&&!port&&files.length>1||port&&!isMultiInput(node.type,port.id)&&files.length>1)throw new Error('Ô này chỉ nhận một tệp mỗi lần.');
    const loaded=await Promise.all(files.map(async file=>({file,url:await blobAsDataUrl(file)})));
    if(node&&(nodeById(node.id)!==node||runForNode(node.id)))throw new Error('Node đã thay đổi hoặc đang chạy; chưa thay tệp.');
    createUndoSnapshot('Nhập ảnh/video');
    for(const [index,{file,url}] of loaded.entries()){
      const kind=file.type.startsWith('video/')?'video':'image';let source=node;
      if(port||timeline){source=makeNode(kind==='video'?'videoInput':'imageInput',Math.max(20,(node?.x||350)-330),(node?.y||80)+index*250);state.nodes.push(source);}
      source.data.fileName=file.name;source.data.localDataUrl=url;source.data.asset={id:uid('asset'),kind,url,name:file.name,sourceNodeId:source.id};
      if(port){if(!isMultiInput(node.type,port.id))state.edges=state.edges.filter(e=>!(e.target===node.id&&e.targetPort===port.id));state.edges.push({id:uid('edge'),source:source.id,sourcePort:kind,target:node.id,targetPort:port.id});}
      if(timeline){const tl=ensureDockTimeline();tl.data.clipOrder.push(source.id);}
    }
    render();scheduleAutoSave();setRunStatus(`Đã thêm ${files.length} tệp.`,'ok');
  }
  document.addEventListener('dragover',event=>{if(!event.dataTransfer?.types.includes('Files'))return;event.preventDefault();const destination=mediaDestination(event.target,[...(event.dataTransfer.items||[])].filter(i=>i.kind==='file'));document.querySelectorAll('.media-drag-over').forEach(el=>el.classList.remove('media-drag-over'));if(destination){(event.target.closest('.node,.timeline-dock,label'))?.classList.add('media-drag-over');event.dataTransfer.dropEffect='copy';}});
  document.addEventListener('dragleave',event=>{if(!event.target.contains?.(event.relatedTarget))event.target.classList?.remove('media-drag-over');});
  document.addEventListener('drop',event=>{if(!event.dataTransfer?.files.length)return;event.preventDefault();document.querySelectorAll('.media-drag-over').forEach(el=>el.classList.remove('media-drag-over'));const files=[...event.dataTransfer.files],destination=mediaDestination(event.target,files);if(destination)void importMediaFiles(files,destination).catch(error=>setRunStatus(error.message,'error'));else setRunStatus('Thả tệp vào node ảnh/video hoặc cổng đầu vào tương ứng.','warn');},true);
  document.addEventListener('paste',event=>{const files=[...(event.clipboardData?.files||[])];if(!files.length)return;const destination=mediaDestination(event.target,files,{paste:true});if(!destination)return;event.preventDefault();void importMediaFiles(files,destination).catch(error=>setRunStatus(error.message,'error'));});

  function ensureDockTimeline(){let timeline=state.nodes.find(item=>item.type==='timeline');if(!timeline){timeline={id:uid('timeline'),type:'timeline',x:0,y:0,data:{clipOrder:[],durations:{},dockOnly:true}};state.nodes.push(timeline);}timeline.data=timeline.data||{};timeline.data.clipOrder=timeline.data.clipOrder||[];timeline.data.durations=timeline.data.durations||{};return timeline;}

  const timelineMedia=n=>!!n&&(['generateVideo','generateImage','imageInput','videoInput','imageResize'].includes(n.type));
  const timelineImage=n=>n.data.asset?.kind==='image'||['generateImage','imageInput','imageResize'].includes(n.type);
  const timelineReady=n=>timelineMedia(n)&&!!n.data.asset?.url;

  function addTimelineClip(timeline,nodeId){if(!nodeId||!timelineMedia(nodeById(nodeId))){setRunStatus('Chọn node ảnh hoặc video để thêm vào dòng thời gian.','warn');return;}timeline=timeline||state.nodes.find(item=>item.type==='timeline')||null;if(timeline?.data?.clipOrder?.includes(nodeId))return;createUndoSnapshot('Add video to Timeline');timeline=timeline||ensureDockTimeline();timeline.data.clipOrder=timeline.data.clipOrder||[];if(!timeline.data.clipOrder.includes(nodeId))timeline.data.clipOrder.push(nodeId);syncTimelineDock();render();saveState();setRunStatus('Đã thêm ảnh/video vào dòng thời gian.','ok');}

  function importAllVideosToTimeline(){
    const timelineBefore=state.nodes.find(item=>item.type==='timeline'),orderBefore=timelineBefore?.data?.clipOrder||[],existing=new Set(orderBefore),all=state.nodes.filter(item=>item.type==='generateVideo');
    const additions=all.filter(video=>!existing.has(video.id));
    if(!additions.length){setRunStatus(all.length?'All Generate Video nodes are already on the timeline.':'No Generate Video nodes to import.','warn');return;}
    createUndoSnapshot('Import videos to Timeline');const timeline=timelineBefore||ensureDockTimeline(),order=timeline.data.clipOrder,addIds=new Set(additions.map(video=>video.id));
    order.push(...topoOrder().filter(id=>addIds.has(id)));
    syncTimelineDock();render();saveState();if($('#timelineDock').classList.contains('collapsed'))toggleTimeline();
    setRunStatus(`Imported ${additions.length} video node${additions.length===1?'':'s'} to the timeline. Run will generate videos in timeline order.`,'ok');
  }

  function syncTimelineDock(){
    for(const input of state.nodes.filter(n=>['imageInput','videoInput'].includes(n.type)&&n.data.localDataUrl))input.data.asset={...input.data.asset,kind:input.type==='imageInput'?'image':'video',url:input.data.localDataUrl};
    const dock=$('#timelineDock'),track=$('#timelineTrack'),count=$('#timelineClipCount'),addButton=$('#timelineAddVideoBtn'),importAllButton=$('#timelineImportAllBtn'),outputMenu=$('#timelineOutputMenu'),node=ensureDockTimeline();dock.classList.remove('no-timeline');const allVideos=state.nodes.filter(timelineMedia),candidates=allVideos.filter(item=>!(node.data.clipOrder||[]).includes(item.id));addButton.disabled=!candidates.length;addButton.title=addButton.disabled?'Tất cả ảnh/video đã có trên dòng thời gian':'Thêm ảnh hoặc video';importAllButton.disabled=!candidates.some(item=>item.type==='generateVideo');importAllButton.title=importAllButton.disabled?'Không còn node video để thêm':'Thêm tất cả node video';outputMenu.innerHTML='';if(!candidates.length){const empty=document.createElement('span');empty.textContent='Chưa có ảnh/video để thêm';outputMenu.appendChild(empty);}candidates.forEach((video,index)=>{const option=document.createElement('button');option.type='button';option.textContent=video.data.asset?.name||`${timelineImage(video)?'Ảnh':'Video'} · ${video.data.componentId||index+1}`;option.onclick=()=>{outputMenu.classList.add('hidden');addTimelineClip(node,video.id);};outputMenu.appendChild(option);});
    const clips=(node.data.clipOrder||[]).map(id=>nodeById(id)).filter(timelineMedia);node.data.clipOrder=clips.map(item=>item.id);count.textContent=`${clips.length} clip${clips.length===1?'':'s'}`;track.innerHTML='';
    const pixelsPerSecond=42,total=clips.reduce((sum,clip)=>sum+Number(node.data.durations?.[clip.id]||clip.data.duration||5),0);track.style.setProperty('--timeline-total-width',`${Math.max(track.clientWidth,total*pixelsPerSecond)}px`);const ruler=document.createElement('div');ruler.className='timeline-ruler';ruler.setAttribute('role','slider');ruler.setAttribute('aria-label','Timeline playback position');ruler.setAttribute('aria-valuemin','0');ruler.setAttribute('aria-valuemax',String(total));ruler.tabIndex=0;ruler.style.width=`${Math.max(track.clientWidth,total*pixelsPerSecond)}px`;for(let sec=0;sec<=Math.ceil(total);sec+=5){const tick=document.createElement('span');tick.textContent=`${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;tick.style.flexBasis=`${5*pixelsPerSecond}px`;ruler.appendChild(tick);}track.appendChild(ruler);
    const playhead=document.createElement('div');playhead.className='timeline-playhead';playhead.style.left=`${(state.timelinePreviewPosition||0)*pixelsPerSecond}px`;playhead.style.height=`${Math.max(70,track.clientHeight-8)}px`;playhead.setAttribute('aria-hidden','true');track.appendChild(playhead);
    let scrubbing=false;const updateScrub=e=>{const rect=track.getBoundingClientRect(),time=Math.max(0,Math.min(total,(e.clientX-rect.left+track.scrollLeft)/pixelsPerSecond));state.timelinePreviewPosition=time;ruler.setAttribute('aria-valuenow',String(time.toFixed(2)));playhead.style.left=`${time*pixelsPerSecond}px`;};ruler.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();scrubbing=true;ruler.setPointerCapture(e.pointerId);updateScrub(e);};ruler.onpointermove=e=>{if(scrubbing)updateScrub(e);};ruler.onpointerup=e=>{if(!scrubbing)return;scrubbing=false;updateScrub(e);playTimeline(node,{startTime:state.timelinePreviewPosition});};ruler.onpointercancel=()=>{scrubbing=false;};ruler.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?total:Math.max(0,Math.min(total,(state.timelinePreviewPosition||0)+(e.key==='ArrowRight'?1:-1)));state.timelinePreviewPosition=next;playhead.style.left=`${next*pixelsPerSecond}px`;ruler.setAttribute('aria-valuenow',String(next));playTimeline(node,{startTime:next});};
    const lane=document.createElement('div');lane.className='timeline-lane';if(!clips.length){const empty=document.createElement('div');empty.className='dock-empty';empty.textContent='Thêm ảnh/video, kéo để sắp xếp thứ tự phát';lane.appendChild(empty);}
    clips.forEach((clip,index)=>{const duration=Number(node.data.durations?.[clip.id]||clip.data.duration||5),item=document.createElement('div');item.className=`dock-clip${duration<4?' compact':''}`;item.style.width=`${duration*pixelsPerSecond}px`;item.style.minWidth=`${duration*pixelsPerSecond}px`;item.style.maxWidth=`${duration*pixelsPerSecond}px`;item.draggable=true;item.dataset.clip=clip.id;item.ondragstart=event=>{event.dataTransfer.setData('application/x-museflow-video-node',clip.id);event.dataTransfer.effectAllowed='move';};item.ondragover=event=>event.preventDefault();item.ondrop=event=>{event.preventDefault();const moving=event.dataTransfer.getData('application/x-museflow-video-node'),from=node.data.clipOrder.indexOf(moving),to=node.data.clipOrder.indexOf(clip.id);if(from>=0&&to>=0&&from!==to){createUndoSnapshot('Reorder Timeline clips');node.data.clipOrder.splice(from,1);node.data.clipOrder.splice(to,0,moving);syncTimelineDock();render();saveState();}else if(moving&&timelineMedia(nodeById(moving)))addTimelineClip(node,moving);};
      const thumb=document.createElement('div');thumb.className='dock-clip-thumb';if(clip.data.asset?.url){if(clip.data.asset.kind==='image'){const image=document.createElement('img');image.src=clip.data.asset.url;thumb.appendChild(image);}else{const video=document.createElement('video');video.src=clip.data.asset.url;video.muted=true;video.preload='metadata';thumb.appendChild(video);}}else thumb.textContent='▶';
      const details=document.createElement('div');details.className='dock-clip-details';const title=document.createElement('span');title.textContent=`${String(index+1).padStart(2,'0')} · ${clip.data.asset?.name||(timelineImage(clip)?'Ảnh ':'Video ')+(index+1)}`;title.title=title.textContent;const length=document.createElement('label');length.textContent='Duration';const input=document.createElement('input');input.type='number';input.min='1';input.max='60';input.value=String(duration);input.onchange=()=>{node.data.durations=node.data.durations||{};node.data.durations[clip.id]=Math.max(1,Math.min(60,Number(input.value)||5));syncTimelineDock();render();saveState();};length.appendChild(input);details.append(title,length);const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.title='Remove clip';remove.onclick=()=>{createUndoSnapshot('Remove Timeline clip');node.data.clipOrder=node.data.clipOrder.filter(id=>id!==clip.id);syncTimelineDock();render();saveState();};item.append(thumb,details,remove);lane.appendChild(item);});track.appendChild(lane);
    dock.ondragover=event=>{if(event.dataTransfer.types.includes('application/x-museflow-video-node')){event.preventDefault();dock.classList.add('drag-over');if(dock.classList.contains('collapsed'))toggleTimeline();}};dock.ondragleave=event=>{if(!dock.contains(event.relatedTarget))dock.classList.remove('drag-over');};dock.ondrop=event=>{event.preventDefault();dock.classList.remove('drag-over');const id=event.dataTransfer.getData('application/x-museflow-video-node');if(id)addTimelineClip(node,id);};
  }

  function toggleTimelineOutputMenu(){if($('#timelineAddVideoBtn').disabled)return;$('#timelineOutputMenu').classList.toggle('hidden');}

  function toggleTimeline(){const dock=$('#timelineDock'),collapsed=dock.classList.toggle('collapsed'),button=$('#timelineToggleBtn');button.textContent=collapsed?'▲':'▼';button.title=collapsed?'Show timeline':'Hide timeline';button.setAttribute('aria-expanded',String(!collapsed));}

  function closeTimelinePreview(){$('#timelineStill').hidden=true;state.timelinePreviewToken++;clearTimeout(state.timelinePreviewTimer);cancelAnimationFrame(state.timelinePlayheadFrame);state.timelinePlayheadFrame=0;for(const player of [$('#timelinePlayer'),$('#timelinePlayerNext')]){player.pause();player.onended=null;}$('#timelinePreviewPanel').classList.add('hidden');}
  function visibleTimelineClipOrder(node){const nodeTrack=document.querySelector(`.node[data-id="${CSS.escape(node.id)}"] .timeline-track`),dockTrack=$('#timelineTrack'),visualTrack=nodeTrack||dockTrack,selector=nodeTrack?'.timeline-clip':'.dock-clip',visibleOrder=[...visualTrack.querySelectorAll(selector)].map(item=>item.dataset.clip).filter(Boolean);return visibleOrder.length?visibleOrder:[...(node.data.clipOrder||[])];}
  function playTimeline(node,{startTime=0}={}){
    if(visibleTimelineClipOrder(node).map(nodeById).some(n=>timelineMedia(n)&&timelineImage(n)))return playMixedTimeline(node,startTime);$('#timelineStill').hidden=true;
    const players=[$('#timelinePlayer'),$('#timelinePlayerNext')],panel=$('#timelinePreviewPanel'),clips=visibleTimelineClipOrder(node).map(id=>nodeById(id)).filter(n=>timelineReady(n)&&!timelineImage(n));
    if(!clips.length){setRunStatus('Connect completed video clips to the timeline first.','warn');return;}
    clearTimeout(state.timelinePreviewTimer);cancelAnimationFrame(state.timelinePlayheadFrame);const token=++state.timelinePreviewToken;panel.classList.remove('hidden');const durationOf=clip=>Math.max(1,Number(node.data.durations?.[clip.id]||clip.data.duration||5)),total=clips.reduce((sum,clip)=>sum+durationOf(clip),0);let position=Math.max(0,Math.min(total,Number(startTime)||0)),index=0;while(index<clips.length-1&&position>=durationOf(clips[index])){position-=durationOf(clips[index]);index++;}let firstOffset=position,activeClipStart=Math.max(0,startTime-position),tickerStarted=false,active=players.findIndex(player=>player.classList.contains('is-active'));if(active<0)active=0;state.timelinePreviewPosition=startTime;
    players.forEach(player=>{player.pause();player.onended=null;player.muted=false;player.controls=player===players[active];});
    const waitForFrame=video=>new Promise(resolve=>{let finished=false;const done=()=>{if(finished)return;finished=true;clearTimeout(fallback);resolve();};const fallback=setTimeout(done,1200);if(video.requestVideoFrameCallback)video.requestVideoFrameCallback(done);else requestAnimationFrame(()=>requestAnimationFrame(done));});
    const waitForData=video=>new Promise((resolve,reject)=>{if(video.readyState>=2){resolve();return;}let timer=setTimeout(()=>{cleanup();reject(new Error('The next timeline clip did not load in time.'));},15000);const ready=()=>{cleanup();resolve();},failed=()=>{cleanup();reject(new Error('The next timeline clip could not be loaded.'));},cleanup=()=>{clearTimeout(timer);video.removeEventListener('loadeddata',ready);video.removeEventListener('error',failed);};video.addEventListener('loadeddata',ready,{once:true});video.addEventListener('error',failed,{once:true});});
    const prepareClip=(clipIndex,video)=>{const clip=clips[clipIndex];if(!clip)return Promise.resolve();if(video.dataset.preloadClip===clip.id&&video.readyState>=2)return Promise.resolve(video);video.pause();video.onended=null;video.preload='auto';video.dataset.preloadClip=clip.id;video.src=clip.data.asset.url;video.load();return waitForData(video).then(()=>{if(video.dataset.preloadClip===clip.id)video.currentTime=0;return video;});};
    const playNext=async()=>{
      clearTimeout(state.timelinePreviewTimer);if(token!==state.timelinePreviewToken)return;
      if(index>=clips.length){players[active].onended=null;players[active].pause();state.timelinePreviewPosition=total;const head=$('#timelineTrack .timeline-playhead');if(head)head.style.left=`${total*42}px`;cancelAnimationFrame(state.timelinePlayheadFrame);setRunStatus('Timeline preview complete.','ok');return;}
      const clipIndex=index,clip=clips[index++],nextIndex=1-active,next=players[nextIndex],previous=players[active];next.pause();next.onended=null;next.muted=false;next.controls=false;next.classList.remove('is-active','is-fading');
      const clipOffset=firstOffset;firstOffset=0;let clipStart=0;for(let i=0;i<clipIndex;i++)clipStart+=durationOf(clips[i]);activeClipStart=clipStart;
      try{await prepareClip(clipIndex,next);if(token!==state.timelinePreviewToken)return;next.currentTime=Math.min(clipOffset,Math.max(0,(next.duration||durationOf(clip))-0.05));activeClipStart=clipStart;await next.play();await waitForFrame(next);}catch(error){if(token===state.timelinePreviewToken&&next.readyState>=2){next.controls=true;next.classList.add('is-active');previous.controls=false;previous.classList.remove('is-active','is-fading');active=nextIndex;next.onended=()=>{if(token===state.timelinePreviewToken)playNext();};setRunStatus(`Timeline clip is ready; press Play to continue (${error.message})`,'warn');}else if(token===state.timelinePreviewToken)setRunStatus(`Timeline preview paused: ${error.message}`,'error');return;}
      if(token!==state.timelinePreviewToken){next.pause();return;}
      next.controls=true;next.classList.add('is-active');previous.controls=false;previous.onended=null;previous.classList.remove('is-active');previous.classList.add('is-fading');active=nextIndex;setTimeout(()=>{previous.classList.remove('is-fading');if(token===state.timelinePreviewToken)previous.pause();},180);
      if(!tickerStarted){tickerStarted=true;const tick=()=>{if(token!==state.timelinePreviewToken)return;const current=players[active],time=activeClipStart+(Number(current.currentTime)||0);state.timelinePreviewPosition=time;const head=$('#timelineTrack .timeline-playhead');if(head)head.style.left=`${time*42}px`;state.timelinePlayheadFrame=requestAnimationFrame(tick);};state.timelinePlayheadFrame=requestAnimationFrame(tick);}
      if(index<clips.length)prepareClip(index,previous).catch(()=>{});
      const advance=()=>{if(token!==state.timelinePreviewToken)return;clearTimeout(state.timelinePreviewTimer);next.onended=null;playNext();};next.onended=advance;
      state.timelinePreviewTimer=setTimeout(advance,Math.max(0.1,durationOf(clip)-clipOffset)*1000);setRunStatus(`Timeline shot ${index}/${clips.length}`,'warn');
    };
    playNext();
  }

  function playMixedTimeline(node,startTime=0){
    closeTimelinePreview();const token=state.timelinePreviewToken,clips=visibleTimelineClipOrder(node).map(nodeById);
    if(!clips.length||clips.some(n=>!timelineReady(n))){setRunStatus('Mọi cảnh cần có ảnh/video trước khi xem.','warn');return;}
    const still=$('#timelineStill'),video=$('#timelinePlayer'),next=$('#timelinePlayerNext'),duration=n=>Math.max(1,Number(node.data.durations[n.id]||n.data.duration||5));
    $('#timelinePreviewPanel').classList.remove('hidden');next.classList.remove('is-active');let index=0,offset=startTime,position=0;
    while(index<clips.length-1&&offset>=duration(clips[index])){offset-=duration(clips[index]);position+=duration(clips[index++]);}
    const advance=async()=>{
      if(token!==state.timelinePreviewToken)return;
      if(index>=clips.length){video.pause();setRunStatus('Đã xem hết dòng thời gian.','ok');return;}
      const clip=clips[index++],length=duration(clip),skip=offset;offset=0;video.pause();
      if(timelineImage(clip)){video.classList.remove('is-active');still.src=clip.data.asset.url;still.hidden=false;}
      else{still.hidden=true;video.classList.add('is-active');video.src=clip.data.asset.url;video.currentTime=skip;try{await video.play();}catch(error){if(token===state.timelinePreviewToken)setRunStatus('Không phát được video: '+error.message,'error');return;}}
      if(token!==state.timelinePreviewToken){video.pause();return;}const began=performance.now(),base=position+skip;position+=length;
      const tick=()=>{if(token!==state.timelinePreviewToken)return;const time=Math.min(position,base+(performance.now()-began)/1000);state.timelinePreviewPosition=time;const head=$('#timelineTrack .timeline-playhead');if(head)head.style.left=time*42+'px';state.timelinePlayheadFrame=requestAnimationFrame(tick);};cancelAnimationFrame(state.timelinePlayheadFrame);tick();
      state.timelinePreviewTimer=setTimeout(()=>{cancelAnimationFrame(state.timelinePlayheadFrame);advance();},Math.max(.1,length-skip)*1000);
    };void advance();
  }

  function createSilentWav(){const sampleRate=48000,channels=2,bitsPerSample=16,dataBytes=sampleRate*channels*(bitsPerSample/8),buffer=new ArrayBuffer(44+dataBytes),view=new DataView(buffer),bytes=new Uint8Array(buffer);const write=(offset,value)=>{for(let index=0;index<value.length;index++)bytes[offset+index]=value.charCodeAt(index);};write(0,'RIFF');view.setUint32(4,36+dataBytes,true);write(8,'WAVE');write(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*channels*(bitsPerSample/8),true);view.setUint16(32,channels*(bitsPerSample/8),true);view.setUint16(34,bitsPerSample,true);write(36,'data');view.setUint32(40,dataBytes,true);return bytes;}

  async function exportTimelineWithFFmpeg(node,clips,button,formatSelect,{format='mp4',filename=null}={}){
    const outputPath='/museflow-timeline.'+format;const singleButton=$('#timelineExportSingleBtn');singleButton.disabled=true;
    const stopButton=$('#timelineExportStopBtn'),abortController=new AbortController(),signal=abortController.signal,sourceUrls=[],ffmpeg=new window.FFmpegWASM.FFmpeg(),logs=[];
    state.timelineExporting=true;state.timelineExportAbortController=abortController;state.timelineFFmpeg=ffmpeg;button.disabled=true;formatSelect.disabled=true;stopButton.classList.remove('hidden');
    const throwIfStopped=()=>{if(signal.aborted)throw new DOMException('Timeline export stopped.','AbortError');};
    const onLog=event=>{if(event?.message){logs.push(event.message);if(logs.length>30)logs.shift();}},onProgress=event=>{if(!signal.aborted&&Number.isFinite(event?.progress)){button.textContent=`Encoding ${Math.max(0,Math.min(99,Math.round(event.progress*100)))}%…`;setRunStatus(`Encoding ${format.toUpperCase()} with FFmpeg · ${Math.max(0,Math.min(99,Math.round(event.progress*100)))}%`,'warn');}};
    try{
      ffmpeg.on('log',onLog);ffmpeg.on('progress',onProgress);
      button.textContent='Loading FFmpeg…';setRunStatus('Loading the local FFmpeg video engine…','warn');
      // The bundled UMD wrapper uses importScripts() to load the core, so let
      // it create a classic worker instead of forcing the module class worker.
      await ffmpeg.load({coreURL:chrome.runtime.getURL('vendor/ffmpeg/ffmpeg-core.js'),wasmURL:chrome.runtime.getURL('vendor/ffmpeg/ffmpeg-core.wasm')},{signal});
      const clipInfo=[];
      for(let index=0;index<clips.length;index++){
        throwIfStopped();button.textContent=`Loading clips ${index+1}/${clips.length}…`;setRunStatus(`Loading timeline clip ${index+1}/${clips.length} into local FFmpeg…`,'warn');
        const response=await fetch(clips[index].data.asset.url,{credentials:'include',signal});if(!response.ok)throw new Error(`Could not download timeline clip ${index+1} (HTTP ${response.status}).`);
        let bytes=new Uint8Array(await response.arrayBuffer());if(timelineImage(clips[index])){const bitmap=await createImageBitmap(new Blob([bytes]));try{const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;canvas.getContext('2d').drawImage(bitmap,0,0);const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));bytes=new Uint8Array(await png.arrayBuffer());}finally{bitmap.close();}}if(!bytes.length)throw new Error(`Timeline clip ${index+1} is empty.`);const inputPath=`/scene_${String(index).padStart(3,'0')}.${timelineImage(clips[index])?'png':'bin'}`;await ffmpeg.writeFile(inputPath,bytes,{signal});sourceUrls.push(inputPath);
        const probePath=`/probe_${index}.json`;await ffmpeg.ffprobe(['-v','error','-show_entries','stream=codec_type,codec_name,width,height,profile,pix_fmt,sample_rate,channels:format=duration','-of','json',inputPath,'-o',probePath],-1,{signal});const raw=await ffmpeg.readFile(probePath,'utf8',{signal}),probe=JSON.parse(typeof raw==='string'?raw:new TextDecoder().decode(raw));const videoStream=probe.streams?.find(stream=>stream.codec_type==='video'),audioStream=probe.streams?.find(stream=>stream.codec_type==='audio');if(!videoStream)throw new Error(`Timeline clip ${index+1} has no readable video stream.`);clipInfo.push({hasAudio:!!audioStream,width:Number(videoStream.width)||1280,height:Number(videoStream.height)||720,videoCodec:videoStream.codec_name,videoProfile:videoStream.profile,pixelFormat:videoStream.pix_fmt,audioCodec:audioStream?.codec_name,audioRate:Number(audioStream?.sample_rate)||0,audioChannels:Number(audioStream?.channels)||0,sourceDuration:Number(probe.format?.duration)||0,duration:Math.max(1,Math.min(60,Number(node.data.durations?.[clips[index].id]||clips[index].data.duration||5)))});await ffmpeg.deleteFile(probePath,{signal});
      }
      throwIfStopped();
      const firstInfo=clipInfo[0],copyCompatible=format==='mp4'&&clips.every(clip=>!timelineImage(clip))&&clipInfo.every(item=>item.videoCodec==='h264'&&item.videoProfile===firstInfo.videoProfile&&item.pixelFormat===firstInfo.pixelFormat&&item.width===firstInfo.width&&item.height===firstInfo.height&&item.hasAudio&&item.audioCodec==='aac'&&item.audioRate===firstInfo.audioRate&&item.audioChannels===firstInfo.audioChannels&&item.sourceDuration>0&&Math.abs(item.sourceDuration-item.duration)<0.15);
      if(copyCompatible){const concatFile='/timeline-inputs.txt',concatData=new TextEncoder().encode(sourceUrls.map(path=>`file '${path}'`).join('\n')+'\n');await ffmpeg.writeFile(concatFile,concatData,{signal});button.textContent='Joining MP4 clips…';setRunStatus('Joining compatible timeline clips without re-encoding (fast, original quality)…','warn');const exitCode=await ffmpeg.exec(['-f','concat','-safe','0','-i',concatFile,'-c','copy','-movflags','+faststart','-y','/museflow-timeline.mp4'],-1,{signal});if(exitCode!==0)throw new Error(logs.slice(-5).map(item=>item.trim()).filter(Boolean).join(' ')||`FFmpeg exited with code ${exitCode}.`);}
      else{
      const silentInput='/timeline-silence.wav',needsSilence=clipInfo.some(item=>!item.hasAudio);if(needsSilence)await ffmpeg.writeFile(silentInput,createSilentWav(),{signal});
      const silentIndexes=new Map();let inputIndex=clips.length;for(let index=0;index<clipInfo.length;index++)if(!clipInfo[index].hasAudio)silentIndexes.set(index,inputIndex++);
      const first=clipInfo[0],scale=Math.min(1,1280/Math.max(first.width,first.height)),width=Math.max(2,Math.floor(first.width*scale/2)*2),height=Math.max(2,Math.floor(first.height*scale/2)*2),filterParts=[],concatInputs=[];
      clipInfo.forEach((item,index)=>{const duration=item.duration.toFixed(3),videoLabel=`v${index}`,audioLabel=`a${index}`;filterParts.push(`[${index}:v:0]setpts=PTS-STARTPTS,scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,fps=24,setsar=1,format=yuv420p,tpad=stop_mode=clone:stop_duration=${duration},trim=duration=${duration},setpts=PTS-STARTPTS[${videoLabel}]`);const audioSource=item.hasAudio?`${index}:a:0`:`${silentIndexes.get(index)}:a:0`;filterParts.push(`[${audioSource}]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,asetpts=PTS-STARTPTS,apad=pad_dur=${duration},atrim=duration=${duration}[${audioLabel}]`);concatInputs.push(`[${videoLabel}][${audioLabel}]`);});
      filterParts.push(`${concatInputs.join('')}concat=n=${clipInfo.length}:v=1:a=1[outv][outa]`);
      const args=[];sourceUrls.forEach((path,index)=>{if(timelineImage(clips[index]))args.push('-loop','1','-t',String(clipInfo[index].duration));args.push('-i',path);});for(const [index] of silentIndexes)args.push('-stream_loop','-1','-i',silentInput);
      args.push('-filter_complex',filterParts.join(';'),'-map','[outv]','-map','[outa]');if(format==='mp4')args.push('-c:v','libx264','-preset','ultrafast','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart');else args.push('-c:v','libvpx','-deadline','realtime','-cpu-used','5','-b:v','2M','-pix_fmt','yuv420p','-c:a','libopus','-b:a','128k');args.push('-max_muxing_queue_size','1024','-y',outputPath);
      button.textContent=`Encoding ${format.toUpperCase()}…`;setRunStatus('FFmpeg is assembling and encoding the complete timeline locally…','warn');const exitCode=await ffmpeg.exec(args,-1,{signal});if(exitCode!==0)throw new Error(logs.slice(-5).map(item=>item.trim()).filter(Boolean).join(' ')||`FFmpeg exited with code ${exitCode}.`);
      }
      throwIfStopped();const output=await ffmpeg.readFile(outputPath,'binary',{signal});if(!(output instanceof Uint8Array)||!output.length)throw new Error('FFmpeg không tạo được video đầu ra.');
      if(state.timelineExportUrl)URL.revokeObjectURL(state.timelineExportUrl);state.timelineExportUrl=URL.createObjectURL(new Blob([output],{type:format==='mp4'?'video/mp4':'video/webm'}));const player=$('#timelinePlayer'),nextPlayer=$('#timelinePlayerNext');closeTimelinePreview();$('#timelinePreviewPanel').classList.remove('hidden');nextPlayer.pause();nextPlayer.classList.remove('is-active','is-fading');nextPlayer.controls=false;player.src=state.timelineExportUrl;player.controls=true;player.classList.remove('is-fading');player.classList.add('is-active');const link=document.createElement('a');link.href=state.timelineExportUrl;link.download=filename||`MuseFlow-Timeline-${new Date().toISOString().replace(/[:.]/g,'-')}.${format}`;link.click();setRunStatus(`Đã xuất ${clips.length} cảnh thành ${format.toUpperCase()}.`,'ok');return true;
    }catch(error){if(error?.name==='AbortError'||signal.aborted)setRunStatus('Timeline export stopped.','warn');else setRunStatus(`Timeline export failed: ${error?.message||String(error)}`,'error');}
    finally{ffmpeg.off('log',onLog);ffmpeg.off('progress',onProgress);ffmpeg.terminate();state.timelineFFmpeg=null;state.timelineExportAbortController=null;state.timelineExporting=false;button.disabled=false;formatSelect.disabled=false;button.textContent='⇩ Xuất tất cả';singleButton.disabled=false;stopButton.classList.add('hidden');}
  }

  async function exportTimelineVideo(){
    if(state.timelineExporting||state.timelineBatchExporting)return;const node=ensureDockTimeline(),clips=visibleTimelineClipOrder(node).map(id=>nodeById(id)),button=$('#timelineExportBtn'),formatSelect=$('#timelineExportFormat'),requestedFormat=formatSelect.value;
    if(!clips.length||clips.some(clip=>!timelineReady(clip))){setRunStatus('Thêm ảnh/video hoàn tất cho mọi cảnh trước khi xuất.','warn');return;}
    if(requestedFormat==='mp4'||clips.some(timelineImage)){if(!window.FFmpegWASM?.FFmpeg){setRunStatus('The bundled FFmpeg engine could not be loaded. Reload the extension and try again.','error');return;}return exportTimelineWithFFmpeg(node,clips,button,formatSelect,{format:requestedFormat});}
    if(!window.MediaRecorder||!HTMLCanvasElement.prototype.captureStream){setRunStatus('This browser cannot export a stitched video from the Timeline.','error');return;}
    state.timelineExporting=true;$('#timelineExportSingleBtn').disabled=true;state.timelineExportAbortController=new AbortController();const exportSignal=state.timelineExportAbortController.signal,stopButton=$('#timelineExportStopBtn');button.disabled=true;formatSelect.disabled=true;stopButton.classList.remove('hidden');const sourceUrls=[];let recorder=null,canvasStream=null,audioContext=null,audioSource=null,audioDestination=null,audioResumePromise=Promise.resolve(),video=null,frameRequest=0,frameTimer=0,recordingPromise=null,recorderMimeType='';
    const throwIfStopped=()=>{if(exportSignal.aborted)throw new DOMException('Timeline export stopped.','AbortError');};
    const waitForExportDelay=duration=>new Promise((resolve,reject)=>{throwIfStopped();const timer=setTimeout(()=>{exportSignal.removeEventListener('abort',cancel);resolve();},duration),cancel=()=>{clearTimeout(timer);reject(new DOMException('Timeline export stopped.','AbortError'));};exportSignal.addEventListener('abort',cancel,{once:true});});
    try{const AudioContextType=window.AudioContext||window.webkitAudioContext;if(AudioContextType){audioContext=new AudioContextType();audioDestination=audioContext.createMediaStreamDestination();audioResumePromise=audioContext.resume().catch(()=>{});}}catch{audioContext=null;audioDestination=null;}
    try{
      for(let index=0;index<clips.length;index++){
        throwIfStopped();button.textContent=`Preparing ${index+1}/${clips.length}…`;setRunStatus(`Preparing timeline clip ${index+1}/${clips.length} for export…`,'warn');
        const response=await fetch(clips[index].data.asset.url,{credentials:'include',signal:exportSignal});if(!response.ok)throw new Error(`Could not download timeline clip ${index+1} (HTTP ${response.status}).`);
        const blob=await response.blob();if(!blob.size)throw new Error(`Timeline clip ${index+1} is empty.`);sourceUrls.push(URL.createObjectURL(blob));
      }
      video=document.createElement('video');video.preload='auto';video.playsInline=true;video.muted=false;video.style.cssText='position:fixed;width:2px;height:2px;left:-4px;bottom:0;opacity:.01;pointer-events:none';document.body.appendChild(video);
      const waitForData=()=>new Promise((resolve,reject)=>{if(exportSignal.aborted){reject(new DOMException('Timeline export stopped.','AbortError'));return;}if(video.readyState>=2){resolve();return;}let timer=setTimeout(()=>{cleanup();reject(new Error('Video decoding timed out.'));},20000);const ready=()=>{cleanup();resolve();},failed=()=>{cleanup();reject(new Error('The video file could not be decoded.'));},cancel=()=>{cleanup();reject(new DOMException('Timeline export stopped.','AbortError'));},cleanup=()=>{clearTimeout(timer);video.removeEventListener('loadeddata',ready);video.removeEventListener('error',failed);exportSignal.removeEventListener('abort',cancel);};video.addEventListener('loadeddata',ready,{once:true});video.addEventListener('error',failed,{once:true});exportSignal.addEventListener('abort',cancel,{once:true});});
      video.src=sourceUrls[0];video.load();await waitForData();
      const originalWidth=video.videoWidth||1280,originalHeight=video.videoHeight||720,scale=Math.min(1,1280/Math.max(originalWidth,originalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(2,Math.floor(originalWidth*scale/2)*2);canvas.height=Math.max(2,Math.floor(originalHeight*scale/2)*2);
      const context=canvas.getContext('2d',{alpha:false});if(!context)throw new Error('Could not create the video export canvas.');
      const exportFps=20;const drawFrame=()=>{if(!video||!context)return;if(video.readyState>=2&&video.videoWidth>0){const fit=Math.min(canvas.width/video.videoWidth,canvas.height/video.videoHeight),width=video.videoWidth*fit,height=video.videoHeight*fit;context.fillStyle='#000';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(video,(canvas.width-width)/2,(canvas.height-height)/2,width,height);}frameTimer=setTimeout(drawFrame,1000/exportFps);};drawFrame();
      canvasStream=canvas.captureStream(exportFps);
      if(audioContext&&audioDestination){try{audioSource=audioContext.createMediaElementSource(video);audioSource.connect(audioDestination);const audioTrack=audioDestination.stream.getAudioTracks()[0];if(audioTrack)canvasStream.addTrack(audioTrack);await audioResumePromise;if(audioContext.state!=='running')await audioContext.resume();}catch{audioContext.close().catch(()=>{});audioContext=null;audioDestination=null;audioSource=null;}}
      if(!audioDestination&&typeof video.captureStream==='function'){const captured=video.captureStream();for(const track of captured.getAudioTracks())canvasStream.addTrack(track);}
      const mimeTypes=requestedFormat==='mp4'?['video/mp4;codecs="avc1.42E01E,mp4a.40.2"','video/mp4;codecs="avc1.424028,mp4a.40.2"','video/mp4;codecs=avc1,mp4a.40.2','video/mp4;codecs=avc1','video/mp4']:['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'];
      recorderMimeType=mimeTypes.find(type=>MediaRecorder.isTypeSupported?.(type))||'';
      if(requestedFormat==='mp4'&&!recorderMimeType)throw new Error('This browser cannot encode MP4 (H.264). Choose WebM, or use a browser with MP4 MediaRecorder support.');
      const recorderOptions={videoBitsPerSecond:requestedFormat==='mp4'?Math.round(Math.min(9_000_000,Math.max(6_000_000,canvas.width*canvas.height*exportFps*0.28))):undefined,audioBitsPerSecond:192_000};if(recorderMimeType)recorderOptions.mimeType=recorderMimeType;
      recorder=new MediaRecorder(canvasStream,recorderOptions);
      const chunks=[];recordingPromise=new Promise((resolve,reject)=>{recorder.ondataavailable=event=>{if(event.data?.size)chunks.push(event.data);};recorder.onerror=event=>reject(event.error||new Error('Video encoding failed.'));recorder.onstop=()=>resolve(new Blob(chunks,{type:recorder.mimeType||recorderMimeType||'video/webm'}));});recordingPromise.catch(()=>{});recorder.start(1000);
      for(let index=0;index<clips.length;index++){
        throwIfStopped();
        if(index){if(recorder.state==='recording')recorder.pause();video.pause();video.src=sourceUrls[index];video.load();await waitForData();}
        video.currentTime=0;await video.play();if(index){await waitForExportDelay(60);if(recorder.state==='paused')recorder.resume();}button.textContent=`Exporting ${index+1}/${clips.length}…`;setRunStatus(`Exporting timeline clip ${index+1}/${clips.length} in track order…`,'warn');
        const duration=Math.max(1,Math.min(60,Number(node.data.durations?.[clips[index].id]||clips[index].data.duration||5)));await waitForExportDelay(duration*1000);video.pause();
      }
      const completed=new Promise(resolve=>{recorder.addEventListener('stop',resolve,{once:true});});recorder.stop();await completed;const output=await recordingPromise;if(!output.size)throw new Error('The exported video is empty.');
      const actualMime=(output.type||recorder.mimeType||recorderMimeType||'video/webm').toLowerCase(),extension=actualMime.includes('mp4')?'mp4':'webm';if(requestedFormat==='mp4'&&extension!=='mp4')throw new Error('The browser did not produce an MP4 file. Choose WebM or use a browser with MP4 MediaRecorder support.');
      if(state.timelineExportUrl)URL.revokeObjectURL(state.timelineExportUrl);state.timelineExportUrl=URL.createObjectURL(output);
      const player=$('#timelinePlayer'),nextPlayer=$('#timelinePlayerNext');closeTimelinePreview();$('#timelinePreviewPanel').classList.remove('hidden');nextPlayer.pause();nextPlayer.classList.remove('is-active','is-fading');nextPlayer.controls=false;player.src=state.timelineExportUrl;player.controls=true;player.classList.remove('is-fading');player.classList.add('is-active');
      const link=document.createElement('a');link.href=state.timelineExportUrl;link.download=`MuseFlow-Timeline-${new Date().toISOString().replace(/[:.]/g,'-')}.${extension}`;link.click();setRunStatus(`Stitched timeline exported as ${extension.toUpperCase()}.`,'ok');
    }catch(error){if(error?.name==='AbortError')setRunStatus('Timeline export stopped.','warn');else setRunStatus(`Timeline export failed: ${error?.message||String(error)}`,'error');}
    finally{if(frameRequest)cancelAnimationFrame(frameRequest);clearTimeout(frameTimer);if(recorder?.state==='recording'||recorder?.state==='paused'){recorder.stop();try{await recordingPromise;}catch{}}video?.pause();video?.remove();canvasStream?.getTracks().forEach(track=>track.stop());await audioContext?.close().catch(()=>{});sourceUrls.forEach(url=>URL.revokeObjectURL(url));state.timelineExporting=false;state.timelineExportAbortController=null;button.disabled=false;formatSelect.disabled=false;button.textContent='⇩ Xuất tất cả';$('#timelineExportSingleBtn').disabled=false;stopButton.classList.add('hidden');}
  }

  async function exportTimelineSingles(){
    if(state.timelineExporting||state.timelineBatchExporting)return;
    if(!window.FFmpegWASM?.FFmpeg){setRunStatus('Không tải được bộ xuất video; hãy tải lại extension.','error');return;}
    const node=ensureDockTimeline(),clips=visibleTimelineClipOrder(node).map(nodeById);
    if(!clips.length||clips.some(clip=>!timelineReady(clip))){setRunStatus('Các cảnh trên dòng thời gian phải có ảnh/video trước khi xuất.','warn');return;}
    state.timelineBatchExporting=true;state.timelineBatchStopped=false;
    const formatSelect=$('#timelineExportFormat'),format=formatSelect.value,button=$('#timelineExportBtn'),stamp=Date.now();let count=0;
    try{for(const [index,clip] of clips.entries()){
      if(state.timelineBatchStopped)break;
      const filename=String(index+1).padStart(2,'0')+'-'+WorkflowTools.safeName(clip.data.customName||clip.data.componentId||clip.id)+'-'+stamp+'.'+format;
      const ok=await exportTimelineWithFFmpeg(node,[clip],button,formatSelect,{format,filename});if(!ok)break;count++;
    }if(count===clips.length)setRunStatus(`Đã xuất riêng ${count} clip.`,'ok');
    }catch(error){setRunStatus('Không xuất được clip: '+error.message,'error');}finally{state.timelineBatchExporting=false;}
  }

  function stopTimelineExport(){state.timelineBatchStopped=true;if(!state.timelineExporting)return;state.timelineExportAbortController?.abort();state.timelineFFmpeg?.terminate();setRunStatus('Stopping timeline export…','warn');}

  function getPortCenter(nodeId, portId, kind) {
    const q = `.port.${kind}[data-node="${CSS.escape(nodeId)}"][data-port="${CSS.escape(portId)}"]`;
    const p = document.querySelector(q); if (!p) return null;
    const r=p.getBoundingClientRect(), vr=$('#viewport').getBoundingClientRect();
    return { x:(r.left-vr.left-state.panX)/state.zoom+r.width/(2*state.zoom), y:(r.top-vr.top-state.panY)/state.zoom+r.height/(2*state.zoom) };
  }

  function drawEdges() {
    edgesSvg.innerHTML='';
    state.edges.forEach(e => {
      const a=getPortCenter(e.source,e.sourcePort,'out'), b=getPortCenter(e.target,e.targetPort,'in'); if(!a||!b)return;
      const incoming=getIncoming(e.target,e.targetPort),index=incoming.findIndex(edge=>edge.id===e.id),fan=isMultiInput(nodeById(e.target)?.type,e.targetPort)&&incoming.length>1?(index-(incoming.length-1)/2)*12:0;
      const dx=b.x-a.x,direction=dx<0?-1:1,bend=Math.max(62,Math.abs(dx)*.42),output=nodeDefs[nodeById(e.source)?.type]?.outputs?.find(port=>port.id===e.sourcePort),d=`M ${a.x} ${a.y} C ${a.x+direction*bend} ${a.y}, ${b.x-direction*bend} ${b.y+fan}, ${b.x} ${b.y}`,selected=state.selectedEdgeIds.includes(e.id);const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('class',`edge edge-${output?.type||'media'}${selected?' edge-selected':''}`);path.setAttribute('d',d);path.setAttribute('data-edge-id',e.id);edgesSvg.appendChild(path);const hit=document.createElementNS('http://www.w3.org/2000/svg','path');hit.setAttribute('class','edge-hit');hit.setAttribute('data-edge-id',e.id);hit.setAttribute('d',d);edgesSvg.appendChild(hit);
    });
    if(state.draggingWire&&state.wirePointer){
      const reverse=state.draggingWire.direction==='in',a=getPortCenter(state.draggingWire.nodeId,state.draggingWire.portId,reverse?'in':'out');
      const vr=$('#viewport').getBoundingClientRect();
      if(a){const x=(state.wirePointer.x-vr.left-state.panX)/state.zoom,y=(state.wirePointer.y-vr.top-state.panY)/state.zoom,dx=reverse?a.x-x:x-a.x,direction=dx<0?-1:1,bend=Math.max(55,Math.abs(dx)*.4),d=reverse?`M ${x} ${y} C ${x+direction*bend} ${y}, ${a.x-direction*bend} ${a.y}, ${a.x} ${a.y}`:`M ${a.x} ${a.y} C ${a.x+direction*bend} ${a.y}, ${x-direction*bend} ${y}, ${x} ${y}`;const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('class','edge edge-draft');p.setAttribute('d',d);edgesSvg.appendChild(p);}
    }
  }

  function scheduleDrawEdges() {
    if (state.edgeFrame) return;
    state.edgeFrame = requestAnimationFrame(() => { state.edgeFrame = 0; drawEdges(); });
  }

  function ensureComponentIds(){
    const used=new Set();
    for(const node of state.nodes){const data=node.data||(node.data={});if(!data.componentId||used.has(data.componentId)){const prefix=['imageInput','generateImage','imageResize'].includes(node.type)?'IMG':node.type==='videoInput'||node.type==='generateVideo'?'VID':'NODE';do{data.componentId=prefix+'-'+crypto.randomUUID().slice(0,8).toUpperCase();}while(used.has(data.componentId));}used.add(data.componentId);}
  }
  function render() {
    ensureComponentIds();
    syncPreviewOutputs();canvas.innerHTML='';state.groups.forEach(group=>canvas.appendChild(renderCanvasGroup(group)));state.notes.forEach(note=>canvas.appendChild(renderCanvasNote(note)));state.nodes.filter(n=>!n.data?.dockOnly).forEach(n => canvas.appendChild(renderNode(n)));applyCanvasTransform();requestAnimationFrame(drawEdges);syncTimelineDock();scheduleAutoSave();
  }

  function renderCanvasNote(note){
    const el=document.createElement('article');el.className='canvas-note';el.dataset.noteId=note.id;el.style.left=`${note.x}px`;el.style.top=`${note.y}px`;el.style.width=`${note.width||260}px`;el.style.height=`${note.height||160}px`;
    const header=document.createElement('header');header.className='canvas-note-header';const title=document.createElement('span');title.textContent='Text note';const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.title='Delete note';remove.onclick=event=>{event.stopPropagation();createUndoSnapshot('Delete text note');state.notes=state.notes.filter(item=>item.id!==note.id);render();saveState();};header.append(title,remove);
    header.onpointerdown=event=>{if(event.button!==0||event.target.closest('button'))return;event.preventDefault();event.stopPropagation();state.noteDrag={id:note.id,startX:event.clientX,startY:event.clientY,x:note.x,y:note.y,moved:false};try{header.setPointerCapture(event.pointerId);}catch{}};
    const textarea=document.createElement('textarea');textarea.value=note.text||'';textarea.placeholder='Write a note…';textarea.onbeforeinput=event=>trackUndoEdit(event);textarea.oninput=()=>{note.text=textarea.value;scheduleAutoSave();};
    el.append(header,textarea);return el;
  }
  function moveTextNote(event){const drag=state.noteDrag;if(!drag)return;const note=state.notes.find(item=>item.id===drag.id),el=document.querySelector(`.canvas-note[data-note-id="${CSS.escape(drag.id)}"]`);if(!note||!el)return;const dx=(event.clientX-drag.startX)/state.zoom,dy=(event.clientY-drag.startY)/state.zoom;if(Math.abs(dx)+Math.abs(dy)<2)return;if(!drag.moved)createUndoSnapshot('Move text note');drag.moved=true;note.x=drag.x+dx;note.y=drag.y+dy;el.style.left=`${note.x}px`;el.style.top=`${note.y}px`;}
  function finishTextNoteMove(){if(!state.noteDrag)return;const moved=state.noteDrag.moved;state.noteDrag=null;if(moved){render();saveState();}}

  function renderCanvasGroup(group){
    const frame=document.createElement('div');frame.className='canvas-group';frame.style.left=`${group.x}px`;frame.style.top=`${group.y}px`;frame.style.width=`${group.width}px`;frame.style.height=`${group.height}px`;
    const label=document.createElement('span');label.className='canvas-group-label';label.textContent=group.name||'Group';
    const remove=document.createElement('button');remove.type='button';remove.className='canvas-group-delete';remove.textContent='×';remove.title='Delete group region';remove.setAttribute('aria-label','Delete group region');remove.onclick=event=>{event.stopPropagation();createUndoSnapshot('Delete group region');state.groups=state.groups.filter(item=>item.id!==group.id);render();saveState();};
    frame.append(label,remove);return frame;
  }

  function syncPreviewOutputs(){for(const preview of state.nodes.filter(node=>node.type==='preview')){const edge=getIncoming(preview.id,'media')[0],source=edge&&nodeById(edge.source);let asset=null;if(source){asset=edge.sourcePort==='endFrame'?source.data?.endFrame:source.data?.asset;if(!asset&&source.type==='imageInput'&&source.data?.localDataUrl)asset={id:source.id,kind:'image',url:source.data.localDataUrl,name:'Input image'};}preview.data.asset=asset||null;}}

  function applyCanvasTransform(){const transform=`translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;canvas.style.transform=transform;edgesSvg.style.transform=transform;$('#zoomLevel').textContent=`${Math.round(state.zoom*100)}%`;$('#viewport').classList.toggle('hand-mode',state.handMode||state.spaceDown);}
  function zoomAt(clientX,clientY,factor){const rect=$('#viewport').getBoundingClientRect(),x=clientX-rect.left,y=clientY-rect.top,old=state.zoom,next=Math.max(.25,Math.min(2.5,old*factor));if(next===old)return;const contentX=(x-state.panX)/old,contentY=(y-state.panY)/old;state.zoom=next;state.panX=x-contentX*next;state.panY=y-contentY*next;applyCanvasTransform();scheduleDrawEdges();}
  function setZoom(value){const rect=$('#viewport').getBoundingClientRect();zoomAt(rect.left+rect.width/2,rect.top+rect.height/2,value/state.zoom);}
  function fitCanvas(){const nodes=state.nodes.filter(node=>!node.data?.dockOnly);if(!nodes.length){state.zoom=1;state.panX=0;state.panY=0;applyCanvasTransform();return;}const rect=$('#viewport').getBoundingClientRect(),xs=nodes.map(n=>n.x),ys=nodes.map(n=>n.y),maxX=Math.max(...nodes.map(n=>n.x+(document.querySelector(`.node[data-id="${CSS.escape(n.id)}"]`)?.offsetWidth||270))),maxY=Math.max(...nodes.map(n=>n.y+(document.querySelector(`.node[data-id="${CSS.escape(n.id)}"]`)?.offsetHeight||220)));const minX=Math.min(...xs),minY=Math.min(...ys),scale=Math.max(.25,Math.min(1.5,(rect.width-100)/(maxX-minX+80),(rect.height-80)/(maxY-minY+80)));state.zoom=scale;state.panX=(rect.width-(maxX-minX)*scale)/2-minX*scale;state.panY=(rect.height-(maxY-minY)*scale)/2-minY*scale;applyCanvasTransform();scheduleDrawEdges();}
  function startPan(event){state.panning={x:event.clientX,y:event.clientY,panX:state.panX,panY:state.panY};$('#viewport').classList.add('panning');try{event.currentTarget.setPointerCapture(event.pointerId);}catch{}event.preventDefault();}
  function movePan(event){if(!state.panning)return;state.panX=state.panning.panX+event.clientX-state.panning.x;state.panY=state.panning.panY+event.clientY-state.panning.y;applyCanvasTransform();scheduleDrawEdges();}
  function endPan(){state.panning=null;$('#viewport').classList.remove('panning');}

  function startSelectionMarquee(event){
    if(event.button!==0||state.handMode||state.spaceDown||event.target.closest('.node,.canvas-note,.canvas-tools,button'))return;
    const viewport=$('#viewport'),bounds=viewport.getBoundingClientRect(),keep=event.shiftKey||event.ctrlKey||event.metaKey;
    if(state.groupDrawMode){const box=document.createElement('div');box.className='group-marquee';viewport.appendChild(box);state.groupMarquee={startX:event.clientX,startY:event.clientY,bounds,box};try{viewport.setPointerCapture(event.pointerId);}catch{}event.preventDefault();return;}
    if(!keep){state.selectedNodeIds=[];state.selectedNodeId=null;state.selectedEdgeIds=[];document.querySelectorAll('.node.selected').forEach(node=>node.classList.remove('selected'));scheduleDrawEdges();}
    const box=document.createElement('div');box.className='selection-marquee';viewport.appendChild(box);
    state.selectionMarquee={startX:event.clientX,startY:event.clientY,bounds,box,keep,initial:[...state.selectedNodeIds],initialEdges:keep?[...state.selectedEdgeIds]:[]};
    try{viewport.setPointerCapture(event.pointerId);}catch{}event.preventDefault();
  }
  function moveSelectionMarquee(event){const drag=state.selectionMarquee;if(!drag)return;const left=Math.min(event.clientX,drag.startX),top=Math.min(event.clientY,drag.startY),right=Math.max(event.clientX,drag.startX),bottom=Math.max(event.clientY,drag.startY);Object.assign(drag.box.style,{left:`${left-drag.bounds.left}px`,top:`${top-drag.bounds.top}px`,width:`${right-left}px`,height:`${bottom-top}px`});const selected=new Set(drag.initial);for(const node of document.querySelectorAll('.node')){const r=node.getBoundingClientRect();if(r.right>=left&&r.left<=right&&r.bottom>=top&&r.top<=bottom)selected.add(node.dataset.id);}state.selectedNodeIds=[...selected];state.selectedNodeId=state.selectedNodeIds.at(-1)||null;document.querySelectorAll('.node').forEach(node=>node.classList.toggle('selected',selected.has(node.dataset.id)));const selectedEdges=new Set(drag.initialEdges);for(const path of edgesSvg.querySelectorAll('.edge[data-edge-id]')){const matrix=path.getScreenCTM();if(!matrix)continue;const length=path.getTotalLength();for(let point=0;point<=length;point+=Math.max(8,length/60)){const p=new DOMPoint(path.getPointAtLength(point).x,path.getPointAtLength(point).y).matrixTransform(matrix);if(p.x>=left&&p.x<=right&&p.y>=top&&p.y<=bottom){selectedEdges.add(path.dataset.edgeId);break;}}}state.selectedEdgeIds=[...selectedEdges];scheduleDrawEdges();}
  function endSelectionMarquee(){const drag=state.selectionMarquee;if(!drag)return;drag.box.remove();state.selectionMarquee=null;}

  function moveGroupMarquee(event){const drag=state.groupMarquee;if(!drag)return;const left=Math.min(event.clientX,drag.startX),top=Math.min(event.clientY,drag.startY),right=Math.max(event.clientX,drag.startX),bottom=Math.max(event.clientY,drag.startY);Object.assign(drag.box.style,{left:`${left-drag.bounds.left}px`,top:`${top-drag.bounds.top}px`,width:`${right-left}px`,height:`${bottom-top}px`});}
  function finishGroupMarquee(event){const drag=state.groupMarquee;if(!drag)return;const left=Math.min(event.clientX,drag.startX),top=Math.min(event.clientY,drag.startY),right=Math.max(event.clientX,drag.startX),bottom=Math.max(event.clientY,drag.startY);drag.box.remove();state.groupMarquee=null;const width=right-left,height=bottom-top;if(width<60||height<45){setGroupDrawMode(false);setRunStatus('Group region is too small. Drag a larger area to create it.','warn');return;}const zoom=state.zoom,viewport=drag.bounds,x=(left-viewport.left-state.panX)/zoom,y=(top-viewport.top-state.panY)/zoom,w=width/zoom,h=height/zoom,nodeIds=[...document.querySelectorAll('.node')].filter(element=>{const rect=element.getBoundingClientRect();return rect.left>=left&&rect.right<=right&&rect.top>=top&&rect.bottom<=bottom;}).map(element=>element.dataset.id);state.pendingGroup={x,y,width:w,height:h,nodeIds,defaultName:`Group ${state.groups.length+1}`};setGroupDrawMode(false);openGroupNameModal();}
  function openGroupNameModal(){const pending=state.pendingGroup;if(!pending)return;state.nameDialog={type:'group'};$('#nameDialogIcon').textContent='▱';$('#groupNameTitle').textContent='Name group';$('#groupNameDescription').textContent=`Skip to use the default name · ${pending.defaultName}`;$('#nameDialogLabel').textContent='Group name';$('#skipGroupNameBtn').classList.remove('hidden');$('#cancelNodeRenameBtn').classList.add('hidden');$('#confirmGroupNameBtn').textContent='Create group';const input=$('#groupNameInput');input.value='';input.placeholder=pending.defaultName;$('#groupNameModal').classList.remove('hidden');requestAnimationFrame(()=>input.focus());}
  function openNodeRenameModal(nodeId){const node=nodeById(nodeId);if(!node)return;state.nameDialog={type:'node',nodeId};const current=['generateImage','generateVideo','generateText'].includes(node.type)?generationNodeTitle(node):(node.data.customName||`${nodeDefs[node.type].title}${node.data.sceneLabel?` · ${node.data.sceneLabel}`:''}`);$('#nameDialogIcon').textContent='✎';$('#groupNameTitle').textContent='Rename node';$('#groupNameDescription').textContent='Choose a clear name to recognize this node on the canvas.';$('#nameDialogLabel').textContent='Node name';$('#skipGroupNameBtn').classList.add('hidden');$('#cancelNodeRenameBtn').classList.remove('hidden');$('#confirmGroupNameBtn').textContent='Save name';const input=$('#groupNameInput');input.value=current;input.placeholder='Enter node name';$('#groupNameModal').classList.remove('hidden');requestAnimationFrame(()=>{input.focus();input.select();});}
  function closeGroupNameModal(){ $('#groupNameModal').classList.add('hidden');state.nameDialog=null; }
  function confirmNameDialog(){const dialog=state.nameDialog,name=$('#groupNameInput').value.trim();if(!dialog)return;if(!name){setRunStatus(dialog.type==='node'?'Node name cannot be empty.':'Group name cannot be empty.','warn');$('#groupNameInput').focus();return;}if(dialog.type==='node'){const node=nodeById(dialog.nodeId);if(!node){closeGroupNameModal();return;}createUndoSnapshot('Rename node');node.data.customName=name;closeGroupNameModal();render();saveState();setRunStatus('Node renamed.','ok');return;}commitPendingGroup(name);}
  function commitPendingGroup(name){const pending=state.pendingGroup;if(!pending)return;createUndoSnapshot('Create group region');state.groups.push({id:uid('group'),name:name||pending.defaultName,x:pending.x,y:pending.y,width:pending.width,height:pending.height,nodeIds:pending.nodeIds});state.pendingGroup=null;closeGroupNameModal();render();saveState();setRunStatus(`Group region created${pending.nodeIds.length?` around ${pending.nodeIds.length} node${pending.nodeIds.length===1?'':'s'}`:''}.`,'ok');}
  function cancelGroupMarquee(){const drag=state.groupMarquee;if(drag){drag.box.remove();state.groupMarquee=null;}setGroupDrawMode(false);}
  function setGroupDrawMode(active){state.groupDrawMode=Boolean(active);$('#groupTool')?.classList.toggle('active',state.groupDrawMode);$('#groupTool')?.setAttribute('aria-pressed',String(state.groupDrawMode));$('#viewport').classList.toggle('group-draw-mode',state.groupDrawMode);if(state.groupDrawMode)setRunStatus('Group tool active: drag across the canvas to mark a group region. Press G or Escape to cancel.','warn');}

  function openCanvasMenu(e){
    const nodeEl=e.target.closest('.node');e.preventDefault();e.stopPropagation();
    if(!nodeEl){const rect=$('#viewport').getBoundingClientRect(),menu=$('#canvasMenu');state.contextPoint={x:(e.clientX-rect.left-state.panX)/state.zoom,y:(e.clientY-rect.top-state.panY)/state.zoom};menu.innerHTML='';delete menu.dataset.nodeId;const title=document.createElement('div');title.className='menu-caption';title.textContent='Canvas';menu.appendChild(title);[['＋ Prompt','add:prompt'],['＋ Text note','add:text'],['＋ Negative Prompt','add:negativePrompt'],['＋ Video đầu vào','add:videoInput'],['＋ Tạo văn bản','add:generateText'],['＋ Image Input','add:imageInput'],['＋ References','add:references'],['＋ Generate Image','add:generateImage'],['＋ Generate Video','add:generateVideo'],['＋ Timeline','add:timeline'],['＋ Preview','add:preview'],['Save workflow','save'],['▶ Run workflow','run'],['Arrange nodes','arrange'],['Delete selected node','delete-selected'],['Remove all connections','disconnect-all']].forEach(([label,action])=>{const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.contextAction=action;menu.appendChild(button);});menu.classList.remove('hidden');menu.style.left=`${Math.min(e.clientX,innerWidth-230)}px`;menu.style.top=`${Math.min(e.clientY,innerHeight-420)}px`;return;}
    e.stopPropagation();const node=nodeById(nodeEl.dataset.id);if(!node)return;state.selectedNodeId=node.id;
    const menu=$('#canvasMenu');menu.innerHTML='';menu.dataset.nodeId=node.id;
    const title=document.createElement('div');title.className='menu-caption';title.textContent=['generateImage','generateVideo','generateText'].includes(node.type)?generationNodeTitle(node):(node.data.customName||nodeDefs[node.type].title);menu.appendChild(title);
    const addAction=(label,action)=>{const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.contextAction=action;menu.appendChild(button);};
    addAction('Rename node…','node-rename');
    if(['generateImage','generateVideo','generateText'].includes(node.type))addAction(node.data.status==='running'?`■ Stop ${node.type==='generateVideo'?'Video':node.type==='generateText'?'Văn bản':'Ảnh'}`:`▶ Run ${node.type==='generateVideo'?'Video':node.type==='generateText'?'Văn bản':'Ảnh'}`,'node-run');
    if(node.type==='generateVideo')addAction('↻ Again · follow prompt more closely','node-again');
    if(node.type==='timeline')addAction('▶ Preview sequence','node-preview');
    if((nodeDefs[node.type]?.outputs||[]).some(port=>port.type==='text'))addAction('Create Text Merge node','node-create-text-merge');
    if((nodeDefs[node.type]?.outputs||[]).some(port=>['image','video'].includes(port.type)))addAction('Create Preview node','node-create-preview');
    if(node.type==='imageInput')addAction('Choose / replace image','node-choose-image');
    if(node.type==='imageResize')addAction('Download resized image','node-download-image');
    if(node.type==='preview')addAction('Download preview','node-download-preview');
    if(node.type==='prompt'||node.type==='negativePrompt'||node.type==='textAppend')addAction('Focus text field','node-focus-text');
    addAction('Duplicate node','node-duplicate');addAction('Disconnect node','node-disconnect');addAction('Delete node','node-delete');
    menu.classList.remove('hidden');menu.style.left=`${Math.min(e.clientX,innerWidth-230)}px`;menu.style.top=`${Math.min(e.clientY,innerHeight-380)}px`;
  }
  function openEdgeMenu(e){
    const hit=e.target.closest('.edge-hit[data-edge-id]');if(!hit)return;
    e.preventDefault();e.stopPropagation();const menu=$('#canvasMenu');menu.innerHTML='';menu.dataset.edgeId=hit.dataset.edgeId;delete menu.dataset.nodeId;
    const title=document.createElement('div');title.className='menu-caption';title.textContent='Connection';menu.appendChild(title);
    const button=document.createElement('button');button.type='button';button.textContent='Delete connection';button.dataset.contextAction='edge-delete';menu.appendChild(button);
    menu.classList.remove('hidden');menu.style.left=`${Math.min(e.clientX,innerWidth-230)}px`;menu.style.top=`${Math.min(e.clientY,innerHeight-120)}px`;
  }
  function selectEdgePointer(e){if(e.button!==0)return;const hit=e.target.closest('.edge-hit[data-edge-id]');if(!hit)return;e.preventDefault();e.stopPropagation();const id=hit.dataset.edgeId;state.selectedEdgeIds=e.shiftKey?[...new Set([...state.selectedEdgeIds,id])]:[id];scheduleDrawEdges();}
  function closeCanvasMenu(){ $('#canvasMenu').classList.add('hidden'); }
  function runNodeContextAction(action){const menu=$('#canvasMenu'),node=nodeById(menu.dataset.nodeId);if(!node)return;closeCanvasMenu();
    if(action==='node-rename'){const current=['generateImage','generateVideo','generateText'].includes(node.type)?generationNodeTitle(node):(node.data.customName||`${nodeDefs[node.type].title}${node.data.sceneLabel?` · ${node.data.sceneLabel}`:''}`),name=window.prompt('Enter a name for this node:',current);if(name===null)return;const trimmed=name.trim();if(!trimmed){setRunStatus('Node name cannot be empty.','warn');return;}createUndoSnapshot('Rename node');node.data.customName=trimmed;render();saveState();setRunStatus('Node renamed.','ok');return;}
    if(action==='node-run'){runSingleNode(node.id);return;}if(action==='node-again'){executeGenerationNode(node.id,{again:true});return;}if(action==='node-preview'){playTimeline(node);return;}if(action==='node-delete'){removeNode(node.id);return;}
    if(action==='node-create-text-merge'){const output=(nodeDefs[node.type]?.outputs||[]).find(port=>port.type==='text');if(!output)return;createUndoSnapshot('Create Text Merge node');const target=makeNode('textConcat',node.x+350,node.y);target.data={separator:', '};state.nodes.push(target);state.edges.push({id:uid('edge'),source:node.id,sourcePort:output.id,target:target.id,targetPort:'text'});render();saveState();setRunStatus('Text Merge created and connected to this text output.','ok');return;}
    if(action==='node-create-preview'){const output=(nodeDefs[node.type].outputs||[]).find(port=>['image','video'].includes(port.type));if(output){createUndoSnapshot('Create Preview node');const target=makeNode('preview',node.x+350,node.y);state.nodes.push(target);state.connectingFrom={nodeId:node.id,portId:output.id};connect(target.id,'media');}return;}
    if(action==='node-disconnect'){if(state.edges.some(edge=>edge.source===node.id||edge.target===node.id)){createUndoSnapshot('Disconnect node');state.edges=state.edges.filter(edge=>edge.source!==node.id&&edge.target!==node.id);render();saveState();setRunStatus('Node connections removed.','ok');}return;}
    const el=document.querySelector(`.node[data-id="${CSS.escape(node.id)}"]`);
    if(action==='node-focus-text'){el?.querySelector('textarea')?.focus();return;}
    if(action==='node-choose-image'){el?.querySelector('input[type="file"]')?.click();return;}
    if(action==='node-download-image'||action==='node-download-preview'){const url=node.data.asset?.url;if(url){const link=document.createElement('a');link.href=url;link.download=node.data.asset.name||'museflow-output';link.click();}else setRunStatus('This node has no output to download.','warn');return;}
    if(action==='node-duplicate'){createUndoSnapshot('Duplicate node');const copy=structuredClone(node);copy.id=uid(node.type);copy.x+=36;copy.y+=36;copy.data={...copy.data};state.nodes.push(copy);if(['generateImage','generateVideo','generateText'].includes(copy.type)){const references=state.nodes.find(item=>item.type==='references');if(references)connectReferenceNode(references,copy);}render();saveState();setRunStatus('Node duplicated.','ok');}
  }
  function arrangeNodes(){
    try{
      const order=topoOrder().filter(id=>!nodeById(id)?.data?.dockOnly),level=new Map(order.map(id=>[id,0]));
      for(const id of order)for(const edge of state.edges.filter(e=>e.source===id&&level.has(e.target)))level.set(edge.target,Math.max(level.get(edge.target)||0,(level.get(id)||0)+1));
      const groups=new Map();for(const id of order){const l=level.get(id)||0;if(!groups.has(l))groups.set(l,[]);groups.get(l).push(id);}
      createUndoSnapshot('Arrange nodes');for(const [l,ids] of groups.entries())ids.forEach((id,row)=>{const node=nodeById(id);node.x=70+l*350;node.y=60+row*260;});
      render();setRunStatus('Nodes arranged by workflow order.','ok');
    }catch(error){setRunStatus(error.message,'error');}
  }
  function runCanvasAction(action){
    if(action==='edge-delete'){const menu=$('#canvasMenu'),edgeId=menu.dataset.edgeId;closeCanvasMenu();if(!edgeId)return;const before=state.edges.length;if(state.edges.some(edge=>edge.id===edgeId))createUndoSnapshot('Delete connection');state.edges=state.edges.filter(edge=>edge.id!==edgeId);delete menu.dataset.edgeId;if(state.edges.length!==before){render();saveState();setRunStatus('Connection deleted.','ok');}return;}
    if(action.startsWith('node-')){runNodeContextAction(action);return;}
    closeCanvasMenu();const pos=state.contextPoint;
    if(action==='add:text'){addTextNote(pos.x,pos.y);return;}
    if(action.startsWith('add:')){addNode(action.slice(4),pos.x,pos.y);return;}
    if(action==='save'){saveState();return;}if(action==='run'){executeWorkflow();return;}if(action==='arrange'){arrangeNodes();return;}
    if(action==='delete-selected'){if(state.selectedNodeIds.length)removeSelectedNodes();else if(state.selectedNodeId)removeNode(state.selectedNodeId);else setRunStatus('Select one or more nodes first.','warn');return;}
    if(action==='disconnect-all'){if(state.edges.length){createUndoSnapshot('Remove all connections');state.edges=[];state.connectingFrom=null;render();saveState();setRunStatus('All connections removed.','ok');}}
  }

  function getIncoming(nodeId, targetPort) { return state.edges.filter(e => e.target===nodeId && (!targetPort || e.targetPort===targetPort)); }
  function sourceFor(edge) { return edge ? nodeById(edge.source) : null; }

  function resolveText(nodeId,seen=new Set()){
    if(seen.has(nodeId))return '';seen.add(nodeId);
    const node=nodeById(nodeId);if(!node)return '';
    if(node.type==='generateText'&&node.data.toolKind==='promptVariants'){const variants=WorkflowTools.variants(node.data.text);if(node.data.text?.trim()&&!variants.length)throw new Error('Chưa có biến thể tách biệt hợp lệ. Chạy lại node Biến thể prompt trước.');return variants[Math.min(variants.length-1,Math.max(0,Number(node.data.selectedVariant)||0))]||String(node.data.text||'');}
    if(node.type==='generateText'||['sceneSplit','qualityCheck','bundleSave'].includes(node.type))return String(node.data.text||'');
    if(node.type==='characterLock')return node.data.lockedAsset?`CHARACTER LOCK [${node.data.componentId}]: ${node.data.lockedDescription||'Giữ nguyên nhận dạng nhân vật, khuôn mặt, tóc và trang phục theo ảnh chuẩn.'}`:'';
    if(node.type==='review')return String(node.data.approvedText||toolText(node));
    if(['prompt','negativePrompt'].includes(node.type))return String(node.data?.text??node.data?.prompt??node.data?.value??'');
    if(node.type==='textAppend'){
      const parent=sourceFor(getIncoming(nodeId,'text')[0]);
      return [parent?resolveText(parent.id,new Set(seen)):'' ,String(node.data?.text??'')].filter(value=>value.trim()).join(' ');
    }
    if(node.type==='textConcat'){
      const inputs=getIncoming(nodeId,'text').map(sourceFor).filter(Boolean).map(source=>resolveText(source.id,new Set(seen))).filter(Boolean);
      return inputs.join(node.data.separator??', ');
    }
    const source=sourceFor(getIncoming(nodeId,'text')[0]);return source?resolveText(source.id,seen):'';
  }
  function resolvePrompt(nodeId){
    const node=nodeById(nodeId);if(node?.data.toolKind==='videoAnalysis'&&!getIncoming(nodeId,'prompt').length)return 'Phân tích video đính kèm và viết prompt tái tạo chi tiết.';
    return getIncoming(nodeId,'prompt').map(edge=>nodeById(edge.source)).filter(Boolean).map(source=>resolveText(source.id).trim()).filter(Boolean).join('\n\n');
  }
  function resolveNegativePrompt(nodeId){const source=sourceFor(getIncoming(nodeId,'negative')[0]);return source?resolveText(source.id):'';}
  function timelinePredecessor(nodeId){const timeline=state.nodes.find(item=>item.type==='timeline'),order=timeline?.data?.clipOrder||[],index=order.indexOf(nodeId);return index>0?nodeById(order[index-1]):null;}
  function resolveReferences(nodeId){
    const references=[],seen=new Map();
    const add=(url,name,componentId,roles=[],instructions='')=>{if(!url)return;if(seen.has(url)){const old=seen.get(url);old.roles=[...new Set([...old.roles,...roles])];if(componentId!==old.componentId)old.aliases=[...new Set([...(old.aliases||[]),componentId])];if(instructions&&!old.instructions.includes(instructions))old.instructions+='\n'+instructions;return;}const ref={url,name:name||'Ảnh tham chiếu',componentId,roles,instructions};seen.set(url,ref);references.push(ref);};
    const visit=(source,sourcePort,visited=new Set(),roles=[])=>{
      if(!source||visited.has(source.id))return;const next=new Set(visited);next.add(source.id);
      if(['references','imageRoles','review'].includes(source.type)){
        for(const edge of getIncoming(source.id).filter(edge=>source.type!=='review'||edge.targetPort==='reference'))visit(nodeById(edge.source),edge.sourcePort,next,source.type==='imageRoles'?[...roles,({character:'Nhân vật',background:'Bối cảnh',clothing:'Trang phục',pose:'Tư thế'})[edge.targetPort]]:roles);return;
      }
      if(source.type==='characterLock'){add(source.data.lockedAsset?.url,'Ảnh nhân vật đã khóa',source.data.componentId,roles,resolveText(source.id));return;}
      if(sourcePort==='endFrame'){add(source.data?.endFrame?.url,source.data?.endFrame?.name,source.data.componentId+'-END',roles);return;}
      if(source.type==='imageInput'){add(source.data.localDataUrl,'Ảnh đầu vào',source.data.componentId,roles);return;}
      if(source.data.asset?.kind==='image')add(source.data.asset.url,source.data.asset.name,source.data.componentId,roles);
    };
    const node=nodeById(nodeId),previous=node?.type==='generateVideo'&&node.data.continuity?timelinePredecessor(nodeId):null;if(previous)add(previous.data.endFrame?.url,'Khung cuối cảnh trước',previous.data.componentId+'-END',['Khung mở đầu']);
    for(const edge of getIncoming(nodeId,'reference'))visit(nodeById(edge.source),edge.sourcePort);
    return references;
  }

  function topoOrder(preferredGenerationOrder=null) {
    const indeg=new Map(state.nodes.map(n=>[n.id,0])), outgoing=new Map(state.nodes.map(n=>[n.id,[]]));
    const addOrderEdge=(from,to,allowSelf=false)=>{if((from===to&&!allowSelf)||!outgoing.has(from)||!outgoing.has(to)||outgoing.get(from).includes(to))return;outgoing.get(from).push(to);indeg.set(to,indeg.get(to)+1);};
    state.edges.forEach(e=>addOrderEdge(e.source,e.target,true));
    for(const node of state.nodes.filter(item=>item.type==='generateVideo'&&item.data?.continuity)){const previous=timelinePredecessor(node.id);if(previous)addOrderEdge(previous.id,node.id);}
    if(preferredGenerationOrder){const present=new Set(state.nodes.filter(item=>['generateImage','generateVideo','generateText'].includes(item.type)).map(item=>item.id)),ordered=[...new Set(preferredGenerationOrder.filter(id=>present.has(id)))];for(let i=1;i<ordered.length;i++)addOrderEdge(ordered[i-1],ordered[i]);}
    const timeline=state.nodes.find(item=>item.type==='timeline'),orderedVideos=(timeline?.data?.clipOrder||[]).filter(id=>nodeById(id)?.type==='generateVideo');
    for(const node of state.nodes)if(node.type==='generateVideo'&&!orderedVideos.includes(node.id))orderedVideos.push(node.id);
    const videoRank=new Map(orderedVideos.map((id,index)=>[id,index])),nodeRank=new Map(state.nodes.map((node,index)=>[node.id,index]));
    const priority=id=>{const item=nodeById(id);return item?.type==='generateVideo'?state.nodes.length+1+(videoRank.get(id)??nodeRank.get(id)):nodeRank.get(id)??0;};
    const q=state.nodes.filter(n=>indeg.get(n.id)===0).map(n=>n.id), out=[];
    while(q.length){q.sort((a,b)=>priority(a)-priority(b));const id=q.shift();out.push(id);for(const target of outgoing.get(id)){indeg.set(target,indeg.get(target)-1);if(indeg.get(target)===0)q.push(target);}}
    if(out.length!==state.nodes.length) throw new Error('Workflow contains a cycle. Remove the loop first.'); return out;
  }

  function requiredNodeOrder(targetId){
    const required=new Set();
    const visit=id=>{if(required.has(id))return;required.add(id);for(const edge of state.edges.filter(item=>item.target===id))visit(edge.source);const node=nodeById(id),previous=node?.type==='generateVideo'&&node.data?.continuity?timelinePredecessor(id):null;if(previous)visit(previous.id);};
    visit(targetId);return topoOrder().filter(id=>required.has(id));
  }

  function validateTargetPrompt(targetId){
    const target=nodeById(targetId);if(!target||!['generateImage','generateVideo','generateText'].includes(target.type))throw new Error('Selected generation node no longer exists.');
    const prompt=resolvePrompt(targetId);if(prompt.trim())return prompt;
    const edge=getIncoming(targetId,'prompt')[0],source=edge&&nodeById(edge.source);
    const detail=!edge?'Connect a Prompt, Text Append, or Text Merge node to this prompt input.':!source?'The connected prompt node no longer exists.':`The connected ${nodeDefs[source.type]?.title||'text'} node has no text.`;
    target.data.status='error';target.data.error=detail;
    render();throw new Error(`${nodeDefs[target.type]?.title||'Generation node'} ${target.id}: ${detail}`);
  }

  let preferredMuseTabId=null;
  async function museTabMessage(message, preferredTabId, signal) {
    if(signal?.aborted)throw new DOMException('Generation stopped by user.','AbortError');
    const tabs=await chrome.tabs.query({url:['https://muse.ai/*','https://*.muse.ai/*']});
    if(!tabs.length)throw new Error('Open Muse.ai and sign in, then retry.');
    const preferred=preferredTabId??preferredMuseTabId;
    if(preferred){const index=tabs.findIndex(tab=>tab.id===preferred);if(index>0)tabs.unshift(tabs.splice(index,1)[0]);}
    let lastError='';
    if(message.type==='MUSEFLOW_GENERATE'){const tab=chooseChat('muse',tabs,message.chatTarget||aiChatTargets.muse);await chrome.scripting.executeScript({target:{tabId:tab.id},files:['composer-controls.js','muse-bridge.js']});preferredMuseTabId=tab.id;await waitTabIdle(tab.id,'MUSEFLOW_CHECK_SESSION',message.requestId,signal);aiTabs.set(message.requestId,tab.id);try{return await sendMuseTabMessage(tab.id,message,signal);}finally{aiTabs.delete(message.requestId);}}
    for(const tab of tabs){
      if(signal?.aborted)throw new DOMException('Generation stopped by user.','AbortError');
      if(!tab.id)continue;
      try{const response=await sendMuseTabMessage(tab.id,message,signal);preferredMuseTabId=tab.id;return response;}catch(error){if(error?.name==='AbortError')throw error;lastError=error?.message||String(error);}
      try{
        await chrome.scripting.executeScript({target:{tabId:tab.id},files:['composer-controls.js','muse-bridge.js']});
        const response=await sendMuseTabMessage(tab.id,message,signal);preferredMuseTabId=tab.id;return response;
      }catch(error){if(error?.name==='AbortError')throw error;lastError=error?.message||String(error);}
    }
    throw new Error(`Muse tab found, but MuseFlow could not attach its page bridge: ${lastError||'unknown browser error'}. Check Muse site access in the browser extension settings, then retry.`);
  }

  function sendMuseTabMessage(tabId,message,signal){
    if(!signal)return chrome.tabs.sendMessage(tabId,message);
    if(signal.aborted)return Promise.reject(new DOMException('Generation stopped by user.','AbortError'));
    return new Promise((resolve,reject)=>{
      let settled=false;
      const finish=(fn,value)=>{if(settled)return;settled=true;signal.removeEventListener('abort',onAbort);fn(value);};
      const onAbort=()=>finish(reject,new DOMException('Generation stopped by user.','AbortError'));
      signal.addEventListener('abort',onAbort,{once:true});
      chrome.tabs.sendMessage(tabId,message).then(value=>finish(resolve,value),error=>finish(reject,error));
    });
  }

  function stopGeneration(nodeId=state.activeGenerationId){
    const run=runForNode(nodeId);if(!run)return;
    run.controller.abort();void sendMuseStop(run.requestId);setRunStatus('Đã dừng nhánh của node '+nodeId,'warn');render();
  }
  function stopAllRuns(){autoPlan?.controller.abort();for(const run of activeRuns.values()){run.controller.abort();void sendMuseStop(run.requestId);}setRunStatus('Đang dừng tất cả các nhánh…','warn');}

  async function sendMuseStop(requestId){
    if(!requestId)return; // A null ID means stop all in the Muse bridge.
    try{
      const tabs=await chrome.tabs.query({url:['https://muse.ai/*','https://*.muse.ai/*']});
      const ordered=preferredMuseTabId?tabs.sort((a,b)=>(b.id===preferredMuseTabId)-(a.id===preferredMuseTabId)):tabs;
      await Promise.allSettled(ordered.filter(tab=>tab.id).map(tab=>chrome.tabs.sendMessage(tab.id,{type:'MUSEFLOW_STOP_GENERATION',requestId})));
    }catch{}
  }

  async function testMuseSession(preferredTabId) {
    const button=$('#testMuseBtn'),status=$('#connectionStatus');
    if(button)button.disabled=true;
    status.className='warn';status.textContent='Checking Muse session…';
    try{
      const result=await museTabMessage({type:'MUSEFLOW_CHECK_SESSION'},preferredTabId);
      const tabs=await chrome.tabs.query({url:['https://muse.ai/*','https://*.muse.ai/*']});
      const checked=tabs.find(tab=>tab.id===preferredTabId)||tabs.find(tab=>tab.active)||tabs[0];
      if(checked?.id)preferredMuseTabId=checked.id;
      const ready=Boolean(result.composer&&result.signedIn);
      status.className=ready?'ok':'warn';
      status.textContent=ready?'Muse session connected.':result.loginRequired?'Muse asks you to sign in. Sign in on the Muse tab, then check again.':result.composer?'Muse chat is ready. Session state could not be confirmed; generation can still be tried.':'Muse tab found, but its chat message box is not ready. Open a Muse chat and try again.';
      museStatus.textContent=ready?'● Muse sẵn sàng':'● Muse cần kiểm tra';
      museStatus.className=ready?'ok':result.loginRequired?'warn':'ok';
      if(!ready&&!result.loginRequired){museStatus.textContent='● Ô chat Muse sẵn sàng · chưa xác nhận phiên';}
      return ready||Boolean(result.composer&&!result.loginRequired);
    }catch(error){
      status.className='error';status.textContent=error.message;
      museStatus.textContent='● Kết nối Muse thất bại';museStatus.className='error';
      return false;
    }finally{if(button)button.disabled=false;}
  }

  async function execute(targetId=null,{again=false,generationOrder=null,sinceSequence=completionSequence}={}) {
    if(!targetId&&activeRuns.size){setRunStatus('Có nhánh đang chạy. Bấm Chạy trên node độc lập để chạy thêm.','warn');return;}
    // Keep runtime graph references valid even if an older saved workflow or
    // an interrupted UI action left stale node IDs behind.
    normalizeSavedGraph();
    // A persisted "running" flag can survive a tab reload even though the old
    // request no longer exists. Normalize it before starting a fresh run.
    for(const node of state.nodes)if(['generateImage','generateVideo','generateText'].includes(node.type)&&node.data.status==='running'&&!runForNode(node.id)){
      node.data.status=(node.type==='generateText'?node.data.text?.trim():node.data.asset?.url)?'success':'idle';
      if(node.data.status==='idle')node.data.error='Previous run was interrupted; ready to retry.';
    }
    const abortController=new AbortController(),run={id:uid('run'),controller:abortController,activeNodeId:targetId,targetId,requestId:null,startSequence:sinceSequence};activeRuns.set(run.id,run);const pendingTarget=nodeById(targetId);if(pendingTarget){pendingTarget.data.status='running';pendingTarget.data.progress='Đang chuẩn bị nhánh…';}syncRuns();
    setRunStatus(targetId?(again?'Regenerating video with stronger prompt adherence…':'Running selected generation node…'):'Running workflow...','warn');
    try{
      if(targetId&&['generateText','generateImage','generateVideo'].includes(nodeById(targetId)?.type)&&!getIncoming(targetId,'prompt').some(edge=>requiredNodeOrder(edge.source).some(id=>nodeById(id)?.type==='generateText')))validateTargetPrompt(targetId);
      const selectedGenerations=generationOrder?new Set(generationOrder):null;
      const order=targetId?requiredNodeOrder(targetId).filter(id=>{const prerequisite=nodeById(id);return id===targetId||!['generateImage','generateVideo','generateText'].includes(prerequisite?.type)||runForNode(id)||autoPlan?.ids.has(id)&&prerequisite.data.status==='queued'||!(prerequisite.type==='generateText'?prerequisite.data?.text?.trim():prerequisite.data?.asset?.url);}):topoOrder(generationOrder).filter(id=>{const node=nodeById(id);return !selectedGenerations||!['generateImage','generateVideo','generateText'].includes(node?.type)||selectedGenerations.has(id);});
      for(const n of state.nodes){
        if(['imageInput','videoInput'].includes(n.type)&&n.data.localDataUrl)n.data.asset={id:n.data.asset?.id||uid('asset'),kind:n.type==='videoInput'?'video':'image',url:n.data.localDataUrl,sourceNodeId:n.id};
      }
      let generationStep=0;
      const totalGenerations=order.filter(id=>['generateImage','generateVideo','generateText'].includes(nodeById(id)?.type)).length;
      for(const id of order){
        if(abortController.signal.aborted)throw new DOMException('Generation stopped by user.','AbortError');
        const n=nodeById(id); if(!n)continue;
        const work=WorkflowTools.definitions[n.type]||['generateText','generateImage','generateVideo','imageResize'].includes(n.type);
        if(work){
          const owner=nodeClaims.get(id);
          if(owner){const pending=nodeById(targetId);if(pending&&pending.id!==id){pending.data.status='running';pending.data.progress='Đang đợi node đầu vào…';render();}progressNode(nodeById(targetId),`Đang đợi kết quả từ node ${n.data.componentId||id}…`);const result=await WorkflowRuntime.waitFor(owner.done,abortController.signal);if(!result.ok)throw new Error('Node đầu vào không hoàn tất: '+result.error);continue;}
          const prior=nodeOutcomes.get(id);if(id!==targetId&&prior?.sequence>run.startSequence){if(!prior.ok)throw new Error('Node đã chạy trong nhánh khác nhưng không hoàn tất: '+prior.error);continue;}
        }
        let claim,stepError;if(work){let finish;const done=new Promise(resolve=>finish=resolve);claim={run,done,finish};nodeClaims.set(id,claim);run.activeNodeId=id;run.requestId=null;syncRuns();}
        try{

        if(WorkflowTools.definitions[n.type]){
          run.activeNodeId=n.id;n.data.status='running';n.data.error='';render();
          try{
            if(n.type==='characterLock'&&!n.data.lockedAsset)throw new Error('Node nhân vật chưa khóa ảnh chuẩn.');
            if(n.type==='review')await reviewTool(n,abortController.signal);
            if(n.type==='qualityCheck')await checkTool(n,abortController.signal);
            if(n.type==='bundleSave')await saveTool(n,abortController.signal);
            if(n.type==='sceneSplit'){n.data.text=toolText(n)||n.data.text||'';n.data.report=`Đã đọc ${parseSceneScript(n.data.text).length} cảnh. Bấm Tạo các node cảnh để tạo, sau đó chạy các node mới.`;}
            if(n.data.status==='running')n.data.status='success';render();continue;
          }catch(error){n.data.status=error.name==='AbortError'?'stopped':'error';n.data.error=error.message;render();throw error;}
        }
        if(n.type==='imageResize'){
          const source=sourceFor(getIncoming(n.id,'image')[0]);const url=source?.data?.localDataUrl||source?.data?.asset?.url;
          if(!url){setRunStatus('Image Resize is waiting for an input image.','warn');continue;}
          const image=await loadImage(url),canvas=document.createElement('canvas');drawResized(image,canvas,n.data);
          const resized=canvas.toDataURL('image/png');n.data.asset={id:uid('asset'),kind:'image',url:resized,name:`Resized ${n.data.width}×${n.data.height}`,width:canvas.width,height:canvas.height,sourceNodeId:n.id};
          state.edges.filter(e=>e.source===n.id).forEach(e=>{const target=nodeById(e.target);if(target?.type==='preview')target.data.asset=n.data.asset;});render();continue;
        }
        if(n.type==='generateText'){
          run.activeNodeId=n.id;n.data.status='running';n.data.text='';n.data.progress='';n.data.error='';render();
          try{
            if(n.data.toolKind==='videoAnalysis'&&!resolveVideos(n.id).length)throw new Error('Nối video gốc trước khi phân tích.');
            const prompt=resolvePrompt(n.id);if(!prompt.trim())throw new Error('Nối node yêu cầu vào cổng Prompt trước.');
            const request={requestId:uid('text'),mediaType:'text',stageBeforeSend:n.data.sendMode==='delay',prompt,rules:[WorkflowTools.rules(n.data),...getIncoming(n.id,'rules').map(sourceFor).filter(Boolean).map(source=>resolveText(source.id))].filter(Boolean).join('\n'),referenceImages:resolveReferences(n.id).map(item=>item.url),referenceVideos:resolveVideos(n.id),model:n.data.apiModel};run.requestId=request.requestId;
            const reply=await generateWithProvider(n,request,abortController.signal);if(!reply?.ok||!reply.text)throw new Error(reply?.error||'AI không trả về văn bản.');
            if(abortController.signal.aborted)throw new DOMException('Đã dừng.','AbortError');n.data.text=reply.text;if(n.data.toolKind==='promptVariants'&&!WorkflowTools.variants(reply.text).length)throw new Error('AI chưa trả các biến thể tách biệt. Xem kết quả và chạy lại; chưa chuyển sang node tạo ảnh.');n.data.status='success';render();continue;
          }catch(error){n.data.status=abortController.signal.aborted?'stopped':'error';n.data.error=error.message;render();throw error;}
        }
        if(['generateImage','generateVideo','generateText'].includes(n.type)){
          const isVideo=n.type==='generateVideo';
          generationStep++;
          const prompt=resolvePrompt(n.id); if(!String(prompt).trim()) throw new Error(`${nodeDefs[n.type].title} ${n.id}: connect a Prompt, Text Append, or Text Merge node first.`);
          const negativePrompt=resolveNegativePrompt(n.id);
          const continuityPrevious=isVideo&&n.data.continuity?timelinePredecessor(n.id):null,continuityStartFrame=continuityPrevious?.data?.endFrame?.url?continuityPrevious.data.endFrame:null;
          if(isVideo&&n.data.continuity&&!continuityStartFrame)throw new Error(`End-frame continuity for ${n.id} needs the previous Timeline clip to be generated successfully with an extractable final frame. Put clips in order and run the previous clip first.`);
          const referenceImages=resolveReferences(n.id);
          run.activeNodeId=n.id;n.data.status='running';n.data.progress='';n.data.error='';n.data.asset=null;n.data.endFrame=null;state.edges.filter(edge=>edge.source===n.id).forEach(edge=>{const target=nodeById(edge.target);if(target?.type==='preview')target.data.asset=null;});render();setRunStatus(`${targetId?'Selected node':`Generation ${generationStep}/${totalGenerations}`} · generating ${isVideo?'video':'image'}: ${n.id}`,'warn');
          try{
            const sizeInstruction=`Output aspect ratio: ${n.data.size}. Match this frame shape exactly. ${n.data.size==='16:9'?'Use a wide landscape composition.':n.data.size==='9:16'?'Use a tall portrait composition.':n.data.size==='1:1'?'Use a square composition.':n.data.size==='4:3'?'Use a standard landscape composition.':'Use a standard portrait composition.'}`;
            const continuityInstruction=continuityStartFrame?'CONTINUITY LOCK: Attached image 1 is the exact final frame of the previous Timeline clip. Use image 1 as the exact first frame of this video: preserve its subject identity, pose, position, camera angle, crop, lighting, and background. Continue motion naturally from that precise moment. No reset, jump, flash, dissolve, or scene change at the start.':'';
            const audioRequirement=isVideo?'AUDIO IS REQUIRED: Return a video with audible, synchronized sound; do not make a silent clip. Follow the requested audio direction and make its music and sound effects clearly audible. Do not add spoken dialogue unless the prompt asks for it.':'';
            const fidelityInstruction=isVideo&&again?'\n\nPROMPT FIDELITY: Follow the provided prompt closely and depict its requested characters, actions, setting, sequence, mood, and visual details. Keep the main action clear and recognizable throughout the clip. Do not substitute a different scene, omit requested actions, or add unrelated events. Use the connected reference images to preserve subject identity and appearance.':'';
            const musePrompt=isVideo?`Create a ${n.data.size} aspect ratio video clip, ${n.data.duration} seconds long. ${sizeInstruction}\n\n${audioRequirement}${continuityInstruction?`\n\n${continuityInstruction}`:''}${referenceImages.length?`\n\nUse the attached reference image${referenceImages.length===1?'':'s'} as visual guidance${continuityStartFrame?' while keeping image 1 as the exact opening frame.':'.'}`:''}\n\nPrompt: ${prompt}${negativePrompt?`\n\nAvoid: ${negativePrompt}`:''}${fidelityInstruction}`:WorkflowTools.imagePrompt(prompt,n.data.size,negativePrompt);
            const generationRequest={type:'MUSEFLOW_GENERATE',requestId:uid('generation'),prompt:musePrompt,negativePrompt,size:n.data.size,model:n.data.model,duration:n.data.duration,mediaType:isVideo?'video':'image',referenceImages:referenceImages.map(item=>item.url),timeoutSec:600};run.requestId=generationRequest.requestId;
            generationRequest.referenceVideos=resolveVideos(n.id);generationRequest.model=n.data.apiModel;
            let reply=await generateWithProvider(n,generationRequest,abortController.signal);
            if(abortController.signal.aborted)throw new DOMException('Generation stopped by user.','AbortError');
            if((n.data.provider||'muse')==='muse'&&!reply?.ok&&reply?.code==='SCENE_REFUSED'){
              setRunStatus(`Muse could not create ${n.data.sceneLabel||'this scene'}; retrying once with a close, safe alternative…`,'warn');
              const retryRequest={...generationRequest,prompt:`${musePrompt}\n\nSAFE EQUIVALENT RETRY: The previous version could not be generated. Create a close, allowed alternative for the same scene now. Stay faithful to the script's story purpose, characters, relationship, setting, action, mood, visual style, framing, continuity, and requested duration/aspect ratio. Change only the specific detail that prevents generation, replacing it with the nearest safe equivalent. Keep this scene in the story; do not skip it or change what it needs to accomplish. Do not ask a follow-up question or ask permission; generate the alternative in this attempt. Follow all content and safety rules.`};
              retryRequest.requestId=uid('retry');run.requestId=retryRequest.requestId;reply=await generateWithProvider(n,retryRequest,abortController.signal);
            }
            if(abortController.signal.aborted)throw new DOMException('Generation stopped by user.','AbortError');
            if(!reply?.ok)throw new Error(reply?.error||`Muse.ai did not return a generated ${isVideo?'video':'image'}.`);
            const kind=isVideo?'video':'image';
            const url=isVideo?reply.url:await persistImage(reply.url);
            if(!url)throw new Error(`Muse.ai returned an empty ${kind} attachment.`);
            const intrinsic=await mediaDimensions(url,isVideo?'video':'image');
            const actualRatio=intrinsic.width&&intrinsic.height?intrinsic.width/intrinsic.height:0;
            const expectedRatio=ratioValue(n.data.size);
            const sizeMismatch=actualRatio&&Math.abs(Math.log(actualRatio/expectedRatio))>0.09;
            if(sizeMismatch&&(n.data.provider||'muse')==='muse')throw new Error(`Muse returned ${intrinsic.width} × ${intrinsic.height}, which does not match the requested ${n.data.size} aspect ratio. The old result was cleared; retry generation after checking the Muse output.`);
            n.data.asset={id:uid('asset'),kind,url,name:`${isVideo?'Video':'Image'} ${n.id}`,sourceNodeId:n.id,width:intrinsic.width,height:intrinsic.height,requestedSize:n.data.size,sizeMismatch,actualDuration:intrinsic.duration||null}; n.data.status='success';
            if(isVideo&&intrinsic.duration&&Math.abs(intrinsic.duration-Number(n.data.duration))>1)n.data.error=`Yêu cầu ${n.data.duration}s, AI trả về ${intrinsic.duration.toFixed(1)}s. Thời lượng clip phụ thuộc dịch vụ.`;
            if(isVideo)n.data.endFrame=await extractVideoEndFrame(url);
            if(sizeMismatch)n.data.error=`Requested ${n.data.size}, received ${intrinsic.width}×${intrinsic.height}. Muse returned a different aspect ratio.`;
            state.edges.filter(e=>e.source===n.id).forEach(e=>{const target=nodeById(e.target);if(target?.type==='preview')target.data.asset=e.sourcePort==='endFrame'?n.data.endFrame:n.data.asset;});render();
          }catch(err){if(err?.name==='AbortError'||abortController.signal.aborted){n.data.status='stopped';n.data.error='Generation stopped by user.';render();throw new DOMException('Generation stopped by user.','AbortError');}n.data.status='error';n.data.error=err?.message||String(err);render();throw err;}
        }
        }catch(error){stepError=error;throw error;}finally{
          if(claim){const ok=!stepError&&!abortController.signal.aborted;const result={ok,error:stepError?.message||'Lượt chạy đã dừng.'};nodeOutcomes.set(id,{...result,sequence:++completionSequence});claim.finish(result);if(nodeClaims.get(id)===claim)nodeClaims.delete(id);}
        }
      }
      const technicalFailures=order.map(nodeById).filter(node=>node?.type==='qualityCheck'&&node.data.status==='error');
      clearTimeout(autoSaveTimer);setRunStatus(technicalFailures.length?`${technicalFailures.length} tệp chưa đạt kiểm tra kỹ thuật; xem báo cáo trong node.`:targetId?'Node generation completed.':'Workflow completed.',technicalFailures.length?'warn':'ok');
      // Persistence can be slow when a workflow contains large local media.
      // Never keep generation controls locked while IndexedDB/storage finishes.
      void queueWorkflowSave().catch(saveError=>{if(!state.isRunning)setRunStatus(`Generation completed, but workflow could not be saved: ${saveError?.message||String(saveError)}`,'warn');});
    }catch(err){
      run.error=err?.message||String(err);
      if(err?.name==='AbortError'||abortController.signal.aborted){
        const active=state.nodes.find(n=>n.id===run.activeNodeId);
        if(active&&active.data.status==='running'){active.data.status='stopped';active.data.error='Generation stopped by user.';render();}
        clearTimeout(autoSaveTimer);void queueWorkflowSave().catch(()=>{});
        return;
      }
      const failed=nodeById(run.activeNodeId);
      if(failed?.data.status==='running'){failed.data.status='error';failed.data.error=err?.message||String(err);render();}
      const message=err?.message||String(err);
      setRunStatus(/failed to fetch/i.test(message)?`Muse connection failed. Reload MuseFlow ${appVersion}, then check the Muse session.`:`MuseFlow ${appVersion} · ${message}`,'error');
      clearTimeout(autoSaveTimer);void queueWorkflowSave().catch(saveError=>{if(!state.isRunning)setRunStatus(`${runStatus.textContent} · Auto-save failed: ${saveError?.message||String(saveError)}`,'error');});
    }
    finally{const pending=nodeById(targetId);if(pending?.data.status==='running'&&!nodeClaims.has(targetId)){pending.data.status=abortController.signal.aborted?'stopped':'error';pending.data.error=run.error||'Lượt chạy đã dừng.';}activeRuns.delete(run.id);syncRuns();if(activeRuns.size)setRunStatus(`${activeRuns.size} nhánh vẫn đang chạy…`,'warn');render();}
  }

  async function runAutomatic(selected=null){
    if(autoPlan)return;
    try{
      normalizeSavedGraph();const topological=topoOrder(selected);
      const work=id=>{const n=nodeById(id);return n&&(WorkflowTools.definitions[n.type]||['generateText','generateImage','generateVideo','imageResize'].includes(n.type));};
      let ids=topological.filter(work);
      if(selected){const wanted=new Set(selected);for(const id of selected)for(const upstream of requiredNodeOrder(id))if(work(upstream)&&!['generateText','generateImage','generateVideo'].includes(nodeById(upstream).type))wanted.add(upstream);ids=ids.filter(id=>wanted.has(id));}
      if(!ids.length){setRunStatus('Chưa có node để chạy.','warn');return;}
      const plan={controller:new AbortController(),epoch:completionSequence,ids:new Set(ids)};autoPlan=plan;syncRuns();
      for(const id of ids){const node=nodeById(id);if(!runForNode(id)){node.data.status='queued';node.data.progress='Đợi đầu vào hoặc tab AI';node.data.error='';}}
      render();const tasks=new Map();
      for(const id of ids){const dependencies=requiredNodeOrder(id).filter(dep=>dep!==id&&plan.ids.has(dep));const position=selected?.indexOf(id);if(position>0&&!dependencies.includes(selected[position-1]))dependencies.push(selected[position-1]);
        const task=(async()=>{
          try{
            await WorkflowRuntime.waitFor(Promise.all(dependencies.map(dep=>tasks.get(dep))),plan.controller.signal);
            if(plan.controller.signal.aborted)throw new DOMException('Đã dừng.','AbortError');
            const prior=nodeOutcomes.get(id);if(prior?.sequence>plan.epoch){if(!prior.ok)throw new Error(prior.error);return;}const existing=nodeClaims.get(id);if(existing){const result=await WorkflowRuntime.waitFor(existing.done,plan.controller.signal);if(!result.ok)throw new Error(result.error);return;}
            await execute(id,{sinceSequence:plan.epoch});const result=nodeOutcomes.get(id);if(!result||result.sequence<=plan.epoch||!result.ok)throw new Error(nodeById(id)?.data.error||result?.error||'Node chưa hoàn tất.');
          }catch(error){const node=nodeById(id);if(node&&!runForNode(id)){node.data.status=plan.controller.signal.aborted?'stopped':'error';node.data.error=error.message;node.data.progress='';render();}throw error;}
        })();tasks.set(id,task);
      }
      const results=await Promise.allSettled(tasks.values()),failed=results.filter(result=>result.status==='rejected').length;
      await queueWorkflowSave();autoPlan=null;syncRuns();render();
      const warnings=ids.filter(id=>nodeById(id)?.type==='qualityCheck'&&nodeById(id).data.status==='error').length;
      setRunStatus(plan.controller.signal.aborted?'Đã dừng Run All.':failed?`Run All: ${results.length-failed}/${results.length} node hoàn tất; ${failed} lỗi/đầu vào chưa đạt.`:warnings?`Run All xong; ${warnings} tệp chưa đạt kiểm tra.`:'Run All hoàn tất.',failed||warnings?'warn':'ok');
    }catch(error){autoPlan=null;syncRuns();setRunStatus(error.message,'error');}
  }
  function executeWorkflow(){return runAutomatic();}
  function executeGenerationNode(nodeId,options={}){const node=nodeById(nodeId);if(!node||!['generateImage','generateVideo','generateText'].includes(node.type))return;if(node.data.status==='running'){stopGeneration(nodeId);return;}return execute(nodeId,options);}
  function runSingleNode(nodeId){return executeGenerationNode(nodeId);}
  function openRunOrderModal(){if(state.isRunning)return;const generators=state.nodes.filter(node=>['generateImage','generateVideo','generateText'].includes(node.type));if(!generators.length)return execute();generationCreationOrder=generators.map(node=>node.id);pendingGenerationOrder=[...generationCreationOrder];pendingGenerationSelection=new Set(generationCreationOrder);renderRunOrderList();$('#runOrderModal').classList.remove('hidden');validateRunOrderSelection();requestAnimationFrame(()=>$('#closeRunOrderBtn').focus());}
  function renderRunOrderList(){const list=$('#runOrderList');if(!list)return;list.replaceChildren();
    for(const [index,id] of (pendingGenerationOrder||[]).entries()){const node=nodeById(id);if(!node)continue;const row=document.createElement('div');row.className='run-order-row';row.dataset.nodeId=id;row.draggable=true;row.tabIndex=0;row.setAttribute('aria-grabbed','false');
      const handle=document.createElement('span');handle.className='run-order-grip';handle.setAttribute('aria-hidden','true');handle.textContent='⠿';
      const check=document.createElement('input');check.className='run-order-check';check.type='checkbox';check.checked=pendingGenerationSelection.has(id);check.setAttribute('aria-label',`Chọn ${generationNodeTitle(node)} để chạy`);check.title=check.checked?'Sẽ chạy node này':'Bỏ qua node này';
      const rank=document.createElement('span');rank.className='run-order-rank';rank.textContent=String(index+1);
      const thumbWrap=document.createElement('span');thumbWrap.className=`run-order-thumb ${node.type==='generateVideo'?'video':''}`;const media=node.data?.asset?.url;if(media){const thumb=document.createElement(node.type==='generateVideo'?'video':'img');thumb.src=media;thumb.alt='';if(thumb instanceof HTMLVideoElement){thumb.muted=true;thumb.playsInline=true;thumb.preload='metadata';}thumbWrap.appendChild(thumb);}else{const glyph=document.createElement('span');glyph.textContent=node.type==='generateVideo'?'▶':'▧';thumbWrap.appendChild(glyph);}
      const info=document.createElement('span');info.className='run-order-info';const name=document.createElement('strong');name.textContent=generationNodeTitle(node);const meta=document.createElement('span');meta.className='run-order-meta';meta.textContent=`${node.type==='generateVideo'?'Video':'Ảnh'} · tạo thứ ${generationCreationNumber(id)}`;info.append(name,meta);
      const type=document.createElement('span');type.className=`run-order-type ${node.type==='generateVideo'?'video':''}`;type.textContent=node.type==='generateVideo'?'VIDEO':'ẢNH';
      row.append(handle,check,rank,thumbWrap,info,type);check.addEventListener('change',()=>{if(check.checked)pendingGenerationSelection.add(id);else pendingGenerationSelection.delete(id);check.title=check.checked?'Sẽ chạy node này':'Bỏ qua node này';row.classList.toggle('excluded',!check.checked);type.textContent=check.checked?(node.type==='generateVideo'?'VIDEO':'ẢNH'):'BỎ QUA';validateRunOrderSelection();});
      row.classList.toggle('excluded',!check.checked);if(!check.checked)type.textContent='BỎ QUA';
      row.addEventListener('dragstart',event=>{if(event.target===check){event.preventDefault();return;}draggedGenerationId=id;row.classList.add('dragging');row.setAttribute('aria-grabbed','true');event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',id);});row.addEventListener('dragover',event=>{event.preventDefault();event.dataTransfer.dropEffect='move';row.classList.add('drag-over');});row.addEventListener('dragleave',()=>row.classList.remove('drag-over'));row.addEventListener('drop',event=>{event.preventDefault();row.classList.remove('drag-over');moveGenerationOrder(draggedGenerationId,id);});row.addEventListener('dragend',()=>{draggedGenerationId=null;row.classList.remove('dragging');row.setAttribute('aria-grabbed','false');document.querySelectorAll('.run-order-row').forEach(item=>item.classList.remove('drag-over'));});row.addEventListener('keydown',event=>{if(!['ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();const current=pendingGenerationOrder.indexOf(id),next=Math.max(0,Math.min(pendingGenerationOrder.length-1,current+(event.key==='ArrowUp'?-1:1)));if(next===current)return;pendingGenerationOrder.splice(current,1);pendingGenerationOrder.splice(next,0,id);renderRunOrderList();$('#runOrderList').querySelector(`[data-node-id="${CSS.escape(id)}"]`)?.focus();validateRunOrderSelection();});list.appendChild(row);
    }
    validateRunOrderSelection();
  }
  function moveGenerationOrder(fromId,toId){if(!fromId||!toId||fromId===toId)return;const from=pendingGenerationOrder.indexOf(fromId),to=pendingGenerationOrder.indexOf(toId);if(from<0||to<0)return;pendingGenerationOrder.splice(from,1);pendingGenerationOrder.splice(to,0,fromId);renderRunOrderList();validateRunOrderSelection();}
  function missingGenerationPrerequisites(selectedOrder){const selected=new Set(selectedOrder),missing=new Set(),visited=new Set();const visit=id=>{if(visited.has(id))return;visited.add(id);for(const edge of state.edges.filter(item=>item.target===id)){const source=nodeById(edge.source);if(!source)continue;if(['generateImage','generateVideo','generateText'].includes(source.type)){if(selected.has(source.id))visit(source.id);else if(!(source.type==='generateText'?source.data?.text?.trim():source.data?.asset?.url))missing.add(source.id);}else visit(source.id);}const node=nodeById(id),previous=node?.type==='generateVideo'&&node.data?.continuity?timelinePredecessor(id):null;if(previous){if(selected.has(previous.id))visit(previous.id);else if(!previous.data?.endFrame?.url)missing.add(previous.id);}};selectedOrder.forEach(visit);return[...missing];}
  function validateRunOrderSelection(){const warning=$('#runOrderWarning'),confirm=$('#confirmRunOrderBtn'),ordered=(pendingGenerationOrder||[]).filter(id=>pendingGenerationSelection.has(id)),count=ordered.length,total=pendingGenerationOrder?.length||0;$('#runOrderSubtitle').textContent=`${count}/${total} node được chọn · kéo để sắp xếp thứ tự`;document.querySelectorAll('.run-order-row').forEach(row=>{const selected=pendingGenerationSelection.has(row.dataset.nodeId),rank=row.querySelector('.run-order-rank'),position=ordered.indexOf(row.dataset.nodeId);row.classList.toggle('excluded',!selected);if(rank)rank.textContent=selected?String(position+1):'–';});confirm.textContent=`▶ Chạy ${count} node`;confirm.disabled=!count;warning.classList.add('hidden');warning.textContent='';if(!count){warning.textContent='Chọn ít nhất một node để chạy.';warning.classList.remove('hidden');confirm.disabled=true;return;}const missing=missingGenerationPrerequisites(ordered);if(missing.length){warning.textContent=`Node đã chọn cần đầu ra từ: ${missing.map(id=>generationNodeTitle(nodeById(id))).join(', ')}. Hãy chọn thêm node nguồn hoặc tạo đầu ra trước.`;warning.classList.remove('hidden');confirm.disabled=true;return;}try{topoOrder(ordered);}catch(error){warning.textContent='Thứ tự này xung đột với kết nối phụ thuộc giữa các node. Hãy đưa node tạo nguồn lên trước.';warning.classList.remove('hidden');confirm.disabled=true;}}
  function closeRunOrderModal(){if($('#runOrderModal').classList.contains('hidden'))return;$('#runOrderModal').classList.add('hidden');pendingGenerationOrder=null;pendingGenerationSelection.clear();draggedGenerationId=null;}
  function onWorkflowRunButtonClick(event){if(event.detail>1)return;if(state.isRunning)stopAllRuns();else executeWorkflow();}

  function setRunStatus(text, cls=''){runStatus.className=cls;runStatus.textContent=text;runStatus.title=text;}

  function ratioValue(size){const [w,h]=String(size||'1:1').split(':').map(Number);return w>0&&h>0?w/h:1;}

  function clampDimension(value){return Math.max(1,Math.min(4096,Math.round(Number(value)||1)));}

  function loadImage(url){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Could not load the connected image for resizing.'));image.src=url;});}

  function drawResized(image,canvas,data={}){
    const width=clampDimension(data.width||1024),height=clampDimension(data.height||1024);canvas.width=width;canvas.height=height;
    const context=canvas.getContext('2d');if(!context)return;context.fillStyle='#101116';context.fillRect(0,0,width,height);
    const fit=data.fit||'cover';let scale=fit==='stretch'?null:fit==='contain'?Math.min(width/image.naturalWidth,height/image.naturalHeight):Math.max(width/image.naturalWidth,height/image.naturalHeight);
    const drawWidth=scale===null?width:image.naturalWidth*scale,drawHeight=scale===null?height:image.naturalHeight*scale;
    context.drawImage(image,(width-drawWidth)/2,(height-drawHeight)/2,drawWidth,drawHeight);
  }

  async function mediaDimensions(url,kind){
    return new Promise((resolve,reject)=>{
      const element=kind==='image'?new Image():document.createElement('video');
      const timer=setTimeout(()=>finish(null),20000);
      function finish(value){clearTimeout(timer);element.onload=element.onerror=element.onloadedmetadata=null;if(kind==='video'){element.removeAttribute('src');element.load();}if(value?.width&&value?.height)resolve(value);else reject(new Error('Không đọc được ảnh/video đầu ra của AI. Kiểm tra tab AI và quyền truy cập media.'));}
      element.onerror=()=>finish(null);
      if(kind==='image')element.onload=()=>finish({width:element.naturalWidth,height:element.naturalHeight});
      else{element.preload='metadata';element.onloadedmetadata=()=>finish({width:element.videoWidth,height:element.videoHeight,duration:element.duration});}
      element.src=url;
    });
  }

  function extractVideoEndFrame(url){return new Promise(resolve=>{const video=document.createElement('video');if(/^https?:/i.test(url))video.crossOrigin='anonymous';video.preload='auto';video.muted=true;video.playsInline=true;let finished=false;const done=value=>{if(finished)return;finished=true;video.removeAttribute('src');video.load();resolve(value);};const timer=setTimeout(()=>done(null),12000);video.onloadedmetadata=()=>{if(!Number.isFinite(video.duration)){clearTimeout(timer);done(null);return;}video.currentTime=Math.max(0,video.duration-Math.min(.04,video.duration/100));};video.onseeked=()=>{try{const width=video.videoWidth,height=video.videoHeight;if(!width||!height){clearTimeout(timer);done(null);return;}const frame=document.createElement('canvas');frame.width=width;frame.height=height;frame.getContext('2d').drawImage(video,0,0,width,height);const dataUrl=frame.toDataURL('image/png');clearTimeout(timer);done({id:uid('endframe'),kind:'image',url:dataUrl,name:'Video end frame',width,height});}catch{clearTimeout(timer);done(null);}};video.onerror=()=>{clearTimeout(timer);done(null);};video.src=url;video.load();});}

  async function persistImage(url) {
    if(!url)return '';
    if(url.startsWith('data:'))return url;
    try{
      const response=await fetch(url,{credentials:'include'});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const blob=await response.blob();
      if(blob.size>8*1024*1024)return url;
      return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});
    }catch{return url;}
  }

  let mediaDbPromise;
  function mediaDb(){if(!mediaDbPromise)mediaDbPromise=new Promise((resolve,reject)=>{const request=indexedDB.open('museflow-media',1);request.onupgradeneeded=()=>request.result.createObjectStore('assets');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error('Could not open local media storage.'));});return mediaDbPromise;}
  async function putMedia(key,blob){const db=await mediaDb();return new Promise((resolve,reject)=>{const tx=db.transaction('assets','readwrite');tx.objectStore('assets').put(blob,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('Could not save a media file locally.'));tx.onabort=()=>reject(tx.error||new Error('Media storage transaction was cancelled.'));});}
  async function getMedia(key){const db=await mediaDb();return new Promise((resolve,reject)=>{const request=db.transaction('assets','readonly').objectStore('assets').get(key);request.onsuccess=()=>resolve(request.result||null);request.onerror=()=>reject(request.error||new Error('Could not read a saved media file.'));});}
  const idbMediaPrefix='museflow-idb:';
  async function dehydrateMediaUrl(url,key){if(!url||url.startsWith(idbMediaPrefix)||!(/^(?:data:|blob:)/i).test(url))return url;const response=await fetch(url);const blob=await response.blob();if(!blob.size)throw new Error('A saved image or video is empty.');await putMedia(key,blob);return idbMediaPrefix+encodeURIComponent(key);}
  let autoSaveTimer=0,workflowSaveQueue=Promise.resolve();
  async function saveWorkflowSnapshot(){const snapshot=structuredClone({nodes:state.nodes,edges:state.edges,groups:state.groups,notes:state.notes,settings:state.settings});for(const node of snapshot.nodes){const data=node.data||{};if(data.localDataUrl)data.localDataUrl=await dehydrateMediaUrl(data.localDataUrl,`input:${node.id}`);for(const field of ['asset','endFrame','lockedAsset']){const media=data[field];if(media?.url)media.url=await dehydrateMediaUrl(media.url,`${field}:${field==='lockedAsset'?node.id:media.id||node.id}`);}}await chrome.storage.local.set({museflow:snapshot});}
  function queueWorkflowSave(){workflowSaveQueue=workflowSaveQueue.catch(()=>{}).then(saveWorkflowSnapshot);return workflowSaveQueue;}
  function scheduleAutoSave(){clearTimeout(autoSaveTimer);autoSaveTimer=setTimeout(()=>{queueWorkflowSave().catch(error=>{if(runStatus.className!=='error')setRunStatus(`Auto-save failed: ${error?.message||String(error)}`,'error');});},650);}
  async function hydrateMediaUrl(url,cache){if(!url?.startsWith(idbMediaPrefix))return url;const key=decodeURIComponent(url.slice(idbMediaPrefix.length));if(!cache.has(key)){const blob=await getMedia(key);cache.set(key,blob?URL.createObjectURL(blob):'');}return cache.get(key);}
  async function hydrateWorkflowMedia(){const cache=new Map();for(const node of state.nodes){const data=node.data||{};if(data.localDataUrl)data.localDataUrl=await hydrateMediaUrl(data.localDataUrl,cache);for(const field of ['asset','endFrame','lockedAsset'])if(data[field]?.url)data[field].url=await hydrateMediaUrl(data[field].url,cache);}}
  async function saveState(){clearTimeout(autoSaveTimer);try{await queueWorkflowSave();setRunStatus('Đã lưu.','ok');}catch(error){setRunStatus(`Could not save workflow: ${error?.message||String(error)}`,'error');}}
  function blobAsDataUrl(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(reader.error||new Error('Could not package workflow media.'));reader.readAsDataURL(blob);});}
  async function exportWorkflowFile(){
    const button=$('#workflowExportBtn');button.disabled=true;
    try{
      const workflow=structuredClone({nodes:state.nodes,edges:state.edges,groups:state.groups,notes:state.notes,settings:state.settings});let externalMedia=0;
      const packageUrl=async url=>{
        if(!url||url.startsWith('data:'))return url;
        try{
          let blob;
          if(url.startsWith(idbMediaPrefix))blob=await getMedia(decodeURIComponent(url.slice(idbMediaPrefix.length)));
          else if(/^(?:blob:|https?:)/i.test(url)){const response=await fetch(url,{credentials:'include'});if(!response.ok)throw new Error(`HTTP ${response.status}`);blob=await response.blob();}
          else return url;
          if(!blob?.size)throw new Error('Media is missing or empty');
          return await blobAsDataUrl(blob);
        }catch{externalMedia++;return url;}
      };
      for(const node of workflow.nodes){const data=node.data||{};if(data.localDataUrl)data.localDataUrl=await packageUrl(data.localDataUrl);for(const field of ['asset','endFrame','lockedAsset'])if(data[field]?.url)data[field].url=await packageUrl(data[field].url);}
      const file={format:'26flow-workflow',version:1,appVersion,exportedAt:new Date().toISOString(),workflow};
      const blob=new Blob([JSON.stringify(file)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`26MuseFlow-Workflow-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),5000);
      setRunStatus(externalMedia?`Workflow saved; ${externalMedia} media URL(s) could not be embedded and may require the original Muse session.`:'Workflow saved with media included.','ok');
    }catch(error){setRunStatus(`Could not save workflow file: ${error?.message||String(error)}`,'error');}
    finally{button.disabled=false;}
  }
  async function importWorkflowFile(file){
    if(!file)return;if(state.isRunning){setRunStatus('Stop the running workflow before importing another one.','warn');return;}
    let parsed,workflow;
    try{parsed=JSON.parse(await file.text());workflow=parsed?.format==='26flow-workflow'?parsed.workflow:parsed;if(!workflow||!Array.isArray(workflow.nodes)||!Array.isArray(workflow.edges))throw new Error('This file does not contain a valid MuseFlow workflow.');}
    catch(error){setRunStatus(`Could not import workflow: ${error?.message||String(error)}`,'error');return;}
    if(!window.confirm('Importing this workflow will replace the current canvas. Continue?'))return;
    createUndoSnapshot('Import workflow',{preserveRuntime:false});
    const previous={nodes:state.nodes,edges:state.edges,groups:state.groups,notes:state.notes,settings:state.settings};
    try{
      state.nodes=workflow.nodes;state.edges=workflow.edges;state.groups=Array.isArray(workflow.groups)?workflow.groups:[];state.notes=Array.isArray(workflow.notes)?workflow.notes:[];state.settings=workflow.settings&&typeof workflow.settings==='object'?workflow.settings:{};
      await hydrateWorkflowMedia();normalizeSavedGraph();state.selectedNodeIds=[];state.selectedNodeId=null;state.selectedEdgeIds=[];syncSettingsUI();render();await queueWorkflowSave();
      setRunStatus(`Workflow imported: ${file.name}`,'ok');
    }catch(error){state.nodes=previous.nodes;state.edges=previous.edges;state.groups=previous.groups||[];state.notes=previous.notes||[];state.settings=previous.settings;render();setRunStatus(`Could not import workflow: ${error?.message||String(error)}`,'error');}
  }
  async function loadState(){try{const got=await chrome.storage.local.get('museflow');if(got.museflow){state.nodes=Array.isArray(got.museflow.nodes)?got.museflow.nodes:[];state.edges=Array.isArray(got.museflow.edges)?got.museflow.edges:[];state.groups=Array.isArray(got.museflow.groups)?got.museflow.groups:[];state.notes=Array.isArray(got.museflow.notes)?got.museflow.notes:[];state.settings=got.museflow.settings||{};if(!state.nodes.length){const s=starter();state.nodes=s.nodes;state.edges=s.edges;}}else{const s=starter();state.nodes=s.nodes;state.edges=s.edges;}await hydrateWorkflowMedia();}catch(error){const s=starter();state.nodes=s.nodes;state.edges=s.edges;state.groups=[];state.notes=[];setRunStatus(`Could not load saved workflow: ${error.message}`,'error');}normalizeSavedGraph();syncSettingsUI();
    render();syncTimelineDock();try{clearTimeout(autoSaveTimer);await queueWorkflowSave();}catch(error){setRunStatus(`Workflow is open, but media migration failed: ${error?.message||String(error)}`,'warn');}}
  async function resetState(){if(state.isRunning)return;createUndoSnapshot('Reset workflow',{preserveRuntime:false});const s=starter();state.nodes=s.nodes;state.edges=s.edges;state.groups=[];state.notes=[];state.selectedNodeIds=[];state.selectedNodeId=null;render();await saveState();}
  function syncSettingsUI(){backendStatus.textContent=`v${appVersion}`;}

  async function detectMuse(){
    try{
      const tabs=await chrome.tabs.query({url:['https://muse.ai/*','https://*.muse.ai/*']});
      if(tabs.length){const active=tabs.find(t=>t.active)||tabs[0];await testMuseSession(active.id);}
      else{museStatus.textContent='● Open muse.ai and sign in';museStatus.className='warn';}
    }catch{museStatus.textContent='● Muse session check unavailable';museStatus.className='warn';}
  }

  const addNodeMenu=$('#addNodeMenu'),addNodeMenuBtn=$('#addNodeMenuBtn');
  function closeAddNodeMenu(){addNodeMenu.classList.add('hidden');addNodeMenuBtn.setAttribute('aria-expanded','false');}
  addNodeMenuBtn.onclick=()=>{if(!addNodeMenu.classList.contains('hidden')){closeAddNodeMenu();return;}const rect=addNodeMenuBtn.getBoundingClientRect();addNodeMenu.style.left=`${Math.max(8,Math.min(rect.left,innerWidth-240))}px`;addNodeMenu.classList.remove('hidden');const height=addNodeMenu.getBoundingClientRect().height;addNodeMenu.style.top=`${rect.bottom+height+16<=innerHeight?rect.bottom+6:Math.max(8,rect.top-height-6)}px`;addNodeMenuBtn.setAttribute('aria-expanded','true');};
  addNodeMenu.addEventListener('click',event=>{const button=event.target.closest('[data-add]');if(!button)return;closeAddNodeMenu();addNodeMenuBtn.focus();if(button.dataset.add==='text')addTextNote();else addNode(button.dataset.add);});
  $('#scriptImportBtn').onclick=()=>{$('#scriptModal').classList.remove('hidden');$('#scriptImportStatus').textContent='';$('#scriptInput').focus();};
  $('#checkAllAIBtn').onclick=()=>void refreshHealth(true);void refreshHealth();setInterval(()=>void refreshHealth(),15000);
  void checkForAppUpdate();
  setInterval(()=>void checkForAppUpdate(),6*60*60*1000);
  $('#cancelScriptImport').onclick=()=>$('#scriptModal').classList.add('hidden');
  $('#buildScriptNodes').onclick=buildSceneNodesFromScript;
  $('#scriptModal').onclick=event=>{if(event.target.id==='scriptModal')$('#scriptModal').classList.add('hidden');};
  $('#skipGroupNameBtn').onclick=()=>commitPendingGroup(state.pendingGroup?.defaultName);
  $('#cancelNodeRenameBtn').onclick=closeGroupNameModal;
  $('#confirmGroupNameBtn').onclick=confirmNameDialog;
  $('#groupNameInput').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();confirmNameDialog();}else if(event.key==='Escape'){event.preventDefault();if(state.nameDialog?.type==='group')commitPendingGroup(state.pendingGroup?.defaultName);else closeGroupNameModal();}});
  $('#groupNameModal').addEventListener('click',event=>{if(event.target!==event.currentTarget)return;if(state.nameDialog?.type==='group')commitPendingGroup(state.pendingGroup?.defaultName);else closeGroupNameModal();});
  $('#scriptInput').addEventListener('input',()=>{const count=parseSceneScript($('#scriptInput').value).length;$('#scriptImportStatus').className='';$('#scriptImportStatus').textContent=count?`${count} scene${count===1?'':'s'} detected.`:'';});
  $('#timelineToggleBtn').onclick=toggleTimeline;
  $('#timelineExportBtn').onclick=exportTimelineVideo;$('#timelineExportSingleBtn').onclick=exportTimelineSingles;
  $('#timelineExportStopBtn').onclick=stopTimelineExport;
  $('#timelineImportAllBtn').onclick=importAllVideosToTimeline;
  $('#closeTimelinePreview').onclick=closeTimelinePreview;
  $('#timelineAddVideoBtn').onclick=toggleTimelineOutputMenu;
  $('#timelinePlayBtn').onclick=()=>playTimeline(ensureDockTimeline());
  $('#closeRunOrderBtn').onclick=closeRunOrderModal;$('#cancelRunOrderBtn').onclick=closeRunOrderModal;
  $('#runOrderModal').onclick=event=>{if(event.target.id==='runOrderModal')closeRunOrderModal();};
  $('#resetRunOrderBtn').onclick=()=>{pendingGenerationOrder=[...generationCreationOrder];renderRunOrderList();validateRunOrderSelection();};
  $('#confirmRunOrderBtn').onclick=()=>{if(!pendingGenerationOrder||$('#confirmRunOrderBtn').disabled)return;const order=pendingGenerationOrder.filter(id=>pendingGenerationSelection.has(id));closeRunOrderModal();void runAutomatic(order);};
  // A DOM click handler receives the MouseEvent as its first argument. Keep
  // Keep toolbar workflow execution separate from the per-node generation action.
  $('#runBtn').onclick=onWorkflowRunButtonClick;$('#runOptionsBtn').onclick=openRunOrderModal; $('#saveBtn').onclick=saveState; $('#resetBtn').onclick=resetState;
  $('#workflowExportBtn').onclick=exportWorkflowFile;
  $('#workflowImportBtn').onclick=()=>$('#workflowFileInput').click();
  $('#workflowFileInput').onchange=event=>{const file=event.target.files?.[0];event.target.value='';if(file)void importWorkflowFile(file);};
  $('#settingsBtn').onclick=()=>{ $('#settingsModal').classList.remove('hidden');void refreshConnections(); };
  $('#testMuseBtn').onclick=()=>testMuseSession();
  $('#closeSettingsBtn').onclick=()=>$('#settingsModal').classList.add('hidden');
  $('#saveSettingsBtn').onclick=async()=>{$('#settingsModal').classList.add('hidden');await saveState();};
  $('#settingsModal').onclick=(e)=>{if(e.target.id==='settingsModal')$('#settingsModal').classList.add('hidden');};
  window.addEventListener('resize',drawEdges);
  window.addEventListener('pointermove',onWireMove);
  window.addEventListener('pointermove',moveSelectionMarquee);
  window.addEventListener('pointermove',moveGroupMarquee);window.addEventListener('pointermove',moveTextNote);
  window.addEventListener('pointerup',onWireUp);
  window.addEventListener('pointerup',endSelectionMarquee);
  window.addEventListener('pointerup',finishGroupMarquee);window.addEventListener('pointerup',finishTextNoteMove);
  window.addEventListener('pointercancel',endSelectionMarquee);
  window.addEventListener('pointercancel',cancelGroupMarquee);window.addEventListener('pointercancel',finishTextNoteMove);
  $('#viewport').addEventListener('wheel',event=>{event.preventDefault();const factor=Math.exp(-event.deltaY*.0015);zoomAt(event.clientX,event.clientY,factor);},{passive:false});
  $('#viewport').addEventListener('pointerdown',event=>{const panGesture=event.button===1||state.spaceDown||state.handMode;if(panGesture&&!event.target.closest('button,input,label,textarea,select,video,a,.canvas-tools,.canvas-note'))startPan(event);});
  $('#viewport').addEventListener('pointerdown',startSelectionMarquee);
  document.addEventListener('pointerdown',event=>{const stop=event.target.closest('[data-stop-generation]');if(!stop)return;if(event.pointerType==='mouse'&&event.detail>1)return;event.preventDefault();event.stopImmediatePropagation();stopGeneration(stop.dataset.stopGeneration);},true);
  window.addEventListener('pointermove',movePan);window.addEventListener('pointerup',endPan);window.addEventListener('pointercancel',endPan);
  $('#handTool').onclick=()=>{state.handMode=!state.handMode;applyCanvasTransform();$('#handTool').classList.toggle('active',state.handMode);};
  $('#groupTool').onclick=()=>setGroupDrawMode(!state.groupDrawMode);
  $('#zoomIn').onclick=()=>setZoom(Math.min(2.5,state.zoom*1.15));$('#zoomOut').onclick=()=>setZoom(Math.max(.25,state.zoom/1.15));$('#fitCanvas').onclick=fitCanvas;
  $('#viewport').addEventListener('contextmenu',openCanvasMenu);
  const trackUndoEdit=event=>{const target=event.target;if(!target.closest('.node,.canvas-note,.timeline-dock,#settingsModal'))return;const owner=target.closest('.node'),title=owner?.querySelector('.node-title')?.textContent||'text note';if(pendingNativeUndoTarget===target){if(lastUndoInput===target&&undoStack.at(-1)?.label===`Edit ${title}`)undoStack.pop();lastUndoInput=null;pendingNativeUndoTarget=null;return;}if(lastUndoInput!==target){createUndoSnapshot(`Edit ${title}`);lastUndoInput=target;}};
  document.addEventListener('input',event=>{trackUndoEdit(event);if(event.target.closest('.node,.canvas-note,.timeline-dock,#settingsModal'))scheduleAutoSave();},true);
  document.addEventListener('change',event=>{trackUndoEdit(event);if(event.target.closest('.node,.canvas-note,.timeline-dock,#settingsModal'))scheduleAutoSave();},true);
  document.addEventListener('focusout',event=>{if(event.target===lastUndoInput)lastUndoInput=null;},true);
  $('#canvasMenu').addEventListener('click',e=>{const item=e.target.closest('[data-context-action]');if(!item)return;if(item.dataset.contextAction==='connect-choice')runConnectionChoice(Number(item.dataset.choice));else runCanvasAction(item.dataset.contextAction);});
  edgesSvg.addEventListener('contextmenu',openEdgeMenu);
  edgesSvg.addEventListener('pointerdown',selectEdgePointer);
  canvas.addEventListener('contextmenu',openCanvasMenu);
  document.addEventListener('pointerdown',e=>{if(!e.target.closest('#canvasMenu')){closeCanvasMenu();state.pendingConnection=null;}if(!e.target.closest('#addNodeMenu,#addNodeMenuBtn'))closeAddNodeMenu();});
  const isTextEntry=target=>Boolean(target?.closest?.('textarea,input,select,[contenteditable="true"]'));
  const isTextEditor=target=>Boolean(target?.closest?.('textarea,input:not([type="checkbox"]):not([type="number"]):not([type="file"]):not([type="range"]):not([type="color"]),[contenteditable="true"]'));
  document.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!e.shiftKey){
      if(isTextEditor(e.target)){
        pendingNativeUndoTarget=e.target;setTimeout(()=>{if(pendingNativeUndoTarget===e.target)pendingNativeUndoTarget=null;},0);return;
      }
      e.preventDefault();undoLastChange();return;
    }
    if(e.code==='Space'&&!isTextEntry(e.target)){
      // Space is a temporary canvas hand key. Prevent native activation of a
      // focused toolbar button (Run/Stop) on both press and release.
      e.preventDefault();
      if(!e.repeat){state.spaceDown=true;applyCanvasTransform();if(document.activeElement?.matches?.('button'))document.activeElement.blur();}
      return;
    }
    if(e.key==='Escape'){if(!addNodeMenu.classList.contains('hidden')){e.preventDefault();closeAddNodeMenu();addNodeMenuBtn.focus();return;}if(!$('#runOrderModal').classList.contains('hidden')){e.preventDefault();closeRunOrderModal();return;}if(state.pendingGroup){e.preventDefault();commitPendingGroup(state.pendingGroup.defaultName);return;}closeCanvasMenu();endSelectionMarquee();cancelGroupMarquee();}
    if((e.key==='Delete'||e.key==='Backspace')&&!isTextEntry(e.target)){e.preventDefault();if(state.selectedEdgeIds.length){const ids=new Set(state.selectedEdgeIds);createUndoSnapshot(`Delete ${ids.size} connection${ids.size===1?'':'s'}`);state.edges=state.edges.filter(edge=>!ids.has(edge.id));state.selectedEdgeIds=[];render();saveState();setRunStatus('Selected connections deleted.','ok');}else removeSelectedNodes();}
    if(e.key.toLowerCase()==='h'&&!isTextEntry(e.target)){state.handMode=!state.handMode;$('#handTool').classList.toggle('active',state.handMode);applyCanvasTransform();}
    if(!e.repeat&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!isTextEntry(e.target)&&e.key.toLowerCase()==='g'){e.preventDefault();setGroupDrawMode(!state.groupDrawMode);}
    if(!e.repeat&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!isTextEntry(e.target)&&e.key.toLowerCase()==='t'){e.preventDefault();setGroupDrawMode(false);const rect=$('#viewport').getBoundingClientRect();addTextNote((rect.width/2-state.panX)/state.zoom-130,(rect.height/2-state.panY)/state.zoom-80);}
  },true);
  document.addEventListener('keyup',e=>{if(e.key.toLowerCase()==='z'&&pendingNativeUndoTarget===e.target)pendingNativeUndoTarget=null;if(e.code==='Space'&&!isTextEntry(e.target)){e.preventDefault();state.spaceDown=false;applyCanvasTransform();}},true);
  window.addEventListener('blur',()=>{state.spaceDown=false;endPan();endSelectionMarquee();cancelGroupMarquee();applyCanvasTransform();});

  // Keep the session indicator fresh when Muse is opened/reloaded after the canvas.
  chrome.tabs.onUpdated.addListener((tabId,changeInfo,tab)=>{
    if(changeInfo.status==='complete'&&/^https:\/\/(?:[^/]+\.)?muse\.ai\//i.test(tab.url||''))testMuseSession(tabId);
  });
  chrome.tabs.onCreated.addListener(tab=>{
    if(/^https:\/\/(?:[^/]+\.)?muse\.ai\//i.test(tab.url||''))setTimeout(()=>testMuseSession(tab.id),1200);
  });

  loadState(); detectMuse();applyCanvasTransform();
})();
