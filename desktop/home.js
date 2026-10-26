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
    } catch (error) { status(displayError(error), true); }
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
    button.setAttribute('aria-label', 'Mở dự án ' + project.name);
    button.onclick = () => void open(project);
    const art = document.createElement('div');
    art.className = 'project-art';
    art.setAttribute('aria-hidden', 'true');
    const flow = document.createElement('span');
    flow.className = 'flow-art';
    for (const tag of ['i', 'b', 'i', 'b', 'i']) flow.append(document.createElement(tag));
    art.append(flow);
    const info = document.createElement('div');
    info.className = 'project-info';
    const title = document.createElement('h3');
    title.textContent = project.name;
    title.title = project.name;
    const date = document.createElement('p');
    date.className = 'project-date';
    date.textContent = dateLabel(project.updatedAt);
    info.append(title, date);
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

  function render() {
    const query = $('searchProjects').value.trim().toLocaleLowerCase('vi');
    const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const visible = projects.filter(project => (!recentOnly || Date.parse(project.updatedAt) >= since) && project.name.toLocaleLowerCase('vi').includes(query));
    $('libraryHeading').textContent = recentOnly ? 'Trong 7 ngày qua' : 'Tất cả dự án';
    $('projectCount').textContent = String(visible.length);
    $('projectGrid').replaceChildren(...visible.map(card));
    $('emptyState').hidden = visible.length !== 0;
    const filtered = !!query || recentOnly;
    $('emptyTitle').textContent = filtered ? 'Chưa tìm thấy dự án phù hợp' : 'Chưa có dự án nào';
    $('emptyDescription').textContent = filtered ? 'Thử tên khác hoặc chọn Tất cả dự án.' : 'Tạo dự án đầu tiên để bắt đầu xây dựng workflow AI.';
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
  $('aiAppsAffiliate').onclick=()=>void window.workflowDesktop.call('affiliate.open').catch(error=>status(displayError(error),true));
  $('aiAppsPosting').onclick=()=>void window.workflowDesktop.call('posting.open').catch(error=>status(displayError(error),true));
  $('aiAppsWorkflow').onclick = () => {
    $('allProjects').click();
    document.querySelector('.project-library').scrollIntoView({block:'start', behavior:'smooth'});
  };
  let appTool = 'chat';
  function pickProject(tool) {appTool=tool;$('appProjectTitle').textContent=tool==='voiceover'?'Lồng tiếng trong canvas':'Mở Chat AI';$('appProjectDescription').textContent=tool==='voiceover'?'Lồng tiếng hiện có trong canvas bằng OpenAI API: Thêm node → Lồng tiếng, nhập lời đọc hoặc nối Văn bản, cấu hình khóa OpenAI trong Kết nối AI, rồi bấm Thực hiện. Dịch vụ có thể tính phí. Ứng dụng lồng tiếng riêng vẫn chờ tích hợp.':'Chọn dự án để trò chuyện và giao việc cho AI. Ảnh, video và node được giữ trong đúng dự án đó.';$('appProjectOpen').textContent=tool==='voiceover'?'Mở canvas lồng tiếng':'Mở Chat AI';$('appProjectNew').textContent=tool==='voiceover'?'＋ Dự án lồng tiếng':'＋ Dự án Chat mới';void selectProject();}
  $('aiAppsVoice').onclick = ()=>pickProject('voiceover');
  async function selectProject() {
    $('appProjectError').textContent = '';
    await refresh();
    const select = $('appProjectSelect');
    select.replaceChildren();
    for (const project of projects) {
      const option = new Option(project.name, project.id);
      option.disabled = !!project.recoveryRequired;
      select.append(option);
    }
    const first = projects.find(project => !project.recoveryRequired);
    if (first) select.value = first.id;
    else select.append(new Option('Chưa có dự án sẵn sàng', ''));
    $('appProjectOpen').disabled = !first;
    $('appProjectDialog').showModal();
  }
  $('appProjectCancel').onclick = () => { if (!launchingApp) $('appProjectDialog').close(); };
  async function launchChat(createNew = false) {
    if (launchingApp) return;
    launchingApp = true;
    $('appProjectError').textContent = '';
    for (const id of ['appProjectCancel', 'appProjectNew', 'appProjectOpen']) $(id).disabled = true;
    try {
      const id = createNew ? (await api.createProject(appTool==='voiceover'?'Lồng tiếng':'Chat AI')).id : $('appProjectSelect').value;
      if (!id) throw Error('Chọn dự án hoặc tạo một dự án Chat mới.');
      await api.openProject(id, appTool);
      $('appProjectDialog').close();
    } catch (error) {
      $('appProjectError').textContent = displayError(error);
    } finally {
      launchingApp = false;
      for (const id of ['appProjectCancel', 'appProjectNew']) $(id).disabled = false;
      $('appProjectOpen').disabled = !$('appProjectSelect').value;
    }
  }
  $('appProjectOpen').onclick = () => void launchChat(false);
  $('appProjectNew').onclick = () => void launchChat(true);
  $('searchProjects').oninput = render;
  $('newProject').onclick = () => nameDialog();
  $('emptyCreate').onclick = () => nameDialog();
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

  $('connectChrome').onclick = async () => {
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

  if (!api) {
    $('aiAppsVoice').disabled = true;
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
