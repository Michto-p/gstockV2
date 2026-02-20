import { AppEvents, itemsCache, itemStatus, normalizeThresholds, badgeHTML, toInt, safeTrim, escapeHtml, setActiveTab } from "./core.js";
const kpiCrit=document.getElementById("kpiCrit"), kpiLow=document.getElementById("kpiLow"), kpiOk=document.getElementById("kpiOk");
const dashSearch=document.getElementById("dashSearch");
const dashCriticalList=document.getElementById("dashCriticalList");
const dashCriticalHint=document.getElementById("dashCriticalHint");
document.getElementById("btnDashGoStock")?.addEventListener("click", ()=>setActiveTab("stock"));
function render(){
  const q=safeTrim(dashSearch?.value).toLowerCase();
  const filtered=(itemsCache||[]).filter(it=>{
    const hay=`${it.name||""} ${it.barcode||it.id||""} ${(it.tags||[]).join(" ")}`.toLowerCase();
    return !q || hay.includes(q);
  });
  let cCrit=0,cLow=0,cOk=0; const crit=[];
  for(const it of filtered){ const st=itemStatus(it); if(st==="crit"){cCrit++; crit.push(it);} else if(st==="low") cLow++; else cOk++; }
  kpiCrit&&(kpiCrit.textContent=String(cCrit)); kpiLow&&(kpiLow.textContent=String(cLow)); kpiOk&&(kpiOk.textContent=String(cOk));
  if(!dashCriticalList) return;
  dashCriticalList.innerHTML="";
  if(crit.length===0){ dashCriticalHint&&(dashCriticalHint.textContent="Aucun article en critique 🎉"); return; }
  dashCriticalHint&&(dashCriticalHint.textContent=`${crit.length} article(s) en critique.`);
  crit.sort((a,b)=>toInt(a.qty,0)-toInt(b.qty,0)).slice(0,12).forEach(it=>{
    const st=itemStatus(it); const {low,critical}=normalizeThresholds(it);
    const row=document.createElement("div");
    row.className="userRow";
    row.innerHTML=`<div class="top"><div class="email">${escapeHtml(it.name||"(sans nom)")}</div>${badgeHTML(st)}</div>
      <div class="meta">Code: ${escapeHtml(it.barcode||it.id)} — Qty: <b>${toInt(it.qty,0)}</b> — Bas: ${low} — Crit: ${critical}</div>
      <div class="actions"><button class="ghost" type="button">Ouvrir Stock</button></div>`;
    row.querySelector("button").addEventListener("click", ()=>{ window.__GstockSelectItem?.(it.id); setActiveTab("stock"); });
    dashCriticalList.appendChild(row);
  });
}
dashSearch?.addEventListener("input", render);
window.__GstockRefreshDash=render;
AppEvents.addEventListener("auth:signedIn", render);
AppEvents.addEventListener("auth:signedOut", ()=>{ dashCriticalList&&(dashCriticalList.innerHTML=""); dashCriticalHint&&(dashCriticalHint.textContent=""); });
