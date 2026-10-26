/* MooZ Studio v1 — app mới tối giản, viết lại từ đầu cho app-mooz.
   Giữ luồng chính của Workflow cũ: kịch bản -> nhân vật/cảnh/shot -> tạo ->
   duyệt -> ghép timeline -> đăng bài, cộng Affiliate và Thương hiệu.
   Không tự gửi AI, không tự đăng bài, không gọi mạng khi chưa bấm nút.
   Dữ liệu chỉ lưu trên máy (localStorage), xuất/nhập bằng JSON. */
(() => {
  const SIZES = ['9:16', '16:9', '1:1', '4:3', '3:4'];
  const clean = (v, max) => String(v == null ? '' : v).trim().slice(0, max || 20000);
  let n = 0; const uid = (p) => (p || 'id') + '-' + (Date.now().toString(36)) + '-' + (n++);

  function parseScript(text) {
    const raw = String(text || '');
    if (!raw.trim() || raw.length > 500000) throw Error('Kịch bản từ 1 đến 500.000 ký tự.');
    let title = 'Phim chưa đặt tên', characters = [], style = '', act = '', part = '', segment = '';
    let scenes = [], cur = null;
    for (const lineRaw of raw.split(/\r?\n/)) {
      const line = lineRaw.trim(); if (!line) continue; let m;
      if ((m = line.match(/^TÊN PHIM\s*:\s*(.+)$/i))) { title = clean(m[1], 150); continue; }
      if ((m = line.match(/^NHÂN VẬT\s*:\s*(.+)$/i))) { characters = m[1].split(/;\s*/).filter(Boolean).map((c) => ({ id: uid('char'), name: c.split(/[,，]/)[0].trim(), description: c })); continue; }
      if ((m = line.match(/^BỐI CẢNH\s*:\s*(.+)$/i))) { style = m[1]; continue; }
      if ((m = line.match(/^(?:HỒI|CHƯƠNG)\s*\d+\s*:\s*(.+)$/i))) { act = m[1]; continue; }
      if ((m = line.match(/^PHẦN\s*\d+\s*:\s*(.+)$/i))) { part = m[1]; continue; }
      if ((m = line.match(/^ĐOẠN\s*\d+\s*:\s*(.+)$/i))) { segment = m[1]; continue; }
      if ((m = line.match(/^CẢNH\s*\d+\s*(?:\([^)]*\))?\s*:\s*(.+)$/i))) {
        cur = { id: uid('shot'), title: [act, part, segment, m[1]].filter(Boolean).join(' · '), imagePrompt: '', videoPrompt: '', audio: '', camera: '', duration: 5, size: '16:9', status: 'cho-duyet', resultUrl: '' };
        scenes.push(cur); continue;
      }
      if (cur) {
        if ((m = line.match(/^Prompt ảnh\s*:\s*(.+)$/i))) cur.imagePrompt = m[1];
        else if ((m = line.match(/^Prompt video\s*:\s*(.+)$/i))) cur.videoPrompt = m[1];
        else if ((m = line.match(/^Audio\s*:\s*(.+)$/i))) cur.audio = m[1];
        else if ((m = line.match(/^Máy quay\s*:\s*(.+)$/i))) cur.camera = m[1];
      }
    }
    if (!scenes.length) throw Error('Chưa tìm thấy CẢNH nào. Viết theo mẫu: CẢNH 1: Tên cảnh, rồi Prompt ảnh / Prompt video.');
    return { title, characters, style, shots: scenes };
  }
  function shotPrompt(film, shot, kind) {
    const parts = [];
    if (film.style) parts.push('Phong cách: ' + film.style);
    for (const c of film.characters) parts.push('Nhân vật: ' + (c.description || c.name));
    if (kind === 'image') { if (shot.imagePrompt) parts.push('Ảnh khung đầu: ' + shot.imagePrompt); return parts.join('\n'); }
    if (shot.videoPrompt) parts.push(shot.videoPrompt);
    if (shot.camera) parts.push('Máy quay: ' + shot.camera);
    if (shot.audio) parts.push('Âm thanh: ' + shot.audio);
    return parts.join(' ');
  }
  function totalDuration(shots) { return shots.reduce((s, x) => s + (Number(x.duration) || 0), 0); }
  function validateShot(shot) {
    if (!clean(shot.title, 150)) throw Error('Shot thiếu tên.');
    if (!Number.isFinite(Number(shot.duration)) || Number(shot.duration) < 1 || Number(shot.duration) > 60) throw Error('Thời lượng shot từ 1 đến 60 giây.');
    if (!SIZES.includes(shot.size)) throw Error('Tỷ lệ shot không hợp lệ.');
    if (!shot.imagePrompt && !shot.videoPrompt) throw Error('Shot "' + shot.title + '" chưa có prompt ảnh hoặc video.');
    return true;
  }
  function affiliateAngles(product) {
    const name = clean(product.name, 150) || 'Sản phẩm';
    return [
      { angle: 'Vấn đề -> giải pháp', script: name + ' giải quyết nỗi khó chịu hằng ngày như thế nào? Mở đầu bằng tình huống thật, rồi cho thấy sản phẩm trong tay, kết bằng lời kêu gọi xem link.' },
      { angle: 'Trải nghiệm thật', script: 'Cầm ' + name + ' trên tay, quay cận chất liệu, cách dùng từng bước, nói rõ điểm thích và điểm cần lưu ý, không phóng đại.' },
      { angle: 'So sánh nhanh', script: 'Đặt ' + name + ' cạnh cách làm cũ: nhanh hơn ở đâu, gọn hơn ở đâu, hợp với ai? Kết bằng 3 ý chính và link mua.' },
    ];
  }
  const Logic = { parseScript, shotPrompt, totalDuration, validateShot, affiliateAngles, SIZES };
  if (typeof globalThis !== 'undefined') globalThis.MoozStudioLogic = Logic;
  if (typeof document === 'undefined') return;

  // ---- State ----
  const KEY = 'mooz-studio-v1';
  let state;
  try { state = JSON.parse(localStorage.getItem(KEY) || 'null') || null; } catch { state = null; }
  state = state || { project: 'Dự án đầu tiên', film: { title: '', characters: [], style: '', shots: [] }, script: '', brand: { name: '', tone: '', colors: '', notes: '' }, posts: [], affiliate: { name: '', link: '', desc: '' } };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); document.getElementById('saveStatus').textContent = 'Đã lưu trên máy này · ' + new Date().toLocaleTimeString('vi-VN'); } catch { document.getElementById('saveStatus').textContent = 'Không lưu được (bộ nhớ đầy). Hãy xuất JSON.'; } };
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let view = 'overview';
  const VIEWS = [['overview', 'Tổng quan'], ['script', '1 · Kịch bản'], ['create', '2 · Tạo nội dung'], ['queue', '3 · Duyệt & Hàng đợi'], ['timeline', '4 · Ghép & Timeline'], ['posting', '5 · Đăng bài'], ['affiliate', 'Affiliate Shopee'], ['brand', 'Thương hiệu']];

  function stepsDone() {
    const s = state.film.shots.length ? 1 : 0, d = state.film.shots.filter((x) => x.status === 'da-duyet' || x.status === 'hoan-thanh').length;
    return { script: !!state.film.shots.length, reviewed: d, total: state.film.shots.length, posts: state.posts.length };
  }
  function renderNav() {
    $('nav').innerHTML = '<div class="section">Làm phim</div>' + VIEWS.map(([id, label]) => `<button type="button" class="${view === id ? 'active' : ''}" data-view="${id}">${esc(label)}</button>`).join('');
    document.querySelectorAll('#nav button').forEach((b) => b.onclick = () => { view = b.dataset.view; render(); });
  }
  function shotCard(shot, i) {
    return `<article class="shot"><header><div><strong>${i + 1}. ${esc(shot.title)}</strong><br><span class="tag">${esc(shot.size)}</span><span class="tag">${shot.duration}s</span><span class="tag ${shot.status === 'hoan-thanh' ? 'ok' : ''}">${shot.status === 'hoan-thanh' ? 'Đã hoàn thành' : shot.status === 'da-duyet' ? 'Đã duyệt' : 'Chờ duyệt'}</span></div><div class="row">
      <button type="button" data-up="${shot.id}">↑</button><button type="button" data-down="${shot.id}">↓</button><button type="button" data-del="${shot.id}">Xóa</button></div></header>
      <label>Prompt ảnh<textarea data-field="imagePrompt" data-id="${shot.id}" rows="2">${esc(shot.imagePrompt)}</textarea></label>
      <label>Prompt video<textarea data-field="videoPrompt" data-id="${shot.id}" rows="2">${esc(shot.videoPrompt)}</textarea></label>
      <div class="grid2"><div><label>Máy quay<input data-field="camera" data-id="${shot.id}" value="${esc(shot.camera)}"></label></div><div><label>Thời lượng (giây)<input type="number" min="1" max="60" data-field="duration" data-id="${shot.id}" value="${shot.duration}"></label></div></div>
      <label>Tỷ lệ<select data-field="size" data-id="${shot.id}">${SIZES.map((s) => `<option ${s === shot.size ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
      <div class="row"><button type="button" data-approve="${shot.id}">Duyệt shot này</button><button type="button" data-copy="${shot.id}">Sao chép prompt video</button><span class="status" id="st-${shot.id}"></span></div>
      <details><summary>Prompt video đã ghép (giữ nhân vật + phong cách)</summary><pre>${esc(shotPrompt(state.film, shot, 'video'))}</pre></details></article>`;
  }
  function bindShots(root) {
    root.querySelectorAll('[data-field]').forEach((el) => el.oninput = () => {
      const shot = state.film.shots.find((x) => x.id === el.dataset.id); if (!shot) return;
      shot[el.dataset.field] = el.dataset.field === 'duration' ? Number(el.value) : el.value; save();
      // Không render() lại ở đây: render lại sẽ làm mất con trỏ khi đang gõ.
      // Prompt đã ghép trong <details> sẽ cập nhật khi chuyển view hoặc duyệt shot.
    });
    root.querySelectorAll('[data-up]').forEach((b) => b.onclick = () => move(b.dataset.up, -1));
    root.querySelectorAll('[data-down]').forEach((b) => b.onclick = () => move(b.dataset.down, 1));
    root.querySelectorAll('[data-del]').forEach((b) => b.onclick = () => { state.film.shots = state.film.shots.filter((x) => x.id !== b.dataset.del); save(); render(); });
    root.querySelectorAll('[data-approve]').forEach((b) => b.onclick = () => { const s = state.film.shots.find((x) => x.id === b.dataset.approve); try { validateShot(s); s.status = 'da-duyet'; save(); render(); } catch (e) { alert(e.message); } });
    root.querySelectorAll('[data-copy]').forEach((b) => b.onclick = async () => { const s = state.film.shots.find((x) => x.id === b.dataset.copy); try { await navigator.clipboard.writeText(shotPrompt(state.film, s, 'video')); const el = $('st-' + s.id); if (el) el.textContent = 'Đã sao chép.'; } catch { alert('Không sao chép được, hãy bôi đen prompt trong phần chi tiết.'); } });
  }
  function move(id, d) { const i = state.film.shots.findIndex((x) => x.id === id); const j = i + d; if (i < 0 || j < 0 || j >= state.film.shots.length) return; [state.film.shots[i], state.film.shots[j]] = [state.film.shots[j], state.film.shots[i]]; save(); render(); }
  function graphSvg() {
    const film = state.film; if (!film.shots.length) return '<p class="hint">Chưa có đồ thị. Dán kịch bản ở bước 1 trước.</p>';
    const nodes = [{ k: 'film', t: film.title || 'Phim', x: 20, y: 100 }, ...film.characters.map((c, i) => ({ k: 'char', t: c.name, x: 220, y: 30 + i * 50 })), ...film.shots.slice(0, 8).map((s, i) => ({ k: 'shot', t: s.title, x: 460, y: 20 + i * 28 }))];
    const edges = nodes.slice(1).map((nd) => `<line x1="90" y1="110" x2="${nd.x}" y2="${nd.y + 10}" stroke="#475569" />`).join('');
    const rects = nodes.map((nd) => `<g><rect x="${nd.x}" y="${nd.y}" width="150" height="22" rx="6" fill="${nd.k === 'film' ? '#facc15' : nd.k === 'char' ? '#7dd3fc' : '#fda4af'}"/><title>${esc(nd.t)}</title></g>`).join('');
    return `<svg class="graph" viewBox="0 0 640 240" role="img" aria-label="Đồ thị phim">${edges}${rects}</svg><p class="hint">Đồ thị rút gọn: Phim ở trái, nhân vật ở giữa, tối đa 8 shot đầu ở phải. Đầy đủ shot xem ở danh sách bên dưới.</p>`;
  }
  function render() {
    renderNav(); const d = stepsDone();
    $('steps').innerHTML = `<span class="${d.script ? 'done' : 'now'}">1 Kịch bản ${d.total ? '· ' + d.total + ' shot' : ''}</span><span class="${d.reviewed ? 'done' : ''}">2 Duyệt · ${d.reviewed}/${d.total}</span><span>3 Ghép · ${totalDuration(state.film.shots)}s</span><span class="${d.posts ? 'done' : ''}">4 Đăng · ${d.posts} bản nháp</span>`;
    $('projectName').value = state.project;
    let html = '';
    if (view === 'overview') html = `<div class="card"><h2>${esc(state.film.title || 'Chưa có phim nào')}</h2><p>Làm theo 4 bước, mỗi bước chỉ làm một việc. Không tự gửi AI, không tự đăng bài — bạn duyệt rồi mới chạy, duyệt rồi mới đăng.</p><div class="grid3"><div><p class="kpi">${d.total}</p><p class="kpi-label">Shot</p></div><div><p class="kpi">${d.reviewed}</p><p class="kpi-label">Đã duyệt</p></div><div><p class="kpi">${totalDuration(state.film.shots)}s</p><p class="kpi-label">Tổng thời lượng dự kiến</p></div></div><div class="row"><button class="primary" type="button" data-go="script">Bắt đầu từ kịch bản</button><button type="button" id="expBtn">Xuất dự án JSON</button><label style="margin:0">Nhập JSON <input id="impFile" type="file" accept=".json,application/json" style="display:inline;width:auto"></label></div><p class="status" id="ovStatus"></p></div><div class="card"><h3>Đồ thị phim</h3>${graphSvg()}</div><div class="card"><h3>App này làm được gì, và không làm gì</h3><p><strong>Làm được:</strong> phân tích kịch bản tổng, giữ nhân vật/phong cách nhất quán trong prompt shot, quản lý duyệt shot, tính tổng thời lượng timeline, soạn bản nháp đăng bài, tạo kịch bản Affiliate từ dữ kiện bạn nhập, lưu thương hiệu. <strong>Không tự làm:</strong> không gọi AI thật, không tạo video thật, không đăng bài thật khi chưa có kết nối và chưa bấm Đăng. Muốn tạo video thật, copy prompt shot sang tab Muse/Gemini/Veo/fal.ai của bạn rồi tải kết quả về, đánh dấu hoàn thành ở bước Duyệt.</p></div>`;
    if (view === 'script') html = `<div class="card"><h2>1 · Kịch bản</h2><p>Dán kịch bản theo mẫu, bấm Phân tích. Hệ thống chỉ tạo danh sách shot, chưa gửi AI.</p><textarea id="scriptText" rows="14" placeholder="TÊN PHIM: …&#10;NHÂN VẬT: Lan, 30 tuổi, áo khoác nâu&#10;BỐI CẢNH: Làng quê buổi sáng&#10;CẢNH 1 (0:00–0:06): Bước ra cửa&#10;Prompt ảnh: …&#10;Prompt video: …">${esc(state.script)}</textarea><div class="row"><button class="primary" type="button" id="parseBtn">Phân tích kịch bản</button><button type="button" id="sampleBtn">Dùng kịch bản mẫu</button></div><p class="status" id="scriptStatus"></p><div id="scriptResult">${state.film.shots.length ? `<h3>${esc(state.film.title)} · ${state.film.characters.length} nhân vật · ${state.film.shots.length} shot</h3><p>Nhân vật: ${esc(state.film.characters.map((c) => c.name).join(', ') || '—')} · Phong cách: ${esc(state.film.style || '—')}</p>` : ''}</div></div>`;
    if (view === 'create') html = `<div class="card"><h2>2 · Tạo nội dung</h2><p>Sửa prompt từng shot, sao chép prompt sang AI của bạn, tải kết quả về rồi đánh dấu hoàn thành ở bước Duyệt. App không tự tạo video.</p>${state.film.shots.length ? state.film.shots.map(shotCard).join('') : '<p class="hint">Chưa có shot nào. Sang bước 1 và phân tích kịch bản trước.</p>'}</div>`;
    if (view === 'queue') html = `<div class="card"><h2>3 · Duyệt &amp; Hàng đợi</h2><p>Chỉ shot đã duyệt mới được tính là sẵn sàng ghép. Tải kết quả thật từ AI về máy rồi đánh dấu hoàn thành — app không tự nhận kết quả hộ bạn.</p>${state.film.shots.length ? state.film.shots.map((s, i) => `<div class="shot"><strong>${i + 1}. ${esc(s.title)}</strong> · ${s.duration}s · ${esc(s.size)} · <span class="tag ${s.status === 'hoan-thanh' ? 'ok' : ''}">${s.status === 'hoan-thanh' ? 'Hoàn thành' : s.status === 'da-duyet' ? 'Đã duyệt' : 'Chờ duyệt'}</span><div class="row"><button type="button" data-done="${s.id}">Đánh dấu đã có video</button><button type="button" data-unapprove="${s.id}">Trả về chờ duyệt</button></div></div>`).join('') : '<p class="hint">Chưa có shot nào.</p>'}</div>`;
    if (view === 'timeline') html = `<div class="card"><h2>4 · Ghép &amp; Timeline</h2><p>Thứ tự dưới đây là thứ tự ghép. Dùng ↑ ↓ ở bước Tạo nội dung để đổi thứ tự. Tổng thời lượng chỉ tính từ thời lượng bạn nhập, không phải thời lượng video thật.</p><ol>${state.film.shots.map((s) => `<li>${esc(s.title)} · ${s.duration}s · ${esc(s.size)} · ${s.status === 'hoan-thanh' ? 'Đã có video' : 'Chưa có video'}</li>`).join('') || '<li>Chưa có shot nào.</li>'}</ol><p><strong>Tổng: ${totalDuration(state.film.shots)} giây</strong> · Đã có video: ${state.film.shots.filter((x) => x.status === 'hoan-thanh').length}/${state.film.shots.length}</p><p class="hint">Muốn xuất MP4 thật: ghép các video đã tải về bằng công cụ dựng của bạn theo đúng thứ tự này, hoặc dùng node Output/FFmpeg của bản Workflow cũ (lưu trong lịch sử Git).</p></div>`;
    if (view === 'posting') html = `<div class="card"><h2>5 · Đăng bài</h2><p>Soạn bản nháp, chưa đăng thật. Muốn đăng thật, cần kết nối nền tảng và bấm Đăng ở bước riêng — bản này không tự đăng.</p><label>Tiêu đề / nội dung<textarea id="postText" rows="4" placeholder="Viết content đăng bài…"></textarea></label><div class="grid2"><div><label>Nền tảng<select id="postPlatform"><option>Facebook Page</option><option>YouTube</option><option>Instagram</option><option>TikTok</option></select></label></div><div><label>Hẹn giờ (tùy chọn)<input id="postWhen" type="datetime-local"></label></div></div><button class="primary" type="button" id="addPostBtn">Lưu bản nháp</button><div id="postList">${state.posts.map((p, i) => `<div class="shot"><strong>${esc(p.platform)}</strong> · ${esc(p.when || 'Chưa hẹn giờ')} · ${esc(p.status)}<pre>${esc(p.text)}</pre><button type="button" data-delpost="${i}">Xóa nháp</button></div>`).join('') || '<p class="hint">Chưa có bản nháp nào.</p>'}</div></div>`;
    if (view === 'affiliate') html = `<div class="card"><h2>Affiliate Shopee</h2><p>Dán link để giữ lại, nhập dữ kiện thật từ trang sản phẩm. App không tự đọc Shopee (trang này thường chặn), không tạo link affiliate, không kiểm tra hoa hồng.</p><label>Link sản phẩm<input id="affLink" value="${esc(state.affiliate.link)}" placeholder="https://shopee.vn/…"></label><label>Tên sản phẩm<input id="affName" value="${esc(state.affiliate.name)}"></label><label>Mô tả / dữ kiện đã kiểm chứng<textarea id="affDesc" rows="4">${esc(state.affiliate.desc)}</textarea></label><button class="primary" type="button" id="affGenBtn">Tạo 3 góc kể chuyện</button><div id="affOut"></div></div>`;
    if (view === 'brand') html = `<div class="card"><h2>Thương hiệu</h2><p>Lưu thông tin để dùng lại khi soạn content. Chỉ lưu trên máy này.</p><label>Tên thương hiệu<input id="brandName" value="${esc(state.brand.name)}"></label><label>Giọng văn<input id="brandTone" value="${esc(state.brand.tone)}"></label><label>Màu / phong cách<input id="brandColors" value="${esc(state.brand.colors)}"></label><label>Ghi chú<textarea id="brandNotes" rows="4">${esc(state.brand.notes)}</textarea></label><button class="primary" type="button" id="brandSaveBtn">Lưu thương hiệu</button><p class="status" id="brandStatus"></p></div>`;
    $('main').innerHTML = html;
    bindView();
  }
  function bindView() {
    const go = (v) => { view = v; render(); };
    document.querySelectorAll('[data-go]').forEach((b) => b.onclick = () => go(b.dataset.go));
    if (view === 'overview') {
      $('expBtn').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })); a.download = 'mooz-studio-project.json'; a.click(); };
      $('impFile').onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { const data = JSON.parse(await f.text()); if (!data.film || !Array.isArray(data.film.shots)) throw Error('File không phải dự án MooZ Studio.'); state = data; save(); render(); } catch (err) { $('ovStatus').textContent = err.message; $('ovStatus').className = 'status error'; } };
    }
    if (view === 'script') {
      $('scriptText').oninput = (e) => { state.script = e.target.value; save(); };
      $('sampleBtn').onclick = () => { state.script = 'TÊN PHIM: Hành trình\nNHÂN VẬT: Lan, 30 tuổi, áo khoác nâu\nBỐI CẢNH: Làng quê buổi sáng\nCẢNH 1 (0:00–0:06): Bước ra cửa\nPrompt ảnh: Lan đứng trước cửa nhà gỗ, nắng sớm.\nPrompt video: Lan bước chậm ra ngoài; máy quay theo nhẹ.\nAudio: Chim hót.\nCẢNH 2 (0:06–0:12): Con đường\nPrompt ảnh: Lan trên đường làng.\nPrompt video: Lan tiếp tục bước đi.'; save(); render(); };
      $('parseBtn').onclick = () => { try { const film = parseScript(state.script); state.film = film; save(); render(); const el = $('scriptStatus'); if (el) { el.textContent = 'Đã phân tích: ' + film.shots.length + ' shot, ' + film.characters.length + ' nhân vật.'; el.className = 'status ok'; } } catch (e) { const el = $('scriptStatus'); if (el) { el.textContent = e.message; el.className = 'status error'; } } };
    }
    if (view === 'create') bindShots($('main'));
    if (view === 'queue') {
      document.querySelectorAll('[data-done]').forEach((b) => b.onclick = () => { const s = state.film.shots.find((x) => x.id === b.dataset.done); if (s) { s.status = 'hoan-thanh'; save(); render(); } });
      document.querySelectorAll('[data-unapprove]').forEach((b) => b.onclick = () => { const s = state.film.shots.find((x) => x.id === b.dataset.unapprove); if (s) { s.status = 'cho-duyet'; save(); render(); } });
    }
    if (view === 'posting') {
      $('addPostBtn').onclick = () => { const text = $('postText').value.trim(); if (!text) return alert('Nhập nội dung trước.'); state.posts.push({ text, platform: $('postPlatform').value, when: $('postWhen').value, status: 'nhap' }); save(); render(); };
      document.querySelectorAll('[data-delpost]').forEach((b) => b.onclick = () => { state.posts.splice(Number(b.dataset.delpost), 1); save(); render(); });
    }
    if (view === 'affiliate') {
      $('affGenBtn').onclick = () => {
        state.affiliate = { link: $('affLink').value, name: $('affName').value, desc: $('affDesc').value }; save();
        $('affOut').innerHTML = '<h3>3 góc kể chuyện (mẫu, cần bạn sửa trước khi dùng)</h3>' + affiliateAngles(state.affiliate).map((a) => `<div class="shot"><strong>${esc(a.angle)}</strong><p>${esc(a.script)}</p><p class="hint">Dữ kiện bạn nhập: ${esc(state.affiliate.desc || '—')} · Link giữ nguyên: ${esc(state.affiliate.link || '—')}</p></div>`).join('');
      };
    }
    if (view === 'brand') {
      $('brandSaveBtn').onclick = () => { state.brand = { name: $('brandName').value, tone: $('brandTone').value, colors: $('brandColors').value, notes: $('brandNotes').value }; save(); $('brandStatus').textContent = 'Đã lưu thương hiệu.'; };
    }
    $('projectName').oninput = (e) => { state.project = e.target.value; save(); };
    $('resetBtn').onclick = () => { if (confirm('Xóa toàn bộ dự án trên máy này? Hãy xuất JSON trước nếu cần giữ.')) { localStorage.removeItem(KEY); location.reload(); } };
  }
  render();
})();
