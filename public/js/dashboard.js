
// dashboard.js — KPI + liste à commander (seuil bas) + navigation
import { AppEvents, itemsCache, suppliersCache, $, safeTrim, toInt, itemStatus, normalizeThresholds, canRead } from "./core.js";

const els = {
  kpiCrit: $("kpiCrit"),
  kpiLow: $("kpiLow"),
  kpiOk: $("kpiOk"),
  kpiLowZero: $("kpiLowZero"),
  search: $("dashSearch"),
  btnGoStock: $("btnDashGoStock"),
  btnGoOrders: $("btnDashGoOrders"),
  list: $("dashReorderList"),
  hint: $("dashReorderHint"),
};

function supplierName(id){
  return suppliersCache.find(s=>s.id===id)?.name || id;
}

function compute(){
  const q = safeTrim(els.search?.value).toLowerCase();
  const rows = itemsCache.map(it=>{
    const id = it.barcode||it.id;
    const qty = toInt(it.qty,0);
    const t = normalizeThresholds(it);
    const st = itemStatus(it);
    const need = st==="crit" || st==="low";
    const sup = Array.isArray(it.suppliers)?it.suppliers:[];
    const supNames = sup.map(supplierName).join(", ");
    return {it,id,qty,t,st,need,supNames};
  });

  const crit = rows.filter(r=>r.st==="crit").length;
  const low = rows.filter(r=>r.st==="low").length;
  const ok = rows.filter(r=>r.st==="ok").length;
  const zero = rows.filter(r=>r.need && r.qty===0).length;

  els.kpiCrit && (els.kpiCrit.textContent = String(crit));
  els.kpiLow && (els.kpiLow.textContent = String(low));
  els.kpiOk && (els.kpiOk.textContent = String(ok));
  els.kpiLowZero && (els.kpiLowZero.textContent = String(zero));

  let needRows = rows.filter(r=>r.need);
  if(q){
    needRows = needRows.filter(r=>{
      const s = `${r.id} ${r.it.name||""} ${(r.it.tags||[]).join(" ")} ${r.supNames}`.toLowerCase();
      return s.includes(q);
    });
  }
  needRows.sort((a,b)=>{
    // critique d'abord, puis qty asc
    const pr = (x)=> x.st==="crit"?0:1;
    const d = pr(a)-pr(b);
    if(d!==0) return d;
    return a.qty-b.qty;
  });

  if(els.list){
    els.list.innerHTML = needRows.length ? needRows.slice(0,20).map(r=>`
      <button class="row" data-id="${r.id}">
        <div class="rowMain">
          <div class="rowTitle">${r.it.name||""}</div>
          <div class="rowSub">Qté ${r.qty} • Seuil bas ${r.t.low} • Crit ${r.t.critical}${r.supNames?` • ${r.supNames}`:""}</div>
        </div>
        <div class="rowMeta">${r.st==="crit"?"CRIT":"BAS"}</div>
      </button>
    `).join("") : `<div class="empty">Rien à signaler ✅</div>`;
  }
  els.hint && (els.hint.textContent = needRows.length ? `À commander: ${needRows.length} article(s)` : "");
}

function bind(){
  els.search?.addEventListener("input", compute);
  els.btnGoStock?.addEventListener("click", ()=>{
    window.__GstockSetTab?.("stock");
  });
  els.btnGoOrders?.addEventListener("click", ()=>{
    window.__GstockSetTab?.("orders");
  });
  els.list?.addEventListener("click",(e)=>{
    const b=e.target.closest("button.row");
    const id=b?.getAttribute("data-id");
    if(!id) return;
    window.__GstockSetTab?.("stock");
    setTimeout(()=>window.__GstockOpenItemEditor?.(id), 50);
  });
}

window.__GstockUpdateDashboard = compute;

AppEvents.addEventListener("auth:signedIn", ()=>{
  if(!canRead()) return;
  bind();
  compute();
});
