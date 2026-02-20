// public/js/stock.js
import {
  AppEvents, canMove, canRead,
  itemDocRef, itemsCache, setStatus, escapeHtml, toInt
} from "./core.js";

import {
  getDoc, updateDoc, addDoc, serverTimestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { db, movesColRef, auth } from "./core.js";

const barcode = document.getElementById("barcode");
const name = document.getElementById("name");
const qtyDelta = document.getElementById("qtyDelta");
const reason = document.getElementById("reason");
const btnAdd = document.getElementById("btnAdd");
const btnRemove = document.getElementById("btnRemove");
const btnLoad = document.getElementById("btnLoad");
const appStatus = document.getElementById("appStatus");

function findItem(bc) {
  const code = (bc || "").trim();
  return (itemsCache || []).find(i => (i.barcode || i.id) === code) || null;
}

async function loadItemToForm() {
  setStatus(appStatus, "");
  if (!canRead()) return;
  const bc = (barcode?.value || "").trim();
  if (!bc) return setStatus(appStatus, "Scanne / entre un code-barres.", true);

  const it = findItem(bc);
  if (name) name.value = it?.name || "";
  if (!it) return setStatus(appStatus, "Article introuvable (ajoute-le dans Stock).", true);

  setStatus(appStatus, `OK: ${it.name} (qté ${it.qty ?? 0})`, false);
}

export async function applyMove(bc, delta, why) {
  setStatus(appStatus, "");
  if (!canMove()) return setStatus(appStatus, "Droits insuffisants (mouvements).", true);

  const barcodeVal = (bc || "").trim();
  const d = Number(delta || 0);
  if (!barcodeVal) return setStatus(appStatus, "Code-barres requis.", true);
  if (!Number.isFinite(d) || d === 0) return setStatus(appStatus, "Delta invalide.", true);

  try {
    // transaction pour éviter les conflits
    const res = await runTransaction(db, async (tx) => {
      const ref = itemDocRef(barcodeVal);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("Article introuvable.");
      const data = snap.data() || {};
      const oldQty = Number(data.qty || 0);
      const newQty = Math.max(0, oldQty + d);

      tx.update(ref, {
        qty: newQty,
        updatedAt: serverTimestamp(),
        updatedBy: (auth.currentUser?.uid || null)
      });

      return { data, oldQty, newQty };
    });

    // log move
    const itName = res.data?.name || "";
    await addDoc(movesColRef(), {
      barcode: barcodeVal,
      itemName: itName,
      delta: d,
      reason: (why || "").trim(),
      ts: serverTimestamp()
    });

    // update cache locally
    const it = findItem(barcodeVal);
    if (it) it.qty = res.newQty;

    AppEvents.dispatchEvent(new CustomEvent("items:updated", { detail: { items: itemsCache } }));
    AppEvents.dispatchEvent(new CustomEvent("moves:updated", { detail: {} }));

    setStatus(appStatus, `Stock mis à jour: ${itName || barcodeVal} → ${res.newQty}`, false);
  } catch (e) {
    console.error(e);
    setStatus(appStatus, e?.message || String(e), true);
  }
}

async function onAddRemove(sign) {
  await loadItemToForm(); // confirme que l'article existe dans cache
  const bc = (barcode?.value || "").trim();
  const n = toInt(qtyDelta?.value, 1);
  const d = sign * Math.max(1, n);
  await applyMove(bc, d, reason?.value || "");
}

btnLoad?.addEventListener("click", loadItemToForm);
btnAdd?.addEventListener("click", () => onAddRemove(+1));
btnRemove?.addEventListener("click", () => onAddRemove(-1));

AppEvents.addEventListener("auth:signedIn", () => {
  setStatus(appStatus, "");
});
