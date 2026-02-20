
// suppliers.js — CRUD fournisseurs
import { AppEvents, db, suppliersCache, suppliersColRef, supplierDocRef, $, setStatus, safeTrim, isAdmin, canManageSuppliers, auth } from "./core.js";
import { getDocs, query, orderBy, addDoc, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const els = {
  search: $("supSearch"),
  btnNew: $("btnNewSupplier"),
  list: $("supList"),
  hint: $("supHint"),
  title: $("supEditorTitle"),
  name: $("supName"),
  phone: $("supPhone"),
  email: $("supEmail"),
  website: $("supWebsite"),
  address: $("supAddress"),
  notes: $("supNotes"),
  btnSave: $("btnSaveSupplier"),
  btnDelete: $("btnDeleteSupplier"),
  status: $("supStatus"),
};

let currentId=null;

function canEdit(){ return isAdmin() || canManageSuppliers(); }

function supplierToRow(s){
  const sub = [s.phone, s.email].filter(Boolean).join(" • ");
  return `
    <button class="row" data-id="${s.id}">
      <div class="rowMain">
        <div class="rowTitle">${s.name||"(Sans nom)"}</div>
        <div class="rowSub">${sub || "—"}</div>
      </div>
    </button>
  `;
}

function renderList(){
  if(!els.list) return;
  const q = safeTrim(els.search?.value).toLowerCase();
  const data = suppliersCache
    .slice()
    .sort((a,b)=>(a.name||"").localeCompare(b.name||""))
    .filter(s=>{
      if(!q) return true;
      const hay = `${s.name||""} ${s.phone||""} ${s.email||""} ${s.website||""}`.toLowerCase();
      return hay.includes(q);
    });
  els.list.innerHTML = data.length ? data.map(supplierToRow).join("") : `<div class="empty">Aucun fournisseur</div>`;
  els.hint && (els.hint.textContent = data.length ? `${data.length} fournisseur(s)` : "");
}

function openEditor(s){
  currentId = s?.id || null;
  els.title && (els.title.textContent = currentId ? "Modifier fournisseur" : "Nouveau fournisseur");
  els.name && (els.name.value = s?.name||"");
  els.phone && (els.phone.value = s?.phone||"");
  els.email && (els.email.value = s?.email||"");
  els.website && (els.website.value = s?.website||"");
  els.address && (els.address.value = s?.address||"");
  els.notes && (els.notes.value = s?.notes||"");
  els.btnDelete && (els.btnDelete.disabled = !currentId);
  setStatus(els.status,"");
}

function getForm(){
  return {
    name: safeTrim(els.name?.value),
    phone: safeTrim(els.phone?.value),
    email: safeTrim(els.email?.value),
    website: safeTrim(els.website?.value),
    address: safeTrim(els.address?.value),
    notes: safeTrim(els.notes?.value),
  };
}

async function loadSuppliers(){
  const snap = await getDocs(query(suppliersColRef(), orderBy("name")));
  suppliersCache.length=0;
  snap.forEach(d=>suppliersCache.push({id:d.id, ...d.data()}));
  renderList();
  window.__GstockRefreshSupplierOptions?.();
}

async function saveSupplier(){
  if(!canEdit()) return setStatus(els.status,"Droits insuffisants.",true);
  const f=getForm();
  if(!f.name) return setStatus(els.status,"Nom requis.",true);

  if(!currentId){
    const ref = await addDoc(suppliersColRef(), {
      ...f, createdAt: serverTimestamp(), createdBy: auth.currentUser?.uid||null,
      updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.uid||null,
    });
    currentId = ref.id;
  }else{
    await setDoc(supplierDocRef(currentId), {
      ...f, updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.uid||null,
    }, {merge:true});
  }

  setStatus(els.status,"Enregistré ✅");
  await loadSuppliers();
  openEditor(suppliersCache.find(s=>s.id===currentId));
}

async function removeSupplier(){
  if(!canEdit()) return setStatus(els.status,"Droits insuffisants.",true);
  if(!currentId) return;
  if(!confirm("Supprimer ce fournisseur ?")) return;
  await deleteDoc(supplierDocRef(currentId));
  setStatus(els.status,"Supprimé ✅");
  currentId=null;
  openEditor(null);
  await loadSuppliers();
}

function bind(){
  els.search?.addEventListener("input", renderList);
  els.btnNew?.addEventListener("click", ()=>openEditor(null));
  els.list?.addEventListener("click",(e)=>{
    const b=e.target.closest("button.row");
    const id=b?.getAttribute("data-id");
    if(!id) return;
    openEditor(suppliersCache.find(s=>s.id===id));
  });
  els.btnSave?.addEventListener("click", ()=>saveSupplier().catch(err=>setStatus(els.status,err.message,true)));
  els.btnDelete?.addEventListener("click", ()=>removeSupplier().catch(err=>setStatus(els.status,err.message,true)));
}

AppEvents.addEventListener("auth:signedIn", async ()=>{
  if(!canEdit()) return;
  bind();
  await loadSuppliers().catch(()=>{});
  openEditor(suppliersCache[0]||null);
});
