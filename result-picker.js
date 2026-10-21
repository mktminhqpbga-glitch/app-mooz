/* Explicit, reviewed result import. This tool never submits a provider prompt. */
(() => {
  globalThis.WorkflowResultPicker?.cancel?.();let cancel=null;
  function pick(){
    cancel?.();return new Promise(resolve=>{
      const panel=document.createElement('section');panel.id='workflow-result-picker';panel.style.cssText='position:fixed;z-index:2147483647;top:12px;right:12px;width:min(440px,90vw);padding:14px;background:#192033;color:#fff;border:1px solid #a99aff;border-radius:12px;font:14px/1.5 system-ui;box-shadow:0 5px 30px #0009';
      const hint=document.createElement('div');hint.textContent='Bấm vào phần câu trả lời muốn lấy, hoặc bôi đen đoạn văn bản rồi bấm vào câu trả lời. Kiểm tra nội dung bên dưới trước khi đưa về Workflow.';
      const preview=document.createElement('textarea');preview.setAttribute('aria-label','Nội dung kết quả đã chọn');preview.style.cssText='box-sizing:border-box;width:100%;height:180px;margin:8px 0;background:#0d1320;color:white;white-space:pre-wrap';
      const use=document.createElement('button');use.textContent='Đưa về Workflow';use.disabled=true;const close=document.createElement('button');close.textContent='Hủy';panel.append(hint,preview,use,close);document.body.append(panel);
      let timer,finished=false;const finish=result=>{if(finished)return;finished=true;clearTimeout(timer);document.removeEventListener('click',select,true);panel.remove();cancel=null;resolve(result);};
      const select=event=>{
        if(panel.contains(event.target))return;
        if(event.target.closest('form,nav,header,#prompt-textarea,#composer-background,[data-testid="composer"],rich-textarea,textarea,[data-message-author-role="user"],[data-turn="user"]'))return;
        const selection=getSelection()?.toString().trim();
        let element=event.target.closest('[data-message-author-role="assistant"],[data-turn="assistant"],article,.markdown,.prose,pre,blockquote')||event.target.closest('div,p');
        if(!element||element.matches('body,main')||element.querySelector('#prompt-textarea,form,textarea'))return;
        event.preventDefault();event.stopImmediatePropagation();
        if(selection){preview.value=selection;}else{
          const copy=element.cloneNode(true);copy.querySelectorAll('button,header,nav,[role="toolbar"],script,style').forEach(el=>el.remove());copy.querySelectorAll('br').forEach(el=>el.replaceWith(document.createTextNode('\n')));copy.querySelectorAll('p,div,li,pre,blockquote,h1,h2,h3,h4').forEach(el=>el.append(document.createTextNode('\n')));preview.value=(copy.textContent||'').replace(/\n{3,}/g,'\n\n').trim();
        }
        use.disabled=!preview.value.trim();hint.textContent='Kiểm tra đây là toàn bộ kết quả bạn muốn đưa vào node. Có thể sửa nội dung trước khi xác nhận.';
      };
      preview.oninput=()=>use.disabled=!preview.value.trim();use.onclick=()=>finish({ok:true,text:preview.value.trim()});close.onclick=()=>finish({ok:false,error:'Đã hủy chọn kết quả.'});cancel=()=>finish({ok:false,error:'Đã hủy chọn kết quả.'});document.addEventListener('click',select,true);timer=setTimeout(()=>finish({ok:false,error:'Hết thời gian chọn kết quả (5 phút).'}),300000);
    });
  }
  globalThis.WorkflowResultPicker={pick,cancel:()=>cancel?.()};
})();
