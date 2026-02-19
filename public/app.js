// Firebase (CDN, modular v10+)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
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
import {
  BrowserMultiFormatReader
} from "https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm";

/** 1) REMPLACE ICI PAR TA CONFIG FIREBASE (console Firebase > paramètres du projet) */
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

const email = $("email");
const password = $("password");
const btnLogin = $("btnLogin");
const btnSignup = $("btnSignup");
const btnAnon = $("btnAnon");

const btnScan = $("btnScan");
const btnStopScan = $("btnStopScan");
const scannerWrap = $("scannerWrap");
const video = $("video");

const barcode = $("barcode");
const name = $("name");
const btnAdd = $("btnAdd");
const btnRemove = $("btnRemove");
const btnLoad = $("btnLoad");

const status = $("status");
const itemBox = $("itemBox");
const moves = $("moves");

// Helpers
function setStatus(msg, isError = false) {
  status.textContent = msg || "";
  status.style.color = isError ? "#b00020" : "#333";
}
function requireAuth() {
  if (!auth.currentUser) {
    setStatus("Connecte-toi d’abord.", true);
    throw new Error("Not authenticated");
  }
}
function safeTrim(v) { return (v || "").trim(); }
function nowISO() { return new Date().toISOString(); }

// Firestore paths
function itemDocRef(code) {
  // docId = code barre pour simplicité
  return doc(db, "items", code);
}
function movesColRef() {
  return collection(db, "moves");
}

// Load item
async function loadItem(code) {
  setStatus("");
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

// Add / Remove transaction + movement log
async function moveQty(delta) {
  requireAuth();

  const code = safeTrim(barcode.value);
  const label = safeTrim(name.value);

  if (!code) {
    setStatus("Entre/scanne un code-barres.", true);
    return;
  }

  const uid = auth.currentUser.uid;

  await runTransaction(db, async (tx) => {
    const ref = itemDocRef(code);
    const snap = await tx.get(ref);
    const cur = snap.exists() ? (snap.data().qty ?? 0) : 0;
    const newQty = Math.max(0, cur + delta);

    tx.set(ref, {
      code,
      name: label || (snap.exists() ? (snap.data().name || "") : ""),
      qty: newQty,
      updatedAt: serverTimestamp(),
      updatedBy: uid
    }, { merge: true });
  });

  await addDoc(movesColRef(), {
    code,
    name: label || "",
    delta,
    uid,
    at: serverTimestamp(),
    clientAt: nowISO()
  });

  setStatus(delta > 0 ? "Ajout OK." : "Retrait OK.");
  await loadItem(code);
}

// Recent moves live
function startMovesListener() {
  const q = query(movesColRef(), orderBy("at", "desc"), limit(10));
  return onSnapshot(q, (snap) => {
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
          <div class="code">${m.code || "—"}</div>
          <div style="font-weight:800">${sign}${delta}</div>
        </div>
        <div class="meta">${m.name ? m.name + " — " : ""}${when}</div>
      `;
      moves.appendChild(el);
    });
  });
}
let unsubscribeMoves = null;

// Auth UI
btnLogin.addEventListener("click", async () => {
  try {
    setStatus("");
    await signInWithEmailAndPassword(auth, safeTrim(email.value), safeTrim(password.value));
  } catch (e) {
    setStatus(e.message, true);
  }
});
btnSignup.addEventListener("click", async () => {
  try {
    setStatus("");
    await createUserWithEmailAndPassword(auth, safeTrim(email.value), safeTrim(password.value));
  } catch (e) {
    setStatus(e.message, true);
  }
});
btnAnon.addEventListener("click", async () => {
  try {
    setStatus("");
    await signInAnonymously(auth);
  } catch (e) {
    setStatus(e.message, true);
  }
});
btnLogout.addEventListener("click", async () => {
  await signOut(auth);
});

// Scan (ZXing)
let codeReader = null;
let scanning = false;

async function startScan() {
  setStatus("");
  if (scanning) return;

  scannerWrap.hidden = false;
  btnStopScan.hidden = false;
  btnScan.disabled = true;

  codeReader = new BrowserMultiFormatReader();
  scanning = true;

  try {
    // camera arrière si possible
    const result = await codeReader.decodeOnceFromVideoDevice(null, video);
    const text = (result && result.getText) ? result.getText() : "";
    if (text) {
      barcode.value = text;
      setStatus("Scan OK: " + text);
      await loadItem(text);
    } else {
      setStatus("Scan annulé / non détecté.", true);
    }
  } catch (e) {
    setStatus("Erreur scan: " + e.message, true);
  } finally {
    stopScan();
  }
}

function stopScan() {
  scanning = false;
  btnScan.disabled = false;
  btnStopScan.hidden = true;
  scannerWrap.hidden = true;

  try {
    if (codeReader) codeReader.reset();
  } catch {}
  codeReader = null;

  // stop video tracks
  try {
    const stream = video.srcObject;
    if (stream && stream.getTracks) stream.getTracks().forEach(t => t.stop());
    video.srcObject = null;
  } catch {}
}

btnScan.addEventListener("click", startScan);
btnStopScan.addEventListener("click", stopScan);

// Item actions
btnAdd.addEventListener("click", () => moveQty(+1));
btnRemove.addEventListener("click", () => moveQty(-1));
btnLoad.addEventListener("click", async () => {
  try {
    const code = safeTrim(barcode.value);
    if (!code) return setStatus("Entre/scanne un code-barres.", true);
    await loadItem(code);
    setStatus("Article chargé.");
  } catch (e) {
    setStatus(e.message, true);
  }
});

// Auto-load when barcode changed
barcode.addEventListener("change", async () => {
  const code = safeTrim(barcode.value);
  if (code) await loadItem(code);
});

// Auth state listener
onAuthStateChanged(auth, (user) => {
  if (user) {
    authState.textContent = `Connecté : ${user.isAnonymous ? "anonyme" : user.email} (${user.uid.slice(0,6)}…)`;
    btnLogout.hidden = false;
    setStatus("Connecté.");

    if (unsubscribeMoves) unsubscribeMoves();
    unsubscribeMoves = startMovesListener();

  } else {
    authState.textContent = "Non connecté";
    btnLogout.hidden = true;
    setStatus("Déconnecté.");

    if (unsubscribeMoves) unsubscribeMoves();
    unsubscribeMoves = null;
    moves.innerHTML = "";
  }
});
