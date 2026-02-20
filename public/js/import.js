
// import.js — import CSV d'articles
import { AppEvents, itemsCache, suppliersCache, itemDocRef, $, setStatus, safeTrim, toInt, isAdmin, canManageItems, auth } from "./core.js";
import { setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const els = {
  btnTpl: $("btnDownloadCsvTemplate"),
  file: $("csvFile"),
  chkMerge: $("chkImportMerge"),
  btnImport: $("btnImportCsv"),
  status: $("importStatus"),
};

function canEdit(){ return isAdmin() || canManageItems(); }

function downloadTemplate(){
  const header = ["barcode","name","qty","unit","location","low","critical","suppliers","tags"].join(";");
  const example = ["1234567890123","Lampe LED E27","10","pcs","Armoire A","5","2","Fournisseur X","eclairage,led"].join(";");
  const csv = header + "\n" + example + "\n";
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download="gstock_import_template.csv";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),500);
}

function parseCsv(text){
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(l=>l && !l.startsWith("#"));
  if(!lines.length) return [];
  const head = lines[0].split(";").map(s=>safeTrim(s).toLowerCase());
  const idx = (k)=>head.indexOf(k);
  const out=[];
  for(const line of lines.slice(1)){
    const cols = line.split(";");
    const get = (k)=> cols[idx(k)] ?? "";
    const barcode = safeTrim(get("barcode"));
    const name = safeTrim(get("name"));
    if(!barcode || !name) continue;
    out.push({
      barcode,
      name,
      qty: toInt(get("qty"), 0),
      unit: safeTrim(get("unit")),
      location: safeTrim(get("location")),
      thresholds: { low: toInt(get("low"),5), critical: toInt(get("critical"),2) },
      suppliersRaw: safeTrim(get("suppliers")),
      tags: safeTrim(get("tags")).split(/[;,]/g).map(s=>safeTrim(s)).filter(Boolean),
    });
  }
  return out;
}

function mapSuppliers(raw){
  if(!raw) return [];
  const parts = raw.split(/[;,]/g).map(s=>safeTrim(s)).filter(Boolean);
  if(!parts.length) return [];
  // accepte ID ou nom
  const byId = new Map(suppliersCache.map(s=>[s.id, s.id]));
  const byName = new Map(suppliersCache.map(s=>[(s.name||"").toLowerCase(), s.id]));
  const ids=[];
  for(const p of parts){
    if(byId.has(p)) ids.push(p);
    else{
      const id = byName.get(p.toLowerCase());
      if(id) ids.push(id);
    }
  }
  return Array.from(new Set(ids));
}

async function importCsv(file){
  if(!canEdit()) return setStatus(els.status,"Droits insuffisants.",true);
  const merge = !!els.chkMerge?.checked;
  const text = await file.text();
  const rows = parseCsv(text);
  if(!rows.length) return setStatus(els.status,"Aucune ligne valide.",true);

  setStatus(els.status, `Import… (${rows.length})`);
  let ok=0, ko=0;
  for(const r of rows){
    try{
      const existing = itemsCache.find(i=>(i.barcode||i.id)===r.barcode);
      const base = (!existing) ? {createdAt: serverTimestamp(), createdBy: auth.currentUser?.uid||null, qty: r.qty||0} : {};
      const payload = {
        barcode: r.barcode,
        name: r.name,
        unit: r.unit,
        location: r.location,
        thresholds: { low: Math.max(0,r.thresholds.low), critical: Math.max(0,r.thresholds.critical) },
        suppliers: mapSuppliers(r.suppliersRaw),
        tags: r.tags.slice(0,20),
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid||null,
        ...base,
      };
      await setDoc(itemDocRef(r.barcode), payload, {merge: merge});
      ok++;
    }catch(e){
      ko++;
    }
  }
  setStatus(els.status, `Terminé ✅ (${ok} ok, ${ko} erreurs)`);
  await window.__GstockReloadItems?.();
}

function bind(){
  els.btnTpl?.addEventListener("click", downloadTemplate);
  els.btnImport?.addEventListener("click", async ()=>{
    const f = els.file?.files?.[0];
    if(!f) return setStatus(els.status,"Choisis un fichier CSV.",true);
    await importCsv(f);
  });
}

AppEvents.addEventListener("auth:signedIn", ()=>{
  bind();
});
