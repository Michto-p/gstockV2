import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, orderBy, limit, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

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

// Header / Views
export const authState = $("authState");
export const btnLogout = $("btnLogout");
export const btnLogout2 = $("btnLogout2");

export const viewLogin = $("viewLogin");
export const viewPending = $("viewPending");
export const viewApp = $("viewApp");

export const roleLabel = $("roleLabel");
export const pendingInfo = $("pendingInfo");
export const status = $("status");

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

// State
export let itemsCache = [];
export let currentRole = "pending";
export let currentApproved = false;

export function isAdmin(){ return currentRole === "admin"; }
export function canMoveStock(){ return currentRole === "admin" || currentRole === "stock"; }

// Firestore paths
export const usersColRef = () => collection(db, "users");
export const itemsColRef = () => collection(db, "items");
export const movesColRef = () => collection(db, "moves");
export const userDocRef = (uid) => doc(db, "users", uid);

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

// Views/tabs
export function showView(view){
  if(viewLogin) viewLogin.hidden = view !== "login";
  if(viewPending) viewPending.hidden = view !== "pending";
  if(viewApp) viewApp.hidden = view !== "app";
}
export function setActiveTab(tab){
  const map = { dash: tabDash, scan: tabScan, stock: tabStock, labels: tabLabels, settings: tabSettings };
  for(const [k, el] of Object.entries(map)){
    if(el) el.hidden = (k !== tab);
  }
  tabBtnDash?.classList.toggle("active", tab === "dash");
  tabBtnScan?.classList.toggle("active", tab === "scan");
  tabBtnStock?.classList.toggle("active", tab === "stock");
  tabBtnLabels?.classList.toggle("active", tab === "labels");
  tabBtnSettings?.classList.toggle("active", tab === "settings");
}

// Tiny event bus
const listeners = new Map();
export function on(event, fn){
  if(!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => listeners.get(event)?.delete(fn);
}
export function emit(event, payload){
  const set = listeners.get(event);
  if(!set) return;
  for(const fn of set){
    try{ fn(payload); }catch(e){ console.warn("event handler", event, e); }
  }
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

// Snapshot listeners
let unsubItems = null;
let unsubMoves = null;

export function startItemsListener(){
  if(unsubItems) unsubItems();
  const q = query(itemsColRef(), orderBy("name"), limit(2000));
  unsubItems = onSnapshot(q, (snap)=>{
    itemsCache = [];
    snap.forEach(d => itemsCache.push({ id:d.id, ...d.data() }));
    emit("items:updated", itemsCache);
  }, (err)=>console.warn("Items listener:", err));
}
export function startMovesListener(){
  if(unsubMoves) unsubMoves();
  const q = query(movesColRef(), orderBy("at","desc"), limit(12));
  unsubMoves = onSnapshot(q, (snap)=>emit("moves:snapshot", snap), (err)=>console.warn("Moves listener:", err));
}
export function stopAllListeners(){
  if(unsubItems) unsubItems(); unsubItems = null;
  if(unsubMoves) unsubMoves(); unsubMoves = null;
  itemsCache = [];
}

// Logout
btnLogout?.addEventListener("click", async ()=>{ await signOut(auth); });
btnLogout2?.addEventListener("click", async ()=>{ await signOut(auth); });

// Auth gate
onAuthStateChanged(auth, async (user)=>{
  stopAllListeners();

  if(!user){
    authState && (authState.textContent = "Non connecté");
    btnLogout && (btnLogout.hidden = true);
    showView("login");
    emit("auth:changed", { user:null, approved:false, role:"pending" });
    return;
  }

  btnLogout && (btnLogout.hidden = false);
  authState && (authState.textContent = `Connecté : ${user.email}`);

  await ensureMyPendingProfile();
  const profile = await getMyProfile();

  currentApproved = !!profile?.approved;
  currentRole = profile?.role || "pending";
  roleLabel && (roleLabel.textContent = currentRole);

  authState && (authState.textContent = `Connecté : ${user.email} — rôle: ${currentRole}${currentApproved ? "" : " (non validé)"}`);

  if(!currentApproved || currentRole === "pending"){
    showView("pending");
    pendingInfo && (pendingInfo.textContent = "En attente de validation par un admin.");
    emit("auth:changed", { user, approved:false, role:currentRole });
    return;
  }

  showView("app");
  setActiveTab("dash");
  startItemsListener();
  startMovesListener();
  emit("auth:changed", { user, approved:true, role:currentRole });
});