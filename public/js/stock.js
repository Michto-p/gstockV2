
// stock.js — liste stock + filtres + sélection impression
import { AppEvents, itemsCache, suppliersCache, itemsColRef, $, safeTrim, toInt, itemStatus, badgeHTML, normalizeThresholds, canRead } from "./core.js";
import { getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const els = {
  search: $("stockSearch"),
  filter: $("stockFilter"),
  btnNew: $("btnNewItem"),
  btnPrintSelected: $("btnPrintSelected"),
  tbody: $("stockTableBody"),
  cards: $("stockCards"),
  hint: $("stockHint"),
  itemBox: $("itemBox"),
};

let selected = new Set();

function supplierNames(ids){
  if(!Array.isArray(ids) || !ids.length) return "";
  const m = new Map(suppliersCache.map(s=>[s.id,s.name||s.id]));
  return ids.map(id=>m.get(id)||id).join(", ");
}

function render(){
  if(!els.tbody) return;
  const q = safeTrim(els.search?.value).toLowerCase();
  const f = els.filter?.value || "all";

  const data = itemsCache
    .slice()
    .map(it=>({
      ...it,
      _barcode: it.barcode||it.id,
      _qty: toInt(it.qty,0),
      _status: itemStatus(it),
      _t: normalizeThresholds(it),
    }))
    .filter(it=>{
      if(f!=="all" && it._status!==f) return false;
      if(!q) return true;
      const s = `${it._barcode} ${it.name||""} ${(it.tags||[]).join(" ")} ${supplierNames(it.suppliers||[])}`.toLowerCase();
      return s.includes(q);
    })
    .sort((a,b)=>(a.name||"").localeCompare(b.name||""));

  els.tbody.innerHTML = data.map(it=>{
    const id=it._barcode;
    const checked = selected.has(id) ? "checked" : "";
    return `
      <tr data-id="${id}">
        <td><input type="checkbox" class="sel" data-id="${id}" ${checked}></td>
        <td>${badgeHTML(it._status)}</td>
        <td class="nameCell">${it.name||""}</td>
        <td class="mono">${id}</td>
        <td class="qty">${it._qty}</td>
        <td>${it._t.low}</td>
        <td>${it._t.critical}</td>
        <td>${supplierNames(it.suppliers||[])}</td>
      </tr>
    `;
  }).join("");

  els.hint && (els.hint.textContent = `${data.length} article(s)`);
  els.btnPrintSelected && (els.btnPrintSelected.disabled = selected.size===0);
}

async function loadItems(){
  const snap = await getDocs(query(itemsColRef(), orderBy("name")));
  itemsCache.length=0;
  snap.forEach(d=>itemsCache.push({id:d.id, ...d.data()}));
  render();
  window.__GstockUpdateDashboard?.();
  window.__GstockUpdateOrders?.();
}

window.__GstockReloadItems = loadItems;

function bind(){
  els.search?.addEventListener("input", render);
  els.filter?.addEventListener("change", render);

  els.tbody?.addEventListener("click",(e)=>{
    const cb = e.target.closest("input.sel");
    if(cb){
      const id=cb.getAttribute("data-id");
      if(!id) return;
      cb.checked ? selected.add(id) : selected.delete(id);
      els.btnPrintSelected && (els.btnPrintSelected.disabled = selected.size===0);
      return;
    }
    const tr = e.target.closest("tr[data-id]");
    const id = tr?.getAttribute("data-id");
    if(id){
      window.__GstockOpenItemEditor?.(id);
      els.itemBox && (els.itemBox.scrollIntoView({behavior:"smooth", block:"start"}));
    }
  });

  els.btnNew?.addEventListener("click", ()=>{
    selected.clear();
    render();
    window.__GstockOpenItemEditor?.(null);
    els.itemBox && (els.itemBox.scrollIntoView({behavior:"smooth", block:"start"}));
  });

  els.btnPrintSelected?.addEventListener("click", ()=>{
    window.__GstockPrintLabels?.(Array.from(selected));
  });
}

AppEvents.addEventListener("auth:signedIn", async ()=>{
  if(!canRead()) return;
  bind();
  await loadItems().catch(()=>{});
  // ouvre le 1er article si existant
  const first = itemsCache[0]?.barcode || itemsCache[0]?.id;
  window.__GstockOpenItemEditor?.(first||null);
});
