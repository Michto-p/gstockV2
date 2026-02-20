// public/js/dashboard.js
import {
  AppEvents, canRead, itemsCache, escapeHtml
} from "./core.js";

import { getDocs, orderBy, limit, query } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { itemsColRef, movesColRef } from "./core.js";

const kpiCrit = document.getElementById("kpiCrit");
const kpiLow = document.getElementById("kpiLow");
const kpiOk = document.getElementById("kpiOk");
const kpiLowZero = document.getElementById("kpiLowZero");

const dashSearch = document.getElementById("dashSearch");
const dashReorderList = document.getElementById("dashReorderList");
const dashReorderHint = document.getElementById("dashReorderHint");

const btnDashGoStock = document.getElementById("btnDashGoStock");
const btnDashGoOrders = document.getElementById("btnDashGoOrders");
const movesBox = document.getElementById("moves");

function classify(it) {
  const qty = Number(it.qty || 0);
  const low = Number(it.low ?? it.threshold ?? it.seuil ?? 0);
  const crit = Number(it.critical ?? 0);
  if (qty <= crit) return "zero";
  if (qty <= low) return "low";
  return "ok";
}

function renderReorderList(filter = "") {
  if (!dashReorderList) return;
  const f = (filter || "").toLowerCase();

  const lowItems = (itemsCache || [])
    .map(it => ({ ...it, _cls: classify(it) }))
    .filter(it => it._cls === "zero" || it._cls === "low")
    .filter(it => {
      if (!f) return true;
      const hay = `${it.name || ""} ${it.barcode || it.id || ""}`.toLowerCase();
      return hay.includes(f);
    })
    .sort((a,b)=> (a._cls=== "zero" ? -1 : 0) - (b._cls=== "zero" ? -1 : 0));

  if (lowItems.length === 0) {
    dashReorderList.innerHTML = `<div class="hint">Aucun article sous seuil.</div>`;
    if (dashReorderHint) dashReorderHint.textContent = "";
    return;
  }

  dashReorderList.innerHTML = lowItems.map(it => {
    const bc = it.barcode || it.id || "";
    const nm = escapeHtml(it.name || "(sans nom)");
    const qty = Number(it.qty || 0);
    const th = Number(it.threshold || 0);
    const badge = it._cls === "zero" ? `<span class="badge danger">0</span>` : `<span class="badge warn">bas</span>`;
    return `
      <div class="rowItem">
        <div class="rowMain"><b>${nm}</b><div class="muted">${escapeHtml(bc)}</div></div>
        <div class="rowSide">${badge} <span class="mono">${qty}</span> / <span class="mono">${th}</span></div>
      </div>
    `;
  }).join("");

  if (dashReorderHint) dashReorderHint.textContent = `${lowItems.length} article(s) à surveiller / commander.`;
}

function updateKpis() {
  if (!kpiCrit || !kpiLow || !kpiOk || !kpiLowZero) return;

  let zero = 0, low = 0, ok = 0;
  for (const it of (itemsCache || [])) {
    const c = classify(it);
    if (c === "zero") zero++;
    else if (c === "low") low++;
    else ok++;
  }
  kpiCrit.textContent = String(zero);
  kpiLow.textContent = String(low);
  kpiOk.textContent = String(ok);
  kpiLowZero.textContent = String(zero + low);
}

async function loadRecentMoves() {
  if (!movesBox) return;
  try {
    const q = query(movesColRef(), orderBy("ts", "desc"), limit(12));
    const snap = await getDocs(q);
    const arr = [];
    snap.forEach(d => arr.push(d.data()));
    if (arr.length === 0) {
      movesBox.innerHTML = `<div class="hint">Aucun mouvement.</div>`;
      return;
    }
    movesBox.innerHTML = arr.map(m => {
      const when = m.ts?.toDate ? m.ts.toDate().toLocaleString() : "";
      const name = escapeHtml(m.itemName || m.name || "");
      const bc = escapeHtml(m.barcode || "");
      const delta = Number(m.delta || 0);
      const sign = delta > 0 ? "+" : "";
      return `<div class="rowItem">
        <div class="rowMain"><b>${name}</b><div class="muted">${bc}</div></div>
        <div class="rowSide"><span class="mono">${sign}${delta}</span><div class="muted">${escapeHtml(when)}</div></div>
      </div>`;
    }).join("");
  } catch (e) {
    // pas bloquant
    movesBox.innerHTML = `<div class="hint">Impossible de charger les mouvements.</div>`;
  }
}

function refreshAll() {
  if (!canRead()) return;
  updateKpis();
  renderReorderList(dashSearch?.value || "");
  loadRecentMoves();
}

dashSearch?.addEventListener("input", () => renderReorderList(dashSearch.value || ""));

btnDashGoStock?.addEventListener("click", () => {
  document.querySelector('.tab[data-tab="stock"]')?.click();
});
btnDashGoOrders?.addEventListener("click", () => {
  document.querySelector('.tab[data-tab="orders"]')?.click();
});

AppEvents.addEventListener("auth:signedIn", refreshAll);
AppEvents.addEventListener("items:updated", refreshAll);
AppEvents.addEventListener("moves:updated", loadRecentMoves);
