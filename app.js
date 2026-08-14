// Tennis String Stencil Maker
// All geometry is in millimetres. The preview SVG viewBox is in mm, so the
// exported stencil (width/height given in mm) prints at true size.

const SVG_NS = "http://www.w3.org/2000/svg";

// ---------- racket geometry ----------

// Head size (sq in) -> inner ellipse half-axes in mm.
// Typical head aspect ratio (height / width) is ~1.28.
function headEllipse(sqIn) {
  const areaMm2 = sqIn * 645.16;
  const ratio = 1.28;
  const a = Math.sqrt(areaMm2 / (Math.PI * ratio)); // half-width
  const b = a * ratio;                              // half-height
  return { a, b };
}

// Chord of ellipse at position t along one axis.
function chord(half, otherHalf, pos) {
  const f = 1 - (pos * pos) / (half * half);
  return f > 0 ? otherHalf * Math.sqrt(f) : 0;
}

// String line segments for a mains x crosses pattern, clipped to the ellipse.
function stringLines(sqIn, mains, crosses) {
  const { a, b } = headEllipse(sqIn);
  const lines = [];
  const spanX = a * 0.92, spanY = b * 0.94;
  for (let i = 0; i < mains; i++) {
    const x = -spanX + (2 * spanX * i) / (mains - 1);
    const h = chord(a, b, x) * 0.985;
    if (h > 1) lines.push({ x1: x, y1: -h, x2: x, y2: h });
  }
  for (let j = 0; j < crosses; j++) {
    const y = -spanY + (2 * spanY * j) / (crosses - 1);
    const w = chord(b, a, y) * 0.985;
    if (w > 1) lines.push({ x1: -w, y1: y, x2: w, y2: y });
  }
  return { lines, a, b };
}

// ---------- state ----------

const state = {
  design: null, // { href, w, h }  href = data URL, w/h intrinsic px
  scale: 0.6,
  dx: 0,
  dy: 0,
  rot: 0,
  headSize: 100,
  mains: 16,
  crosses: 19,
  gauge: 1.3,
  stringColor: "#ece2d0",
  showGhost: true,
  mono: false,
  stencilColor: "#e8002d",
};

// ---------- element refs ----------

const $ = (id) => document.getElementById(id);
const preview = $("preview");
const exportBtn = $("export-btn");

// ---------- design loading ----------

function loadFile(file) {
  if (!file) return;
  if (file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg")) {
    file.text().then((text) => {
      const href = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(text)));
      // Get intrinsic size from the SVG's width/height or viewBox.
      const doc = new DOMParser().parseFromString(text, "image/svg+xml");
      const root = doc.documentElement;
      let w = parseFloat(root.getAttribute("width")) || 0;
      let h = parseFloat(root.getAttribute("height")) || 0;
      const vb = (root.getAttribute("viewBox") || "").split(/[\s,]+/).map(Number);
      if ((!w || !h) && vb.length === 4) { w = vb[2]; h = vb[3]; }
      if (!w || !h) { w = 300; h = 300; }
      setDesign(href, w, h, file.name);
    });
  } else if (file.type.startsWith("image/")) {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => setDesign(reader.result, img.naturalWidth, img.naturalHeight, file.name);
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }
}

function setDesign(href, w, h, name) {
  state.design = { href, w, h, name };
  $("drop-label").innerHTML = `Loaded: <strong>${name.replace(/</g, "&lt;")}</strong><br/>click to replace`;
  exportBtn.disabled = false;
  $("laser-btn").disabled = false;
  $("save-snapshot").disabled = false;
  render();
}

// ---------- design transform ----------

// The design is fitted so its larger dimension maps to (head width * scale),
// centred at (dx, dy), rotated by rot degrees.
function designPlacement() {
  const { a } = headEllipse(state.headSize);
  const d = state.design;
  const fit = (2 * a * state.scale) / Math.max(d.w, d.h);
  const w = d.w * fit, h = d.h * fit;
  return {
    w, h,
    transform: `translate(${state.dx} ${state.dy}) rotate(${state.rot})`,
    x: -w / 2, y: -h / 2,
  };
}

