import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

export const firebaseConfig = {
  "apiKey": "AIzaSyCf39dzQgHBVao0TOTUqh1q2ytK7BhE9gc",
  "authDomain": "gstock-27d16.firebaseapp.com",
  "projectId": "gstock-27d16",
  "storageBucket": "gstock-27d16.firebasestorage.app",
  "messagingSenderId": "1038968834828",
  "appId": "1:1038968834828:web:eeb2bb128c58622dda1729"
};
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const $ = (id)=>document.getElementById(id);

export const viewLogin = $("viewLogin");
export const viewPending = $("viewPending");
export const viewApp = $("viewApp");

export const authState = $("authState");
export const btnLogout = $("btnLogout");
export const btnLogout2 = $("btnLogout2");
export const pendingInfo = $("pendingInfo");
export const status = $("status");

export const roleLabel = $("roleLabel");
export const roleIdLabel = $("roleIdLabel");

export const tabsBar = $("tabsBar");

export const AppEvents = new EventTarget();
export function emit(name, detail){ AppEvents.dispatchEvent(new CustomEvent(name, {detail})); }

export let itemsCache = [];
export let suppliersCache = [];
export let rolesCache = [];
export let userProfile = null;

export function setStatus(el, msg, isError=false){
  if(!el) return;
  el.textContent = msg || "";
  el.style.color = isError ? "#b00020" : "#333";
}
export function safeTrim(v){ return (v||"").trim(); }
export function nowISO(){ return new Date().toISOString(); }
export function toInt(v, fallback=0){ const n=parseInt(String(v??""),10); return Number.isFinite(n)?n:fallback; }
export function escapeHtml(s){ return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }

export function showView(v){
  viewLogin.hidden = v!=="login";
  viewPending.hidden = v!=="pending";
  viewApp.hidden = v!=="app";
}

export function rolesColRef(){ return collection(db,"roles"); }
export function roleDocRef(id){ return doc(db,"roles",id); }
export function usersColRef(){ return collection(db,"users"); }
export function userDocRef(uid){ return doc(db,"users",uid); }
export function itemsColRef(){ return collection(db,"items"); }
export function itemDocRef(code){ return doc(db,"items",code); }
export function suppliersColRef(){ return collection(db,"suppliers"); }
export function supplierDocRef(id){ return doc(db,"suppliers",id); }
export function movesColRef(){ return collection(db,"moves"); }

export function normalizeThresholds(it){
  const low = toInt(it?.thresholds?.low, 5);
  const critical = toInt(it?.thresholds?.critical, 2);
  return { low: Math.max(0, low), critical: Math.max(0, critical) };
}
export function itemStatus(it){
  const qty = toInt(it?.qty, 0);
  const t = normalizeThresholds(it);
  if(qty <= t.critical) return "crit";
  if(qty <= t.low) return "low";
  return "ok";
}
export function badgeHTML(st){
  if(st==="crit") return `<span class="badge crit">CRIT</span>`;
  if(st==="low") return `<span class="badge low">BAS</span>`;
  return `<span class="badge ok">OK</span>`;
}

export function getMyRoleDoc(){
  if(!userProfile?.roleId) return null;
  return rolesCache.find(r=>r.id===userProfile.roleId) || null;
}
export function approved(){ return !!userProfile?.approved; }
export function canRead(){ const r=getMyRoleDoc(); return approved() && !!r?.perms?.read; }
export function canMove(){ const r=getMyRoleDoc(); return approved() && !!r?.perms?.move; }
export function canManageItems(){ const r=getMyRoleDoc(); return approved() && !!r?.perms?.items; }
export function canManageSuppliers(){ const r=getMyRoleDoc(); return approved() && !!r?.perms?.suppliers; }
export function canManageUsers(){ const r=getMyRoleDoc(); return approved() && !!r?.perms?.users; }
export function canManageRoles(){ const r=getMyRoleDoc(); return approved() && !!r?.perms?.roles; }
export function isAdmin(){ const r=getMyRoleDoc(); return approved() && (userProfile?.roleId==="admin" || !!r?.perms?.admin); }

export async function ensureMyProfile(){
  if(!auth.currentUser) return;
  const uid=auth.currentUser.uid;
  const ref=userDocRef(uid);
  const snap=await getDoc(ref);
  if(!snap.exists()){
    await setDoc(ref, { email: auth.currentUser.email||"", roleId:"pending", approved:false, createdAt: serverTimestamp() }, {merge:true});
  }
}

export async function loadMyProfile(){
  if(!auth.currentUser) return null;
  const ref=userDocRef(auth.currentUser.uid);
  const snap=await getDoc(ref);
  return snap.exists()?snap.data():null;
}

export async function ensureBaseRolesIfAdmin(){
  if(!isAdmin()) return;
  const base = [
    {id:"admin", name:"Admin", perms:{admin:true, read:true, move:true, items:true, suppliers:true, users:true, roles:true}},
    {id:"stock", name:"Stock", perms:{read:true, move:true, items:false, suppliers:false, users:false, roles:false}},
    {id:"visu", name:"Visu", perms:{read:true, move:false, items:false, suppliers:false, users:false, roles:false}},
    {id:"pending", name:"Pending", perms:{read:false, move:false, items:false, suppliers:false, users:false, roles:false}}
  ];
  for(const r of base){
    try{ await setDoc(roleDocRef(r.id), {name:r.name, perms:r.perms, system:true, updatedAt: serverTimestamp(), updatedBy: auth.currentUser.uid}, {merge:true}); }catch(e){}
  }
}

btnLogout?.addEventListener("click", async ()=>{ await signOut(auth); });
btnLogout2?.addEventListener("click", async ()=>{ await signOut(auth); });

onAuthStateChanged(auth, async (user)=>{
  itemsCache=[]; suppliersCache=[]; rolesCache=[]; userProfile=null;
  if(!user){
    roleLabel && (roleLabel.textContent="—");
    roleIdLabel && (roleIdLabel.textContent="—");
    authState && (authState.textContent="Non connecté");
    btnLogout && (btnLogout.hidden=true);
    showView("login");
    emit("auth:signedOut");
    return;
  }
  btnLogout && (btnLogout.hidden=false);
  await ensureMyProfile();
  userProfile = await loadMyProfile();
  roleLabel && (roleLabel.textContent = userProfile?.roleId||"—");
  roleIdLabel && (roleIdLabel.textContent = userProfile?.roleId||"—");
  authState && (authState.textContent = `Connecté : ${user.email} — rôle: ${userProfile?.roleId||"?"}${userProfile?.approved? "" : " (non validé)"}`);
  if(!userProfile?.approved || userProfile?.roleId==="pending"){
    showView("pending");
    pendingInfo && (pendingInfo.textContent="En attente de validation par un admin.");
    emit("auth:pending", {user, profile:userProfile});
    return;
  }
  showView("app");
  emit("auth:signedIn", {user, profile:userProfile});
});
