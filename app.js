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
  async function checkForAppUpdate(){try{const response=await fetch(`https://raw.githubusercontent.com/mktminhqpbga-glitch/app-mooz/main/manifest.json?check=${Date.now()}`,{cache:'no-store'});if(!response.ok)return;const latest=await response.json();if(!latest.version||compareVersions(latest.version,appVersion)<=0)return;const dismissed=(await chrome.storage.local.get('museflowDismissedUpdateVersion')).museflowDismissedUpdateVersion;if(dismissed===latest.version)return;$('#updateNoticeText').textContent=`Có phiên bản Workflow ${latest.version}`;$('#updateNotice').classList.remove('hidden');$('#dismissUpdateBtn').onclick=async()=>{await chrome.storage.local.set({museflowDismissedUpdateVersion:latest.version});$('#updateNotice').classList.add('hidden');};}catch{/* Update checks are best-effort and must not interrupt workflow use. */}}

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
    referenceBoard:{title:'Ảnh tham chiếu chung',outputs:WorkflowReferences.outputs},
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

  Object.assign(WorkflowTools.definitions,WorkflowStudio.definitions,WorkflowStory.definitions);
  WorkflowStudio.effects.add('videoAssembly');
  Object.assign(nodeDefs,WorkflowTools.definitions);
  const aiKeys={};
  let scriptAIController=null;
  const aiTabs=new Map();
  const activeRuns=new Map(),nodeClaims=new Map(),nodeOutcomes=new Map(),tabQueue=WorkflowRuntime.queue();let completionSequence=0,autoPlan=null;
  const runForNode=id=>nodeClaims.get(id)?.run||[...activeRuns.values()].find(run=>run.activeNodeId===id||run.targetId===id);
  function syncRuns(){const last=[...activeRuns.values()].at(-1);state.isRunning=activeRuns.size>0||!!autoPlan;state.activeGenerationId=last?.activeNodeId||null;state.generationRequestId=last?.requestId||null;state.generationAbortController=last?.controller||null;$('#runBtn').disabled=false;$('#runBtn').textContent=state.isRunning?`■ Dừng tất cả (${activeRuns.size||1})`:'▶ Run All';$('#runBtn').title=state.isRunning?'Dừng tất cả nhánh đang chạy và đang chờ':'Chạy workflow';}
  function progressNode(node,text){if(!node)return;node.data.progress=text;const root=document.querySelector(`.node[data-id="${CSS.escape(node.id)}"]`),status=root?.querySelector(".status"),detail=root?.querySelector(".node-status-detail");if(status){status.textContent=text;status.title=text;}if(detail)detail.textContent=text;}

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
  const museChatTransitions=new Map();
  const resolvedChatKey=(provider,tabId,url)=>{const key=chatKey(url);return provider==='muse'?(museChatTransitions.get(tabId)?.get(key)||key):key;};
  const chatKey=url=>{try{const value=new URL(url);return value.origin+value.pathname.replace(/\/$/,'');}catch{return '';}};
  async function refreshChatTabs(){
    await Promise.all(Object.entries(WorkflowAI.providers).filter(([,provider])=>provider.urls).map(async([id,provider])=>{try{aiChatTabs[id]=await chrome.tabs.query({url:provider.urls});if(!aiChatTargets[id]&&aiChatTabs[id].length===1){const tab=aiChatTabs[id][0];aiChatTargets[id]={tabId:tab.id,url:chatKey(tab.url)};}}catch{aiChatTabs[id]=[];}}));
    const host=$('#aiChatTargets');if(host){host.replaceChildren();for(const id of ['muse','gemini','chatgpt']){const label=document.createElement('label');label.textContent=WorkflowAI.providers[id].name;const select=chatSelector(id,aiChatTargets[id],target=>{if(target)aiChatTargets[id]=target;else delete aiChatTargets[id];void chrome.storage.local.set({workflowAIChatTargets:aiChatTargets});render();updateChatUsageLabels();});label.append(select);host.append(label);}}
  }
  let chatLabelsQueued=false;
  function scheduleChatUsageLabels(){if(chatLabelsQueued)return;chatLabelsQueued=true;queueMicrotask(()=>{chatLabelsQueued=false;updateChatUsageLabels();});}
  function updateChatUsageLabels(){
    const busy=new Set(state.nodes.filter(n=>runForNode(n.id)).map(n=>n.id));
    for(const select of document.querySelectorAll('select[data-chat-provider]')){const provider=select.dataset.chatProvider,tabs=aiChatTabs[provider]||[],usage=new Map(WorkflowRuntime.tabUsage(state.nodes,provider,tabs,aiChatTargets,busy).map(x=>[x.id,x])),windows=[...new Set(Object.values(aiChatTabs).flat().map(t=>t.windowId??0))].sort((a,b)=>a-b);
      for(const option of select.options){const tab=tabs.find(t=>String(t.id)===option.value);if(!tab)continue;const stats=usage.get(tab.id);option.textContent=`${stats.count} node chọn · Cửa sổ ${windows.indexOf(tab.windowId??0)+1} · Tab ${Number.isInteger(tab.index)?tab.index+1:tab.id} — ${tab.title||tab.url||'AI'}${stats.busy?' · '+stats.busy+' đang chạy/chờ':''}`;option.title=option.textContent;}
      if(!select.dataset.pending){const owner=nodeById(select.dataset.chatOwner),target=owner?.data.chatTarget||aiChatTargets[provider],tab=tabs.find(t=>t.id===target?.tabId);if(target&&tab&&resolvedChatKey(provider,tab.id,target.url)===chatKey(tab.url))select.value=String(tab.id);else if(target&&tab)select.value='';}select.title=select.selectedOptions[0]?.textContent||'Chọn cửa sổ AI';
    }
  }
  function chatSelector(provider,current,onChange,ownerId=null){
    const select=document.createElement('select');select.setAttribute('aria-label','Cuộc trò chuyện AI');select.dataset.chatProvider=provider;if(ownerId){select.dataset.chatOwner=ownerId;select.disabled=!!runForNode(ownerId);}
    const empty=document.createElement('option');empty.value='';empty.textContent='Chọn tab cuộc trò chuyện…';select.append(empty);
    for(const tab of aiChatTabs[provider]||[]){const option=document.createElement('option');option.value=String(tab.id);option.textContent=tab.title||tab.url||`Tab ${tab.id}`;select.append(option);}
    if(current&&!select.querySelector(`option[value="${current.tabId}"]`)){const missing=document.createElement('option');missing.value=String(current.tabId);missing.textContent='Tab đã chọn không còn mở — chọn lại';select.append(missing);}
    const cached=(aiChatTabs[provider]||[]).find(tab=>tab.id===current?.tabId);
    const stale=current&&cached&&resolvedChatKey(provider,cached.id,current.url)!==chatKey(cached.url);
    if(stale)empty.textContent='Chat đã đổi — chọn lại hoặc bấm Làm mới';
    select.value=current&&!stale?String(current.tabId):'';
    select.onchange=async()=>{
      const chosen=select.value;if(ownerId&&runForNode(ownerId)){setRunStatus('Dừng node trước khi đổi cửa sổ AI.','warn');updateChatUsageLabels();return;}if(!chosen){onChange(null);updateChatUsageLabels();return;}select.dataset.pending='true';
      pendingChatSelections++;try{const tabs=await chrome.tabs.query({url:WorkflowAI.providers[provider].urls});if(select.value!==chosen||!select.isConnected)return;const tab=tabs.find(tab=>String(tab.id)===chosen);if(!tab)throw new Error('Tab đã đóng. Bấm Làm mới danh sách chat.');onChange({tabId:tab.id,url:chatKey(tab.url)});}
      catch(error){setRunStatus(error.message,'error');}finally{pendingChatSelections--;delete select.dataset.pending;updateChatUsageLabels();}
    };
    scheduleChatUsageLabels();return select;
  }
  function chooseChat(provider,tabs,target){
    if(target){const tab=tabs.find(tab=>tab.id===target.tabId);if(!tab)throw new Error('Tab cuộc trò chuyện đã chọn đã đóng. Chọn lại trong node hoặc Kết nối AI.');const actual=chatKey(tab.url),expected=resolvedChatKey(provider,tab.id,target.url);if(expected&&actual!==expected)throw new Error('Tab đã chuyển sang cuộc trò chuyện khác. Bấm “Làm mới danh sách chat” trong node để dùng chat hiện tại, hoặc chọn tab khác.');return tab;}
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
    else{setRunStatus(message.text,'warn');renderHealth();const run=[...activeRuns.values()].find(item=>item.requestId===message.requestId);const node=nodeById(run?.activeNodeId);if(node?.data.status==='running'){progressNode(node,message.text);}}
    return false;
  });
  async function runMuseSupport(mode){
    const status=$('#museSupportStatus'),buttons=[$('#diagnoseMuseBtn'),$('#bindMuseSendBtn')];
    if(mode==='bind'&&state.isRunning){status.textContent='Bấm Dừng workflow trước, rồi chọn lại nút Gửi. Bản nháp trong Muse được giữ để bạn chọn nút.';return;}
    buttons.forEach(button=>button.disabled=true);status.textContent=mode==='bind'?'Đang mở Muse. Hãy bấm đúng mũi tên Gửi theo hướng dẫn trên tab Muse.':'Đang đọc thông tin bộ nối và video trên tab Muse…';
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
    const provider=select.value;if(WorkflowAI.providers[provider]?.urls){const target=n.data.chatTarget||aiChatTargets[provider];wrap.appendChild(chatSelector(provider,target,value=>{n.data.chatTarget=value;if(n.data.error?.includes('cuộc trò chuyện')){n.data.error='';n.data.status='idle';}scheduleAutoSave();},n.id));const refresh=document.createElement('button');refresh.type='button';refresh.textContent='Làm mới danh sách chat';refresh.onclick=async()=>{
      if(runForNode(n.id)){setRunStatus('Dừng lượt đang chạy của node này trước khi đổi cuộc trò chuyện.','warn');return;}
      const selected=n.data.chatTarget||aiChatTargets[provider];await refreshChatTabs();
      const tab=(aiChatTabs[provider]||[]).find(tab=>tab.id===selected?.tabId);
      if(tab){n.data.chatTarget={tabId:tab.id,url:chatKey(tab.url)};if(n.data.error?.includes('cuộc trò chuyện')){n.data.error='';n.data.status='idle';}scheduleAutoSave();setRunStatus('Đã chọn cuộc trò chuyện hiện tại của tab: '+(tab.title||tab.url),'ok');}
      render();
    };wrap.append(refresh);if(kind==='text'){const hint=document.createElement('small');hint.textContent='Tự gửi sau khi tải tệp xong và tự lấy văn bản về node.';const mode=document.createElement('select');mode.setAttribute('aria-label','Chế độ gửi');mode.append(new Option('Tự gửi khi sẵn sàng','auto'),new Option('Chờ 2 phút trước khi gửi','delay'));mode.value=n.data.sendMode||'auto';mode.onchange=()=>{n.data.sendMode=mode.value;scheduleAutoSave();};wrap.append(mode);wrap.append(hint);}}
    if(WorkflowAI.models[provider]){const model=document.createElement('input');model.placeholder=WorkflowAI.models[provider][kind]||'Model';model.value=n.data.apiModel||'';model.setAttribute('aria-label','Model API');model.onchange=()=>{n.data.apiModel=model.value.trim();scheduleAutoSave();};wrap.appendChild(model);}
    if(kind==='video'){const hint=document.createElement('small');hint.textContent=provider==='fal'?'Motion Control: nối đúng 1 ảnh nhân vật + 1 video chuyển động. Thời lượng theo video nguồn.':provider==='google'?'Veo: clip 4/6/8 giây, cần API key có quyền model.':'5/10/15/30/40 giây là thời lượng yêu cầu; kết quả phụ thuộc Muse.ai.';wrap.appendChild(hint);}
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
  function clearCanvasPrompts(){
    if(state.isRunning)throw Error('Dừng các lượt chạy trước khi xóa prompt.');
    const prompts=state.nodes.filter(n=>['prompt','negativePrompt','storyPrompt','textAppend'].includes(n.type)&&String(n.data.text||'').length);
    if(!prompts.length){setRunStatus('Canvas không có nội dung prompt để xóa.','ok');return;}
    createUndoSnapshot('Xóa nội dung tất cả prompt trên canvas');for(const node of prompts){node.data.text='';storyDirtyAfter(node.id,true);}render();scheduleAutoSave();setRunStatus('Đã xóa nội dung '+prompts.length+' prompt trên canvas; giữ node, kết nối và Kho prompt. Ctrl+Z để hoàn tác.','ok');
  }
  const generationPacer=WorkflowRuntime.pacer(5000);
  async function generateWithProvider(n,request,signal){
    if(pendingChatSelections)throw new Error('Đang cập nhật cuộc trò chuyện đã chọn. Đợi một chút rồi chạy lại.');
    const references=[],canonical=new Map();
    for(const ref of n.id?resolveReferences(n.id):[]){const url=await blobAsDataUrlFromUrl(ref.url);if(signal?.aborted)throw new DOMException('Đã dừng.','AbortError');if(canonical.has(url)){const old=canonical.get(url);old.roles=[...new Set([...old.roles,...ref.roles])];old.aliases=[...new Set([...(old.aliases||[]),ref.componentId,...(ref.aliases||[])])];if(ref.instructions&&!old.instructions.includes(ref.instructions))old.instructions+='\n'+ref.instructions;}else{const copy={...ref,url,roles:[...ref.roles]};canonical.set(url,copy);references.push(copy);}}
    if(references.length>8)throw Error('Tác vụ có '+references.length+' ảnh tham chiếu; tối đa 8 ảnh. Tắt ảnh chung hoặc bỏ bớt ảnh riêng.');
    if(references.length)request={...request,referenceImages:references.map(ref=>ref.url)};
    const referenceNote=WorkflowTools.referenceNote(references,request.prompt);if(referenceNote)request={...request,prompt:request.prompt+'\n'+referenceNote};
    const provider=n.data.provider||(n.type==='generateText'?'gemini':'muse');request={...request,chatTarget:n.data.chatTarget||aiChatTargets[provider]};
    WorkflowAI.validate(provider,request);
    providerJobs.set(request.requestId,{provider,phase:'queued'});renderHealth();
    let release,finishPacing,paceKey='provider:'+provider;const pace=async()=>{finishPacing=await generationPacer.wait(paceKey,signal,ms=>progressNode(n,'Đợi '+Math.ceil(ms/1000)+' giây trước khi gửi lượt AI tiếp theo…'));};try{
    if(['muse','chatgpt','gemini'].includes(provider)){
      const tabs=await chrome.tabs.query({url:WorkflowAI.providers[provider].urls});const tab=chooseChat(provider,tabs,request.chatTarget);
      request={...request,chatTarget:{tabId:tab.id,url:chatKey(tab.url)}};paceKey='tab:'+tab.id;
      release=await tabQueue.acquire('tab:'+tab.id,signal,()=>progressNode(n,'Đang đợi lượt dùng tab AI này. Bạn có thể chạy nhánh ở tab khác.'));
    }
    providerJobs.get(request.requestId).phase='busy';renderHealth();
    if(release){const tabs=await chrome.tabs.query({url:WorkflowAI.providers[provider].urls});chooseChat(provider,tabs,request.chatTarget);if(signal?.aborted)throw new DOMException('Đã dừng.','AbortError');}
    if(provider==='muse'){if(request.referenceVideos?.length)throw new Error('Muse bridge chưa hỗ trợ video tham chiếu. Chọn fal.ai cho Motion Control.');const referenceImages=await Promise.all((request.referenceImages||[]).map(url=>blobAsDataUrlFromUrl(url)));await pace();const reply=await museTabMessage({...request,referenceImages,type:'MUSEFLOW_GENERATE'},preferredMuseTabId,signal);if(!reply?.ok){setProviderHealth(provider,failureHealth(reply?.error),reply?.error||'Muse không trả kết quả.',true);return reply;}setProviderHealth(provider,'ready','Đã nhận kết quả');if(reply.chatTarget){n.data.chatTarget=reply.chatTarget;if(aiChatTargets.muse?.tabId===reply.chatTarget.tabId)aiChatTargets.muse=reply.chatTarget;}return reply;}
    if(provider==='chatgpt'||provider==='gemini'){
      const safe={...request};safe.referenceImages=await Promise.all((request.referenceImages||[]).map(url=>blobAsDataUrlFromUrl(url)));safe.referenceVideos=await Promise.all((request.referenceVideos||[]).map(url=>blobAsDataUrlFromUrl(url)));
      try{await pace();const reply=await otherTabMessage(provider,{...safe,type:'WORKFLOW_AI_GENERATE'},signal);if(!reply?.ok){setProviderHealth(provider,failureHealth(reply?.error),reply?.error||'Chưa nhận kết quả.',true);return reply;}setProviderHealth(provider,'ready','Đã nhận kết quả');if(reply.chatTarget){n.data.chatTarget=reply.chatTarget;if(aiChatTargets[provider]?.tabId===reply.chatTarget.tabId)aiChatTargets[provider]=reply.chatTarget;}return reply;}finally{aiTabs.delete(request.requestId);}
    }
    await pace();const result=await WorkflowAI.api(provider,request,aiKeys[provider],signal);setProviderHealth(provider,'ready','API vừa trả kết quả');return result;
    }catch(error){if(error.name!=='AbortError')setProviderHealth(provider,failureHealth(error.message),error.message,true);throw error;}finally{finishPacing?.();release?.();providerJobs.delete(request.requestId);renderHealth();if(signal?.aborted)void refreshProviderHealth(provider,true);}
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
    if(source.type==='referenceBoard'){const image=WorkflowReferences.select(source.data,edge.sourcePort)[0];return image?{kind:'image',url:image.url,id:image.id,name:image.name}:null;}
    if(edge.sourcePort==='endFrame')return frameMatchesVideo(source)?source.data.endFrame:null;
    if(['imageInput','videoInput'].includes(source.type)&&source.data.localDataUrl)return {kind:source.type==='videoInput'?'video':'image',url:source.data.localDataUrl};
    if(source.type==='review')return toolAsset(source,edge.sourcePort==='video'?'video':'reference');
    if(source.type==='audioInput'&&source.data.localDataUrl)return {kind:'audio',url:source.data.localDataUrl};
    if(source.type==='characterLock')return source.data.lockedAsset||null;
    return source.data.asset||(source.data.localDataUrl?{kind:source.type==='videoInput'?'video':'image',url:source.data.localDataUrl}:null);
  }
  function toolText(node,port='prompt'){return toolIncoming(node,port).map(source=>resolveText(source.id)).filter(Boolean).join('\n\n');}
  let studioTemplates=[];
  const studioTemplatesReady=chrome.storage.local.get('workflowTemplates').then(saved=>{studioTemplates=Array.isArray(saved.workflowTemplates)?saved.workflowTemplates.filter(t=>t?.version===1&&typeof t.name==='string'&&Array.isArray(t.nodes)&&Array.isArray(t.edges)).slice(0,20):[];}).catch(()=>{});
  function studioSelect(body,node,key,label,options,fallback){const wrap=document.createElement('label');wrap.textContent=label;const select=document.createElement('select');select.setAttribute('aria-label',label);for(const [value,title] of options)select.append(new Option(title,value));select.value=node.data[key]||fallback;select.onchange=()=>{node.data[key]=select.value;if(WorkflowStudio.effects.has(node.type))storyTouch(node.id);scheduleAutoSave();};wrap.append(select);body.append(wrap);return select;}
  function studioButton(body,label,action,{disabled=false,cls='tool-action'}={}){const b=document.createElement('button');b.type='button';b.className=cls;b.textContent=label;b.disabled=disabled;b.onclick=()=>void Promise.resolve().then(action).catch(error=>setRunStatus(error.message,'error'));body.append(b);return b;}
  function finalOutputEdges(node){const edges=getIncoming(node.id,'video'),ids=WorkflowStudio.outputOrder(edges.map(e=>e.source),state.nodes,state.nodes.find(n=>n.type==='timeline')?.data.clipOrder||[],node.data.outputOrder||[]);return ids.map(id=>edges.find(e=>e.source===id));}
  function connectOutputVideos(node){
    if(state.isRunning)throw Error('Dừng chạy trước khi nối video.');
    const timeline=state.nodes.find(n=>n.type==='timeline')?.data.clipOrder||[],candidates=state.nodes.filter(n=>n.id!==node.id&&(nodeDefs[n.type]?.outputs||[]).some(p=>p.type==='video'&&p.id==='video')&&n.type!=='finalOutput'),ids=new Set(candidates.map(n=>n.id));
    const chosen=timeline.length?candidates.filter(n=>timeline.includes(n.id)):candidates.filter(n=>!state.edges.some(e=>e.source===n.id&&ids.has(e.target)&&nodeDefs[nodeById(e.target)?.type]?.inputs?.some(p=>p.id===e.targetPort&&p.type==='video')));
    if(!chosen.length)throw Error('Chưa có video để nối. Thêm video vào dòng thời gian hoặc tạo node video trước.');createUndoSnapshot('Nối video vào Output');for(const source of chosen){if(wouldCreateCycle(source.id,node.id,null))continue;if(!state.edges.some(e=>e.source===source.id&&e.target===node.id&&e.targetPort==='video'))state.edges.push({id:uid('edge'),source:source.id,sourcePort:'video',target:node.id,targetPort:'video'});}storyTouch(node.id);render();scheduleAutoSave();
  }
  function renderStudioNode(node,body){
    const field=(key,label,options)=>toolField(body,node,key,label,options),help=text=>{const p=document.createElement('p');p.textContent=text;body.append(p);};
    if(node.type==='audioInput'){
      if(node.data.localDataUrl)node.data.asset={...node.data.asset,kind:'audio',url:node.data.localDataUrl};
      const label=document.createElement('label');label.textContent='Chọn / thả tệp âm thanh';const input=document.createElement('input');input.type='file';input.accept='audio/*';input.onchange=()=>{if(input.files.length)void importMediaFiles([...input.files],{node}).catch(error=>setRunStatus(error.message,'error'));};label.append(input);body.append(label);body.classList.add('media-input-zone');body.tabIndex=0;help('Nhạc, lời đọc MP3/WAV/M4A… Nối cổng Âm thanh sang node hậu kỳ.');
    }
    if(node.type==='finalOutput'){
      body.classList.add('final-output-body');
      const label=document.createElement('label');label.textContent='Chọn MP3 / âm thanh bổ sung';const input=document.createElement('input');input.type='file';input.accept='audio/*';input.disabled=state.isRunning;input.onchange=()=>{if(input.files.length)void importMediaFiles([...input.files],{node,port:nodeDefs.finalOutput.inputs.find(p=>p.id==='audio')}).catch(error=>setRunStatus(error.message,'error'));};label.append(input);body.append(label);
      const audioSource=toolIncoming(node,'audio')[0];help(audioSource?'Âm thanh: '+(audioSource.data.fileName||audioSource.data.customName||audioSource.data.componentId):'Chưa nối âm thanh bổ sung. Có thể nối node MP3 đang có hoặc chọn tệp ở trên.');
      studioButton(body,'Nối video từ timeline / canvas',()=>connectOutputVideos(node),{disabled:state.isRunning});
      const ordered=finalOutputEdges(node);if(node.data.storyDirty)help('Nguồn hoặc thứ tự đã đổi. Bấm Xuất video cuối để cập nhật trước khi tải.');help('Thứ tự tự nhận theo timeline; nếu chưa có, theo số cảnh/tên video; cuối cùng theo thứ tự tạo node. Kiểm tra danh sách dưới trước khi xuất.');
      const list=document.createElement('ol');list.className='output-order';ordered.forEach((edge,index)=>{const row=document.createElement('li'),title=document.createElement('span');title.textContent=nodeById(edge.source)?.data.customName||nodeById(edge.source)?.data.sceneLabel||nodeById(edge.source)?.data.fileName||generationNodeTitle(nodeById(edge.source));row.append(title);for(const [label,delta] of [['↑',-1],['↓',1]]){const button=document.createElement('button');button.type='button';button.textContent=label;button.setAttribute('aria-label',(delta<0?'Đưa lên: ':'Đưa xuống: ')+title.textContent);button.disabled=state.isRunning||index+delta<0||index+delta>=ordered.length;button.onclick=()=>{createUndoSnapshot('Đổi thứ tự Output');const ids=ordered.map(e=>e.source);[ids[index],ids[index+delta]]=[ids[index+delta],ids[index]];node.data.outputOrder=ids;storyTouch(node.id);render();scheduleAutoSave();};row.append(button);}list.append(row);});body.append(list);
      studioButton(body,'Dùng lại thứ tự tự động',()=>{delete node.data.outputOrder;storyTouch(node.id);render();scheduleAutoSave();},{disabled:state.isRunning});
      studioSelect(body,node,'audioMode','Âm thanh MP3',[['replace','Thay âm thanh gốc'],['mix','Trộn với âm thanh gốc']],'replace');field('musicVolume','Âm lượng MP3 (0–2)',{type:'number',value:1,min:0,max:2});field('loop','Lặp MP3 đến hết video',{type:'checkbox',value:false});field('autoDownload','Tự tải MP4 sau khi hoàn tất',{type:'checkbox',value:true});help('Nối Âm thanh đầu vào vào cổng Nhạc / lời đọc; hoặc thả MP3 lên node này. Giữ tổng thời lượng video: nhạc dài được cắt, nhạc ngắn được thêm khoảng lặng hoặc lặp nếu bật. Run All sẽ tự chạy Output sau các video nguồn.');
    }
    if(node.type==='voiceover'){
      field('script','Lời đọc (hoặc nối cổng Văn bản)',{type:'textarea'});studioSelect(body,node,'voice','Giọng đọc',[['coral','Coral'],['alloy','Alloy'],['nova','Nova'],['onyx','Onyx'],['shimmer','Shimmer'],['echo','Echo']],'coral');field('speed','Tốc độ giọng đọc',{type:'number',value:1,min:.25,max:4});help('Tạo tệp MP3 bằng OpenAI API; cần API key có quyền và số dư. Tối đa 4096 ký tự/lượt. Giọng nói do AI tạo.');
    }
    if(node.type==='audioMix'){field('originalVolume','Âm lượng gốc (0–2)',{type:'number',value:1,min:0,max:2});field('musicVolume','Âm lượng nhạc/lời đọc (0–2)',{type:'number',value:.5,min:0,max:2});field('muteOriginal','Tắt tiếng video gốc',{type:'checkbox',value:false});field('loop','Lặp nhạc đến hết video',{type:'checkbox',value:true});help('Nối video và một node Âm thanh/Lồng tiếng. Thả tệp nhạc lên cổng Âm thanh để nối nhanh.');}
    if(node.type==='subtitles'){
      field('srt','Phụ đề SRT (hoặc nối cổng Văn bản)',{type:'textarea'});field('fontSize','Cỡ chữ phụ đề',{type:'number',value:24,min:10,max:80});const upload=document.createElement('input');upload.type='file';upload.accept='.srt,text/plain';upload.setAttribute('aria-label','Nhập tệp SRT');upload.onchange=async()=>{try{if(!upload.files[0])return;if(upload.files[0].size>1024*1024)throw Error('SRT tối đa 1 MB.');const value=await upload.files[0].text();WorkflowStudio.parseSrt(value);node.data.srt=value;render();scheduleAutoSave();}catch(error){setRunStatus(error.message,'error');}};body.append(upload);
      field('autoTranscribe','Tự nhận diện bằng OpenAI nếu chưa có SRT',{type:'checkbox',value:false});help('SRT nhập tay không cần API. Bật nhận diện để dùng Whisper API khi chạy; có thể tính phí. Phụ đề được gắn trực tiếp vào video.');
      if(node.data.srt)studioButton(body,'Tải phụ đề SRT',()=>{const url=URL.createObjectURL(new Blob([node.data.srt],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='Phu-de.srt';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);});
    }
    if(node.type==='speed'){field('speed','Hệ số tốc độ (0.25–4)',{type:'number',value:1,min:.25,max:4});help('Ví dụ 0.5× chậm một nửa, 2× nhanh gấp đôi. Âm thanh được đổi nhịp và giữ cao độ.');}
    if(node.type==='transition'){studioSelect(body,node,'transition','Kiểu chuyển cảnh',[['fade','Hòa hình'],['dissolve','Tan hình'],['wipeleft','Quét sang trái'],['slideright','Trượt sang phải']],'fade');field('duration','Thời gian chồng cảnh (giây)',{type:'number',value:.4,min:.1,max:5});help('Nối hai cảnh theo thứ tự trước → sau. Tổng thời lượng giảm bằng phần chồng cảnh; âm thanh cũng hòa chuyển.');}
    if(node.type==='voiceSync'){field('sceneLines','Mỗi dòng một cảnh (tùy chọn)',{type:'textarea'});studioSelect(body,node,'fit','Cách khớp cảnh',[['pad','Cắt hoặc giữ khung cuối'],['stretch','Đổi tốc độ video cho khớp']],'pad');help('Nối các cảnh và lời đọc theo thứ tự. Một bản đọc chung: chia thời lượng theo số từ mỗi dòng, hoặc chia đều. Mỗi cảnh một bản đọc: dùng đúng thời lượng tệp. Âm thanh gốc được thay bằng lời đọc.');}
    if(node.type==='workflowTemplate'){
      field('templateName','Tên mẫu',{value:'Mẫu của tôi'});field('selectedOnly','Chỉ lưu các node đang chọn',{type:'checkbox',value:false});field('includeMedia','Kèm ảnh/video/âm thanh đầu vào (tối đa 20 MB)',{type:'checkbox',value:false});
      studioButton(body,'Lưu thành mẫu',()=>saveStudioTemplate(node),{disabled:state.isRunning});const select=document.createElement('select');select.setAttribute('aria-label','Mẫu đã lưu');select.append(new Option('Chọn mẫu…',''));studioTemplates.forEach(t=>select.append(new Option(t.name,t.id)));select.value=node.data.selectedTemplate||'';select.onchange=()=>{node.data.selectedTemplate=select.value;};body.append(select);
      studioButton(body,'Thêm mẫu vào canvas',()=>insertStudioTemplate(node),{disabled:state.isRunning});studioButton(body,'Xóa mẫu đã chọn',async()=>{studioTemplates=studioTemplates.filter(t=>t.id!==node.data.selectedTemplate);await chrome.storage.local.set({workflowTemplates:studioTemplates});render();},{disabled:state.isRunning});help('Mẫu giữ bố cục, kết nối và thiết lập; bỏ kết quả AI cũ, lựa chọn chat và thông tin xác thực. Chỉ sao chép các kết nối bên trong nhóm đã lưu.');
    }
    if(WorkflowStudio.effects.has(node.type)){
      const busy=!!runForNode(node.id),queued=autoPlan?.ids.has(node.id)&&node.data.status==='queued';studioButton(body,busy?'■ Dừng':node.type==='finalOutput'?'▶ Xuất video cuối':'▶ Thực hiện',()=>busy?stopGeneration(node.id):execute(node.id),{disabled:queued});
    }
    const asset=node.data.asset;if(asset?.url){const media=document.createElement(asset.kind==='audio'?'audio':'video');media.controls=true;media.preload='metadata';media.src=asset.url;body.append(media);studioButton(body,'Tải kết quả',()=>{const a=document.createElement('a');a.href=asset.url;a.download=node.type==='audioInput'?(node.data.fileName||asset.name||'Am-thanh'):WorkflowTools.safeName(node.data.customName||node.data.componentId||node.type)+(asset.kind==='audio'?'.mp3':'.mp4');a.click();},{disabled:node.type==='finalOutput'&&!!node.data.storyDirty});}
  }
  async function studioRemote(node,call){
    const id=uid('speech');providerJobs.set(id,{provider:'openai',phase:'busy'});renderHealth();progressNode(node,'Đang gọi OpenAI Audio API…');
    try{const value=await call();setProviderHealth('openai','ready','Audio API vừa trả kết quả');return value;}catch(error){if(error.name!=='AbortError')setProviderHealth('openai',failureHealth(error.message),error.message,true);throw error;}finally{providerJobs.delete(id);renderHealth();}
  }
  async function executeStudio(node,signal){
    const all=port=>(node.type==='finalOutput'&&port==='video'?finalOutputEdges(node):getIncoming(node.id,port)).map(edge=>{const source=nodeById(edge.source);if(!source)throw Error('Mất node nguồn.');if(source.type==='audioInput')return source.data.asset||{kind:'audio',url:source.data.localDataUrl};return edge.sourcePort==='endFrame'?source.data.endFrame:source.data.asset||(source.data.localDataUrl?{kind:source.type==='videoInput'?'video':'image',url:source.data.localDataUrl}:null);});
    let blob,details={};
    if(node.type==='voiceover')blob=await studioRemote(node,()=>WorkflowStudio.speak(toolText(node,'text')||node.data.script||'',{key:aiKeys.openai,voice:node.data.voice||'coral',speed:node.data.speed||1,signal}));
    else{
      const videos=node.type==='transition'?[...all('first'),...all('second')]:all('video'),audios=all('audio');if(node.type==='videoAssembly'&&node.data.expectedClips&&videos.length!==node.data.expectedClips)throw Error('Thiếu cảnh/đoạn/phần: cần '+node.data.expectedClips+' đầu vào. Chưa ghép để tránh xuất thiếu nội dung.');let captions=node.data.srt||toolText(node,'text');
      if(node.type==='subtitles'&&!captions&&node.data.autoTranscribe){captions=await studioRemote(node,()=>WorkflowStudio.transcribe(videos[0]||{},{key:aiKeys.openai,signal}));node.data.srt=captions;}
      if(node.type==='subtitles'){WorkflowStudio.parseSrt(captions);node.data.srt=captions;node.data.text=captions;}
      if(node.type==='finalOutput'){
        const joined=await WorkflowStudio.process('videoAssembly',{videos},signal,text=>progressNode(node,text));details=joined;
        if(audios.length){if(audios.length!==1)throw Error('Output nhận một bản nhạc/lời đọc.');const temp=URL.createObjectURL(joined.blob);try{details=await WorkflowStudio.process('audioMix',{videos:[{kind:'video',url:temp}],audios,settings:{...node.data,muteOriginal:node.data.audioMode!=='mix',musicVolume:node.data.musicVolume??1,loop:node.data.loop??false}},signal,text=>progressNode(node,text));}finally{URL.revokeObjectURL(temp);}}details.report='Đã xuất '+videos.length+' cảnh theo danh sách thứ tự'+(audios.length?' và chèn âm thanh đã tải lên.':'. Không có âm thanh bổ sung.')+'\n'+details.report;blob=details.blob;
      }else details=await WorkflowStudio.process(node.type,{videos,audios,settings:node.data,captions,lines:String(node.data.sceneLines||toolText(node,'text')||'').split('\n').map(s=>s.trim()).filter(Boolean)},signal,text=>progressNode(node,text));blob=details.blob;
    }
    if(signal.aborted)throw new DOMException('Đã dừng.','AbortError');const url=await blobAsDataUrl(blob);if(signal.aborted)throw new DOMException('Đã dừng.','AbortError');node.data.asset={id:uid('asset'),kind:node.type==='voiceover'?'audio':'video',url,name:WorkflowTools.safeName(node.data.customName||(node.type==='finalOutput'?'Video-hoan-chinh':node.data.componentId))+(node.type==='voiceover'?'.mp3':'.mp4'),duration:details.duration,width:details.width,height:details.height,sourceNodeId:node.id};node.data.report=details.report||'Đã tạo tệp giọng đọc AI.';node.data.storyDirty=false;storyDirtyAfter(node.id,true);
    for(const edge of state.edges.filter(e=>e.source===node.id)){const target=nodeById(edge.target);if(target?.type==='preview')target.data.asset=node.data.asset;}
    if(node.type==='finalOutput'&&node.data.autoDownload!==false){if(chrome.downloads?.download)await chrome.downloads.download({url:node.data.asset.url,filename:node.data.asset.name,saveAs:false});else{const link=document.createElement('a');link.href=node.data.asset.url;link.download=node.data.asset.name;link.click();}}
  }
  async function saveStudioTemplate(node){
    if(state.isRunning)throw Error('Dừng chạy trước khi lưu mẫu.');const name=String(node.data.templateName||'').trim();if(!name)throw Error('Nhập tên mẫu.');
    const selected=new Set(state.selectedNodeIds),nodes=structuredClone(state.nodes.filter(n=>!['workflowTemplate','timeline'].includes(n.type)&&(!node.data.selectedOnly||selected.has(n.id))));if(!nodes.length)throw Error('Chọn các node cần lưu trước.');
    for(const n of nodes){n.data.status='idle';delete n.data.progress;delete n.data.error;delete n.data.chatTarget;delete n.data.selectedTemplate;delete n.data.createdIds;delete n.data.lastSceneText;delete n.data.report;delete n.data.approvedText;
      for(const key of Object.keys(n.data))if(/key|token|password/i.test(key))delete n.data[key];
      if(n.type==='generateText')delete n.data.text;delete n.data.asset;delete n.data.endFrame;
      if(!node.data.includeMedia){delete n.data.localDataUrl;delete n.data.lockedAsset;delete n.data.lockedDescription;}else{if(n.data.localDataUrl)n.data.localDataUrl=await blobAsDataUrlFromUrl(n.data.localDataUrl);if(n.data.lockedAsset?.url)n.data.lockedAsset.url=await blobAsDataUrlFromUrl(n.data.lockedAsset.url);}
    }
    const ids=new Set(nodes.map(n=>n.id)),template={version:1,id:studioTemplates.find(t=>t.name===name)?.id||uid('template'),name,nodes,edges:structuredClone(state.edges.filter(e=>ids.has(e.source)&&ids.has(e.target)))};
    const tl=state.nodes.find(n=>n.type==='timeline');if(tl)template.timeline={clipOrder:(tl.data.clipOrder||[]).filter(id=>ids.has(id)),durations:Object.fromEntries(Object.entries(tl.data.durations||{}).filter(([id])=>ids.has(id)))};
    if(new Blob([JSON.stringify(template)]).size>20*1024*1024)throw Error('Mẫu vượt 20 MB. Bỏ chọn kèm tệp.');const next=[template,...studioTemplates.filter(t=>t.id!==template.id)].slice(0,20);await chrome.storage.local.set({workflowTemplates:next});studioTemplates=next;node.data.selectedTemplate=template.id;node.data.report=`Đã lưu ${nodes.length} node và ${template.edges.length} kết nối.`;render();scheduleAutoSave();
  }
  function insertStudioTemplate(node){
    if(state.isRunning)throw Error('Dừng chạy trước khi thêm mẫu.');const template=studioTemplates.find(t=>t.id===node.data.selectedTemplate);if(!template)throw Error('Chọn mẫu đã lưu.');
    const mapping=new Map(template.nodes.map(n=>[n.id,uid(n.type)])),nodes=structuredClone(template.nodes),left=Math.min(...nodes.map(n=>Number(n.x)||0)),top=Math.min(...nodes.map(n=>Number(n.y)||0));createUndoSnapshot('Thêm mẫu workflow');
    for(const n of nodes){const old=n.id;n.id=mapping.get(old);n.x=(Number(n.x)||0)-left+node.x+350;n.y=(Number(n.y)||0)-top+node.y;delete n.data.componentId;for(const field of ['storyMasterId','storyActId','storyPartId','storySegmentId','storyReferenceOwner','assemblyId','filmId'])if(n.data[field])n.data[field]=mapping.get(n.data[field]);if(n.data.outputOrder)n.data.outputOrder=n.data.outputOrder.map(id=>mapping.get(id)).filter(Boolean);if(n.data.actIds)n.data.actIds=n.data.actIds.map(id=>mapping.get(id)).filter(Boolean);if(n.type==='timeline')n.data.clipOrder=(n.data.clipOrder||[]).map(id=>mapping.get(id)).filter(Boolean);if(n.type==='timeline')n.data.durations=Object.fromEntries(Object.entries(n.data.durations||{}).filter(([id])=>mapping.has(id)).map(([id,value])=>[mapping.get(id),value]));}
    state.nodes.push(...nodes);if(template.timeline?.clipOrder?.length){const timeline=ensureDockTimeline();timeline.data.clipOrder.push(...template.timeline.clipOrder.map(id=>mapping.get(id)).filter(Boolean));for(const [id,duration] of Object.entries(template.timeline.durations||{}))if(mapping.has(id))timeline.data.durations[mapping.get(id)]=duration;}state.edges.push(...template.edges.map(e=>({...e,id:uid('edge'),source:mapping.get(e.source),target:mapping.get(e.target)})));normalizeSavedGraph();render();scheduleAutoSave();setRunStatus(`Đã thêm mẫu ${template.name}: ${nodes.length} node.`,'ok');
  }

  const storyPlanning=new Set();
  const storySource=node=>String(node.data.script||toolText(node,'text')||'').trim();
  function storyDirtyAfter(id,includeGenerators=false){const seen=new Set([id]),queue=[id];while(queue.length){for(const edge of state.edges.filter(e=>e.source===queue[0])){if(seen.has(edge.target))continue;seen.add(edge.target);queue.push(edge.target);const node=nodeById(edge.target);if(node&&(node.type==='videoAssembly'||includeGenerators&&(['generateImage','generateVideo'].includes(node.type)||WorkflowStudio.effects.has(node.type))))node.data.storyDirty=true;}queue.shift();}}
  function storyTouch(id){const node=nodeById(id);if(node&&(node.data.storyMasterId||WorkflowStudio.effects.has(node.type)))node.data.storyDirty=true;storyDirtyAfter(id,true);}
  function storyFocus(node){if(!node)return;state.zoom=1;state.panX=60-node.x;state.panY=60-node.y;applyCanvasTransform();scheduleDrawEdges();}
  function storyDownload(node){if(!node?.data.asset?.url)throw Error('Chưa có video; bấm chạy trước.');if(node.data.storyDirty)throw Error('Cảnh nguồn đã đổi; chạy lại bước ghép trước khi tải.');const a=document.createElement('a');a.href=node.data.asset.url;a.download=WorkflowTools.safeName(node.data.customName||node.data.componentId)+'.mp4';a.click();}
  function storyMasterFor(node){
    const assigned=nodeById(node?.data.storyMasterId);if(assigned?.type==='masterScript')return assigned;
    const pending=[node],seen=new Set(),masters=new Map();
    while(pending.length){const current=pending.shift();if(!current||seen.has(current.id))continue;seen.add(current.id);if(current.type==='masterScript'){masters.set(current.id,current);continue;}if(!['actScript','partScript','segmentScript','storyPrompt'].includes(current.type))continue;for(const e of getIncoming(current.id,current.type==='storyPrompt'?'context':'text'))pending.push(sourceFor(e));}
    return masters.size===1?[...masters.values()][0]:null;
  }
  let storyBatch=null;
  const storyFresh=n=>!!n?.data.asset?.url&&!n.data.storyDirty;
  const storyApproved=n=>storyFresh(n)&&!!n.data.asset.id&&n.data.storyApprovedAssetId===n.data.asset.id;
  function storyScope(id){const n=nodeById(id);if(!n)return [];if(n.type==='masterScript')return state.nodes.filter(item=>item.data.storyMasterId===n.id);const key={actScript:'storyActId',partScript:'storyPartId',segmentScript:'storySegmentId'}[n.type];return key?state.nodes.filter(item=>item.data[key]===n.id):[n];}
  function storyNeedsApproval(video){const master=nodeById(video.data.storyMasterId);if(!master?.data.reviewImages)return '';const images=getIncoming(video.id,'reference').map(sourceFor).filter(n=>n?.type==='generateImage');if(!images.length)return 'Chưa nối ảnh cảnh vào video.';return images.every(storyApproved)?'':'Tạo và duyệt ảnh cảnh trước khi tạo video.';}
  async function storyPreflight(id,imagesOnly=false){
    const target=nodeById(id);if(!target)return [{id,message:'Node đã bị xóa.'}];
    const issues=[],add=(n,message)=>issues.push({id:n.id,message}),tabs=new Map();
    let order;try{order=requiredNodeOrder(id);}catch(error){return [{id,message:error.message}];}
    for(const key of order){const n=nodeById(key);if(n?.type==='imageInput'&&!n.data.storyReferenceOwner&&!n.data.localDataUrl&&!n.data.asset?.url)add(n,'Chưa chọn tệp ảnh tham chiếu.');if(!n||!['generateImage','generateVideo','generateText'].includes(n.type)||imagesOnly&&n.type!=='generateImage')continue;
      if(n.id!==id&&storyFresh(n))continue;
      try{
        if(n.type==='generateImage')for(const tag of n.data.storyReferenceTags||[]){const source=storyReferenceNode(nodeById(n.data.storyMasterId),tag);if(!source?.data.localDataUrl)add(n,'Chưa có ảnh @'+tag+'. Nhập tại Ảnh tham chiếu của Kịch bản tổng.');}
        if(!resolvePrompt(n.id).trim())add(n,'Thiếu prompt. Nối hoặc nhập yêu cầu của cảnh.');
        const provider=n.data.provider||(n.type==='generateText'?'gemini':'muse'),definition=WorkflowAI.providers[provider],kind=n.type==='generateImage'?'image':n.type==='generateVideo'?'video':'text';
        if(!definition?.types.includes(kind)){add(n,'AI đã chọn không hỗ trợ '+kind+'.');continue;}
        if(definition.urls){if(!tabs.has(provider))tabs.set(provider,await chrome.tabs.query({url:definition.urls}));if(!tabs.get(provider).length)throw Error('Chưa mở tab '+definition.name+'.');chooseChat(provider,tabs.get(provider),n.data.chatTarget||aiChatTargets[provider]);}
        else if(!aiKeys[provider])add(n,'Chưa nhập API key cho '+definition.name+'.');
        for(const e of getIncoming(n.id,'reference')){const source=sourceFor(e);if(!source)add(n,'Ảnh tham chiếu đã bị xóa.');else if(source.type==='imageInput'&&!source.data.localDataUrl&&!source.data.asset?.url)add(source,'Chưa chọn tệp ảnh tham chiếu.');else if(source.type==='characterLock'&&!source.data.lockedAsset?.url)add(source,'Chưa khóa ảnh nhân vật chuẩn.');}
        if(n.type==='generateVideo'){
          if(!getIncoming(n.id,'reference').length)add(n,'Thiếu ảnh khung đầu của cảnh.');
          const approval=storyNeedsApproval(n);if(approval)add(n,approval);
          WorkflowAI.validate(provider,{mediaType:'video',duration:n.data.duration,referenceImages:getIncoming(n.id,'reference').map(()=> 'pending'),referenceVideos:resolveVideos(n.id)});
        }
        if(provider==='openai'&&kind==='image'&&getIncoming(n.id,'reference').length)add(n,'OpenAI API tạo ảnh chưa hỗ trợ ảnh tham chiếu; chọn Gemini hoặc tab AI.');
      }catch(error){add(n,error.message);}
    }
    return issues.filter((issue,i,list)=>list.findIndex(other=>other.id===issue.id&&other.message===issue.message)===i);
  }
  function storyApprove(ids){
    const images=ids.map(nodeById).filter(n=>n?.type==='generateImage');if(!images.length)throw Error('Chưa có ảnh để duyệt.');
    if(images.some(n=>!storyFresh(n)||runForNode(n.id)||autoPlan?.ids.has(n.id)))throw Error('Ảnh chưa hoàn tất hoặc đã thay đổi. Tạo lại trước khi duyệt.');
    createUndoSnapshot('Duyệt ảnh cảnh');for(const n of images)n.data.storyApprovedAssetId=n.data.asset.id;render();scheduleAutoSave();
  }
  async function storyRunImages(scopeId,forceId){
    if(storyBatch)throw Error('Đang tạo ảnh cho một phạm vi khác.');
    const images=forceId?[nodeById(forceId)]:storyScope(scopeId).filter(n=>n.type==='generateImage'&&!storyFresh(n));
    if(!images.length)return;
    let issues=[];for(const n of images){if(!n||n.type!=='generateImage')throw Error('Node ảnh đã bị xóa.');issues.push(...await storyPreflight(n.id,true));}
    if(issues.length)return {issues};
    const batch={scopeId,current:null,stopped:false};storyBatch=batch;
    try{for(const n of images){if(batch.stopped)break;if(nodeById(n.id)!==n)throw Error('Dự án đã thay đổi; dừng tạo ảnh.');batch.current=n.id;await execute(n.id);if(!storyFresh(n)||n.data.status!=='success')break;}}
    finally{storyBatch=null;render();}
    return {issues:[]};
  }
  function storyDashboardData(scopeId){
    const roots=state.nodes.filter(n=>n.type==='masterScript'),groups=state.nodes.filter(n=>['masterScript','actScript','partScript','segmentScript'].includes(n.type));
    const scope=nodeById(scopeId)||roots[0],nodes=scope?storyScope(scope.id):[],scenes=nodes.filter(n=>n.type==='generateImage').map(image=>({image,promptId:getIncoming(image.id,'prompt')[0]?.source,video:nodes.find(n=>n.type==='generateVideo'&&getIncoming(n.id,'reference').some(e=>e.source===image.id)),fresh:storyFresh(image),approved:storyApproved(image),busy:!!runForNode(image.id)}));
    return {scope,groups,scenes,downloadReady:storyFresh(nodeById(scope?.data.assemblyId)),review:!!(scope?.type==='masterScript'?scope:storyMasterFor(scope))?.data.reviewImages,busy:!!storyBatch||nodes.some(n=>!!runForNode(n.id)),batch:!!storyBatch};
  }

  const storyReferenceValue=(record,key)=>record&&Object.hasOwn(record,key)?record[key]:undefined;
  function storyReferenceMaster(id){const master=nodeById(id);if(master?.type!=='masterScript')throw Error('Không còn Kịch bản tổng.');return master;}
  function storyReferenceTags(master){return [...new Set([...WorkflowStory.referenceTags(storySource(master)+'\n'+(master.data.plan||'')),...state.nodes.filter(n=>n.type==='generateImage'&&n.data.storyMasterId===master.id).flatMap(n=>n.data.storyReferenceTags||[])])];}
  function storyReferenceNode(master,tag,create=false){
    if(!master)return null;const source=nodeById(storyReferenceValue(master.data.storyReferenceNodes,tag));if(source?.type==='imageInput')return source;if(!create)return null;
    const input=makeNode('imageInput',master.x-330,master.y+Object.keys(master.data.storyReferenceNodes||{}).length*280);input.data={...input.data,libraryTag:tag,storyReferenceLabel:storyReferenceValue(master.data.storyReferenceLabels,tag)||'',storyReferenceOwner:master.id,customName:'@'+tag+' · Tham chiếu phim'};state.nodes.push(input);Object.defineProperty(master.data.storyReferenceNodes||={},tag,{value:input.id,writable:true,enumerable:true,configurable:true});state.edges.push({id:uid('edge'),source:input.id,sourcePort:'image',target:master.id,targetPort:'reference'});return input;
  }
  function storyReferenceSlots(id){const master=storyReferenceMaster(id);return storyReferenceTags(master).map(tag=>{const source=storyReferenceNode(master,tag);return {tag,label:storyReferenceValue(master.data.storyReferenceLabels,tag)||'',url:source?.data.localDataUrl||'',name:source?.data.fileName||'',sourceId:source?.id};});}
  function bindStorySceneReferences(image,tags){
    const master=nodeById(image.data.storyMasterId);if(!master)return;const previous=state.edges.filter(e=>e.target===image.id&&e.storyReferenceBinding===master.id);const sources=tags.map(tag=>storyReferenceNode(master,tag,true));
    const changed=JSON.stringify(previous.map(e=>e.source))!==JSON.stringify(sources.map(n=>n.id))||JSON.stringify(image.data.storyReferenceTags||[])!==JSON.stringify(tags);
    state.edges=state.edges.filter(e=>!previous.includes(e));for(const source of sources){const old=previous.find(e=>e.source===source.id);state.edges.push(old||{id:uid('edge'),source:source.id,sourcePort:'image',target:image.id,targetPort:'reference',storyReferenceBinding:master.id});}
    image.data.storyReferenceTags=tags;if(changed)storyTouch(image.id);
  }
  function syncEditedStoryReferences(prompt){
    const targets=state.edges.filter(e=>e.source===prompt.id).map(e=>nodeById(e.target)).filter(n=>['generateImage','generateVideo'].includes(n?.type)&&n.data.storyMasterId);
    const images=new Set();for(const target of targets){if(target.type==='generateImage')images.add(target);else for(const edge of getIncoming(target.id,'reference')){const source=sourceFor(edge);if(source?.type==='generateImage')images.add(source);}}
    for(const image of images){if(!Array.isArray(image.data.storyReferenceTags))continue;const videos=state.edges.filter(e=>e.source===image.id&&e.targetPort==='reference').map(e=>nodeById(e.target)).filter(n=>n?.type==='generateVideo');const prompts=[...getIncoming(image.id,'prompt'),...videos.flatMap(n=>getIncoming(n.id,'prompt'))].map(sourceFor).filter(Boolean);const tags=[...new Set(prompts.flatMap(p=>WorkflowStory.sceneReferenceTags(p.data.text)))];bindStorySceneReferences(image,tags);}
    scheduleDrawEdges();
  }
  function dirtyStoryReference(source){for(const edge of state.edges.filter(e=>e.source===source.id)){const target=nodeById(edge.target);if(target&&target.type!=='masterScript')storyTouch(target.id);}}
  async function setStoryReference(id,tag,file){
    const master=storyReferenceMaster(id);if(state.isRunning)throw Error('Dừng tác vụ trước khi thay ảnh tham chiếu.');if(!storyReferenceTags(master).includes(tag))throw Error('Mã @'+tag+' không còn trong kịch bản.');if(!['image/png','image/jpeg','image/webp'].includes(file.type)||!file.size||file.size>8*1024*1024)throw Error('Chọn ảnh PNG/JPG/WebP, tối đa 8 MB.');
    const bitmap=await createImageBitmap(file);bitmap.close();const url=await blobAsDataUrl(file);if(nodeById(id)!==master||state.isRunning)throw Error('Kịch bản đã thay đổi hoặc đang chạy.');createUndoSnapshot('Ảnh tham chiếu @'+tag);const source=storyReferenceNode(master,tag,true);source.data.localDataUrl=url;source.data.fileName=file.name;source.data.asset={id:uid('asset'),kind:'image',url,name:file.name,sourceNodeId:source.id};for(const image of state.nodes.filter(n=>n.type==='generateImage'&&n.data.storyMasterId===master.id&&n.data.storyReferenceTags?.includes(tag)))bindStorySceneReferences(image,image.data.storyReferenceTags);dirtyStoryReference(source);render();scheduleAutoSave();
  }

  function renderStoryNode(node,body){
    body.classList.add('story-node-body');body.tabIndex=0;body.setAttribute('aria-label','Nội dung kịch bản, cuộn để xem thêm');
    const help=value=>{const p=document.createElement('p');p.textContent=value;body.append(p);},button=(name,action,disabled=false)=>studioButton(body,name,action,{disabled});
    if(['masterScript','actScript','partScript','segmentScript'].includes(node.type))button('Bảng điều khiển kịch bản',()=>WorkflowStoryDashboard.open(node.id));
    if(node.type==='masterScript'){
      if(node.data.reviewImages===undefined)node.data.reviewImages=!state.nodes.some(n=>n.data.storyMasterId===node.id);
      toolField(body,node,'reviewImages','Duyệt ảnh trước khi tạo video',{type:'checkbox'}).disabled=state.isRunning;
      const field=toolField(body,node,'script','Kịch bản tổng',{type:'textarea'});field.disabled=state.isRunning;field.placeholder='HỒI 1: Tên hồi\nCẢNH 1 (0:00–0:06): Tên cảnh\nPrompt video: …';
      const referencesButton=button('Ảnh tham chiếu của kịch bản · '+storyReferenceTags(node).length,()=>WorkflowStoryReferences.open(node.id));WorkflowStoryReferences.attach(field,node.id);const scriptInput=field.oninput;field.oninput=()=>{scriptInput();referencesButton.textContent='Ảnh tham chiếu của kịch bản · '+storyReferenceTags(node).length;};
      if(state.isRunning)help('Đang có tác vụ chạy. Dừng hoặc đợi hoàn tất để nhập và tạo cấu trúc kịch bản.');
      help('1. Nhập kịch bản hoặc điền mẫu. 2. Với văn xuôi, dùng AI chia hồi/cảnh. 3. Tạo node rồi chạy từng đoạn, phần hoặc hồi. Không cần tự thêm các node cấp dưới.');
      button('Tạo node cho các hồi',()=>buildMasterStory(node),state.isRunning);
      button('Điền mẫu hồi/cảnh',()=>{if(node.data.script?.trim())throw Error('Ô đang có kịch bản. Sao chép ra trước nếu muốn thay bằng mẫu.');node.data.script=WorkflowStory.template;render();scheduleAutoSave();},state.isRunning);
      node.data.provider ||= 'gemini';body.append(providerControls({...node,type:'generateText'}));
      button(storyPlanning.has(node.id)?'■ Dừng chia kịch bản':'AI chia hồi/cảnh',async()=>{if(storyPlanning.has(node.id)){stopGeneration(node.id);return;}if(state.isRunning)throw Error('Đợi lượt chạy hiện tại hoàn tất trước.');storyPlanning.add(node.id);try{await execute(node.id);}finally{storyPlanning.delete(node.id);render();}},state.isRunning&&!storyPlanning.has(node.id));
      if(node.data.plan!==undefined){const planField=toolField(body,node,'plan','Bản chia hồi/cảnh — có thể sửa trước khi tạo node',{type:'textarea'});planField.disabled=state.isRunning;WorkflowStoryReferences.attach(planField,node.id);button('Bỏ bản chia AI',()=>{delete node.data.plan;delete node.data.planSource;render();scheduleAutoSave();},state.isRunning);}
      studioSelect(body,node,'storyImageProvider','AI tạo ảnh',Object.entries(WorkflowAI.providers).filter(([,p])=>p.types.includes('image')).map(([id,p])=>[id,p.name]),'gemini');studioSelect(body,node,'storyVideoProvider','AI tạo video',[['muse','Muse · tab'],['google','Google Veo · API']],'muse');studioSelect(body,node,'storySize','Tỷ lệ mặc định',[['16:9','Ngang 16:9'],['9:16','Dọc 9:16'],['1:1','Vuông 1:1']],'16:9');
      button('Tạo bản dựng mới',()=>{if(state.isRunning)throw Error('Dừng chạy trước.');const copy=makeNode('masterScript',node.x,node.y+600);copy.data={...structuredClone(node.data),filmId:undefined,actIds:[],storyBuildSource:undefined,asset:undefined,status:'idle',componentId:undefined};const registered=new Set(Object.values(node.data.storyReferenceNodes||{})),refs=getIncoming(node.id,'reference').filter(ref=>!registered.has(ref.source)).map(ref=>({...ref,id:uid('edge'),target:copy.id})),copies=[];copy.data.storyReferenceNodes={};for(const [tag,id] of Object.entries(node.data.storyReferenceNodes||{})){const source=nodeById(id);if(!source)continue;const input=makeNode('imageInput',copy.x-330,copy.y+copies.length*280);input.data={...structuredClone(source.data),storyReferenceOwner:copy.id,componentId:undefined};if(input.data.asset)input.data.asset={...input.data.asset,id:uid('asset'),sourceNodeId:input.id};copies.push(input);Object.defineProperty(copy.data.storyReferenceNodes,tag,{value:input.id,writable:true,enumerable:true,configurable:true});refs.push({id:uid('edge'),source:input.id,sourcePort:'image',target:copy.id,targetPort:'reference'});}state.nodes.push(copy,...copies);state.edges.push(...refs);try{buildMasterStory(copy);}catch(error){const failed=new Set([copy.id,...copies.map(n=>n.id)]);state.nodes=state.nodes.filter(n=>!failed.has(n.id));state.edges=state.edges.filter(e=>!failed.has(e.target)&&!failed.has(e.source));render();throw error;}},state.isRunning);
      for(const id of node.data.actIds||[]){const act=nodeById(id),assembly=nodeById(act?.data.assemblyId);if(!act)continue;help(act.data.customName);button('Xem node '+act.data.customName,()=>storyFocus(act));button('▶ Chạy '+act.data.customName,()=>execute(assembly.id),!assembly||!!runForNode(assembly.id));button('⇩ Tải '+act.data.customName,()=>storyDownload(assembly),!assembly?.data.asset?.url||!!assembly?.data.storyDirty);}
      help('Dùng @1, @2… trong từng cảnh rồi mở Ảnh tham chiếu của kịch bản để nhập ảnh. Mỗi cảnh chỉ nối đúng mã được nhắc; ảnh nối thủ công vào cổng tham chiếu vẫn dùng chung. Hồi/Chương → Phần → Đoạn → Cảnh → Ảnh → Video. Chạy và tải từng cấp; dùng lại kết quả đã có. Nếu thiếu Prompt ảnh, dùng mô tả cảnh làm yêu cầu tạo khung đầu. Kịch bản văn xuôi cần AI chia rồi bạn kiểm tra trước khi tạo node.');
    }
    if(['actScript','partScript','segmentScript'].includes(node.type)){
      const master=storyMasterFor(node),assembly=nodeById(node.data.assemblyId);
      button('Về kịch bản tổng',()=>storyFocus(master),!master);
      if(!assembly){
        help(master?'Chưa tạo cấu trúc cảnh, ảnh, video và ghép cho node này. Nối dây kịch bản chưa đủ để chạy.':'Node này chưa thuộc kịch bản tổng. Nối Kịch bản tổng → Hồi/Chương → Phần → Đoạn, hoặc tạo toàn bộ từ Kịch bản tổng.');
        const created=master&&state.nodes.find(n=>n.type===node.type&&n.data.storyMasterId===master.id&&nodeById(n.data.assemblyId));
        if(created)button('Xem node đã tạo',()=>storyFocus(created));
        else if(master)button('Tạo cấu trúc từ kịch bản tổng',()=>buildMasterStory(master),state.isRunning);
        else button('Thêm kịch bản tổng',()=>addNode('masterScript'),state.isRunning);
        help('Nhập nội dung ở Kịch bản tổng, bấm Tạo node cho các hồi. Hệ thống tự tạo các cấp và nút chạy. Node cấp dưới được tạo thủ công, còn trống và nối đúng cấp sẽ được dùng lại.');
        return;
      }
      const childType=node.type==='actScript'?'partScript':node.type==='partScript'?'segmentScript':'storyPrompt',parentKey=node.type==='actScript'?'storyActId':node.type==='partScript'?'storyPartId':'storySegmentId';
      for(const child of state.nodes.filter(n=>n.type===childType&&n.data[parentKey]===node.id))button('Xem '+child.data.customName,()=>storyFocus(child));
      const field=document.createElement('textarea');field.value=node.data.text||'';field.readOnly=true;field.setAttribute('aria-label',node.type==='actScript'?'Nội dung hồi':node.type==='partScript'?'Nội dung phần':'Nội dung đoạn');body.append(field);button(node.type==='actScript'?'▶ Chạy hồi này':node.type==='partScript'?'▶ Chạy phần này':'▶ Chạy đoạn này',()=>execute(node.data.assemblyId),!!runForNode(node.data.assemblyId)||!assembly);button(node.type==='actScript'?'⇩ Tải video hồi':node.type==='partScript'?'⇩ Tải video phần':'⇩ Tải video đoạn',()=>storyDownload(assembly),!assembly?.data.asset?.url||!!assembly?.data.storyDirty);help('Chỉnh prompt ở từng cảnh. Chạy cấp này dùng lại kết quả đã có, chỉ tạo cảnh thiếu/đã chỉnh rồi ghép từ dưới lên. Video dài phụ thuộc bộ nhớ trình duyệt; nên dựng và tải từng đoạn/phần trước.');
    }
    if(node.type==='storyPrompt'){const input=toolField(body,node,'text','Yêu cầu của cảnh',{type:'textarea'});input.disabled=state.isRunning;if(node.data.storyMasterId)WorkflowStoryReferences.attach(input,node.data.storyMasterId);const original=input.oninput;input.oninput=()=>{original();syncEditedStoryReferences(node);storyDirtyAfter(node.id,true);};help(node.data.sceneLabel||'Yêu cầu ảnh/video của cảnh');}
    if(node.type==='videoAssembly'){
      button(runForNode(node.id)?'■ Dừng ghép':'▶ Tạo / cập nhật video',()=>runForNode(node.id)?stopGeneration(node.id):execute(node.id),!!autoPlan?.ids.has(node.id)&&node.data.status==='queued');if(node.data.asset?.url){const video=document.createElement('video');video.src=node.data.asset.url;video.controls=true;video.preload='metadata';body.append(video);button('⇩ Tải video MP4',()=>storyDownload(node),!!node.data.storyDirty);button('Thêm vào dòng thời gian',()=>{if(node.data.storyDirty)throw Error('Cảnh đã đổi; ghép lại trước.');addTimelineClip(ensureDockTimeline(),node.id);});}help(node.data.storyDirty?'Có cảnh đã thay đổi; cần chạy lại bước ghép.':'Ghép các video theo thứ tự kết nối, giữ âm thanh và thời lượng thực tế.');
    }
  }
  async function planMasterStory(node,signal){const source=storySource(node);if(!source)throw Error('Nhập kịch bản tổng trước.');if(source.length>500000)throw Error('Kịch bản tối đa 500.000 ký tự.');const request={requestId:uid('story'),mediaType:'text',prompt:source,rules:WorkflowStory.planningRules,stageBeforeSend:false,model:node.data.apiModel};const run=runForNode(node.id);if(run)run.requestId=request.requestId;const reply=await generateWithProvider({...node,type:'generateText'},request,signal);if(!reply?.ok||!reply.text)throw Error(reply?.error||'AI chưa trả kịch bản.');if(signal.aborted)throw new DOMException('Đã dừng.','AbortError');const missing=WorkflowStory.referenceTags(source).filter(tag=>!WorkflowStory.referenceTags(reply.text).includes(tag));if(missing.length)throw Error('AI đã bỏ mã '+missing.map(t=>'@'+t).join(', ')+'. Chia lại và giữ nguyên các mã tham chiếu.');const parsed=WorkflowStory.parse(reply.text);node.data.plan=reply.text;node.data.planSource=source;node.data.report=`AI đã chia ${parsed.acts.length} hồi. Kiểm tra bản chia rồi bấm Tạo node cho các hồi.`;}
  function buildMasterStory(master){
    if(state.isRunning)throw Error('Dừng chạy trước khi tạo node.');if(state.nodes.some(n=>n.data.storyMasterId===master.id))throw Error('Bản dựng này đã có node. Chạy từng hồi/phần/đoạn hoặc tạo bản dựng mới.');
    const original=storySource(master);if(master.data.plan&&master.data.planSource&&master.data.planSource!==original)throw Error('Kịch bản tổng đã đổi. Bỏ bản chia AI hoặc chia lại trước.');
    const text=String(master.data.plan||original).trim(),parsed=WorkflowStory.parse(text);let total=0,partCount=0,segmentCount=0;
    for(const act of parsed.acts)for(const part of act.parts){partCount++;for(const segment of part.segments){segmentCount++;const headings=[...segment.body.matchAll(/^\s*(?:#{1,6}\s*)?(?:CẢNH|SCENE)\s+(\d+)\s*\(([^)]*)\)\s*:\s*(.*?)\s*$/gim)];segment.scenes=parseSceneScript([parsed.preamble,act.context,part.context,segment.body].filter(Boolean).join('\n'),{taggedReferences:storyReferenceTags(master).length>0});if(!headings.length||segment.scenes.length!==headings.length)throw Error(`Hồi ${act.number}, phần ${part.number}, đoạn ${segment.number}: cần CẢNH có thời gian và Prompt video.`);const numbers=new Set();for(const [index,scene] of segment.scenes.entries()){if(scene.referenceTags.length>8)throw Error('Cảnh '+scene.number+' có hơn 8 mã ảnh tham chiếu.');if(numbers.has(scene.number))throw Error('Trùng cảnh '+scene.number+' trong đoạn '+segment.number);numbers.add(scene.number);const range=headings[index][2].match(/^(\d+):(\d{2})\s*(?:đến|to|[–—-])\s*(\d+):(\d{2})$/i),duration=range?(+range[3]*60+ +range[4])-(+range[1]*60+ +range[2]):0;if(!range||+range[2]>59||+range[4]>59||duration<4||duration>60||!scene.hasVideoPrompt)throw Error(`Cảnh ${scene.number}: cần Prompt video và thời lượng 4–60 giây.`);}total+=segment.scenes.length;}}
    if(total>500)throw Error('Tối đa 500 cảnh mỗi bản dựng. Tách kịch bản lớn thành nhiều dự án chương.');
    createUndoSnapshot('Tạo cấu trúc chương/phần/đoạn/cảnh');for(const tag of storyReferenceTags(master))storyReferenceNode(master,tag,true);const nodes=[],edges=[],actIds=[];let row=master.y;const baseX=master.x+370,project=master.id;
    const reused=new Set(),hierarchy={actScript:'partScript',partScript:'segmentScript',segmentScript:'storyPrompt'};
    const make=(type,x,y,data)=>{
      const parent=type==='actScript'?project:type==='partScript'?data.storyActId:type==='segmentScript'?data.storyPartId:type==='storyPrompt'?data.storySegmentId:null;
      const input=type==='storyPrompt'?'context':'text';
      const existing=parent&&state.nodes.find(n=>n.type===type&&!reused.has(n.id)&&!n.data.storyMasterId&&!n.data.assemblyId&&!n.data.asset&&!String(n.data.text||'').trim()&&!runForNode(n.id)&&getIncoming(n.id,input).length===1&&getIncoming(n.id,input)[0].source===parent&&getIncoming(n.id,input)[0].sourcePort==='text'&&state.edges.filter(e=>e.source===n.id).every(e=>{const child=nodeById(e.target);return child?.type===hierarchy[type]&&!child.data.storyMasterId&&!String(child.data.text||'').trim();}));
      const node=existing||makeNode(type,x,y);node.data={...node.data,...data,...(existing?.data.customName?{customName:existing.data.customName}:{}),storyMasterId:project};if(existing)reused.add(node.id);else nodes.push(node);return node;
    },edge=(source,port,target,input)=>{if(!state.edges.some(e=>e.source===source.id&&e.sourcePort===port&&e.target===target.id&&e.targetPort===input))edges.push({id:uid('edge'),source:source.id,sourcePort:port,target:target.id,targetPort:input});};
    const assemble=(owner,clips,role,x,y)=>{const assembly=make('videoAssembly',x,y,{storyActId:owner.data.storyActId||owner.id,storyPartId:owner.data.storyPartId,storySegmentId:owner.data.storySegmentId,assemblyRole:role,expectedClips:clips.length,customName:owner.data.customName+' · Video',status:'idle'});clips.forEach(clip=>edge(clip,'video',assembly,'video'));owner.data.assemblyId=assembly.id;return assembly;};
    for(const act of parsed.acts){const actRow=row,actNode=make('actScript',baseX,row,{customName:'Hồi/Chương '+act.number+' · '+act.title,text:act.body,actNumber:act.number});actIds.push(actNode.id);edge(master,'text',actNode,'text');const parts=[];
      for(const part of act.parts){const partRow=row,partNode=make('partScript',baseX+350,row,{customName:'Phần '+part.number+' · '+part.title,text:part.body,storyActId:actNode.id});edge(actNode,'text',partNode,'text');const segments=[];
        for(const segment of part.segments){const segmentRow=row,segmentNode=make('segmentScript',baseX+700,row,{customName:'Đoạn '+segment.number+' · '+segment.title,text:segment.body,storyActId:actNode.id,storyPartId:partNode.id});edge(partNode,'text',segmentNode,'text');const clips=[];
          for(const scene of segment.scenes){const y=row,sceneLabel=`H${act.number}–P${part.number}–Đ${segment.number}–C${scene.number} · ${scene.title}`,ratio=(scene.videoPrompt+' '+scene.imagePrompt).match(/\b(16:9|9:16|1:1|4:3|3:4)\b/)?.[1]||master.data.storySize||'16:9',meta={storyActId:actNode.id,storyPartId:partNode.id,storySegmentId:segmentNode.id,sceneLabel},context=[parsed.preamble,act.context,part.context,segment.context].filter(Boolean).join('\n\n');
            const missingPromptTags=scene.referenceTags.filter(tag=>!WorkflowStory.referenceTags(scene.imagePrompt+'\n'+scene.videoPrompt).includes(tag)),tagHint=missingPromptTags.length?'\nMã tham chiếu của cảnh: '+missingPromptTags.map(tag=>'@'+tag).join(', '):'';const tagged=storyReferenceTags(master).length>0,localMarker=tagged?'Danh mục nhân vật/bối cảnh chung chỉ để tra cứu; chỉ dùng nhân vật/bối cảnh được nhắc trong yêu cầu riêng của cảnh.\n'+WorkflowStory.scenePromptMarker+'\n':'';const imagePrompt=make('storyPrompt',baseX+1050,y,{...meta,text:(context?context+'\n\n':'')+localMarker+(scene.hasImagePrompt?scene.imagePrompt:'Tạo ảnh khung đầu cho cảnh sau, giữ nhân vật và bối cảnh đã mô tả: '+scene.videoPrompt)+tagHint,customName:sceneLabel+' · Yêu cầu ảnh'});edge(segmentNode,'text',imagePrompt,'context');const image=make('generateImage',baseX+1400,y,{...meta,provider:master.data.storyImageProvider||'gemini',size:ratio,status:'idle',customName:sceneLabel+' · Ảnh'});edge(imagePrompt,'text',image,'prompt');if(tagged)image.data.storyReferenceTags=scene.referenceTags;const taggedIds=new Set(Object.values(master.data.storyReferenceNodes||{}));for(const ref of getIncoming(master.id,'reference')){const source=nodeById(ref.source);if(source&&!taggedIds.has(source.id))edge(source,ref.sourcePort,image,'reference');}for(const tag of tagged?scene.referenceTags:[]){const source=storyReferenceNode(master,tag,true);edges.push({id:uid('edge'),source:source.id,sourcePort:'image',target:image.id,targetPort:'reference',storyReferenceBinding:master.id});}
            const prompt=make('storyPrompt',baseX+1050,y+500,{...meta,text:(context?context+'\n\n':'')+localMarker+scene.videoPrompt+tagHint,customName:sceneLabel+' · Yêu cầu video'});edge(segmentNode,'text',prompt,'context');const duration=[5,10,15,30,40].reduce((a,b)=>Math.abs(b-scene.seconds)<Math.abs(a-scene.seconds)?b:a,5),video=make('generateVideo',baseX+1750,y+500,{...meta,provider:master.data.storyVideoProvider||'muse',size:ratio,duration,status:'idle',customName:sceneLabel+' · Video'});edge(prompt,'text',video,'prompt');edge(image,'image',video,'reference');if(scene.negative){const neg=make('negativePrompt',baseX+1400,y+800,{...meta,text:scene.negative});edge(neg,'text',video,'negative');edge(neg,'text',image,'negative');}clips.push(video);row+=1050;
          }
          segments.push(assemble(segmentNode,clips,'segment',baseX+2120,segmentRow));row+=150;
        }
        parts.push(assemble(partNode,segments,'part',baseX+2490,partRow));
      }
      assemble(actNode,parts,'act',baseX+2860,actRow);row+=250;
    }
    state.nodes.push(...nodes);state.edges.push(...edges);master.data.actIds=actIds;delete master.data.filmId;master.data.storyBuildSource=text;master.data.report=`Đã tạo ${parsed.acts.length} hồi/chương, ${partCount} phần, ${segmentCount} đoạn, ${total} cảnh. Mỗi cảnh: ảnh → video; đầu ra cuối là từng hồi/chương. Chưa gọi AI.${reused.size?' Đã dùng lại '+reused.size+' node trống đã nối.':''}`;normalizeSavedGraph();render();storyFocus(master);scheduleAutoSave();
  }

  function toolField(body,node,key,label,{type='text',value='',min,max}={}){
    const wrap=document.createElement('label');wrap.textContent=label;const input=document.createElement(type==='textarea'?'textarea':'input');if(type!=='textarea')input.type=type;if(type==='number')input.step='any';
    if(type==='checkbox')input.checked=node.data[key]??value;else input.value=node.data[key]??value;if(min!==undefined)input.min=min;if(max!==undefined)input.max=max;
    input.setAttribute('aria-label',label);input.oninput=()=>{node.data[key]=type==='checkbox'?input.checked:input.value;if(WorkflowStudio.effects.has(node.type)){node.data.storyDirty=true;storyDirtyAfter(node.id,true);}scheduleAutoSave();};wrap.append(input);body.append(wrap);return input;
  }
  function renderTool(node,body){
    if(WorkflowStudio.definitions[node.type])renderStudioNode(node,body);
    if(WorkflowStory.definitions[node.type])renderStoryNode(node,body);
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
      if(Array.isArray(data.referenceImages))data.referenceImages=structuredClone(data.referenceImages);
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

  function cloneNodeBundle(originals,edges,{dx=0,dy=0,externalInputs=false}={}){
    const mapping=new Map(originals.map(n=>[n.id,uid(n.type)])),components=new Map(),copies=[];
    for(const original of originals){const copy=structuredClone(original);copy.id=mapping.get(original.id);copy.x+=dx;copy.y+=dy;copy.data||={};
      if(copy.data.storyReferenceNodes)copy.data.storyReferenceNodes=Object.fromEntries(Object.entries(copy.data.storyReferenceNodes).filter(([,id])=>mapping.has(id)).map(([tag,id])=>[tag,mapping.get(id)]));const previous=copy.data.componentId;delete copy.data.componentId;copy.data.componentId=(['imageInput','generateImage','imageResize'].includes(copy.type)?'IMG':copy.type==='videoInput'||copy.type==='generateVideo'?'VID':'NODE')+'-'+crypto.randomUUID().slice(0,8).toUpperCase();if(previous)components.set(previous,copy.data.componentId);
      for(const key of ['error','progress','endFrame','storyApprovedAssetId','flowCardId','report','createdIds','lastSceneText','lastSceneMode'])delete copy.data[key];
      copy.data.status='idle';copy.data.storyDirty=true;
      if(!['imageInput','videoInput','audioInput'].includes(copy.type)){delete copy.data.asset;if(copy.type==='generateText')copy.data.text='';}else if(copy.data.asset)copy.data.asset.id=uid('asset');
      for(const key of ['storyMasterId','storyActId','storyPartId','storySegmentId','storyReferenceOwner','assemblyId','filmId'])if(copy.data[key]){if(mapping.has(copy.data[key]))copy.data[key]=mapping.get(copy.data[key]);else delete copy.data[key];}
      for(const key of ['actIds','outputOrder','clipOrder'])if(Array.isArray(copy.data[key]))copy.data[key]=copy.data[key].map(id=>mapping.get(id)).filter(Boolean);
      if(copy.data.durations)copy.data.durations=Object.fromEntries(Object.entries(copy.data.durations).filter(([id])=>mapping.has(id)).map(([id,value])=>[mapping.get(id),value]));
      copies.push(copy);
    }
    for(const copy of copies)for(const key of ['text','script','plan'])if(typeof copy.data[key]==='string')for(const [old,id] of components)copy.data[key]=copy.data[key].split(old).join(id);
    const wires=edges.filter(e=>mapping.has(e.target)&&(externalInputs||mapping.has(e.source))).map(e=>({...e,id:uid('edge'),source:mapping.get(e.source)||e.source,target:mapping.get(e.target),...(e.storyReferenceBinding?{storyReferenceBinding:mapping.get(e.storyReferenceBinding)||e.storyReferenceBinding}:{})}));
    state.nodes.push(...copies);state.edges.push(...wires);state.selectedNodeIds=copies.map(n=>n.id);state.selectedNodeId=state.selectedNodeIds.at(-1)||null;state.selectedEdgeIds=[];return state.selectedNodeIds;
  }
  function duplicateNodesForDrag(ids){return cloneNodeBundle(ids.map(nodeById).filter(Boolean),state.edges,{externalInputs:true});}
  function selectedNodeBundle(){const ids=new Set(state.selectedNodeIds.length?state.selectedNodeIds:[state.selectedNodeId]);return {format:'workflow-node-bundle',version:1,nodes:state.nodes.filter(n=>ids.has(n.id)&&!n.data.dockOnly).map(original=>{const n=structuredClone(original);if(!['imageInput','videoInput','audioInput'].includes(n.type))delete n.data.asset;delete n.data.endFrame;return n;}),edges:state.edges.filter(e=>ids.has(e.source)&&ids.has(e.target))};}
  function pasteNodeBundle(bundle){
    if(state.isRunning){setRunStatus('Đang có tác vụ chạy. Dừng hoặc đợi hoàn tất trước khi nhân bản nhóm.','warn');return;}
    if(!bundle||bundle.format!=='workflow-node-bundle'||bundle.version!==1||!Array.isArray(bundle.nodes)||!bundle.nodes.length||bundle.nodes.length>2000||!Array.isArray(bundle.edges))throw Error('Không có nhóm node hợp lệ để dán.');
    if(bundle.nodes.some(n=>!n||!Object.hasOwn(nodeDefs,n.type)||typeof n.id!=='string'||!Number.isFinite(n.x)||!Number.isFinite(n.y)||!n.data)||new Set(bundle.nodes.map(n=>n.id)).size!==bundle.nodes.length)throw Error('Dữ liệu nhóm node không hợp lệ.');
    createUndoSnapshot('Nhân bản nhóm node');const ids=cloneNodeBundle(bundle.nodes,bundle.edges,{dx:60,dy:80});render();
    if(ids.length>1){const boxes=ids.map(id=>document.querySelector(`.node[data-id="${CSS.escape(id)}"]`)).filter(Boolean);const nodes=ids.map(nodeById),x=Math.min(...nodes.map(n=>n.x))-20,y=Math.min(...nodes.map(n=>n.y))-40;state.groups.push({id:uid('group'),name:'Nhóm sao chép',nodeIds:ids,x,y,width:Math.max(...nodes.map((n,i)=>n.x+(boxes[i]?.offsetWidth||320)))-x+20,height:Math.max(...nodes.map((n,i)=>n.y+(boxes[i]?.offsetHeight||300)))-y+20});render();}
    scheduleAutoSave();setRunStatus('Đã nhân bản '+ids.length+' node và dây nối nội bộ. Kéo tiêu đề một node để di chuyển cả nhóm.','ok');
  }
  function clearNodeOutput(node){
    if(!node||!['generateImage','generateVideo','generateText','preview'].includes(node.type))return;
    if(runForNode(node.id)||autoPlan?.ids.has(node.id))throw Error('Dừng node trước khi xóa kết quả.');
    createUndoSnapshot('Xóa kết quả cũ',{preserveRuntime:false});resetNodeOutput(node);render();scheduleAutoSave();
  }
  function resetNodeOutput(node){node.data.asset=null;node.data.endFrame=null;node.data.status='idle';node.data.error='';node.data.progress='';delete node.data.storyApprovedAssetId;if(node.type==='generateText')node.data.text='';storyDirtyAfter(node.id,true);syncPreviewOutputs();}
  const frameMatchesVideo=node=>!!node?.data.asset?.id&&!!node.data.endFrame?.url&&node.data.endFrame.sourceAssetId===node.data.asset.id;
  async function importVideoResult(node,file){
    if(!file)return;if(runForNode(node.id)||autoPlan?.ids.has(node.id))throw Error('Dừng node trước khi nhập kết quả.');
    if(file.size>100*1024*1024||!file.size)throw Error('Video phải có dữ liệu và không vượt 100 MB.');
    const previous=node.data.asset,url=URL.createObjectURL(file);let published=false;
    try{
      const info=await mediaDimensions(url,'video'),frame=await extractVideoEndFrame(url);
      if(nodeById(node.id)!==node||node.data.asset!==previous||runForNode(node.id)||autoPlan?.ids.has(node.id))throw Error('Node đã thay đổi hoặc đang chạy; chưa nhập video.');
      createUndoSnapshot('Nhập video kết quả',{preserveRuntime:false});const asset={id:uid('asset'),kind:'video',url,name:file.name,sourceNodeId:node.id,width:info.width,height:info.height,actualDuration:info.duration,requestedSize:node.data.size,imported:true};
      if(frame)frame.sourceAssetId=asset.id;node.data.asset=asset;node.data.endFrame=frame;node.data.status='success';node.data.error='';node.data.progress='';node.data.storyDirty=false;published=true;storyDirtyAfter(node.id,true);render();scheduleAutoSave();setRunStatus('Đã nhập video và trích khung cuối; không gửi yêu cầu AI.','ok');
    }finally{if(!published)URL.revokeObjectURL(url);}
  }
  async function refreshEndFrame(node){
    if(runForNode(node.id))throw Error('Đợi video hoàn tất trước.');const asset=node.data.asset;if(!asset?.url)throw Error('Chưa có video để trích khung cuối.');
    const frame=await extractVideoEndFrame(asset.url);if(nodeById(node.id)!==node||node.data.asset!==asset||runForNode(node.id))throw Error('Video đã thay đổi; không dùng khung cuối cũ.');if(!frame)throw Error('Không đọc được khung cuối. Kiểm tra video hoặc quyền truy cập tệp.');
    createUndoSnapshot('Trích khung cuối',{preserveRuntime:false});frame.sourceAssetId=asset.id;node.data.endFrame=frame;storyDirtyAfter(node.id,true);render();scheduleAutoSave();
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
    if(type==='referenceBoard')node.data={referenceImages:[],shared:false};if(type==='references')syncReferenceFanOut(node);else if(['generateImage','generateVideo','generateText'].includes(type)){const references=state.nodes.find(item=>item.type==='references');if(references)connectReferenceNode(references,node);}
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
    const existing=nodeById(id);if(!existing)return;storyDirtyAfter(id,true);createUndoSnapshot(`Delete ${nodeDefs[existing.type]?.title||'node'}`);
    state.nodes = state.nodes.filter(n => n.id !== id);
    state.edges = state.edges.filter(e => e.source !== id && e.target !== id);
    state.selectedNodeIds=state.selectedNodeIds.filter(nodeId=>nodeId!==id);if(state.selectedNodeId===id)state.selectedNodeId=state.selectedNodeIds.at(-1)||null;
    render();syncTimelineDock();scheduleAutoSave();
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
    const candidates=output.type==='image'?[['references','reference1','References · image 1'],['preview','media','Preview · image'],['imageResize','image','Image Resize'],['generateImage','reference','Generate Image · reference'],['generateVideo','reference','Generate Video · reference']]:output.type==='video'?[['finalOutput','video','Output · Xuất video cuối'],['audioMix','video','Âm thanh / nhạc nền'],['preview','media','Preview · video'],['timeline','clip1','Timeline · add clip']]:output.type==='text'?[['generateImage','prompt','Generate Image · prompt'],['generateVideo','prompt','Generate Video · prompt'],['textAppend','text','Text Append'],['textConcat','text','Text Merge · text']]:output.type==='audio'?[['finalOutput','audio','Output · Xuất video cuối'],['audioMix','audio','Âm thanh / nhạc nền'],['voiceSync','audio','Đồng bộ lời đọc – cảnh']]:output.type==='negative'?[['generateImage','negative','Generate Image · negative'],['generateVideo','negative','Generate Video · negative']]:[];
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
    if(!duplicate)state.edges.push({id:uid('edge'),source:from.nodeId,sourcePort:from.portId,target:targetNodeId,targetPort:targetPortId});if(!duplicate||willReplace)storyTouch(targetNodeId);
    if(target?.type==='timeline'&&targetPortId.startsWith('clip')&&source?.type==='generateVideo'){
      target.data.clipOrder=target.data.clipOrder||[];if(!target.data.clipOrder.includes(source.id))target.data.clipOrder.push(source.id);
    }
    state.connectingFrom=null;
    render();
  }

  function connectSelectedToInput(targetId,portId){
    const target=nodeById(targetId),input=nodeDefs[target?.type]?.inputs?.find(p=>p.id===portId);if(!target||!input)return;
    if(runForNode(targetId)||autoPlan?.ids.has(targetId)){setRunStatus('Dừng node đích trước khi nối nhanh.','warn');return;}
    const selected=[...new Set(state.selectedNodeIds.length?state.selectedNodeIds:[state.selectedNodeId])].filter(id=>id&&id!==targetId);if(!selected.length){setRunStatus('Kéo chọn các node nguồn trước, rồi giữ Shift và bấm cổng đầu vào của node đích.','warn');return;}
    const candidates=[];let incompatible=0,ambiguous=0,cycles=0,duplicates=0;
    for(const id of selected){const source=nodeById(id);if(!source)continue;const outputs=(nodeDefs[source.type]?.outputs||[]).filter(p=>canConnectTypes(p.type,input.type));if(!outputs.length){incompatible++;continue;}if(outputs.length>1){ambiguous++;continue;}if(wouldCreateCycle(id,targetId,null)){cycles++;continue;}const port=outputs[0];if(state.edges.some(e=>e.source===id&&e.sourcePort===port.id&&e.target===targetId&&e.targetPort===portId)){duplicates++;continue;}candidates.push({source:id,sourcePort:port.id});}
    if(!isMultiInput(target.type,portId)&&(candidates.length>1||candidates.length&&getIncoming(targetId,portId).length)){setRunStatus('Cổng “'+input.label+'” chỉ nhận một nguồn. Chưa nối và không thay dây cũ; dùng cổng nhận nhiều nguồn như Tham chiếu, Prompt hoặc Các video của Output.','warn');return;}
    if(!candidates.length){setRunStatus('Không thêm dây: '+duplicates+' đã nối, '+incompatible+' không tương thích, '+ambiguous+' cần chọn đầu ra cụ thể, '+cycles+' tạo vòng lặp.','warn');return;}
    createUndoSnapshot('Nối nhanh '+candidates.length+' node');for(const candidate of candidates)state.edges.push({id:uid('edge'),...candidate,target:targetId,targetPort:portId});
    if(target.type==='timeline'){target.data.clipOrder||=[];for(const c of candidates)if(!target.data.clipOrder.includes(c.source))target.data.clipOrder.push(c.source);}
    state.connectingFrom=null;state.draggingWire=null;state.wirePointer=null;document.querySelectorAll('.wire-compatible').forEach(p=>p.classList.remove('wire-compatible'));storyTouch(targetId);render();scheduleAutoSave();setRunStatus('Đã nối '+candidates.length+' node vào '+input.label+'.'+(duplicates?' Bỏ qua '+duplicates+' dây đã có.':'')+(incompatible+ambiguous+cycles?' Bỏ qua '+incompatible+' không tương thích, '+ambiguous+' đầu ra chưa rõ, '+cycles+' vòng lặp.':'')+' Ctrl+Z để hoàn tác.','ok');
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
  function isMultiInput(nodeType,portId){return nodeType==='finalOutput'&&portId==='video'||nodeType==='masterScript'&&portId==='reference'||nodeType==='videoAssembly'&&portId==='video'||nodeType==='voiceSync'&&['video','audio'].includes(portId)||nodeType==='bundleSave'||nodeType==='review'&&portId==='reference'||['generateImage','generateVideo','generateText'].includes(nodeType)&&['prompt','reference'].includes(portId)||nodeType==='references'&&portId.startsWith('reference')||nodeType==='textConcat'&&portId==='text';}
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
  function parseSceneScript(text,{taggedReferences=false}={}){
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
      if(rawImage&&!taggedReferences)imagePrompt=withPromptContext(imagePrompt,[locks['char lock'],locks['style lock']]);
      const videoContext=[locks['set lock'],locks['char lock'],locks['style lock']];
      if(rawVideo&&!taggedReferences)videoPrompt=withPromptContext(videoPrompt,videoContext);
      if(opening&&!imagePrompt.toLowerCase().includes(opening.toLowerCase()))imagePrompt=`${imagePrompt}\n\nOpening frame composition: ${opening}`.trim();
      const videoDetails=[beats?`Timed action beats:\n${beats}`:'',ending?`Final frame to reach: ${ending}`:'',audio?`Audio direction: ${audio}. No speech.`:''];
      if(rawVideo)videoPrompt=[videoPrompt,...videoDetails].filter(Boolean).join('\n\n');
      if(locks['video suffix']&&!videoPrompt.includes(locks['video suffix']))videoPrompt=`${videoPrompt}\n\n${locks['video suffix']}`.trim();
      const negative=expandScriptLocks(sceneNegative||locks.negative,locks),ratio=(imagePrompt+' '+videoPrompt+' '+preamble).match(/\b(9:16|16:9|1:1|4:3|3:4)\b/);
      return{number:Number(match[1]),title:match[3].trim(),imagePrompt,videoPrompt,hasImagePrompt:Boolean(rawImage),hasVideoPrompt:Boolean(rawVideo),negative,referenceTags:WorkflowStory.referenceTags(match[3]+'\n'+body),seconds:seconds>0?seconds:6,size:ratio?.[1]||'9:16'};
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
      if(scene.hasVideoPrompt){const prompt=makeNode('prompt',x,y+540);prompt.data={text:scene.videoPrompt,sceneLabel:label};const requestedDuration=[5,10,15,30,40].reduce((best,value)=>Math.abs(value-scene.seconds)<Math.abs(best-scene.seconds)?value:best,5);videoNode=makeNode('generateVideo',x+330,y+540);videoNode.data={model:'muse-video',size:scene.size,duration:requestedDuration,continuity:createdVideos.length>0,status:'idle',sceneLabel:label};state.nodes.push(prompt,videoNode);state.edges.push({id:uid('edge'),source:prompt.id,sourcePort:'text',target:videoNode.id,targetPort:'prompt'});if(imageNode)state.edges.push({id:uid('edge'),source:imageNode.id,sourcePort:'image',target:videoNode.id,targetPort:'reference'});made+=2;createdVideos.push({node:videoNode,seconds:requestedDuration});}
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
  const referenceUploads=new Set();
  function renderReferenceBoard(n,body,el){
    const images=WorkflowReferences.images(n.data);el.classList.add('reference-board');el.style.width=Math.max(620,images.length*126+32)+'px';
    const controls=document.createElement('div');controls.className='reference-board-controls';const label=document.createElement('label'),shared=document.createElement('input');shared.type='checkbox';shared.checked=!!n.data.shared;shared.disabled=state.isRunning;shared.onchange=()=>{createUndoSnapshot('Dùng ảnh cho toàn workflow');n.data.shared=shared.checked;render();};label.append(shared,document.createTextNode('Dùng chung cho toàn workflow'));const count=document.createElement('span');count.textContent=images.length+' / 8 ảnh';controls.append(label,count);body.append(controls);
    const strip=document.createElement('div');strip.className='reference-board-strip';
    for(const image of images){const tile=document.createElement('figure');tile.className='reference-board-tile';tile.dataset.referenceSlot=image.slot;const img=new Image();img.src=image.url;img.alt=image.name;const caption=document.createElement('figcaption');caption.textContent='Ảnh '+image.slot;const name=document.createElement('input');name.value=image.name;name.setAttribute('aria-label','Tên ảnh '+image.slot);name.disabled=state.isRunning;name.onchange=()=>{createUndoSnapshot('Đổi tên ảnh tham chiếu');image.name=name.value.trim()||'Ảnh '+image.slot;scheduleAutoSave();};const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.title='Xóa ảnh '+image.slot;remove.setAttribute('aria-label',remove.title);remove.disabled=state.isRunning;remove.onclick=()=>{createUndoSnapshot('Xóa ảnh tham chiếu');n.data.referenceImages=images.filter(i=>i.slot!==image.slot);state.edges=state.edges.filter(e=>!(e.source===n.id&&e.sourcePort==='image'+image.slot));render();};tile.append(img,caption,name,remove);strip.append(tile);}
    const upload=document.createElement('label');upload.className='reference-board-upload';upload.textContent=images.length?'＋ Thêm ảnh':'＋ Kéo thả ảnh vào đây';const input=document.createElement('input');input.type='file';input.accept='image/png,image/jpeg,image/webp';input.multiple=true;input.disabled=images.length===8||state.isRunning;input.setAttribute('aria-label','Thêm ảnh tham chiếu');
    const add=async files=>{if(state.isRunning)throw Error('Dừng workflow trước khi đổi ảnh.');if(referenceUploads.has(n.id))throw Error('Đang đọc ảnh; chờ hoàn tất.');referenceUploads.add(n.id);try{const added=await WorkflowReferences.prepare(n.data,[...files]);if(!nodeById(n.id))return;if(state.isRunning)throw Error('Workflow đã bắt đầu chạy; thêm ảnh lại sau khi dừng.');if(WorkflowReferences.images(n.data).map(i=>i.id).join(',')!==images.map(i=>i.id).join(','))throw Error('Bảng ảnh đã thay đổi trong khi đọc tệp. Thêm ảnh lại.');if(added.length){createUndoSnapshot('Thêm ảnh tham chiếu');n.data.referenceImages=[...images,...added];render();await queueWorkflowSave();setRunStatus('Đã thêm '+added.length+' ảnh. Kéo điểm dưới mỗi ảnh để nối tới node cần dùng.','ok');}}finally{referenceUploads.delete(n.id);}};
    input.onchange=()=>void add(input.files).catch(error=>setRunStatus(error.message,'error'));upload.append(input);strip.append(upload);body.append(strip);const hint=document.createElement('p');hint.className='hint';hint.textContent='Kéo điểm dưới từng ảnh tới cổng Ảnh tham chiếu. Một ảnh có thể nối nhiều node. Cổng Tất cả ảnh gửi cả bảng.';body.append(hint);
    body.ondragover=e=>{if(e.dataTransfer?.types.includes('Files')){e.preventDefault();e.stopPropagation();body.classList.add('reference-drag-over');}};body.ondragleave=()=>body.classList.remove('reference-drag-over');body.ondrop=e=>{e.preventDefault();e.stopPropagation();body.classList.remove('reference-drag-over');void add(e.dataTransfer.files).catch(error=>setRunStatus(error.message,'error'));};
  }

  function renderNode(n) {
    const el = document.createElement('section');
    el.className = `node ${['generateImage','generateVideo','generateText'].includes(n.type) ? 'generate' : ''} ${n.type==='timeline'?'timeline-node':''} ${state.selectedNodeIds.includes(n.id)||state.selectedNodeId===n.id ? 'selected' : ''}`;
    el.dataset.id = n.id;
    el.dataset.type = n.type;
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
      ta.oninput = () => {n.data.text = ta.value;storyDirtyAfter(n.id,true);};
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
    if(n.type==='referenceBoard')renderReferenceBoard(n,body,el);
    if(n.type==='references'){
      const incoming=(nodeDefs.references.inputs||[]).reduce((count,input)=>count+getIncoming(n.id,input.id).length,0),badge=document.createElement('span');badge.className='ref-badge';badge.textContent=`${incoming} image source${incoming===1?'':'s'} connected`;body.appendChild(badge);
      const list=document.createElement('div');list.className='references-input-list';(nodeDefs.references.inputs||[]).forEach(input=>{const row=document.createElement('div');row.textContent=`${input.label} · connect image source`;list.appendChild(row);});body.appendChild(list);
      const hint=document.createElement('div');hint.className='hint';hint.textContent='All connected images are sent to every connected Generate Image and Generate Video node.';body.appendChild(hint);
    }

    if(['generateImage','generateVideo','generateText'].includes(n.type))body.appendChild(providerControls(n));
    if(n.type==='generateText'){
      if(n.data.text){const splitButton=document.createElement('button');splitButton.type='button';splitButton.className='tool-action';splitButton.textContent='Tách kết quả thành node';splitButton.onclick=()=>WorkflowCreative.open(n.data.text);body.append(splitButton);}
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
      const referenceCount=resolveReferences(n.id).length;if(referenceCount){const b=document.createElement('span');b.className='ref-badge';b.textContent=`${referenceCount} reference image${referenceCount===1?'':'s'} connected`;body.appendChild(b);}
      body.appendChild(createNodeRunActions(n));
    }

    if(n.type==='generateVideo'){
      const controls=document.createElement('div');controls.className='gen-controls video-controls';
      const ratio=document.createElement('select');[['16:9','Landscape 16:9'],['9:16','Portrait 9:16'],['1:1','Square']].forEach(([v,label])=>{const o=document.createElement('option');o.value=v;o.textContent=label;ratio.appendChild(o);});ratio.value=['16:9','9:16','1:1'].includes(n.data.size)?n.data.size:'16:9';ratio.onchange=()=>n.data.size=ratio.value;
      const duration=document.createElement('select');[5,10,15,30,40].forEach(v=>{const o=document.createElement('option');o.value=String(v);o.textContent=`${v} giây`;duration.appendChild(o);});n.data.duration=[5,10,15,30,40].reduce((a,b)=>Math.abs(b-(n.data.duration||5))<Math.abs(a-(n.data.duration||5))?b:a,5);duration.value=String(n.data.duration);duration.onchange=()=>n.data.duration=Number(duration.value);
      controls.append(ratio,duration);body.appendChild(controls);
      const continuityLabel=document.createElement('label');continuityLabel.className='continuity-toggle';continuityLabel.htmlFor=`continuity-${n.id}`;continuityLabel.onpointerdown=event=>event.stopPropagation();const continuity=document.createElement('input');continuity.id=`continuity-${n.id}`;continuity.type='checkbox';continuity.checked=Boolean(n.data.continuity);continuity.onchange=()=>{n.data.continuity=continuity.checked;scheduleAutoSave();};continuityLabel.append(continuity,document.createTextNode('Use previous clip end frame as start reference'));body.appendChild(continuityLabel);
      for(const edge of getIncoming(n.id,'reference').filter(e=>e.sourcePort==='endFrame')){const source=sourceFor(edge),note=document.createElement('p');note.className='hint';note.textContent='Khung mở đầu từ '+(source?.data.componentId||edge.source)+'-END';body.append(note);if(frameMatchesVideo(source)){const inputFrame=new Image();inputFrame.className='end-frame-input';inputFrame.src=source.data.endFrame.url;inputFrame.alt=note.textContent;body.append(inputFrame);}else{note.textContent+=' · chưa có ảnh, cần chạy hoặc trích khung cuối ở video nguồn.';}}
      if(frameMatchesVideo(n)){const frame=document.createElement('img');frame.className='end-frame-thumb';frame.src=n.data.endFrame.url;frame.alt='Extracted final frame for continuity';frame.title='Khung cuối của video này · nối cổng end frame vào Ảnh tham chiếu của video tiếp theo';const caption=document.createElement('p');caption.className='hint';caption.textContent='Khung cuối của video này';body.append(caption,frame);studioButton(body,'Tải ảnh khung cuối',()=>{const link=document.createElement('a');link.href=n.data.endFrame.url;link.download=n.data.componentId+'-khung-cuoi.png';link.click();});studioButton(body,'Tách khung cuối thành node ảnh',()=>{createUndoSnapshot('Tạo node ảnh khung cuối');const image=makeNode('imageInput',n.x+360,n.y+80);image.data={...image.data,localDataUrl:n.data.endFrame.url,fileName:n.data.componentId+'-khung-cuoi.png',customName:'Khung cuối '+n.data.componentId};state.nodes.push(image);render();scheduleAutoSave();});}
      if(n.data.endFrame?.url&&!frameMatchesVideo(n)){const warning=document.createElement('p');warning.className='hint error';warning.textContent='Khung cuối cũ chưa xác minh với video này. Bấm Trích lại khung cuối.';body.append(warning);}
      studioButton(body,'Trích lại khung cuối',()=>refreshEndFrame(n),{disabled:!n.data.asset?.url||!!runForNode(n.id)});
      const status=document.createElement('div');status.className=`status ${n.data.status||'idle'}`;status.textContent=n.data.status==='running'&&n.data.progress?n.data.progress:`${n.data.status||'idle'}${n.data.error?' · '+n.data.error:''}`;body.appendChild(status);
      if(n.data.asset?.width&&n.data.asset?.height){const dimensions=document.createElement('div');dimensions.className=`hint ${n.data.asset.sizeMismatch?'error':''}`;dimensions.textContent=`Yêu cầu ${n.data.asset.requestedSize||n.data.size} · thực tế ${n.data.asset.width} × ${n.data.asset.height}${n.data.asset.actualDuration?' · '+n.data.asset.actualDuration.toFixed(1)+' giây':''}${n.data.asset.sizeMismatch?' (AI trả về tỷ lệ khác)':''}`;body.appendChild(dimensions);}
      if(n.data.asset?.url){const video=document.createElement('video');video.controls=true;video.preload='metadata';video.src=n.data.asset.url;body.appendChild(video);}
      const timelineDrag=document.createElement('button');timelineDrag.type='button';timelineDrag.className='video-timeline-drag';timelineDrag.draggable=true;timelineDrag.innerHTML='<span aria-hidden="true">⠿</span> Drag output to Timeline';timelineDrag.title='Drag this output to the timeline';timelineDrag.ondragstart=event=>{event.dataTransfer.setData('application/x-museflow-video-node',n.id);event.dataTransfer.setData('text/plain',n.id);event.dataTransfer.effectAllowed='copy';};timelineDrag.onclick=event=>{event.stopPropagation();addTimelineClip(ensureDockTimeline(),n.id);};body.appendChild(timelineDrag);
      body.appendChild(createNodeRunActions(n));
      const importResult=document.createElement('input');importResult.type='file';importResult.accept='video/*,.mp4,.webm,.mov';importResult.hidden=true;importResult.dataset.importResult='video';importResult.onchange=()=>{const file=importResult.files?.[0];importResult.value='';void importVideoResult(n,file).catch(error=>setRunStatus(error.message,'error'));};body.append(importResult);studioButton(body,'Nhập video kết quả',()=>importResult.click(),{disabled:!!runForNode(n.id)});
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
      if (n.data.asset?.url) { if(['video','audio'].includes(n.data.asset.kind)){const video=document.createElement(n.data.asset.kind==='audio'?'audio':'video');video.controls=true;video.src=n.data.asset.url;body.appendChild(video);}else{const a=document.createElement('a');a.href=n.data.asset.url;a.target='_blank';const img=document.createElement('img');img.src=n.data.asset.url;a.appendChild(img);body.appendChild(a);} }
      else { const empty=document.createElement('div'); empty.className='empty preview-empty'; empty.textContent='Run workflow'; body.appendChild(empty); }
    }

    el.appendChild(body);
    addPorts(el, n);
    if(['generateImage','generateVideo','generateText'].includes(n.type))studioButton(body,'Xóa kết quả cũ',()=>clearNodeOutput(n),{disabled:!!runForNode(n.id)});
    compactGenerator(n,body);
    el.onmousedown = event => {if(event.target.closest('button,input,textarea,select,summary,details,.port,.node-header'))return;if(event.shiftKey||event.ctrlKey||event.metaKey)selectNode(n.id,{toggle:true});else if(!state.selectedNodeIds.includes(n.id))selectNode(n.id);};
    return el;
  }

  const compactPanels=new Map();
  function compactGenerator(node,body){
    if(!['generateImage','generateVideo'].includes(node.type))return;
    body.classList.add('compact-generation');
    const children=[...body.children],provider=body.querySelector('.provider-controls'),controls=body.querySelector('.gen-controls'),status=body.querySelector('.status'),actions=body.querySelector('.node-generation-actions');
    const media=children.find(el=>el.matches('video,.image-link')),options=document.createElement('div');options.className='node-options';
    const sections={};
    for(const [key,name] of [['connection','Kết nối AI'],['frames',node.type==='generateVideo'?'Khung hình':'Ảnh tham chiếu'],['tools','Công cụ'],['info','Chi tiết']]){
      const details=document.createElement('details');details.className='node-option';details.dataset.panel=key;const summary=document.createElement('summary');summary.textContent=name;const content=document.createElement('div');content.className='node-option-content';summary.title=key==='frames'?'Ảnh tham chiếu, khung mở đầu và khung cuối':name;details.append(summary,content);options.append(details);sections[key]={details,content};
      details.open=compactPanels.get(node.id+':'+key)||false;
      details.ontoggle=()=>{if(!details.isConnected)return;compactPanels.set(node.id+':'+key,details.open);scheduleDrawEdges();};
    }
    if(provider){const first=provider.querySelector('select[aria-label="AI thực hiện"]');for(const el of [...provider.children])if(el!==first)sections.connection.content.append(el);}
    for(const el of children){
      if([provider,controls,status,actions,media].includes(el))continue;
      if(el.matches('.tool-action,.video-timeline-drag')){
        if(/khung cuối/.test(el.textContent))sections.frames.content.append(el);else sections.tools.content.append(el);
      }else if(el.matches('.reference-id-list,.continuity-toggle,.end-frame-thumb,.end-frame-input')||/Khung (?:cuối|mở đầu)/.test(el.textContent))sections.frames.content.append(el);
      else if(el.matches('.hint,.ref-badge'))sections.info.content.append(el);
      else sections.info.content.append(el);
    }
    if(status){status.title=status.textContent;const log=document.createElement('p');log.className='node-status-detail';log.textContent=status.textContent;sections.info.content.prepend(log);}
    if(controls){[...controls.querySelectorAll('select')].forEach((select,i)=>select.setAttribute('aria-label',i===0?'Tỷ lệ khung hình':'Thời lượng video'));for(const model of [...controls.querySelectorAll('input')])sections.connection.content.append(model);}
    const sharedLabel=document.createElement('label');sharedLabel.className='shared-reference-toggle';const sharedCheck=document.createElement('input');sharedCheck.type='checkbox';sharedCheck.checked=!node.data.excludeSharedReferences;sharedCheck.disabled=!!node.data.freezeSharedReferences;sharedCheck.onchange=()=>{createUndoSnapshot('Đổi ảnh chung');node.data.excludeSharedReferences=!sharedCheck.checked;render();};sharedLabel.append(sharedCheck,document.createTextNode(node.data.freezeSharedReferences?'Ảnh đã chốt trong hàng đợi':'Dùng ảnh tham chiếu chung'));sections.frames.content.append(sharedLabel);
    const refs=sections.frames.content.querySelector('.reference-id-list');if(refs){refs.title=refs.textContent;sections.frames.details.querySelector('summary').textContent=(node.type==='generateVideo'?'Khung hình':'Ảnh tham chiếu')+' · '+resolveReferences(node.id).length;}
    if(node.data.status==='error')sections.info.details.open=true;
    body.replaceChildren(...[provider,controls,status,media,actions,options].filter(Boolean));
  }

  function createNodeRunActions(node){
    const actions=document.createElement('div');actions.className='node-generation-actions';
    const button=document.createElement('button');button.type='button';button.className='node-run-button primary';
    if(node.data.status==='queued'&&autoPlan?.ids.has(node.id)){button.textContent='Đợi đầu vào';button.disabled=true;}else if(node.data.status==='running'){
      button.classList.add('stop');button.textContent='■ Stop';button.disabled=false;button.title='Stop this generation';button.dataset.stopGeneration=node.id;button.onclick=event=>{event.stopPropagation();stopGeneration(node.id);};
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
      port.onpointerdown=e=>{if(e.shiftKey){e.stopPropagation();return;}if(p.type==='text'||p.type==='negative')startWireFromInput(e,n.id,p.id,p.type);};
      port.ondragover=e=>{if(state.connectingFrom&&portCompatible(state.connectingFrom,n.id,p.id)){e.preventDefault();port.classList.add('wire-compatible');}};
      port.onclick = (e) => { e.stopPropagation();if(e.shiftKey){connectSelectedToInput(n.id,p.id);return;} if(state.suppressPortClick)return; if(state.connectingFrom)connect(n.id,p.id); else setRunStatus('Start from a compatible output port, then click this input.','warn'); };
      const label=document.createElement('span'); label.className='port-label left'; label.style.top=`${y-1}px`; const count=isMultiInput(n.type,p.id)?getIncoming(n.id,p.id).length:0;label.textContent=count?`${p.label} · ${count}`:p.label;if(count)port.title=`${p.label}: ${count} nguồn đã nối`;port.title+=' · Giữ Shift và bấm để nối các node đang chọn';el.append(label,port);
    });
    (def.outputs || []).forEach((p, i) => {
      if(n.type==='referenceBoard'&&p.id!=='image'&&!WorkflowReferences.select(n.data,p.id).length)return;
      const y = ['prompt','negativePrompt','textAppend'].includes(n.type) ? 80 : n.type==='generateVideo'?82+i*30:['imageInput','generateImage'].includes(n.type)?82:66+i*42;
      const port=document.createElement('div'); port.className='port out'; port.dataset.node=n.id; port.dataset.port=p.id;port.dataset.type=p.type; port.style.top=`${y}px`; port.title=`Output: ${p.label} (${p.type})`;
      port.onpointerdown=e=>startWire(e,n.id,p.id);
      if(n.type==='generateVideo'){port.classList.add('video-output-port');port.title=p.id==='endFrame'?'Connect this final frame to the next video’s reference input':'Connect video output to the Timeline or another compatible input';}
      port.onmousedown=e=>{if(e.button===0){e.stopPropagation();state.connectingFrom={nodeId:n.id,portId:p.id};setRunStatus(`Connecting ${p.type}: click a compatible input port.`,'warn');}};
      port.onclick=(e)=>{e.stopPropagation();if(state.suppressPortClick)return;if(!state.draggingWire){state.connectingFrom={nodeId:n.id,portId:p.id};setRunStatus(`Connecting ${p.type}: click a compatible input or drag to one.`,'warn');}};
      if(n.type==='referenceBoard'&&p.id!=='image'){const tile=el.querySelector('[data-reference-slot="'+p.id.slice(5)+'"]');port.style.top='auto';port.style.bottom='-7px';port.style.right='12px';tile.append(port);return;}
      if(n.type==='referenceBoard')port.style.top='74px';
      const label=document.createElement('span'); label.className='port-label right'; label.style.top=`${y-1}px`; label.textContent=p.label; el.append(label,port);
    });
  }

  function setupDrag(handle, n, el) {
    handle.onmousedown = (e) => {
      if(state.handMode||state.spaceDown)return;
      if(e.target.closest('button,.node-close'))return;
      e.preventDefault();
      const altCopy=e.altKey,modified=e.shiftKey||e.ctrlKey||e.metaKey,wasSelected=state.selectedNodeIds.includes(n.id);if(modified){selectNode(n.id,{toggle:true});if(wasSelected)return;}else if(!wasSelected)selectNode(n.id);
      const sx=e.clientX, sy=e.clientY,zoom=state.zoom;let group=state.selectedNodeIds.includes(n.id)?[...state.selectedNodeIds]:[n.id],origins=[],groupOrigins=[],copied=false,undoRecorded=false,moved=false;
      const getOrigins=()=>group.map(id=>{const node=nodeById(id);return node&&{id:node.id,x:node.x,y:node.y};}).filter(Boolean);origins=getOrigins();const getGroupOrigins=()=>state.groups.filter(g=>g.nodeIds.length&&g.nodeIds.every(id=>group.includes(id))).map(g=>({id:g.id,x:g.x,y:g.y}));groupOrigins=getGroupOrigins();
      const move=(ev)=>{const rawDx=ev.clientX-sx,rawDy=ev.clientY-sy;if(altCopy&&!copied){if(Math.hypot(rawDx,rawDy)<3)return;createUndoSnapshot(`Alt-drag copy ${group.length===1?'node':'nodes'}`);group=duplicateNodesForDrag(group);copied=true;undoRecorded=true;origins=getOrigins();groupOrigins=getGroupOrigins();render();}
        const dx=rawDx/zoom,dy=rawDy/zoom;if(Math.abs(dx)+Math.abs(dy)<.1)return;if(!undoRecorded){createUndoSnapshot(`Move ${group.length===1?'node':'nodes'}`);undoRecorded=true;}moved=true;
        for(const origin of origins){const node=nodeById(origin.id);if(!node)continue;node.x=origin.x+dx;node.y=origin.y+dy;const nodeEl=document.querySelector(`.node[data-id="${CSS.escape(origin.id)}"]`);if(nodeEl){nodeEl.style.left=`${node.x}px`;nodeEl.style.top=`${node.y}px`;}}for(const origin of groupOrigins){const g=state.groups.find(g=>g.id===origin.id);if(g){g.x=origin.x+dx;g.y=origin.y+dy;const el=document.querySelector(`.canvas-group[data-group-id="${CSS.escape(g.id)}"]`);if(el){el.style.left=g.x+'px';el.style.top=g.y+'px';}}}scheduleDrawEdges();};
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
    const field=target?.closest?.('label')?.querySelector('input[type="file"][accept*="image"],input[type="file"][accept*="video"],input[type="file"][accept*="audio"]');
    const element=target?.closest?.('.node'),node=nodeById(element?.dataset.id|| (paste?state.selectedNodeId:null));
    if(field&&!node)return {field};
    if(target?.closest?.('#timelineDock'))return {timeline:true};
    if(!node)return null;
    if(['imageInput','videoInput','audioInput'].includes(node.type))return {node};
    const port=target?.closest?.('.port.in'),kind=files[0]?.type?.split('/')[0]||'image';
    const input=port?(nodeDefs[node.type].inputs||[]).find(p=>p.id===port.dataset.port):(nodeDefs[node.type].inputs||[]).find(p=>p.type===kind||p.type==='media');
    return input&&['image','video','audio','media'].includes(input.type)?{node,port:input}:null;
  }
  async function importMediaFiles(files,destination){
    if(!files.length)return;
    const {node,port,field,timeline}=destination;
    if(node&&runForNode(node.id))throw new Error('Node đang chạy; đợi hoàn tất rồi thay tệp.');
    const accept=field?.accept||(port?.type==='audio'||node?.type==='audioInput'?'audio/':port?.type==='media'||timeline?'image/,video/':port?.type==='video'||node?.type==='videoInput'?'video/':'image/');
    for(const file of files){if(!/^(image|video|audio)\//.test(file.type)||!accept.split(',').some(type=>file.type.startsWith(type.trim().replace('*',''))))throw new Error('Sai loại tệp: ô này cần '+accept+'.');if(!file.size||file.size>100*1024*1024)throw new Error('Tệp phải có dung lượng từ 1 byte đến 100 MB.');}
    if(field){if(!field.multiple&&files.length>1)throw new Error('Ô này chỉ nhận một tệp.');const dt=new DataTransfer();const all=field.multiple?[...field.files,...files]:files;if(field.id==='batchReferences'&&(all.length>8||all.reduce((sum,f)=>sum+f.size,0)>20*1024*1024))throw new Error('Tối đa 8 ảnh, tổng 20 MB.');all.forEach(file=>dt.items.add(file));field.files=dt.files;field.dispatchEvent(new Event('change',{bubbles:true}));setRunStatus('Đã thêm tệp.','ok');return;}
    if(node&&!port&&files.length>1||port&&!isMultiInput(node.type,port.id)&&files.length>1)throw new Error('Ô này chỉ nhận một tệp mỗi lần.');
    const loaded=await Promise.all(files.map(async file=>({file,url:await blobAsDataUrl(file)})));
    if(node&&(nodeById(node.id)!==node||runForNode(node.id)))throw new Error('Node đã thay đổi hoặc đang chạy; chưa thay tệp.');
    createUndoSnapshot('Nhập ảnh/video');
    for(const [index,{file,url}] of loaded.entries()){
      const kind=file.type.split('/')[0];let source=node;
      if(port||timeline){source=makeNode(kind==='video'?'videoInput':kind==='audio'?'audioInput':'imageInput',Math.max(20,(node?.x||350)-330),(node?.y||80)+index*250);state.nodes.push(source);}
      storyDirtyAfter(source.id,true);if(port)storyTouch(node.id);source.data.fileName=file.name;source.data.localDataUrl=url;source.data.asset={id:uid('asset'),kind,url,name:file.name,sourceNodeId:source.id};
      if(port){if(!isMultiInput(node.type,port.id))state.edges=state.edges.filter(e=>!(e.target===node.id&&e.targetPort===port.id));state.edges.push({id:uid('edge'),source:source.id,sourcePort:kind,target:node.id,targetPort:port.id});}
      if(timeline){const tl=ensureDockTimeline();tl.data.clipOrder.push(source.id);}
    }
    render();scheduleAutoSave();setRunStatus(`Đã thêm ${files.length} tệp.`,'ok');
  }
  document.addEventListener('dragover',event=>{if(event.target.closest?.('#storyReferencesDialog'))return;if(!event.dataTransfer?.types.includes('Files'))return;event.preventDefault();const destination=mediaDestination(event.target,[...(event.dataTransfer.items||[])].filter(i=>i.kind==='file'));document.querySelectorAll('.media-drag-over').forEach(el=>el.classList.remove('media-drag-over'));if(destination){(event.target.closest('.node,.timeline-dock,label'))?.classList.add('media-drag-over');event.dataTransfer.dropEffect='copy';}});
  document.addEventListener('dragleave',event=>{if(!event.target.contains?.(event.relatedTarget))event.target.classList?.remove('media-drag-over');});
  document.addEventListener('drop',event=>{if(event.target.closest?.('#flowStudioDialog,#batchManagerDialog,#storyReferencesDialog'))return;if(!event.dataTransfer?.files.length)return;event.preventDefault();document.querySelectorAll('.media-drag-over').forEach(el=>el.classList.remove('media-drag-over'));const files=[...event.dataTransfer.files],destination=mediaDestination(event.target,files);if(destination)void importMediaFiles(files,destination).catch(error=>setRunStatus(error.message,'error'));else setRunStatus('Thả tệp vào node ảnh/video hoặc cổng đầu vào tương ứng.','warn');},true);
  document.addEventListener('paste',event=>{if(event.target.closest?.('#storyReferencesDialog'))return;const files=[...(event.clipboardData?.files||[])];if(!files.length)return;const destination=mediaDestination(event.target,files,{paste:true});if(!destination)return;event.preventDefault();void importMediaFiles(files,destination).catch(error=>setRunStatus(error.message,'error'));});

  function ensureDockTimeline(){let timeline=state.nodes.find(item=>item.type==='timeline');if(!timeline){timeline={id:uid('timeline'),type:'timeline',x:0,y:0,data:{clipOrder:[],durations:{},dockOnly:true}};state.nodes.push(timeline);}timeline.data=timeline.data||{};timeline.data.clipOrder=timeline.data.clipOrder||[];timeline.data.durations=timeline.data.durations||{};return timeline;}

  const timelineMedia=n=>!!n&&(['generateVideo','generateImage','imageInput','videoInput','imageResize','audioMix','subtitles','voiceSync','transition','speed','videoAssembly','finalOutput'].includes(n.type));
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
    ensureComponentIds();syncSharedReferenceBoards();
    syncPreviewOutputs();canvas.innerHTML='';state.groups.forEach(group=>canvas.appendChild(renderCanvasGroup(group)));state.notes.forEach(note=>canvas.appendChild(renderCanvasNote(note)));state.nodes.filter(n=>!n.data?.dockOnly).forEach(n => canvas.appendChild(renderNode(n)));applyCanvasTransform();requestAnimationFrame(drawEdges);syncTimelineDock();updateChatUsageLabels();scheduleAutoSave();
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
    const frame=document.createElement('div');frame.className='canvas-group';frame.dataset.groupId=group.id;frame.style.left=`${group.x}px`;frame.style.top=`${group.y}px`;frame.style.width=`${group.width}px`;frame.style.height=`${group.height}px`;
    const label=document.createElement('span');label.className='canvas-group-label';label.textContent=group.name||'Group';
    const remove=document.createElement('button');remove.type='button';remove.className='canvas-group-delete';remove.textContent='×';remove.title='Delete group region';remove.setAttribute('aria-label','Delete group region');remove.onclick=event=>{event.stopPropagation();createUndoSnapshot('Delete group region');state.groups=state.groups.filter(item=>item.id!==group.id);render();saveState();};
    const first=nodeById(group.nodeIds[0]);if(first){setupDrag(label,first,frame);const drag=label.onmousedown;label.title='Kéo để di chuyển cả nhóm';label.onmousedown=event=>{if(state.handMode||state.spaceDown)return;state.selectedNodeIds=group.nodeIds.filter(id=>nodeById(id));state.selectedNodeId=first.id;document.querySelectorAll('.node').forEach(el=>el.classList.toggle('selected',state.selectedNodeIds.includes(el.dataset.id)));drag(event);};}
    frame.append(label,remove);return frame;
  }

  function syncPreviewOutputs(){for(const preview of state.nodes.filter(node=>node.type==='preview')){const edge=getIncoming(preview.id,'media')[0],source=edge&&nodeById(edge.source);let asset=null;if(source){asset=edge.sourcePort==='endFrame'?(frameMatchesVideo(source)?source.data.endFrame:null):source.data?.asset;if(!asset&&source.type==='referenceBoard'){const image=WorkflowReferences.select(source.data,edge.sourcePort)[0];if(image)asset={id:image.id,kind:'image',url:image.url,name:image.name};}if(!asset&&source.type==='imageInput'&&source.data?.localDataUrl)asset={id:source.id,kind:'image',url:source.data.localDataUrl,name:'Input image'};}preview.data.asset=asset||null;}}

  function applyCanvasTransform(){const transform=`translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;canvas.style.transform=transform;edgesSvg.style.transform=transform;$('#zoomLevel').textContent=`${Math.round(state.zoom*100)}%`;$('#viewport').classList.toggle('hand-mode',state.handMode||state.spaceDown);}
  function zoomAt(clientX,clientY,factor){const rect=$('#viewport').getBoundingClientRect(),x=clientX-rect.left,y=clientY-rect.top,old=state.zoom,next=Math.max(.25,Math.min(2.5,old*factor));if(next===old)return;const contentX=(x-state.panX)/old,contentY=(y-state.panY)/old;state.zoom=next;state.panX=x-contentX*next;state.panY=y-contentY*next;applyCanvasTransform();scheduleDrawEdges();}
  function setZoom(value){const rect=$('#viewport').getBoundingClientRect();zoomAt(rect.left+rect.width/2,rect.top+rect.height/2,value/state.zoom);}
  function fitCanvas(){const nodes=state.nodes.filter(node=>!node.data?.dockOnly);if(!nodes.length){state.zoom=1;state.panX=0;state.panY=0;applyCanvasTransform();return;}const rect=$('#viewport').getBoundingClientRect(),xs=nodes.map(n=>n.x),ys=nodes.map(n=>n.y),maxX=Math.max(...nodes.map(n=>n.x+(document.querySelector(`.node[data-id="${CSS.escape(n.id)}"]`)?.offsetWidth||270))),maxY=Math.max(...nodes.map(n=>n.y+(document.querySelector(`.node[data-id="${CSS.escape(n.id)}"]`)?.offsetHeight||220)));const minX=Math.min(...xs),minY=Math.min(...ys),scale=Math.max(.25,Math.min(1.5,(rect.width-100)/(maxX-minX+80),(rect.height-80)/(maxY-minY+80)));state.zoom=scale;state.panX=(rect.width-(maxX-minX)*scale)/2-minX*scale;state.panY=(rect.height-(maxY-minY)*scale)/2-minY*scale;applyCanvasTransform();scheduleDrawEdges();}
  function startPan(event){state.panning={x:event.clientX,y:event.clientY,panX:state.panX,panY:state.panY};$('#viewport').classList.add('panning');try{event.currentTarget.setPointerCapture(event.pointerId);}catch{}event.preventDefault();}
  function movePan(event){if(!state.panning)return;state.panX=state.panning.panX+event.clientX-state.panning.x;state.panY=state.panning.panY+event.clientY-state.panning.y;applyCanvasTransform();scheduleDrawEdges();}
  function endPan(){state.panning=null;$('#viewport').classList.remove('panning');}

  function startSelectionMarquee(event){
    if(event.button!==0||state.handMode||state.spaceDown||event.target.closest('.node,.canvas-note,.canvas-tools,.canvas-group-label,button'))return;
    const viewport=$('#viewport'),bounds=viewport.getBoundingClientRect(),keep=event.shiftKey||event.ctrlKey||event.metaKey;
    if(state.groupDrawMode){const box=document.createElement('div');box.className='group-marquee';viewport.appendChild(box);state.groupMarquee={startX:event.clientX,startY:event.clientY,bounds,box};try{viewport.setPointerCapture(event.pointerId);}catch{}event.preventDefault();return;}
    if(!keep){state.selectedNodeIds=[];state.selectedNodeId=null;state.selectedEdgeIds=[];document.querySelectorAll('.node.selected').forEach(node=>node.classList.remove('selected'));scheduleDrawEdges();}
    const box=document.createElement('div');box.className='selection-marquee';viewport.appendChild(box);
    state.selectionMarquee={startX:event.clientX,startY:event.clientY,bounds,box,keep,initial:[...state.selectedNodeIds],initialEdges:keep?[...state.selectedEdgeIds]:[]};
    try{viewport.setPointerCapture(event.pointerId);}catch{}event.preventDefault();
  }
  function moveSelectionMarquee(event){const drag=state.selectionMarquee;if(!drag)return;const left=Math.min(event.clientX,drag.startX),top=Math.min(event.clientY,drag.startY),right=Math.max(event.clientX,drag.startX),bottom=Math.max(event.clientY,drag.startY);Object.assign(drag.box.style,{left:`${left-drag.bounds.left}px`,top:`${top-drag.bounds.top}px`,width:`${right-left}px`,height:`${bottom-top}px`});const selected=new Set(drag.initial);for(const node of document.querySelectorAll('.node')){const r=node.getBoundingClientRect();if(r.right>=left&&r.left<=right&&r.bottom>=top&&r.top<=bottom)selected.add(node.dataset.id);}state.selectedNodeIds=[...selected];state.selectedNodeId=state.selectedNodeIds.at(-1)||null;document.querySelectorAll('.node').forEach(node=>node.classList.toggle('selected',selected.has(node.dataset.id)));const selectedEdges=new Set(drag.initialEdges);for(const path of edgesSvg.querySelectorAll('.edge[data-edge-id]')){const matrix=path.getScreenCTM();if(!matrix)continue;const length=path.getTotalLength();for(let point=0;point<=length;point+=Math.max(8,length/60)){const p=new DOMPoint(path.getPointAtLength(point).x,path.getPointAtLength(point).y).matrixTransform(matrix);if(p.x>=left&&p.x<=right&&p.y>=top&&p.y<=bottom){selectedEdges.add(path.dataset.edgeId);break;}}}state.selectedEdgeIds=[...selectedEdges];scheduleDrawEdges();}
  function endSelectionMarquee(){const drag=state.selectionMarquee;if(!drag)return;drag.box.remove();state.selectionMarquee=null;if(state.selectedNodeIds.length>1)setRunStatus('Đã chọn '+state.selectedNodeIds.length+' node. Giữ Shift rồi bấm cổng đầu vào của node đích để nối nhanh.','ok');}

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
    if(!nodeEl){const rect=$('#viewport').getBoundingClientRect(),menu=$('#canvasMenu');state.contextPoint={x:(e.clientX-rect.left-state.panX)/state.zoom,y:(e.clientY-rect.top-state.panY)/state.zoom};menu.innerHTML='';delete menu.dataset.nodeId;const title=document.createElement('div');title.className='menu-caption';title.textContent='Canvas';menu.appendChild(title);[...Object.entries({...WorkflowStudio.definitions,...WorkflowStory.definitions}).map(([type,def])=>['＋ '+def.title,'add:'+type]),['＋ Prompt','add:prompt'],['＋ Text note','add:text'],['＋ Negative Prompt','add:negativePrompt'],['＋ Video đầu vào','add:videoInput'],['＋ Tạo văn bản','add:generateText'],['＋ Image Input','add:imageInput'],['＋ References','add:references'],['＋ Generate Image','add:generateImage'],['＋ Generate Video','add:generateVideo'],['＋ Timeline','add:timeline'],['＋ Preview','add:preview'],['Save workflow','save'],['▶ Run workflow','run'],['Arrange nodes','arrange'],['Delete selected node','delete-selected'],['Remove all connections','disconnect-all']].forEach(([label,action])=>{const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.contextAction=action;menu.appendChild(button);});menu.classList.remove('hidden');menu.style.left=`${Math.min(e.clientX,innerWidth-230)}px`;menu.style.top=Math.max(8,Math.min(e.clientY,innerHeight-menu.getBoundingClientRect().height-8))+'px';return;}
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
    addAction('Nhân bản các node đã chọn · D','node-duplicate');if(['generateImage','generateVideo','generateText','preview'].includes(node.type))addAction('Xóa kết quả cũ','node-clear-output');addAction('Disconnect node','node-disconnect');addAction('Delete node','node-delete');
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
    if(action==='node-disconnect'){storyTouch(node.id);if(state.edges.some(edge=>edge.source===node.id||edge.target===node.id)){createUndoSnapshot('Disconnect node');state.edges=state.edges.filter(edge=>edge.source!==node.id&&edge.target!==node.id);render();saveState();setRunStatus('Node connections removed.','ok');}return;}
    const el=document.querySelector(`.node[data-id="${CSS.escape(node.id)}"]`);
    if(action==='node-focus-text'){el?.querySelector('textarea')?.focus();return;}
    if(action==='node-choose-image'){el?.querySelector('input[type="file"]')?.click();return;}
    if(action==='node-download-image'||action==='node-download-preview'){const url=node.data.asset?.url;if(url){const link=document.createElement('a');link.href=url;link.download=node.data.asset.name||'museflow-output';link.click();}else setRunStatus('This node has no output to download.','warn');return;}
    if(action==='node-clear-output'){clearNodeOutput(node);return;}
    if(action==='node-duplicate'){const ids=state.selectedNodeIds.includes(node.id)?state.selectedNodeIds:[node.id];const selected=new Set(ids);pasteNodeBundle({format:'workflow-node-bundle',version:1,nodes:state.nodes.filter(n=>selected.has(n.id)),edges:state.edges.filter(e=>selected.has(e.source)&&selected.has(e.target))});}

  }
  function arrangeNodes(){
    try{
      const order=topoOrder().filter(id=>!nodeById(id)?.data?.dockOnly);if(!order.length){setRunStatus('Chưa có node để sắp xếp.','warn');return;}
      const level=new Map(order.map(id=>[id,0])),parents=new Map(order.map(id=>[id,[]])),sizes=new Map();
      for(const id of order){const n=nodeById(id),el=document.querySelector(`.node[data-id="${CSS.escape(id)}"]`);sizes.set(id,{width:el?.offsetWidth||270,height:el?.offsetHeight||220});const incoming=getIncoming(id).map(e=>e.source).filter(source=>level.has(source));if(n.type==='generateVideo'&&n.data.continuity){const previous=timelinePredecessor(id);if(previous&&level.has(previous.id))incoming.push(previous.id);}parents.set(id,[...new Set(incoming)]);for(const source of incoming)level.set(id,Math.max(level.get(id),level.get(source)+1));}
      const columns=new Map();for(const id of order){const l=level.get(id);if(!columns.has(l))columns.set(l,[]);columns.get(l).push(id);}
      createUndoSnapshot('Arrange nodes');let x=70;
      for(const ids of columns.values()){
        const center=id=>{const sources=parents.get(id);return sources.length?sources.reduce((sum,source)=>sum+nodeById(source).y+sizes.get(source).height/2,0)/sources.length:0;};ids.sort((a,b)=>center(a)-center(b));let y=60;
        for(const id of ids){const n=nodeById(id),size=sizes.get(id);n.x=x;n.y=Math.max(y,parents.get(id).length?center(id)-size.height/2:60);y=n.y+size.height+60;}
        x+=Math.max(...ids.map(id=>sizes.get(id).width))+110;
      }
      for(const group of state.groups){const members=(group.nodeIds||[]).map(nodeById).filter(n=>n&&sizes.has(n.id));if(!members.length)continue;group.x=Math.min(...members.map(n=>n.x))-25;group.y=Math.min(...members.map(n=>n.y))-35;group.width=Math.max(...members.map(n=>n.x+sizes.get(n.id).width))-group.x+25;group.height=Math.max(...members.map(n=>n.y+sizes.get(n.id).height))-group.y+25;}
      render();fitCanvas();scheduleAutoSave();setRunStatus('Đã sắp xếp '+order.length+' node theo luồng kết nối. Ctrl+Z để hoàn tác.','ok');
    }catch(error){setRunStatus(error.message,'error');}
  }
  function runCanvasAction(action){
    if(action==='edge-delete'){const selectedEdge=state.edges.find(e=>e.id===$('#canvasMenu').dataset.edgeId);if(selectedEdge)storyTouch(selectedEdge.target);const menu=$('#canvasMenu'),edgeId=menu.dataset.edgeId;closeCanvasMenu();if(!edgeId)return;const before=state.edges.length;if(state.edges.some(edge=>edge.id===edgeId))createUndoSnapshot('Delete connection');state.edges=state.edges.filter(edge=>edge.id!==edgeId);delete menu.dataset.edgeId;if(state.edges.length!==before){render();saveState();setRunStatus('Connection deleted.','ok');}return;}
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
    if(node.type==='masterScript')return String(node.data.script||toolText(node,'text')||'');
    if(['actScript','partScript','segmentScript','storyPrompt'].includes(node.type))return String(node.data.text||'');
    if(node.type==='generateText'&&node.data.toolKind==='promptVariants'){const variants=WorkflowTools.variants(node.data.text);if(node.data.text?.trim()&&!variants.length)throw new Error('Chưa có biến thể tách biệt hợp lệ. Chạy lại node Biến thể prompt trước.');return variants[Math.min(variants.length-1,Math.max(0,Number(node.data.selectedVariant)||0))]||String(node.data.text||'');}
    if(node.type==='generateText'||['sceneSplit','qualityCheck','bundleSave','subtitles'].includes(node.type))return String(node.data.text||'');
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
  function syncSharedReferenceBoards(){
    const boards=state.nodes.filter(n=>n.type==='referenceBoard'&&n.data.shared&&WorkflowReferences.images(n.data).length);
    state.edges=state.edges.filter(edge=>!edge.sharedBoard||boards.some(b=>b.id===edge.source)&&!nodeById(edge.target)?.data.excludeSharedReferences&&!nodeById(edge.target)?.data.freezeSharedReferences);
    for(const board of boards)for(const target of state.nodes.filter(n=>['generateImage','generateVideo','generateText'].includes(n.type)&&!n.data.excludeSharedReferences&&!n.data.freezeSharedReferences))if(!state.edges.some(e=>e.source===board.id&&e.sourcePort==='image'&&e.target===target.id&&e.targetPort==='reference'))state.edges.push({id:uid('edge'),source:board.id,sourcePort:'image',target:target.id,targetPort:'reference',sharedBoard:true});
  }
  async function sharedReferenceSnapshots(){const images=[];for(const board of state.nodes.filter(n=>n.type==='referenceBoard'&&n.data.shared))for(const image of WorkflowReferences.images(board.data))images.push({...image,componentId:board.data.componentId+'-IMG'+image.slot,url:await blobAsDataUrlFromUrl(image.url)});return images;}
  function resolveReferences(nodeId){
    const references=[],seen=new Map();
    const add=(url,name,componentId,roles=[],instructions='')=>{if(!url)return;if(seen.has(url)){const old=seen.get(url);old.roles=[...new Set([...old.roles,...roles])];if(componentId!==old.componentId)old.aliases=[...new Set([...(old.aliases||[]),componentId])];if(instructions&&!old.instructions.includes(instructions))old.instructions+='\n'+instructions;return;}const ref={url,name:name||'Ảnh tham chiếu',componentId,roles,instructions};seen.set(url,ref);references.push(ref);};
    const visit=(source,sourcePort,visited=new Set(),roles=[])=>{
      if(!source||visited.has(source.id))return;const next=new Set(visited);next.add(source.id);
      if(source.type==='referenceBoard'){for(const image of WorkflowReferences.select(source.data,sourcePort))add(image.url,image.name,source.data.componentId+'-IMG'+image.slot,roles,image.notes||'');return;}
      if(['references','imageRoles','review'].includes(source.type)){
        for(const edge of getIncoming(source.id).filter(edge=>source.type!=='review'||edge.targetPort==='reference'))visit(nodeById(edge.source),edge.sourcePort,next,source.type==='imageRoles'?[...roles,({character:'Nhân vật',background:'Bối cảnh',clothing:'Trang phục',pose:'Tư thế'})[edge.targetPort]]:roles);return;
      }
      if(source.type==='characterLock'){add(source.data.lockedAsset?.url,'Ảnh nhân vật đã khóa',source.data.componentId,roles,resolveText(source.id));return;}
      if(sourcePort==='endFrame'){add(frameMatchesVideo(source)?source.data.endFrame.url:'',source.data?.endFrame?.name,source.data.componentId+'-END',roles);return;}
      if(source.type==='imageInput'){add(source.data.localDataUrl,'Ảnh đầu vào',source.data.componentId,roles,[source.data.libraryTag?'Ảnh này là @'+source.data.libraryTag+(source.data.storyReferenceLabel?' — '+source.data.storyReferenceLabel:'')+'.':'',source.data.libraryAlias?'Mã ảnh gốc: '+source.data.libraryAlias+'.':''].filter(Boolean).join(' '));return;}
      if(source.data.asset?.kind==='image')add(source.data.asset.url,source.data.asset.name,source.data.componentId,roles);
    };
    const node=nodeById(nodeId),previous=node?.type==='generateVideo'&&node.data.continuity?timelinePredecessor(nodeId):null;if(previous)add(previous.data.endFrame?.url,'Khung cuối cảnh trước',previous.data.componentId+'-END',['Khung mở đầu']);
    for(const edge of getIncoming(nodeId,'reference'))visit(nodeById(edge.source),edge.sourcePort);
    return references;
  }

  function topoOrder(preferredGenerationOrder=null,includedIds=null) {
    const nodes=includedIds?state.nodes.filter(node=>includedIds.has(node.id)):state.nodes;
    const indeg=new Map(nodes.map(n=>[n.id,0])), outgoing=new Map(nodes.map(n=>[n.id,[]]));
    const addOrderEdge=(from,to,allowSelf=false)=>{if((from===to&&!allowSelf)||!outgoing.has(from)||!outgoing.has(to)||outgoing.get(from).includes(to))return;outgoing.get(from).push(to);indeg.set(to,indeg.get(to)+1);};
    state.edges.forEach(e=>addOrderEdge(e.source,e.target,true));
    for(const node of state.nodes.filter(item=>item.type==='generateVideo'&&item.data?.continuity)){const previous=timelinePredecessor(node.id);if(previous)addOrderEdge(previous.id,node.id);}
    if(preferredGenerationOrder){const present=new Set(state.nodes.filter(item=>['generateImage','generateVideo','generateText'].includes(item.type)).map(item=>item.id)),ordered=[...new Set(preferredGenerationOrder.filter(id=>present.has(id)))];for(let i=1;i<ordered.length;i++)addOrderEdge(ordered[i-1],ordered[i]);}
    const timeline=state.nodes.find(item=>item.type==='timeline'),orderedVideos=(timeline?.data?.clipOrder||[]).filter(id=>nodeById(id)?.type==='generateVideo');
    for(const node of state.nodes)if(node.type==='generateVideo'&&!orderedVideos.includes(node.id))orderedVideos.push(node.id);
    const videoRank=new Map(orderedVideos.map((id,index)=>[id,index])),nodeRank=new Map(state.nodes.map((node,index)=>[node.id,index]));
    const priority=id=>{const item=nodeById(id);return item?.type==='generateVideo'?state.nodes.length+1+(videoRank.get(id)??nodeRank.get(id)):nodeRank.get(id)??0;};
    const q=nodes.filter(n=>indeg.get(n.id)===0).map(n=>n.id), out=[];
    while(q.length){q.sort((a,b)=>priority(a)-priority(b));const id=q.shift();out.push(id);for(const target of outgoing.get(id)){indeg.set(target,indeg.get(target)-1);if(indeg.get(target)===0)q.push(target);}}
    if(out.length!==nodes.length) throw new Error('Workflow contains a cycle. Remove the loop first.'); return out;
  }

  function requiredNodeOrder(targetId){
    const required=new Set();
    const visit=id=>{if(required.has(id))return;required.add(id);for(const edge of state.edges.filter(item=>item.target===id))visit(edge.source);const node=nodeById(id),previous=node?.type==='generateVideo'&&node.data?.continuity?timelinePredecessor(id):null;if(previous)visit(previous.id);};
    visit(targetId);return topoOrder(null,required);
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
    if(message.type==='MUSEFLOW_GENERATE'){const tab=chooseChat('muse',tabs,message.chatTarget||aiChatTargets.muse);await chrome.scripting.executeScript({target:{tabId:tab.id},files:['composer-controls.js','muse-bridge.js']});preferredMuseTabId=tab.id;const session=await waitTabIdle(tab.id,'MUSEFLOW_CHECK_SESSION',message.requestId,signal);if(session.bridgeProtocol!==undefined&&session.bridgeProtocol!==1)throw Error('Bộ nối Muse dùng giao thức chưa tương thích. Cập nhật tiện ích và tải lại tab Muse; chưa gửi prompt.');if(session.bridgeProtocol===undefined&&session.bridgeVersion&&session.bridgeVersion!==chrome.runtime.getManifest().version)throw Error('Bộ nối trên tab Muse là bản '+session.bridgeVersion+', khác bản extension. Tải lại tab Muse trước khi chạy; chưa gửi prompt.');aiTabs.set(message.requestId,tab.id);try{const reply=session.jobProtocol===1?await WorkflowMuseJobs.run(msg=>sendMuseTabMessage(tab.id,msg,signal),message,signal,{onProgress:text=>{const run=[...activeRuns.values()].find(r=>r.requestId===message.requestId);progressNode(nodeById(run?.activeNodeId),text);},onReconnect:()=>{const run=[...activeRuns.values()].find(r=>r.requestId===message.requestId);progressNode(nodeById(run?.activeNodeId),'Đang nối lại với Muse; không gửi lại prompt…');}}):await sendMuseTabMessage(tab.id,message,signal);if(reply?.ok&&reply.conversationUrl){const latest=chrome.tabs.get?await chrome.tabs.get(tab.id):(await chrome.tabs.query({url:WorkflowAI.providers.muse.urls})).find(item=>item.id===tab.id);if(latest&&chatKey(latest.url)===chatKey(reply.conversationUrl)){aiChatTabs.muse=[...(aiChatTabs.muse||[]).filter(item=>item.id!==tab.id),latest];const from=chatKey(tab.url),to=chatKey(reply.conversationUrl);if(new URL(from).origin===new URL(to).origin&&from!==to){const aliases=museChatTransitions.get(tab.id)||new Map();for(const [key,value] of aliases)if(value===from)aliases.set(key,to);aliases.set(from,to);museChatTransitions.set(tab.id,aliases);}return {...reply,chatTarget:{tabId:tab.id,url:to}};}}return reply;}catch(error){if(/message channel closed|message port closed|asynchronous response|receiving end does not exist/i.test(error.message||''))throw Error('Kênh kết nối Muse đã đóng. Không gửi lại prompt. Tải video đã tạo và dùng Công cụ → Nhập video kết quả; tải lại tab Muse để dùng bộ nối mới ở lượt sau.');throw error;}finally{aiTabs.delete(message.requestId);}}
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

  function clearStoppedRunOutput(run){const current=nodeById(run.activeNodeId);if(current&&nodeClaims.get(current.id)?.run===run&&['generateImage','generateVideo'].includes(current.type)){current.data.asset=null;current.data.endFrame=null;delete current.data.storyApprovedAssetId;current.data.status='stopped';syncPreviewOutputs();}}
  function stopGeneration(nodeId=state.activeGenerationId){
    const run=runForNode(nodeId);if(!run||run.controller.signal.aborted)return;
    run.controller.abort();clearStoppedRunOutput(run);void sendMuseStop(run.requestId);setRunStatus('Đã dừng nhánh của node '+nodeId,'warn');render();
  }
  function stopAllRuns(){autoPlan?.controller.abort();for(const run of activeRuns.values()){run.controller.abort();clearStoppedRunOutput(run);void sendMuseStop(run.requestId);}setRunStatus('Đang dừng tất cả các nhánh…','warn');}

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

  async function execute(targetId=null,{again=false,generationOrder=null,sinceSequence=completionSequence,batchTask=false}={}) {
    if(targetId&&!batchTask&&WorkflowBatchManager.nodeBusy(targetId)){setRunStatus('Node đã nằm trong hàng đợi. Dừng hoặc chạy từ Hàng đợi để tránh gửi trùng.','warn');return;}
    if(!targetId&&activeRuns.size){setRunStatus('Có nhánh đang chạy. Bấm Chạy trên node độc lập để chạy thêm.','warn');return;}
    if(targetId&&nodeById(targetId)?.data.storyMasterId){const issues=await storyPreflight(targetId);if(issues.length){WorkflowStoryDashboard.showIssues(targetId,issues);setRunStatus('Cần kiểm tra '+issues.length+' mục trước khi chạy.','warn');return;}}
    const freshTarget=nodeById(targetId);if(freshTarget&&['generateImage','generateVideo','generateText'].includes(freshTarget.type)){if(runForNode(targetId)){setRunStatus('Node đang chạy. Dừng trước khi chạy lại.','warn');return;}resetNodeOutput(freshTarget);render();}
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
      const order=targetId?requiredNodeOrder(targetId).filter(id=>{const prerequisite=nodeById(id);return id===targetId||!(['generateImage','generateVideo','generateText'].includes(prerequisite?.type)||WorkflowStudio.effects.has(prerequisite?.type))||runForNode(id)||autoPlan?.ids.has(id)&&prerequisite.data.status==='queued'||prerequisite.data?.storyDirty||!(prerequisite.type==='generateText'?prerequisite.data?.text?.trim():prerequisite.data?.asset?.url);}):topoOrder(generationOrder).filter(id=>{const node=nodeById(id);return !selectedGenerations||!['generateImage','generateVideo','generateText'].includes(node?.type)||selectedGenerations.has(id);});
      for(const n of state.nodes){
        if(['imageInput','videoInput'].includes(n.type)&&n.data.localDataUrl)n.data.asset={id:n.data.asset?.id||uid('asset'),kind:n.type==='videoInput'?'video':'image',url:n.data.localDataUrl,sourceNodeId:n.id};
      }
      let generationStep=0;
      const totalGenerations=order.filter(id=>['generateImage','generateVideo','generateText'].includes(nodeById(id)?.type)).length;
      for(const id of order){
        if(!batchTask&&WorkflowBatchManager.nodeBusy(id))throw Error('Node đang nằm trong Hàng đợi. Chạy từ Hàng đợi hoặc dừng tác vụ trước.');
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
            if(n.type==='masterScript'&&storyPlanning.has(n.id))await planMasterStory(n,abortController.signal);
            if(WorkflowStudio.effects.has(n.type))await executeStudio(n,abortController.signal);
            if(n.type==='characterLock'&&!n.data.lockedAsset)throw new Error('Node nhân vật chưa khóa ảnh chuẩn.');
            if(n.type==='review')await reviewTool(n,abortController.signal);
            if(n.type==='qualityCheck')await checkTool(n,abortController.signal);
            if(n.type==='bundleSave')await saveTool(n,abortController.signal);
            if(n.type==='sceneSplit'){n.data.text=toolText(n)||n.data.text||'';n.data.report=`Đã đọc ${parseSceneScript(n.data.text).length} cảnh. Bấm Tạo các node cảnh để tạo, sau đó chạy các node mới.`;}
            if(n.data.status==='running')n.data.status='success';render();continue;
          }catch(error){n.data.status=error.name==='AbortError'?'stopped':'error';n.data.error=error.message;render();throw error;}
        }
        if(n.type==='imageResize'){
          const source=sourceFor(getIncoming(n.id,'image')[0]);const inputEdge=getIncoming(n.id,'image')[0],boardImage=source?.type==='referenceBoard'?WorkflowReferences.select(source.data,inputEdge?.sourcePort)[0]:null;const url=boardImage?.url||source?.data?.localDataUrl||source?.data?.asset?.url;
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
            if(abortController.signal.aborted)throw new DOMException('Đã dừng.','AbortError');n.data.text=reply.text;if(n.data.toolKind==='promptVariants'&&!WorkflowTools.variants(reply.text).length)throw new Error('AI chưa trả các biến thể tách biệt. Xem kết quả và chạy lại; chưa chuyển sang node tạo ảnh.');n.data.status='success';n.data.storyDirty=false;if(n.data.storyMasterId)storyDirtyAfter(n.id);render();continue;
          }catch(error){n.data.status=abortController.signal.aborted?'stopped':'error';n.data.error=error.message;render();throw error;}
        }
        if(['generateImage','generateVideo','generateText'].includes(n.type)){
          const isVideo=n.type==='generateVideo';
          if(isVideo&&n.data.storyMasterId){const approval=storyNeedsApproval(n);if(approval)throw Error(approval);}
          if(!isVideo)delete n.data.storyApprovedAssetId;
          generationStep++;
          const prompt=resolvePrompt(n.id); if(!String(prompt).trim()) throw new Error(`${nodeDefs[n.type].title} ${n.id}: connect a Prompt, Text Append, or Text Merge node first.`);
          const negativePrompt=resolveNegativePrompt(n.id);
          const continuityPrevious=isVideo&&n.data.continuity?timelinePredecessor(n.id):null,continuityStartFrame=continuityPrevious?.data?.endFrame?.url?continuityPrevious.data.endFrame:null;
          if(isVideo&&n.data.continuity&&(!continuityStartFrame||continuityPrevious?.data.storyDirty))throw new Error(`End-frame continuity for ${n.id} needs the previous Timeline clip to be generated successfully with an extractable final frame. Put clips in order and run the previous clip first.`);
          for(const edge of getIncoming(n.id,'reference').filter(e=>e.sourcePort==='endFrame')){const source=sourceFor(edge);if(source?.data.asset?.url&&!frameMatchesVideo(source)&&!source.data.storyDirty)await refreshEndFrame(source);if(!frameMatchesVideo(source)||source.data.storyDirty)throw Error('Chưa có khung cuối hợp lệ từ '+(source?.data.componentId||edge.source)+'. Chạy video nguồn hoặc trích lại khung cuối trước.');}
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
            let url=isVideo?reply.url:await persistImage(reply.url);
            if(!url)throw new Error(`Muse.ai returned an empty ${kind} attachment.`);
            let intrinsic=await mediaDimensions(url,isVideo?'video':'image');
            const actualRatio=intrinsic.width&&intrinsic.height?intrinsic.width/intrinsic.height:0;
            const expectedRatio=ratioValue(n.data.size);
            let sizeMismatch=actualRatio&&Math.abs(Math.log(actualRatio/expectedRatio))>0.09;
            let framingNote='';
            if(sizeMismatch&&isVideo){
              const sourceWidth=intrinsic.width,sourceHeight=intrinsic.height;progressNode(n,`AI trả ${sourceWidth} × ${sourceHeight}; đang đặt vào khung ${n.data.size}, giữ nguyên hình…`);
              const framed=await WorkflowStudio.process('frameFit',{videos:[{url,kind:'video'}],settings:{size:n.data.size}},abortController.signal,text=>progressNode(n,text));url=await blobAsDataUrl(framed.blob);intrinsic=await mediaDimensions(url,'video');sizeMismatch=Math.abs(Math.log((intrinsic.width/intrinsic.height)/expectedRatio))>.09;if(sizeMismatch)throw Error('Chưa chuyển được video về tỷ lệ yêu cầu.');framingNote=`AI trả ${sourceWidth} × ${sourceHeight}; đã thêm viền đệm để xuất ${n.data.size}, giữ toàn bộ hình gốc.`;
            }
            n.data.asset={id:uid('asset'),kind,url,name:`${isVideo?'Video':'Image'} ${n.id}`,sourceNodeId:n.id,width:intrinsic.width,height:intrinsic.height,requestedSize:n.data.size,sizeMismatch,actualDuration:intrinsic.duration||null}; n.data.status='success';
            if(framingNote)n.data.error=framingNote;
            if(isVideo&&intrinsic.duration&&Math.abs(intrinsic.duration-Number(n.data.duration))>1)n.data.error=[framingNote,`Yêu cầu ${n.data.duration}s, AI trả về ${intrinsic.duration.toFixed(1)}s. Thời lượng clip phụ thuộc dịch vụ.`].filter(Boolean).join(' ');
            if(isVideo){const frame=await extractVideoEndFrame(url);if(abortController.signal.aborted)throw new DOMException('Đã dừng.','AbortError');if(frame)frame.sourceAssetId=n.data.asset.id;n.data.endFrame=frame;}
            if(abortController.signal.aborted)throw new DOMException('Đã dừng.','AbortError');
            if(sizeMismatch)n.data.error=`Yêu cầu ${n.data.size}, AI trả ${intrinsic.width}×${intrinsic.height}. Kết quả được giữ lại với tỷ lệ thực tế.`;
            n.data.storyDirty=false;storyDirtyAfter(n.id,true);state.edges.filter(e=>e.source===n.id).forEach(e=>{const target=nodeById(e.target);if(target?.type==='preview')target.data.asset=e.sourcePort==='endFrame'?n.data.endFrame:n.data.asset;});render();
          }catch(err){n.data.asset=null;n.data.endFrame=null;syncPreviewOutputs();if(err?.name==='AbortError'||abortController.signal.aborted){n.data.status='stopped';n.data.error='Generation stopped by user.';render();throw new DOMException('Generation stopped by user.','AbortError');}n.data.status='error';n.data.error=err?.message||String(err);render();throw err;}
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
  function mediaDb(){if(!mediaDbPromise)mediaDbPromise=new Promise((resolve,reject)=>{const request=indexedDB.open('museflow-media',1);request.onupgradeneeded=()=>request.result.createObjectStore('assets');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error('Could not open local media storage.'));}).catch(error=>{mediaDbPromise=null;throw error;});return mediaDbPromise;}
  async function putMedia(key,blob){const db=await mediaDb();return new Promise((resolve,reject)=>{const tx=db.transaction('assets','readwrite');tx.objectStore('assets').put(blob,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('Could not save a media file locally.'));tx.onabort=()=>reject(tx.error||new Error('Media storage transaction was cancelled.'));});}
  async function getMedia(key){const db=await mediaDb();return new Promise((resolve,reject)=>{const request=db.transaction('assets','readonly').objectStore('assets').get(key);request.onsuccess=()=>resolve(request.result||null);request.onerror=()=>reject(request.error||new Error('Could not read a saved media file.'));});}
  const idbMediaPrefix='museflow-idb:';
  async function dehydrateMediaUrl(url,key){if(!url||url.startsWith(idbMediaPrefix)||!(/^(?:data:|blob:)/i).test(url))return url;const response=await fetch(url);const blob=await response.blob();if(!blob.size)throw new Error('A saved image or video is empty.');await putMedia(key,blob);return idbMediaPrefix+encodeURIComponent(key);}
  let autoSaveTimer=0,workflowSaveQueue=Promise.resolve(),workflowSaveBlocked=true;
  async function saveWorkflowSnapshot(){const snapshot=structuredClone({nodes:state.nodes,edges:state.edges,groups:state.groups,notes:state.notes,settings:state.settings});for(const node of snapshot.nodes){const data=node.data||{};if(data.localDataUrl)data.localDataUrl=await dehydrateMediaUrl(data.localDataUrl,`input:${node.id}`);for(const image of data.referenceImages||[])image.url=await dehydrateMediaUrl(image.url,`reference:${node.id}:${image.id}`);for(const field of ['asset','endFrame','lockedAsset']){const media=data[field];if(media?.url)media.url=await dehydrateMediaUrl(media.url,`${field}:${field==='lockedAsset'?node.id:media.id||node.id}`);}}await chrome.storage.local.set({museflow:snapshot});}
  function queueWorkflowSave({allowRecoveryWrite=false}={}){workflowSaveQueue=workflowSaveQueue.catch(()=>{}).then(async()=>{if(workflowSaveBlocked&&!allowRecoveryWrite)throw new Error('Bản lưu trước đang được bảo vệ sau lỗi tải dữ liệu. Tải lại để thử khôi phục, hoặc bấm Lưu để xác nhận thay thế bằng canvas hiện tại.');await saveWorkflowSnapshot();if(allowRecoveryWrite)workflowSaveBlocked=false;});return workflowSaveQueue;}
  function scheduleAutoSave(){clearTimeout(autoSaveTimer);autoSaveTimer=setTimeout(()=>{queueWorkflowSave().catch(error=>{if(runStatus.className!=='error')setRunStatus(`Auto-save failed: ${error?.message||String(error)}`,'error');});},650);}
  async function hydrateMediaUrl(url,cache){if(!url?.startsWith(idbMediaPrefix))return url;const key=decodeURIComponent(url.slice(idbMediaPrefix.length));if(!cache.has(key)){const blob=await getMedia(key);if(!blob)throw new Error('Không tìm thấy tệp media đã lưu: '+key);cache.set(key,URL.createObjectURL(blob));}return cache.get(key);}
  async function hydrateWorkflowMedia(){const cache=new Map(),changes=[];try{for(const node of state.nodes){const data=node.data||{};if(data.localDataUrl)changes.push([data,'localDataUrl',await hydrateMediaUrl(data.localDataUrl,cache)]);for(const image of data.referenceImages||[])changes.push([image,'url',await hydrateMediaUrl(image.url,cache)]);for(const field of ['asset','endFrame','lockedAsset'])if(data[field]?.url)changes.push([data[field],'url',await hydrateMediaUrl(data[field].url,cache)]);}for(const [target,key,value] of changes)target[key]=value;}catch(error){for(const url of cache.values())URL.revokeObjectURL(url);throw error;}}
  async function saveState(){clearTimeout(autoSaveTimer);if(workflowSaveBlocked&&!window.confirm('Không tải được đầy đủ bản lưu trước. Lưu canvas hiện tại sẽ thay thế bản đó. Bạn có chắc muốn tiếp tục?'))return;try{await queueWorkflowSave({allowRecoveryWrite:true});setRunStatus('Đã lưu.','ok');}catch(error){setRunStatus(`Could not save workflow: ${error?.message||String(error)}`,'error');}}
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
      for(const node of workflow.nodes){const data=node.data||{};if(data.localDataUrl)data.localDataUrl=await packageUrl(data.localDataUrl);for(const image of data.referenceImages||[])image.url=await packageUrl(image.url);for(const field of ['asset','endFrame','lockedAsset'])if(data[field]?.url)data[field].url=await packageUrl(data[field].url);}
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
      await hydrateWorkflowMedia();normalizeSavedGraph();state.selectedNodeIds=[];state.selectedNodeId=null;state.selectedEdgeIds=[];syncSettingsUI();render();await queueWorkflowSave({allowRecoveryWrite:true});
      setRunStatus(`Workflow imported: ${file.name}`,'ok');
    }catch(error){state.nodes=previous.nodes;state.edges=previous.edges;state.groups=previous.groups||[];state.notes=previous.notes||[];state.settings=previous.settings;render();setRunStatus(`Could not import workflow: ${error?.message||String(error)}`,'error');}
  }
  async function loadState(){
    await studioTemplatesReady;let loaded=false;
    try{
      const got=await chrome.storage.local.get('museflow');
      if(got.museflow){
        if(!Array.isArray(got.museflow.nodes)||!Array.isArray(got.museflow.edges))throw new Error('Bản lưu không có cấu trúc workflow hợp lệ.');
        state.nodes=got.museflow.nodes;state.edges=got.museflow.edges;state.groups=Array.isArray(got.museflow.groups)?got.museflow.groups:[];state.notes=Array.isArray(got.museflow.notes)?got.museflow.notes:[];state.settings=got.museflow.settings||{};
      }else{const s=starter();state.nodes=s.nodes;state.edges=s.edges;}
      await hydrateWorkflowMedia();normalizeSavedGraph();loaded=true;workflowSaveBlocked=false;
    }catch(error){
      workflowSaveBlocked=true;setRunStatus(`Không tải được đầy đủ workflow: ${error.message}. Bản lưu trước chưa bị thay thế. Tải lại để thử khôi phục hoặc nhập bản sao lưu JSON.`, 'error');
      // Keep a graph that was read successfully, including unresolved media IDs.
      // When storage itself is unreadable, use an empty, unsaved canvas.
      try{normalizeSavedGraph();}catch{state.nodes=[];state.edges=[];state.groups=[];state.notes=[];}
    }
    syncSettingsUI();render();syncTimelineDock();
    if(loaded)try{clearTimeout(autoSaveTimer);await queueWorkflowSave();}catch(error){setRunStatus(`Workflow is open, but media migration failed: ${error?.message||String(error)}`,'warn');}
  }
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
  WorkflowLibrary.init({getSelectedPrompt:()=>{const n=nodeById(state.selectedNodeId);return n?{name:n.data.customName||nodeDefs[n.type].title,content:resolveText(n.id)}:null;},onUse:(text,name)=>{if(state.isRunning)throw Error('Dừng workflow trước khi thêm node.');addNode('prompt');const n=state.nodes.at(-1);n.data.text=text;n.data.customName=name;render();scheduleAutoSave();}});
  $('#clearPromptsBtn').onclick=()=>{try{clearCanvasPrompts();}catch(error){setRunStatus(error.message,'error');}};
  $('#masterScriptBtn').onclick=()=>addNode('masterScript');
  $('#arrangeNodesBtn').onclick=arrangeNodes;
  $('#duplicateSelectionBtn').onclick=()=>{try{pasteNodeBundle(selectedNodeBundle());}catch(error){setRunStatus(error.message,'warn');}};
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
  $('#viewport').addEventListener('wheel',event=>{if(!event.ctrlKey&&!event.metaKey){for(let el=event.target;el&&el!==event.currentTarget;el=el.parentElement){const style=getComputedStyle(el);if(/auto|scroll/.test(style.overflowY+' '+style.overflowX))return;}}event.preventDefault();const factor=Math.exp(-event.deltaY*.0015);zoomAt(event.clientX,event.clientY,factor);},{passive:false});
  $('#viewport').addEventListener('pointerdown',event=>{const panGesture=event.button===1||state.spaceDown||state.handMode;if(panGesture&&!event.target.closest('button,input,label,textarea,select,video,a,.canvas-tools,.canvas-note'))startPan(event);});
  $('#viewport').addEventListener('pointerdown',startSelectionMarquee);
  document.addEventListener('pointerdown',event=>{const stop=event.target.closest('[data-stop-generation]');if(!stop)return;if(event.pointerType==='mouse'&&event.detail>1)return;event.preventDefault();event.stopImmediatePropagation();stopGeneration(stop.dataset.stopGeneration);},true);
  window.addEventListener('pointermove',movePan);window.addEventListener('pointerup',endPan);window.addEventListener('pointercancel',endPan);
  $('#handTool').onclick=()=>{state.handMode=!state.handMode;applyCanvasTransform();$('#handTool').classList.toggle('active',state.handMode);};
  $('#groupTool').onclick=()=>setGroupDrawMode(!state.groupDrawMode);
  $('#referenceBoardBtn').onclick=()=>{const bounds=$('#viewport').getBoundingClientRect();addNode('referenceBoard',Math.max(30,(40-state.panX)/state.zoom),Math.max(40,(bounds.height*.15-state.panY)/state.zoom));};
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
  const canvasClipboardTarget=target=>!isTextEntry(target)&&!target.closest?.('dialog,[role="dialog"],.modal,header,nav,.toolbar-popover,.canvas-tools,#canvasMenu,#addNodeMenu');
  document.addEventListener('copy',event=>{if(!canvasClipboardTarget(event.target)||getSelection()?.toString())return;const bundle=selectedNodeBundle();if(!bundle.nodes.length)return;event.clipboardData?.setData('text/plain',JSON.stringify(bundle));event.preventDefault();setRunStatus('Đã sao chép '+bundle.nodes.length+' node. Dán bằng ⌘V trên Mac hoặc Ctrl+V.','ok');});
  document.addEventListener('paste',event=>{if(!canvasClipboardTarget(event.target))return;let bundle;try{bundle=JSON.parse(event.clipboardData?.getData('text/plain')||'null');}catch{return;}if(bundle?.format!=='workflow-node-bundle')return;event.preventDefault();try{pasteNodeBundle(bundle);}catch(error){setRunStatus(error.message,'error');}});
  document.addEventListener('keydown',e=>{
    if(e.target.closest?.('#flowStudioDialog,#storyDashboardDialog,#batchManagerDialog,#storyReferencesDialog'))return;
    const storyBody=e.target.closest?.('.story-node-body');if(storyBody&&!isTextEntry(e.target)&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','PageDown','PageUp','Home','End'].includes(e.key)){e.preventDefault();const step=e.key.startsWith('Page')?storyBody.clientHeight*.8:40;if(e.key==='Home')storyBody.scrollTop=0;else if(e.key==='End')storyBody.scrollTop=storyBody.scrollHeight;else if(['ArrowUp','ArrowDown','PageUp','PageDown'].includes(e.key))storyBody.scrollTop+=/Up$/.test(e.key)?-step:step;else storyBody.scrollLeft+=e.key==='ArrowLeft'?-step:step;return;}
    if(!e.repeat&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&canvasClipboardTarget(e.target)&&e.key.toLowerCase()==='d'){e.preventDefault();try{pasteNodeBundle(selectedNodeBundle());}catch(error){setRunStatus(error.message,'warn');}return;}
    if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&canvasClipboardTarget(e.target)&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&state.selectedNodeIds.length){e.preventDefault();if(!e.repeat)createUndoSnapshot('Di chuyển các node');const step=e.shiftKey?50:10;for(const id of state.selectedNodeIds){const n=nodeById(id);if(n){n.x+=e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0;n.y+=e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0;}}for(const g of state.groups.filter(g=>g.nodeIds.length&&g.nodeIds.every(id=>state.selectedNodeIds.includes(id)))){g.x+=e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0;g.y+=e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0;}render();scheduleAutoSave();return;}
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
    if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&e.key.toLowerCase()==='h'&&!isTextEntry(e.target)){state.handMode=!state.handMode;$('#handTool').classList.toggle('active',state.handMode);applyCanvasTransform();}
    if(!e.repeat&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!isTextEntry(e.target)&&e.key.toLowerCase()==='g'){e.preventDefault();setGroupDrawMode(!state.groupDrawMode);}
    if(!e.repeat&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!isTextEntry(e.target)&&e.key.toLowerCase()==='t'){e.preventDefault();setGroupDrawMode(false);const rect=$('#viewport').getBoundingClientRect();addTextNote((rect.width/2-state.panX)/state.zoom-130,(rect.height/2-state.panY)/state.zoom-80);}
  },true);
  document.addEventListener('keyup',e=>{if(e.target.closest?.('#flowStudioDialog,#storyDashboardDialog,#batchManagerDialog,#storyReferencesDialog'))return;if(e.key.toLowerCase()==='z'&&pendingNativeUndoTarget===e.target)pendingNativeUndoTarget=null;if(e.code==='Space'&&!isTextEntry(e.target)){e.preventDefault();state.spaceDown=false;applyCanvasTransform();}},true);
  window.addEventListener('blur',()=>{state.spaceDown=false;endPan();endSelectionMarquee();cancelGroupMarquee();applyCanvasTransform();});

  // Keep the session indicator fresh when Muse is opened/reloaded after the canvas.
  chrome.tabs.onUpdated.addListener((tabId,changeInfo,tab)=>{
    if(changeInfo.status==='complete'&&/^https:\/\/(?:[^/]+\.)?muse\.ai\//i.test(tab.url||''))testMuseSession(tabId);
  });
  chrome.tabs.onCreated.addListener(tab=>{
    if(/^https:\/\/(?:[^/]+\.)?muse\.ai\//i.test(tab.url||''))setTimeout(()=>testMuseSession(tab.id),1200);
  });

  const flowApi={
    refreshChats:()=>refreshChatTabs(),
    chatControl:(card,changed)=>{const n=nodeById(card.nodeId),provider=n.data.provider||'muse';if(!WorkflowAI.providers[provider]?.urls)return null;const wrap=document.createElement('div');wrap.className='flow-chat-control';const label=document.createElement('label');label.textContent='Luồng AI · cửa sổ / cuộc trò chuyện';label.append(chatSelector(provider,n.data.chatTarget||aiChatTargets[provider],value=>{n.data.chatTarget=value;scheduleAutoSave();updateChatUsageLabels();},n.id));wrap.append(label);const refresh=document.createElement('button');refresh.type='button';refresh.textContent='↻ Làm mới cửa sổ';refresh.onclick=()=>void refreshChatTabs().then(()=>{render();changed();}).catch(e=>setRunStatus(e.message,'error'));wrap.append(refresh);return wrap;},
    master:value=>{if(value===undefined)return state.settings.flowMaster||'';state.settings.flowMaster=value;scheduleAutoSave();},
    cards:()=>Array.isArray(state.settings.flowCards)?state.settings.flowCards.filter(c=>c&&nodeById(c.nodeId)&&nodeById(c.promptId)).slice(0,200):[],
    create:(prompt,options)=>{const refs=options.referenceSnapshots||WorkflowBatchManager.resolveTags(prompt);const clean={...options};delete clean.referenceSnapshots;delete clean.sharedReferenceSnapshots;if(options.referenceSnapshots)clean.freezeSharedReferences=true;const cards=Array.isArray(state.settings.flowCards)?state.settings.flowCards.filter(c=>c&&nodeById(c.nodeId)&&nodeById(c.promptId)):[];if(cards.length>=200)throw Error('Canvas tối đa 200 thẻ; xóa các thẻ cũ trước.');if(refs.length>8)throw Error('Mỗi tác vụ tối đa 8 ảnh tham chiếu.');createUndoSnapshot('Thêm thẻ Flow Studio');const id=uid('card'),y=Math.max(40,...state.nodes.map(n=>n.y+650)),p=makeNode('prompt',40,y),n=makeNode(clean.mediaType==='video'?'generateVideo':'generateImage',380,y);p.data={text:prompt,flowCardId:id};n.data={...n.data,...clean,flowCardId:id,customName:'Flow · Thẻ '+(cards.length+1),status:'idle'};state.nodes.push(p,n);state.edges.push({id:uid('edge'),source:p.id,sourcePort:'text',target:n.id,targetPort:'prompt'});for(const [i,ref] of refs.entries()){const input=makeNode('imageInput',40-i*30,y+230+i*80);input.data={...input.data,localDataUrl:ref.url,fileName:ref.name,libraryTag:ref.tag,flowCardId:id};state.nodes.push(input);connectReferenceNode(input,n);}const card={id,nodeId:n.id,promptId:p.id};state.settings.flowCards=[...cards,card];render();scheduleAutoSave();return card;},
    read:card=>{const n=nodeById(card.nodeId),p=nodeById(card.promptId);if(!n||!p)return null;return {...n.data,mediaType:n.type==='generateVideo'?'video':'image',prompt:p.data.text||'',references:getIncoming(n.id,'reference').map(e=>nodeById(e.source)).filter(Boolean).map(ref=>({id:ref.id,url:ref.data.localDataUrl||ref.data.asset?.url,name:ref.data.fileName})).filter(ref=>ref.url)};},
    update:(card,changes)=>{const n=nodeById(card.nodeId),p=nodeById(card.promptId);if(runForNode(n.id))throw Error('Dừng thẻ trước khi chỉnh.');if(changes.prompt!==undefined)p.data.text=changes.prompt;else{createUndoSnapshot('Đổi thiết lập thẻ');if(changes.mediaType)n.type=changes.mediaType==='video'?'generateVideo':'generateImage';for(const key of ['provider','size','duration'])if(changes[key]!==undefined)n.data[key]=changes[key];if(changes.provider!==undefined||changes.mediaType!==undefined){delete n.data.chatTarget;n.data.apiModel='';}n.data.status='idle';n.data.error='';}n.data.status='idle';n.data.error='';n.data.progress='';n.data.storyDirty=true;storyDirtyAfter(n.id,true);render();scheduleAutoSave();},
    references:async(card,files)=>{const n=nodeById(card.nodeId);if(runForNode(n.id))throw Error('Dừng thẻ trước khi thêm ảnh.');if(!files.length)return;const existing=getIncoming(n.id,'reference');if(existing.length+files.length>8||files.some(f=>!f.type.startsWith('image/'))||files.reduce((s,f)=>s+f.size,0)+existing.reduce((s,e)=>s+(nodeById(e.source)?.data.localDataUrl?.length||0)*.75,0)>20*1024*1024)throw Error('Mỗi thẻ tối đa 8 ảnh, tổng 20 MB.');const before=new Set(state.nodes.map(n=>n.id));await importMediaFiles(files,{node:n,port:nodeDefs[n.type].inputs.find(p=>p.id==='reference')});for(const ref of state.nodes.filter(n=>!before.has(n.id)))ref.data.flowCardId=card.id;scheduleAutoSave();},
    removeReference:(card,id)=>{if(runForNode(card.nodeId))throw Error('Dừng thẻ trước khi xóa ảnh.');removeNode(id);},
    remove:card=>{if(runForNode(card.nodeId))throw Error('Dừng thẻ trước khi xóa.');createUndoSnapshot('Xóa thẻ Flow Studio');const owned=new Set([card.nodeId,card.promptId,...getIncoming(card.nodeId,'reference').map(e=>e.source).filter(id=>nodeById(id)?.data.flowCardId===card.id&&!state.edges.some(e=>e.source===id&&e.target!==card.nodeId))]);owned.forEach(id=>storyDirtyAfter(id,true));state.nodes=state.nodes.filter(n=>!owned.has(n.id));state.edges=state.edges.filter(e=>!owned.has(e.source)&&!owned.has(e.target));state.settings.flowCards=state.settings.flowCards.filter(c=>c.id!==card.id);state.selectedNodeIds=state.selectedNodeIds.filter(id=>!owned.has(id));if(owned.has(state.selectedNodeId))state.selectedNodeId=null;render();scheduleAutoSave();},
    move:(from,to)=>{const cards=state.settings.flowCards||[],start=cards.findIndex(c=>c.id===from),end=cards.findIndex(c=>c.id===to);if(start<0||end<0)return;createUndoSnapshot('Sắp xếp thẻ Flow Studio');cards.splice(end,0,cards.splice(start,1)[0]);scheduleAutoSave();},
    run:card=>WorkflowBatchManager.runCard(card),busy:card=>!!runForNode(card.nodeId)||WorkflowBatchManager.cardBusy(card),stop:card=>WorkflowBatchManager.stopCard(card),
    download:card=>{const n=nodeById(card.nodeId);if(n.data.storyDirty)throw Error('Prompt đã đổi; tạo lại trước khi tải.');const a=document.createElement('a');a.href=n.data.asset.url;a.download=WorkflowTools.safeName(n.data.customName)+(n.type==='generateVideo'?'.mp4':'.png');a.click();},
    focus:card=>{selectNode(card.nodeId);storyFocus(nodeById(card.nodeId));}
  };
  WorkflowFlowStudio.init(flowApi);
  async function removeBatchGroups(jobs,remaining=[]){
    const candidates=new Map(jobs.filter(j=>j.card).map(j=>[j.card.id,j.card])),protectedCards=new Set(remaining.map(j=>j.card?.id).filter(Boolean)),ids=new Set();
    for(const [id,card] of candidates){if(protectedCards.has(id))continue;if(runForNode(card.nodeId))throw Error('Nhóm node đang chạy, chưa thể dọn.');ids.add(card.nodeId);ids.add(card.promptId);for(const n of state.nodes)if(n.data.flowCardId===id)ids.add(n.id);}
    // Keep a node when its output is still used outside this cleanup, including
    // the complete chain feeding an external consumer or another queued job.
    let changed=true;while(changed){changed=false;for(const id of [...ids])if(state.edges.some(e=>e.source===id&&!ids.has(e.target))){ids.delete(id);changed=true;}}
    const removedCards=[...candidates].filter(([,card])=>ids.has(card.nodeId)).map(([id])=>id),existing=new Set(state.nodes.map(n=>n.id));if(![...ids].some(id=>existing.has(id)))return {removedCards:0,keptCards:candidates.size};
    createUndoSnapshot('Dọn nhóm node đã hoàn tất');state.nodes=state.nodes.filter(n=>!ids.has(n.id));state.edges=state.edges.filter(e=>!ids.has(e.source)&&!ids.has(e.target));state.settings.flowCards=(state.settings.flowCards||[]).filter(c=>!removedCards.includes(c.id));state.selectedNodeIds=state.selectedNodeIds.filter(id=>!ids.has(id));if(ids.has(state.selectedNodeId))state.selectedNodeId=null;for(const group of state.groups)group.nodeIds=group.nodeIds.filter(id=>!ids.has(id));render();await queueWorkflowSave();return {removedCards:removedCards.length,keptCards:candidates.size-removedCards.length};
  }
  const batchAssetCache=new Map(),batchAssetLoading=new Set();
  async function batchAsset(job){if(!job.asset?.url)throw Error('Tác vụ chưa có tệp kết quả.');const url=await hydrateMediaUrl(job.asset.url,batchAssetCache);if(!url)throw Error('Không còn tệp kết quả trong bộ nhớ trình duyệt.');return {...job.asset,url};}
  async function commitCreativeNodes(nodes,edges,label){
    await workflowReady;if(state.isRunning)throw Error('Dừng workflow trước khi thêm quy trình.');if(state.nodes.length+nodes.length>1000)throw Error('Canvas tối đa 1.000 node; tách sang dự án khác.');createUndoSnapshot(label);const before={nodes:state.nodes,edges:state.edges};state.nodes=[...state.nodes,...nodes];state.edges=[...state.edges,...edges];try{render();await queueWorkflowSave();fitCanvas();return nodes.map(n=>n.id);}catch(error){state.nodes=before.nodes;state.edges=before.edges;render();throw error;}
  }
  WorkflowCreative.init({
    parseScenes:parseSceneScript,
    createScenes:async(rows,providers)=>{const nodes=[],edges=[],baseY=Math.max(100,...state.nodes.map(n=>n.y+500));
      for(const [index,row] of rows.entries()){let image;const y=baseY+index*480;for(const [kind,prompt,x] of [['image',row.imagePrompt,40],['video',row.videoPrompt,row.imagePrompt?740:40]]){if(!prompt)continue;const type=kind==='image'?'generateImage':'generateVideo';if(!WorkflowAI.providers[providers[kind]]?.types.includes(kind))throw Error('AI không hỗ trợ '+kind);const source=makeNode('prompt',x,y),target=makeNode(type,x+330,y);source.data.text=prompt;target.data={...target.data,provider:providers[kind],size:row.size,duration:row.duration,customName:row.title+(kind==='image'?' · Ảnh':' · Video'),status:'idle'};nodes.push(source,target);edges.push({id:uid('edge'),source:source.id,sourcePort:'text',target:target.id,targetPort:'prompt'});if(kind==='image')image=target;else if(image)edges.push({id:uid('edge'),source:image.id,sourcePort:'image',target:target.id,targetPort:'reference'});}}
      return commitCreativeNodes(nodes,edges,'Tạo node từ câu trả lời AI');
    },
    sample:async(file,instruction,provider)=>{await workflowReady;if(state.isRunning)throw Error('Dừng workflow trước khi thêm video mẫu.');if(!['video/mp4','video/webm','video/quicktime'].includes(file.type)||!file.size||file.size>50*1024*1024)throw Error('Video mẫu cần MP4/WebM/MOV, tối đa 50 MB.');const url=URL.createObjectURL(file);let metadata;try{metadata=await mediaDimensions(url,'video');}finally{URL.revokeObjectURL(url);}if(!Number.isFinite(metadata.duration)||metadata.duration<=0)throw Error('Không đọc được thời lượng video.');
      const y=Math.max(100,...state.nodes.map(n=>n.y+500)),video=makeNode('videoInput',40,y),prompt=makeNode('prompt',370,y),analysis=makeNode('generateText',700,y),splitter=makeNode('sceneSplit',1030,y);
      video.data={localDataUrl:await blobAsDataUrl(file),fileName:file.name};prompt.data.text='Phân tích video mẫu đính kèm theo từng cảnh: nội dung, góc máy, chuyển động, ánh sáng và nhịp dựng. Không đoán nội dung không đọc được.\n'+String(instruction||'Giữ cách quay và nhịp dựng; dùng nhân vật/sản phẩm trong ảnh tham chiếu nếu có.').slice(0,10000)+'\nTrả bằng tiếng Việt, tối đa 50 cảnh. Mỗi cảnh đúng mẫu:\nCẢNH 1 (0:00–0:05): Tên cảnh\nPrompt ảnh: Mô tả ảnh mở đầu có thể dùng để tạo ảnh.\nPrompt video: Chuyển động và góc máy của cảnh.\nKhông dùng dấu … thay cho nội dung. Nếu không đọc được video, nêu lỗi và không bịa cảnh.';
      analysis.data={provider,toolKind:'videoAnalysis',customName:'Phân tích video mẫu',status:'idle',text:''};splitter.data={text:'',sceneMode:'both'};
      await commitCreativeNodes([video,prompt,analysis,splitter],[{id:uid('edge'),source:video.id,sourcePort:'video',target:analysis.id,targetPort:'video'},{id:uid('edge'),source:prompt.id,sourcePort:'text',target:analysis.id,targetPort:'prompt'},{id:uid('edge'),source:analysis.id,sourcePort:'text',target:splitter.id,targetPort:'prompt'}],'Tạo quy trình theo video mẫu');
    },
    preflight:async()=>{await workflowReady;syncSharedReferenceBoards();const issues=[],targets=state.nodes.filter(n=>['generateImage','generateVideo','generateText'].includes(n.type)),cache=new Map();
      try{topoOrder();}catch(error){issues.push({id:targets[0]?.id,title:'Kết nối workflow',message:error.message});}
      for(const node of targets){const provider=node.data.provider||(node.type==='generateText'?'gemini':'muse'),p=WorkflowAI.providers[provider],kind=node.type==='generateText'?'text':node.type==='generateVideo'?'video':'image';try{const prompt=resolvePrompt(node.id),refs=resolveReferences(node.id),videos=resolveVideos(node.id);if(!prompt.trim())throw Error('Thiếu prompt; nối node Yêu cầu hoặc viết nội dung đầu vào.');if(refs.length>8)throw Error('Có '+refs.length+' ảnh; tối đa 8 ảnh mỗi tác vụ.');if(node.data.toolKind==='videoAnalysis'&&!videos.length)throw Error('Chưa nối video gốc.');WorkflowAI.validate(provider,{mediaType:kind,referenceImages:refs.map(r=>r.url),referenceVideos:videos,duration:node.data.duration});if(p?.urls){if(!cache.has(provider))cache.set(provider,await chrome.tabs.query({url:p.urls}));chooseChat(provider,cache.get(provider),node.data.chatTarget||aiChatTargets[provider]);}else if(!aiKeys[provider])throw Error('Chưa nhập API key trong Kết nối AI.');}catch(error){issues.push({id:node.id,title:node.data.customName||nodeDefs[node.type].title,message:error.message});}}
      return {checked:targets.length,issues};
    },focus:id=>{if(id&&nodeById(id))flowApi.focus({nodeId:id});}
  });

  const batchQueue=WorkflowBatchManager.init({
    ready:()=>workflowReady,refreshChats:()=>refreshChatTabs(),
    prepareOptions:async options=>{options={...options,sharedReferenceSnapshots:await sharedReferenceSnapshots()};WorkflowAI.validate(options.provider,{...options,prompt:'Kiểm tra thiết lập'});if(WorkflowAI.providers[options.provider]?.urls){const tabs=await chrome.tabs.query({url:WorkflowAI.providers[options.provider].urls});const tab=chooseChat(options.provider,tabs,options.chatTarget||aiChatTargets[options.provider]);return {...options,chatTarget:{tabId:tab.id,url:chatKey(tab.url)}};}return options;},
    chatPicker:(provider,changed)=>WorkflowAI.providers[provider]?.urls?chatSelector(provider,aiChatTargets[provider],changed):null,
    prepareJobs:async(jobs,assets)=>{await workflowReady;for(const job of jobs){if(!job.card){job.card=flowApi.create(job.prompt,{...job.options,referenceSnapshots:job.refs.map(ref=>({...ref,url:assets[ref.id]}))});job.queueCreatedCard=true;}const n=nodeById(job.card.nodeId);if(!n)throw Error('Node của tác vụ đã bị xóa.');n.data.batchTaskId=job.id;n.data.freezeSharedReferences=true;if(!runForNode(n.id)){n.data.status='queued';n.data.progress='Đã xếp hàng; chưa gửi AI.';}}render();await queueWorkflowSave();},
    rollbackJobs:jobs=>removeBatchGroups(jobs,[]),cleanupJobs:removeBatchGroups,
    prepareCard:async card=>{
      const node=nodeById(card.nodeId),prompt=nodeById(card.promptId);if(!node||!prompt)throw Error('Thẻ không còn tồn tại.');
      const refs=resolveReferences(node.id).map(ref=>({...ref,tag:nodeById(getIncoming(node.id,'reference').find(e=>nodeById(e.source)?.data.componentId===ref.componentId)?.source)?.data.libraryTag||''}));
      for(const tag of WorkflowBatchManager.mentions(prompt.data.text)){if(!refs.some(old=>old.tag===tag))refs.push(...WorkflowBatchManager.resolveTags('@'+tag));}
      const options={provider:node.data.provider||'muse',mediaType:node.type==='generateVideo'?'video':'image',size:node.data.size||'1:1',duration:[5,10,15,30,40].reduce((a,b)=>Math.abs(b-(node.data.duration||10))<Math.abs(a-(node.data.duration||10))?b:a,5),chatTarget:node.data.chatTarget||aiChatTargets[node.data.provider||'muse']};
      WorkflowAI.validate(options.provider,{...options,prompt:prompt.data.text});if(WorkflowAI.providers[options.provider]?.urls){const tabs=await chrome.tabs.query({url:WorkflowAI.providers[options.provider].urls}),tab=chooseChat(options.provider,tabs,options.chatTarget);options.chatTarget={tabId:tab.id,url:chatKey(tab.url)};}
      for(const ref of refs)ref.url=await blobAsDataUrlFromUrl(ref.url);return {prompt:prompt.data.text,refs,options};
    },
    run:async(job,refs,checkpoint)=>{
      await workflowReady;
      let card=job.card;
      if(card&&(!nodeById(card.nodeId)||!nodeById(card.promptId)))throw Error('Node của tác vụ không còn trên canvas. Kiểm tra kết quả trước khi tạo lại.');
      if(card&&runForNode(card.nodeId))throw Error('Node đang chạy ở nơi khác. Kiểm tra trước khi gửi lại.');
      if(!card){card=flowApi.create(job.prompt,{...job.options,referenceSnapshots:refs});await queueWorkflowSave();await checkpoint(card);}
      else{
        const node=nodeById(card.nodeId),prompt=nodeById(card.promptId);prompt.data.text=job.prompt;Object.assign(node.data,job.options);node.type=job.options.mediaType==='video'?'generateVideo':'generateImage';
        const incoming=getIncoming(node.id,'reference');state.edges=state.edges.filter(e=>!incoming.includes(e));const orphaned=new Set(incoming.map(e=>e.source).filter(id=>nodeById(id)?.data.flowCardId===card.id&&!state.edges.some(e=>e.source===id||e.target===id)));state.nodes=state.nodes.filter(n=>!orphaned.has(n.id));
        for(const [i,ref] of refs.entries()){const input=makeNode('imageInput',node.x-330,node.y+230+i*80);input.data={...input.data,localDataUrl:ref.url,fileName:ref.name,libraryTag:ref.tag,libraryAlias:ref.componentId,flowCardId:card.id};state.nodes.push(input);connectReferenceNode(input,node);}render();await queueWorkflowSave();
      }
      await checkpoint(card);await execute(card.nodeId,{batchTask:true});await queueWorkflowSave();const result=nodeById(card.nodeId)?.data;
      if(!result)throw Error('Node đã bị xóa trong khi chạy.');return {status:result.status,error:result.error,asset:result.status==='success'&&result.asset?{...result.asset,url:await dehydrateMediaUrl(result.asset.url,'asset:'+result.asset.id)}:undefined,uncertain:/kết nối|chưa xác nhận|timed out|hết thời gian|channel|port|timeout|mã tác vụ/i.test(result.error||'')};
    },
    stop:job=>{if(job.card){if(runForNode(job.card.nodeId))stopGeneration(job.card.nodeId);else{const node=nodeById(job.card.nodeId);if(node){node.data.status='stopped';node.data.progress='';node.data.error='Đã dừng trước khi gửi.';render();}}}},
    result:(job,ready)=>{
      if(!job.asset)return null;const current=nodeById(job.card?.nodeId)?.data.asset;if(current?.id===job.asset.id)return current;
      if(!job.asset.url.startsWith(idbMediaPrefix))return job.asset;const key=decodeURIComponent(job.asset.url.slice(idbMediaPrefix.length));if(batchAssetCache.has(key))return {...job.asset,url:batchAssetCache.get(key)};
      if(!batchAssetLoading.has(key)){batchAssetLoading.add(key);void batchAsset(job).then(()=>ready?.(),error=>setRunStatus(error.message,'warn')).finally(()=>batchAssetLoading.delete(key));}return null;
    },
    download:async job=>{const asset=await batchAsset(job),link=document.createElement('a');link.href=asset.url;link.download=job.id+(asset.kind==='video'?'.mp4':'.png');link.click();},focus:job=>flowApi.focus(job.card)
  });

  WorkflowStoryDashboard.bind({
    read:storyDashboardData,
    checkScope:async id=>{const scope=nodeById(id);if(!scope)return [{id,message:'Chọn kịch bản trước.'}];if(scope.type!=='masterScript')return storyPreflight(scope.data.assemblyId||id);const issues=[];for(const act of (scope.data.actIds||[]).map(nodeById).filter(Boolean))issues.push(...await storyPreflight(act.data.assemblyId));return issues.length?issues:scope.data.actIds?.length?[]:[{id,message:'Nhập kịch bản và tạo node cho các hồi trước.'}];},
    images:storyRunImages,approve:storyApprove,
    run:async id=>{const scope=nodeById(id),owners=scope?.type==='masterScript'?(scope.data.actIds||[]).map(nodeById):[scope];for(const owner of owners){if(!owner?.data.assemblyId)throw Error('Chưa tạo cấu trúc.');await execute(owner.data.assemblyId);if(!storyFresh(nodeById(owner.data.assemblyId)))break;}},
    stop:()=>{if(storyBatch){storyBatch.stopped=true;if(storyBatch.current)stopGeneration(storyBatch.current);}},
    focus:id=>storyFocus(nodeById(id)),download:id=>storyDownload(nodeById(nodeById(id)?.data.assemblyId)),
    name:n=>n.data.customName||nodeDefs[n.type]?.title||n.id
  });
  WorkflowStoryReferences.bind({layout:scheduleDrawEdges,read:storyReferenceSlots,put:setStoryReference,rename:(id,tag,label)=>{const master=storyReferenceMaster(id);if(state.isRunning)throw Error('Dừng tác vụ trước khi đổi tên.');Object.defineProperty(master.data.storyReferenceLabels||={},tag,{value:String(label).slice(0,100),writable:true,enumerable:true,configurable:true});const source=storyReferenceNode(master,tag);if(source){source.data.storyReferenceLabel=String(label).slice(0,100);dirtyStoryReference(source);}scheduleAutoSave();}});
  const workflowReady=loadState(); detectMuse();applyCanvasTransform();
  if(window.workflowDesktop){
    // The desktop host waits for this before closing a canvas; a pending
    // debounce must not discard the last edit. Keep state and credentials private.
    window.WorkflowDesktopLifecycle=Object.freeze({
      flush:async()=>{await workflowReady;clearTimeout(autoSaveTimer);await queueWorkflowSave();},
      stop:()=>{scriptAIController?.abort();if(storyBatch)storyBatch.stopped=true;stopTimelineExport();stopAllRuns();},
      busy:()=>state.isRunning||state.timelineExporting||!!scriptAIController
    });
  }
})();
