
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

export const tabBtnDash = $("tabBtnDash");
export const tabBtnScan = $("tabBtnScan");
export const tabBtnStock = $("tabBtnStock");
export const tabBtnLabels = $("tabBtnLabels");
export const tabBtnSettings = $("tabBtnSettings");

export const tabDash = $("tabDash");
export const tabScan = $("tabScan");
export const tabStock = $("tabStock");
export const tabLabels = $("tabLabels");
export const tabSettings = $("tabSettings");

export const AppEvents = new EventTarget();
export function emit(name, detail){ AppEvents.dispatchEvent(new CustomEvent(name, {detail})); }

export let itemsCache = [];
export let currentRole = "pending";
export let currentApproved = false;

export function isAdmin(){ return currentRole==="admin" && currentApproved; }
export function canMoveStock(){ return (currentRole==="admin" || currentRole==="stock") && currentApproved; }
export function canRead(){ return (currentRole==="admin" || currentRole==="stock" || currentRole==="visu") && currentApproved; }

export function setStatus(el, msg, isError=false){
  if(!el) return;
  el.textContent = msg || "";
  el.style.color = isError ? "#b00020" : "#333";
}
export function safeTrim(v){ return (v||"").trim(); }
export function nowISO(){ return new Date().toISOString(); }
export function toInt(v, fallback=0){
  const n = parseInt(String(v??""), 10);
  return Number.isFinite(n) ? n : fallback;
}
export function escapeHtml(s){
  return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

export function showView(v){
  if(viewLogin) viewLogin.hidden = v!=="login";
  if(viewPending) viewPending.hidden = v!=="pending";
  if(viewApp) viewApp.hidden = v!=="app";
}
export function setActiveTab(tab){
  const map = {dash:tabDash, scan:tabScan, stock:tabStock, labels:tabLabels, settings:tabSettings};
  for(const [k,el] of Object.entries(map)) if(el) el.hidden = (k!==tab);

  tabBtnDash?.classList.toggle("active", tab==="dash");
  tabBtnScan?.classList.toggle("active", tab==="scan");
  tabBtnStock?.classList.toggle("active", tab==="stock");
  tabBtnLabels?.classList.toggle("active", tab==="labels");
  tabBtnSettings?.classList.toggle("active", tab==="settings");
}

export function usersColRef(){ return collection(db,"users"); }
export function userDocRef(uid){ return doc(db,"users",uid); }
export function itemsColRef(){ return collection(db,"items"); }
export function itemDocRef(code){ return doc(db,"items",code); }
export function movesColRef(){ return collection(db,"moves"); }

export function normalizeThresholds(it){
  const low = toInt(it?.thresholds?.low, 5);
  const critical = toInt(it?.thresholds?.critical, 2);
  return { low: Math.max(0, low), critical: Math.max(0, critical) };
}
export function itemStatus(it){
  const qty = toInt(it?.qty, 0);
  const {low, critical} = normalizeThresholds(it);
  if(qty <= critical) return "crit";
  if(qty <= low) return "low";
  return "ok";
}
export function badgeHTML(st){
  if(st==="crit") return `<span class="badge crit">CRIT</span>`;
  if(st==="low") return `<span class="badge low">BAS</span>`;
  return `<span class="badge ok">OK</span>`;
}

export async function ensureMyPendingProfile(){
  if(!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  const ref = userDocRef(uid);
  const snap = await getDoc(ref);
  if(!snap.exists()){
    await setDoc(ref, {
      email: auth.currentUser.email || "",
      role: "pending",
      approved: false,
      createdAt: serverTimestamp()
    }, {merge:true});
  }
}

export async function getMyProfile(){
  if(!auth.currentUser) return null;
  const ref = userDocRef(auth.currentUser.uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

btnLogout?.addEventListener("click", async ()=>{ await signOut(auth); });
btnLogout2?.addEventListener("click", async ()=>{ await signOut(auth); });

onAuthStateChanged(auth, async (user)=>{
  itemsCache = [];
  if(!user){
    currentRole="pending"; currentApproved=false;
    roleLabel && (roleLabel.textContent="—");
    authState && (authState.textContent="Non connecté");
    btnLogout && (btnLogout.hidden=true);
    showView("login");
    emit("auth:signedOut");
    return;
  }
  btnLogout && (btnLogout.hidden=false);

  await ensureMyPendingProfile();
  const profile = await getMyProfile();
  currentApproved = !!profile?.approved;
  currentRole = profile?.role || "pending";
  roleLabel && (roleLabel.textContent = currentRole);

  authState && (authState.textContent = `Connecté : ${user.email} — rôle: ${currentRole}${currentApproved ? "" : " (non validé)"}`);

  if(!currentApproved || currentRole==="pending"){
    showView("pending");
    pendingInfo && (pendingInfo.textContent = "En attente de validation par un admin.");
    emit("auth:pending", {user, profile});
    return;
  }

  showView("app");
  setActiveTab("dash");
  emit("auth:signedIn", {user, profile});
});