function designImageMarkup(p, opacity = 1) {
  return `<image href="${state.design.href}" x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}"` +
         ` preserveAspectRatio="xMidYMid meet" opacity="${opacity}"/>`;
}

// ---------- preview rendering ----------

function render() {
  const { lines, a, b } = stringLines(state.headSize, state.mains, state.crosses);
  const pad = 20;
  const vb = `${-a - pad} ${-b - pad} ${2 * (a + pad)} ${2 * (b + pad)}`;
  preview.setAttribute("viewBox", vb);

  const strokeLines = (color, width, extra = "") =>
    lines.map((l) => `<line x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}"` +
      ` stroke="${color}" stroke-width="${width}" stroke-linecap="round" ${extra}/>`).join("");

  let designLayers = "";
  if (state.design) {
    const p = designPlacement();
    designLayers = `
      <defs>
        <mask id="strings-mask" maskUnits="userSpaceOnUse" x="${-a - pad}" y="${-b - pad}" width="${2 * (a + pad)}" height="${2 * (b + pad)}">
          <rect x="${-a - pad}" y="${-b - pad}" width="${2 * (a + pad)}" height="${2 * (b + pad)}" fill="black"/>
          ${strokeLines("white", state.gauge)}
        </mask>
        <mask id="design-alpha" maskUnits="userSpaceOnUse" x="${-a - pad}" y="${-b - pad}" width="${2 * (a + pad)}" height="${2 * (b + pad)}" style="mask-type:alpha">
          <g transform="${p.transform}">${designImageMarkup(p)}</g>
        </mask>
      </defs>
      ${state.showGhost ? `<g transform="${p.transform}" opacity="0.12">${designImageMarkup(p)}</g>` : ""}
      <g mask="url(#strings-mask)">${
        state.mono
          ? `<rect x="${-a - pad}" y="${-b - pad}" width="${2 * (a + pad)}" height="${2 * (b + pad)}" fill="${state.stencilColor}" style="mask:url(#design-alpha)"/>`
          : `<g transform="${p.transform}">${designImageMarkup(p)}</g>`
      }</g>`;
  }

  preview.innerHTML = `
    <ellipse cx="0" cy="0" rx="${a + 5}" ry="${b + 5}" fill="none" stroke="#1e2a4a" stroke-width="10"/>
    <ellipse cx="0" cy="0" rx="${a}" ry="${b}" fill="rgba(255,255,255,0.06)"/>
    ${strokeLines(state.stringColor, state.gauge)}
    ${designLayers}
  `;
  persist();
}

// ---------- export ----------

function exportSVG() {
  if (!state.design) return;
  const { lines, a, b } = stringLines(state.headSize, state.mains, state.crosses);
  const p = designPlacement();
  const pad = 15;
  const W = 2 * (a + pad), H = 2 * (b + pad);

  const cross = 8;
  const guides = `
    <ellipse cx="0" cy="0" rx="${a.toFixed(2)}" ry="${b.toFixed(2)}" fill="none" stroke="#888" stroke-width="0.4" stroke-dasharray="4 3"/>
    <path d="M ${-cross} 0 H ${cross} M 0 ${-cross} V ${cross}" stroke="#888" stroke-width="0.4"/>
    <path d="M 0 ${(-b).toFixed(2)} v ${cross} M 0 ${b.toFixed(2)} v ${-cross} M ${(-a).toFixed(2)} 0 h ${cross} M ${a.toFixed(2)} 0 h ${-cross}" stroke="#888" stroke-width="0.4"/>`;

  const stringGuides = lines.map((l) =>
    `<line x1="${l.x1.toFixed(2)}" y1="${l.y1.toFixed(2)}" x2="${l.x2.toFixed(2)}" y2="${l.y2.toFixed(2)}" stroke="#ccc" stroke-width="0.25"/>`).join("\n    ");

  const design = state.mono
    ? `<defs><mask id="design-alpha" maskUnits="userSpaceOnUse" x="${(-a - pad)}" y="${(-b - pad)}" width="${W}" height="${H}" style="mask-type:alpha"><g transform="${p.transform}">${designImageMarkup(p)}</g></mask></defs>
  <rect x="${(-a - pad).toFixed(2)}" y="${(-b - pad).toFixed(2)}" width="${W.toFixed(2)}" height="${H.toFixed(2)}" fill="${state.stencilColor}" style="mask:url(#design-alpha)"/>`
    : `<g transform="${p.transform}">${designImageMarkup(p)}</g>`;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(2)}mm" height="${H.toFixed(2)}mm" viewBox="${(-a - pad).toFixed(2)} ${(-b - pad).toFixed(2)} ${W.toFixed(2)} ${H.toFixed(2)}">
  <!-- Tennis string stencil — print at 100% scale. Units: mm. -->
  <!-- Head: ${state.headSize} sq in, pattern ${state.mains}x${state.crosses}. Dashed ellipse = inside of the head. Align centre cross-hairs with the middle of the string bed. -->
  <rect x="${(-a - pad).toFixed(2)}" y="${(-b - pad).toFixed(2)}" width="${W.toFixed(2)}" height="${H.toFixed(2)}" fill="white"/>
  ${guides}
  <g opacity="0.5">
    ${stringGuides}
  </g>
  ${design}
