(() => {
  if (window.__museFlowBridgeInstalled) return;
  window.__museFlowBridgeInstalled = true;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if(_sender.id!==chrome.runtime.id)return false;
    if (message?.type === 'MUSEFLOW_CHECK_SESSION') {
      checkSession().then(sendResponse);
      return true;
    }
    if (message?.type === 'MUSEFLOW_GENERATE') {
      if(activeGenerations.size){sendResponse({ok:false,error:'Muse đang xử lý yêu cầu khác.'});return false;}
      const controller=new AbortController();activeGenerations.set(message.requestId,controller);
      generate(message,controller.signal).then(sendResponse, error => sendResponse({ ok: false, code:error.code||'MUSE_ERROR', error: error.message || String(error) })).finally(()=>activeGenerations.delete(message.requestId));
      return true;
    }
    if(message?.type==='MUSEFLOW_STOP_GENERATION'){
      const stopped=message.requestId?abortGeneration(message.requestId):[...activeGenerations.keys()].some(id=>abortGeneration(id));
      sendResponse({ok:true,stopped});return false;
    }
  });

  function findComposer() {
    const candidates=[...document.querySelectorAll('textarea')].filter(el=>visible(el)&&!el.disabled);
    return candidates.find(el=>/message|消息/i.test(el.getAttribute('placeholder')||''))||candidates[0]||null;
  }

  function composerScope(el){return WorkflowComposer.scopeFor(el);}

  function visible(el) { return Boolean(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden'); }
  const delay = (ms,signal) => new Promise((resolve,reject)=>{
    if(signal?.aborted){reject(new DOMException('Generation stopped by user.','AbortError'));return;}
    const timer=setTimeout(()=>{signal?.removeEventListener('abort',cancel);resolve();},ms);
    const cancel=()=>{clearTimeout(timer);signal?.removeEventListener('abort',cancel);reject(new DOMException('Generation stopped by user.','AbortError'));};
    signal?.addEventListener('abort',cancel,{once:true});
  });
  const assistantSelector='div[class*="hatch-chat-groupable-bubble"],[data-message-author-role="assistant"],[data-testid*="assistant" i],[data-testid*="message-content" i],[class*="assistant-message" i],[class*="assistant-bubble" i],.group\\/msg';
  const attachmentSelector='[data-testid^="hatch-chat-attachment-presentation-"]';
  const activeGenerations=new Map();

  function clickMuseStop(){
    const button=[...document.querySelectorAll('[data-testid="hatch-composer-stop-button"],button[aria-label*="Stop" i],button[aria-label*="停止"]')].find(visible);
    if(button){button.click();return true;}return false;
  }

  function abortGeneration(requestId){
    const controller=activeGenerations.get(requestId);
    if(!controller)return false;
    controller.abort();clickMuseStop();return true;
  }

  async function checkSession() {
    await waitHydrated(5000);
    const composer=findComposer();
    const ready=Boolean(composer&&visible(composer)&&!composer.disabled&&!composer.readOnly);
    const loginRequired=Boolean(document.querySelector('input[type="password"],button[type="submit"]'))&&/sign in|log in|登录/i.test(document.body?.innerText||'');
    return {ok:true,signedIn:ready&&!loginRequired,busy:activeGenerations.size>0||[...document.querySelectorAll('[data-testid="hatch-composer-stop-button"],button[aria-label*="Stop" i]')].some(visible),title:document.title,composer:ready,loginRequired,url:location.href};
  }

  async function waitHydrated(timeout,signal) {
    const end=Date.now()+timeout;
    while(Date.now()<end){
      const hydration=document.querySelector('[data-hatch-shell-hydration-state]');
      if(document.readyState==='complete'&&findComposer()&&(!hydration||hydration.getAttribute('data-hatch-shell-hydration-state')==='hydrated'))return;
      if(signal?.aborted)throw new DOMException('Generation stopped by user.','AbortError');
      await delay(120,signal);
    }
    if(!findComposer())throw new Error('Muse chat is not ready. Open the Muse chat page and wait for the message box to load.');
  }

  function attachments() {
    const composer=findComposer(),scope=composer&&composerScope(composer);
    const candidates=new Set(document.querySelectorAll(attachmentSelector));
    const tile=el=>el.closest(`${attachmentSelector},figure,[data-video-src],[data-video-url],[data-download-url]`)||el;
    for(const el of document.querySelectorAll('video,[data-video-src],[data-video-url],[data-download-url],a[download],a[href]')){
      if(el.matches('video,[data-video-src],[data-video-url]')||/\.(mp4|webm|mov|m4v)(?:$|[?#])/i.test(el.href||el.getAttribute('download')||el.getAttribute('data-download-url')||''))candidates.add(tile(el));
    }
    for(const bubble of assistantMessageElements())for(const img of bubble.querySelectorAll('img'))if(img.naturalWidth>=128&&img.naturalHeight>=128)candidates.add(tile(img));
    const found=new Map();
    for(const el of candidates){
      if(!visible(el)||el.closest('[data-testid*="placeholder" i],[data-testid*="loading" i],[data-state="loading"],[aria-busy="true"]')||scope?.contains(el)||el.closest('[class*="chat-user-bubble"],[data-message-author-role="user"],user-query,[data-testid="hatch-composer-placeholder-overlay"]'))continue;
      const tid=el.getAttribute('data-testid')||'',video=el.matches('video')?el:el.querySelector('video'),image=el.matches('img')?el:el.querySelector('img');
      const nodes=[el,...el.querySelectorAll('a[href],source[src],[data-video-src],[data-video-url],[data-download-url]')];
      const urls=nodes.map(item=>({url:item.getAttribute('data-video-src')||item.getAttribute('data-video-url')||item.getAttribute('data-download-url')||item.href||item.src||'',download:item.getAttribute('download')||'',type:item.getAttribute('type')||'',explicitVideo:item.hasAttribute('data-video-src')||item.hasAttribute('data-video-url')})).filter(item=>item.url);
      const videoLink=urls.find(item=>item.explicitVideo||/video\//i.test(item.type)||/\.(mp4|webm|mov|m4v)(?:$|[?#])/i.test(item.url)||/\.(mp4|webm|mov|m4v)$/i.test(item.download))?.url||'';
      const videoUrl=video?.currentSrc||video?.src||video?.querySelector('source')?.src||videoLink||'';
      const src=videoUrl||image?.currentSrc||image?.src||'';
      const bubble=el.closest(assistantSelector);
      const decorative=/(?:^|[\/_.-])(?:placeholder|loading|loader|mascot|avatar|sloth|welcome|onboarding)(?:[\/_.?-]|$)/i.test(src);
      if(src&&bubble&&!decorative)found.set(src,{el,bubble,tid,src,videoUrl,isVideo:!!videoUrl||!!video||/video/i.test(tid),width:video?.videoWidth||image?.naturalWidth||0,height:video?.videoHeight||image?.naturalHeight||0});
    }
    return [...found.values()];
  }

  function waitForAttachmentChange(timeoutMs,signal){
    return new Promise(resolve=>{
      let timer;
      const observer=new MutationObserver(()=>finish());
      const finish=()=>{observer.disconnect();clearTimeout(timer);signal?.removeEventListener('abort',finish);resolve();};
      observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['src','poster','href','download','type','data-testid','data-video-src','data-video-url','data-download-url']});
      timer=setTimeout(finish,timeoutMs);
      signal?.addEventListener('abort',finish,{once:true});
    });
  }

  function assistantMessageElements(){
    return [...document.querySelectorAll(assistantSelector)].filter(el=>visible(el)&&!el.closest('[class*="chat-user-bubble"],[data-message-author-role="user"],[data-testid*="user-message" i]'));
  }

  function readNewAssistantContext(previousBubbleTexts){
    const bubbles=assistantMessageElements();
    // Muse wraps assistant replies in group containers too; excluding every group/msg
    // ancestor accidentally filtered out the refusal text that should trigger retry.
    const messages=bubbles.map(el=>({el,text:(el.innerText||el.textContent||'').replace(/\s+/g,' ').trim()})).filter(item=>item.text&&item.text!==previousBubbleTexts.get(item.el));
    return messages.map(item=>item.text).join('\n').slice(-6000);
  }

  function isRefusalContext(context){
    const text=String(context||'');
    const explicit=/(?:i|we)\s+(?:am\s+)?sorry[\s\S]{0,180}(?:cannot|can't|unable|won't)|(?:cannot|can't|couldn't|unable to|not able to)\s+(?:help|assist|create|generate|make|produce|fulfill|complete|comply)|(?:request|prompt).{0,100}(?:violat|disallowed|restricted|not allowed)|(?:policy|safety).{0,100}(?:prevent|restrict|unable)|generation (?:was )?(?:declined|blocked)|content (?:is )?not allowed|i can't comply/i;
    const inability=/(?:không tạo được|không thể tạo|chưa thể tạo|không thực hiện được|vẫn không tạo được|không làm được)/i;
    const sceneContext=/(?:cảnh|bản|đoạn|video|ảnh|nội dung|yêu cầu|này)/i;
    const offerAlternative=/(?:bản|phiên bản|phương án)\s+tương\s+đương|tương\s+đương.{0,100}(?:bám|theo|kịch bản)|muốn.{0,100}(?:tạo mới|thử lại|làm lại)|(?:would you like|do you want|want me to).{0,100}(?:create|make|generate|try)|equivalent alternative/i;
    return explicit.test(text)||inability.test(text)&&(sceneContext.test(text)||offerAlternative.test(text));
  }

  function report(requestId,text){if(chrome.runtime.sendMessage)void chrome.runtime.sendMessage({type:'WORKFLOW_AI_PROGRESS',requestId,text}).catch(()=>{});}

  async function generate({prompt,timeoutSec=600,mediaType='image',referenceImage='',referenceImages=[],size='1:1',requestId},signal) {
    const throwIfAborted=()=>{if(signal?.aborted)throw new DOMException('Generation stopped by user.','AbortError');};
    throwIfAborted();
    if(!String(prompt||'').trim())throw new Error('Prompt is empty.');
    try{const saved=await chrome.storage?.local?.get('workflowMuseSendTarget');WorkflowComposer.setPreferred(saved?.workflowMuseSendTarget);}catch{WorkflowComposer.setPreferred(null);}
    await waitHydrated(15000,signal);
    throwIfAborted();
    let composer=findComposer();
    if(!visible(composer))throw new Error('Muse message box is not visible. Open the chat composer and retry.');
    const draftSetter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')?.set;
    if(draftSetter){draftSetter.call(composer,'');composer.dispatchEvent(new Event('input',{bubbles:true}));}
    const removeDraft=()=>WorkflowComposer.removeButtons(composerScope(findComposer()),findComposer());
    removeDraft().forEach(button=>button.click());
    for(let i=0;i<50&&removeDraft().length;i++)await delay(100,signal);
    if(removeDraft().length)throw new Error('Không xóa được tệp cũ trong Muse. Xóa tệp trong ô chat trước khi chạy lại.');
    const referenceList=Array.isArray(referenceImages)&&referenceImages.length?referenceImages:referenceImage?[referenceImage]:[];
    if(referenceList.length){report(requestId,'Muse: đang tải ảnh tham chiếu…');await attachReferences(referenceList,signal);}
    composer=findComposer();if(!composer?.isConnected)throw new Error('Ô nhập Muse đã thay đổi. Hãy tải lại tab Muse rồi thử lại.');
    throwIfAborted();
    const baseline=new Set([...attachments().map(a=>a.src),...[...document.querySelectorAll('img,video,source,a[download],[data-video-url],[data-video-src]')].filter(el=>!composerScope(composer).contains(el)&&!el.closest('[data-message-author-role="user"],user-query,[class*="chat-user-bubble"]')).flatMap(el=>[el.currentSrc,el.src,el.href,el.getAttribute('data-video-url'),el.getAttribute('data-video-src')]).filter(Boolean),...assistantMessageElements().flatMap(el=>[...el.querySelectorAll('img')].map(img=>img.currentSrc||img.src))]);
    const priorBubbleTexts=new Map(assistantMessageElements().map(el=>[el,(el.innerText||el.textContent||'').replace(/\s+/g,' ').trim()]));
    composer.scrollIntoView({block:'center'});composer.focus();
    const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')?.set;
    if(!setter)throw new Error('Muse message box is unsupported.');
    setter.call(composer,String(prompt));
    composer.dispatchEvent(new Event('input',{bubbles:true}));
    composer.dispatchEvent(new Event('change',{bubbles:true}));
    const bubbleCount=()=>new Set(document.querySelectorAll('div[class*="hatch-chat-groupable-bubble"],[data-message-author-role],user-query,[class*="chat-user-bubble"]')).size;
    const beforeSendCount=bubbleCount(),previousTexts=new Set(priorBubbleTexts.values());
    const activity=()=>!!findComposer()&&!findComposer().value.trim()&&(bubbleCount()>beforeSendCount||attachments().some(item=>!baseline.has(item.src))||assistantMessageElements().some(el=>{const text=(el.innerText||el.textContent||'').replace(/\s+/g,' ').trim();return text&&!previousTexts.has(text);})||[...document.querySelectorAll('[data-testid="hatch-composer-stop-button"],button[aria-label*="Stop" i],button[aria-label*="停止"]')].some(visible));
    report(requestId,'Muse: đã điền prompt, đang chờ nút Gửi…');
    let sendButton=null,submitted=false,keyboardSend=false;
    for(let i=0;i<900;i++){
      throwIfAborted();
      // A user may press Send while our selector is still waiting. Never send twice.
      if(activity()){submitted=true;break;}
      WorkflowComposer.assertUpload(composerScope(findComposer()));
      sendButton=WorkflowComposer.findSend(composerScope(findComposer()));
      if(sendButton)break;
      const scope=composerScope(findComposer());
      if(i>=30&&!scope.querySelector('[role="progressbar"],[aria-busy="true"],button:disabled,[aria-disabled="true"]')){keyboardSend=true;break;}
      await delay(100,signal);
    }
    throwIfAborted();
    if(!submitted){
      if(!findComposer()?.value.trim())throw new Error('Muse không giữ được prompt. Chưa xác nhận gửi yêu cầu.');
      if(!sendButton&&!keyboardSend)throw new Error('Không nhận diện được nút Gửi đang sẵn sàng của Muse.');
      // Ignore history/media which finished hydrating while the Send button was pending.
      for(const item of attachments())baseline.add(item.src);
      for(const el of assistantMessageElements())priorBubbleTexts.set(el,(el.innerText||el.textContent||'').replace(/\s+/g,' ').trim());
      if(sendButton){sendButton.click();report(requestId,'Muse: đã bấm Gửi, đang xác nhận…');}
      else{const input=findComposer();input.focus();for(const type of ['keydown','keyup'])input.dispatchEvent(new KeyboardEvent(type,{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}));report(requestId,'Muse: đã yêu cầu gửi bằng Enter, đang xác nhận…');}
      submitted=true;
    }
    let accepted=false;
    for(let i=0;i<150;i++){throwIfAborted();if(activity()){accepted=true;break;}await delay(100,signal);}
    if(!accepted)throw new Error('Chưa xác nhận Muse nhận prompt. Không tự gửi lại để tránh trùng lặp.');
    report(requestId,'Muse đã nhận yêu cầu. Đang tìm video/ảnh kết quả mới…');
    const deadline=Date.now()+Math.min(900,Math.max(30,Number(timeoutSec)||600))*1000;
    let lastProgress=Date.now(),firstWrongRatioAt=0,wrongMediaSince=0,lastCandidate='',candidateSince=0;
    let refusalContext='',refusalContextSince=0;
    while(Date.now()<deadline){
      throwIfAborted();
      const fresh=attachments().filter(a=>!baseline.has(a.src)&&!priorBubbleTexts.has(a.bubble));
      const matching=fresh.filter(a=>mediaType==='video'?a.isVideo:!a.isVideo);
      const wrongMedia=fresh.find(a=>mediaType==='image'?a.isVideo:!a.isVideo);
      if(wrongMedia&&mediaType!=='video'){if(!wrongMediaSince)wrongMediaSince=Date.now();if(Date.now()-wrongMediaSince>=1800){const expected=mediaType==='image'?'image':'video',actual=mediaType==='image'?'video':'image';const error=new Error(`Muse returned a ${actual} for a Generate ${expected==='image'?'Image':'Video'} node. Switch the Muse composer to ${expected} generation, then retry.`);error.code='MEDIA_TYPE_MISMATCH';throw error;}}
      else wrongMediaSince=0;
      const [ratioW,ratioH]=String(size||'1:1').split(':').map(Number),expectedRatio=ratioW>0&&ratioH>0?ratioW/ratioH:1;
      const measured=matching.filter(a=>a.width>0&&a.height>0).sort((a,b)=>{
        const scoreA=Math.abs(Math.log((a.width/a.height)/expectedRatio)),scoreB=Math.abs(Math.log((b.width/b.height)/expectedRatio));
        if(Math.abs(scoreA-scoreB)>.015)return scoreA-scoreB;
        return a.el.compareDocumentPosition(b.el)&Node.DOCUMENT_POSITION_FOLLOWING?1:-1;
      });
      const best=measured[0],bestRatioError=best?Math.abs(Math.log((best.width/best.height)/expectedRatio)):Infinity;
      if(best&&bestRatioError<=.09)firstWrongRatioAt=0;
      else if(best&&!firstWrongRatioAt)firstWrongRatioAt=Date.now();
      const result=(best&&(bestRatioError<=.09||Date.now()-firstWrongRatioAt>=3500)?best:null)||(mediaType==='video'?matching.find(item=>item.videoUrl&&(!item.width||!item.height)):null);
      if(result){
        const responding=[...document.querySelectorAll('[data-testid="hatch-composer-stop-button"],button[aria-label*="Stop" i],button[aria-label*="停止"]')].some(visible);
        if(lastCandidate!==result.src){lastCandidate=result.src;candidateSince=Date.now();}
        if(responding||Date.now()-candidateSince<1500){await waitForAttachmentChange(Math.min(500,deadline-Date.now()),signal);continue;}
        report(requestId,'Đã tìm thấy kết quả Muse. Đang chuyển về Workflow…');
        const media=mediaType==='video'?(result.el.matches('video')?result.el:result.el.querySelector('video')):(result.el.matches('img')?result.el:result.el.querySelector('img'));
        const src=mediaType==='video'?(result.videoUrl||media?.currentSrc||media?.src||''):(media?.currentSrc||media?.src||'');
        // Muse may first render a poster and attach the playable/download URL after
        // hydration. Keep waiting for that URL instead of rejecting a completed clip.
        if(!src){firstWrongRatioAt=firstWrongRatioAt||Date.now();await waitForAttachmentChange(Math.min(500,deadline-Date.now()),signal);continue;}
        if(src.startsWith('data:'))return {ok:true,url:src};
        try{
          const response=await fetch(src,{credentials:'include',signal});
          if(!response.ok)throw new Error(`${mediaType} download returned HTTP ${response.status}.`);
          const blob=await response.blob();
          return {ok:true,url:await blobToDataUrl(blob)};
        }catch(error){return {ok:true,url:src,error:`New ${mediaType} detected but could not be copied locally: ${error.message}`};}
      }
      const stop=Boolean(document.querySelector('[data-testid="hatch-composer-stop-button"],button[aria-label*="Stop" i],button[aria-label*="停止"]'));
      const currentContext=readNewAssistantContext(priorBubbleTexts),refusal=isRefusalContext(currentContext);
      if(refusal){
        if(currentContext!==refusalContext){refusalContext=currentContext;refusalContextSince=Date.now();}
        if(Date.now()-refusalContextSince>=1200){
          if(stop)clickMuseStop();
          const error=new Error(`Muse could not generate this scene: ${currentContext.slice(-700)}`);error.code='SCENE_REFUSED';throw error;
        }
      }
      else{refusalContext='';refusalContextSince=0;}
      if(!stop&&Date.now()-lastProgress>5000){
        const tail=(document.body?.innerText||'').slice(-800);
        if(/out of credits|insufficient credits|额度不足|积分不足/i.test(tail))throw new Error('Muse account has insufficient image credits.');
      }
      await waitForAttachmentChange(Math.min(500,deadline-Date.now()),signal);
    }
    throwIfAborted();
    throw new Error(`Timed out waiting for a new Muse ${mediaType} attachment. Prompt was submitted once; it was not resubmitted.`);
  }

  async function attachReferences(references,signal){
    const rawFiles=await Promise.all(references.map(async(reference,index)=>{
      const url=typeof reference==='string'?reference:reference?.url;
      if(!url)throw new Error(`Reference image ${index+1} has no URL.`);
      const response=await fetch(url,{credentials:'include',signal});
      if(!response.ok)throw new Error(`Could not load reference image ${index+1} (${response.status}).`);
      let blob=await response.blob();
      blob=await WorkflowComposer.prepareImage(blob,signal);
      if(!blob.type.startsWith('image/')||!blob.size)throw new Error(`Reference ${index+1} is not a readable image.`);
      const extension=(blob.type.split('/')[1]||'png').replace('jpeg','jpg').replace(/[^a-z0-9]/gi,'')||'png';
      return new File([blob],`museflow-reference-${String(index+1).padStart(2,'0')}.${extension}`,{type:blob.type});
    }));
    const fingerprints=new Set(),files=[];
    for(const file of rawFiles){const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))].map(b=>b.toString(16).padStart(2,'0')).join('');if(!fingerprints.has(hash)){fingerprints.add(hash);files.push(file);}}
    const composer=findComposer();
    const composerRoot=composerScope(composer);
    const acceptsImage=input=>{
      const accept=(input.accept||'').toLowerCase();
      return !accept||accept.includes('image')||accept.includes('*/*')||/\.(png|jpe?g|webp|gif|bmp|avif)/.test(accept);
    };
    const findInput=()=>{
      const all=[...document.querySelectorAll('input[type="file"]')].filter(input=>!input.disabled&&acceptsImage(input));
      const isImageInput=input=>/image|\.png|\.jpe?g|\.webp|\.gif|\.avif/i.test(input.accept||'');
      return all.find(input=>composerRoot?.contains(input)&&isImageInput(input))||
        all.find(input=>composerRoot?.contains(input))||
        all.find(isImageInput)||null;
    };
    let input=findInput();
    if(!input){
      const roots=[composerRoot,composer.closest('form'),composer.parentElement].filter(Boolean);
      const uploadButton=roots.flatMap(root=>[...root.querySelectorAll('button,[role="button"],label')]).filter(visible).find(el=>/attach|upload|image|photo|file|đính kèm|tải lên/i.test(`${el.getAttribute('aria-label')||''} ${el.getAttribute('title')||''} ${el.innerText||''}`));
      if(uploadButton){uploadButton.click();await delay(250,signal);input=findInput();}
    }
    if(!input)throw new Error('Muse image upload control was not found near the chat composer; the prompt was not submitted.');
    const previewSelector='img,[role="img"],[data-testid*="attachment" i],[data-testid*="upload" i],[class*="attachment" i],[class*="upload" i]';
    const previewElements=()=>[...composerScope(findComposer()).querySelectorAll(previewSelector)].filter(visible);
    const previewKey=el=>{
      const src=el.matches('img')?(el.currentSrc||el.src||''):/url\(["']?(blob:|data:image\/|https?:)[^)]*\)/i.exec(getComputedStyle(el).backgroundImage)?.[0]||'';
      return `${src}|${el.getAttribute('data-testid')||''}|${el.getAttribute('class')||''}|${el.getAttribute('aria-label')||''}|${el.getAttribute('title')||''}`;
    };
    const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'files')?.set;
    if(!setter)throw new Error('Browser does not allow setting the Muse attachment input.');
    const uploadBatch=async(batch)=>{
      const previousPreviews=new Set(previewElements().map(previewKey));
      const transfer=new DataTransfer();batch.forEach(file=>transfer.items.add(file));
      if(batch.length>1)input.multiple=true;
      setter.call(input,transfer.files);
      input.dispatchEvent(new Event('change',{bubbles:true,composed:true}));
      const started=Date.now(),deadline=started+90000;

      const previewSeen=()=>previewElements().some(el=>{
        const key=previewKey(el),src=el.matches('img')?(el.currentSrc||el.src||''):key.split('|',1)[0];
        return !previousPreviews.has(key)&&Boolean(src);
      });
      while(Date.now()<deadline){WorkflowComposer.assertUpload(composerScope(findComposer()));if(signal?.aborted)throw new DOMException('Generation stopped by user.','AbortError');if(previewSeen()&&!composerScope(findComposer()).querySelector('[role="progressbar"],[aria-busy="true"]')&&Date.now()-started>1500)return;await delay(160,signal);}
      throw new Error(`Muse did not confirm ${batch.length} reference image${batch.length===1?'':'s'} in the chat composer (upload input accepts: ${input.accept||'any file'}); the prompt was not submitted.`);
    };
    if(files.length>1&&!input.multiple){
      for(const file of files)await uploadBatch([file]);
    }else await uploadBatch(files);
  }

  function blobToDataUrl(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(reader.error||new Error('Media conversion failed.'));reader.readAsDataURL(blob);});}
})();
