import JsBarcode from "https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/+esm";
import {
  $,
  itemsCache,
  setStatus,
  safeTrim,
  toInt,
  escapeHtml,
  startItemsListener,
  tabBtnLabels
} from "./core.js";

const labelsSearch = $("labelsSearch");
const btnLabelsSelectAll = $("btnLabelsSelectAll");
const btnLabelsClear = $("btnLabelsClear");
const btnLabelsPrint = $("btnLabelsPrint");
const btnLabelsPreview = $("btnLabelsPreview");
const labelsHint = $("labelsHint");
const labelsList = $("labelsList");
const labelsSelCount = $("labelsSelCount");
const labelsTotalCount = $("labelsTotalCount");
const labelsPreviewBorder = $("labelsPreviewBorder");
const labelsPreviewFrame = $("labelsPreviewFrame");

const labelPreset = $("labelPreset");
const btnSaveLabelSettings = $("btnSaveLabelSettings");
const btnResetLabelSettings = $("btnResetLabelSettings");
const labelStatus = $("labelStatus");

const lblMarginMm = $("lblMarginMm");
const lblCols = $("lblCols");
const lblWmm = $("lblWmm");
const lblHmm = $("lblHmm");
const lblGapXmm = $("lblGapXmm");
const lblGapYmm = $("lblGapYmm");
const lblNamePt = $("lblNamePt");
const lblCodePt = $("lblCodePt");
const lblBarHmm = $("lblBarHmm");
const lblBarWidthPx = $("lblBarWidthPx");
const lblShowLocation = $("lblShowLocation");
const lblShowBorder = $("lblShowBorder");
const lblPadMm = $("lblPadMm");
const lblNameLines = $("lblNameLines");

// selection + qty map
const selectedForLabels = new Set();
const labelQtyById = new Map(); // id -> qty labels

// ---------- SETTINGS ----------
const KEY = "gstock_label_settings_v2";
const PRESETS = {
  custom: null,
  averyL7160: { marginMm: 10, cols: 3, wMm: 63.5, hMm: 38.1, gapXmm: 2.5, gapYmm: 0, namePt: 10.5, codePt: 9, barHmm: 16, barWidthPx: 2, padMm: 2.5, nameLines: 2 },
  averyL7163: { marginMm: 10, cols: 2, wMm: 99.1, hMm: 38.1, gapXmm: 2.5, gapYmm: 0, namePt: 11, codePt: 9.5, barHmm: 16, barWidthPx: 2, padMm: 2.5, nameLines: 2 },
  averyL7651: { marginMm: 8, cols: 3, wMm: 63.5, hMm: 33.9, gapXmm: 2.5, gapYmm: 0, namePt: 10, codePt: 9, barHmm: 14, barWidthPx: 2, padMm: 2.2, nameLines: 2 },
  generic3x8: { marginMm: 8, cols: 3, wMm: 70, hMm: 35, gapXmm: 2, gapYmm: 2, namePt: 10.5, codePt: 9, barHmm: 15, barWidthPx: 2, padMm: 2.5, nameLines: 2 }
};

function defaults(){
  return {
    preset: "averyL7160",
    marginMm: 10, cols: 3, wMm: 63.5, hMm: 38.1,
    gapXmm: 2.5, gapYmm: 0,
    namePt: 10.5, codePt: 9,
    barHmm: 16, barWidthPx: 2,
    showLocation: true,
    showBorder: false,
    padMm: 2.5,
    nameLines: 2
  };
}
function read(){
  try{
    const raw = localStorage.getItem(KEY);
    if(!raw) return defaults();
    return { ...defaults(), ...JSON.parse(raw) };
  }catch{ return defaults(); }
}
function write(s){ localStorage.setItem(KEY, JSON.stringify(s)); }
function uiToSettings(){
  return {
    preset: labelPreset.value || "custom",
    marginMm: Number(lblMarginMm.value) || 0,
    cols: Math.max(1, toInt(lblCols.value, 3)),
    wMm: Number(lblWmm.value) || 63.5,
    hMm: Number(lblHmm.value) || 38.1,
    gapXmm: Number(lblGapXmm.value) || 0,
    gapYmm: Number(lblGapYmm.value) || 0,
    namePt: Number(lblNamePt.value) || 10,
    codePt: Number(lblCodePt.value) || 9,
    barHmm: Number(lblBarHmm.value) || 16,
    barWidthPx: Math.max(1, toInt(lblBarWidthPx.value, 2)),
    showLocation: !!lblShowLocation.checked,
    showBorder: !!lblShowBorder.checked,
    padMm: Number(lblPadMm.value) || 2.5,
    nameLines: Math.max(1, toInt(lblNameLines.value, 2)),
  };
}
function applyToUI(s){
  labelPreset.value = s.preset || "custom";
  lblMarginMm.value = String(s.marginMm);
  lblCols.value = String(s.cols);
  lblWmm.value = String(s.wMm);
  lblHmm.value = String(s.hMm);
  lblGapXmm.value = String(s.gapXmm);
  lblGapYmm.value = String(s.gapYmm);
  lblNamePt.value = String(s.namePt);
  lblCodePt.value = String(s.codePt);
  lblBarHmm.value = String(s.barHmm);
  lblBarWidthPx.value = String(s.barWidthPx);
  lblShowLocation.checked = !!s.showLocation;
  lblShowBorder.checked = !!s.showBorder;
  lblPadMm.value = String(s.padMm);
  lblNameLines.value = String(s.nameLines);
}
function applyPreset(key){
  const p = PRESETS[key];
  if(!p) return;
  const next = { ...read(), preset:key, ...p };
  applyToUI(next);
  write(next);
  setStatus(labelStatus, "Preset appliqué.");
}

