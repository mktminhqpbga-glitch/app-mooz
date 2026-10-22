/* Keep the existing action buttons and handlers; disclose groups on demand. */
(()=>{
 const header=document.querySelector('.toolbar'),brand=header.querySelector('.brand');
 const paths={create:'M12 5v14M5 12h14',library:'M4 5h6l2 2h8v13H4zM8 12h8M8 16h6',workflow:'M8 4H4v16h16v-4M8 4v5h8V4zM8 20v-7h8v7',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z',cleanup:'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6',update:'M20 7v5h-5M4 17v-5h5M5 8a8 8 0 0 1 13-3l2 3M4 16l2 3a8 8 0 0 0 13-3'};
 const groups=[['create','Tạo node',['flowStudioBtn','addNodeMenuBtn','batchImagesBtn','scriptImportBtn','masterScriptBtn','storyDashboardBtn']],['library','Kho tài nguyên',['promptLibraryBtn','mediaLibraryBtn']],['workflow','Workflow',['saveBtn','workflowExportBtn','workflowImportBtn','arrangeNodesBtn','duplicateSelectionBtn','runOptionsBtn']],['settings','Kết nối AI',['settingsBtn']],['update','Cập nhật',['packageUpdateBtn','dataUpdateBtn']],['cleanup','Dọn canvas',['clearPromptsBtn','resetBtn']]];
 const nav=document.createElement('nav');nav.className='compact-tools';nav.setAttribute('aria-label','Công cụ workflow');const panels=[];let active=null;
 function close(focus=false){if(!active)return;const current=active;active=null;current.panel.hidden=true;current.toggle.setAttribute('aria-expanded','false');if(focus)current.toggle.focus();}
 function position(entry){const r=entry.toggle.getBoundingClientRect(),panel=entry.panel;panel.style.left=Math.max(8,Math.min(r.left,innerWidth-panel.offsetWidth-8))+'px';panel.style.top=(r.bottom+8)+'px';panel.style.maxHeight=Math.max(100,innerHeight-r.bottom-24)+'px';}
 for(const [key,label,ids] of groups){
  const toggle=document.createElement('button');toggle.type='button';toggle.id='toolbar-'+key;toggle.className='compact-toggle';toggle.title=label;toggle.setAttribute('aria-label',label);toggle.setAttribute('aria-haspopup','menu');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','toolbar-panel-'+key);
  toggle.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+paths[key]+'"/></svg>';
  const panel=document.createElement('section');panel.id='toolbar-panel-'+key;panel.className='toolbar-popover';panel.hidden=true;panel.setAttribute('role','menu');panel.setAttribute('aria-label',label);const heading=document.createElement('h2');heading.textContent=label;panel.append(heading);
  for(const id of ids){const button=document.getElementById(id);button.setAttribute('role','menuitem');panel.append(button);}
  const entry={toggle,panel};panels.push(entry);document.body.append(panel);nav.append(toggle);
  toggle.onclick=()=>{const was=active===entry;close();document.getElementById('addNodeMenu').classList.add('hidden');document.getElementById('addNodeMenuBtn').setAttribute('aria-expanded','false');if(was)return;active=entry;panel.hidden=false;toggle.setAttribute('aria-expanded','true');position(entry);};
  toggle.addEventListener('keydown',event=>{if(event.key==='ArrowDown'){event.preventDefault();if(active!==entry)toggle.click();panel.querySelector('button:not(:disabled)')?.focus();}});
  panel.addEventListener('click',event=>{if(event.target.closest('button'))close();});
  panel.addEventListener('keydown',event=>{if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;event.preventDefault();const buttons=[...panel.querySelectorAll('button:not(:disabled)')],index=buttons.indexOf(document.activeElement),next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons[next]?.focus();});
 }
 const run=document.getElementById('runBtn');run.classList.add('compact-run');run.title='Chạy tất cả node · Cách nhau tối thiểu 5 giây giữa các lượt gửi AI';const input=document.getElementById('workflowFileInput');header.replaceChildren(brand,nav,run,input);header.classList.add('compact-toolbar');
 document.addEventListener('pointerdown',event=>{if(active&&!active.panel.contains(event.target)&&!nav.contains(event.target))close();},true);
 document.getElementById('addNodeMenu').addEventListener('click',event=>{if(event.target.closest('[data-add]'))document.getElementById('toolbar-create').focus();});
 window.addEventListener('keydown',event=>{if(event.code==='Space'&&event.target.closest?.('.compact-toolbar,.toolbar-popover')){event.stopImmediatePropagation();return;}if(event.key==='Escape'&&!document.getElementById('addNodeMenu').classList.contains('hidden')){event.preventDefault();event.stopImmediatePropagation();document.getElementById('addNodeMenu').classList.add('hidden');document.getElementById('addNodeMenuBtn').setAttribute('aria-expanded','false');document.getElementById('toolbar-create').focus();return;}if(event.key==='Escape'&&active){event.preventDefault();event.stopImmediatePropagation();close(true);}},true);
 document.addEventListener('focusin',event=>{if(active&&!active.panel.contains(event.target)&&!nav.contains(event.target))close();});
 window.addEventListener('keyup',event=>{if(event.code==='Space'&&event.target.closest?.('.compact-toolbar,.toolbar-popover'))event.stopImmediatePropagation();},true);
 window.addEventListener('resize',()=>{if(active)position(active);});window.addEventListener('blur',()=>close());
})();
