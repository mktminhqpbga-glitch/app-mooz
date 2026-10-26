/* Film Canvas — đồ thị làm phim kiểu Infinite Canvas, viết mới cho app-mooz.
   Ý tưởng học từ Infinite Canvas (bảng node, thẻ nhân vật/phong cách dùng lại,
   shot hàng loạt, tự xếp layout, minimap, xuất/nhập): chỉ học ý tưởng, không
   copy code của project đó. Không gửi AI, không gọi mạng, không tự chạy video.
   Logic thuần túy, chạy được cả trong Node (test) lẫn trình duyệt (panel). */
(()=> {
  const SIZES = ['9:16', '16:9', '1:1', '4:3', '3:4'];
  const KINDS = ['film', 'character', 'style', 'scene', 'shot'];
  let counter = 0;
  const uid = (kind) => kind + '-' + Date.now().toString(36) + '-' + (counter++).toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  const clean = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
  const fail = (msg) => { throw Error(msg); };

  function newProject(title) {
    const t = clean(title, 150);
    if (!t) fail('Tên phim không được trống.');
    return { version: 1, title: t, nodes: [], edges: [] };
  }
  function addNode(project, kind, title, data) {
    if (!KINDS.includes(kind)) fail('Loại node không hợp lệ: ' + kind);
    const node = {
      id: uid(kind), kind, title: clean(title, 150),
      x: 0, y: 0, w: kind === 'film' ? 300 : 260, h: 120,
      data: data || {},
    };
    if (!node.title) fail('Tên node không được trống.');
    if (kind === 'shot') {
      const d = Number(node.data.duration == null ? 5 : node.data.duration);
      if (!Number.isFinite(d) || d < 1 || d > 60) fail('Thời lượng shot từ 1 đến 60 giây.');
      node.data.duration = d;
      node.data.size = SIZES.includes(node.data.size) ? node.data.size : '16:9';
      for (const k of ['imagePrompt', 'videoPrompt', 'camera', 'audio']) {
        node.data[k] = clean(node.data[k], 20000);
      }
    }
    if (kind === 'character' || kind === 'style') node.data.description = clean(node.data.description, 5000);
    if (kind === 'scene') node.data.summary = clean(node.data.summary, 5000);
    project.nodes.push(node);
    return node;
  }
  function link(project, sourceId, targetId, port) {
    const s = project.nodes.find((n) => n.id === sourceId);
    const t = project.nodes.find((n) => n.id === targetId);
    if (!s || !t) fail('Không tìm thấy node để nối.');
    if (sourceId === targetId) fail('Không nối node với chính nó.');
    if (project.edges.some((e) => e.source === sourceId && e.target === targetId && e.port === (port || ''))) {
      fail('Dây nối này đã tồn tại.');
    }
    const edge = { source: sourceId, target: targetId, port: port || '' };
    project.edges.push(edge);
    return edge;
  }
  function validate(project) {
    if (!project || project.version !== 1) fail('File film-canvas phải là version 1.');
    if (!clean(project.title, 150)) fail('Tên phim không được trống.');
    if (!Array.isArray(project.nodes) || project.nodes.length < 1 || project.nodes.length > 1000) fail('Số node từ 1 đến 1000.');
    const ids = new Set();
    for (const n of project.nodes) {
      if (!KINDS.includes(n.kind) || !clean(n.title, 150) || ids.has(n.id)) fail('Node không hợp lệ hoặc trùng id: ' + n.id);
      ids.add(n.id);
    }
    for (const e of project.edges || []) {
      if (!ids.has(e.source) || !ids.has(e.target) || e.source === e.target) fail('Dây nối không hợp lệ.');
    }
    // Mỗi shot phải nối tới ít nhất một scene (trực tiếp).
    for (const shot of project.nodes.filter((n) => n.kind === 'shot')) {
      const ok = (project.edges || []).some((e) => e.target === shot.id && project.nodes.find((n) => n.id === e.source)?.kind === 'scene');
      if (!ok) fail('Shot "' + shot.title + '" chưa nối tới scene nào.');
    }
    // Không có chu trình: kiểm tra bằng thứ tự topo.
    const indeg = new Map(project.nodes.map((n) => [n.id, 0]));
    for (const e of project.edges || []) indeg.set(e.target, indeg.get(e.target) + 1);
    const queue = project.nodes.filter((n) => indeg.get(n.id) === 0).map((n) => n.id);
    let seen = 0;
    while (queue.length) {
      const id = queue.shift(); seen++;
      for (const e of (project.edges || []).filter((x) => x.source === id)) {
        indeg.set(e.target, indeg.get(e.target) - 1);
        if (indeg.get(e.target) === 0) queue.push(e.target);
      }
    }
    if (seen !== project.nodes.length) fail('Đồ thị có chu trình, không xếp được.');
    return true;
  }
  // Xếp layout theo cột = đường dài nhất từ gốc. Giữ thứ tự tạo trong cùng cột.
  function autoLayout(project) {
    validate(project);
    const col = new Map(project.nodes.map((n) => [n.id, 0]));
    let changed = true;
    while (changed) {
      changed = false;
      for (const e of project.edges) {
        const c = col.get(e.source) + 1;
        if (c > col.get(e.target)) { col.set(e.target, c); changed = true; }
      }
    }
    const byCol = new Map();
    for (const n of project.nodes) {
      if (!byCol.has(col.get(n.id))) byCol.set(col.get(n.id), []);
      byCol.get(col.get(n.id)).push(n);
    }
    for (const [c, list] of [...byCol.entries()].sort((a, b) => a[0] - b[0])) {
      list.forEach((n, i) => { n.x = 40 + c * 320; n.y = 40 + i * 160; });
    }
    return project;
  }
  // Ghép prompt shot: phong cách + nhân vật được nối + prompt cảnh + chuyển động.
  function toShotPrompts(project) {
    validate(project);
    const byId = new Map(project.nodes.map((n) => [n.id, n]));
    return project.nodes.filter((n) => n.kind === 'shot').map((shot) => {
      const incoming = (project.edges || []).filter((e) => e.target === shot.id);
      const refs = incoming.map((e) => byId.get(e.source)).filter(Boolean);
      const style = refs.filter((n) => n.kind === 'style').map((n) => n.data.description || n.title).filter(Boolean);
      const chars = refs.filter((n) => n.kind === 'character').map((n) => n.data.description || n.title).filter(Boolean);
      const scenes = refs.filter((n) => n.kind === 'scene');
      const parts = [...style, ...chars];
      if (scenes.length) parts.push('Bối cảnh: ' + scenes.map((s) => s.data.summary || s.title).join(' | '));
      if (shot.data.imagePrompt) parts.push('Ảnh khung đầu: ' + shot.data.imagePrompt);
      const video = [shot.data.videoPrompt, shot.data.camera ? 'Máy quay: ' + shot.data.camera : '', shot.data.audio ? 'Âm thanh: ' + shot.data.audio : ''].filter(Boolean).join(' ');
      return {
        shotId: shot.id, title: shot.title, duration: shot.data.duration, size: shot.data.size,
        imagePrompt: parts.join('\n').slice(0, 20000),
        videoPrompt: (parts.join(' ') + (video ? ' ' + video : '')).slice(0, 20000),
        characters: chars, styles: style, scenes: scenes.map((s) => s.title),
      };
    });
  }
  function exportJSON(project) {
    validate(project);
    return JSON.stringify(project, null, 2);
  }
  function importJSON(text) {
    let parsed;
    try { parsed = JSON.parse(String(text || '')); } catch { fail('JSON không hợp lệ.'); }
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.nodes)) fail('JSON thiếu mảng nodes.');
    parsed.edges = Array.isArray(parsed.edges) ? parsed.edges : [];
    validate(parsed);
    return parsed;
  }
  // Phân tích kịch bản tổng theo mẫu sẵn có của app (TÊN PHIM / NHÂN VẬT / BỐI CẢNH /
  // HỒI-CHƯƠNG / PHẦN / ĐOẠN / CẢNH + Prompt ảnh / Prompt video / Audio).
  function parseMasterScript(text) {
    const raw = String(text || '');
    if (!raw.trim() || raw.length > 500000) fail('Kịch bản từ 1 đến 500.000 ký tự.');
    const lines = raw.split(/\r?\n/);
    const project = { version: 1, title: 'Phim chưa đặt tên', nodes: [], edges: [] };
    let film = null, styleText = '', act = '', part = '', segment = '', sceneNode = null, shot = null;
    const flushShot = () => { shot = null; };
    const ensureFilm = () => { if (!film) { film = addNode(project, 'film', project.title); } return film; };
    for (const lineRaw of lines) {
      const line = lineRaw.trim();
      if (!line) continue;
      let m;
      if ((m = line.match(/^TÊN PHIM\s*:\s*(.+)$/i))) { project.title = clean(m[1], 150); if (film) film.title = project.title; continue; }
      if ((m = line.match(/^NHÂN VẬT\s*:\s*(.+)$/i))) {
        ensureFilm();
        for (const chunk of m[1].split(/;\s*/).filter(Boolean)) {
          const node = addNode(project, 'character', chunk.split(/[,，]/)[0].trim() || chunk, { description: chunk });
          link(project, film.id, node.id);
        }
        continue;
      }
      if ((m = line.match(/^BỐI CẢNH\s*:\s*(.+)$/i))) { styleText = m[1]; const node = addNode(project, 'style', 'Bối cảnh chung', { description: styleText }); link(project, ensureFilm().id, node.id); continue; }
      if ((m = line.match(/^(?:HỒI|CHƯƠNG)\s*\d+\s*:\s*(.+)$/i))) { act = m[1]; continue; }
      if ((m = line.match(/^PHẦN\s*\d+\s*:\s*(.+)$/i))) { part = m[1]; continue; }
      if ((m = line.match(/^ĐOẠN\s*\d+\s*:\s*(.+)$/i))) { segment = m[1]; continue; }
      if ((m = line.match(/^CẢNH\s*\d+\s*(?:\([^)]*\))?\s*:\s*(.+)$/i))) {
        flushShot();
        sceneNode = addNode(project, 'scene', [act, part, segment, m[1]].filter(Boolean).join(' · '), { summary: m[1] });
        link(project, ensureFilm().id, sceneNode.id);
        shot = addNode(project, 'shot', sceneNode.title, { duration: 5, size: '16:9' });
        link(project, sceneNode.id, shot.id);
        continue;
      }
      if (shot) {
        if ((m = line.match(/^Prompt ảnh\s*:\s*(.+)$/i))) { shot.data.imagePrompt = m[1]; continue; }
        if ((m = line.match(/^Prompt video\s*:\s*(.+)$/i))) { shot.data.videoPrompt = m[1]; continue; }
        if ((m = line.match(/^Audio\s*:\s*(.+)$/i))) { shot.data.audio = m[1]; continue; }
      }
    }
    if (!project.nodes.some((n) => n.kind === 'scene')) fail('Chưa tìm thấy CẢNH nào trong kịch bản.');
    // Nối nhân vật + phong cách vào từng shot để prompt giữ nhất quán.
    for (const shotNode of project.nodes.filter((n) => n.kind === 'shot')) {
      for (const ref of project.nodes.filter((n) => n.kind === 'character' || n.kind === 'style')) {
        try { link(project, ref.id, shotNode.id); } catch { /* đã nối thì bỏ qua */ }
      }
    }
    autoLayout(project);
    return project;
  }
  // Panel trình duyệt: chỉ chạy khi có document, không ảnh hưởng test Node.
  function open() {
    if (typeof document === 'undefined') fail('Panel chỉ chạy trong trình duyệt.');
    let dialog = document.getElementById('filmCanvasDialog');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'filmCanvasDialog'; dialog.className = 'film-canvas-dialog';
      dialog.innerHTML = '<header><div><span class="studio-eyebrow">FILM CANVAS</span><h2>Canvas phim · kiểu Infinite Canvas</h2><p>Dán kịch bản tổng, phân tích thành đồ thị Phim → Nhân vật/Phong cách → Cảnh → Shot. Chỉ chuẩn bị prompt, không tự gửi AI, không tự chạy video.</p></div><button id="filmCanvasClose" type="button">Đóng</button></header>'
        + '<label>Dán kịch bản tổng (mẫu: TÊN PHIM / NHÂN VẬT / BỐI CẢNH / CẢNH …)<textarea id="filmCanvasScript" rows="8" placeholder="TÊN PHIM: …\nNHÂN VẬT: Lan, 30 tuổi, áo khoác nâu\nBỐI CẢNH: Làng quê buổi sáng\nCẢNH 1 (0:00–0:06): Bước ra cửa\nPrompt ảnh: …\nPrompt video: …"></textarea></label>'
        + '<div class="film-canvas-actions"><button id="filmCanvasParse" type="button" class="primary">Phân tích kịch bản</button><button id="filmCanvasLayout" type="button">Tự xếp layout</button><button id="filmCanvasExport" type="button">Xuất JSON</button><label class="film-canvas-file">Nhập JSON<input id="filmCanvasImport" type="file" accept=".json,application/json" hidden></label></div>'
        + '<div id="filmCanvasMinimap" class="film-canvas-minimap"></div><div id="filmCanvasList" class="film-canvas-list"></div><p id="filmCanvasStatus" role="status"></p>';
      document.body.append(dialog);
      const $ = (id) => dialog.querySelector('#' + id);
      let project = null;
      const status = (t, err) => { const el = $('filmCanvasStatus'); el.textContent = t; el.className = err ? 'error' : ''; };
      const render = () => {
        if (!project) return;
        const list = $('filmCanvasList'); list.replaceChildren();
        for (const shot of toShotPrompts(project)) {
          const card = document.createElement('article');
          card.innerHTML = '';
          const h = document.createElement('h4'); h.textContent = shot.title + ' · ' + shot.duration + 's · ' + shot.size; card.append(h);
          const pre = document.createElement('pre'); pre.textContent = shot.videoPrompt; card.append(pre);
          list.append(card);
        }
        const map = $('filmCanvasMinimap'); map.replaceChildren();
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 900 400'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Minimap đồ thị phim');
        const maxX = Math.max(1, ...project.nodes.map((n) => n.x));
        const maxY = Math.max(1, ...project.nodes.map((n) => n.y));
        for (const e of project.edges) {
          const s = project.nodes.find((n) => n.id === e.source), t = project.nodes.find((n) => n.id === e.target);
          if (!s || !t) continue;
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', 20 + (s.x / maxX) * 860); line.setAttribute('y1', 20 + (s.y / maxY) * 360);
          line.setAttribute('x2', 20 + (t.x / maxX) * 860); line.setAttribute('y2', 20 + (t.y / maxY) * 360);
          line.setAttribute('class', 'film-edge'); svg.append(line);
        }
        for (const n of project.nodes) {
          const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          r.setAttribute('x', 10 + (n.x / maxX) * 860); r.setAttribute('y', 10 + (n.y / maxY) * 360);
          r.setAttribute('width', 22); r.setAttribute('height', 14); r.setAttribute('class', 'film-node-' + n.kind);
          const title = document.createElementNS('http://www.w3.org/2000/svg', 'title'); title.textContent = n.kind + ': ' + n.title; r.append(title); svg.append(r);
        }
        map.append(svg);
      };
      $('filmCanvasClose').onclick = () => dialog.close();
      $('filmCanvasParse').onclick = () => { try { project = parseMasterScript($('filmCanvasScript').value); render(); status('Đã phân tích ' + project.nodes.filter((n) => n.kind === 'scene').length + ' cảnh, ' + project.nodes.filter((n) => n.kind === 'shot').length + ' shot.'); } catch (e) { status(e.message, true); } };
      $('filmCanvasLayout').onclick = () => { try { if (!project) throw Error('Phân tích kịch bản trước.'); autoLayout(project); render(); status('Đã tự xếp layout.'); } catch (e) { status(e.message, true); } };
      $('filmCanvasExport').onclick = () => { try { if (!project) throw Error('Chưa có đồ thị để xuất.'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([exportJSON(project)], { type: 'application/json' })); a.download = 'film-canvas.json'; a.click(); status('Đã xuất film-canvas.json.'); } catch (e) { status(e.message, true); } };
      $('filmCanvasImport').onchange = async (ev) => { const f = ev.target.files[0]; if (!f) return; try { project = importJSON(await f.text()); autoLayout(project); render(); status('Đã nhập ' + project.nodes.length + ' node.'); } catch (e) { status(e.message, true); } };
    }
    if (!dialog.open) dialog.showModal();
  }
  if (typeof document !== 'undefined') {
    const wire = () => { const b = document.getElementById('filmCanvasBtn'); if (b) b.onclick = () => open(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
  }
  globalThis.WorkflowFilmCanvas = { newProject, addNode, link, validate, autoLayout, toShotPrompts, exportJSON, importJSON, parseMasterScript, open, SIZES, KINDS };
})();
