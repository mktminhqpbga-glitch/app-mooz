/* Shared desktop update panel; the Chrome extension never receives these APIs. */
(() => {
  const host=window.workflowDesktop;if(!host)return;
  window.addEventListener('DOMContentLoaded',()=>{
    const parent=document.getElementById('toolbar-panel-create')||document.querySelector('.topbar');if(!parent)return;
    const launch=document.createElement('button');launch.id='desktopUpdateButton';launch.type='button';launch.className='workflow-update-launch';launch.textContent='Cập nhật';
    const dialog=document.createElement('dialog');dialog.className='workflow-update-dialog';dialog.id='desktopUpdateDialog';
    const heading=document.createElement('h2');heading.textContent='Cập nhật Workflow';
    const version=document.createElement('p'),message=document.createElement('p');message.setAttribute('role','status');message.setAttribute('aria-live','polite');message.id='desktopUpdateStatus';
    const progress=document.createElement('progress');progress.max=100;progress.hidden=true;progress.setAttribute('aria-label','Tiến độ tải cập nhật');
    const note=document.createElement('p');note.className='workflow-update-note';note.textContent='Dự án nằm trên máy và được lưu trước khi cài. App không tự cài khi bạn thoát. Tải phần thay đổi được dùng khi có dữ liệu phù hợp; lần đầu hoặc khi cần có thể tải gói đầy đủ.';
    const actions=document.createElement('div');actions.className='workflow-update-actions';
    const close=document.createElement('button');close.textContent='Đóng';close.onclick=()=>dialog.close();
    const check=document.createElement('button');check.textContent='Kiểm tra bản mới';check.id='desktopCheckUpdate';
    const releases=document.createElement('button');releases.textContent='Trang phát hành';releases.onclick=()=>void host.call('updates.release').catch(showError);
    const install=document.createElement('button');install.textContent='Cài và khởi động lại';install.id='desktopInstallUpdate';install.hidden=true;
    actions.append(close,releases,check,install);dialog.append(heading,version,message,progress,note,actions);document.body.append(dialog);parent.append(launch);
    function showError(){message.textContent='Chưa thực hiện được thao tác cập nhật. Vui lòng thử lại.';}
    function render(state){
      version.textContent='Phiên bản hiện tại: '+state.currentVersion+(state.latestVersion?' · Bản mới: '+state.latestVersion:'');
      message.textContent=state.message;
      check.disabled=state.mode==='unavailable'||['checking','available','downloading','downloaded','installing'].includes(state.state)&&state.mode==='native';
      if(state.mode==='manual')check.disabled=state.state==='checking';
      install.hidden=state.state!=='downloaded';install.disabled=state.state==='installing';
      progress.hidden=state.state!=='downloading';if(state.progress)progress.value=state.progress.percent;else progress.removeAttribute('value');
      launch.textContent=state.state==='downloaded'?'Có cập nhật · Cài':state.state==='downloading'?'Đang tải cập nhật…':state.latestVersion?'Có bản mới':'Cập nhật';
    }
    const refresh=async()=>{try{render(await host.call('updates.status'));}catch{showError();}};
    launch.onclick=()=>{dialog.showModal();void refresh();};
    check.onclick=async()=>{check.disabled=true;try{render(await host.call('updates.check'));}catch{showError();}finally{await refresh();}};
    install.onclick=async()=>{install.disabled=true;try{render(await host.call('updates.install'));}catch{showError();}finally{await refresh();}};
    host.onEvent(event=>{if(event.type==='update')render(event.status);});void refresh();
  });
})();
