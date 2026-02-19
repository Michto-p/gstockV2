import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  runTransaction,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  getDocs,
  where,
  updateDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { BrowserMultiFormatReader } from "https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm";

/** ✅ TA CONFIG */
const firebaseConfig = {
  apiKey: "AIzaSyCf39dzQgHBVao0TOTUqh1q2ytK7BhE9gc",
  authDomain: "gstock-27d16.firebaseapp.com",
  projectId: "gstock-27d16",
  storageBucket: "gstock-27d16.firebasestorage.app",
  messagingSenderId: "1038968834828",
  appId: "1:1038968834828:web:eeb2bb128c58622dda1729"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = (id) => document.getElementById(id);

// header
const authState = $("authState");
const btnLogout = $("btnLogout");

// views
const viewLogin = $("viewLogin");
const viewPending = $("viewPending");
const viewApp = $("viewApp");
const viewMoves = $("viewMoves");

// pending
const pendingInfo = $("pendingInfo");
const btnLogout2 = $("btnLogout2");

// login
const email = $("email");
const password = $("password");
const btnLogin = $("btnLogin");
const btnSignup = $("btnSignup");
const status = $("status");

// tabs
const tabBtnScan = $("tabBtnScan");
const tabBtnSettings = $("tabBtnSettings");
const tabScan = $("tabScan");
const tabSettings = $("tabSettings");

// app
const btnScan = $("btnScan");
const btnStopScan = $("btnStopScan");
const scannerWrap = $("scannerWrap");
const video = $("video");

const barcode = $("barcode");
const name = $("name");
const qtyDelta = $("qtyDelta");
const reason = $("reason");

const btnAdd = $("btnAdd");
const btnRemove = $("btnRemove");
const btnLoad = $("btnLoad");

const appStatus = $("appStatus");
const itemBox = $("itemBox");
const moves = $("moves");

// settings/admin
const roleLabel = $("roleLabel");
const adminPanel = $("adminPanel");
const btnRefreshPending = $("btnRefreshPending");
const adminStatus = $("adminStatus");
const pendingList = $("pendingList");

const chkConfirmClear = $("chkConfirmClear");
const txtConfirmClear = $("txtConfirmClear");
const btnClearStock = $("btnClearStock");

// helpers
function setStatus(el, msg, isError = false) {
  el.textContent = msg || "";
  el.style.color = isError ? "#b00020" : "#333";
}
function safeTrim(v) { return (v || "").trim(); }
function nowISO() { return new Date().toISOString(); }
function toInt(v, fallback = 1) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function showView(view) {
  viewLogin.hidden = (view !== "login");
  viewPending.hidden = (view !== "pending");
  viewApp.hidden = (view !== "app");
  viewMoves.hidden = (view !== "app");
}

function setActiveTab(tab) {
  const isScan = tab === "scan";
  tabBtnScan.classList.toggle("active", isScan);
  tabBtnSettings.classList.toggle("active", !isScan);
  tabScan.hidden = !isScan;
  tabSettings.hidden = isScan;
}

tabBtnScan.addEventListener("click", () => setActiveTab("scan"));
tabBtnSettings.addEventListener("click", () => setActiveTab("settings"));

// Firestore paths
function userDocRef(uid) { return doc(db, "users", uid); }
function itemsColRef() { return collection(db, "items"); }
function itemDocRef(code) { return doc(db, "items", code); }
function movesColRef() { return collection(db, "moves"); }
function usersColRef() { return collection(db, "users"); }

// --- Profile / Roles ---
async function ensureMyPendingProfile() {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  const ref = userDocRef(uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      email: auth.currentUser.email || "",
      role: "pending",
      approved: false,
      createdAt: serverTimestamp()
    }, { merge: true });
  }
}

