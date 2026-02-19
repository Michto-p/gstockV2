// Firebase (CDN, modular v10+)
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
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// ZXing (scan caméra, iPhone-friendly)
import { BrowserMultiFormatReader } from "https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm";

/** ✅ TA CONFIG (pas de REPLACE_ME) */
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

// UI refs
const $ = (id) => document.getElementById(id);

const authState = $("authState");
const btnLogout = $("btnLogout");

// views
const viewLogin = $("viewLogin");
const viewPending = $("viewPending");
const viewApp = $("viewApp");
const viewMoves = $("viewMoves");

const pendingInfo = $("pendingInfo");
const btnLogout2 = $("btnLogout2");

// login
const email = $("email");
const password = $("password");
const btnLogin = $("btnLogin");
const btnSignup = $("btnSignup");
const status = $("status"); // login status

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

// Helpers
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
  // view: "login" | "pending" | "app"
  viewLogin.hidden = (view !== "login");
  viewPending.hidden = (view !== "pending");
  viewApp.hidden = (view !== "app");
  viewMoves.hidden = (view !== "app");
}

// Firestore paths
function userDocRef(uid) { return doc(db, "users", uid); }
function itemDocRef(code) { return doc(db, "items", code); }
function movesColRef() { return collection(db, "moves"); }

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

// --- Stock UI helpers ---
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

  // TX: met à jour qty + champs autorisés "stock"
  await runTransaction(db, async (tx) => {
    const ref = itemDocRef(code);
    const snap = await tx.get(ref);

    // Si l'article n'existe pas:
    // - admin pourra le créer plus tard (V2)
    // - stock/visu ne doit pas créer
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

    // on garde aussi qtyAfter côté move
    tx.set(doc(movesColRef()), {}, { merge: true }); // no-op placeholder (ignored)
  });

  // log move (autorisé pour stock/admin)
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

// Recent moves live
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
    (err) => {
      // évite l'erreur "uncaught" si jamais permissions changent
      console.warn("Moves listener error:", err);
    }
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
    // mdp min 6 (Firebase)
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

// --- Scan (ZXing) ---
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

// App actions (role check inside moveQty)
let currentRole = "pending";

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

// --- Auth state routing + permissions gating ---
function stopAllListeners() {
  if (unsubscribeMoves) unsubscribeMoves();
  unsubscribeMoves = null;
  moves.innerHTML = "";
}

function setButtonsEnabled(canMove) {
  btnAdd.disabled = !canMove;
  btnRemove.disabled = !canMove;
}

onAuthStateChanged(auth, async (user) => {
  // stop listeners whenever auth changes
  stopAllListeners();

  if (!user) {
    currentRole = "pending";
    authState.textContent = "Non connecté";
    btnLogout.hidden = true;

    showView("login");
    setButtonsEnabled(false);
    setStatus(appStatus, "");
    setStatus(status, "");
    return;
  }

  btnLogout.hidden = false;
  authState.textContent = `Connecté : ${user.email}`;

  // assure profil (pending par défaut)
  await ensureMyPendingProfile();

  const profile = await getMyProfile();
  const approved = !!profile?.approved;
  const role = profile?.role || "pending";
  currentRole = role;

  authState.textContent = `Connecté : ${user.email} — rôle: ${role}${approved ? "" : " (non validé)"}`;

  if (!approved || role === "pending") {
    showView("pending");
    pendingInfo.textContent = "En attente de validation par un admin.";
    setButtonsEnabled(false);
    return;
  }

  // accès app
  showView("app");

  // droits UI
  const canMove = (role === "admin" || role === "stock");
  setButtonsEnabled(canMove);

  // listener moves (lecture autorisée pour admin/stock/visu validés)
  unsubscribeMoves = startMovesListener();
});
