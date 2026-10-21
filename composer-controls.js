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
  let preferred=null;
  function scopeFor(editor){
    if(!editor)return null;
    const history='[data-message-author-role],model-response,user-query,[class*="hatch-chat-groupable-bubble"],[class*="chat-user-bubble"]';
    const form=editor.closest('form');if(form&&!form.querySelector(history))return form;
    let best=editor.parentElement;if(!best||best===document.body||best.tagName==='MAIN')return editor;
    for(let el=editor.parentElement;el&&el!==document.body&&el.tagName!=='MAIN';el=el.parentElement){if(el.querySelector(history))break;best=el;}
    return best;
  }
  function fingerprint(el){return JSON.stringify({tag:el.tagName,type:el.getAttribute('type')||'',aria:el.getAttribute('aria-label')||'',testId:el.getAttribute('data-testid')||'',svg:[...el.querySelectorAll('svg')].map(svg=>({viewBox:svg.getAttribute('viewBox')||'',shapes:[...svg.querySelectorAll('path,polyline,polygon,line,circle')].map(shape=>({tag:shape.tagName,...Object.fromEntries(['d','points','x1','y1','x2','y2','cx','cy','r'].filter(a=>shape.hasAttribute(a)).map(a=>[a,shape.getAttribute(a)]))}))}))});}
  function describe(el){const rect=el.getBoundingClientRect();return {tag:el.tagName,id:(el.id||'').slice(0,100),type:el.getAttribute('type'),role:el.getAttribute('role'),ariaLabel:(el.getAttribute('aria-label')||'').slice(0,120),title:(el.getAttribute('title')||'').slice(0,120),testId:(el.getAttribute('data-testid')||'').slice(0,120),disabled:el.matches(':disabled'),ariaDisabled:el.getAttribute('aria-disabled'),visible:visible(el),pointerEvents:getComputedStyle(el).pointerEvents,rect:{x:Math.round(rect.x),y:Math.round(rect.y),width:Math.round(rect.width),height:Math.round(rect.height)},icon:JSON.parse(fingerprint(el)).svg};}
  function bindTarget(scope,button){
    let selector=null;
    for(const attr of ['id','data-testid','aria-label','title']){const value=button.getAttribute(attr);if(!value||value.length>120)continue;const candidate=`${button.tagName.toLowerCase()}[${attr}=${CSS.escape(value)}]`;if(scope.querySelectorAll(candidate).length===1){selector=candidate;break;}}
    if(!selector){const parts=[];for(let el=button;el&&el!==scope;el=el.parentElement){const siblings=[...el.parentElement.children].filter(sibling=>sibling.tagName===el.tagName);parts.unshift(`${el.tagName.toLowerCase()}:nth-of-type(${siblings.indexOf(el)+1})`);}selector=':scope > '+parts.join(' > ');}
    return {origin:location.origin,selector,fingerprint:fingerprint(button)};
  }
  function setPreferred(record){preferred=record&&record.origin===location.origin&&typeof record.selector==='string'&&typeof record.fingerprint==='string'?record:null;}

  function findSend(scope){
    if(!scope)return null;
    if(preferred){try{const matches=[...scope.querySelectorAll(preferred.selector)];const el=matches.length===1?matches[0]:null;if(el&&visible(el)&&!el.matches(':disabled')&&el.getAttribute('aria-disabled')!=='true'&&fingerprint(el)===preferred.fingerprint)return el;}catch{/* A stale selector never authorizes a different button. */}}
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
  globalThis.WorkflowComposer={findSend,removeButtons,scopeFor,describe,bindTarget,setPreferred};
})();
