
// orders.js — onglet "Commande" : liste auto des articles à commander, groupée par fournisseur
import { AppEvents, itemsCache, suppliersCache, $, toInt, itemStatus, normalizeThresholds, canRead } from "./core.js";

const els = {
  btnRefresh: $("btnOrdersRefresh"),
  btnExport: $("btnOrdersExport"),
  wrap: $("ordersWrap"),
  hint: $("ordersHint"),
};

function supplierName(id){
  return suppliersCache.find(s=>s.id===id)?.name || id || "Sans fournisseur";
}

function build(){
  const needs = itemsCache
    .map(it=>{
      const id = it.barcode||it.id;
      const qty = toInt(it.qty,0);
      const st = itemStatus(it);
      const t = normalizeThresholds(it);
      const want = st==="crit" || st==="low";
      const sIds = Array.isArray(it.suppliers) && it.suppliers.length ? it.suppliers : [""];
      return {it,id,qty,st,t,want,sIds};
    })
    .filter(x=>x.want);

  // groupe: un article peut apparaître chez plusieurs fournisseurs (si multi)
  const groups = new Map(); // supId -> items[]
  for(const row of needs){
    for(const supId of row.sIds){
      const k = supId || "";
      if(!groups.has(k)) groups.set(k, []);
      groups.get(k).push(row);
    }
  }

  const supIds = Array.from(groups.keys()).sort((a,b)=>supplierName(a).localeCompare(supplierName(b)));
  const total = needs.length;

  if(els.hint) els.hint.textContent = total ? `${total} article(s) à commander` : "Rien à commander ✅";

  if(!els.wrap) return;
  if(!supIds.length){
    els.wrap.innerHTML = `<div class="empty">Liste vide ✅</div>`;
    return;
  }

  els.wrap.innerHTML = supIds.map(supId=>{
    const rows = groups.get(supId)
      .slice()
      .sort((a,b)=>{
        const p = (x)=>x.st==="crit"?0:1;
        const d=p(a)-p(b);
        if(d!==0) return d;
        return a.qty-b.qty;
      });

    const title = supplierName(supId);
    const head = supId ? `<div class="supplierSub mono">${supId}</div>` : `<div class="supplierSub">—</div>`;

    const table = `
      <table class="mini">
        <thead><tr><th>État</th><th>Nom</th><th>Code</th><th>Qté</th><th>Seuil bas</th><th>Crit</th></tr></thead>
        <tbody>
          ${rows.map(r=>`
            <tr>
              <td>${r.st==="crit"?"CRIT":"BAS"}</td>
              <td>${r.it.name||""}</td>
              <td class="mono">${r.id}</td>
              <td class="qty">${r.qty}</td>
              <td>${r.t.low}</td>
              <td>${r.t.critical}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
    return `<section class="supplierBlock" data-sup="${supId}">
      <div class="supplierTitle">${title}</div>
      ${head}
      ${table}
    </section>`;
  }).join("");
}

function exportCsv(){
  const rows = [];
  rows.push(["Fournisseur","FournisseurId","État","Nom","Code","Qté","SeuilBas","Critique"].join(";"));

  const needs = itemsCache
    .map(it=>{
      const id = it.barcode||it.id;
      const qty = toInt(it.qty,0);
      const st = itemStatus(it);
      const t = normalizeThresholds(it);
      const want = st==="crit" || st==="low";
      const sIds = Array.isArray(it.suppliers) && it.suppliers.length ? it.suppliers : [""];
      return {it,id,qty,st,t,want,sIds};
    })
    .filter(x=>x.want);

  for(const row of needs){
    for(const supId of row.sIds){
      rows.push([
        supplierName(supId),
        supId||"",
        row.st==="crit"?"CRIT":"BAS",
        (row.it.name||"").replaceAll(";"," "),
        row.id,
        String(row.qty),
        String(row.t.low),
        String(row.t.critical),
      ].join(";"));
    }
  }

  const blob = new Blob([rows.join("\n")], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `gstock_commandes_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 500);
}

function bind(){
  els.btnRefresh?.addEventListener("click", build);
  els.btnExport?.addEventListener("click", exportCsv);
}

window.__GstockUpdateOrders = build;

AppEvents.addEventListener("auth:signedIn", ()=>{
  if(!canRead()) return;
  bind();
  build();
});
