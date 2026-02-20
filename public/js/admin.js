// public/js/admin.js
import {
  AppEvents, isAdmin, setStatus, escapeHtml,
  usersColRef, userDocRef, itemsColRef, db
} from "./core.js";

import {
  getDocs, updateDoc, serverTimestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const btnRefreshPending = document.getElementById("btnRefreshPending");
const adminStatus = document.getElementById("adminStatus");
const pendingList = document.getElementById("pendingList");

const chkConfirmClear = document.getElementById("chkConfirmClear");
const txtConfirmClear = document.getElementById("txtConfirmClear");
const btnClearStock = document.getElementById("btnClearStock");

let pending = [];

function renderPending() {
  if (!pendingList) return;
  if (!isAdmin()) {
    pendingList.innerHTML = `<div class="hint">Admin uniquement.</div>`;
    return;
  }
  if (pending.length === 0) {
    pendingList.innerHTML = `<div class="hint">Aucun compte en attente.</div>`;
    return;
  }
  pendingList.innerHTML = pending.map(u => {
    return `<div class="rowItem">
      <div class="rowMain">
        <b>${escapeHtml(u.email || "(sans email)")}</b>
        <div class="muted">${escapeHtml(u.uid || "")}</div>
      </div>
      <div class="rowSide">
        <button class="ghost pApprove" type="button" data-uid="${escapeHtml(u.uid)}">Valider</button>
        <button class="danger pReject" type="button" data-uid="${escapeHtml(u.uid)}">Refuser</button>
      </div>
    </div>`;
  }).join("");
}

async function loadPending() {
  setStatus(adminStatus, "");
  if (!isAdmin()) return;

  try {
    const snap = await getDocs(usersColRef());
    const arr = [];
    snap.forEach(d => {
      const data = d.data() || {};
      if (!data.approved || data.roleId === "pending") arr.push({ uid: d.id, ...data });
    });
    pending = arr;
    setStatus(adminStatus, `${arr.length} compte(s) en attente.`, false);
    renderPending();
  } catch (e) {
    console.error(e);
    setStatus(adminStatus, e?.message || String(e), true);
  }
}

async function approve(uid, approved) {
  if (!uid) return;
  try {
    await updateDoc(userDocRef(uid), {
      approved,
      roleId: approved ? "stock" : "pending",
      updatedAt: serverTimestamp()
    });
    await loadPending();
  } catch (e) {
    console.error(e);
    setStatus(adminStatus, e?.message || String(e), true);
  }
}

async function clearStock() {
  setStatus(adminStatus, "");
  if (!isAdmin()) return setStatus(adminStatus, "Admin uniquement.", true);
  if (!chkConfirmClear?.checked) return setStatus(adminStatus, "Coche la confirmation.", true);
  if ((txtConfirmClear?.value || "").trim().toUpperCase() !== "VIDER") return setStatus(adminStatus, "Tape VIDER.", true);
  if (!confirm("Dernière confirmation : mettre toutes les quantités à 0 ?")) return;

  try {
    const snap = await getDocs(itemsColRef());
    const docs = [];
    snap.forEach(d => docs.push(d.ref));
    let count = 0;
    // batch par 450
    for (let i = 0; i < docs.length; i += 450) {
      const batch = writeBatch(db);
      const slice = docs.slice(i, i + 450);
      for (const ref of slice) {
        batch.update(ref, { qty: 0, updatedAt: serverTimestamp() });
        count++;
      }
      await batch.commit();
    }
    setStatus(adminStatus, `Stock vidé (${count} articles).`, false);
    AppEvents.dispatchEvent(new CustomEvent("items:updated", { detail: {} }));
  } catch (e) {
    console.error(e);
    setStatus(adminStatus, e?.message || String(e), true);
  }
}

btnRefreshPending?.addEventListener("click", loadPending);
pendingList?.addEventListener("click", (e) => {
  const a = e.target.closest(".pApprove");
  if (a) return approve(a.getAttribute("data-uid"), true);
  const r = e.target.closest(".pReject");
  if (r) return approve(r.getAttribute("data-uid"), false);
});
btnClearStock?.addEventListener("click", clearStock);

AppEvents.addEventListener("auth:signedIn", loadPending);
