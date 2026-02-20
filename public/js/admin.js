import { AppEvents, isAdmin, usersColRef, userDocRef, auth, setStatus, db, itemsColRef } from "./core.js";
import { getDocs, query, where, updateDoc, serverTimestamp, writeBatch, orderBy, startAfter, limit } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
const adminPanel=document.getElementById("adminPanel");
const btnRefreshPending=document.getElementById("btnRefreshPending");
const adminStatus=document.getElementById("adminStatus");
const pendingList=document.getElementById("pendingList");
const chkConfirmClear=document.getElementById("chkConfirmClear");
const txtConfirmClear=document.getElementById("txtConfirmClear");
const btnClearStock=document.getElementById("btnClearStock");
function applyRole(){ if(adminPanel) adminPanel.hidden=!isAdmin(); if(isAdmin()) refresh(); }
AppEvents.addEventListener("auth:signedIn",applyRole);
AppEvents.addEventListener("auth:signedOut",applyRole);
AppEvents.addEventListener("auth:pending",applyRole);
btnRefreshPending?.addEventListener("click",refresh);
async function refresh(){
  if(!isAdmin()) return;
  setStatus(adminStatus,"Chargement...");
  pendingList.innerHTML="";
  try{
    const snap=await getDocs(query(usersColRef(), where("approved","==",false)));
    if(snap.empty){ setStatus(adminStatus,"Aucun compte en attente."); return; }
    setStatus(adminStatus,`${snap.size} compte(s) en attente.`);
    snap.forEach(d=>{
      const u=d.data(); const uid=d.id;
      const row=document.createElement("div"); row.className="userRow";
      row.innerHTML=`<div class="top"><div class="email">${u.email||"(sans email)"}</div><div style="font-weight:800;color:#666;font-size:12px">${uid.slice(0,6)}…</div></div>
      <div class="meta">Rôle: ${u.role||"pending"} — approved: ${u.approved===true}</div>
      <div class="actions"><button class="ghost" data-act="stock" type="button">Valider STOCK</button><button class="ghost" data-act="visu" type="button">Valider VISU</button></div>`;
      row.addEventListener("click",async (ev)=>{
        const btn=ev.target.closest("button"); if(!btn) return;
        const act=btn.getAttribute("data-act");
        try{
          await updateDoc(userDocRef(uid), {approved:true, role:(act==="stock"?"stock":"visu"), approvedAt:serverTimestamp(), approvedBy:auth.currentUser?.uid||""});
          refresh();
        }catch(e){ setStatus(adminStatus,e.message,true); }
      });
      pendingList.appendChild(row);
    });
  }catch(e){ setStatus(adminStatus,e.message,true); }
}
btnClearStock?.addEventListener("click", async ()=>{
  if(!isAdmin()) return setStatus(adminStatus,"Admin uniquement.",true);
  if(!chkConfirmClear.checked || (txtConfirmClear.value||"").trim().toUpperCase()!=="VIDER") return setStatus(adminStatus,"Confirmation invalide.",true);
  if(!confirm("Mettre toutes les quantités à 0 ?")) return;
  setStatus(adminStatus,"Vidage en cours...");
  try{
    let last=null, total=0;
    while(true){
      let qy=query(itemsColRef(), orderBy("barcode"), limit(450));
      if(last) qy=query(itemsColRef(), orderBy("barcode"), startAfter(last), limit(450));
      const snap=await getDocs(qy);
      if(snap.empty) break;
      const batch=writeBatch(db);
      snap.forEach(d=>{ batch.update(d.ref,{qty:0, updatedAt:serverTimestamp(), updatedBy:auth.currentUser?.uid||"", lastMoveAt:serverTimestamp()}); total++; });
      await batch.commit();
      last=snap.docs[snap.docs.length-1];
      if(snap.size<450) break;
    }
    setStatus(adminStatus,`Stock vidé : ${total} article(s).`);
    chkConfirmClear.checked=false; txtConfirmClear.value="";
  }catch(e){ setStatus(adminStatus,e.message,true); }
});
