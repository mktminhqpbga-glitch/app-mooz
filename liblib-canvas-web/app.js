const $ = (s) => document.querySelector(s);
const uid = () => crypto.randomUUID();
const esc = (value = "") =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const dateLabel = (time) =>
  new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(time);
const DB_NAME = "canvas-studio-web-v1";
let db,
  state,
  project,
  selected = new Set(),
  pendingPort = null,
  tool = "select",
  drag = null,
  panel = "",
  menuTarget = null,
  fileIntent = "canvas",
  fileCallback = null,
  toastTimer,
  saveTimer,
  refs = [],
  composerCollapsed = false;
const mediaUrls = new Map();

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const database = req.result;
      database.createObjectStore("kv");
      database.createObjectStore("media");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function tx(store, mode, operation) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode),
      req = operation(t.objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
const getKv = (key) => tx("kv", "readonly", (s) => s.get(key));
const putKv = (key, value) => tx("kv", "readwrite", (s) => s.put(value, key));
const putMedia = (key, blob) =>
  tx("media", "readwrite", (s) => s.put(blob, key));
const getMedia = (key) => tx("media", "readonly", (s) => s.get(key));

function demoState() {
  const p = {
    id: uid(),
    name: "Dự án sáng tạo",
    updatedAt: Date.now(),
    view: { x: -1700, y: -925, scale: 0.8 },
    nodes: [],
    edges: [],
    queue: [],
  };
  const text = {
    id: uid(),
    type: "text",
    x: 2050,
    y: 1230,
    w: 320,
    h: 150,
    title: "Ý tưởng ban đầu",
    text: "Một chân dung điện ảnh với ánh sáng dịu, chuyển tiếp sang một cảnh chuyển động.",
  };
  const portrait = {
    id: uid(),
    type: "image",
    x: 2050,
    y: 1450,
    w: 260,
    h: 350,
    title: "Ảnh nhân vật",
    src: "./assets/portrait.jpg",
    ratio: "portrait",
    sample: true,
  };
  const fashion = {
    id: uid(),
    type: "image",
    x: 2390,
    y: 1450,
    w: 260,
    h: 350,
    title: "Ảnh tham chiếu",
    src: "./assets/fashion.jpg",
    ratio: "portrait",
    sample: true,
  };
  const generator = {
    id: uid(),
    type: "generator",
    x: 2780,
    y: 1430,
    w: 280,
    h: 260,
    title: "Tạo cảnh mới",
    prompt:
      "Chân dung điện ảnh, ánh sáng tự nhiên, giữ nhân vật nhất quán qua từng cảnh.",
    mode: "image",
    ratio: "16:9",
  };
  p.nodes.push(text, portrait, fashion, generator);
  p.edges.push(
    { id: uid(), from: text.id, to: generator.id },
    { id: uid(), from: portrait.id, to: generator.id },
    { id: uid(), from: fashion.id, to: generator.id },
  );
  return {
    currentProjectId: p.id,
    projects: [p],
    assets: [],
    characters: [],
    prompts: [
      {
        id: uid(),
        title: "Chân dung điện ảnh",
        text: "Chân dung điện ảnh, ánh sáng tự nhiên, da chân thực, độ sâu trường ảnh nhẹ, bố cục sạch.",
        createdAt: Date.now(),
      },
      {
        id: uid(),
        title: "Video chuyển động",
        text: "Chuyển động máy quay chậm và mượt, giữ nhân vật và bối cảnh nhất quán, ánh sáng điện ảnh.",
        createdAt: Date.now(),
      },
    ],
  };
}
function current() {
  project =
    state.projects.find((p) => p.id === state.currentProjectId) ||
    state.projects[0];
  state.currentProjectId = project.id;
  return project;
}
function save() {
  project.updatedAt = Date.now();
  $("#save-status").textContent = "Đang lưu…";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await putKv("state", state);
      $("#save-status").textContent = "Đã lưu";
    } catch (error) {
      $("#save-status").textContent = "Lỗi lưu";
      toast(`Không lưu được: ${error.message}`);
    }
  }, 250);
}
function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 3500);
}
function urlFor(node) {
  return node.assetId ? mediaUrls.get(node.assetId) : node.src;
}
async function addAsset(file) {
  const id = uid();
  await putMedia(id, file);
  const asset = {
    id,
    name: file.name || `Tài sản ${state.assets.length + 1}`,
    type: file.type,
    createdAt: Date.now(),
    size: file.size,
  };
  state.assets.unshift(asset);
  mediaUrls.set(id, URL.createObjectURL(file));
  save();
  return asset;
}
async function loadMedia() {
  for (const asset of state.assets) {
    const blob = await getMedia(asset.id);
    if (blob) mediaUrls.set(asset.id, URL.createObjectURL(blob));
  }
}
function defaultPosition() {
  const rect = $("#canvas-viewport").getBoundingClientRect(),
    v = project.view;
  return {
    x: Math.round((rect.width / 2 - v.x) / v.scale - 130),
    y: Math.round((rect.height / 2 - v.y) / v.scale - 110),
  };
}
function addNode(type, fields = {}, pos = defaultPosition()) {
  const defaults =
    type === "text"
      ? { w: 300, h: 150, title: "Ghi chú", text: "Nhấp đúp để chỉnh sửa" }
      : type === "generator"
        ? {
            w: 280,
            h: 260,
            title: "Tạo ảnh",
            prompt: "",
            mode: "image",
            ratio: "16:9",
          }
        : { w: 350, h: 270, title: type === "video" ? "Video" : "Hình ảnh" };
  const node = { id: uid(), type, x: pos.x, y: pos.y, ...defaults, ...fields };
  project.nodes.push(node);
  selected = new Set([node.id]);
  save();
  render();
  return node;
}
function nodeById(id) {
  return project.nodes.find((n) => n.id === id);
}
function render() {
  current();
  $("#project-name").textContent = project.name;
  $("#queue-count").textContent = project.queue.filter(
    (q) => q.status !== "done",
  ).length;
  const space = $("#canvas-space");
  space.style.transform = `translate(${project.view.x}px, ${project.view.y}px) scale(${project.view.scale})`;
  $("#zoom-label").textContent = `${Math.round(project.view.scale * 100)}%`;
  const nodes = $("#nodes");
  nodes.innerHTML = "";
  for (const node of project.nodes) nodes.appendChild(makeNode(node));
  drawEdges();
  placeToolbar();
  $("#canvas-empty").classList.toggle("hidden", project.nodes.length > 0);
  renderRefs();
  if (panel) renderPanel();
}
function makeNode(node) {
  const el = document.createElement("article");
  el.className = `node ${node.type} ${node.ratio === "portrait" ? "portrait" : ""} ${selected.has(node.id) ? "selected" : ""}`;
  el.dataset.id = node.id;
  el.style.cssText = `left:${node.x}px;top:${node.y}px;width:${node.w}px`;
  const typeIcon =
    node.type === "video"
      ? "▷"
      : node.type === "image"
        ? "▧"
        : node.type === "generator"
          ? "✦"
          : "▤";
  let body;
  if (node.type === "image")
    body = `<div class="node-card media-card">${urlFor(node) ? `<img draggable="false" src="${esc(urlFor(node))}" alt="${esc(node.title)}">` : '<span class="empty-hint">Chưa có hình ảnh</span>'}${node.sample ? '<span class="media-badge">MẪU</span>' : ""}</div>`;
  else if (node.type === "video")
    body = `<div class="node-card media-card">${urlFor(node) ? `<video preload="metadata" src="${esc(urlFor(node))}"></video><span class="play-badge">▷</span>` : '<span class="empty-hint">Chưa có video</span>'}</div>`;
  else if (node.type === "generator")
    body = `<div class="node-card"><div class="generator-kicker">${node.mode === "video" ? "TẠO VIDEO" : "TẠO HÌNH ẢNH"}</div><div class="generator-title">${esc(node.title)}</div><div class="generator-prompt">${esc(node.prompt || "Nhấp đúp để viết mô tả…")}</div><div class="generator-meta"><span>${esc(node.ratio || "16:9")}</span><span>${typeof window.CANVAS_RENDER_ADAPTER === "function" ? "AI đã kết nối ↗" : "Chờ dịch vụ AI"}</span></div></div>`;
  else body = `<div class="node-card">${esc(node.text || "")}</div>`;
  el.innerHTML = `<div class="node-head"><span>${typeIcon}</span><span class="node-title">${esc(node.title)}</span>${node.type === "image" || node.type === "video" ? `<span class="node-dim">${node.ratio === "portrait" ? "3:4" : "16:9"}</span>` : ""}</div>${body}<div class="node-foot">${node.type === "generator" ? "Chọn để chỉnh sửa" : node.type === "text" ? "Văn bản" : node.assetId ? "Tài sản của bạn" : node.sample ? "Ảnh minh họa" : ""}</div><button class="port in" title="Đầu vào" aria-label="Đầu vào">＋</button><button class="port out" title="Nối tới nút khác" aria-label="Đầu ra">＋</button>`;
  el.addEventListener("pointerdown", nodePointerDown);
  el.addEventListener("contextmenu", (ev) => {
    ev.preventDefault();
    selectNode(node.id, ev.shiftKey);
    showContext(ev.clientX, ev.clientY, node.id);
  });
  el.addEventListener("dblclick", (ev) => {
    if (ev.target.closest(".port")) return;
    editNode(node.id);
  });
  el.querySelectorAll(".port").forEach((port) =>
    port.addEventListener("pointerdown", (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      portClick(node.id, port.classList.contains("out") ? "out" : "in");
    }),
  );
  if (node.type === "video")
    el.querySelector(".media-card").addEventListener("dblclick", (ev) => {
      ev.stopPropagation();
      viewMedia(node);
    });
  return el;
}
function nodePointerDown(ev) {
  if (ev.button !== 0 || tool === "pan" || ev.target.closest(".port")) return;
  const id = ev.currentTarget.dataset.id;
  if (tool === "connect") {
    portClick(id, pendingPort ? "in" : "out");
    return;
  }
  if (fileIntent === "reference-select") {
    refs.push(id);
    fileIntent = "canvas";
    renderRefs();
    toast("Đã thêm ảnh tham chiếu");
    return;
  }
  selectNode(id, ev.shiftKey);
  const start = [...selected].map((sid) => ({
    id: sid,
    x: nodeById(sid).x,
    y: nodeById(sid).y,
  }));
  drag = { kind: "node", x: ev.clientX, y: ev.clientY, start };
  ev.preventDefault();
}
function selectNode(id, additive = false) {
  if (additive) {
    selected.has(id) ? selected.delete(id) : selected.add(id);
  } else {
    const groupId = nodeById(id)?.groupId;
    selected = groupId
      ? new Set(
          project.nodes.filter((n) => n.groupId === groupId).map((n) => n.id),
        )
      : new Set([id]);
  }
  document
    .querySelectorAll(".node")
    .forEach((el) =>
      el.classList.toggle("selected", selected.has(el.dataset.id)),
    );
  placeToolbar();
}
function portClick(id, side) {
  if (side === "out" || !pendingPort) {
    pendingPort = id;
    tool = "connect";
    $("#canvas-viewport").classList.add("connecting");
    toast("Chọn đầu vào của nút tiếp theo để nối");
    return;
  }
  if (
    pendingPort !== id &&
    !project.edges.some((e) => e.from === pendingPort && e.to === id)
  ) {
    project.edges.push({ id: uid(), from: pendingPort, to: id });
    save();
  }
  pendingPort = null;
  setTool("select");
  render();
}
function edgePath(from, to) {
  const x1 = from.x + from.w + 9,
    y1 =
      from.y +
      (from.ratio === "portrait"
        ? 177
        : from.type === "generator"
          ? 139
          : from.type === "text"
            ? 84
            : 144);
  const x2 = to.x - 9,
    y2 =
      to.y +
      (to.ratio === "portrait"
        ? 177
        : to.type === "generator"
          ? 139
          : to.type === "text"
            ? 84
            : 144);
  const bend = Math.max(72, Math.abs(x2 - x1) * 0.45);
  return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
}
function drawEdges() {
  const svg = $("#edges");
  svg.innerHTML = "";
  for (const edge of project.edges) {
    const a = nodeById(edge.from),
      b = nodeById(edge.to);
    if (!a || !b) continue;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("class", "edge");
    path.setAttribute("d", edgePath(a, b));
    path.dataset.id = edge.id;
    path.style.pointerEvents = "stroke";
    path.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (confirm("Xóa đường nối này?")) {
        project.edges = project.edges.filter((e) => e.id !== edge.id);
        save();
        render();
      }
    });
    svg.append(path);
  }
}
function placeToolbar() {
  const bar = $("#selection-toolbar");
  if (!selected.size) {
    bar.classList.add("hidden");
    return;
  }
  const nodes = [...selected].map(nodeById).filter(Boolean);
  if (!nodes.length) {
    selected.clear();
    bar.classList.add("hidden");
    return;
  }
  const n = nodes[0],
    rect = $("#canvas-viewport").getBoundingClientRect(),
    v = project.view;
  bar.style.left = `${Math.max(8, Math.min(rect.width - 500, n.x * v.scale + v.x))}px`;
  bar.style.top = `${Math.max(9, n.y * v.scale + v.y - 52)}px`;
  bar.innerHTML = `<button data-action="edit">✎ Chỉnh sửa</button><button data-action="connect">⌁ Nối</button><button data-action="duplicate">⧉ Nhân bản</button><button data-action="group">▦ Nhóm</button><button data-action="save-asset">↓ Lưu tài sản</button><button data-action="delete">⌫ Xóa</button>`;
  bar.classList.remove("hidden");
  bar
    .querySelectorAll("button")
    .forEach((btn) => (btn.onclick = () => nodeAction(btn.dataset.action)));
}
function nodeAction(action) {
  const ids = [...selected],
    first = nodeById(ids[0]);
  if (!first) return;
  if (action === "edit") return editNode(first.id);
  if (action === "connect") return portClick(first.id, "out");
  if (action === "duplicate") {
    const clones = ids.map((id) => ({
      ...structuredClone(nodeById(id)),
      id: uid(),
      x: nodeById(id).x + 35,
      y: nodeById(id).y + 35,
      groupId: null,
    }));
    project.nodes.push(...clones);
    selected = new Set(clones.map((n) => n.id));
  }
  if (action === "group") {
    if (ids.length < 2) return toast("Chọn ít nhất hai nút bằng Shift + nhấp");
    const groupId = uid();
    ids.forEach((id) => (nodeById(id).groupId = groupId));
    toast(`Đã nhóm ${ids.length} nút`);
  }
  if (action === "save-asset") {
    if (!first.assetId)
      return toast("Ảnh mẫu đã có sẵn; tải lên ảnh của bạn để lưu tài sản");
    return toast("Đã lưu trong thư viện tài sản");
  }
  if (action === "delete") {
    project.nodes = project.nodes.filter((n) => !selected.has(n.id));
    project.edges = project.edges.filter(
      (e) => !selected.has(e.from) && !selected.has(e.to),
    );
    selected.clear();
  }
  save();
  render();
}
function editNode(id) {
  const n = nodeById(id);
  if (!n) return;
  if (n.type === "image" || n.type === "video") return viewMedia(n);
  const value = n.type === "text" ? n.text : n.prompt;
  openModal(
    `<h2>Chỉnh sửa ${n.type === "text" ? "văn bản" : "nút tạo"}</h2><input id="edit-title" class="field" value="${esc(n.title)}" aria-label="Tên nút"><textarea id="edit-text" class="field" rows="7" aria-label="Nội dung">${esc(value)}</textarea><div class="modal-actions"><button data-close>Hủy</button><button id="edit-save" class="confirm">Lưu</button></div>`,
  );
  $("#edit-save").onclick = () => {
    n.title = $("#edit-title").value.trim() || n.title;
    if (n.type === "text") n.text = $("#edit-text").value;
    else n.prompt = $("#edit-text").value;
    closeModal();
    save();
    render();
  };
}
function viewMedia(n) {
  const url = urlFor(n);
  if (!url) return;
  openModal(
    `<h2>${esc(n.title)}</h2>${n.type === "video" ? `<video src="${esc(url)}" controls autoplay></video>` : `<img src="${esc(url)}" alt="${esc(n.title)}">`}<div class="modal-actions"><button id="media-reference">Dùng làm tham chiếu</button><button id="media-download">Tải về</button><button data-close>Đóng</button></div>`,
  );
  $("#media-reference").onclick = () => {
    refs.push(n.id);
    closeModal();
    renderRefs();
    toast("Đã thêm tham chiếu");
  };
  $("#media-download").onclick = () => downloadUrl(url, n.title);
}
function downloadUrl(url, name) {
  const a = document.createElement("a");
  a.href = url;
  a.download = name || "media";
  a.click();
}
function setTool(name) {
  tool = name;
  pendingPort = null;
  $("#canvas-viewport").classList.toggle("connecting", name === "connect");
  for (const n of ["select", "pan", "connect"])
    $(`#tool-${n}`).classList.toggle("active", name === n);
}
function applyView() {
  $("#canvas-space").style.transform =
    `translate(${project.view.x}px, ${project.view.y}px) scale(${project.view.scale})`;
  $("#zoom-label").textContent = `${Math.round(project.view.scale * 100)}%`;
  placeToolbar();
}
function zoom(
  factor,
  cx = $("#canvas-viewport").clientWidth / 2,
  cy = $("#canvas-viewport").clientHeight / 2,
) {
  const v = project.view,
    old = v.scale;
  v.scale = Math.max(0.25, Math.min(2, +(old * factor).toFixed(3)));
  v.x = cx - ((cx - v.x) * v.scale) / old;
  v.y = cy - ((cy - v.y) * v.scale) / old;
  applyView();
  save();
}
function fit() {
  if (!project.nodes.length) return;
  const rect = $("#canvas-viewport").getBoundingClientRect(),
    minX = Math.min(...project.nodes.map((n) => n.x)),
    maxX = Math.max(...project.nodes.map((n) => n.x + n.w)),
    minY = Math.min(...project.nodes.map((n) => n.y)),
    maxY = Math.max(
      ...project.nodes.map((n) => n.y + (n.ratio === "portrait" ? 355 : 290)),
    );
  const bottomGap = composerCollapsed ? 100 : 260;
  const usableHeight = Math.max(250, rect.height - bottomGap);
  const scale = Math.max(
    0.3,
    Math.min(
      1.25,
      Math.min(
        (rect.width - 130) / (maxX - minX),
        (usableHeight - 90) / (maxY - minY),
      ),
    ),
  );
  project.view = {
    scale,
    x: (rect.width - (maxX - minX) * scale) / 2 - minX * scale,
    y: (usableHeight - (maxY - minY) * scale) / 2 - minY * scale,
  };
  applyView();
  save();
}
function openModal(html) {
  $("#modal").innerHTML = html;
  $("#modal-backdrop").classList.remove("hidden");
  $("#modal")
    .querySelectorAll("[data-close]")
    .forEach((b) => (b.onclick = closeModal));
}
function closeModal() {
  $("#modal-backdrop").classList.add("hidden");
  $("#modal").innerHTML = "";
}
function showContext(x, y, id) {
  const menu = $("#context-menu");
  menuTarget = id;
  menu.innerHTML = `<button data-action="edit">✎ Chỉnh sửa / Xem</button><button data-action="connect">⌁ Nối với nút khác</button><button data-action="duplicate">⧉ Tạo bản sao</button><button data-action="reference">▧ Dùng làm tham chiếu</button><button data-action="download">↓ Tải xuống</button><hr><button data-action="delete">⌫ Xóa nút</button>`;
  menu.style.left = `${Math.min(x, innerWidth - 225)}px`;
  menu.style.top = `${Math.min(y, innerHeight - 300)}px`;
  menu.classList.remove("hidden");
  menu.querySelectorAll("button").forEach(
    (b) =>
      (b.onclick = () => {
        const a = b.dataset.action,
          n = nodeById(id);
        menu.classList.add("hidden");
        if (a === "reference") {
          refs.push(id);
          renderRefs();
        } else if (a === "download") {
          if (n && urlFor(n)) downloadUrl(urlFor(n), n.title);
        } else nodeAction(a);
      }),
  );
}
function showMenu(x, y, items) {
  const menu = $("#context-menu");
  menu.innerHTML = items
    .map((i, k) => `<button data-index="${k}">${esc(i.label)}</button>`)
    .join("");
  menu.style.left = `${Math.min(x, innerWidth - 225)}px`;
  menu.style.top = `${Math.min(y, innerHeight - Math.min(360, items.length * 41 + 12))}px`;
  menu.classList.remove("hidden");
  menu.querySelectorAll("button").forEach(
    (b) =>
      (b.onclick = () => {
        menu.classList.add("hidden");
        items[Number(b.dataset.index)].run();
      }),
  );
}

