/* Story review desk. Rendering never submits an AI request. */
(()=>{
 let api,scopeId=null,last='',working=false,issues=[],notice='';
 const dialog=document.createElement('dialog');dialog.id='storyDashboardDialog';dialog.className='story-dashboard';
 dialog.innerHTML='<header><h2>Bảng điều khiển kịch bản</h2><button type="button" data-close>Đóng</button></header><label>Phạm vi<select aria-label="Phạm vi kịch bản"></select></label><p data-summary role="status"></p><p class="story-hint">1. Kiểm tra → 2. Tạo ảnh → 3. Duyệt ảnh → 4. Tạo video và ghép. Đóng bảng vẫn giữ tác vụ đang chạy. Kiểm tra cấu hình không xác nhận được hạn mức hoặc đăng nhập trên trang AI.</p><div class="story-actions" data-actions></div><section data-issues aria-label="Các mục cần kiểm tra"></section><div class="story-scene-list"></div>';
 document.body.append(dialog);
 const select=dialog.querySelector('select'),summary=dialog.querySelector('[data-summary]'),actions=dialog.querySelector('[data-actions]'),list=dialog.querySelector('.story-scene-list'),issueBox=dialog.querySelector('[data-issues]');
 function text(parent,tag,value){const el=document.createElement(tag);el.textContent=value;parent.append(el);return el;}
 function button(parent,name,action,disabled=false){const el=text(parent,'button',name);el.type='button';el.disabled=disabled;el.onclick=()=>void Promise.resolve().then(action).catch(error=>{issues=[{message:error.message}];drawIssues();});return el;}
 function drawIssues(){issueBox.replaceChildren();if(!issues.length)return;text(issueBox,'h3','Cần kiểm tra ('+issues.length+')');for(const issue of issues){const row=document.createElement('p');text(row,'span',issue.message+' ');if(issue.id)button(row,'Đi tới node',()=>{dialog.close();api.focus(issue.id);});issueBox.append(row);}}
 async function work(action){if(working)return;working=true;last='';draw();try{const result=await action();if(result?.issues)issues=result.issues;}finally{working=false;last='';draw();}}
 function draw(){
  if(!api||!dialog.open)return;const data=api.read(scopeId);scopeId=data.scope?.id||null;
  const stamp=JSON.stringify([scopeId,notice,working,data.busy,data.batch,data.review,data.downloadReady,data.groups.map(n=>[n.id,api.name(n),n.data.asset?.id,n.data.storyDirty]),data.scenes.map(s=>[s.image.id,s.image.data.asset?.id,s.image.data.status,s.image.data.error,s.fresh,s.approved,s.busy,s.video?.data.status,s.video?.data.asset?.id,s.video?.data.storyDirty])]);
  if(stamp===last)return;last=stamp;
  select.replaceChildren();for(const n of data.groups){const option=document.createElement('option');option.value=n.id;option.textContent=({masterScript:'',actScript:'↳ ',partScript:'　↳ ',segmentScript:'　　↳ '}[n.type]||'')+api.name(n);select.append(option);}select.value=scopeId||'';select.disabled=working;
  const count=data.scenes.length,ready=data.scenes.filter(s=>s.fresh).length,approved=data.scenes.filter(s=>s.approved).length,videos=data.scenes.filter(s=>s.video?.data.asset?.url&&!s.video.data.storyDirty).length;
  summary.textContent=(count?`Ảnh ${ready}/${count} · Đã duyệt ${approved}/${count} · Video ${videos}/${count}`:'Chưa có cảnh. Nhập Kịch bản tổng và bấm Tạo node cho các hồi trước.')+(notice?' '+notice:'');
  actions.replaceChildren();const locked=working||data.busy;
  button(actions,'Kiểm tra trước khi chạy',()=>work(async()=>{issues=await api.checkScope(scopeId);notice=issues.length?'':'Cấu hình hiện tại không có mục cần sửa.';}),locked||!count);
  button(actions,'Tạo ảnh còn thiếu / đã đổi',()=>work(async()=>{issues=[];return api.images(scopeId);}),locked||!count);
  button(actions,'Duyệt tất cả ảnh hiện tại',()=>{api.approve(data.scenes.filter(s=>s.fresh&&!s.approved).map(s=>s.image.id));last='';draw();},locked||!data.scenes.some(s=>s.fresh&&!s.approved));
  button(actions,'Tạo video và ghép',()=>work(async()=>{issues=await api.checkScope(scopeId);if(issues.length)return;await api.run(scopeId);}),locked||!count);
  button(actions,'Dừng tạo ảnh',()=>api.stop(),!data.batch);
  button(actions,'Tải video phạm vi này',()=>api.download(scopeId),locked||!data.downloadReady);
  if(!data.review&&count)text(actions,'small','Bản dựng này đang tắt bước duyệt ảnh. Có thể bật ở Kịch bản tổng.');
  list.replaceChildren();for(const scene of data.scenes){const card=document.createElement('article');card.className='story-scene';card.dataset.image=scene.image.id;
   text(card,'h3',scene.image.data.sceneLabel||api.name(scene.image));
   if(scene.image.data.asset?.url){const image=document.createElement('img');image.src=scene.image.data.asset.url;image.alt=scene.image.data.sceneLabel||'Ảnh cảnh';image.loading='lazy';card.append(image);}
   const status=scene.image.data.error||(!scene.fresh?'Chưa có ảnh mới':scene.approved?'Đã duyệt ảnh':'Chờ duyệt ảnh');text(card,'p',status);
   if(scene.video?.data.error)text(card,'p','Video: '+scene.video.data.error);
   const row=document.createElement('div');row.className='story-actions';
   button(row,'Duyệt ảnh',()=>{api.approve([scene.image.id]);last='';draw();},locked||!scene.fresh||scene.approved);
   button(row,'Tạo lại ảnh',()=>work(async()=>{issues=[];return api.images(scopeId,scene.image.id);}),locked);
   if(scene.promptId)button(row,'Sửa prompt',()=>{dialog.close();api.focus(scene.promptId);});
   button(row,'Xem node ảnh / chọn tab',()=>{dialog.close();api.focus(scene.image.id);});
   if(scene.video)button(row,'Xem node video',()=>{dialog.close();api.focus(scene.video.id);});card.append(row);list.append(card);
  }
  drawIssues();
 }
 select.onchange=()=>{scopeId=select.value;issues=[];notice='';last='';draw();};dialog.querySelector('[data-close]').onclick=()=>dialog.close();
 const open=id=>{scopeId=id||null;issues=[];notice='';last='';if(!dialog.open)dialog.showModal();draw();};
 setInterval(()=>{if(dialog.open)draw();},1000);
 globalThis.WorkflowStoryDashboard={bind:value=>{api=value;const b=document.getElementById('storyDashboardBtn');if(b)b.onclick=()=>open();},open,showIssues:(id,items)=>{const data=api.read(id);const n=data.scope;open(['masterScript','actScript','partScript','segmentScript'].includes(n?.type)?n.id:n?.data.storyMasterId);issues=items;drawIssues();}};
})();
