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
  stringColor: "#4d5c70",
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
  state.design = { href, w, h };
  $("drop-label").innerHTML = `Loaded: <strong>${name.replace(/</g, "&lt;")}</strong><br/>click to replace`;
  exportBtn.disabled = false;
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
    <ellipse cx="0" cy="0" rx="${a + 10}" ry="${b + 10}" fill="#0b0e13" stroke="#3d4b5e" stroke-width="9"/>
    <ellipse cx="0" cy="0" rx="${a}" ry="${b}" fill="#141a22"/>
    ${strokeLines(state.stringColor, state.gauge)}
    ${designLayers}
  `;
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

render();
