/* Isolated-world bridge: only extension messages, no page-supplied commands. */
(() => {
  if(globalThis.__workflowAIBridge)return;globalThis.__workflowAIBridge=true;
  const isGPT=location.hostname==='chatgpt.com';
  const active=new Map();let busy=false;
  const visible=el=>el&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden';
  const composer=()=>[...document.querySelectorAll(isGPT?'#prompt-textarea,textarea[data-id="root"]':'rich-textarea [contenteditable="true"],textarea')].find(el=>visible(el)&&!el.disabled);
  const root=el=>el?.closest('form')||el?.closest('main')||el?.parentElement;
  const buttons=(scope=document)=>[...scope.querySelectorAll('button,[role="button"]')].filter(visible);
  const label=el=>`${el.getAttribute('aria-label')||''} ${el.getAttribute('data-testid')||''} ${el.getAttribute('title')||''} ${el.textContent||''}`;
  const stopped=()=>buttons().find(el=>/stop generating|stop response|dừng phản hồi|dừng tạo|stop-button/i.test(label(el)));
  const send=()=>buttons(root(composer())).find(el=>/send-button|send message|send prompt|gửi tin nhắn|gửi lời nhắc|^\s*(send|gửi)\s*$/i.test(label(el))&&!el.disabled&&el.getAttribute('aria-disabled')!=='true');
  const replies=()=>[...document.querySelectorAll(isGPT?'[data-message-author-role="assistant"]':'model-response')].filter(visible);
  const attachments=scope=>[...scope.querySelectorAll('[data-testid*="attachment"], [data-testid*="file-thumbnail"], .file-preview, .file-preview-container, .file-preview-chip, .attachment-preview, .image-preview-container, .attachment-container, .uploaded-file, .file-chip, .image-preview')].filter(visible);
  async function wait(check,ms,signal,message){const end=Date.now()+ms;while(Date.now()<end){if(signal?.aborted)throw new DOMException('Đã dừng.','AbortError');const result=check();if(result)return result;await new Promise(resolve=>setTimeout(resolve,180));}throw new Error(message);}
  function setText(el,text){el.focus();if(el instanceof HTMLTextAreaElement){Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,text);}else{el.replaceChildren();const p=document.createElement('p');p.textContent=text;el.append(p);}el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}));el.dispatchEvent(new Event('change',{bubbles:true}));}
  async function clearDraft(signal){
    const el=composer();if(!el)throw new Error('Mở trang chat AI và đăng nhập trước.');
    if(stopped())throw new Error('AI đang trả lời. Hãy đợi hoặc dừng câu trả lời hiện tại.');
    const scope=root(el);const remove=()=>buttons(scope).filter(b=>/remove attachment|remove file|delete attachment|xóa tệp|xoá tệp|xóa ảnh|remove image|remove upload/i.test(label(b)));
    for(const b of remove())b.click();
    await wait(()=>!remove().length&&!attachments(scope).length,10000,signal,'Không dọn được tệp đính kèm cũ. Hãy xóa tệp trong ô chat rồi chạy lại.');
    setText(el,'');
  }
  async function attach(urls,signal){
    for(let i=0;i<urls.length;i++){
      const response=await fetch(urls[i],{signal});if(!response.ok)throw new Error('Không đọc được tệp tham chiếu.');const blob=await response.blob();
      if(!/^(image|video)\//.test(blob.type)||!blob.size)throw new Error('Tệp tham chiếu không phải ảnh/video có thể đọc.');
      if(blob.size>100*1024*1024)throw new Error('Tệp tải qua tab vượt 100 MB.');
      if(isGPT&&blob.type.startsWith('video/'))throw new Error('ChatGPT tab adapter chưa xác minh hỗ trợ video gốc. Chọn Gemini.');
      const scope=root(composer());
      const accepts=input=>!input.accept||input.accept.includes('*/*')||input.accept.includes(blob.type.split('/')[0])||input.accept.includes(blob.type)||input.accept.includes('.'+blob.type.split('/')[1]);
      const input=()=>{const all=[...document.querySelectorAll('input[type="file"]')].filter(el=>!el.disabled&&accepts(el));return all.find(el=>scope.contains(el))||all[0];};
      if(!input()){
        const upload=buttons(scope).find(b=>/attach|upload|add files|thêm tệp|tải tệp|đính kèm|open.*menu/i.test(label(b)));if(upload)upload.click();
        await new Promise(resolve=>setTimeout(resolve,250));
        if(!input()){const menu=buttons().find(b=>/upload files|upload from computer|tải.*máy|tải tệp/i.test(label(b)));if(menu)menu.click();}
      }
      const field=await wait(input,5000,signal,'Không tìm thấy ô tải tệp của AI. Giao diện có thể đã thay đổi.');
      const before=new Set(attachments(scope));const dt=new DataTransfer();dt.items.add(new File([blob],`workflow-${crypto.randomUUID()}.${blob.type.split('/')[1].replace(/[^a-z0-9]/gi,'')}`,{type:blob.type}));field.files=dt.files;field.dispatchEvent(new Event('change',{bubbles:true}));
      // A FileList only proves selection, not a completed remote upload.
      await wait(()=>attachments(scope).some(el=>!before.has(el)),30000,signal,'AI chưa xác nhận tệp đính kèm; chưa gửi prompt.');
      await wait(()=>!scope.querySelector('[role="progressbar"], [aria-busy="true"]')&&Boolean(send()),90000,signal,'Tệp chưa tải xong hoặc nút Gửi chưa sẵn sàng.');
    }
  }
  async function generate(request,signal){
    await clearDraft(signal);
    const before=new Map(replies().map(el=>[el,el.innerText]));
    const el=composer();setText(el,[request.rules,request.prompt].filter(Boolean).join('\n\n'));
    await attach([...(request.referenceImages||[]),...(request.referenceVideos||[])],signal);
    const button=await wait(send,30000,signal,'Không tìm thấy nút Gửi sẵn sàng. Prompt chưa được gửi.');button.click();
    await wait(()=>!composer()||!(composer().value??composer().innerText??'').trim()||stopped()||replies().some(el=>!before.has(el)),15000,signal,'Chưa xác nhận AI nhận prompt. Không tự gửi lại để tránh trùng lặp.');
    let last='',since=Date.now();
    const result=await wait(()=>{
      const fresh=replies().filter(el=>!before.has(el)||before.get(el)!==el.innerText);const reply=fresh.at(-1);if(!reply)return false;
      const text=reply.innerText.trim();if(text!==last){last=text;since=Date.now();}
      if(stopped()||Date.now()-since<3500)return false;
      if(request.mediaType==='text')return text?{ok:true,text}:false;
      const image=[...reply.querySelectorAll('img')].filter(visible).find(img=>img.naturalWidth>=256&&img.naturalHeight>=256);
      return image?{ok:true,url:image.currentSrc||image.src}:false;
    },600000,signal,'Hết thời gian chờ kết quả AI. Kiểm tra tab AI; không tự gửi lại prompt.');
    if(result.url){const r=await fetch(result.url,{signal});if(!r.ok)throw new Error('Không tải được ảnh kết quả từ tab AI.');const blob=await r.blob();result.url=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});}
    return result;
  }
  chrome.runtime.onMessage.addListener((request,sender,respond)=>{
    if(sender.id!==chrome.runtime.id)return false;
    if(request.type==='WORKFLOW_AI_CHECK'){respond({ok:true,signedIn:!!composer(),composer:!!composer()});return false;}
    if(request.type==='WORKFLOW_AI_STOP'){active.get(request.requestId)?.abort();stopped()?.click();respond({ok:true});return false;}
    if(request.type!=='WORKFLOW_AI_GENERATE')return false;
    if(busy){respond({ok:false,error:'Tab AI đang xử lý một yêu cầu khác.'});return false;}
    busy=true;const controller=new AbortController();active.set(request.requestId,controller);
    generate(request,controller.signal).then(respond,error=>respond({ok:false,error:error.message})).finally(()=>{busy=false;active.delete(request.requestId);});return true;
  });
})();
