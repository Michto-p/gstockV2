import { AppEvents, itemsCache, isAdmin, itemStatus, normalizeThresholds, badgeHTML, toInt, safeTrim, escapeHtml, itemDocRef, auth, setStatus } from "./core.js";
import { getDoc, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
const stockSearch=document.getElementById("stockSearch"), stockFilter=document.getElementById("stockFilter");
const btnNewItem=document.getElementById("btnNewItem"), btnPrintSelected=document.getElementById("btnPrintSelected");
const stockTableBody=document.getElementById("stockTableBody"), stockCards=document.getElementById("stockCards"), stockHint=document.getElementById("stockHint");
const edBarcode=document.getElementById("edBarcode"), edName=document.getElementById("edName"), edUnit=document.getElementById("edUnit"), edLocation=document.getElementById("edLocation");
const edLow=document.getElementById("edLow"), edCritical=document.getElementById("edCritical"), edTags=document.getElementById("edTags");
const btnSaveItem=document.getElementById("btnSaveItem"), btnDeleteItem=document.getElementById("btnDeleteItem"), btnPrintOne=document.getElementById("btnPrintOne"), btnSuggestCode=document.getElementById("btnSuggestCode");
const stockStatus=document.getElementById("stockStatus");
const selected=new Set();
function matches(it){
  const f=stockFilter?.value||"all"; const q=safeTrim(stockSearch?.value).toLowerCase(); const st=itemStatus(it);
  if(f!=="all" && st!==f) return false;
  if(!q) return true;
  const hay=`${it.name||""} ${it.barcode||it.id||""} ${(it.tags||[]).join(" ")}`.toLowerCase();
  return hay.includes(q);
}
function clearEditor(){
  edBarcode.value=""; edName.value=""; edUnit.value=""; edLocation.value=""; edLow.value="5"; edCritical.value="2"; edTags.value="";
  edBarcode.disabled=!isAdmin(); btnSuggestCode.disabled=!isAdmin(); btnSaveItem.disabled=!isAdmin(); btnDeleteItem.disabled=!isAdmin();
  setStatus(stockStatus,"");
}
function fillEditor(it){
  const {low,critical}=normalizeThresholds(it);
  edBarcode.value=it.barcode||it.id; edName.value=it.name||""; edUnit.value=it.unit||""; edLocation.value=it.location||"";
  edLow.value=String(low); edCritical.value=String(critical); edTags.value=(it.tags||[]).join(", ");
  edBarcode.disabled=true;
  [edName,edUnit,edLocation,edLow,edCritical,edTags].forEach(el=>el.disabled=!isAdmin());
  btnSaveItem.disabled=!isAdmin(); btnDeleteItem.disabled=!isAdmin(); btnSuggestCode.disabled=true;
  setStatus(stockStatus,"");
}
function selectItem(id){ const it=(itemsCache||[]).find(x=>x.id===id); if(it) fillEditor(it); }
window.__GstockSelectItem=selectItem;

function render(){
  const list=(itemsCache||[]).filter(matches);
  stockHint.textContent=`${list.length} article(s)`;
  stockTableBody.innerHTML="";
  list.forEach(it=>{
    const st=itemStatus(it); const {low,critical}=normalizeThresholds(it);
    const tr=document.createElement("tr"); tr.className="stockRow";
    tr.innerHTML=`<td><input type="checkbox" ${selected.has(it.id)?"checked":""}></td><td>${badgeHTML(st)}</td>
      <td>${escapeHtml(it.name||"(sans nom)")}</td><td>${escapeHtml(it.barcode||it.id)}</td>
      <td class="num"><b>${toInt(it.qty,0)}</b></td><td class="num">${low}</td><td class="num">${critical}</td>`;
    tr.addEventListener("click",(ev)=>{ if(ev.target.closest('input[type="checkbox"]')) return; selectItem(it.id); });
    tr.querySelector('input').addEventListener("change",(ev)=>{ ev.stopPropagation(); ev.target.checked?selected.add(it.id):selected.delete(it.id); window.__GstockLabelsSetSelection?.([...selected]); });
    stockTableBody.appendChild(tr);
  });
  stockCards.innerHTML=""; // mobile cards
  list.forEach(it=>{
    const st=itemStatus(it); const {low,critical}=normalizeThresholds(it);
    const div=document.createElement("div"); div.className="stockCard";
    div.innerHTML=`<div class="top"><div class="name">${escapeHtml(it.name||"(sans nom)")}</div>${badgeHTML(st)}</div>
      <div class="meta">Code: ${escapeHtml(it.barcode||it.id)} — Qty: <b>${toInt(it.qty,0)}</b><br/>Bas: ${low} — Crit: ${critical}</div>
      <div class="row" style="margin-top:8px"><label class="checkRow" style="margin:0"><input type="checkbox" ${selected.has(it.id)?"checked":""}> Sélection étiquette</label></div>`;
    div.addEventListener("click",()=>selectItem(it.id));
    const cb=div.querySelector('input'); cb.addEventListener("click",e=>e.stopPropagation());
    cb.addEventListener("change",(e)=>{ e.target.checked?selected.add(it.id):selected.delete(it.id); window.__GstockLabelsSetSelection?.([...selected]); });
    stockCards.appendChild(div);
  });
}
window.__GstockRefreshStock=render;
stockSearch?.addEventListener("input",render); stockFilter?.addEventListener("change",render);

btnNewItem?.addEventListener("click",()=>{ if(!isAdmin()) return setStatus(stockStatus,"Admin uniquement.",true); clearEditor(); edBarcode.disabled=false; btnSuggestCode.disabled=false; setStatus(stockStatus,"Mode Nouveau."); });
btnSuggestCode?.addEventListener("click",()=>{ if(!isAdmin()) return; if(edBarcode.disabled) return; const nm=safeTrim(edName.value); if(!nm) return setStatus(stockStatus,"Renseigne le nom.",true);
  const s=nm.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu,"").replace(/[^a-z0-9]+/g,"").slice(0,10) || "ITEM000000";
  edBarcode.value=s; setStatus(stockStatus,"Code suggéré.");
});
btnSaveItem?.addEventListener("click",async ()=>{
  if(!isAdmin()) return setStatus(stockStatus,"Admin uniquement.",true);
  const code=safeTrim(edBarcode.value), nm=safeTrim(edName.value); if(!code) return setStatus(stockStatus,"Code requis.",true); if(!nm) return setStatus(stockStatus,"Nom requis.",true);
  const unit=safeTrim(edUnit.value), location=safeTrim(edLocation.value);
  const low=Math.max(0,toInt(edLow.value,5)), critical=Math.max(0,toInt(edCritical.value,2));
  const tags=safeTrim(edTags.value).split(/[,|]/g).map(s=>s.trim()).filter(Boolean);
  try{
    const ref=itemDocRef(code); const snap=await getDoc(ref); const isNew=!snap.exists();
    await setDoc(ref,{barcode:code,name:nm,unit,location,tags,thresholds:{low,critical},...(isNew?{qty:0}:{}),updatedAt:serverTimestamp(),updatedBy:auth.currentUser?.uid||""},{merge:true});
    setStatus(stockStatus,isNew?"Article créé.":"Mis à jour."); edBarcode.disabled=true; btnSuggestCode.disabled=true;
  }catch(e){ setStatus(stockStatus,e.message,true); }
});
btnDeleteItem?.addEventListener("click",async ()=>{
  if(!isAdmin()) return setStatus(stockStatus,"Admin uniquement.",true);
  const code=safeTrim(edBarcode.value); if(!code) return setStatus(stockStatus,"Sélectionne un article.",true);
  if(!confirm(`Supprimer ${code} ?`)) return;
  try{ await deleteDoc(itemDocRef(code)); setStatus(stockStatus,"Supprimé."); clearEditor(); }catch(e){ setStatus(stockStatus,e.message,true); }
});
btnPrintOne?.addEventListener("click",()=>{ const code=safeTrim(edBarcode.value); if(!code) return; window.__GstockPrintLabels?.([code]); });
btnPrintSelected?.addEventListener("click",()=>{ const ids=[...selected]; if(!ids.length) return setStatus(stockStatus,"Coche des articles.",true); window.__GstockPrintLabels?.(ids); });
AppEvents.addEventListener("auth:signedIn",()=>{ clearEditor(); render(); });
AppEvents.addEventListener("auth:signedOut",()=>{ selected.clear(); clearEditor(); render(); });
