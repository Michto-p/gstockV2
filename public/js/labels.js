import JsBarcode from "https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/+esm";
import { AppEvents, itemsCache, escapeHtml, safeTrim, toInt } from "./core.js";
const labelsSearch=document.getElementById("labelsSearch");
const labelsHint=document.getElementById("labelsHint");
const labelsList=document.getElementById("labelsList");
const labelsPreviewBorder=document.getElementById("labelsPreviewBorder");
const labelsPreviewFrame=document.getElementById("labelsPreviewFrame");
const labelsSelCount=document.getElementById("labelsSelCount");
const labelsTotalCount=document.getElementById("labelsTotalCount");
const btnLabelsSelectAll=document.getElementById("btnLabelsSelectAll");
const btnLabelsClear=document.getElementById("btnLabelsClear");
const btnLabelsPrint=document.getElementById("btnLabelsPrint");
const btnLabelsPreview=document.getElementById("btnLabelsPreview");

const KEY="gstock_label_settings_v3";
const selected=new Set(); const qtyById=new Map();
const defaults={marginMm:10,cols:3,wMm:63.5,hMm:38.1,gapXmm:2.5,gapYmm:0,padMm:2.5,nameLines:2,namePt:10.5,codePt:9,barHmm:16,barWidthPx:2,showLocation:true,showBorder:false};
function read(){ try{ return {...defaults, ...(JSON.parse(localStorage.getItem(KEY)||"{}"))}; }catch{ return {...defaults}; } }

