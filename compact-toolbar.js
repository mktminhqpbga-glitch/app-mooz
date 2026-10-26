/* Six primary actions stay visible. Secondary tools share one disclosure. */
(()=>{
 const header=document.querySelector('.toolbar'),brand=header.querySelector('.brand');
 const more=document.createElement('button');more.id='toolbar-create';more.type='button';more.className='compact-toggle studio-more';more.textContent='••• Thêm';more.setAttribute('aria-haspopup','menu');more.setAttribute('aria-expanded','false');more.setAttribute('aria-controls','toolbar-panel-create');
 const panel=document.createElement('section');panel.id='toolbar-panel-create';panel.className='toolbar-popover';panel.hidden=true;panel.setAttribute('role','menu');panel.setAttribute('aria-label','Công cụ khác');document.body.append(panel);
 const groups=[['Sáng tạo',['referenceBoardBtn','creativeToolsBtn','batchManagerBtn','flowStudioBtn','batchImagesBtn','scriptImportBtn','storyDashboardBtn']],['Tài nguyên',['promptLibraryBtn','mediaLibraryBtn']],['Dự án',['workflowExportBtn','workflowImportBtn','arrangeNodesBtn','arrangeLooseBtn','duplicateSelectionBtn','runOptionsBtn']],['Cài đặt & bảo trì',['settingsBtn','packageUpdateBtn','dataUpdateBtn','clearPromptsBtn','resetBtn']]];
 // Sidebar trái là menu chính (nhóm Sáng tạo / Tài nguyên / Dự án / Cài đặt).
 // Các nút gốc được chuyển vào sidebar, không còn là menu ••• Thêm nữa;
 // panel ••• Thêm chỉ còn giữ các nút do script khác thêm sau (Cập nhật, Giao diện).
 const sidebar=document.createElement('aside');sidebar.className='studio-sidebar';sidebar.setAttribute('aria-label','Điều hướng studio');
 const sidebarGroups=document.createElement('nav');sidebarGroups.className='studio-sidebar-groups';sidebarGroups.setAttribute('aria-label','Menu studio');
 for(const [label,ids] of groups){const section=document.createElement('section');section.className='studio-sidebar-group';const heading=document.createElement('h2');heading.textContent=label;section.append(heading);for(const id of ids){const b=document.getElementById(id);if(!b)continue;b.setAttribute('role','menuitem');section.append(b);}sidebarGroups.append(section);}
 function close(focus=false){panel.hidden=true;more.setAttribute('aria-expanded','false');if(focus)more.focus();}
 function position(){const r=more.getBoundingClientRect();panel.style.maxHeight=Math.max(100,innerHeight-24)+'px';panel.style.left=Math.max(8,Math.min(r.right-panel.offsetWidth,innerWidth-panel.offsetWidth-8))+'px';panel.style.top=Math.max(8,Math.min(r.bottom+8,innerHeight-panel.offsetHeight-12))+'px';}
 more.onclick=()=>{const open=panel.hidden;close();document.getElementById('addNodeMenu').classList.add('hidden');document.getElementById('addNodeMenuBtn').setAttribute('aria-expanded','false');if(open){panel.hidden=false;more.setAttribute('aria-expanded','true');position();}};
 more.onkeydown=e=>{if(e.key==='ArrowDown'){e.preventDefault();if(panel.hidden)more.click();panel.querySelector('button:not(:disabled)')?.focus();}};
 panel.addEventListener('click',e=>{if(e.target.closest('button'))close();});
 panel.addEventListener('keydown',e=>{if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;e.preventDefault();const buttons=[...panel.querySelectorAll('button:not(:disabled)')],i=buttons.indexOf(document.activeElement),next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons[next]?.focus();});
 const homeNav=document.createElement('nav');homeNav.className='studio-sidebar-home';homeNav.setAttribute('aria-label','Thư viện');
 if(window.workflowDesktop){const homeBtn=document.createElement('button');homeBtn.id='studioHome';homeBtn.type='button';homeBtn.title='Thư viện dự án';homeBtn.innerHTML='<span aria-hidden="true">⌂</span><span>Thư viện</span>';homeBtn.onclick=()=>void window.workflowDesktop.call('home.open');homeNav.append(homeBtn);}
 const windowNav=document.createElement('nav');windowNav.className='studio-quick-actions';windowNav.setAttribute('aria-label','Cửa sổ đang mở');
 const windowCaption=document.createElement('div');windowCaption.className='studio-nav-caption';windowCaption.textContent='CỬA SỔ';
 const footer=document.createElement('div');footer.className='studio-sidebar-footer';footer.textContent='Ý tưởng → Thành phẩm';sidebar.append(brand,homeNav,sidebarGroups,windowCaption,windowNav,footer);document.body.prepend(sidebar);
 // Thanh trên: bỏ tiêu đề “Quy trình sáng tạo”, đưa trạng thái AI / phiên bản /
 // thông báo cập nhật (hàng statusbar cũ) lên cùng hàng với các nút hành động.
 const statusCluster=document.createElement('div');statusCluster.className='studio-status-cluster';statusCluster.setAttribute('aria-label','Trạng thái AI và phiên bản');
 for(const id of ['aiHealth','checkAllAIBtn','backendStatus','updateNotice']){const el=document.getElementById(id);if(el)statusCluster.append(el);}
 const spacer=document.createElement('div');spacer.className='studio-spacer';spacer.setAttribute('aria-hidden','true');
 const connection=document.createElement('div');connection.id='studioConnections';connection.className='studio-connections';const companion=document.getElementById('desktopConnectBtn');if(companion)connection.append(companion);
 const run=document.getElementById('runBtn');run.classList.add('compact-run');run.title='Chạy các node theo thứ tự kết nối';const input=document.getElementById('workflowFileInput'),add=document.getElementById('addNodeMenuBtn'),script=document.getElementById('masterScriptBtn'),save=document.getElementById('saveBtn');add.textContent='＋ Thêm node';script.textContent='Kịch bản tổng';save.textContent='Lưu';
 header.replaceChildren(statusCluster,spacer,connection,add,script,save,run,more,input);header.classList.add('compact-toolbar');document.body.classList.add('studio-layout');
 document.addEventListener('pointerdown',e=>{if(!panel.hidden&&!panel.contains(e.target)&&!more.contains(e.target))close();},true);
 document.addEventListener('focusin',e=>{if(!panel.hidden&&!panel.contains(e.target)&&!more.contains(e.target))close();});
 window.addEventListener('keydown',e=>{if(e.code==='Space'&&e.target.closest?.('.compact-toolbar,.toolbar-popover')){e.stopImmediatePropagation();return;}if(e.key==='Escape'&&!panel.hidden){e.preventDefault();e.stopImmediatePropagation();close(true);}},true);
 window.addEventListener('keyup',e=>{if(e.code==='Space'&&e.target.closest?.('.compact-toolbar,.toolbar-popover'))e.stopImmediatePropagation();},true);
 window.addEventListener('resize',()=>{if(!panel.hidden)position();});window.addEventListener('blur',()=>close());
 function chatPlacement(){const expanded=!document.getElementById('timelineDock').classList.contains('collapsed');document.body.classList.toggle('chat-in-sidebar',expanded);
 // Sidebar mới không còn nút Chat AI, nên nút nổi Chat AI phải luôn bấm được,
 // kể cả khi dòng thời gian đang mở rộng.
 const launcher=document.getElementById('workflowChatLauncher');if(launcher)launcher.hidden=false;}
 new MutationObserver(chatPlacement).observe(document.getElementById('timelineDock'),{attributes:true,attributeFilter:['class']});chatPlacement();
})();
