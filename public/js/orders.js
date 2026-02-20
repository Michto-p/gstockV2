// public/js/orders.js
import {
  AppEvents, canRead,
  itemsCache, suppliersCache, escapeHtml
} from "./core.js";

const btnOrdersRefresh = document.getElementById("btnOrdersRefresh");
const btnOrdersExport = document.getElementById("btnOrdersExport");
const ordersWrap = document.getElementById("ordersWrap");
const ordersHint = document.getElementById("ordersHint");

function needOrder(it) {
  const qty = Number(it.qty || 0);
  const low = Number(it.low ?? it.threshold ?? 0);
  const crit = Number(it.critical ?? 0);
  // à commander si <= low, ou <= crit (inclus)
  return qty <= low || qty <= crit;
}

function supplierName(id) {
  if (!id) return "Sans fournisseur";
  const s = (suppliersCache || []).find(x => x.id === id);
  return s?.name || id;
}

function buildGroups() {
  const groups = new Map(); // supplierId -> items[]
  const noSupKey = "__none__";

  for (const it of (itemsCache || [])) {
    if (!needOrder(it)) continue;
    const sids = Array.isArray(it.suppliers) ? it.suppliers.filter(Boolean) : [];
    if (sids.length === 0) {
      if (!groups.has(noSupKey)) groups.set(noSupKey, []);
      groups.get(noSupKey).push(it);
    } else {
      for (const sid of sids) {
        if (!groups.has(sid)) groups.set(sid, []);
        groups.get(sid).push(it);
      }
    }
  }

  // sort items in each group
  for (const [k, arr] of groups.entries()) {
    arr.sort((a,b)=> (a.name||"").localeCompare(b.name||""));
    groups.set(k, arr);
  }

  return groups;
}

function render() {
  if (!ordersWrap) return;
  if (!canRead()) return;

  const groups = buildGroups();
  const keys = Array.from(groups.keys()).sort((a,b)=>{
    if (a==="__none__") return 1;
    if (b==="__none__") return -1;
    return supplierName(a).localeCompare(supplierName(b));
  });

  let total = 0;
  for (const k of keys) total += groups.get(k).length;

  ordersHint && (ordersHint.textContent = total ? `${total} ligne(s) à commander (groupées).` : "Rien à commander.");
  if (!total) {
    ordersWrap.innerHTML = `<div class="hint">Aucun article sous seuil.</div>`;
    return;
  }

  ordersWrap.innerHTML = keys.map(k=>{
    const title = escapeHtml(k==="__none__" ? "Sans fournisseur" : supplierName(k));
    const arr = groups.get(k) || [];
    const rows = arr.map(it=>{
      const bc = escapeHtml(it.barcode || it.id || "");
      const nm = escapeHtml(it.name || "(sans nom)");
      const qty = Number(it.qty || 0);
      const low = Number(it.low ?? it.threshold ?? 0);
      const crit = Number(it.critical ?? 0);
      const suggest = Math.max(0, (low > 0 ? (low - qty) : (crit - qty)));
      return `<div class="rowItem">
        <div class="rowMain"><b>${nm}</b><div class="muted">${bc}</div></div>
        <div class="rowSide"><span class="mono">${qty}</span> / <span class="mono">${low}</span> / <span class="mono">${crit}</span>
          <div class="muted">à commander ~ <span class="mono">${suggest}</span></div>
        </div>
      </div>`;
    }).join("");

    return `<div class="card innerCard">
      <h3>${title}</h3>
      ${rows}
    </div>`;
  }).join("");
}

function exportCsv() {
  const groups = buildGroups();
  const lines = [["supplier","supplierName","barcode","name","qty","low","critical"]];
  for (const [sid, arr] of groups.entries()) {
    for (const it of arr) {
      lines.push([
        sid==="__none__" ? "" : sid,
        supplierName(sid==="__none__" ? "" : sid),
        it.barcode || it.id || "",
        it.name || "",
        String(it.qty ?? 0),
        String(it.low ?? it.threshold ?? 0),
        String(it.critical ?? 0),
      ]);
    }
  }
  const csv = lines.map(row => row.map(v => `"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "gstock_commandes.csv";
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 2000);
}

btnOrdersRefresh?.addEventListener("click", render);
btnOrdersExport?.addEventListener("click", exportCsv);

AppEvents.addEventListener("auth:signedIn", render);
AppEvents.addEventListener("items:updated", render);
AppEvents.addEventListener("suppliers:updated", render);