function makeBarcodeSvg(value,opt){
  const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
  const isEan13=/^\d{13}$/.test(value);
  JsBarcode(svg,value,{format:isEan13?"EAN13":"CODE128",displayValue:false,margin:0,width:opt?.barWidthPx??2,height:opt?.barPxHeight??48});
  return svg.outerHTML;
}
function getPlan(){
  const out=[]; let total=0;
  for(const id of selected){
    const it=(itemsCache||[]).find(x=>x.id===id); if(!it) continue;
    const n=Math.max(1,toInt(qtyById.get(id)??1,1));
    for(let i=0;i<n;i++){ out.push(it); total++; }
  }
  return {items:out,total,selectedCount:selected.size};
}
function buildHtml(items, patched){
  const s={...read(),...(patched||{})};
  const pxPerMm=3.78; const barPxHeight=Math.max(18,Math.round(s.barHmm*pxPerMm));
  const border=s.showBorder?"1px solid #000":"0";
  const css=`<style>@page{size:A4;margin:${s.marginMm}mm}body{margin:0;font-family:Arial,sans-serif}
  .grid{display:grid;grid-template-columns:repeat(${s.cols},${s.wMm}mm);grid-auto-rows:${s.hMm}mm;column-gap:${s.gapXmm}mm;row-gap:${s.gapYmm}mm;align-content:start}
  .label{border:${border};padding:${s.padMm}mm;box-sizing:border-box;overflow:hidden;display:grid;grid-template-rows:auto 1fr auto;gap:1.2mm}
  .name{font-weight:900;font-size:${s.namePt}pt;text-align:center;line-height:1.05;display:-webkit-box;-webkit-line-clamp:${Math.max(1,s.nameLines)};-webkit-box-orient:vertical;overflow:hidden}
  .barcode{display:flex;justify-content:center;align-items:center}
  .code{font-size:${s.codePt}pt;text-align:center;font-weight:800;letter-spacing:.4px}
  .meta{font-size:${Math.max(7,s.codePt-1)}pt;text-align:center;color:#111}
  .noPrint{margin:10px;display:flex;gap:10px;flex-wrap:wrap}@media print{.noPrint{display:none}}</style>`;
  const labels=items.map(it=>{
    const code=it.barcode||it.id; const meta=(s.showLocation && it.location)?`📍 ${it.location}`:"";
    return `<div class="label"><div class="name">${escapeHtml(it.name||"(sans nom)")}</div><div class="barcode">${makeBarcodeSvg(code,{barWidthPx:s.barWidthPx,barPxHeight})}</div><div><div class="code">${escapeHtml(code)}</div><div class="meta">${escapeHtml(meta)}</div></div></div>`;
  }).join("");
  return `<!doctype html><html><head><meta charset="utf-8"/>${css}</head><body><div class="noPrint"><button onclick="window.print()">Imprimer</button><button onclick="window.close()">Fermer</button></div><div class="grid">${labels}</div></body></html>`;
}
function renderPreview(){
  const p=getPlan(); labelsSelCount.textContent=String(p.selectedCount); labelsTotalCount.textContent=String(p.total);
  const s=read(); const patched={...s, showBorder:(labelsPreviewBorder.checked?true:s.showBorder)};
  labelsPreviewFrame.srcdoc=buildHtml(p.items, patched);
}
function renderList(){
  const q=safeTrim(labelsSearch.value).toLowerCase();
  const list=(itemsCache||[]).filter(it=>{ const code=(it.barcode||it.id||"").toLowerCase(); const nm=(it.name||"").toLowerCase(); return !q||code.includes(q)||nm.includes(q); });
  labelsHint.textContent=`${list.length} article(s)`; labelsList.innerHTML="";
  for(const it of list){
    const id=it.id; const code=it.barcode||it.id; const checked=selected.has(id); const qty=Math.max(1,toInt(qtyById.get(id)??1,1));
    const row=document.createElement("div"); row.className="lblRow";
    row.innerHTML=`<div class="lblRowTop"><div class="lblRowName">${escapeHtml(it.name||"(sans nom)")}</div>
      <label class="checkRow" style="margin:0"><input type="checkbox" ${checked?"checked":""}><span style="font-size:12px;color:#666;font-weight:800">Imprimer</span></label></div>
      <div class="lblRowCode">${escapeHtml(code)}</div><div class="lblRowMeta">${escapeHtml(it.location||"")}</div>
      <div class="lblRowControls"><div style="min-width:220px;flex:1">${makeBarcodeSvg(code,{barWidthPx:2,barPxHeight:36})}</div>
      <div class="lblQtyInput"><label style="margin-top:0">Nb étiquettes</label><input type="number" min="1" step="1" value="${qty}"></div></div>`;
    const cb=row.querySelector('input[type="checkbox"]');
    cb.addEventListener("change",(e)=>{ e.target.checked?(selected.add(id),qtyById.has(id)||qtyById.set(id,1)):selected.delete(id); renderPreview(); });
    const qin=row.querySelector('input[type="number"]');
    qin.addEventListener("change",(e)=>{ const v=Math.max(1,toInt(e.target.value,1)); e.target.value=String(v); qtyById.set(id,v); renderPreview(); });
    labelsList.appendChild(row);
  }
  renderPreview();
}
btnLabelsSelectAll.addEventListener("click",()=>{ (itemsCache||[]).forEach(it=>{ selected.add(it.id); qtyById.has(it.id)||qtyById.set(it.id,1); }); renderList(); });
btnLabelsClear.addEventListener("click",()=>{ selected.clear(); renderList(); });
btnLabelsPrint.addEventListener("click",()=>{ const p=getPlan(); if(!p.items.length) return alert("Sélectionne au moins 1 article."); const s=read(); const patched={...s, showBorder:(labelsPreviewBorder.checked?true:s.showBorder)};
  const w=window.open("","_blank"); if(!w) return alert("Pop-up bloquée."); w.document.open(); w.document.write(buildHtml(p.items, patched)); w.document.close();
});
btnLabelsPreview.addEventListener("click",renderPreview);
labelsPreviewBorder.addEventListener("change",renderPreview);
labelsSearch.addEventListener("input",renderList);

window.__GstockLabelsSetSelection=(ids)=>{ selected.clear(); (ids||[]).forEach(id=>selected.add(id)); renderList(); };
window.__GstockPrintLabels=(ids)=>{ const items=(ids||[]).map(id=>(itemsCache||[]).find(x=>x.id===id)).filter(Boolean);
  const w=window.open("","_blank"); if(!w) return alert("Pop-up bloquée."); w.document.open(); w.document.write(buildHtml(items, read())); w.document.close();
};
window.__GstockRefreshLabels=renderList;

AppEvents.addEventListener("auth:signedIn",renderList);
AppEvents.addEventListener("auth:signedOut",()=>{ selected.clear(); qtyById.clear(); labelsList.innerHTML=""; renderPreview(); });
