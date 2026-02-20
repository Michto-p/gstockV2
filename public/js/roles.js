
// roles.js — gestion des rôles & permissions
import { AppEvents, db, rolesCache, roleDocRef, rolesColRef, $, setStatus, safeTrim, isAdmin, canManageRoles, auth } from "./core.js";
import { getDocs, query, orderBy, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const els = {
  search: $("roleSearch"),
  btnNew: $("btnNewRole"),
  list: $("rolesList"),
  hint: $("rolesHint"),
  title: $("roleEditorTitle"),
  id: $("roleId"),
  name: $("roleName"),
  permRead: $("permRead"),
  permMove: $("permMove"),
  permItems: $("permItems"),
  permSuppliers: $("permSuppliers"),
  permUsers: $("permUsers"),
  permRoles: $("permRoles"),
  btnSave: $("btnSaveRole"),
  btnDelete: $("btnDeleteRole"),
  status: $("roleStatus"),
};

let currentId = null;

function canEdit() { return isAdmin() || canManageRoles(); }

function roleToRow(r){
  const perms = r.perms || {};
  const badges = [
    perms.read && "read",
    perms.move && "move",
    perms.items && "items",
    perms.suppliers && "sup",
    perms.users && "users",
    perms.roles && "roles",
    perms.admin && "admin",
  ].filter(Boolean).join(", ");
  return `
    <button class="row" data-id="${r.id}">
      <div class="rowMain">
        <div class="rowTitle">${r.name ? r.name : r.id}</div>
        <div class="rowSub">${badges || "—"}</div>
      </div>
      <div class="rowMeta">${r.system ? "Système" : ""}</div>
    </button>
  `;
}

function renderList(){
  if(!els.list) return;
  const q = safeTrim(els.search?.value).toLowerCase();
  const data = rolesCache
    .slice()
    .sort((a,b)=>(a.id||"").localeCompare(b.id||""))
    .filter(r=>{
      if(!q) return true;
      const s = `${r.id} ${r.name||""}`.toLowerCase();
      return s.includes(q);
    });

  els.list.innerHTML = data.length ? data.map(roleToRow).join("") : `<div class="empty">Aucun rôle</div>`;
  els.hint && (els.hint.textContent = data.length ? `${data.length} rôle(s)` : "");
}

function openEditor(r){
  currentId = r?.id || null;
  els.title && (els.title.textContent = currentId ? `Modifier rôle` : `Nouveau rôle`);
  els.id && (els.id.value = r?.id || "");
  els.id && (els.id.disabled = !!r?.system); // système: id figé
  els.name && (els.name.value = r?.name || "");
  const p = r?.perms || {};
  if(els.permRead) els.permRead.checked = !!p.read;
  if(els.permMove) els.permMove.checked = !!p.move;
  if(els.permItems) els.permItems.checked = !!p.items;
  if(els.permSuppliers) els.permSuppliers.checked = !!p.suppliers;
  if(els.permUsers) els.permUsers.checked = !!p.users;
  if(els.permRoles) els.permRoles.checked = !!p.roles;

  // En cas de rôle système admin, on laisse l'admin implicite côté rules via roleId==="admin"
  els.btnDelete && (els.btnDelete.disabled = !!r?.system);
  setStatus(els.status, "");
}

function getForm(){
  const id = safeTrim(els.id?.value).toLowerCase();
  const name = safeTrim(els.name?.value);
  const perms = {
    read: !!els.permRead?.checked,
    move: !!els.permMove?.checked,
    items: !!els.permItems?.checked,
    suppliers: !!els.permSuppliers?.checked,
    users: !!els.permUsers?.checked,
    roles: !!els.permRoles?.checked,
  };
  return { id, name, perms };
}

async function loadRoles(){
  const snap = await getDocs(query(rolesColRef(), orderBy("name")));
  rolesCache.length = 0;
  snap.forEach(d=>{
    rolesCache.push({ id:d.id, ...d.data() });
  });
  renderList();
  // l'app peut avoir besoin de re-masquer/afficher des onglets selon le rôle
  window.__GstockApplyVisibility?.();
}

async function saveRole(){
  if(!canEdit()) return setStatus(els.status, "Droits insuffisants.", true);
  const f = getForm();
  if(!f.id) return setStatus(els.status, "ID requis.", true);
  if(!/^[a-z0-9_-]{2,32}$/.test(f.id)) return setStatus(els.status, "ID invalide (a-z0-9_-).", true);

  const existing = rolesCache.find(r=>r.id===f.id);
  const system = !!existing?.system;
  if(system && existing?.id !== f.id) return setStatus(els.status, "Rôle système non modifiable.", true);

  await setDoc(roleDocRef(f.id), {
    name: f.name || f.id,
    perms: f.perms,
    system: system || false,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser?.uid || null
  }, { merge:true });

  setStatus(els.status, "Enregistré ✅");
  await loadRoles();
  openEditor(rolesCache.find(r=>r.id===f.id));
}

async function removeRole(){
  if(!canEdit()) return setStatus(els.status, "Droits insuffisants.", true);
  const id = currentId;
  const r = rolesCache.find(x=>x.id===id);
  if(!id) return;
  if(r?.system) return setStatus(els.status, "Rôle système non supprimable.", true);
  if(!confirm(`Supprimer le rôle "${id}" ?`)) return;
  await deleteDoc(roleDocRef(id));
  setStatus(els.status, "Supprimé ✅");
  currentId = null;
  openEditor(null);
  await loadRoles();
}

function bind(){
  els.search?.addEventListener("input", renderList);
  els.btnNew?.addEventListener("click", ()=>openEditor({id:"", name:"", perms:{}}));
  els.list?.addEventListener("click",(e)=>{
    const b = e.target.closest("button.row");
    const id = b?.getAttribute("data-id");
    if(!id) return;
    const r = rolesCache.find(x=>x.id===id);
    if(r) openEditor(r);
  });
  els.btnSave?.addEventListener("click", ()=>saveRole().catch(err=>setStatus(els.status, err.message, true)));
  els.btnDelete?.addEventListener("click", ()=>removeRole().catch(err=>setStatus(els.status, err.message, true)));
}

AppEvents.addEventListener("auth:signedIn", async ()=>{
  if(!canEdit()) return; // panel déjà masqué, mais on évite les reads inutiles
  bind();
  await loadRoles().catch(()=>{});
  openEditor(rolesCache.find(r=>r.id==="stock") || rolesCache[0] || null);
});