function chooseFiles(intent, callback = null, accept = "image/*,video/*") {
  fileIntent = intent;
  fileCallback = callback;
  const input = $("#file-input");
  input.accept = accept;
  input.value = "";
  input.click();
}
async function handleFiles(files) {
  const intent = fileIntent;
  fileIntent = "canvas";
  for (const file of files) {
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      toast("Chỉ hỗ trợ ảnh và video");
      continue;
    }
    const asset = await addAsset(file);
    if (intent === "character") {
      state.characters.unshift({
        id: uid(),
        assetId: asset.id,
        name: file.name.replace(/\.[^.]+$/, ""),
        createdAt: Date.now(),
      });
    } else if (intent === "output" && fileCallback) {
      fileCallback(asset);
    } else if (intent === "reference") {
      const node = addNode(file.type.startsWith("video/") ? "video" : "image", {
        assetId: asset.id,
        title: asset.name,
      });
      refs.push(node.id);
    } else if (intent === "assets-only") {
    } else {
      addNode(file.type.startsWith("video/") ? "video" : "image", {
        assetId: asset.id,
        title: asset.name,
      });
    }
  }
  fileCallback = null;
  save();
  render();
}
function renderRefs() {
  $("#reference-list").innerHTML = refs
    .map((id, i) => {
      const n = nodeById(id);
      return n
        ? `<span class="reference-pill">▧ ${esc(n.title)}<button data-index="${i}" aria-label="Bỏ tham chiếu">×</button></span>`
        : "";
    })
    .join("");
  $("#reference-list")
    .querySelectorAll("button")
    .forEach(
      (b) =>
        (b.onclick = () => {
          refs.splice(Number(b.dataset.index), 1);
          renderRefs();
        }),
    );
}
function submitPrompt() {
  const prompt = $("#prompt-input").value.trim();
  if (!prompt) return toast("Nhập mô tả trước khi tạo yêu cầu");
  const mode = $("#mode-select").value,
    ratio = $("#ratio-select").value,
    duration = Number($("#duration-select").value);
  const pos = defaultPosition(),
    generator = addNode(
      "generator",
      {
        prompt,
        mode,
        ratio,
        title: mode === "image" ? "Tạo hình ảnh" : "Tạo video",
      },
      pos,
    );
  const currentRefs = [...new Set(refs)].filter(nodeById);
  for (const id of currentRefs)
    project.edges.push({ id: uid(), from: id, to: generator.id });
  const job = {
    id: uid(),
    nodeId: generator.id,
    mode,
    prompt,
    ratio,
    duration,
    refs: currentRefs,
    status: "wait",
    createdAt: Date.now(),
  };
  project.queue.unshift(job);
  $("#prompt-input").value = "";
  refs = [];
  save();
  render();
  openPanel("queue");
  if (typeof window.CANVAS_RENDER_ADAPTER === "function") runAdapter(job);
  else toast("Đã thêm yêu cầu. Gắn kết quả khi bạn có ảnh/video.");
}
async function runAdapter(job) {
  try {
    job.status = "running";
    save();
    renderPanel();
    const result = await window.CANVAS_RENDER_ADAPTER({
      mode: job.mode,
      prompt: job.prompt,
      ratio: job.ratio,
      duration: job.duration,
      references: job.refs
        .map((id) => nodeById(id))
        .filter(Boolean)
        .map((n) => ({ title: n.title, url: urlFor(n) })),
    });
    if (result instanceof Blob) {
      const file =
        result instanceof File
          ? result
          : new File(
              [result],
              `${job.mode}-${job.id}.${job.mode === "video" ? "mp4" : "png"}`,
              {
                type:
                  result.type ||
                  (job.mode === "video" ? "video/mp4" : "image/png"),
              },
            );
      completeJob(job, await addAsset(file));
    } else if (typeof result === "string") {
      const response = await fetch(result);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      completeJob(
        job,
        await addAsset(
          new File([await response.blob()], `${job.mode}-${job.id}`, {
            type:
              response.headers.get("content-type") ||
              (job.mode === "video" ? "video/mp4" : "image/png"),
          }),
        ),
      );
    } else throw new Error("Adapter phải trả về Blob, File hoặc URL");
  } catch (error) {
    job.status = "error";
    job.error = String(error.message || error);
    save();
    renderPanel();
    toast(`Tạo thất bại: ${job.error}`);
  }
}
function completeJob(job, asset) {
  const source = nodeById(job.nodeId),
    result = addNode(
      job.mode,
      { assetId: asset.id, title: `Kết quả · ${asset.name}` },
      { x: (source?.x || 2500) + 410, y: source?.y || 1400 },
    );
  project.edges.push({ id: uid(), from: job.nodeId, to: result.id });
  job.status = "done";
  job.resultId = result.id;
  save();
  render();
  toast("Đã nhận kết quả");
}