</svg>`;

  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "tennis-string-stencil.svg";
  link.click();
  URL.revokeObjectURL(url);
}

// ---------- laser cut export ----------

// Trace the design's silhouette into closed loops (pixel-edge polygons).
// Returns loops as arrays of [x, y] lattice points in grid coordinates.
function traceContours(mask, w, h) {
  // Directed boundary edges, filled cell on the left of travel direction.
  const at = (x, y) => (x >= 0 && y >= 0 && x < w && y < h) ? mask[y * w + x] : 0;
  const edges = new Map(); // "x,y" start vertex -> [endX, endY]
  const addEdge = (x1, y1, x2, y2) => edges.set(`${x1},${y1}`, [x2, y2]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!at(x, y)) continue;
      if (!at(x, y - 1)) addEdge(x, y, x + 1, y);         // top edge, rightward
      if (!at(x + 1, y)) addEdge(x + 1, y, x + 1, y + 1); // right edge, down
      if (!at(x, y + 1)) addEdge(x + 1, y + 1, x, y + 1); // bottom edge, left
      if (!at(x - 1, y)) addEdge(x, y + 1, x, y);         // left edge, up
    }
  }
  const loops = [];
  while (edges.size) {
    const [startKey, first] = edges.entries().next().value;
    const [sx, sy] = startKey.split(",").map(Number);
    const loop = [[sx, sy]];
    edges.delete(startKey);
    let [cx, cy] = first;
    while (cx !== sx || cy !== sy) {
      loop.push([cx, cy]);
      const key = `${cx},${cy}`;
      const next = edges.get(key);
      if (!next) break;
      edges.delete(key);
      [cx, cy] = next;
    }
    // merge collinear runs
    const out = [];
    for (const p of loop) {
      const n = out.length;
      if (n >= 2) {
        const [ax, ay] = out[n - 2], [bx, by] = out[n - 1];
        if ((bx - ax) * (p[1] - ay) - (by - ay) * (p[0] - ax) === 0) out.pop();
      }
      out.push(p);
    }
    if (out.length >= 3) loops.push(out);
  }
  return loops;
}

function exportLaserSVG() {
  if (!state.design) return;
  const img = new Image();
  img.onload = () => {
    const { a, b } = headEllipse(state.headSize);
    const p = designPlacement();

    // Rasterise the design and build a filled/empty mask.
    const res = 500;
    const gw = img.naturalWidth >= img.naturalHeight ? res : Math.round(res * img.naturalWidth / img.naturalHeight);
    const gh = img.naturalWidth >= img.naturalHeight ? Math.round(res * img.naturalHeight / img.naturalWidth) : res;
    const canvas = document.createElement("canvas");
    canvas.width = gw; canvas.height = gh;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, gw, gh);
    const data = ctx.getImageData(0, 0, gw, gh).data;
    let hasAlpha = false;
    for (let i = 3; i < data.length; i += 4) if (data[i] < 250) { hasAlpha = true; break; }
    const mask = new Uint8Array(gw * gh);
    for (let i = 0; i < gw * gh; i++) {
      const r = data[i * 4], g = data[i * 4 + 1], bl = data[i * 4 + 2], al = data[i * 4 + 3];
      // With transparency: any visible pixel is part of the shape.
      // Without: treat dark pixels as the shape (white paper drops out).
      mask[i] = hasAlpha ? (al > 127 ? 1 : 0) : ((0.2126 * r + 0.7152 * g + 0.0722 * bl) < 200 ? 1 : 0);
    }

    const loops = traceContours(mask, gw, gh);
    // grid px -> design-local mm -> placed mm
    const sx = p.w / gw, sy = p.h / gh;
    const rad = state.rot * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad);
    const place = ([gx, gy]) => {
      const lx = p.x + gx * sx, ly = p.y + gy * sy;
      return [state.dx + lx * cos - ly * sin, state.dy + lx * sin + ly * cos];
    };
    const paths = loops.map((loop) =>
      `<path d="M ${loop.map((pt) => place(pt).map((v) => v.toFixed(2)).join(" ")).join(" L ")} Z"/>`
    ).join("\n  ");

    const pad = 15;
    const W = 2 * (a + pad), H = 2 * (b + pad);
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(2)}mm" height="${H.toFixed(2)}mm" viewBox="${(-a - pad).toFixed(2)} ${(-b - pad).toFixed(2)} ${W.toFixed(2)} ${H.toFixed(2)}">
  <!-- Laser cut stencil — all paths are cut lines. Units: mm, cut at 100% scale. -->
  <!-- Outer oval = inside of a ${state.headSize} sq in head. -->
  <g fill="none" stroke="#ff0000" stroke-width="0.1">
  <ellipse cx="0" cy="0" rx="${a.toFixed(2)}" ry="${b.toFixed(2)}"/>
  ${paths}
  </g>
</svg>`;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "tennis-stencil-lasercut.svg";
    link.click();
    URL.revokeObjectURL(url);
  };
  img.src = state.design.href;
}

