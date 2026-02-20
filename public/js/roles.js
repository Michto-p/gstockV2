// public/js/roles.js
import {
  AppEvents, canManageRoles, isAdmin,
  rolesCache, setStatus, escapeHtml,
  rolesColRef, roleDocRef, loadAllRoles
} from "./core.js";

import {
  getDoc, setDoc, updateDoc, deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const roleSearch = document.getElementById("roleSearch");
const btnNewRole = document.getElementById("btnNewRole");
const rolesList = document.getElementById("rolesList");
const rolesHint = document.getElementById("rolesHint");

const roleEditorTitle = document.getElementById("roleEditorTitle");
const roleId = document.getElementById("roleId");
const roleName = document.getElementById("roleName");

const permRead = document.getElementById("permRead");
const permMove = document.getElementById("permMove");
const permItems = document.getElementById("permItems");
const permSuppliers = document.getElementById("permSuppliers");
const permUsers = document.getElementById("permUsers");
const permRoles = document.getElementById("permRoles");

const btnSaveRole = document.getElementById("btnSaveRole");
const btnDeleteRole = document.getElementById("btnDeleteRole");
const roleStatus = document.getElementById("roleStatus");

let currentId = "";

function hasAccess() { return isAdmin() || canManageRoles(); }

function renderList() {
  if (!rolesList) return;
  if (!hasAccess()) {
    rolesList.innerHTML = `<div class="hint">Accès refusé.</div>`;
    rolesHint && (rolesHint.textContent = "");
    return;
  }

  const q = (roleSearch?.value || "").toLowerCase();
  const arr = (rolesCache || [])
    .filter(r => {
      if (!q) return true;
      const hay = `${r.id||""} ${r.name||""}`.toLowerCase();
      return hay.includes(q);
    })
    .sort((a,b)=> (a.id==="admin"?-1:0) - (b.id==="admin"?-1:0) || (a.name||a.id||"").localeCompare(b.name||b.id||""));

  rolesHint && (rolesHint.textContent = `${arr.length} rôle(s).`);

  rolesList.innerHTML = arr.map(r=>{
    const active = r.id === currentId ? "active" : "";
    return `<button type="button" class="listItem ${active}" data-id="${escapeHtml(r.id)}">
      <div><b>${escapeHtml(r.name || r.id)}</b><div class="muted">${escapeHtml(r.id)}</div></div>
    </button>`;
  }).join("");
}

function setChecks(perms = {}) {
  permRead && (permRead.checked = !!perms.read);
  permMove && (permMove.checked = !!perms.move);
  permItems && (permItems.checked = !!perms.items);
  permSuppliers && (permSuppliers.checked = !!perms.suppliers);
  permUsers && (permUsers.checked = !!perms.users);
  permRoles && (permRoles.checked = !!perms.roles);
}

function getChecks() {
  return {
    read: !!permRead?.checked,
    move: !!permMove?.checked,
    items: !!permItems?.checked,
    suppliers: !!permSuppliers?.checked,
    users: !!permUsers?.checked,
    roles: !!permRoles?.checked,
    admin: (roleId?.value || "").trim().toLowerCase() === "admin"
  };
}

function openEditor(id) {
  currentId = id || "";
  setStatus(roleStatus, "");

  const r = (rolesCache || []).find(x => x.id === id) || null;
  if (!r) {
    roleEditorTitle && (roleEditorTitle.textContent = "Nouveau rôle");
    roleId && (roleId.value = "");
    roleName && (roleName.value = "");
    setChecks({ read: true });
    btnDeleteRole && (btnDeleteRole.disabled = true);
    return;
  }

  roleEditorTitle && (roleEditorTitle.textContent = "Fiche rôle");
  roleId && (roleId.value = r.id || "");
  roleName && (roleName.value = r.name || "");
  setChecks(r.perms || r.permissions || {});
  btnDeleteRole && (btnDeleteRole.disabled = !(hasAccess() && r.id !== "admin"));
}

async function saveRole() {
  setStatus(roleStatus, "");
  if (!hasAccess()) return setStatus(roleStatus, "Droits insuffisants.", true);

  const id = (roleId?.value || "").trim().toLowerCase();
  const name = (roleName?.value || "").trim();
  if (!id) return setStatus(roleStatus, "RoleId requis.", true);
  if (!name) return setStatus(roleStatus, "Nom requis.", true);

  // protection : admin non supprimable
  const perms = getChecks();

  try {
    await setDoc(roleDocRef(id), {
      id,
      name,
      perms,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    setStatus(roleStatus, "Enregistré.", false);
    await loadAllRoles();
    openEditor(id);
    renderList();
  } catch (e) {
    console.error(e);
    setStatus(roleStatus, e?.message || String(e), true);
  }
}

async function deleteRole() {
  setStatus(roleStatus, "");
  if (!hasAccess()) return setStatus(roleStatus, "Droits insuffisants.", true);

  const id = (roleId?.value || "").trim().toLowerCase();
  if (!id) return;
  if (id === "admin") return setStatus(roleStatus, "Le rôle admin ne peut pas être supprimé.", true);
  if (!confirm(`Supprimer le rôle "${id}" ?`)) return;

  try {
    await deleteDoc(roleDocRef(id));
    setStatus(roleStatus, "Supprimé.", false);
    await loadAllRoles();
    openEditor("");
    renderList();
  } catch (e) {
    console.error(e);
    setStatus(roleStatus, e?.message || String(e), true);
  }
}

rolesList?.addEventListener("click", (e) => {
  const btn = e.target.closest(".listItem");
  const id = btn?.getAttribute("data-id");
  if (!id) return;
  openEditor(id);
  renderList();
});

roleSearch?.addEventListener("input", renderList);
btnNewRole?.addEventListener("click", () => openEditor(""));
btnSaveRole?.addEventListener("click", saveRole);
btnDeleteRole?.addEventListener("click", deleteRole);

AppEvents.addEventListener("auth:signedIn", async () => {
  // rolesCache est chargé par core, mais on force si accès
  if (hasAccess()) await loadAllRoles().catch(()=>{});
  renderList();
  openEditor("");
});
AppEvents.addEventListener("roles:updated", () => { renderList(); });
