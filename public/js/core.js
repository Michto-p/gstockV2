



// public/js/core.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  doc, getDoc, setDoc, updateDoc,
  collection, getDocs, query, limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/**
 * OWNER_UID (temporaire recommandé)
 * 1) mets ton UID ici, déploie, connecte-toi une fois (bootstrap)
 * 2) vérifie Firestore (roles + users/UID)
 * 3) remets OWNER_UID = "" et redéploie
 */
export const OWNER_UID = "pxEjO8xAUxQcrwEILjwxi9OlFp82"; // <-- COLLE TON UID ICI (temporairement)

/** Firebase config */
export const firebaseConfig = {
  apiKey: "AIzaSyCf39dzQgHBVao0TOTUqh1q2ytK7BhE9gc",
  authDomain: "gstock-27d16.firebaseapp.com",
  projectId: "gstock-27d16",
  storageBucket: "gstock-27d16.firebasestorage.app",
  messagingSenderId: "1038968834828",
  appId: "1:1038968834828:web:eeb2bb128c58622dda1729",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// ---------------- DOM helpers ----------------
export const $ = (id) => document.getElementById(id);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// Views
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

export function showView(which) {
  if (viewLogin) viewLogin.hidden = which !== "login";
  if (viewPending) viewPending.hidden = which !== "pending";
  if (viewApp) viewApp.hidden = which !== "app";
}

export function setStatus(el, msg, isError = false) {
  if (!el) return;
  el.textContent = msg || "";
  el.style.color = isError ? "#b00020" : "";
}

export function safeTrim(v) { return (v ?? "").toString().trim(); }
export function toInt(v, def = 0) {
  const n = parseInt((v ?? "").toString(), 10);
  return Number.isFinite(n) ? n : def;
}
export function escapeHtml(s) {
  return (s ?? "").toString()
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
export function nowISO() { return new Date().toISOString(); }

// Compat: utilisé par items.js dans certaines versions
export function normalizeThresholds(item) {
  if (!item || typeof item !== "object") return item;
  const out = { ...item };
  if ("qty" in out) out.qty = Math.max(0, toInt(out.qty, 0));
  // seuil principal (tolère différents noms)
  const keys = ["threshold", "seuil", "min", "reorderPoint", "alertThreshold"];
  for (const k of keys) {
    if (k in out) out[k] = Math.max(0, toInt(out[k], 0));
  }
  if (out.thresholds && typeof out.thresholds === "object") {
    const t = { ...out.thresholds };
    for (const k of Object.keys(t)) t[k] = Math.max(0, toInt(t[k], 0));
    out.thresholds = t;
  }
  return out;
}

// ---------------- App events ----------------
export const AppEvents = new EventTarget();
export function emit(name, detail) {
  AppEvents.dispatchEvent(new CustomEvent(name, { detail }));
}

// ---------------- Global state (exports attendus) ----------------
export let userProfile = null;   // doc users/{uid}
export let myRoleDoc = null;     // doc roles/{roleId}
export let rolesCache = [];      // liste de rôles (utile pour select)
export let itemsCache = [];
export let suppliersCache = [];

// ---------------- Firestore refs ----------------
export const usersColRef = () => collection(db, "users");
export const userDocRef = (uid) => doc(db, "users", uid);

export const rolesColRef = () => collection(db, "roles");
export const roleDocRef = (id) => doc(db, "roles", id);

export const itemsColRef = () => collection(db, "items");
export const itemDocRef = (barcode) => doc(db, "items", barcode);

export const suppliersColRef = () => collection(db, "suppliers");
export const supplierDocRef = (id) => doc(db, "suppliers", id);

export const movesColRef = () => collection(db, "moves");

// ---------------- Permissions ----------------
export function approved() { return !!userProfile?.approved; }
export function roleId() { return userProfile?.roleId || ""; }
export function getPerms() { return myRoleDoc?.perms || myRoleDoc?.permissions || {}; }

export function canRead() { return approved() && !!getPerms().read; }
export function canMove() { return approved() && !!getPerms().move; }
export function canManageItems() { return approved() && !!getPerms().items; }
export function canManageSuppliers() { return approved() && !!getPerms().suppliers; }
export function canManageUsers() { return approved() && !!getPerms().users; }
export function canManageRoles() { return approved() && !!getPerms().roles; }
export function isAdmin() { return approved() && (roleId() === "admin" || !!getPerms().admin); }

// ---------------- Bootstrap + profile ----------------
function normalizeRoleId(roleVal) {
  const raw = safeTrim(roleVal).toLowerCase();
  if (!raw) return "pending";
  if (raw === "administrator" || raw === "administrateur") return "admin";
  if (raw === "admin") return "admin";
  if (raw === "stock") return "stock";
  if (raw === "visu" || raw === "viewer" || raw === "lecture") return "visu";
  if (raw === "pending" || raw === "attente") return "pending";
  return raw;
}

export async function ensureMyProfile() {
  const u = auth.currentUser;
  if (!u) return null;

  const isOwner = (OWNER_UID && u.uid === OWNER_UID);
  const ref = userDocRef(u.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const data = {
      uid: u.uid,
      email: u.email || "",
      displayName: u.displayName || "",
      approved: isOwner ? true : false,
      roleId: isOwner ? "admin" : "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, data, { merge: true });
    return data;
  }

  const data = snap.data() || {};
  const updates = {};

  // migration role -> roleId
  if (!data.roleId && data.role) updates.roleId = normalizeRoleId(data.role);

  // owner safety
  if (isOwner) {
    if (data.roleId !== "admin") updates.roleId = "admin";
    if (data.approved !== true) updates.approved = true;
  }

  if (Object.keys(updates).length) {
    updates.updatedAt = serverTimestamp();
    await updateDoc(ref, updates);
    return { ...data, ...updates };
  }
  return data;
}

export async function loadMyProfile() {
  const u = auth.currentUser;
  if (!u) return null;
  const snap = await getDoc(userDocRef(u.uid));
  return snap.exists() ? snap.data() : null;
}

export async function bootstrapBaseRolesIfOwner() {
  const u = auth.currentUser;
  if (!u) return false;
  if (!OWNER_UID || u.uid !== OWNER_UID) return false;

  const s = await getDocs(query(rolesColRef(), limit(1)));
  if (!s.empty) return true;

  const base = [
    { id: "admin", name: "Admin", perms: { admin: true, read: true, move: true, items: true, suppliers: true, users: true, roles: true, orders: true, import: true, labels: true } },
    { id: "stock", name: "Stock", perms: { read: true, move: true, items: true, suppliers: true, users: false, roles: false, orders: true } },
    { id: "visu", name: "Visu", perms: { read: true, move: false, items: false, suppliers: false, users: false, roles: false } },
    { id: "pending", name: "Pending", perms: { read: false, move: false, items: false, suppliers: false, users: false, roles: false } },
  ];

  for (const r of base) {
    await setDoc(roleDocRef(r.id), {
      id: r.id,
      name: r.name,
      perms: r.perms,
      system: true,
      updatedAt: serverTimestamp(),
      updatedBy: u.uid,
    }, { merge: true });
  }
  return true;
}

export async function loadMyRoleDoc() {
  myRoleDoc = null;
  rolesCache = []; // compat: on mettra au moins le rôle courant ici

  const rid = roleId();
  if (!rid) return null;

  const snap = await getDoc(roleDocRef(rid));
  if (!snap.exists()) return null;

  myRoleDoc = snap.data() || { id: rid };
  if (!myRoleDoc.id) myRoleDoc.id = rid;

  rolesCache = [{ ...myRoleDoc, id: rid }];
  return myRoleDoc;
}

export async function loadAllRoles() {
  // lecture possible si règles autorisent read roles
  const snap = await getDocs(rolesColRef());
  const arr = [];
  snap.forEach(d => arr.push({ id: d.id, ...(d.data() || {}) }));
  // garde le rôle courant en tête si présent
  arr.sort((a,b)=> (a.id==="admin"?-1:0) - (b.id==="admin"?-1:0));
  rolesCache = arr;
  emit("roles:updated", { roles: rolesCache });
  return rolesCache;
}

// Logout buttons
btnLogout?.addEventListener("click", async () => { await signOut(auth); });
btnLogout2?.addEventListener("click", async () => { await signOut(auth); });

// ---------------- Auth state machine ----------------
onAuthStateChanged(auth, async (u) => {
  // reset
  userProfile = null;
  myRoleDoc = null;
  rolesCache = [];
  itemsCache = [];
  suppliersCache = [];

  if (!u) {
    roleLabel && (roleLabel.textContent = "—");
    roleIdLabel && (roleIdLabel.textContent = "—");
    authState && (authState.textContent = "Non connecté");
    btnLogout && (btnLogout.hidden = true);
    showView("login");
    emit("auth:signedOut");
    return;
  }
try {
  const res = await bootstrapRolesIfNeeded();
  console.log("[bootstrapRolesIfNeeded]", res);
} catch (e) {
  console.error("bootstrap roles failed", e);
}
  btnLogout && (btnLogout.hidden = false);
  setStatus(status, "Chargement…");

  try {
    await ensureMyProfile();
    userProfile = await loadMyProfile();

    roleLabel && (roleLabel.textContent = userProfile?.roleId || "—");
    roleIdLabel && (roleIdLabel.textContent = userProfile?.roleId || "—");
    authState && (authState.textContent =
      `Connecté : ${u.email || u.uid} — rôle: ${userProfile?.roleId || "?"}${userProfile?.approved ? "" : " (non validé)"}`
    );

    // bootstrap roles once (owner only)
    try { await bootstrapBaseRolesIfOwner(); } catch (_) {}

    // pending
    if (!userProfile?.approved || roleId() === "pending") {
      setStatus(status, "");
      showView("pending");
      pendingInfo && (pendingInfo.textContent = "En attente de validation par un administrateur.");
      emit("auth:pending", { user: u, profile: userProfile });
      return;
    }

    const role = await loadMyRoleDoc();
    if (!role) {
      setStatus(status, "");
      showView("pending");
      pendingInfo && (pendingInfo.textContent =
        `Rôle introuvable : "${roleId()}".\n➡️ Vérifie Firestore : roles/${roleId()}`
      );
      emit("auth:roleMissing", { user: u, profile: userProfile });
      return;
    }

    // load roles list in background for admin/users panels
    loadAllRoles().catch(()=>{});

    setStatus(status, "");
    showView("app");
    emit("auth:signedIn", { user: u, profile: userProfile, role });

  } catch (e) {
    console.error(e);
    setStatus(status, "Erreur de chargement. Regarde l’onglet Network (Firestore 403?).", true);
    showView("pending");
    pendingInfo && (pendingInfo.textContent = `Erreur : ${e?.message || e}`);
    emit("auth:error", { error: e });
  }
});

import {
  collection, getDocs, query, limit,
  doc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { db, auth, OWNER_UID } from "./core.js"; // adapte si nécessaire

export async function bootstrapRolesIfNeeded() {
  const u = auth.currentUser;
  if (!u) return { ok: false, reason: "not_signed_in" };
  if (!OWNER_UID || u.uid !== OWNER_UID) return { ok: false, reason: "not_owner" };

  // Si au moins 1 rôle existe, on considère que c’est déjà initialisé
  const rolesSnap = await getDocs(query(collection(db, "roles"), limit(1)));
  if (!rolesSnap.empty) return { ok: true, created: 0, reason: "already_initialized" };

  const baseRoles = [
    {
      id: "admin",
      name: "Admin",
      perms: { admin:true, read:true, move:true, items:true, suppliers:true, users:true, roles:true, orders:true }
    },
    {
      id: "stock",
      name: "Stock",
      perms: { read:true, move:true, items:false, suppliers:false, users:false, roles:false, orders:true }
    },
    {
      id: "visu",
      name: "Visu",
      perms: { read:true, move:false, items:false, suppliers:false, users:false, roles:false, orders:false }
    },
    {
      id: "pending",
      name: "En attente",
      perms: { read:false, move:false, items:false, suppliers:false, users:false, roles:false, orders:false }
    }
  ];

  for (const r of baseRoles) {
    await setDoc(doc(db, "roles", r.id), {
      id: r.id,
      name: r.name,
      perms: r.perms,
      system: true,
      updatedAt: serverTimestamp(),
      updatedBy: u.uid,
    }, { merge: true });
  }

  return { ok: true, created: baseRoles.length, reason: "initialized" };
}
