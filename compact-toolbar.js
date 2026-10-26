/* Six primary actions stay visible. Secondary tools share one disclosure. */
(()=>{
 const header=document.querySelector('.toolbar'),brand=header.querySelector('.brand');
 const more=document.createElement('button');more.id='toolbar-create';more.type='button';more.className='compact-toggle studio-more';more.textContent='••• Thêm';more.setAttribute('aria-haspopup','menu');more.setAttribute('aria-expanded','false');more.setAttribute('aria-controls','toolbar-panel-create');
 const panel=document.createElement('section');panel.id='toolbar-panel-create';panel.className='toolbar-popover';panel.hidden=true;panel.setAttribute('role','menu');panel.setAttribute('aria-label','Công cụ khác');document.body.append(panel);
 const groups=[['Sáng tạo',['referenceBoardBtn','creativeToolsBtn','batchManagerBtn','flowStudioBtn','batchImagesBtn','scriptImportBtn','storyDashboardBtn']],['Tài nguyên',['promptLibraryBtn','mediaLibraryBtn']],['Dự án',['workflowExportBtn','workflowImportBtn','arrangeNodesBtn','arrangeLooseBtn','duplicateSelectionBtn','runOptionsBtn']],['Cài đặt & bảo trì',['settingsBtn','packageUpdateBtn','dataUpdateBtn','clearPromptsBtn','resetBtn']]];
 for(const [label,ids] of groups){const heading=document.createElement('h2');heading.textContent=label;panel.append(heading);for(const id of ids){const b=document.getElementById(id);b.setAttribute('role','menuitem');panel.append(b);}}
 function close(focus=false){panel.hidden=true;more.setAttribute('aria-expanded','false');if(focus)more.focus();}
 function position(){const r=more.getBoundingClientRect();panel.style.maxHeight=Math.max(100,innerHeight-24)+'px';panel.style.left=Math.max(8,Math.min(r.right-panel.offsetWidth,innerWidth-panel.offsetWidth-8))+'px';panel.style.top=Math.max(8,Math.min(r.bottom+8,innerHeight-panel.offsetHeight-12))+'px';}
 more.onclick=()=>{const open=panel.hidden;close();document.getElementById('addNodeMenu').classList.add('hidden');document.getElementById('addNodeMenuBtn').setAttribute('aria-expanded','false');if(open){panel.hidden=false;more.setAttribute('aria-expanded','true');position();}};
 more.onkeydown=e=>{if(e.key==='ArrowDown'){e.preventDefault();if(panel.hidden)more.click();panel.querySelector('button:not(:disabled)')?.focus();}};
 panel.addEventListener('click',e=>{if(e.target.closest('button'))close();});
 panel.addEventListener('keydown',e=>{if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;e.preventDefault();const buttons=[...panel.querySelectorAll('button:not(:disabled)')],i=buttons.indexOf(document.activeElement),next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons[next]?.focus();});
 const sidebar=document.createElement('aside');sidebar.className='studio-sidebar';sidebar.setAttribute('aria-label','Điều hướng studio');
 const quick=document.createElement('nav');quick.className='studio-quick-actions';quick.setAttribute('aria-label','Công cụ chính');
 function quickButton(id,label,mark,click){const b=document.createElement('button');b.id=id;b.type='button';b.title=label;b.innerHTML='<span aria-hidden="true">'+mark+'</span><span>'+label+'</span>';b.onclick=()=>{close();click();};quick.append(b);return b;}
 if(window.workflowDesktop)quickButton('studioHome','Dự án','⌂',()=>void window.workflowDesktop.call('home.open'));
 for(const [id,label,mark] of [['referenceBoardBtn','Ảnh tham chiếu','▧'],['creativeToolsBtn','Trợ lý sáng tạo','✧']])quickButton('studioQuick-'+id,label,mark,()=>document.getElementById(id).click());
 if(window.workflowDesktop)quickButton('studioPosting','Đăng bài','↗',()=>void window.workflowDesktop.call('posting.open'));
 quickButton('studioChat','Chat AI','☵',()=>document.getElementById('workflowChatLauncher').click());
 const footer=document.createElement('div');footer.className='studio-sidebar-footer';footer.textContent='Ý tưởng → Thành phẩm';sidebar.append(brand,quick,footer);document.body.prepend(sidebar);
 const heading=document.createElement('div');heading.className='studio-heading';heading.innerHTML='<strong>Quy trình sáng tạo</strong>';
 const connection=document.createElement('div');connection.id='studioConnections';connection.className='studio-connections';const companion=document.getElementById('desktopConnectBtn');if(companion)connection.append(companion);
 const run=document.getElementById('runBtn');run.classList.add('compact-run');run.title='Chạy các node theo thứ tự kết nối';const input=document.getElementById('workflowFileInput'),add=document.getElementById('addNodeMenuBtn'),script=document.getElementById('masterScriptBtn'),save=document.getElementById('saveBtn');add.textContent='＋ Thêm node';script.textContent='Kịch bản tổng';save.textContent='Lưu';
 header.replaceChildren(heading,connection,add,script,save,run,more,input);header.classList.add('compact-toolbar');document.body.classList.add('studio-layout');
 document.addEventListener('pointerdown',e=>{if(!panel.hidden&&!panel.contains(e.target)&&!more.contains(e.target))close();},true);
 document.addEventListener('focusin',e=>{if(!panel.hidden&&!panel.contains(e.target)&&!more.contains(e.target))close();});
 window.addEventListener('keydown',e=>{if(e.code==='Space'&&e.target.closest?.('.compact-toolbar,.toolbar-popover')){e.stopImmediatePropagation();return;}if(e.key==='Escape'&&!panel.hidden){e.preventDefault();e.stopImmediatePropagation();close(true);}},true);
 window.addEventListener('keyup',e=>{if(e.code==='Space'&&e.target.closest?.('.compact-toolbar,.toolbar-popover'))e.stopImmediatePropagation();},true);
 window.addEventListener('resize',()=>{if(!panel.hidden)position();});window.addEventListener('blur',()=>close());
 function chatPlacement(){const expanded=!document.getElementById('timelineDock').classList.contains('collapsed');document.body.classList.toggle('chat-in-sidebar',expanded);const launcher=document.getElementById('workflowChatLauncher');if(launcher)launcher.hidden=expanded;}
 new MutationObserver(chatPlacement).observe(document.getElementById('timelineDock'),{attributes:true,attributeFilter:['class']});chatPlacement();
})();
