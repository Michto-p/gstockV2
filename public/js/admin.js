
// admin.js — zone admin : valider les comptes + vider le stock
import { AppEvents, db, auth, rolesCache, usersColRef, userDocRef, rolesColRef, itemsColRef, itemDocRef, $, setStatus, safeTrim, isAdmin } from "./core.js";
import { getDocs, query, where, orderBy, limit, updateDoc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const els = {
  btnRefresh: $("btnRefreshPending"),
  status: $("adminStatus"),
  list: $("pendingList"),
  chk: $("chkConfirmClear"),
  txt: $("txtConfirmClear"),
  btnClear: $("btnClearStock"),
};

let pendings=[];

async function ensureRolesLoaded(){
  if(rolesCache.length) return;
  const snap = await getDocs(query(rolesColRef(), orderBy("name")));
  rolesCache.length=0;
  snap.forEach(d=>rolesCache.push({id:d.id, ...d.data()}));
}

function roleOptionsHTML(selected){
  const filtered = rolesCache.filter(r=>r.id!=="pending"); // role pending réservé
  return filtered
    .slice()
    .sort((a,b)=>(a.name||a.id).localeCompare(b.name||b.id))
    .map(r=>`<option value="${r.id}" ${r.id===selected?"selected":""}>${r.name||r.id}</option>`)
    .join("");
}

function renderPending(){
  if(!els.list) return;
  els.list.innerHTML = pendings.length ? pendings.map(u=>`
    <div class="pendingRow" data-uid="${u.uid}">
      <div class="pendingMain">
        <div class="pendingEmail">${u.email||"(sans email)"}</div>
        <div class="pendingSub mono">${u.uid}</div>
      </div>
      <div class="pendingMeta">
        <select class="pendingRole">
          ${roleOptionsHTML(u.roleId && u.roleId!=="pending" ? u.roleId : "stock")}
        </select>
        <button class="pendingApprove">Valider</button>
      </div>
    </div>
  `).join("") : `<div class="empty">Aucun compte en attente ✅</div>`;
  setStatus(els.status, pendings.length ? `${pendings.length} compte(s) en attente` : "OK");
}

async function loadPending(){
  if(!isAdmin()) return;
  await ensureRolesLoaded();
  const snap = await getDocs(query(usersColRef(), where("approved","==",false), orderBy("email"), limit(200)));
  pendings=[];
  snap.forEach(d=>{
    const u = d.data()||{};
    pendings.push({uid:d.id, ...u});
  });
  renderPending();
}

async function approve(uid, roleId){
  await updateDoc(userDocRef(uid), { approved:true, roleId: roleId||"stock", approvedAt: serverTimestamp(), approvedBy: auth.currentUser?.uid||null });
}

async function clearStock(){
  if(!isAdmin()) return setStatus(els.status,"Admin requis.",true);
  if(!els.chk?.checked) return setStatus(els.status,"Coche la confirmation.",true);
  if(safeTrim(els.txt?.value).toUpperCase()!=="VIDER") return setStatus(els.status,'Tape "VIDER".',true);

  if(!confirm("Confirmer : mettre tous les stocks à 0 ?")) return;
  setStatus(els.status,"Vidage en cours…");

  const snap = await getDocs(query(itemsColRef(), limit(5000)));
  const batch = writeBatch(db);
  let n=0;
  snap.forEach(d=>{
    batch.update(itemDocRef(d.id), { qty:0, updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.uid||null });
    n++;
  });
  await batch.commit();
  setStatus(els.status, `Stock vidé ✅ (${n} articles)`);
  els.chk && (els.chk.checked=false);
  els.txt && (els.txt.value="");
  await window.__GstockReloadItems?.();
  await window.__GstockUpdateDashboard?.();
  await window.__GstockUpdateOrders?.();
}

function bind(){
  els.btnRefresh?.addEventListener("click", ()=>loadPending().catch(e=>setStatus(els.status,e.message,true)));
  els.list?.addEventListener("click", async (e)=>{
    if(!e.target.classList.contains("pendingApprove")) return;
    const row = e.target.closest(".pendingRow");
    const uid = row?.getAttribute("data-uid");
    const roleId = row?.querySelector("select.pendingRole")?.value || "stock";
    try{
      await approve(uid, roleId);
      setStatus(els.status, "Validé ✅");
      await loadPending();
    }catch(err){
      setStatus(els.status, err.message, true);
    }
  });
  els.btnClear?.addEventListener("click", ()=>clearStock().catch(e=>setStatus(els.status,e.message,true)));
}

AppEvents.addEventListener("auth:signedIn", async ()=>{
  if(!isAdmin()) return;
  bind();
  await loadPending().catch(()=>{});
});
