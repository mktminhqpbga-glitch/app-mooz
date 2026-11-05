'use strict';

(() => {
  const api = window.workflowHome;
  const $ = id => document.getElementById(id);
  let projects = [];
  let recentOnly = false;
  let namingProject = null;
  let restoringProject = null;
  let deletingProject = null;
  const deletedProjects = [];
  let deleting = false;
  let opening = false;
  let refreshRevision = 0;

  function status(message = '', error = false) {
    $('libraryStatus').textContent = message;
    $('libraryStatus').classList.toggle('error', error);
  }

  function displayError(error) {
    return String(error?.message || error || 'Có lỗi xảy ra. Vui lòng thử lại.').replace(/^Error invoking remote method '[^']+': Error: /, '');
  }

  function dateLabel(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return 'Cần kiểm tra dữ liệu';
    return 'Đã sửa ' + new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
  }

  async function refresh() {
    const revision = ++refreshRevision;
    try {
      const latest = await api.listProjects();
      if(revision !== refreshRevision)return;
      projects = latest;
      if (!Array.isArray(projects)) throw new Error('Không đọc được danh sách dự án.');
      status();
      render();
    } catch (error) { if(revision===refreshRevision)status(displayError(error), true); }
  }

  async function open(project) {
    if (opening) return;
    if (project.recoveryRequired) { status(project.error || 'Dự án cần khôi phục trước khi mở.', true); return; }
    opening = true;
    status('Đang mở ' + project.name + '…');
    try { await api.openProject(project.id); }
    catch (error) { status(displayError(error), true); }
    finally { opening = false; }
  }

  function nameDialog(project = null) {
    namingProject = project;
    $('nameDialogTitle').textContent = project ? 'Đổi tên dự án' : 'Dự án mới';
    $('submitName').textContent = project ? 'Lưu tên' : 'Tạo dự án';
    $('projectName').value = project?.name || '';
    $('nameError').textContent = '';
    $('nameDialog').showModal();
    $('projectName').focus();
    if (project) $('projectName').select();
  }

  function restoreDialog(project) {
    restoringProject = project;
    $('restoreDescription').textContent = 'Khôi phục “' + project.name + '” về bản lưu trước gần nhất? Các thay đổi sau bản đó sẽ không còn trong phiên bản đang dùng.';
    $('restoreError').textContent = '';
    $('restoreDialog').showModal();
  }

  function deleteDialog(project) {
    if (deleting) return;
    deletingProject = project;
    $('deleteDescription').textContent = 'Bạn muốn xóa dự án “' + project.name + '”?';
    $('deleteError').textContent = '';
    $('deleteDialog').showModal();
    $('cancelDelete').focus();
  }

  function renderDeleteNotice() {
    const last = deletedProjects.at(-1);
    $('deleteNotice').hidden = !last;
    $('deleteNoticeText').textContent = last ? 'Đã xóa “' + last.name + '” khỏi thư viện.' : '';
  }

  function card(project) {
    const article = document.createElement('article');
    article.className = 'project-card';
    const button = document.createElement('button');
    button.className = 'project-open';
    button.type = 'button';
    button.setAttribute('aria-label', 'Mở dự án ' + project.name + ' trong Canvas Studio');
    button.title = 'Mở ' + project.name + ' trong Canvas Studio';
    button.onclick = () => void open(project);
    const art = document.createElement('div');
    art.className = 'project-art';
    art.setAttribute('aria-hidden', 'true');
    const preview = project.thumbnail || project.previewImage;
    if (typeof preview === 'string' && /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(preview) && preview.length < 2 * 1024 * 1024) {
      const image = document.createElement('img');
      image.src = preview;
      image.alt = '';
      image.loading = 'lazy';
      image.onerror = () => image.remove();
      art.append(image);
    }
    const canvasIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    canvasIcon.setAttribute('viewBox', '0 0 24 24');
    const canvasPath = document.createElementNS(canvasIcon.namespaceURI, 'path');
    canvasPath.setAttribute('d', 'M3 3h18v18H3zM3 15l5-5 5 5 3-3 5 5M8 7h.01');
    canvasIcon.append(canvasPath);
    const previewLabel = document.createElement('span');
    previewLabel.textContent = 'Mở canvas';
    art.append(canvasIcon, previewLabel);
    const info = document.createElement('div');
    info.className = 'project-info';
    const title = document.createElement('h3');
    title.textContent = project.name;
    title.title = project.name;
    const date = document.createElement('p');
    date.className = 'project-date';
    date.textContent = dateLabel(project.updatedAt);
    const kind = document.createElement('span');
    kind.className = 'project-canvas-label';
    kind.textContent = 'Canvas Studio';
    info.append(kind, title, date);
    if (project.recoveryRequired) {
      const warning = document.createElement('p');
      warning.className = 'recovery-label';
      warning.textContent = project.canRestore ? 'Cần khôi phục · Có bản lưu trước' : 'Dữ liệu cần kiểm tra · Tệp gốc được giữ nguyên';
      info.append(warning);
    }
    button.append(art, info);
    const actions = document.createElement('div');
    actions.className = 'project-actions';
    const rename = document.createElement('button');
    rename.type = 'button';
    rename.textContent = 'Đổi tên';
    rename.disabled = !!project.recoveryRequired;
    rename.onclick = () => nameDialog(project);
    const restore = document.createElement('button');
    restore.type = 'button';
    restore.textContent = 'Khôi phục bản trước';
    restore.disabled = !project.canRestore;
    restore.title = project.canRestore ? 'Dùng lại bản lưu trước gần nhất' : 'Chưa có bản lưu trước';
    restore.onclick = () => restoreDialog(project);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'project-delete';
    remove.textContent = 'Xóa';
    remove.setAttribute('aria-label', 'Xóa dự án ' + project.name);
    remove.onclick = () => deleteDialog(project);
    actions.append(rename, restore, remove);
    article.append(button, actions);
    return article;
  }

  let guideInitialized=false;
  function render() {
    if(!guideInitialized){$('homeGuide').open=false;guideInitialized=true;}
    const query = $('searchProjects').value.trim().toLocaleLowerCase('vi');
    const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const visible = projects.filter(project => (!recentOnly || Date.parse(project.updatedAt) >= since) && project.name.toLocaleLowerCase('vi').includes(query));
    $('libraryHeading').textContent = recentOnly ? 'Trong 7 ngày qua' : 'Tất cả dự án';
    $('projectCount').textContent = String(visible.length);
    $('projectGrid').replaceChildren(...visible.map(card));
    $('emptyState').hidden = visible.length !== 0;
    const filtered = !!query || recentOnly;
    $('emptyTitle').textContent = filtered ? 'Chưa tìm thấy dự án phù hợp' : 'Chưa có canvas nào';
    $('emptyDescription').textContent = filtered ? 'Thử tên khác hoặc chọn Tất cả dự án.' : 'Tạo canvas đầu tiên để bắt đầu.';
    $('emptyCreate').hidden = filtered;
  }

  $('allProjects').onclick = () => {
    recentOnly = false;
    $('allProjects').classList.add('selected');
    $('allProjects').setAttribute('aria-current', 'page');
    $('recentProjects').classList.remove('selected');
    $('recentProjects').removeAttribute('aria-current');
    render();
  };
  $('recentProjects').onclick = () => {
    recentOnly = true;
    $('recentProjects').classList.add('selected');
    $('recentProjects').setAttribute('aria-current', 'page');
    $('allProjects').classList.remove('selected');
    $('allProjects').removeAttribute('aria-current');
    render();
  };
  let launchingApp = false;
  let pickerRevision = 0;
  let pickerLoading = false;
  let pickerProjects = [];
  $('aiAppsBatch').onclick=()=>void window.workflowDesktop.call('batch.open').catch(error=>status(displayError(error),true));
  $('aiAppsAffiliate').onclick=()=>void window.workflowDesktop.call('affiliate.open').catch(error=>status(displayError(error),true));
  $('aiAppsHubPosting').onclick=()=>void window.workflowDesktop.call('posting.open',{view:'overview'}).catch(error=>status(displayError(error),true));
  $('aiAppsWorkflow').onclick = () => pickProject('canvas');
  $('homeOpenCanvas').onclick = () => pickProject('canvas');
  let appTool = 'canvas';
  function pickProject(tool) {if(launchingApp || pickerLoading && tool===appTool && $('appProjectDialog').open)return;appTool=tool;$('appProjectTitle').textContent=tool==='agent'?'MooZ Agent':tool==='voiceover'?'Lồng tiếng trong canvas':'Mở Canvas Studio';$('appProjectDescription').textContent=tool==='voiceover'?'Chọn dự án, thêm node Lồng tiếng và kết nối OpenAI API. Dịch vụ có thể tính phí.':'Chọn dự án để mở Canvas Studio.';$('appProjectOpen').textContent=tool==='voiceover'?'Mở canvas lồng tiếng':tool==='agent'?'Mở MooZ Agent':'Mở Canvas Studio';$('appProjectNew').textContent=tool==='voiceover'?'＋ Dự án lồng tiếng':'＋ Canvas mới';void selectProject();}
  $('aiAppsAgent').onclick=()=>pickProject('agent');
  $('aiAppsVoice').onclick = ()=>pickProject('voiceover');
  async function selectProject() {
    const revision = ++pickerRevision;
    const dialog = $('appProjectDialog');
    const select = $('appProjectSelect');
    const previous = select.value;
    pickerLoading = true;
    pickerProjects = [];
    $('appProjectError').textContent = '';
    select.replaceChildren(new Option('Đang mở danh sách dự án…', ''));
    select.disabled = true;
    $('appProjectOpen').disabled = true;
    $('appProjectNew').disabled = true;
    if (!dialog.open) dialog.showModal();
    try {
      // The picker owns this result; project-grid refreshes must not supersede it.
      const latest = await api.listProjects();
      if (revision !== pickerRevision || !dialog.open || launchingApp) return;
      if (!Array.isArray(latest)) throw Error('Không đọc được danh sách dự án.');
      pickerProjects = [...new Map(latest.map(project => [project.id, project])).values()];
      select.replaceChildren(...pickerProjects.map(project => {
        const option = new Option(project.name, project.id);
        option.disabled = !!project.recoveryRequired;
        return option;
      }));
      const ready = pickerProjects.filter(project => !project.recoveryRequired);
      const selected = ready.find(project => project.id === previous) || ready[0];
      if (!selected) select.append(new Option('Chưa có dự án sẵn sàng', ''));
      select.value = selected?.id || '';
      select.disabled = !selected;
      $('appProjectOpen').disabled = !selected;
    } catch (error) {
      if (revision !== pickerRevision || !dialog.open || launchingApp) return;
      select.replaceChildren(new Option('Chưa đọc được danh sách dự án', ''));
      select.disabled = true;
      $('appProjectOpen').disabled = true;
      $('appProjectError').textContent = displayError(error);
    } finally {
      if (revision === pickerRevision && !launchingApp) {
        pickerLoading = false;
        $('appProjectNew').disabled = false;
      }
    }
  }
  $('appProjectDialog').addEventListener('cancel',event=>{if(launchingApp)event.preventDefault();else{pickerRevision++;pickerLoading=false;}});
  $('appProjectDialog').addEventListener('close',()=>{if(!$('appProjectDialog').open){pickerRevision++;pickerLoading=false;}});
  $('appProjectCancel').onclick = () => { if (!launchingApp) { pickerRevision++;pickerLoading=false;$('appProjectDialog').close(); } };
  async function launchProject(createNew = false) {
    if (launchingApp || pickerLoading) return;
    launchingApp = true;
    const tool = appTool;
    $('appProjectError').textContent = '';
    for (const id of ['appProjectCancel', 'appProjectNew', 'appProjectOpen']) $(id).disabled = true;
    try {
      const id = createNew ? (await api.createProject(tool==='voiceover'?'Lồng tiếng':'Dự án mới')).id : $('appProjectSelect').value;
      if (!id || !createNew && !pickerProjects.some(project => project.id===id && !project.recoveryRequired)) throw Error('Chọn dự án hoặc tạo một dự án mới.');
      await api.openProject(id, tool==='canvas'?undefined:tool);
      $('appProjectDialog').close();
    } catch (error) {
      $('appProjectError').textContent = displayError(error);
    } finally {
      launchingApp = false;
      for (const id of ['appProjectCancel', 'appProjectNew']) $(id).disabled = false;
      $('appProjectOpen').disabled = !$('appProjectSelect').value;
    }
  }
  $('appProjectOpen').onclick = () => void launchProject(false);
  $('appProjectNew').onclick = () => void launchProject(true);
  $('searchProjects').oninput = render;
  $('newProject').onclick = () => nameDialog();
  $('emptyCreate').onclick = () => nameDialog();
  $('nameDialog').addEventListener('cancel',event=>{if($('submitName').disabled)event.preventDefault();});
  $('restoreDialog').addEventListener('cancel',event=>{if($('confirmRestore').disabled)event.preventDefault();});
  $('cancelName').onclick = () => $('nameDialog').close();
  $('cancelRestore').onclick = () => $('restoreDialog').close();
  $('cancelDelete').onclick = () => { if (!deleting) $('deleteDialog').close(); };
  $('deleteDialog').addEventListener('cancel', event => { if (deleting) event.preventDefault(); });
  $('confirmDelete').onclick = async () => {
    if (!deletingProject || deleting) return;
    deleting = true;
    $('confirmDelete').disabled = $('cancelDelete').disabled = true;
    $('deleteError').textContent = '';
    try {
      await api.deleteProject(deletingProject.id);
      deletedProjects.push(deletingProject);
      $('deleteDialog').close();
      deletingProject = null;
      await refresh();
      renderDeleteNotice();
    } catch (error) { $('deleteError').textContent = displayError(error); }
    finally {
      deleting = false;
      $('confirmDelete').disabled = $('cancelDelete').disabled = false;
    }
  };
  $('undoDelete').onclick = async () => {
    const project = deletedProjects.at(-1);
    if (!project || deleting) return;
    deleting = true;
    $('undoDelete').disabled = true;
    try {
      await api.undoDeleteProject(project.id);
      deletedProjects.pop();
      await refresh();
      renderDeleteNotice();
      status('Đã khôi phục dự án “' + project.name + '”.');
    } catch (error) { status(displayError(error), true); }
    finally { deleting = false; $('undoDelete').disabled = false; }
  };

  $('nameForm').onsubmit = async event => {
    event.preventDefault();
    if($('submitName').disabled)return;
    const name = $('projectName').value.trim();
    if (!name || name.length > 100 || /[\u0000-\u001f]/.test(name)) {
      $('nameError').textContent = 'Nhập tên từ 1 đến 100 ký tự, không chứa ký tự điều khiển.';
      return;
    }
    $('submitName').disabled = true;
    $('cancelName').disabled = true;
    try {
      if (namingProject) {
        await api.renameProject(namingProject.id, name);
        $('nameDialog').close();
        await refresh();
      } else {
        const project = await api.createProject(name);
        $('nameDialog').close();
        await refresh();
        await open(project);
      }
    } catch (error) { $('nameError').textContent = displayError(error); }
    finally { $('submitName').disabled = false; $('cancelName').disabled = false; }
  };

  $('connectChrome').onclick = async event => {
    event.preventDefault();event.stopPropagation();
    $('connectChrome').disabled = true;
    try {
      const pairing = await api.connectChrome();
      if (!pairing || typeof pairing.url !== 'string' || !pairing.url) throw new Error('Không tạo được mã kết nối Chrome.');
      $('chromePairing').value = pairing.url;
      $('chromeStatus').textContent = '';
      $('chromeDialog').showModal();
    } catch (error) { status(displayError(error), true); }
    finally { $('connectChrome').disabled = false; }
  };
  $('closeChrome').onclick = () => $('chromeDialog').close();
  $('chromeDialog').addEventListener('close', () => { $('chromePairing').value = ''; $('chromePairing').type = 'password'; $('revealChrome').textContent = 'Hiện mã'; $('revealChrome').setAttribute('aria-pressed', 'false'); });
  $('revealChrome').onclick = () => { const show = $('chromePairing').type === 'password'; $('chromePairing').type = show ? 'text' : 'password'; $('revealChrome').textContent = show ? 'Ẩn mã' : 'Hiện mã'; $('revealChrome').setAttribute('aria-pressed', String(show)); if (show) { $('chromePairing').focus(); $('chromePairing').select(); } };
  $('copyChrome').onclick = async () => {
    try {
      await api.copyChrome();
      $('chromeStatus').textContent = 'Đã sao chép. Dán mã vào tiện ích đồng hành trong Chrome.';
    } catch {
      $('chromeStatus').textContent = 'Chưa sao chép được. Bấm Hiện mã, chọn mã rồi nhấn ⌘C trên Mac hoặc Ctrl+C.';
    }
  };

  $('confirmRestore').onclick = async () => {
    if (!restoringProject) return;
    $('confirmRestore').disabled = true;
    $('cancelRestore').disabled = true;
    try {
      await api.restoreProject(restoringProject.id);
      $('restoreDialog').close();
      await refresh();
      status('Đã khôi phục bản lưu trước. Mở dự án để kiểm tra kết quả.');
    } catch (error) { $('restoreError').textContent = displayError(error); }
    finally { $('confirmRestore').disabled = false; $('cancelRestore').disabled = false; }
  };

  function decorateHomeTools() {
    const paths = {appearanceOpen:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 3v18',windowSwitcherOpen:'M3 4h13v13H3zM8 17v4h13V8h-5',connectionsOpen:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4',desktopUpdateButton:'M12 3v12M7 10l5 5 5-5M4 17v4h16v-4',diagnosticsOpen:'M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3M12 17h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20'};
    for (const [id,path] of Object.entries(paths)) {
      const button = $(id);
      if (!button || !button.closest('.topbar')) continue;
      if (!button.getAttribute('aria-label')) button.setAttribute('aria-label',button.textContent.trim());
      if (!button.title) button.title = button.getAttribute('aria-label');
      button.classList.add('home-icon-tool');
      if (button.querySelector('svg')) continue;
      const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
      const shape = document.createElementNS(svg.namespaceURI,'path');shape.setAttribute('d',path);svg.append(shape);button.prepend(svg);
    }
  }
  document.addEventListener('DOMContentLoaded',decorateHomeTools,{once:true});

  if (!api) {
    $('aiAppsVoice').disabled = true;
    $('aiAppsWorkflow').disabled = true;
    $('homeOpenCanvas').disabled = true;
    $('connectChrome').disabled = true;
    $('newProject').disabled = true;
    $('emptyCreate').disabled = true;
    status('Không kết nối được ứng dụng desktop. Hãy đóng cửa sổ và mở lại Workflow.', true);
  } else {
    void refresh();
    let projectRefreshTimer;
    window.workflowDesktop.onEvent(event=>{if(event.type==='projects'){clearTimeout(projectRefreshTimer);projectRefreshTimer=setTimeout(()=>void refresh(),60);}});
    window.addEventListener('focus', () => { if (!document.querySelector('dialog[open]') && !opening && !deleting) void refresh(); });
  }
})();
