
// items.js — édition article (fiche)
import { AppEvents, itemsCache, suppliersCache, itemDocRef, itemsColRef, $, setStatus, safeTrim, toInt, normalizeThresholds, isAdmin, canManageItems, auth } from "./core.js";
import { getDoc, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const els = {
  title: $("editorTitle"),
  barcode: $("edBarcode"),
  name: $("edName"),
  unit: $("edUnit"),
  location: $("edLocation"),
  low: $("edLow"),
  critical: $("edCritical"),
  suppliers: $("edSuppliers"),
  tags: $("edTags"),
  btnSuggest: $("btnSuggestCode"),
  btnSave: $("btnSaveItem"),
  btnDelete: $("btnDeleteItem"),
  btnPrintOne: $("btnPrintOne"),
  status: $("stockStatus"),
};

let currentBarcode=null;

function canEdit(){ return isAdmin() || canManageItems(); }

function refreshSupplierOptions(selectedIds=[]){
  const sel = els.suppliers;
  if(!sel) return;
  const ids = new Set(selectedIds || []);
  sel.innerHTML = suppliersCache
    .slice()
    .sort((a,b)=>(a.name||"").localeCompare(b.name||""))
    .map(s=>`<option value="${s.id}" ${ids.has(s.id)?"selected":""}>${s.name||"—"}</option>`)
    .join("");
}
window.__GstockRefreshSupplierOptions = ()=>refreshSupplierOptions(getForm().supplierIds);

function parseTags(raw){
  return safeTrim(raw)
    .split(/[;,]/g)
    .map(s=>safeTrim(s))
    .filter(Boolean)
    .slice(0,20);
}

function openEditor(item){
  currentBarcode = item?.barcode || item?.id || null;
  els.title && (els.title.textContent = currentBarcode ? "Fiche article" : "Créer article");
  els.barcode && (els.barcode.value = currentBarcode || "");
  els.barcode && (els.barcode.disabled = !!currentBarcode); // id = barcode
  els.name && (els.name.value = item?.name||"");
  els.unit && (els.unit.value = item?.unit||"");
  els.location && (els.location.value = item?.location||"");
  const t = normalizeThresholds(item);
  els.low && (els.low.value = String(t.low ?? 5));
  els.critical && (els.critical.value = String(t.critical ?? 2));
  const supplierIds = Array.isArray(item?.suppliers) ? item.suppliers : [];
  refreshSupplierOptions(supplierIds);
  els.tags && (els.tags.value = (Array.isArray(item?.tags)?item.tags:[]).join(", "));
  els.btnDelete && (els.btnDelete.disabled = !currentBarcode);
  els.btnPrintOne && (els.btnPrintOne.disabled = !currentBarcode);
  setStatus(els.status,"");
}

function getForm(){
  const supplierIds = Array.from(els.suppliers?.selectedOptions||[]).map(o=>o.value).filter(Boolean);
  return {
    barcode: safeTrim(els.barcode?.value),
    name: safeTrim(els.name?.value),
    unit: safeTrim(els.unit?.value),
    location: safeTrim(els.location?.value),
    thresholds: { low: toInt(els.low?.value,5), critical: toInt(els.critical?.value,2) },
    suppliers: supplierIds,
    supplierIds,
    tags: parseTags(els.tags?.value),
  };
}

async function saveItem(){
  if(!canEdit()) return setStatus(els.status,"Droits insuffisants.",true);
  const f=getForm();
  if(!f.barcode) return setStatus(els.status,"Code-barres requis.",true);
  if(!f.name) return setStatus(els.status,"Nom requis.",true);

  const exists = itemsCache.find(i=>i.barcode===f.barcode || i.id===f.barcode);
  const isNew = !exists && !currentBarcode;

  // si nouveau: qty initial 0
  const base = isNew ? {qty:0, createdAt: serverTimestamp(), createdBy: auth.currentUser?.uid||null } : {};
  await setDoc(itemDocRef(f.barcode), {
    barcode: f.barcode,
    name: f.name,
    unit: f.unit,
    location: f.location,
    thresholds: { low: Math.max(0,f.thresholds.low), critical: Math.max(0,f.thresholds.critical) },
    suppliers: f.suppliers,
    tags: f.tags,
    ...base,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser?.uid||null,
  }, {merge:true});

  setStatus(els.status,"Enregistré ✅");
  currentBarcode = f.barcode;
  els.barcode && (els.barcode.disabled = true);
  await window.__GstockReloadItems?.();
  openEditor(itemsCache.find(i=>(i.barcode||i.id)===f.barcode) || {id:f.barcode, ...f, qty:0});
}

async function removeItem(){
  if(!canEdit()) return setStatus(els.status,"Droits insuffisants.",true);
  const id = currentBarcode || safeTrim(els.barcode?.value);
  if(!id) return;
  if(!confirm(`Supprimer l'article "${id}" ?`)) return;
  await deleteDoc(itemDocRef(id));
  setStatus(els.status,"Supprimé ✅");
  currentBarcode=null;
  openEditor(null);
  await window.__GstockReloadItems?.();
}

function suggestCode(){
  // Simple: timestamp + 4 digits (pour tests). En prod, scanner ou EAN.
  const d = new Date();
  const code = `GEN-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}-${String(Math.floor(Math.random()*9000)+1000)}`;
  if(els.barcode) els.barcode.value=code;
}

function bind(){
  els.btnSuggest?.addEventListener("click", suggestCode);
  els.btnSave?.addEventListener("click", ()=>saveItem().catch(err=>setStatus(els.status,err.message,true)));
  els.btnDelete?.addEventListener("click", ()=>removeItem().catch(err=>setStatus(els.status,err.message,true)));
  els.btnPrintOne?.addEventListener("click", ()=>{
    const id = currentBarcode || safeTrim(els.barcode?.value);
    if(!id) return;
    window.__GstockPrintLabels?.([id]);
  });
}

window.__GstockOpenItemEditor = (barcode)=>{
  if(!barcode) return openEditor(null);
  const it = itemsCache.find(i=>(i.barcode||i.id)===barcode);
  if(it) return openEditor(it);
  // fallback: fetch
  getDoc(itemDocRef(barcode)).then(snap=>{
    if(snap.exists()) openEditor({id:snap.id, ...snap.data()});
  });
};

AppEvents.addEventListener("auth:signedIn", ()=>{
  bind();
  // l'ouverture initiale est gérée par stock.js (après load items)
});