async function getMyProfile() {
  if (!auth.currentUser) return null;
  const ref = userDocRef(auth.currentUser.uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

// --- Stock UI ---
async function loadItem(code) {
  setStatus(appStatus, "");
  itemBox.hidden = true;

  const snap = await getDoc(itemDocRef(code));
  if (!snap.exists()) {
    itemBox.hidden = false;
    itemBox.textContent = `Article inconnu : ${code} (qty = 0)`;
    return { code, name: "", qty: 0 };
  }
  const data = snap.data();
  itemBox.hidden = false;
  itemBox.innerHTML = `
    <div><b>Code:</b> ${code}</div>
    <div><b>Nom:</b> ${data.name || "—"}</div>
    <div><b>Quantité:</b> ${data.qty ?? 0}</div>
    <div style="color:#666;font-size:12px;margin-top:6px">
      MAJ: ${data.updatedAt?.toDate ? data.updatedAt.toDate().toLocaleString() : "—"}
    </div>
  `;
  return { code, ...data };
}

async function moveQty(delta, role) {
  if (!auth.currentUser) {
    setStatus(appStatus, "Connecte-toi d’abord.", true);
    return;
  }
  if (!(role === "admin" || role === "stock")) {
    setStatus(appStatus, "Droits insuffisants (lecture seule).", true);
    return;
  }

  const code = safeTrim(barcode.value);
  const label = safeTrim(name.value);
  const why = safeTrim(reason.value);
  const absQty = Math.abs(delta);

  if (!code) {
    setStatus(appStatus, "Entre/scanne un code-barres.", true);
    return;
  }

  const uid = auth.currentUser.uid;

  await runTransaction(db, async (tx) => {
    const ref = itemDocRef(code);
    const snap = await tx.get(ref);

    if (!snap.exists()) {
      throw new Error("Article inconnu (création réservée admin).");
    }

    const cur = snap.data().qty ?? 0;
    const newQty = Math.max(0, cur + delta);

    tx.set(ref, {
      barcode: code,
      qty: newQty,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
      lastMoveAt: serverTimestamp()
    }, { merge: true });
  });

  await addDoc(movesColRef(), {
    barcode: code,
    name: label || "",
    delta,
    absQty,
    reason: why || "",
    uid,
    at: serverTimestamp(),
    clientAt: nowISO()
  });

  setStatus(appStatus, (delta > 0 ? "Ajout OK." : "Retrait OK."));
  await loadItem(code);
}

function startMovesListener() {
  const q = query(movesColRef(), orderBy("at", "desc"), limit(10));
  return onSnapshot(
    q,
    (snap) => {
      moves.innerHTML = "";
      snap.forEach((docu) => {
        const m = docu.data();
        const delta = m.delta ?? 0;
        const sign = delta > 0 ? "+" : "";
        const when = m.at?.toDate ? m.at.toDate().toLocaleString() : (m.clientAt || "");
        const el = document.createElement("div");
        el.className = "move";
        el.innerHTML = `
          <div class="top">
            <div class="code">${m.barcode || "—"}</div>
            <div style="font-weight:800">${sign}${delta}</div>
          </div>
          <div class="meta">${m.reason ? m.reason + " — " : ""}${when}</div>
        `;
        moves.appendChild(el);
      });
    },
    (err) => console.warn("Moves listener error:", err)
  );
}

let unsubscribeMoves = null;

// --- Auth UI ---
btnLogin.addEventListener("click", async () => {
  try {
    setStatus(status, "");
    await signInWithEmailAndPassword(auth, safeTrim(email.value), safeTrim(password.value));
  } catch (e) {
    setStatus(status, e.message, true);
  }
});

btnSignup.addEventListener("click", async () => {
  try {
    setStatus(status, "");
    const pass = safeTrim(password.value);
    if (pass.length < 6) {
      setStatus(status, "Mot de passe : 6 caractères minimum.", true);
      return;
    }
    await createUserWithEmailAndPassword(auth, safeTrim(email.value), pass);
    await ensureMyPendingProfile();
    setStatus(status, "Compte créé. En attente de validation admin.");
  } catch (e) {
    setStatus(status, e.message, true);
  }
});

btnLogout.addEventListener("click", async () => {
  await signOut(auth);
});
btnLogout2.addEventListener("click", async () => {
  await signOut(auth);
});

// --- Scan ---
let codeReader = null;
let scanning = false;

async function startScan() {
  setStatus(appStatus, "");
  if (scanning) return;

  scannerWrap.hidden = false;
  btnStopScan.hidden = false;
  btnScan.disabled = true;

  codeReader = new BrowserMultiFormatReader();
  scanning = true;

  try {
    const result = await codeReader.decodeOnceFromVideoDevice(null, video);
    const text = (result && result.getText) ? result.getText() : "";
    if (text) {
      barcode.value = text;
      setStatus(appStatus, "Scan OK: " + text);
      await loadItem(text);
    } else {
      setStatus(appStatus, "Scan annulé / non détecté.", true);
    }
  } catch (e) {
    setStatus(appStatus, "Erreur scan: " + e.message, true);
  } finally {
    stopScan();
  }
}

function stopScan() {
  scanning = false;
  btnScan.disabled = false;
  btnStopScan.hidden = true;
  scannerWrap.hidden = true;

  try { if (codeReader) codeReader.reset(); } catch {}
  codeReader = null;

  try {
    const stream = video.srcObject;
    if (stream && stream.getTracks) stream.getTracks().forEach(t => t.stop());
    video.srcObject = null;
  } catch {}
}

btnScan.addEventListener("click", startScan);
btnStopScan.addEventListener("click", stopScan);

// role state
let currentRole = "pending";

// actions
btnAdd.addEventListener("click", async () => {
  const n = toInt(qtyDelta.value, 1);
  await moveQty(+n, currentRole);
});
btnRemove.addEventListener("click", async () => {
  const n = toInt(qtyDelta.value, 1);
  await moveQty(-n, currentRole);
});
btnLoad.addEventListener("click", async () => {
  try {
    const code = safeTrim(barcode.value);
    if (!code) return setStatus(appStatus, "Entre/scanne un code-barres.", true);
    await loadItem(code);
    setStatus(appStatus, "Article chargé.");
  } catch (e) {
    setStatus(appStatus, e.message, true);
  }
});
barcode.addEventListener("change", async () => {
  const code = safeTrim(barcode.value);
  if (code) await loadItem(code);
});

function stopAllListeners() {
  if (unsubscribeMoves) unsubscribeMoves();
  unsubscribeMoves = null;
  moves.innerHTML = "";
}

function setButtonsEnabled(canMove) {
  btnAdd.disabled = !canMove;
  btnRemove.disabled = !canMove;
}

// -------------------- ADMIN --------------------
function isAdminRole() { return currentRole === "admin"; }

async function refreshPendingUsers() {
  if (!isAdminRole()) return;
  setStatus(adminStatus, "Chargement...");
  pendingList.innerHTML = "";

  try {
    const q = query(usersColRef(), where("approved", "==", false));
    const snap = await getDocs(q);

    if (snap.empty) {
      setStatus(adminStatus, "Aucun compte en attente.");
      return;
    }

    setStatus(adminStatus, `${snap.size} compte(s) en attente.`);

    snap.forEach((d) => {
      const u = d.data();
      const uid = d.id;
      const mail = u.email || "(sans email)";
      const created = u.createdAt?.toDate ? u.createdAt.toDate().toLocaleString() : "";

      const row = document.createElement("div");
      row.className = "userRow";
      row.innerHTML = `
        <div class="top">
          <div class="email">${mail}</div>
          <div style="font-weight:800;color:#666;font-size:12px">${uid.slice(0,6)}…</div>
        </div>
        <div class="meta">Créé : ${created || "—"} — rôle actuel: ${u.role || "pending"}</div>
        <div class="actions">
          <button class="ghost" data-act="approve-stock">Valider en STOCK</button>
          <button class="ghost" data-act="approve-visu">Valider en VISU</button>
          <button class="danger" data-act="reject">Refuser (supprimer)</button>
        </div>
      `;

      row.addEventListener("click", async (ev) => {
        const btn = ev.target?.closest("button");
        if (!btn) return;

        const act = btn.getAttribute("data-act");
        try {
          if (act === "approve-stock") {
            await updateDoc(userDocRef(uid), {
              approved: true,
              role: "stock",
              approvedAt: serverTimestamp(),
              approvedBy: auth.currentUser?.uid || ""
            });
            setStatus(adminStatus, `Validé STOCK : ${mail}`);
          }
          if (act === "approve-visu") {
            await updateDoc(userDocRef(uid), {
              approved: true,
              role: "visu",
              approvedAt: serverTimestamp(),
              approvedBy: auth.currentUser?.uid || ""
            });
            setStatus(adminStatus, `Validé VISU : ${mail}`);
          }
          if (act === "reject") {
            // supprime le doc user (l'auth user restera dans Authentication,
            // mais il ne pourra pas accéder à l'app sans profil validé)
            await updateDoc(userDocRef(uid), { role: "rejected", approved: false });
            setStatus(adminStatus, `Refusé : ${mail} (profil marqué rejected)`);
          }
          await refreshPendingUsers();
        } catch (e) {
          setStatus(adminStatus, e.message, true);
        }
      });

      pendingList.appendChild(row);
    });
  } catch (e) {
    setStatus(adminStatus, e.message, true);
  }
}

btnRefreshPending.addEventListener("click", refreshPendingUsers);

async function clearStockQtyToZero() {
  if (!isAdminRole()) {
    setStatus(adminStatus, "Admin uniquement.", true);
    return;
  }
  if (!chkConfirmClear.checked || safeTrim(txtConfirmClear.value).toUpperCase() !== "VIDER") {
    setStatus(adminStatus, "Confirmation invalide (case + texte 'VIDER').", true);
    return;
  }

  const ok = confirm("Dernière confirmation : mettre toutes les quantités (qty) à 0 ?");
  if (!ok) return;

  setStatus(adminStatus, "Vidage du stock en cours...");

  try {
    // Firestore batch: 500 writes max, donc on boucle
    let last = null;
    let total = 0;

    while (true) {
      // on récupère par pages
      let q = query(itemsColRef(), orderBy("barcode"), limit(400));
      if (last) {
        // pas de startAfter importé pour rester minimal => on fait simple:
        // on stop ici si trop gros. (option : on ajoute startAfter si tu veux)
      }

      const snap = await getDocs(q);
      if (snap.empty) break;

      const batch = writeBatch(db);
      snap.forEach((d) => {
        batch.update(d.ref, {
          qty: 0,
          updatedAt: serverTimestamp(),
          updatedBy: auth.currentUser?.uid || "",
          lastMoveAt: serverTimestamp()
        });
        total++;
      });

      await batch.commit();

      // Si ta base dépasse 400 items, on fera V2.1 avec startAfter.
      break;
    }

    setStatus(adminStatus, `Stock vidé : ${total} article(s) mis à 0.`);
    chkConfirmClear.checked = false;
    txtConfirmClear.value = "";
  } catch (e) {
    setStatus(adminStatus, e.message, true);
  }
}

btnClearStock.addEventListener("click", clearStockQtyToZero);

// --- Auth state routing + permissions gating ---
onAuthStateChanged(auth, async (user) => {
  stopAllListeners();
  setButtonsEnabled(false);
  adminPanel.hidden = true;
  roleLabel.textContent = "—";
  setStatus(adminStatus, "");
  pendingList.innerHTML = "";

  if (!user) {
    currentRole = "pending";
    authState.textContent = "Non connecté";
    btnLogout.hidden = true;
    showView("login");
    setActiveTab("scan");
    setStatus(status, "");
    setStatus(appStatus, "");
    return;
  }

  btnLogout.hidden = false;
  authState.textContent = `Connecté : ${user.email}`;

  await ensureMyPendingProfile();

  const profile = await getMyProfile();
  const approved = !!profile?.approved;
  const role = profile?.role || "pending";
  currentRole = role;

  authState.textContent = `Connecté : ${user.email} — rôle: ${role}${approved ? "" : " (non validé)"}`;
  roleLabel.textContent = role;

  if (!approved || role === "pending") {
    showView("pending");
    pendingInfo.textContent = "En attente de validation par un admin.";
    return;
  }

  // accès app
  showView("app");
  setActiveTab("scan");

  // droits UI
  const canMove = (role === "admin" || role === "stock");
  setButtonsEnabled(canMove);

  // admin panel
  if (role === "admin") {
    adminPanel.hidden = false;
    await refreshPendingUsers();
  } else {
    adminPanel.hidden = true;
  }

  // listener moves (lecture autorisée pour admin/stock/visu validés)
  unsubscribeMoves = startMovesListener();
});
