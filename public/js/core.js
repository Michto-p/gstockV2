import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, collection, query, orderBy, limit, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/** ✅ TA CONFIG */
export const firebaseConfig = {
  apiKey: "AIzaSyCf39dzQgHBVao0TOTUqh1q2ytK7BhE9gc",
  authDomain: "gstock-27d16.firebaseapp.com",
  projectId: "gstock-27d16",
  storageBucket: "gstock-27d16.firebasestorage.app",
  messagingSenderId: "1038968834828",
  appId: "1:1038968834828:web:eeb2bb128c58622dda1729"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const $ = (id) => document.getElementById(id);

// Views
export const viewLogin = $("viewLogin");
export const viewPending = $("viewPending");
export const viewApp = $("viewApp");

// Header
export const authState = $("authState");
export const btnLogout = $("btnLogout");
export const btnLogout2 = $("btnLogout2");

// Tabs
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

export const roleLabel = $("roleLabel");
export const status = $("status");

// State
export let itemsCache = [];
export let currentRole = "pending";
export let currentApproved = false;

// Paths
export function userDocRef(uid){ return doc(db, "users", uid); }
export function itemsColRef(){ return collection(db, "items"); }

// Helpers
export function setStatus(el, msg, isError=false){
  if(!el) return;
  el.textContent = msg || "";
  el.style.color = isError ? "#b00020" : "#333";
}
export function safeTrim(v){ return (v||"").trim(); }
export function toInt(v, fallback=0){
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
}
export function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Tabs UI
export function setActiveTab(tab){
  const map = { dash: tabDash, scan: tabScan, stock: tabStock, labels: tabLabels, settings: tabSettings };
  for(const [k, el] of Object.entries(map)) el.hidden = (k !== tab);

  tabBtnDash?.classList.toggle("active", tab === "dash");
  tabBtnScan?.classList.toggle("active", tab === "scan");
  tabBtnStock?.classList.toggle("active", tab === "stock");
  tabBtnLabels?.classList.toggle("active", tab === "labels");
  tabBtnSettings?.classList.toggle("active", tab === "settings");
}
export function showView(view){
  viewLogin.hidden = view !== "login";
  viewPending.hidden = view !== "pending";
  viewApp.hidden = view !== "app";
}

// Profile
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
    }, { merge:true });
  }
}
export async function getMyProfile(){
  if(!auth.currentUser) return null;
  const ref = userDocRef(auth.currentUser.uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

// Items listener
let unsubscribeItems = null;
export function startItemsListener(onUpdate){
  const q = query(itemsColRef(), orderBy("name"), limit(2000));
  unsubscribeItems = onSnapshot(q, (snap)=>{
    itemsCache = [];
    snap.forEach(d => itemsCache.push({ id: d.id, ...d.data() }));
    onUpdate?.();
  }, (err)=>console.warn("Items listener:", err));
}

// Wire tabs + logout
tabBtnDash?.addEventListener("click", ()=>setActiveTab("dash"));
tabBtnScan?.addEventListener("click", ()=>setActiveTab("scan"));
tabBtnStock?.addEventListener("click", ()=>setActiveTab("stock"));
tabBtnLabels?.addEventListener("click", ()=>setActiveTab("labels"));
tabBtnSettings?.addEventListener("click", ()=>setActiveTab("settings"));

btnLogout?.addEventListener("click", async ()=>{ await signOut(auth); });
btnLogout2?.addEventListener("click", async ()=>{ await signOut(auth); });

// Auth gate
onAuthStateChanged(auth, async (user)=>{
  if(!user){
    authState.textContent = "Non connecté";
    btnLogout.hidden = true;
    showView("login");
    return;
  }

  btnLogout.hidden = false;
  authState.textContent = `Connecté : ${user.email}`;

  await ensureMyPendingProfile();
  const profile = await getMyProfile();

  currentApproved = !!profile?.approved;
  currentRole = profile?.role || "pending";
  roleLabel.textContent = currentRole;

  authState.textContent = `Connecté : ${user.email} — rôle: ${currentRole}${currentApproved ? "" : " (non validé)"}`;

  if(!currentApproved || currentRole === "pending"){
    showView("pending");
    return;
  }

  showView("app");
  setActiveTab("labels");
});