// ---------- persistence & history ----------

const STORE_KEY = "tsm:current";
const HISTORY_KEY = "tsm:history";
let saveTimer = null;

function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch { /* quota exceeded (huge design) — settings just won't persist */ }
  }, 300);
}

function applyState(saved) {
  Object.assign(state, saved);
  // sync controls
  $("scale").value = state.scale; $("scale-val").textContent = `${Math.round(state.scale * 100)}%`;
  $("dx").value = state.dx; $("dx-val").textContent = `${state.dx} mm`;
  $("dy").value = state.dy; $("dy-val").textContent = `${state.dy} mm`;
  $("rot").value = state.rot; $("rot-val").textContent = `${state.rot}°`;
  $("gauge").value = state.gauge; $("gauge-val").textContent = `${state.gauge.toFixed(2)} mm`;
  $("head-size").value = String(state.headSize);
  $("pattern").value = `${state.mains}x${state.crosses}`;
  $("string-color").value = state.stringColor;
  $("stencil-color").value = state.stencilColor;
  $("show-ghost").checked = state.showGhost;
  $("mono").checked = state.mono;
  if (state.design) {
    $("drop-label").innerHTML = `Loaded: <strong>${(state.design.name || "design").replace(/</g, "&lt;")}</strong><br/>click to replace`;
    exportBtn.disabled = false;
  $("laser-btn").disabled = false;
    $("save-snapshot").disabled = false;
  }
  render();
}

function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; }
}

function renderHistory() {
  const list = $("history-list");
  const entries = getHistory();
  list.innerHTML = entries.length ? "" : `<li class="hint" style="border:none;background:none">No snapshots yet</li>`;
  entries.forEach((entry, i) => {
    const li = document.createElement("li");
    const img = document.createElement("img");
    img.src = entry.state.design.href;
    img.alt = "";
    const load = document.createElement("button");
    load.className = "h-load";
    load.textContent = entry.label;
    load.title = "Load this snapshot";
    load.addEventListener("click", () => applyState(structuredClone(entry.state)));
    const del = document.createElement("button");
    del.className = "h-del";
    del.textContent = "✕";
    del.title = "Delete";
    del.addEventListener("click", () => {
      const h = getHistory(); h.splice(i, 1);
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); } catch {}
      renderHistory();
    });
    li.append(img, load, del);
    list.appendChild(li);
  });
}

