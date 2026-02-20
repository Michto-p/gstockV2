// public/js/core.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  doc, getDoc, setDoc, updateDoc,
  collection, getDocs, query, limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/**
 * ✅ OWNER_UID : colle ici TON UID (Firebase Console → Authentication → Users)
 * - te met admin + approved automatiquement
 * - autorise le bootstrap des rôles de base si roles est vide
 */
export const OWNER_UID = "pxEjO8xAUxQcrwEILjwxi9OlFp82";

/**
 * ✅ Firebase config
 * (garde tes valeurs actuelles)
 */
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

// -------------------- DOM helpers --------------------
export const $ = (id) => document.getElementById(id);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// Vues (adaptées à ta base : si un id n’existe pas, ça ne casse pas)
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

// -------------------- App events (communication modules) --------------------
export const AppEvents = new EventTarget();
export function emit(name, detail) {
  AppEvents.dispatchEvent(new CustomEvent(name, { detail }));
}

// -------------------- Global state --------------------
export let userProfile = null;      // doc users/{uid}
export let myRoleDoc = null;        // doc roles/{roleId}
export let rolesCache = [];
export let itemsCache = [];
export let suppliersCache = [];

// -------------------- Small utils --------------------
export function setStatus(el, msg, isError = false) {
  if (!el) return;
  el.textContent = msg || "";
  el.style.color = isError ? "#b00020" : "#3a3a3a";
}
export function safeTrim(v) { return (v ?? "").toString().trim(); }
export function toInt(v, def = 0) {
  const n = parseInt((v ?? "").toString(), 10);
  return Number.isFinite(n) ? n : def;
}
export function clampInt(v, min, max, def = 0) {
  const n = toInt(v, def);
  return Math.min(max, Math.max(min, n));
}
export function escapeHtml(s) {
  return (s ?? "").toString()
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
export function nowISO() { return new Date().toISOString(); }

// ✅ export attendu par items.js (et utile partout)
export function normalizeThresholds(item) {
  if (!item || typeof item !== "object") return item;

  const out = { ...item };

  // Quantité
  if ("qty" in out) out.qty = Math.max(0, toInt(out.qty, 0));

  // Seuil principal : accepte plusieurs noms possibles (robuste)
  const keys = ["threshold", "seuil", "min", "reorderPoint", "alertThreshold"];
  for (const k of keys) {
    if (k in out) out[k] = Math.max(0, toInt(out[k], 0));
  }

  // Seuils par emplacement/zone (objet)
  if (out.thresholds && typeof out.thresholds === "object") {
    const t = { ...out.thresholds };
    for (const k of Object.keys(t)) t[k] = Math.max(0, toInt(t[k], 0));
    out.thresholds = t;
  }

  return out;
}

// -------------------- Views --------------------
export function showView(which) {
  if (viewLogin) viewLogin.hidden = which !== "login";
  if (viewPending) viewPending.hidden = which !== "pending";
  if (viewApp) viewApp.hidden = which !== "app";
}

// -------------------- Firestore refs --------------------
export const rolesColRef = () => collection(db, "roles");
export const roleDocRef = (id) => doc(db, "roles", id);

export const usersColRef = () => collection(db, "users");
export const userDocRef = (uid) => doc(db, "users", uid);

export const itemsColRef = () => collection(db, "items");
export const itemDocRef = (barcode) => doc(db, "items", barcode);

export const suppliersColRef = () => collection(db, "suppliers");
export const supplierDocRef = (id) => doc(db, "suppliers", id);

export const movesColRef = () => collection(db, "moves");

// -------------------- Permissions --------------------
export function approved() { return !!userProfile?.approved; }
export function getPerms() { return myRoleDoc?.perms || myRoleDoc?.permissions || {}; } // tolère 2 schémas
export function canRead() { return approved() && !!getPerms().read; }
export function canMove() { return approved() && !!getPerms().move; }
export function canManageItems() { return approved() && !!getPerms().items; }
export function canManageSuppliers() { return approved() && !!getPerms().suppliers; }
export function canManageUsers() { return approved() && !!getPerms().users; }
export function canManageRoles() { return approved() && !!getPerms().roles; }
export function isAdmin() {
  const p = getPerms();
  return approved() && (userProfile?.roleId === "admin" || !!p.admin);
}

// -------------------- Profile + Role bootstrap --------------------
function normalizeRoleId(roleVal) {
  const raw = safeTrim(roleVal).toLowerCase();
  if (!raw) return "pending";
  // alias historiques
  if (raw === "administrator" || raw === "administrateur") return "admin";
  if (raw === "admin") return "admin";
  if (raw === "stock") return "stock";
  if (raw === "visu" || raw === "viewer" || raw === "lecture") return "visu";
  if (raw === "pending" || raw === "attente") return "pending";
  return raw; // fallback
}

export async function ensureMyProfile() {
  const u = auth.currentUser;
  if (!u) return null;

  const ref = userDocRef(u.uid);
  const snap = await getDoc(ref);

  const isOwner = (OWNER_UID && u.uid === OWNER_UID);

  // 1) create if missing
  if (!snap.exists()) {
    const docData = {
      uid: u.uid,
      email: u.email || "",
      displayName: u.displayName || "",
      roleId: isOwner ? "admin" : "pending",
      approved: isOwner ? true : false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, docData, { merge: true });
    return docData;
  }

  // 2) migrate / secure
  const data = snap.data() || {};
  const updates = {};

  if (!data.roleId && data.role) updates.roleId = normalizeRoleId(data.role);

  // Owner safety net
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

  // if roles already exist -> stop
  const s = await getDocs(query(rolesColRef(), limit(1)));
  if (!s.empty) return true;

  const base = [
    { id: "admin", name: "Admin", perms: { admin: true, read: true, move: true, items: true, suppliers: true, users: true, roles: true, orders: true, import: true, labels: true } },
    { id: "stock", name: "Stock", perms: { read: true, move: true, items: false, suppliers: false, users: false, roles: false, orders: true } },
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

export async function loadMyRole() {
  myRoleDoc = null;
  const rid = userProfile?.roleId;
  if (!rid) return null;

  const snap = await getDoc(roleDocRef(rid));
  if (!snap.exists()) return null;

  myRoleDoc = snap.data() || { id: rid };
  // assure id
  if (!myRoleDoc.id) myRoleDoc.id = rid;
  return myRoleDoc;
}

// -------------------- Logout --------------------
btnLogout?.addEventListener("click", async () => { await signOut(auth); });
btnLogout2?.addEventListener("click", async () => { await signOut(auth); });

// -------------------- Auth state machine --------------------
onAuthStateChanged(auth, async (u) => {
  // reset state
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

  btnLogout && (btnLogout.hidden = false);
  setStatus(status, "Chargement…");

  try {
    // 1) ensure profile + migrate
    await ensureMyProfile();
    userProfile = await loadMyProfile();

    roleLabel && (roleLabel.textContent = userProfile?.roleId || "—");
    roleIdLabel && (roleIdLabel.textContent = userProfile?.roleId || "—");
    authState && (authState.textContent =
      `Connecté : ${u.email || u.uid} — rôle: ${userProfile?.roleId || "?"}${userProfile?.approved ? "" : " (non validé)"}`
    );

    // 2) owner bootstrap roles
    try { await bootstrapBaseRolesIfOwner(); } catch (_) {}

    // 3) pending ?
    if (!userProfile?.approved || userProfile?.roleId === "pending") {
      setStatus(status, "");
      showView("pending");
      pendingInfo && (pendingInfo.textContent = "En attente de validation par un admin.");
      emit("auth:pending", { user: u, profile: userProfile });
      return;
    }

    // 4) load role
    const role = await loadMyRole();

    // role missing -> show explicit message (no blank screen)
    if (!role) {
      setStatus(status, "");
      showView("pending");
      pendingInfo && (pendingInfo.textContent =
        `Rôle introuvable : "${userProfile?.roleId}".\n` +
        `➡️ Vérifie Firestore : roles/${userProfile?.roleId}`
      );
      emit("auth:roleMissing", { user: u, profile: userProfile });
      return;
    }

    // 5) success
    setStatus(status, "");
    showView("app");
    emit("auth:signedIn", { user: u, profile: userProfile, role });

  } catch (e) {
    console.error(e);
    setStatus(status, "Erreur de chargement (profil/rôle). Ouvre la console Network (Firestore 403 ?).", true);
    showView("pending");
    pendingInfo && (pendingInfo.textContent = `Erreur : ${e?.message || e}`);
    emit("auth:error", { error: e });
  }
});
