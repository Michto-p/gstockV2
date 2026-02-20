import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  doc, getDoc, setDoc, updateDoc,
  collection, getDocs, query, limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/**
 * ✅ IMPORTANT
 * Mets ici TON UID (Firebase Console → Authentication → Users)
 * Ça permet de :
 * - te mettre admin/approved automatiquement
 * - bootstrap les rôles si la collection roles est vide
 */
export const OWNER_UID = "COLLE_ICI_TON_UID";

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

export const $ = (id) => document.getElementById(id);

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
export function emit(name, detail) { AppEvents.dispatchEvent(new CustomEvent(name, { detail })); }

export let itemsCache = [];
export let suppliersCache = [];
export let rolesCache = [];        // contiendra au minimum TON rôle chargé
export let userProfile = null;

export function setStatus(el, msg, isError = false) {
  if (!el) return;
  el.textContent = msg || "";
  el.style.color = isError ? "#b00020" : "#3a3a3a";
}

export function safeTrim(v) { return (v ?? "").toString().trim(); }
export function nowISO() { return new Date().toISOString(); }
export function toInt(v, def = 0) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : def; }
export function escapeHtml(s) {
  return (s ?? "").toString()
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

export function showView(which) {
  if (viewLogin) viewLogin.hidden = which !== "login";
  if (viewPending) viewPending.hidden = which !== "pending";
  if (viewApp) viewApp.hidden = which !== "app";
}

// ---- refs
export function rolesColRef() { return collection(db, "roles"); }
export function roleDocRef(id) { return doc(db, "roles", id); }
export function usersColRef() { return collection(db, "users"); }
export function userDocRef(uid) { return doc(db, "users", uid); }
export function itemsColRef() { return collection(db, "items"); }
export function itemDocRef(barcode) { return doc(db, "items", barcode); }
export function suppliersColRef() { return collection(db, "suppliers"); }
export function supplierDocRef(id) { return doc(db, "suppliers", id); }
export function movesColRef() { return collection(db, "moves"); }

// ---- permissions helpers
export function getMyRoleDoc() {
  const rid = userProfile?.roleId;
  if (!rid) return null;
  return rolesCache.find(r => r.id === rid) || null;
}
export function approved() { return !!userProfile?.approved; }
export function canRead() { return approved() && !!getMyRoleDoc()?.perms?.read; }
export function canMove() { return approved() && !!getMyRoleDoc()?.perms?.move; }
export function canManageItems() { return approved() && !!getMyRoleDoc()?.perms?.items; }
export function canManageSuppliers() { return approved() && !!getMyRoleDoc()?.perms?.suppliers; }
export function canManageUsers() { return approved() && !!getMyRoleDoc()?.perms?.users; }
export function canManageRoles() { return approved() && !!getMyRoleDoc()?.perms?.roles; }
export function isAdmin() {
  const r = getMyRoleDoc();
  return approved() && (userProfile?.roleId === "admin" || !!r?.perms?.admin);
}

// ---- AUTO: créer / migrer profil user
export async function ensureMyProfile() {
  if (!auth.currentUser) return;
  const u = auth.currentUser;
  const uid = u.uid;
  const ref = userDocRef(uid);
  const snap = await getDoc(ref);

  // mapping si tu avais des anciens noms
  const normalizeRoleId = (roleVal) => {
    const raw = safeTrim(roleVal).toLowerCase();
    if (!raw) return "pending";
    if (raw === "administrator" || raw === "administrateur") return "admin";
    if (raw === "admin") return "admin";
    if (raw === "stock") return "stock";
    if (raw === "visu" || raw === "viewer" || raw === "lecture") return "visu";
    if (raw === "pending" || raw === "attente") return "pending";
    return raw;
  };

  // Si aucun doc : on le crée automatiquement
  if (!snap.exists()) {
    const isOwner = (OWNER_UID && uid === OWNER_UID);

    await setDoc(ref, {
      uid,
      email: u.email || "",
      displayName: u.displayName || "",
      // Owner = auto admin + auto approved
      roleId: isOwner ? "admin" : "pending",
      approved: isOwner ? true : false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });

    return;
  }

  // Migration auto : role -> roleId
  const data = snap.data() || {};
  const updates = {};

  if (!data.roleId && data.role) {
    updates.roleId = normalizeRoleId(data.role);
  }

  // Sécurité : owner toujours admin/approved
  if (OWNER_UID && uid === OWNER_UID) {
    if (data.roleId !== "admin") updates.roleId = "admin";
    if (data.approved !== true) updates.approved = true;
  }

  if (Object.keys(updates).length) {
    updates.updatedAt = serverTimestamp();
    await updateDoc(ref, updates);
  }
}

export async function loadMyProfile() {
  if (!auth.currentUser) return null;
  const ref = userDocRef(auth.currentUser.uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

// ---- AUTO: bootstrap rôles (si vide) — uniquement OWNER
export async function bootstrapBaseRolesIfOwner() {
  if (!auth.currentUser) return false;
  if (!OWNER_UID || auth.currentUser.uid !== OWNER_UID) return false;

  // check rapide si roles vide
  const q = query(rolesColRef(), limit(1));
  const s = await getDocs(q);
  if (!s.empty) return true;

  const base = [
    { id: "admin", name: "Admin", perms: { admin: true, read: true, move: true, items: true, suppliers: true, users: true, roles: true } },
    { id: "stock", name: "Stock", perms: { read: true, move: true, items: false, suppliers: false, users: false, roles: false } },
    { id: "visu",  name: "Visu",  perms: { read: true, move: false, items: false, suppliers: false, users: false, roles: false } },
    { id: "pending", name: "Pending", perms: { read: false, move: false, items: false, suppliers: false, users: false, roles: false } }
  ];

  for (const r of base) {
    await setDoc(roleDocRef(r.id), {
      id: r.id,
      name: r.name,
      perms: r.perms,
      system: true,
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser.uid
    }, { merge: true });
  }
  return true;
}

export async function loadMyRoleDoc() {
  rolesCache = [];
  const rid = userProfile?.roleId;
  if (!rid) return null;

  const snap = await getDoc(roleDocRef(rid));
  if (!snap.exists()) return null;

  const role = snap.data();
  rolesCache = [{ ...role, id: rid }];
  return role;
}

// ---- logout
btnLogout?.addEventListener("click", async () => { await signOut(auth); });
btnLogout2?.addEventListener("click", async () => { await signOut(auth); });

// ---- auth state
onAuthStateChanged(auth, async (user) => {
  itemsCache = []; suppliersCache = []; rolesCache = []; userProfile = null;

  if (!user) {
    roleLabel && (roleLabel.textContent = "—");
    roleIdLabel && (roleIdLabel.textContent = "—");
    authState && (authState.textContent = "Non connecté");
    btnLogout && (btnLogout.hidden = true);
    showView("login");
    emit("auth:signedOut");
    return;
  }

  btnLogout && (btnLogout.hidden = false);
  setStatus(status, "Chargement profil…");

  // 1) profil auto + migration
  await ensureMyProfile();
  userProfile = await loadMyProfile();

  roleLabel && (roleLabel.textContent = userProfile?.roleId || "—");
  roleIdLabel && (roleIdLabel.textContent = userProfile?.roleId || "—");
  authState && (authState.textContent = `Connecté : ${user.email} — rôle: ${userProfile?.roleId || "?"}${userProfile?.approved ? "" : " (non validé)"}`);

  // 2) bootstrap roles si owner
  try { await bootstrapBaseRolesIfOwner(); } catch (e) {}

  // 3) charger le doc rôle (pour que tabs/permissions fonctionnent)
  const roleDoc = await loadMyRoleDoc();

  // Si non validé -> pending
  if (!userProfile?.approved || userProfile?.roleId === "pending") {
    showView("pending");
    pendingInfo && (pendingInfo.textContent = "En attente de validation par un admin.");
    emit("auth:pending", { user, profile: userProfile });
    return;
  }

  // Si validé mais rôle introuvable -> message clair (évite écran vide)
  if (!roleDoc) {
    showView("pending");
    pendingInfo && (pendingInfo.textContent =
      `Rôle introuvable: "${userProfile?.roleId}".\n` +
      `➡️ Vérifie Firestore: roles/${userProfile?.roleId}.\n` +
      (OWNER_UID && user.uid === OWNER_UID ? "OWNER: ouvre l’app puis va sur l’onglet Rôles (après init) ou relance." : "")
    );
    emit("auth:roleMissing", { user, profile: userProfile });
    return;
  }

  setStatus(status, "");
  showView("app");
  emit("auth:signedIn", { user, profile: userProfile, role: roleDoc });
});