function saveSnapshot() {
  if (!state.design) return;
  const entries = getHistory();
  const time = new Date().toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  entries.unshift({ label: `${state.design.name || "design"} — ${time}`, state: JSON.parse(JSON.stringify(state)) });
  while (entries.length) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, 12)));
      break;
    } catch {
      entries.pop(); // quota exceeded — drop oldest and retry
      if (!entries.length) return;
    }
  }
  renderHistory();
}

// ---------- wiring ----------

function bindSlider(id, key, fmt) {
  const el = $(id), val = $(id + "-val");
  const update = () => {
    state[key] = parseFloat(el.value);
    if (val) val.textContent = fmt(state[key]);
    render();
  };
  el.addEventListener("input", update);
  update();
}

bindSlider("scale", "scale", (v) => `${Math.round(v * 100)}%`);
bindSlider("dx", "dx", (v) => `${v} mm`);
bindSlider("dy", "dy", (v) => `${v} mm`);
bindSlider("rot", "rot", (v) => `${v}°`);
bindSlider("gauge", "gauge", (v) => `${v.toFixed(2)} mm`);

$("head-size").addEventListener("change", (e) => { state.headSize = parseFloat(e.target.value); render(); });
$("pattern").addEventListener("change", (e) => {
  const [m, c] = e.target.value.split("x").map(Number);
  state.mains = m; state.crosses = c; render();
});
$("show-ghost").addEventListener("change", (e) => { state.showGhost = e.target.checked; render(); });
$("mono").addEventListener("change", (e) => { state.mono = e.target.checked; render(); });
$("stencil-color").addEventListener("input", (e) => { state.stencilColor = e.target.value; render(); });
$("string-color").addEventListener("input", (e) => { state.stringColor = e.target.value; render(); });
$("export-btn").addEventListener("click", exportSVG);
$("laser-btn").addEventListener("click", exportLaserSVG);

// alignment buttons
function setOffsets(dx, dy) {
  if (dx !== null) { state.dx = dx; $("dx").value = dx; $("dx-val").textContent = `${dx} mm`; }
  if (dy !== null) { state.dy = dy; $("dy").value = dy; $("dy-val").textContent = `${dy} mm`; }
  render();
}
$("align-center").addEventListener("click", () => setOffsets(0, 0));
$("align-h").addEventListener("click", () => setOffsets(0, null));
$("align-v").addEventListener("click", () => setOffsets(null, 0));

// file input + drag & drop
const dropZone = $("drop-zone");
$("file-input").addEventListener("change", (e) => loadFile(e.target.files[0]));
["dragover", "dragenter"].forEach((ev) =>
  dropZone.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.add("dragover"); }));
["dragleave", "drop"].forEach((ev) =>
  dropZone.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.remove("dragover"); }));
dropZone.addEventListener("drop", (e) => loadFile(e.dataTransfer.files[0]));

// drag the design directly on the preview
let dragging = null;
preview.addEventListener("pointerdown", (e) => {
  if (!state.design) return;
  preview.setPointerCapture(e.pointerId);
  dragging = { x: e.clientX, y: e.clientY, dx: state.dx, dy: state.dy };
});
preview.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  const rect = preview.getBoundingClientRect();
  const vb = preview.viewBox.baseVal;
  const mmPerPx = vb.width / rect.width;
  state.dx = Math.round(dragging.dx + (e.clientX - dragging.x) * mmPerPx);
  state.dy = Math.round(dragging.dy + (e.clientY - dragging.y) * mmPerPx);
  $("dx").value = state.dx; $("dy").value = state.dy;
  $("dx-val").textContent = `${state.dx} mm`; $("dy-val").textContent = `${state.dy} mm`;
  render();
});
["pointerup", "pointercancel"].forEach((ev) =>
  preview.addEventListener(ev, () => { dragging = null; }));

$("save-snapshot").addEventListener("click", saveSnapshot);

// restore last session
try {
  const saved = JSON.parse(localStorage.getItem(STORE_KEY));
  if (saved && typeof saved === "object") applyState(saved);
} catch { /* corrupt storage — start fresh */ }

renderHistory();
render();
