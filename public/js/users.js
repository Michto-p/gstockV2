
// users.js — gestion des utilisateurs (profil Firestore) : rôle, validation, suppression profil
import { AppEvents, db, rolesCache, userProfile, usersColRef, userDocRef, rolesColRef, $, setStatus, safeTrim, isAdmin, canManageUsers, auth } from "./core.js";
import { getDocs, query, orderBy, limit, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const els = {
  btnRefresh: $("btnUsersRefresh"),
  search: $("usersSearch"),
  status: $("usersStatus"),
  list: $("usersList"),
};

let usersData=[];

function canEdit(){ return isAdmin() || canManageUsers(); }

async function ensureRolesLoaded(){
  if(rolesCache.length) return;
  try{
    const snap = await getDocs(query(rolesColRef(), orderBy("name")));
    rolesCache.length=0;
    snap.forEach(d=>rolesCache.push({id:d.id, ...d.data()}));
  }catch(e){}
}

function roleOptionsHTML(selected){
  return rolesCache
    .slice()
    .sort((a,b)=>(a.name||a.id).localeCompare(b.name||b.id))
    .map(r=>`<option value="${r.id}" ${r.id===selected?"selected":""}>${r.name||r.id}</option>`)
    .join("");
}

function render(){
  if(!els.list) return;
  const q = safeTrim(els.search?.value).toLowerCase();
  const data = usersData.filter(u=>{
    if(!q) return true;
    const s = `${u.email||""} ${u.roleId||""} ${u.uid||""}`.toLowerCase();
    return s.includes(q);
  });

  els.list.innerHTML = data.length ? data.map(u=>{
    const me = (auth.currentUser?.uid === u.uid);
    return `<div class="userRow" data-uid="${u.uid}">
      <div class="userMain">
        <div class="userEmail">${u.email||"(sans email)"}</div>
        <div class="userSub mono">${u.uid}</div>
      </div>
      <div class="userMeta">
        <label class="miniLbl">Rôle</label>
        <select class="userRole" ${!canEdit()?"disabled":""} ${me?"title='Tu ne peux pas changer ton propre rôle ici'":""}>
          ${roleOptionsHTML(u.roleId||"pending")}
        </select>
        <label class="checkRow miniChk"><input class="userApproved" type="checkbox" ${u.approved?"checked":""} ${!canEdit()?"disabled":""}/>Validé</label>
        <button class="ghost userSave" ${!canEdit()?"disabled":""}>Enregistrer</button>
        <button class="danger userDel" ${(!canEdit()||me)?"disabled":""} title="${me?"Impossible sur soi-même":""}">Suppr.</button>
      </div>
    </div>`;
  }).join("") : `<div class="empty">Aucun utilisateur</div>`;

  els.status && (els.status.textContent = `${data.length} utilisateur(s)`);
}

async function loadUsers(){
  if(!canEdit()) return;
  await ensureRolesLoaded();
  const snap = await getDocs(query(usersColRef(), orderBy("email"), limit(200)));
  usersData = [];
  snap.forEach(d=>usersData.push({uid:d.id, ...d.data()}));
  render();
}

async function saveRow(uid, roleId, approved){
  if(!canEdit()) return;
  await updateDoc(userDocRef(uid), { roleId, approved: !!approved });
}

async function removeUserProfile(uid){
  if(!canEdit()) return;
  if(!confirm("Supprimer ce profil utilisateur (Firestore) ?")) return;
  await deleteDoc(userDocRef(uid));
}

function bind(){
  els.btnRefresh?.addEventListener("click", ()=>loadUsers().catch(e=>setStatus(els.status,e.message,true)));
  els.search?.addEventListener("input", render);

  els.list?.addEventListener("click", async (e)=>{
    const wrap = e.target.closest(".userRow");
    const uid = wrap?.getAttribute("data-uid");
    if(!uid) return;

    if(e.target.classList.contains("userSave")){
      const roleId = wrap.querySelector("select.userRole")?.value || "pending";
      const approved = wrap.querySelector("input.userApproved")?.checked || false;
      try{
        await saveRow(uid, roleId, approved);
        setStatus(els.status,"Enregistré ✅");
      }catch(err){
        setStatus(els.status, err.message, true);
      }
    }

    if(e.target.classList.contains("userDel")){
      try{
        await removeUserProfile(uid);
        setStatus(els.status,"Supprimé ✅");
        await loadUsers();
      }catch(err){
        setStatus(els.status, err.message, true);
      }
    }
  });
}

AppEvents.addEventListener("auth:signedIn", async ()=>{
  if(!canEdit()) return;
  bind();
  await loadUsers().catch(()=>{});
});
