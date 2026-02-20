// public/js/suppliers.js
import {
  AppEvents, canRead, canManageSuppliers,
  suppliersCache, suppliersColRef, supplierDocRef,
  setStatus, escapeHtml
} from "./core.js";

import {
  getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const supSearch = document.getElementById("supSearch");
const btnNewSupplier = document.getElementById("btnNewSupplier");
const supList = document.getElementById("supList");
const supHint = document.getElementById("supHint");

const supEditorTitle = document.getElementById("supEditorTitle");
const supName = document.getElementById("supName");
const supPhone = document.getElementById("supPhone");
const supEmail = document.getElementById("supEmail");
const supWebsite = document.getElementById("supWebsite");
const supAddress = document.getElementById("supAddress");
const supNotes = document.getElementById("supNotes");

const btnSaveSupplier = document.getElementById("btnSaveSupplier");
const btnDeleteSupplier = document.getElementById("btnDeleteSupplier");
const supStatus = document.getElementById("supStatus");

let currentId = "";

function renderList() {
  if (!supList) return;

  const q = (supSearch?.value || "").toLowerCase();
  const arr = (suppliersCache || [])
    .filter(s => {
      if (!q) return true;
      const hay = `${s.name||""} ${s.email||""} ${s.phone||""}`.toLowerCase();
      return hay.includes(q);
    })
    .sort((a,b)=> (a.name||"").localeCompare(b.name||""));

  supHint && (supHint.textContent = `${arr.length} fournisseur(s).`);

  supList.innerHTML = arr.map(s => {
    const id = escapeHtml(s.id);
    const nm = escapeHtml(s.name || s.id);
    const sub = escapeHtml(s.email || s.phone || "");
    const active = (s.id === currentId) ? "active" : "";
    return `<button type="button" class="listItem ${active}" data-id="${id}">
      <div><b>${nm}</b><div class="muted">${sub}</div></div>
    </button>`;
  }).join("");
}

function openEditor(id) {
  const s = (suppliersCache || []).find(x => x.id === id) || null;
  currentId = id || "";

  if (!supEditorTitle) return;
  if (!s) {
    supEditorTitle.textContent = "Nouveau fournisseur";
    supName && (supName.value = "");
    supPhone && (supPhone.value = "");
    supEmail && (supEmail.value = "");
    supWebsite && (supWebsite.value = "");
    supAddress && (supAddress.value = "");
    supNotes && (supNotes.value = "");
    btnDeleteSupplier && (btnDeleteSupplier.disabled = true);
    return;
  }

  supEditorTitle.textContent = "Fiche fournisseur";
  supName && (supName.value = s.name || "");
  supPhone && (supPhone.value = s.phone || "");
  supEmail && (supEmail.value = s.email || "");
  supWebsite && (supWebsite.value = s.website || "");
  supAddress && (supAddress.value = s.address || "");
  supNotes && (supNotes.value = s.notes || "");
  btnDeleteSupplier && (btnDeleteSupplier.disabled = !canManageSuppliers());
}

export async function loadSuppliers() {
  if (!canRead()) return [];
  const snap = await getDocs(suppliersColRef());
  const arr = [];
  snap.forEach(d => arr.push({ id: d.id, ...(d.data() || {}) }));
  suppliersCache.length = 0;
  suppliersCache.push(...arr);
  AppEvents.dispatchEvent(new CustomEvent("suppliers:updated", { detail: { suppliers: arr } }));
  return arr;
}

async function saveSupplier() {
  setStatus(supStatus, "");
  if (!canManageSuppliers()) return setStatus(supStatus, "Droits insuffisants.", true);

  const name = (supName?.value || "").trim();
  if (!name) return setStatus(supStatus, "Nom requis.", true);

  const payload = {
    name,
    phone: (supPhone?.value || "").trim(),
    email: (supEmail?.value || "").trim(),
    website: (supWebsite?.value || "").trim(),
    address: (supAddress?.value || "").trim(),
    notes: (supNotes?.value || "").trim(),
    updatedAt: serverTimestamp(),
  };

  try {
    if (!currentId) {
      const ref = await addDoc(suppliersColRef(), { ...payload, createdAt: serverTimestamp() });
      currentId = ref.id;
    } else {
      await updateDoc(supplierDocRef(currentId), payload);
    }
    setStatus(supStatus, "Enregistré.", false);
    await loadSuppliers();
    openEditor(currentId);
    renderList();
  } catch (e) {
    console.error(e);
    setStatus(supStatus, e?.message || String(e), true);
  }
}

async function deleteSupplier() {
  setStatus(supStatus, "");
  if (!canManageSuppliers()) return setStatus(supStatus, "Droits insuffisants.", true);
  if (!currentId) return;

  const s = (suppliersCache || []).find(x => x.id === currentId);
  if (!confirm(`Supprimer le fournisseur "${s?.name || currentId}" ?`)) return;

  try {
    await deleteDoc(supplierDocRef(currentId));
    setStatus(supStatus, "Supprimé.", false);
    currentId = "";
    await loadSuppliers();
    openEditor("");
    renderList();
  } catch (e) {
    console.error(e);
    setStatus(supStatus, e?.message || String(e), true);
  }
}

supSearch?.addEventListener("input", renderList);
btnNewSupplier?.addEventListener("click", () => openEditor(""));
btnSaveSupplier?.addEventListener("click", saveSupplier);
btnDeleteSupplier?.addEventListener("click", deleteSupplier);

supList?.addEventListener("click", (e) => {
  const btn = e.target.closest(".listItem");
  const id = btn?.getAttribute("data-id");
  if (!id) return;
  openEditor(id);
  renderList();
});

AppEvents.addEventListener("auth:signedIn", async () => {
  await loadSuppliers();
  renderList();
  openEditor("");
});
AppEvents.addEventListener("suppliers:updated", renderList);
