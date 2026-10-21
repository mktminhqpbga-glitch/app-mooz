/* Controls are searched only inside a verified composer, never in chat history. */
(() => {
  const visible=el=>!!el?.getClientRects().length&&getComputedStyle(el).visibility!=='hidden';
  function label(el){return [el.getAttribute('aria-label'),el.getAttribute('data-testid'),el.getAttribute('title'),el.textContent,...(el.getAttribute('aria-labelledby')||'').split(/\s+/).map(id=>document.getElementById(id)?.textContent)].filter(Boolean).join(' ');}
  function icon(el,kind){
    const markup=[...el.querySelectorAll('svg,[data-icon]')].map(svg=>[svg.getAttribute('class'),svg.getAttribute('data-icon'),svg.getAttribute('data-lucide'),svg.getAttribute('data-testid')].join(' ')).join(' ');
    if(kind==='send'&&/arrow[-_ ]?up(?:\s|$)|send|paper[-_ ]?plane/i.test(markup))return true;
    if(kind==='remove'&&/(?:lucide-x(?:\s|$)|close|x-mark|xmark)/i.test(markup))return true;
    const paths=[...el.querySelectorAll('svg path')].map(path=>(path.getAttribute('d')||'').replace(/[\s,]+/g,'').toLowerCase());
    return kind==='send'?paths.some(d=>d==='m1219v5'||d==='m1219v-14'||d==='m5127-777'||d==='m512l125l1912'):
      paths.some(d=>d==='m186618'||d==='m66l1818'||d==='m186l618'||d==='m661212');
  }
  function findSend(scope){
    if(!scope)return null;
    const ranked=[...scope.querySelectorAll('button,[role="button"],input[type="submit"]')].filter(el=>visible(el)&&!el.matches(':disabled')&&el.getAttribute('aria-disabled')!=='true').map(el=>{
      const text=label(el);
      if(icon(el,'remove')||/remove|delete|attach|upload|stop|cancel|close|xóa|xoá|đính kèm|tải lên|dừng|hủy/i.test(text))return null;
      let score=0;
      if(/send|submit prompt|gửi|发送/i.test(text)||el.matches('.send-button,[data-testid="hatch-composer-send-button"]'))score=3;
      else if(icon(el,'send'))score=2;
      else if(el.matches('input[type="submit"]')||el instanceof HTMLButtonElement&&el.type==='submit'&&el.form)score=1;
      return score?{el,score}:null;
    }).filter(Boolean).sort((a,b)=>b.score-a.score);
    if(!ranked.length||ranked[1]?.score===ranked[0].score)return null;
    return ranked[0].el;
  }
  function removeButtons(scope,composer){
    if(!scope)return [];
    return [...scope.querySelectorAll('button,[role="button"]')].filter(el=>{
      if(!visible(el)||el.matches(':disabled'))return false;
      if(/remove.*(?:file|image|attachment|upload)|delete.*attachment|xóa.*(?:tệp|ảnh)|xoá.*(?:tệp|ảnh)/i.test(label(el)))return true;
      if(!icon(el,'remove')&&!/^\s*[×✕x]\s*$/i.test(el.textContent||''))return false;
      // An unlabeled X belongs to a file only when its small wrapper contains media.
      for(let node=el.parentElement,depth=0;node&&node!==scope&&depth<3;node=node.parentElement,depth++){
        if(node.contains(composer))return false;
        if(node.querySelector('img[src],video[src],[data-file-name]'))return true;
      }
      return false;
    });
  }
  globalThis.WorkflowComposer={findSend,removeButtons};
})();