function openPanel(name) {
  panel = name;
  $("#side-panel").classList.remove("hidden");
  renderPanel();
}
function closePanel() {
  panel = "";
  $("#side-panel").classList.add("hidden");
}
function renderPanel() {
  if (!panel) return;
  const el = $("#side-panel");
  const names = {
    assets: "Quản lý tài sản",
    characters: "Thư viện nhân vật",
    prompts: "Kho prompt",
    queue: "Hàng đợi",
    projects: "Dự án",
  };
  let body = "";
  if (panel === "assets")
    body = `<div class="panel-actions"><button data-panel-action="upload">＋ Tải lên</button></div><input id="panel-search" class="panel-search" placeholder="Tìm tài sản…"><div id="panel-results" class="asset-grid"></div>`;
  if (panel === "characters")
    body = `<div class="panel-actions"><button data-panel-action="new-character">＋ Thêm nhân vật</button></div><div id="panel-results"></div>`;
  if (panel === "prompts")
    body = `<div class="panel-actions"><button data-panel-action="new-prompt">＋ Lưu prompt mới</button></div><input id="panel-search" class="panel-search" placeholder="Tìm prompt…"><div id="panel-results"></div>`;
  if (panel === "queue")
    body = `<div class="panel-actions"><button data-panel-action="clear-done">Dọn mục đã xong</button></div><div id="panel-results"></div>`;
  if (panel === "projects")
    body = `<div class="panel-actions"><button data-panel-action="new-project">＋ Dự án mới</button><button data-panel-action="import-project">Nhập JSON</button></div><div id="panel-results"></div>`;
  el.innerHTML = `<div class="panel-head"><h2>${names[panel]}</h2><button id="panel-close" aria-label="Đóng">×</button></div><div class="panel-body">${body}</div><div class="panel-footer">Lưu tự động trong trình duyệt này</div>`;
  $("#panel-close").onclick = closePanel;
  el.querySelectorAll("[data-panel-action]").forEach(
    (b) => (b.onclick = () => panelAction(b.dataset.panelAction)),
  );
  $("#panel-search")?.addEventListener("input", fillPanelResults);
  fillPanelResults();
}
function fillPanelResults() {
  const box = $("#panel-results");
  if (!box) return;
  const query = ($("#panel-search")?.value || "").toLowerCase();
  if (panel === "assets") {
    const items = state.assets.filter((a) =>
      a.name.toLowerCase().includes(query),
    );
    box.innerHTML = items.length
      ? items
          .map(
            (a) =>
              `<button class="asset-card" data-id="${a.id}">${a.type.startsWith("video/") ? `<video src="${esc(mediaUrls.get(a.id) || "")}"></video>` : `<img src="${esc(mediaUrls.get(a.id) || "")}" alt="">`}<span>${esc(a.name)}</span></button>`,
          )
          .join("")
      : `<p class="empty-hint">Chưa có tài sản. Tải lên ảnh hoặc video để bắt đầu.</p>`;
    box.querySelectorAll("button").forEach(
      (b) =>
        (b.onclick = () => {
          const a = state.assets.find((x) => x.id === b.dataset.id);
          addNode(a.type.startsWith("video/") ? "video" : "image", {
            assetId: a.id,
            title: a.name,
          });
          closePanel();
        }),
    );
  }
  if (panel === "characters") {
    box.innerHTML = state.characters.length
      ? state.characters
          .map(
            (c) =>
              `<div class="panel-item character-card"><img src="${esc(mediaUrls.get(c.assetId) || "")}" alt=""><div><strong>${esc(c.name)}</strong><div class="item-actions"><button class="small-button" data-add="${c.id}">Thêm vào canvas</button><button class="small-button" data-remove="${c.id}">Xóa</button></div></div></div>`,
          )
          .join("")
      : `<p class="empty-hint">Lưu ảnh nhân vật để tái sử dụng trong mọi dự án.</p>`;
    box.querySelectorAll("[data-add]").forEach(
      (b) =>
        (b.onclick = () => {
          const c = state.characters.find((x) => x.id === b.dataset.add);
          addNode("image", {
            assetId: c.assetId,
            title: c.name,
            ratio: "portrait",
          });
          closePanel();
        }),
    );
    box.querySelectorAll("[data-remove]").forEach(
      (b) =>
        (b.onclick = () => {
          state.characters = state.characters.filter(
            (x) => x.id !== b.dataset.remove,
          );
          save();
          renderPanel();
        }),
    );
  }
  if (panel === "prompts") {
    const items = state.prompts.filter((p) =>
      `${p.title} ${p.text}`.toLowerCase().includes(query),
    );
    box.innerHTML = items.length
      ? items
          .map(
            (p) =>
              `<div class="panel-item"><strong>${esc(p.title)}</strong><p>${esc(p.text)}</p><div class="item-actions"><button class="small-button" data-use="${p.id}">Dùng prompt</button><button class="small-button" data-edit="${p.id}">Sửa</button><button class="small-button" data-remove="${p.id}">Xóa</button></div></div>`,
          )
          .join("")
      : `<p class="empty-hint">Chưa có prompt mẫu.</p>`;
    box.querySelectorAll("[data-use]").forEach(
      (b) =>
        (b.onclick = () => {
          const p = state.prompts.find((x) => x.id === b.dataset.use);
          $("#prompt-input").value = p.text;
          setComposerCollapsed(false);
          closePanel();
          $("#prompt-input").focus();
        }),
    );
    box
      .querySelectorAll("[data-edit]")
      .forEach((b) => (b.onclick = () => editPrompt(b.dataset.edit)));
    box.querySelectorAll("[data-remove]").forEach(
      (b) =>
        (b.onclick = () => {
          state.prompts = state.prompts.filter(
            (x) => x.id !== b.dataset.remove,
          );
          save();
          renderPanel();
        }),
    );
  }
  if (panel === "queue") {
    box.innerHTML = project.queue.length
      ? project.queue
          .map(
            (q) =>
              `<div class="panel-item"><span class="queue-status ${q.status === "done" ? "done" : q.status === "wait" ? "wait" : ""}">${q.status === "wait" ? "Chờ kết quả" : q.status === "running" ? "Đang tạo" : q.status === "done" ? "Hoàn tất" : "Có lỗi"}</span><strong>${q.mode === "video" ? "▷ Video" : "✦ Hình ảnh"}</strong><p>${esc(q.prompt)}</p><p>${dateLabel(q.createdAt)} · ${esc(q.ratio)}${q.error ? `<br>${esc(q.error)}` : ""}</p><div class="item-actions">${q.status !== "done" ? `<button class="small-button" data-attach="${q.id}">＋ Gắn kết quả</button>` : `<button class="small-button" data-locate="${q.id}">Xem kết quả</button>`}<button class="small-button" data-remove="${q.id}">Xóa</button></div></div>`,
          )
          .join("")
      : `<p class="empty-hint">Chưa có yêu cầu. Nhập mô tả rồi nhấn ↑ để thêm vào hàng đợi.</p>`;
    box.querySelectorAll("[data-attach]").forEach(
      (b) =>
        (b.onclick = () => {
          const job = project.queue.find((x) => x.id === b.dataset.attach);
          chooseFiles(
            "output",
            (asset) => completeJob(job, asset),
            job.mode === "video" ? "video/*" : "image/*",
          );
        }),
    );
    box.querySelectorAll("[data-locate]").forEach(
      (b) =>
        (b.onclick = () => {
          const q = project.queue.find((x) => x.id === b.dataset.locate),
            n = nodeById(q.resultId);
          if (n) {
            selected = new Set([n.id]);
            project.view.x = innerWidth / 2 - n.x * project.view.scale;
            project.view.y = innerHeight / 2 - n.y * project.view.scale;
            closePanel();
            render();
          }
        }),
    );
    box.querySelectorAll("[data-remove]").forEach(
      (b) =>
        (b.onclick = () => {
          project.queue = project.queue.filter(
            (x) => x.id !== b.dataset.remove,
          );
          save();
          render();
        }),
    );
  }
  if (panel === "projects") {
    box.innerHTML = state.projects
      .map(
        (p) =>
          `<div class="panel-item"><strong>${esc(p.name)}</strong><p>${p.nodes.length} nút · ${dateLabel(p.updatedAt)}</p><div class="item-actions"><button class="small-button" data-open="${p.id}">Mở</button><button class="small-button" data-rename="${p.id}">Đổi tên</button><button class="small-button" data-duplicate="${p.id}">Nhân bản</button><button class="small-button" data-export="${p.id}">Xuất</button>${state.projects.length > 1 ? `<button class="small-button" data-delete="${p.id}">Xóa</button>` : ""}</div></div>`,
      )
      .join("");
    box.querySelectorAll("[data-open]").forEach(
      (b) =>
        (b.onclick = () => {
          state.currentProjectId = b.dataset.open;
          selected.clear();
          refs = [];
          current();
          save();
          closePanel();
          render();
        }),
    );
    box
      .querySelectorAll("[data-rename]")
      .forEach((b) => (b.onclick = () => renameProject(b.dataset.rename)));
    box
      .querySelectorAll("[data-duplicate]")
      .forEach(
        (b) => (b.onclick = () => duplicateProject(b.dataset.duplicate)),
      );
    box
      .querySelectorAll("[data-export]")
      .forEach((b) => (b.onclick = () => exportProject(b.dataset.export)));
    box.querySelectorAll("[data-delete]").forEach(
      (b) =>
        (b.onclick = () => {
          if (!confirm("Xóa dự án này?")) return;
          state.projects = state.projects.filter(
            (p) => p.id !== b.dataset.delete,
          );
          current();
          save();
          render();
        }),
    );
  }
}
function panelAction(action) {
  if (action === "upload") chooseFiles("assets-only");
  if (action === "new-character") chooseFiles("character", null, "image/*");
  if (action === "new-prompt") editPrompt();
  if (action === "clear-done") {
    project.queue = project.queue.filter((q) => q.status !== "done");
    save();
    render();
  }
  if (action === "new-project") newProject();
  if (action === "import-project") $("#project-import").click();
}
function editPrompt(id = null) {
  const p = state.prompts.find((x) => x.id === id);
  openModal(
    `<h2>${p ? "Sửa prompt" : "Lưu prompt mẫu"}</h2><input id="prompt-title" class="field" placeholder="Tên prompt" value="${esc(p?.title || "")}"><textarea id="prompt-text" class="field" rows="8" placeholder="Nội dung prompt">${esc(p?.text || $("#prompt-input").value)}</textarea><div class="modal-actions"><button data-close>Hủy</button><button id="save-prompt" class="confirm">Lưu prompt</button></div>`,
  );
  $("#save-prompt").onclick = () => {
    const title = $("#prompt-title").value.trim(),
      value = $("#prompt-text").value.trim();
    if (!title || !value) return toast("Nhập tên và nội dung prompt");
    if (p) {
      p.title = title;
      p.text = value;
    } else
      state.prompts.unshift({
        id: uid(),
        title,
        text: value,
        createdAt: Date.now(),
      });
    closeModal();
    save();
    if (panel) renderPanel();
  };
}
function newProject() {
  const p = {
    id: uid(),
    name: `Dự án ${state.projects.length + 1}`,
    updatedAt: Date.now(),
    view: { x: -1500, y: -1000, scale: 0.75 },
    nodes: [],
    edges: [],
    queue: [],
  };
  state.projects.unshift(p);
  state.currentProjectId = p.id;
  selected.clear();
  refs = [];
  current();
  closePanel();
  save();
  render();
}
function renameProject(id = project.id) {
  const p = state.projects.find((x) => x.id === id);
  openModal(
    `<h2>Đổi tên dự án</h2><input id="rename-input" class="field" value="${esc(p.name)}"><div class="modal-actions"><button data-close>Hủy</button><button id="rename-save" class="confirm">Lưu</button></div>`,
  );
  $("#rename-save").onclick = () => {
    p.name = $("#rename-input").value.trim() || p.name;
    closeModal();
    save();
    render();
  };
}
function duplicateProject(id = project.id) {
  const original = state.projects.find((x) => x.id === id),
    copy = structuredClone(original);
  copy.id = uid();
  copy.name += " · Bản sao";
  copy.updatedAt = Date.now();
  state.projects.unshift(copy);
  state.currentProjectId = copy.id;
  selected.clear();
  current();
  save();
  render();
}
async function exportProject(id = project.id) {
  const p = state.projects.find((x) => x.id === id),
    assetIds = [...new Set(p.nodes.map((n) => n.assetId).filter(Boolean))];
  const assets = [];
  for (const aid of assetIds) {
    const blob = await getMedia(aid),
      meta = state.assets.find((a) => a.id === aid);
    if (blob && meta) assets.push({ ...meta, data: await blobToDataUrl(blob) });
  }
  const data = { format: "canvas-studio-v1", project: p, assets };
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  downloadUrl(url, `${p.name.replace(/[^a-z0-9_-]/gi, "-")}.canvas.json`);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
async function importProject(file) {
  try {
    const data = JSON.parse(await file.text());
    if (
      data.format !== "canvas-studio-v1" ||
      !Array.isArray(data.project?.nodes) ||
      !Array.isArray(data.project?.edges)
    )
      throw new Error("Định dạng dự án không hợp lệ");
    const p = data.project,
      oldId = p.id;
    p.id = uid();
    p.name += " · Nhập";
    p.updatedAt = Date.now();
    p.queue = Array.isArray(p.queue) ? p.queue : [];
    p.view = p.view || { x: 0, y: 0, scale: 1 };
    const assetMap = new Map();
    for (const a of data.assets || []) {
      const response = await fetch(a.data),
        blob = await response.blob(),
        asset = await addAsset(new File([blob], a.name, { type: a.type }));
      assetMap.set(a.id, asset.id);
    }
    for (const n of p.nodes)
      if (n.assetId) n.assetId = assetMap.get(n.assetId) || null;
    state.projects.unshift(p);
    state.currentProjectId = p.id;
    selected.clear();
    current();
    save();
    render();
    closePanel();
    toast("Đã nhập dự án");
  } catch (e) {
    toast(`Không nhập được: ${e.message}`);
  }
}
function setComposerCollapsed(value) {
  composerCollapsed = value;
  $("#composer").classList.toggle("hidden", value);
  $("#composer-reopen").classList.toggle("hidden", !value);
}

function bind() {
  $("#project-button").onclick = () => openPanel("projects");
  $("#brand").onclick = () => openPanel("projects");
  $("#board-button").onclick = () => openPanel("projects");
  $("#new-project").onclick = newProject;
  $("#share-button").onclick = () =>
    showMenu(innerWidth - 220, 52, [
      { label: "Xuất dự án (JSON)", run: () => exportProject() },
      { label: "Đổi tên dự án", run: () => renameProject() },
      { label: "Nhân bản dự án", run: () => duplicateProject() },
      { label: "Nhập dự án", run: () => $("#project-import").click() },
    ]);
  $("#fit-button").onclick = fit;
  $("#zoom-out").onclick = () => zoom(0.8);
  $("#zoom-in").onclick = () => zoom(1.25);
  $("#zoom-label").onclick = fit;
  $("#assets-toggle").onclick = () => openPanel("assets");
  $("#library-toggle").onclick = () => openPanel("assets");
  $("#characters-toggle").onclick = () => openPanel("characters");
  $("#prompts-toggle").onclick = () => openPanel("prompts");
  $("#queue-toggle").onclick = () => openPanel("queue");
  $("#dock-character").onclick = () => openPanel("characters");
  $("#dock-prompt").onclick = () => openPanel("prompts");
  $("#dock-history").onclick = () => openPanel("queue");
  $("#help-button").onclick = showHelp;
  $("#dock-help").onclick = showHelp;
  $("#add-node").onclick = (ev) =>
    showMenu(ev.clientX, ev.clientY - 240, [
      { label: "▧ Tải ảnh / video", run: () => chooseFiles("canvas") },
      { label: "▤ Thêm văn bản", run: () => addNode("text") },
      { label: "✦ Nút tạo ảnh", run: () => addNode("generator") },
      { label: "▦ Từ thư viện tài sản", run: () => openPanel("assets") },
    ]);
  $("#empty-create").onclick = () => addNode("text");
  ["select", "pan", "connect"].forEach(
    (t) => ($(`#tool-${t}`).onclick = () => setTool(t)),
  );
  $("#composer-upload").onclick = () => chooseFiles("reference");
  $("#composer-reference").onclick = () => {
    fileIntent = "reference-select";
    toast("Nhấp vào một nút trên canvas để tham chiếu");
  };
  $("#composer-template").onclick = () => openPanel("prompts");
  $("#composer-characters").onclick = () => openPanel("characters");
  $("#composer-minimize").onclick = () => setComposerCollapsed(true);
  $("#composer-reopen").onclick = () => setComposerCollapsed(false);
  $("#submit-prompt").onclick = submitPrompt;
  $("#mode-select").onchange = () =>
    $("#duration-select").classList.toggle(
      "hidden",
      $("#mode-select").value !== "video",
    );
  $("#file-input").onchange = (ev) => handleFiles([...ev.target.files]);
  $("#project-import").onchange = (ev) => {
    const f = ev.target.files[0];
    if (f) importProject(f);
    ev.target.value = "";
  };
  $("#modal-backdrop").onclick = (ev) => {
    if (ev.target.id === "modal-backdrop") closeModal();
  };
  const viewport = $("#canvas-viewport");
  viewport.addEventListener("pointerdown", (ev) => {
    if (ev.button !== 0 || ev.target.closest(".node")) return;
    $("#context-menu").classList.add("hidden");
    if (tool === "connect") {
      pendingPort = null;
      setTool("select");
      return;
    }
    if (!ev.shiftKey) {
      selected.clear();
      render();
    }
    drag = {
      kind: "pan",
      x: ev.clientX,
      y: ev.clientY,
      ox: project.view.x,
      oy: project.view.y,
    };
    viewport.setPointerCapture(ev.pointerId);
    viewport.classList.add("panning");
  });
  window.addEventListener("pointermove", (ev) => {
    if (!drag) return;
    if (drag.kind === "node") {
      const dx = (ev.clientX - drag.x) / project.view.scale,
        dy = (ev.clientY - drag.y) / project.view.scale;
      drag.start.forEach((start) => {
        const n = nodeById(start.id);
        if (n) {
          n.x = Math.round(start.x + dx);
          n.y = Math.round(start.y + dy);
          const el = $(`.node[data-id="${n.id}"]`);
          if (el) {
            el.style.left = `${n.x}px`;
            el.style.top = `${n.y}px`;
          }
        }
      });
      drawEdges();
      placeToolbar();
    } else {
      project.view.x = drag.ox + ev.clientX - drag.x;
      project.view.y = drag.oy + ev.clientY - drag.y;
      applyView();
    }
  });
  window.addEventListener("pointerup", () => {
    if (drag) {
      save();
      drag = null;
      viewport.classList.remove("panning");
    }
  });
  viewport.addEventListener(
    "wheel",
    (ev) => {
      if (!ev.ctrlKey && !ev.metaKey) return;
      ev.preventDefault();
      const r = viewport.getBoundingClientRect();
      zoom(
        ev.deltaY < 0 ? 1.09 : 0.92,
        ev.clientX - r.left,
        ev.clientY - r.top,
      );
    },
    { passive: false },
  );
  window.addEventListener("keydown", (ev) => {
    const writing = /INPUT|TEXTAREA|SELECT/.test(
      document.activeElement?.tagName || "",
    );
    if (ev.key === "Escape") {
      closeModal();
      $("#context-menu").classList.add("hidden");
      pendingPort = null;
      if (fileIntent === "reference-select") fileIntent = "canvas";
      setTool("select");
    }
    if (writing || !$("#modal-backdrop").classList.contains("hidden")) return;
    if (ev.key === "Delete" || ev.key === "Backspace") nodeAction("delete");
    if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "d") {
      ev.preventDefault();
      nodeAction("duplicate");
    }
    if (ev.key.toLowerCase() === "v") setTool("select");
    if (ev.key.toLowerCase() === "h") setTool("pan");
    if (ev.key.toLowerCase() === "f") fit();
    if (ev.key === "+" || ev.key === "=") zoom(1.25);
    if (ev.key === "-") zoom(0.8);
  });
  window.addEventListener("click", (ev) => {
    if (
      !ev.target.closest("#context-menu") &&
      !ev.target.closest("#add-node") &&
      !ev.target.closest("#share-button")
    )
      $("#context-menu").classList.add("hidden");
  });
  window.addEventListener("resize", placeToolbar);
}
function showHelp() {
  openModal(
    `<h2>Cách dùng Canvas Studio</h2><p>Kéo nút để bố trí, kéo nền để di chuyển canvas. Dùng nút ＋ ở hai bên để nối nút. Nhấp đúp ảnh để xem, nhấp đúp văn bản hoặc nút tạo để chỉnh sửa.</p><div class="shortcut-grid"><kbd>Shift + nhấp</kbd><span>Chọn nhiều nút</span><kbd>⌘/Ctrl + D</kbd><span>Nhân bản</span><kbd>Delete</kbd><span>Xóa nút</span><kbd>F</kbd><span>Vừa khung</span><kbd>⌘/Ctrl + cuộn</kbd><span>Phóng to / thu nhỏ</span><kbd>V / H</kbd><span>Chọn / di chuyển canvas</span></div><p>Yêu cầu tạo ảnh/video sẽ vào hàng đợi. Bạn có thể gắn file kết quả thủ công hoặc tích hợp dịch vụ AI bằng adapter được mô tả trong README.</p><div class="modal-actions"><button data-close>Đóng</button></div>`,
  );
}

async function main() {
  try {
    db = await openDb();
    const saved = await getKv("state");
    state = saved || demoState();
    current();
    await loadMedia();
    bind();
    setComposerCollapsed(true);
    render();
    if (!saved && project.nodes.length) {
      fit();
      if (innerWidth < 620) {
        const target = project.nodes.find((n) => n.type === "image");
        if (target) {
          project.view = {
            scale: 0.82,
            x: 28 - target.x * 0.82,
            y: 110 - target.y * 0.82,
          };
          applyView();
          save();
        }
      }
    }
    if (!saved) save();
  } catch (error) {
    document.body.innerHTML = `<main style="padding:40px;color:white;font-family:sans-serif"><h1>Không mở được Canvas Studio</h1><p>${esc(error.message)}</p><p>Hãy dùng trình duyệt mới hỗ trợ IndexedDB.</p></main>`;
  }
}
main();
