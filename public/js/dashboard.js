import { on, $, toInt, safeTrim } from "./core.js";

const kpiCrit = $("kpiCrit");
const kpiLow = $("kpiLow");
const kpiOk = $("kpiOk");
const dashSearch = $("dashSearch");
const dashCriticalList = $("dashCriticalList");
const dashCriticalHint = $("dashCriticalHint");

let cache = [];

function thresholds(it){
  const low = toInt(it?.thresholds?.low, 5);
  const crit = toInt(it?.thresholds?.critical, 2);
  return { low: Math.max(0, low), crit: Math.max(0, crit) };
}
function statusOf(it){
  const qty = toInt(it?.qty, 0);
  const { low, crit } = thresholds(it);
  if(qty <= crit) return "crit";
  if(qty <= low) return "low";
  return "ok";
}
function badge(st){
  if(st==="crit") return `<span class="badge crit">CRIT</span>`;
  if(st==="low") return `<span class="badge low">BAS</span>`;
  return `<span class="badge ok">OK</span>`;
}

function render(){
  if(!kpiCrit || !kpiLow || !kpiOk) return;
  const q = safeTrim(dashSearch?.value).toLowerCase();
  const filtered = cache.filter(it=>{
    const hay = `${it.name||""} ${it.barcode||it.id||""} ${(it.tags||[]).join(" ")}`.toLowerCase();
    return !q || hay.includes(q);
  });

  let cC=0,cL=0,cO=0;
  const critItems=[];
  for(const it of filtered){
    const st = statusOf(it);
    if(st==="crit"){ cC++; critItems.push(it); }
    else if(st==="low") cL++;
    else cO++;
  }
  kpiCrit.textContent = String(cC);
  kpiLow.textContent = String(cL);
  kpiOk.textContent = String(cO);

  if(!dashCriticalList || !dashCriticalHint) return;
  dashCriticalList.innerHTML = "";
  if(critItems.length===0){
    dashCriticalHint.textContent = "Aucun article en critique 🎉";
    return;
  }
  dashCriticalHint.textContent = `${critItems.length} article(s) en critique.`;
  critItems.sort((a,b)=>toInt(a.qty,0)-toInt(b.qty,0)).slice(0,12).forEach(it=>{
    const st = statusOf(it);
    const { low, crit } = thresholds(it);
    const row=document.createElement("div");
    row.className="move";
    row.innerHTML=`
      <div class="top"><div class="code">${it.name||"(sans nom)"}</div>${badge(st)}</div>
      <div class="meta">Code: ${it.barcode||it.id} — Qty: ${toInt(it.qty,0)} — Bas:${low} — Crit:${crit}</div>
    `;
    dashCriticalList.appendChild(row);
  });
}
dashSearch?.addEventListener("input", render);
on("items:updated", (items)=>{ cache = items || []; render(); });
