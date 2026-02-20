// public/js/items.js
import {
  AppEvents, canRead, canManageItems, canMove,
  itemsCache, suppliersCache, rolesCache,
  itemsColRef, itemDocRef,
  setStatus, escapeHtml, toInt, normalizeThresholds
} from "./core.js";

import {
  getDocs, setDoc, updateDoc, deleteDoc, doc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const stockSearch = document.getElementById("stockSearch");
const stockFilter = document.getElementById("stockFilter");
const btnNewItem = document.getElementById("btnNewItem");
const btnPrintSelected = document.getElementById("btnPrintSelected");

const stockTableBody = document.getElementById("stockTableBody");
const stockCards = document.getElementById("stockCards");
const stockHint = document.getElementById("stockHint");

const editorTitle = document.getElementById("editorTitle");
const edBarcode = document.getElementById("edBarcode");
const edName = document.getElementById("edName");
const edUnit = document.getElementById("edUnit");
const edLocation = document.getElementById("edLocation");
const edLow = document.getElementById("edLow");
const edCritical = document.getElementById("edCritical");
const edSuppliers = document.getElementById("edSuppliers");
const edTags = document.getElementById("edTags");

const btnSuggestCode = document.getElementById("btnSuggestCode");
const btnSaveItem = document.getElementById("btnSaveItem");
const btnDeleteItem = document.getElementById("btnDeleteItem");
const btnPrintOne = document.getElementById("btnPrintOne");
const stockStatus = document.getElementById("stockStatus");

let currentId = ""; // barcode

function getCls(it) {
  const qty = Number(it.qty || 0);
  const crit = Number(it.critical ?? 0);
  const low = Number(it.low ?? it.threshold ?? 0);
  if (qty <= crit) return "crit";
  if (qty <= low) return "low";
  return "ok";
}

export function getItemByBarcode(barcode) {
  const bc = (barcode || "").trim();
  return (itemsCache || []).find(i => (i.barcode || i.id) === bc) || null;
}

function renderSuppliersSelect(selectedIds = []) {
  if (!edSuppliers) return;
  const ids = new Set(selectedIds || []);
  const opts = (suppliersCache || []).map(s => {
    const sel = ids.has(s.id) ? "selected" : "";
    const nm = escapeHtml(s.name || s.id);
    return `<option value="${escapeHtml(s.id)}" ${sel}>${nm}</option>`;
  });
  edSuppliers.innerHTML = opts.join("");
}

function renderList() {
  if (!stockTableBody || !stockCards) return;

  const q = (stockSearch?.value || "").toLowerCase();
  const f = (stockFilter?.value || "all");

  const filtered = (itemsCache || []).filter(it => {
    const hay = `${it.name || ""} ${it.barcode || it.id || ""} ${(it.tags||"")}`.toLowerCase();
    if (q && !hay.includes(q)) return false;
    const cls = getCls(it);
    if (f === "crit" && cls !== "crit") return false;
    if (f === "low" && cls !== "low") return false;
    if (f === "ok" && cls !== "ok") return false;
    return true;
  }).sort((a,b)=>{
    const ca=getCls(a), cb=getCls(b);
    const rank = (c)=> c==="crit"?0:(c==="low"?1:2);
    const r = rank(ca)-rank(cb);
    if (r!==0) return r;
    return (a.name||"").localeCompare(b.name||"");
  });

  if (stockHint) stockHint.textContent = `${filtered.length} article(s).`;

  stockTableBody.innerHTML = filtered.map(it=>{
    const bc = escapeHtml(it.barcode || it.id || "");
    const nm = escapeHtml(it.name || "(sans nom)");
    const qty = Number(it.qty || 0);
    const low = Number(it.low ?? it.threshold ?? 0);
    const crit = Number(it.critical ?? 0);
    const cls = getCls(it);
    const badge = cls==="crit" ? `<span class="badge danger">crit</span>` : (cls==="low" ? `<span class="badge warn">bas</span>` : `<span class="badge ok">ok</span>`);
    return `<tr class="${cls}">
      <td><input type="checkbox" class="rowSel" data-id="${bc}"/></td>
      <td><button type="button" class="link rowOpen" data-id="${bc}">${nm}</button><div class="muted">${bc}</div></td>
      <td class="mono">${qty}</td>
      <td class="mono">${low}</td>
      <td class="mono">${crit}</td>
      <td>${badge}</td>
    </tr>`;
  }).join("");

  stockCards.innerHTML = filtered.map(it=>{
    const bc = escapeHtml(it.barcode || it.id || "");
    const nm = escapeHtml(it.name || "(sans nom)");
    const qty = Number(it.qty || 0);
    const low = Number(it.low ?? it.threshold ?? 0);
    const crit = Number(it.critical ?? 0);
    const cls = getCls(it);
    const badge = cls==="crit" ? `critique` : (cls==="low" ? `bas` : `ok`);
    return `<div class="cardItem ${cls}">
      <div class="rowItem">
        <div class="rowMain"><b>${nm}</b><div class="muted">${bc}</div></div>
        <div class="rowSide"><span class="badge">${badge}</span></div>
      </div>
      <div class="rowItem">
        <div class="muted">Qté</div><div class="mono">${qty}</div>
        <div class="muted">Bas</div><div class="mono">${low}</div>
        <div class="muted">Crit</div><div class="mono">${crit}</div>
      </div>
      <div class="row"><button type="button" class="ghost rowOpen" data-id="${bc}">Ouvrir</button></div>
    </div>`;
  }).join("");
}

function openEditor(barcode) {
  const it = getItemByBarcode(barcode);
  currentId = barcode || "";

  if (!editorTitle) return;
  if (!it) {
    editorTitle.textContent = "Nouvel article";
    if (edBarcode) edBarcode.value = "";
    if (edName) edName.value = "";
    if (edUnit) edUnit.value = "";
    if (edLocation) edLocation.value = "";
    if (edLow) edLow.value = "0";
    if (edCritical) edCritical.value = "0";
    if (edTags) edTags.value = "";
    renderSuppliersSelect([]);
    btnDeleteItem && (btnDeleteItem.disabled = true);
    btnPrintOne && (btnPrintOne.disabled = true);
    return;
  }

  editorTitle.textContent = "Fiche article";
  if (edBarcode) edBarcode.value = it.barcode || it.id || "";
  if (edName) edName.value = it.name || "";
  if (edUnit) edUnit.value = it.unit || "";
  if (edLocation) edLocation.value = it.location || "";
  if (edLow) edLow.value = String(it.low ?? it.threshold ?? 0);
  if (edCritical) edCritical.value = String(it.critical ?? 0);
  if (edTags) edTags.value = it.tags || "";
  renderSuppliersSelect(it.suppliers || []);
  btnDeleteItem && (btnDeleteItem.disabled = !canManageItems());
  btnPrintOne && (btnPrintOne.disabled = false);
}

function selectedSupplierIds() {
  if (!edSuppliers) return [];
  return Array.from(edSuppliers.selectedOptions || []).map(o => o.value).filter(Boolean);
}

async function saveItem() {
  setStatus(stockStatus, "");
  if (!canManageItems()) return setStatus(stockStatus, "Droits insuffisants.", true);

  const barcode = (edBarcode?.value || "").trim();
  const name = (edName?.value || "").trim();
  if (!barcode) return setStatus(stockStatus, "Code-barres obligatoire.", true);
  if (!name) return setStatus(stockStatus, "Nom obligatoire.", true);

  const payload = normalizeThresholds({
    barcode,
    name,
    unit: (edUnit?.value || "").trim(),
    location: (edLocation?.value || "").trim(),
    low: Math.max(0, toInt(edLow?.value, 0)),
    critical: Math.max(0, toInt(edCritical?.value, 0)),
    suppliers: selectedSupplierIds(),
    tags: (edTags?.value || "").trim(),
    updatedAt: serverTimestamp(),
  });

  const existing = getItemByBarcode(barcode);
  try {
    if (!existing) {
      payload.qty = 0;
      payload.createdAt = serverTimestamp();
      await setDoc(itemDocRef(barcode), payload, { merge: true });
    } else {
      await updateDoc(itemDocRef(barcode), payload);
    }
    setStatus(stockStatus, "Enregistré.", false);
    await loadItems();
    openEditor(barcode);
  } catch (e) {
    console.error(e);
    setStatus(stockStatus, e?.message || String(e), true);
  }
}

async function deleteItem() {
  setStatus(stockStatus, "");
  if (!canManageItems()) return setStatus(stockStatus, "Droits insuffisants.", true);

  const barcode = (edBarcode?.value || "").trim();
  if (!barcode) return;

  if (!confirm(`Supprimer l'article ${barcode} ?`)) return;
  try {
    await deleteDoc(itemDocRef(barcode));
    setStatus(stockStatus, "Supprimé.", false);
    await loadItems();
    openEditor("");
  } catch (e) {
    console.error(e);
    setStatus(stockStatus, e?.message || String(e), true);
  }
}

function suggestCode() {
  // simple code : timestamp (pas un vrai EAN)
  if (!edBarcode) return;
  const code = "GS" + Date.now().toString(10);
  edBarcode.value = code;
}

export async function loadItems() {
  if (!canRead()) return [];
  const snap = await getDocs(itemsColRef());
  const arr = [];
  snap.forEach(d => arr.push({ id: d.id, ...(d.data() || {}) }));
  // normalise
  for (const it of arr) {
    if (!it.barcode) it.barcode = it.id;
    if (typeof it.qty !== "number") it.qty = Number(it.qty || 0);
    it.low = Number(it.low ?? it.threshold ?? 0);
    it.critical = Number(it.critical ?? 0);
  }
    // update export from core (binding live: on mute le tableau)
  itemsCache.length = 0;
  itemsCache.push(...arr);

  AppEvents.dispatchEvent(new CustomEvent("items:updated", { detail: { items: arr } }));
  return arr;
}

function onRowOpen(e) {
  const btn = e.target.closest(".rowOpen");
  const id = btn?.getAttribute("data-id");
  if (id) openEditor(id);
}

stockTableBody?.addEventListener("click", onRowOpen);
stockCards?.addEventListener("click", onRowOpen);

stockSearch?.addEventListener("input", renderList);
stockFilter?.addEventListener("change", renderList);

btnNewItem?.addEventListener("click", () => openEditor(""));
btnSuggestCode?.addEventListener("click", suggestCode);
btnSaveItem?.addEventListener("click", saveItem);
btnDeleteItem?.addEventListener("click", deleteItem);

// Minimal print placeholders
btnPrintOne?.addEventListener("click", () => {
  const barcode = (edBarcode?.value || "").trim();
  if (!barcode) return;
  window.open(`./?print=${encodeURIComponent(barcode)}`, "_blank");
});
btnPrintSelected?.addEventListener("click", () => alert("Impression multi à venir (sélection)."));

// Refresh suppliers select when suppliers updated
AppEvents.addEventListener("suppliers:updated", () => {
  const it = getItemByBarcode(currentId);
  renderSuppliersSelect(it?.suppliers || []);
});

// Auth hook
AppEvents.addEventListener("auth:signedIn", async () => {
  await loadItems();
  renderList();
  openEditor("");
});
AppEvents.addEventListener("items:updated", () => renderList());
