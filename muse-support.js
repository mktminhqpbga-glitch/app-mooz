/* Explicit support tools: no prompt, response, image URL or credential contents collected. */
(() => {
  globalThis.WorkflowMuseSupport?.cancelBinding?.();
  let cancelBinding=null;
  const visible=el=>!!el?.getClientRects().length&&getComputedStyle(el).visibility!=='hidden';
  const editor=()=>[...document.querySelectorAll('textarea')].find(el=>visible(el)&&!el.disabled&&!el.readOnly);
  function mediaDiagnostics(){
    const describe=el=>({tag:el.tagName,className:String(el.getAttribute('class')||'').slice(0,180),role:el.getAttribute('role'),testId:(el.getAttribute('data-testid')||'').slice(0,120),display:getComputedStyle(el).display,visible:visible(el),busy:el.getAttribute('aria-busy')});
    return {bridge:globalThis.WorkflowMuseBridgeDiagnostics?.()||{version:globalThis.__museFlowBridgeVersion||null},videos:[...document.querySelectorAll('video')].slice(0,20).map(video=>{const ancestors=[];for(let el=video;el&&ancestors.length<8;el=el.parentElement)ancestors.push(describe(el));const src=video.currentSrc||video.src||video.querySelector('source')?.src||video.getAttribute('data-src')||'';return {hasSource:!!src,sourceScheme:/^([a-z]+):/i.exec(src)?.[1]||null,hasPoster:!!video.poster,readyState:video.readyState,networkState:video.networkState,errorCode:video.error?.code||null,width:video.videoWidth,height:video.videoHeight,ancestors};}),frames:[...document.querySelectorAll('iframe')].slice(0,10).map(describe),openShadowRoots:[...document.querySelectorAll('*')].filter(el=>el.shadowRoot).length};
  }
  function diagnostics(){
    const input=editor(),scope=WorkflowComposer.scopeFor(input);
    return {media:mediaDiagnostics(),origin:location.origin,documentReady:document.readyState,visibility:document.visibilityState,focused:document.hasFocus(),editor:input?{tag:input.tagName,id:input.id,disabled:input.disabled,readOnly:input.readOnly,hasText:!!input.value.trim()}:null,scope:scope?{tag:scope.tagName,id:scope.id,buttons:scope.querySelectorAll('button,[role="button"],input[type="submit"]').length}:null,selectedSend:scope&&WorkflowComposer.findSend(scope)?WorkflowComposer.describe(WorkflowComposer.findSend(scope)):null,controls:scope?[...scope.querySelectorAll('button,[role="button"],input[type="submit"]')].slice(0,40).map(WorkflowComposer.describe):[]};
  }
  function bindSend(){
    if(cancelBinding)cancelBinding();
    const input=editor(),scope=WorkflowComposer.scopeFor(input);
    if(!input||!scope)return Promise.resolve({ok:false,error:'Không tìm thấy ô nhập Muse. Mở trang chat rồi thử lại.'});
    return new Promise(resolve=>{
      const banner=document.createElement('div');banner.id='workflow-muse-bind-banner';banner.style.cssText='position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#17243a;color:white;padding:14px;border-radius:10px;max-width:600px;font:14px/1.5 system-ui;box-shadow:0 4px 20px #0008';
      const text=document.createElement('span');text.textContent='Bấm đúng mũi tên Gửi của Muse để ghi nhớ. Lần bấm chọn này không gửi bản nháp. ';
      const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Hủy';banner.append(text,cancel);document.body.append(banner);
      let timer,finished=false;
      function finish(result){if(finished)return;finished=true;clearTimeout(timer);window.removeEventListener('click',pick,true);banner.remove();cancelBinding=null;resolve(result);}
      cancel.onclick=()=>finish({ok:false,error:'Đã hủy chọn nút Gửi.'});cancelBinding=()=>finish({ok:false,error:'Đã hủy chọn nút Gửi.'});
      async function pick(event){
        if(banner.contains(event.target))return;
        const button=event.target.closest('button,[role="button"],input[type="submit"]');const currentInput=editor(),currentScope=WorkflowComposer.scopeFor(currentInput);
        if(!button||!currentScope?.contains(button))return;
        event.preventDefault();event.stopImmediatePropagation();
        if(WorkflowComposer.removeButtons(currentScope,currentInput).includes(button)||/upload|attach|stop|cancel|tải lên|đính kèm|dừng|hủy/i.test([button.getAttribute('aria-label'),button.getAttribute('title'),button.getAttribute('data-testid')].join(' '))){text.textContent='Đây là nút tải/xóa tệp hoặc dừng. Hãy chọn mũi tên Gửi. ';return;}
        try{const record=WorkflowComposer.bindTarget(currentScope,button);await chrome.storage.local.set({workflowMuseSendTarget:record});WorkflowComposer.setPreferred(record);finish({ok:true,control:WorkflowComposer.describe(button)});}catch{finish({ok:false,error:'Không lưu được nút Gửi. Hãy tải lại extension rồi thử lại.'});}
      }
      window.addEventListener('click',pick,true);timer=setTimeout(()=>finish({ok:false,error:'Hết thời gian chọn nút Gửi (60 giây).'}),60000);
    });
  }
  globalThis.WorkflowMuseSupport={diagnostics,bindSend,cancelBinding:()=>cancelBinding?.()};
})();
