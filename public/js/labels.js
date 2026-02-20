
// labels.js — impression étiquettes (simple)
import { itemsCache } from "./core.js";

function getItem(id){
  return itemsCache.find(i=>(i.barcode||i.id)===id);
}

function htmlFor(ids){
  const blocks = ids.map(id=>{
    const it = getItem(id) || {name:"", barcode:id};
    const name = (it.name||"").toString();
    const code = (it.barcode||it.id||id).toString();
    return `<div class="lbl">
      <div class="lblName">${escapeHtml(name)}</div>
      <div class="lblCode">${escapeHtml(code)}</div>
    </div>`;
  }).join("");
  return `<!doctype html><html><head><meta charset="utf-8">
    <title>Étiquettes</title>
    <style>
      @page{ margin:8mm; }
      body{ font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
      .grid{ display:grid; grid-template-columns: repeat(3, 1fr); gap:6mm; }
      .lbl{ border:1px solid #000; padding:4mm; border-radius:3mm; height:22mm; display:flex; flex-direction:column; justify-content:center; }
      .lblName{ font-size:11pt; font-weight:700; line-height:1.1; }
      .lblCode{ margin-top:2mm; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size:10pt; }
    </style>
  </head><body>
    <div class="grid">${blocks}</div>
    <script>window.print();<\/script>
  </body></html>`;
}

// petite copie de escapeHtml pour la fenêtre d'impression
function escapeHtml(s){ return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }

window.__GstockPrintLabels = (ids)=>{
  if(!ids?.length) return;
  const w = window.open("", "_blank");
  if(!w) return alert("Popup bloquée : autorise l'ouverture de fenêtres.");
  w.document.open();
  w.document.write(htmlFor(ids));
  w.document.close();
};