// ---------- BARCODE SVG ----------
function makeBarcodeSvg(value, opt){
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const isEan13 = /^\d{13}$/.test(value);
  JsBarcode(svg, value, {
    format: isEan13 ? "EAN13" : "CODE128",
    displayValue: false,
    margin: 0,
    width: opt?.barWidthPx ?? 2,
    height: opt?.barPxHeight ?? 48
  });
  return svg.outerHTML;
}

// ---------- PLAN ITEMS ----------
function getPlan(){
  const ids = Array.from(selectedForLabels);
  const out = [];
  let total = 0;
  for(const id of ids){
    const it = itemsCache.find(x=>x.id===id);
    if(!it) continue;
    const n = Math.max(1, toInt(labelQtyById.get(id) ?? 1, 1));
    for(let i=0;i<n;i++){ out.push(it); total++; }
  }
  return { items: out, total, selectedCount: ids.length };
}
function updateCounters(){
  const p = getPlan();
  labelsSelCount.textContent = String(p.selectedCount);
  labelsTotalCount.textContent = String(p.total);
}

// ---------- RENDER LEFT LIST ----------
function renderList(){
  const q = safeTrim(labelsSearch.value).toLowerCase();
  const list = itemsCache.filter(it=>{
    const code = (it.barcode || it.id || "").toLowerCase();
    const nm = (it.name || "").toLowerCase();
    return !q || code.includes(q) || nm.includes(q);
  });

  labelsHint.textContent = `${list.length} article(s)`;
  labelsList.innerHTML = "";

  for(const it of list){
    const id = it.id;
    const code = it.barcode || it.id;
    const checked = selectedForLabels.has(id);
    const qty = Math.max(1, toInt(labelQtyById.get(id) ?? 1, 1));

    const row = document.createElement("div");
    row.className = "lblRow";
    row.innerHTML = `
      <div class="lblRowTop">
        <div class="lblRowName">${escapeHtml(it.name || "(sans nom)")}</div>
        <label class="checkRow" style="margin:0">
          <input type="checkbox" ${checked ? "checked":""}>
          <span style="font-size:12px;color:#666;font-weight:800">Imprimer</span>
        </label>
      </div>
      <div class="lblRowCode">${escapeHtml(code)}</div>
      <div class="lblRowMeta">${escapeHtml(it.location || "")}</div>
      <div class="lblRowControls">
        <div style="min-width:220px;flex:1">
          ${makeBarcodeSvg(code, { barWidthPx: 2, barPxHeight: 36 })}
        </div>
        <div class="lblQtyInput">
          <label style="margin-top:0">Nb étiquettes</label>
          <input type="number" min="1" step="1" value="${qty}">
        </div>
      </div>
    `;

    const cb = row.querySelector('input[type="checkbox"]');
    cb.addEventListener("change", (ev)=>{
      if(ev.target.checked){
        selectedForLabels.add(id);
        if(!labelQtyById.has(id)) labelQtyById.set(id, 1);
      }else{
        selectedForLabels.delete(id);
      }
      updateCounters();
      renderPreview();
    });

    const qtyInput = row.querySelector('input[type="number"]');
    qtyInput.addEventListener("change", (ev)=>{
      const v = Math.max(1, toInt(ev.target.value, 1));
      ev.target.value = String(v);
      labelQtyById.set(id, v);
      updateCounters();
      renderPreview();
    });

    labelsList.appendChild(row);
  }

  updateCounters();
}

