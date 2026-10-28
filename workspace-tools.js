/* Local navigation helpers; these controls never execute nodes or alter the graph. */
(()=>{
 let host,dialog,search,filter,list,summary;
 const labels={error:'Lỗi',running:'Đang chạy',queued:'Đang chờ',success:'Hoàn tất',idle:'Chưa chạy',stopped:'Đã dừng'};
 const fold=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLowerCase();
 function refresh(){
  if(!dialog?.open)return;const query=fold(search.value.trim()),rows=host.list().filter(row=>(!query||fold(row.title+' '+row.componentId+' '+row.type).includes(query))&&(filter.value==='all'||filter.value==='result'&&row.hasResult||row.status===filter.value));list.replaceChildren();summary.textContent=rows.length+' node phù hợp';
  for(const row of rows){const b=document.createElement('button');b.type='button';b.className='node-finder-result';const title=document.createElement('strong'),meta=document.createElement('small');title.textContent=row.title;meta.textContent=[labels[row.status]||row.status,row.componentId].filter(Boolean).join(' · ');b.append(title,meta);b.onclick=()=>{dialog.close();host.focus([row.id]);};list.append(b);}
  if(!rows.length){const p=document.createElement('p');p.textContent='Không thấy node phù hợp. Thử tên khác hoặc đổi bộ lọc.';list.append(p);}
 }
 function init(api){
  host=api;dialog=document.createElement('dialog');dialog.id='nodeFinderDialog';dialog.className='appearance-dialog node-finder-dialog';dialog.setAttribute('aria-labelledby','nodeFinderTitle');dialog.innerHTML='<header><div><h2 id="nodeFinderTitle">Tìm node trong workflow</h2><p>Tìm và đi tới node; thao tác này không chạy AI.</p></div><button id="nodeFinderClose" type="button">Đóng</button></header><div class="node-finder-filters"><input id="nodeFinderSearch" type="search" aria-label="Tìm theo tên hoặc mã node" placeholder="Tên node hoặc mã ID…"><select id="nodeFinderFilter" aria-label="Lọc node"><option value="all">Tất cả node</option><option value="error">Node lỗi</option><option value="idle">Chưa chạy</option><option value="result">Có kết quả</option><option value="running">Đang chạy</option><option value="queued">Đang chờ</option></select></div><p id="nodeFinderSummary" role="status"></p><div id="nodeFinderList"></div>';
  document.body.append(dialog);search=dialog.querySelector('#nodeFinderSearch');filter=dialog.querySelector('#nodeFinderFilter');list=dialog.querySelector('#nodeFinderList');summary=dialog.querySelector('#nodeFinderSummary');search.oninput=refresh;filter.onchange=refresh;dialog.querySelector('#nodeFinderClose').onclick=()=>dialog.close();search.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();list.querySelector('button')?.click();}if(e.key==='ArrowDown'){e.preventDefault();list.querySelector('button')?.focus();}};
  const tools=document.querySelector('.toolbar-tools');for(const [id,title,action]of [
   ['findNodesBtn','Tìm node',()=>{search.value='';filter.value='all';dialog.showModal();refresh();search.focus();}],
   ['selectErrorsBtn','Chọn node lỗi',()=>{const ids=host.list().filter(n=>n.status==='error').map(n=>n.id);if(ids.length)host.focus(ids);else host.notice('Workflow hiện không có node lỗi.','ok');}],
   ['focusSelectionBtn','Xem vùng đang chọn',()=>host.focus(host.selected())]
  ]){const b=document.createElement('button');b.id=id;b.type='button';b.textContent=title;b.title=title+' trong workflow hiện tại';b.onclick=action;tools.append(b);}
 }
 globalThis.WorkflowWorkspaceTools=Object.freeze({init,refresh});
})();
