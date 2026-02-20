// public/js/users.js
import {
  AppEvents, canManageUsers, isAdmin,
  rolesCache, setStatus, escapeHtml,
  usersColRef, userDocRef, loadAllRoles
} from "./core.js";

import {
  getDocs, updateDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const btnUsersRefresh = document.getElementById("btnUsersRefresh");
const usersSearch = document.getElementById("usersSearch");
const usersStatus = document.getElementById("usersStatus");
const usersList = document.getElementById("usersList");

let usersCacheLocal = [];

function hasAccess() { return isAdmin() || canManageUsers(); }

function roleOptions(selected) {
  const opts = (rolesCache || []).map(r => {
    const sel = r.id === selected ? "selected" : "";
    return `<option value="${escapeHtml(r.id)}" ${sel}>${escapeHtml(r.name || r.id)}</option>`;
  }).join("");
  return opts || `<option value="pending">pending</option>`;
}

function render() {
  if (!usersList) return;
  if (!hasAccess()) {
    usersList.innerHTML = `<div class="hint">Accès refusé.</div>`;
    return;
  }

  const q = (usersSearch?.value || "").toLowerCase();
  const arr = usersCacheLocal.filter(u => {
    if (!q) return true;
    const hay = `${u.email||""} ${u.uid||""} ${u.roleId||""}`.toLowerCase();
    return hay.includes(q);
  }).sort((a,b)=> (a.email||a.uid||"").localeCompare(b.email||b.uid||""));

  usersList.innerHTML = arr.map(u => {
    const approved = !!u.approved;
    const badge = approved ? `<span class="badge ok">ok</span>` : `<span class="badge warn">attente</span>`;
    return `<div class="rowItem">
      <div class="rowMain">
        <b>${escapeHtml(u.email || "(sans email)")}</b>
        <div class="muted">${escapeHtml(u.uid || "")}</div>
      </div>
      <div class="rowSide">
        ${badge}
        <select class="uRole" data-uid="${escapeHtml(u.uid)}">${roleOptions(u.roleId || "pending")}</select>
        <label class="checkRow"><input class="uApproved" type="checkbox" data-uid="${escapeHtml(u.uid)}" ${approved?"checked":""}/>Validé</label>
        <button class="ghost uSave" type="button" data-uid="${escapeHtml(u.uid)}">Enregistrer</button>
        <button class="danger uDel" type="button" data-uid="${escapeHtml(u.uid)}">Supprimer</button>
      </div>
    </div>`;
  }).join("");
}

async function loadUsers() {
  setStatus(usersStatus, "");
  if (!hasAccess()) return;

  try {
    const snap = await getDocs(usersColRef());
    const arr = [];
    snap.forEach(d => arr.push({ uid: d.id, ...(d.data() || {}) }));
    usersCacheLocal = arr;
    setStatus(usersStatus, `${arr.length} utilisateur(s).`, false);
    render();
  } catch (e) {
    console.error(e);
    setStatus(usersStatus, e?.message || String(e), true);
  }
}

async function saveUser(uid) {
  setStatus(usersStatus, "");
  if (!uid) return;
  const row = usersList?.querySelector(`.uSave[data-uid="${CSS.escape(uid)}"]`)?.closest(".rowItem");
  const roleSel = usersList?.querySelector(`.uRole[data-uid="${CSS.escape(uid)}"]`);
  const approvedChk = usersList?.querySelector(`.uApproved[data-uid="${CSS.escape(uid)}"]`);

  const roleId = roleSel?.value || "pending";
  const approved = !!approvedChk?.checked;

  try {
    await updateDoc(userDocRef(uid), {
      roleId,
      approved,
      updatedAt: serverTimestamp()
    });
    setStatus(usersStatus, "Enregistré.", false);
    await loadUsers();
  } catch (e) {
    console.error(e);
    setStatus(usersStatus, e?.message || String(e), true);
  }
}

async function deleteUser(uid) {
  setStatus(usersStatus, "");
  if (!uid) return;
  if (!confirm(`Supprimer le profil Firestore de ${uid} ? (N’efface pas le compte Auth)`)) return;

  try {
    await deleteDoc(userDocRef(uid));
    setStatus(usersStatus, "Profil supprimé.", false);
    await loadUsers();
  } catch (e) {
    console.error(e);
    setStatus(usersStatus, e?.message || String(e), true);
  }
}

btnUsersRefresh?.addEventListener("click", loadUsers);
usersSearch?.addEventListener("input", render);

usersList?.addEventListener("click", (e) => {
  const saveBtn = e.target.closest(".uSave");
  if (saveBtn) return saveUser(saveBtn.getAttribute("data-uid"));
  const delBtn = e.target.closest(".uDel");
  if (delBtn) return deleteUser(delBtn.getAttribute("data-uid"));
});

AppEvents.addEventListener("auth:signedIn", async () => {
  if (hasAccess()) await loadAllRoles().catch(()=>{});
  await loadUsers();
});
AppEvents.addEventListener("roles:updated", render);
