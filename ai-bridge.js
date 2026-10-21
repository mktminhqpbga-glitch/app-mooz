/* Isolated-world bridge: only extension messages, no page-supplied commands. */
(() => {
  if(globalThis.__workflowAIBridge)return;globalThis.__workflowAIBridge=true;
  const isGPT=/(^|\.)chatgpt\.com$/.test(location.hostname)||location.hostname==='chat.openai.com';
  const active=new Map(),earlySend=new Set(),manualResults=new Map();let busy=false;
  const visible=el=>el&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden';
  function composer(){
    const selectors=isGPT
      ? '#prompt-textarea,textarea[data-id="root"],#composer-background [contenteditable="true"],form [contenteditable="true"],[contenteditable="true"][role="textbox"],main [contenteditable="true"],textarea[placeholder],textarea[aria-label]'
      : 'rich-textarea [contenteditable="true"],[contenteditable="true"][role="textbox"],textarea';
    const score=el=>(!isGPT&&el.closest('rich-textarea')?40:0)+(el.id==='prompt-textarea'?100:0)+(el.closest('#composer-background,[data-testid="composer"],form')?30:0)+(el.getAttribute('role')==='textbox'?10:0)+(/hỏi chatgpt|ask chatgpt|ask anything|message|gửi|nhắn|prompt/i.test([el.getAttribute('placeholder'),el.getAttribute('aria-label'),el.getAttribute('data-placeholder')].join(' '))?20:0);
    const candidates=[...document.querySelectorAll(selectors)].filter(el=>
      (el instanceof HTMLTextAreaElement||el.isContentEditable)&&visible(el)&&!el.matches(':disabled')&&!el.readOnly&&el.getAttribute('aria-disabled')!=='true'&&el.getAttribute('aria-readonly')!=='true'&&!el.closest('article,[data-message-author-role],[data-turn],[data-testid*="writing-block"],[data-type="writing-block"],.writing-block,[data-testid="canvas-editor"],[data-testid="canvas"],model-response,user-query,pre,code,[role="dialog"],[role="search"],nav,header')&&score(el)>0
    );
    return candidates.sort((a,b)=>score(b)-score(a))[0]||null;
  }
  const historySelector='model-response,user-query,[data-message-author-role],[data-testid^="conversation-turn-"]';
  // Never use <main>: Gemini keeps the conversation and composer under it.
  function root(el){
    if(!el)throw new Error('Không tìm thấy ô nhập AI. Mở trang chat rồi thử lại.');
    const known=el.closest('form,input-area-v2,input-area,[data-testid="composer"],#composer-background');
    if(known&&!known.querySelector(historySelector))return known;
    let best=el.parentElement;
    for(let node=el.parentElement;node&&node!==document.body&&node.tagName!=='MAIN';node=node.parentElement){
      if(node.querySelector(historySelector))break;
      best=node;
      if(node.matches('form,input-area-v2,input-area,[data-testid="composer"],#composer-background'))return node;
      if([...node.querySelectorAll('button,[role="button"]')].some(b=>/send|gửi|submit|hatch-composer/i.test(`${b.getAttribute('aria-label')||''} ${b.getAttribute('data-testid')||''} ${b.textContent||''}`)))return node;
    }
    return best;
  }
  const buttons=(scope=document)=>[...scope.querySelectorAll('button,[role="button"]')].filter(visible);
  const label=el=>`${el.getAttribute('aria-label')||''} ${el.getAttribute('data-testid')||''} ${el.getAttribute('title')||''} ${el.textContent||''}`;
  const stopped=()=>buttons().find(el=>!el.disabled&&el.getAttribute('aria-disabled')!=='true'&&(/stop generating|stop streaming|stop response|dừng phát trực tuyến|dừng phản hồi|dừng trả lời|dừng tạo|stop-button/i.test(label(el))||el.matches('.stop-button,[data-testid="stop-button"]')));
  const send=()=>WorkflowComposer.findSend(root(composer()));
  const writingSelector='[data-testid="writing-block"],[data-testid^="writing-block-"],[data-type="writing-block"],.writing-block';
  function replies(){
    const selector=isGPT?'[data-message-author-role="assistant"],[data-turn="assistant"],'+writingSelector:'model-response,.model-response-text,.markdown-main-panel,message-content';
    const nodes=[...document.querySelectorAll(selector)];
    if(isGPT)for(const turn of document.querySelectorAll('article[data-testid^="conversation-turn-"],[data-testid^="conversation-turn-"]')){if(!turn.matches('[data-turn="user"]')&&!turn.querySelector('[data-message-author-role="user"],[data-turn="user"]')&&turn.querySelector('[data-testid="copy-turn-action-button"],'+writingSelector+',.markdown.prose'))nodes.push(turn);}
    if(isGPT)for(const copy of document.querySelectorAll('[data-testid="copy-turn-action-button"]')){const turn=copy.closest('article,[data-testid^="conversation-turn-"]');if(turn&&!turn.querySelector('[data-message-author-role="user"],[data-turn="user"]'))nodes.push(turn);}
    const candidates=[...new Set(nodes)].filter(el=>!el.closest('user-query,[data-message-author-role="user"],[data-turn="user"]')&&(!composer()||!el.contains(composer())));
    const rendered=candidates.filter(el=>visible(el)||[...el.querySelectorAll('p,div,img,pre')].some(visible));
    return rendered.filter(el=>!rendered.some(parent=>parent!==el&&parent.contains(el)));
  }
  function replyText(el){
    const writing=el.matches(writingSelector)?el:el.querySelector(writingSelector);
    const content=writing?(writing.querySelector('[data-testid="writing-block-content"],[data-writing-block-content],.ProseMirror,[contenteditable="true"],.markdown')||writing):(el.querySelector('message-content,.model-response-text,.markdown-main-panel,.markdown')||el);
    if(writing&&content===writing){const copy=content.cloneNode(true);copy.querySelectorAll('button,header,[role="toolbar"]').forEach(node=>node.remove());return String(copy.textContent||'').trim();}
    return String(content.innerText||content.textContent||'').trim();
  }
  function report(request,text){if(chrome.runtime.sendMessage)void chrome.runtime.sendMessage({type:'WORKFLOW_AI_PROGRESS',requestId:request.requestId,text}).catch(()=>{});}

  const uploadedNames=new Set();
  function attachments(scope){
    const selectors='[data-testid*="attachment"],[data-testid*="file-thumbnail"],[data-file-name],.file-preview,.file-preview-container,.file-preview-chip,.attachment-preview,.image-preview-container,.attachment-container,.uploaded-file,.file-chip,.image-preview';
    const candidates=new Set(scope.querySelectorAll(selectors));
    // ChatGPT may render a generic document/video card with no attachment classes.
    // Match only file labels inside the composer, never FileList selection or history.
    for(const el of scope.querySelectorAll('div,span,a,button')){
      if(el.contains(composer())||el.isContentEditable||el.closest('[contenteditable="true"]'))continue;
      const text=[el.getAttribute('title'),el.getAttribute('aria-label'),el.getAttribute('data-file-name'),el.childElementCount? '':el.textContent].filter(Boolean).join(' ');
      if([...uploadedNames].some(name=>text.includes(name)||text.includes(name.slice(0,17)))||/workflow-[a-f0-9-]{8,}|\S+\.(?:mp4|webm|mov|m4v|png|jpe?g|pdf)(?:$|\s)/i.test(text))candidates.add(el);
    }
    return [...candidates].filter(el=>visible(el)&&!el.closest(historySelector)&&(String(el.innerText||el.textContent||'').trim()||el.querySelector('img[src],video[src],[data-file-name],[role="progressbar"]')||buttons(el).some(b=>/remove|xóa|xoá/i.test(label(b)))));
  }
  const uploading=()=>root(composer()).querySelector('[role="progressbar"],[aria-busy="true"],[data-state="uploading"],[data-status="uploading"],.animate-spin');
  async function wait(check,ms,signal,message){const end=Date.now()+ms;while(Date.now()<end){if(signal?.aborted)throw new DOMException('Đã dừng.','AbortError');const result=check();if(result)return result;await new Promise(resolve=>setTimeout(resolve,180));}throw new Error(message);}
  function setText(el,text){
    el.focus();
    if(el instanceof HTMLTextAreaElement){Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,text);el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}));}
    else{
      // Native editing lets Quill/ProseMirror update their document model.
      const selection=getSelection(),range=document.createRange();range.selectNodeContents(el);selection.removeAllRanges();selection.addRange(range);
      if(!document.execCommand('insertText',false,text))throw new Error('Không nhập được prompt vào trình soạn thảo AI. Prompt chưa được gửi.');
    }
  }
  async function clearDraft(signal){
    const el=await wait(composer,5000,signal,'Ô nhập AI đang tải hoặc chưa được nhận diện. Tải lại tab AI rồi thử lại.');
    if(stopped())throw new Error('AI đang trả lời. Hãy đợi hoặc dừng câu trả lời hiện tại.');
    const scope=root(el);const remove=()=>WorkflowComposer.removeButtons(root(composer()),composer());
    for(const b of remove())b.click();
    await wait(()=>!remove().length&&!attachments(scope).length,10000,signal,'Không dọn được tệp đính kèm cũ. Hãy xóa tệp trong ô chat rồi chạy lại.');
  }
  async function attach(urls,signal){
    for(let i=0;i<urls.length;i++){
      const response=await fetch(urls[i],{signal});if(!response.ok)throw new Error('Không đọc được tệp tham chiếu.');const blob=await response.blob();
      if(!/^(image|video)\//.test(blob.type)||!blob.size)throw new Error('Tệp tham chiếu không phải ảnh/video có thể đọc.');
      if(blob.size>100*1024*1024)throw new Error('Tệp tải qua tab vượt 100 MB.');
      const scope=root(composer());
      const accepts=input=>!input.accept||input.accept.includes('*/*')||input.accept.includes(blob.type.split('/')[0])||input.accept.includes(blob.type)||input.accept.includes('.'+blob.type.split('/')[1]);
      const input=()=>{const all=[...document.querySelectorAll('input[type="file"]')].filter(el=>!el.disabled&&accepts(el));return all.find(el=>scope.contains(el))||all[0];};
      if(!input()){
        const upload=buttons(scope).find(b=>/attach|upload|add files|thêm tệp|tải tệp|đính kèm|open.*menu/i.test(label(b)));if(upload)upload.click();
        await new Promise(resolve=>setTimeout(resolve,250));
        if(!input()){const menu=buttons().find(b=>/upload files|upload from computer|tải.*máy|tải tệp/i.test(label(b)));if(menu)menu.click();}
      }
      const field=await wait(input,5000,signal,'Không tìm thấy ô tải tệp của AI. Giao diện có thể đã thay đổi.');
      const before=new Set(attachments(scope));const dt=new DataTransfer();const name=`workflow-${crypto.randomUUID()}.${blob.type.split('/')[1].replace(/[^a-z0-9]/gi,'')}`;uploadedNames.add(name);dt.items.add(new File([blob],name,{type:blob.type}));field.files=dt.files;field.dispatchEvent(new Event('change',{bubbles:true}));
      // A FileList only proves selection, not a completed remote upload.
      await wait(()=>attachments(root(composer())).some(el=>!before.has(el)),120000,signal,'AI chưa xác nhận tệp đính kèm; chưa gửi prompt.');
      await wait(()=>!uploading(),600000,signal,'Tệp chưa tải xong; chưa gửi prompt.');
    }
  }
  async function generate(request,signal){
    if(!String(request.prompt||'').trim())throw new Error('Yêu cầu trống.');
    const deadline=Date.now()+120000,conversation=location.origin+location.pathname;
    const markerId=crypto.randomUUID().replaceAll('-',''),opening=`[[WF:${markerId}]]`,closing=`[[/WF:${markerId}]]`;
    const format=request.mediaType==='text'?`Dòng đầu chỉ ghi ${opening}; dòng cuối chỉ ghi ${closing}. Đặt toàn bộ kết quả ở giữa, không thêm lời dẫn.`:'';
    const wireText=[request.rules,format,request.prompt].filter(Boolean).join('\n\n');
    const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const markedResult=()=>{
      if(request.mediaType!=='text')return '';
      const text=document.body?.innerText||'';
      const match=new RegExp('(?:^|\\n)[ \\t]*'+escape(opening)+'[ \\t]*\\n([\\s\\S]*?)\\n[ \\t]*'+escape(closing)+'[ \\t]*(?:\\n|$)').exec(text);
      return match?.[1]?.trim()||'';
    };

    const checkConversation=()=>{if(location.origin+location.pathname!==conversation)throw new Error('Cuộc trò chuyện đã thay đổi. Đã dừng để tránh gửi nhầm chat.');};
    await clearDraft(signal);
    const before=new Map(replies().map(el=>[el,replyText(el)]));
    const users=()=>[...document.querySelectorAll(isGPT?'[data-message-author-role="user"],[data-turn="user"]':'user-query,.user-query-container')];
    const priorUsers=new Set(users());
    let prepared=false;
    const normalize=value=>String(value||'').replace(/\s+/g,' ').trim();
    const echo=()=>users().some(el=>!priorUsers.has(el)&&normalize(el.innerText||el.textContent).includes(normalize(request.prompt)));
    const freshReplies=()=>replies().filter(el=>!before.has(el)||before.get(el)!==replyText(el));
    const submitted=()=>{
      if(!prepared)return false;
      if(markedResult()||echo())return true;
      const input=composer(),draft=input?normalize(input.value??input.innerText):'';
      // Composer may be hidden/replaced while ChatGPT opens a writing block.
      // A retained, different draft is not evidence that this request failed.
      const ownDraft=draft&&draft===normalize(wireText);
      return !ownDraft&&(!!stopped()||freshReplies().length>0);
    };
    report(request,'Đang đưa tài liệu vào cuộc trò chuyện. Chờ tải tệp hoàn tất…');
    await attach([...(request.referenceImages||[]),...(request.referenceVideos||[])],signal);
    checkConversation();
    if(!submitted()){
      before.clear();for(const el of replies())before.set(el,replyText(el));
      priorUsers.clear();for(const el of users())priorUsers.add(el);
      const text=wireText;
      const editor=await wait(composer,5000,signal,'Ô nhập AI vừa thay đổi. Tải lại tab AI rồi thử lại.');
      setText(editor,text);prepared=true;
      await new Promise(resolve=>setTimeout(resolve,300));
      const normalized=value=>String(value||'').replace(/\s+/g,' ').trim();
      if(normalized(composer()?.value??composer()?.innerText)!==normalized(text))throw new Error('AI không giữ được prompt trong ô nhập. Chưa gửi yêu cầu; hãy tải lại tab AI.');
      if(request.stageBeforeSend&&request.mediaType==='text'){
        let lastSecond=-1;
        await wait(()=>{
          checkConversation();
          const seconds=Math.max(0,Math.ceil((deadline-Date.now())/1000));
          if(seconds!==lastSecond){lastSecond=seconds;report(request,`Tệp đã tải xong. Tự gửi sau ${seconds} giây; có thể bấm Gửi ngay.`);}
          return submitted()||earlySend.has(request.requestId)||seconds===0;
        },Math.max(1000,deadline-Date.now()+2000),signal,'Hết thời gian chuẩn bị gửi.');
      }
      checkConversation();
      if(!submitted()){
        const button=await wait(()=>{checkConversation();return submitted()||(!uploading()&&send());},600000,signal,'Không tìm thấy nút Gửi sẵn sàng. Prompt chưa được gửi.');
        if(button!==true){checkConversation();button.click();report(request,'Đã bấm Gửi. Đang xác nhận AI nhận yêu cầu…');}
      }
    }
    report(request,'Đang xác nhận AI nhận yêu cầu; không gửi lại prompt…');
    await wait(submitted,90000,signal,'Chưa xác nhận AI nhận prompt sau 90 giây. Kiểm tra tab AI; không tự gửi lại để tránh trùng lặp.');
    report(request,'AI đã nhận yêu cầu. Đang chờ phản hồi…');
    let last='',since=Date.now(),reportedReply=false;
    const result=await wait(()=>{
      const marked=markedResult();if(marked){if(marked!==last){last=marked;since=Date.now();}if(!stopped()&&Date.now()-since>=750)return {ok:true,text:marked};return false;}
      const fresh=freshReplies();const reply=fresh.at(-1);if(!reply)return false;
      const text=replyText(reply);if(!reportedReply&&text){reportedReply=true;report(request,'Đã thấy phản hồi. Đang đợi AI hoàn tất…');}if(text!==last){last=text;since=Date.now();}
      if(stopped()||reply.matches('[aria-busy="true"],[data-is-streaming="true"]')||reply.querySelector('[aria-busy="true"],[data-is-streaming="true"]')||Date.now()-since<3500)return false;
      if(request.mediaType==='text'){if(text.includes(opening)&&!text.includes(closing))return false;const clean=text.replaceAll(opening,'').replaceAll(closing,'').trim();return clean?{ok:true,text:clean}:false;}
      const image=[...reply.querySelectorAll('img')].filter(visible).find(img=>img.naturalWidth>=256&&img.naturalHeight>=256);
      return image?{ok:true,url:image.currentSrc||image.src}:false;
    },600000,signal,'Hết thời gian chờ kết quả AI. Kiểm tra tab AI; không tự gửi lại prompt.');
    if(result.url){const r=await fetch(result.url,{signal});if(!r.ok)throw new Error('Không tải được ảnh kết quả từ tab AI.');const blob=await r.blob();result.url=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});}
    return result;
  }
  chrome.runtime.onMessage.addListener((request,sender,respond)=>{
    if(sender.id!==chrome.runtime.id)return false;
    if(request.type==='WORKFLOW_AI_CHECK'){
      wait(composer,3500,null,'Không nhận diện được ô nhập trên trang AI đang mở.').then(()=>respond({ok:true,signedIn:true,composer:true,busy:busy||!!stopped(),bridgeVersion:'0.11.0'}),()=>respond({ok:true,signedIn:false,composer:false,bridgeVersion:'0.11.0',error:'Tab AI đã kết nối nhưng chưa nhận diện được ô nhập đang chỉnh sửa. Mở cuộc trò chuyện và tải lại tab AI.'}));return true;
    }
    if(request.type==='WORKFLOW_AI_USE_RESULT'){const resolve=manualResults.get(request.requestId);if(!resolve||typeof request.text!=='string'||!request.text.trim()){respond({ok:false});return false;}resolve({ok:true,text:request.text.trim()});respond({ok:true});return false;}
    if(request.type==='WORKFLOW_AI_SEND_NOW'){const pending=active.has(request.requestId);if(pending)earlySend.add(request.requestId);respond({ok:pending});return false;}
    if(request.type==='WORKFLOW_AI_STOP'){const controller=active.get(request.requestId);if(controller){controller.abort();stopped()?.click();}respond({ok:true,stopped:!!controller});return false;}
    if(request.type!=='WORKFLOW_AI_GENERATE')return false;
    if(busy){respond({ok:false,error:'Tab AI đang xử lý một yêu cầu khác.'});return false;}
    busy=true;const controller=new AbortController();active.set(request.requestId,controller);
    const manual=new Promise(resolve=>manualResults.set(request.requestId,resolve));
    Promise.race([generate(request,controller.signal),manual]).then(respond,error=>respond({ok:false,error:error.message})).finally(()=>{controller.abort();busy=false;active.delete(request.requestId);earlySend.delete(request.requestId);manualResults.delete(request.requestId);});return true;
  });
})();