// ---------- LABEL HTML (centered) ----------
function buildLabelsHtml(items, override){
  const s0 = read();
  const s = { ...s0, ...(override||{}) };

  const pxPerMm = 3.78;
  const barPxHeight = Math.max(18, Math.round(s.barHmm * pxPerMm));
  const borderCss = s.showBorder ? "1px solid #000" : "0";
  const pad = `${s.padMm}mm`;
  const maxLines = Math.max(1, s.nameLines);

  const css = `
    <style>
      @page { size: A4; margin: ${s.marginMm}mm; }
      body { margin:0; font-family: Arial, sans-serif; }
      .grid{
        display:grid;
        grid-template-columns: repeat(${s.cols}, ${s.wMm}mm);
        grid-auto-rows: ${s.hMm}mm;
        column-gap:${s.gapXmm}mm;
        row-gap:${s.gapYmm}mm;
        align-content:start;
      }
      .label{
        border:${borderCss};
        padding:${pad};
        box-sizing:border-box;
        overflow:hidden;
        display:grid;
        grid-template-rows: auto 1fr auto;
        gap: 1.2mm;
      }
      .name{
        font-weight:900;
        font-size:${s.namePt}pt;
        text-align:center;
        line-height:1.05;
        display:-webkit-box;
        -webkit-line-clamp:${maxLines};
        -webkit-box-orient:vertical;
        overflow:hidden;
      }
      .barcode{ display:flex; justify-content:center; align-items:center; }
      .code{
        font-size:${s.codePt}pt;
        text-align:center;
        font-weight:800;
        letter-spacing:.4px;
      }
      .meta{ font-size:${Math.max(7, s.codePt-1)}pt; text-align:center; color:#111; }
      .noPrint{ margin:10px; display:flex; gap:10px; flex-wrap:wrap; }
      @media print{ .noPrint{ display:none; } }
    </style>
  `;

  const labels = items.map(it=>{
    const code = it.barcode || it.id;
    const nm = it.name || "(sans nom)";
    const meta = s.showLocation && it.location ? `📍 ${it.location}` : "";
    return `
      <div class="label">
        <div class="name">${escapeHtml(nm)}</div>
        <div class="barcode">${makeBarcodeSvg(code, { barWidthPx: s.barWidthPx, barPxHeight })}</div>
        <div>
          <div class="code">${escapeHtml(code)}</div>
          <div class="meta">${escapeHtml(meta)}</div>
        </div>
      </div>
    `;
  }).join("");

  return `<!doctype html><html><head><meta charset="utf-8"/>${css}</head>
  <body>
    <div class="noPrint">
      <button onclick="window.print()">Imprimer</button>
      <button onclick="window.close()">Fermer</button>
    </div>
    <div class="grid">${labels}</div>
  </body></html>`;
}

function openPrint(html){
  const w = window.open("", "_blank");
  if(!w) return alert("Pop-up bloquée. Autorise les pop-ups.");
  w.document.open(); w.document.write(html); w.document.close();
}

// ---------- PREVIEW (iframe) ----------
function renderPreview(){
  if(!labelsPreviewFrame) return;
  const plan = getPlan();
  const s = read();
  const patched = { ...s, showBorder: labelsPreviewBorder.checked ? true : s.showBorder };

  const html = buildLabelsHtml(plan.items, patched);
  labelsPreviewFrame.srcdoc = html;
}

// ---------- UI wiring ----------
labelsSearch?.addEventListener("input", ()=>{ renderList(); renderPreview(); });

btnLabelsSelectAll?.addEventListener("click", ()=>{
  itemsCache.forEach(it=>{
    selectedForLabels.add(it.id);
    if(!labelQtyById.has(it.id)) labelQtyById.set(it.id, 1);
  });
  renderList(); renderPreview();
});
btnLabelsClear?.addEventListener("click", ()=>{
  selectedForLabels.clear();
  renderList(); renderPreview();
});
btnLabelsPrint?.addEventListener("click", ()=>{
  const plan = getPlan();
  if(!plan.items.length) return alert("Sélectionne au moins 1 article.");
  const s = read();
  const patched = { ...s, showBorder: labelsPreviewBorder.checked ? true : s.showBorder };
  openPrint(buildLabelsHtml(plan.items, patched));
});
btnLabelsPreview?.addEventListener("click", renderPreview);
labelsPreviewBorder?.addEventListener("change", renderPreview);

// Settings
(function initSettings(){
  const s = read();
  applyToUI(s);

  labelPreset?.addEventListener("change", ()=>{
    const key = labelPreset.value;
    if(key === "custom"){
      const cur = uiToSettings();
      write(cur);
      setStatus(labelStatus, "Mode personnalisé.");
      renderPreview();
      return;
    }
    applyPreset(key);
    renderPreview();
  });

  btnSaveLabelSettings?.addEventListener("click", ()=>{
    const cur = uiToSettings();
    write(cur);
    setStatus(labelStatus, "Réglages enregistrés ✅");
    renderPreview();
  });

  btnResetLabelSettings?.addEventListener("click", ()=>{
    const def = defaults();
    applyToUI(def);
    write(def);
    setStatus(labelStatus, "Réglages réinitialisés.");
    renderPreview();
  });

  // any input change => live preview
  [
    lblMarginMm,lblCols,lblWmm,lblHmm,lblGapXmm,lblGapYmm,lblNamePt,lblCodePt,lblBarHmm,lblBarWidthPx,lblShowLocation,lblShowBorder,lblPadMm,lblNameLines
  ].forEach(el=>{
    el?.addEventListener("input", ()=>{
      const cur = uiToSettings();
      write(cur);
      renderPreview();
    });
  });
})();

// When tab labels clicked => refresh
tabBtnLabels?.addEventListener("click", ()=>{
  renderList();
  renderPreview();
});

// Hook items cache updates
startItemsListener(()=>{
  renderList();
  renderPreview();
});
