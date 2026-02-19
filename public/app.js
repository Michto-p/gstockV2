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
  writeBatch,
  startAfter,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { BrowserMultiFormatReader } from "https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm";
import Papa from "https://cdn.jsdelivr.net/npm/papaparse@5.4.1/+esm";
import JsBarcode from "https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/+esm";

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
const tabBtnDash = $("tabBtnDash");
const tabBtnScan = $("tabBtnScan");
const tabBtnStock = $("tabBtnStock");
const tabBtnSettings = $("tabBtnSettings");
const tabDash = $("tabDash");
const tabScan = $("tabScan");
const tabStock = $("tabStock");
const tabSettings = $("tabSettings");

// dashboard
const kpiCrit = $("kpiCrit");
const kpiLow = $("kpiLow");
const kpiOk = $("kpiOk");
const dashSearch = $("dashSearch");
const btnDashGoStock = $("btnDashGoStock");
const dashCriticalList = $("dashCriticalList");
const dashCriticalHint = $("dashCriticalHint");

// moves
const moves = $("moves");

// scan
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

// stock
const stockSearch = $("stockSearch");
const stockFilter = $("stockFilter");
const btnNewItem = $("btnNewItem");
const btnPrintSelected = $("btnPrintSelected");
const stockTableBody = $("stockTableBody");
const stockCards = $("stockCards");
const stockHint = $("stockHint");
const stockStatus = $("stockStatus");

// editor
const edBarcode = $("edBarcode");
const edName = $("edName");
const edUnit = $("edUnit");
const edLocation = $("edLocation");
const edLow = $("edLow");
const edCritical = $("edCritical");
const edTags = $("edTags");
const btnSaveItem = $("btnSaveItem");
const btnDeleteItem = $("btnDeleteItem");
const btnPrintOne = $("btnPrintOne");

// settings/admin
const roleLabel = $("roleLabel");
const importPanel = $("importPanel");
const btnDownloadCsvTemplate = $("btnDownloadCsvTemplate");
const csvFile = $("csvFile");
const chkImportMerge = $("chkImportMerge");
const btnImportCsv = $("btnImportCsv");
const importStatus = $("importStatus");

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
function toInt(v, fallback = 0) {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
}
function clampMin(n, min) { return n < min ? min : n; }

// views/tabs
function showView(view) {
  viewLogin.hidden = (view !== "login");
  viewPending.hidden = (view !== "pending");
  viewApp.hidden = (view !== "app");
}
function setActiveTab(tab) {
  const map = { dash: tabDash, scan: tabScan, stock: tabStock, settings: tabSettings };
  Object.entries(map).forEach(([k, el]) => el.hidden = (k !== tab));

  tabBtnDash.classList.toggle("active", tab === "dash");
  tabBtnScan.classList.toggle("active", tab === "scan");
  tabBtnStock.classList.toggle("active", tab === "stock");
  tabBtnSettings.classList.toggle("active", tab === "settings");
}
tabBtnDash.addEventListener("click", () => setActiveTab("dash"));
tabBtnScan.addEventListener("click", () => setActiveTab("scan"));
tabBtnStock.addEventListener("click", () => setActiveTab("stock"));
tabBtnSettings.addEventListener("click", () => setActiveTab("settings"));
btnDashGoStock.addEventListener("click", () => setActiveTab("stock"));

// Firestore paths
function userDocRef(uid) { return doc(db, "users", uid); }
function usersColRef() { return collection(db, "users"); }
function itemsColRef() { return collection(db, "items"); }
function itemDocRef(code) { return doc(db, "items", code); }
function movesColRef() { return collection(db, "moves"); }

// roles state
let currentRole = "pending";
let currentApproved = false;

function isAdmin() { return currentRole === "admin"; }
function canMoveStock() { return currentRole === "admin" || currentRole === "stock"; }

// --- Profile ---
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

// --- Threshold status ---
function normalizeThresholds(item) {
  const low = toInt(item?.thresholds?.low, 5);
  const critical = toInt(item?.thresholds?.critical, 2);
  return { low: Math.max(0, low), critical: Math.max(0, critical) };
}
function itemStatus(item) {
  const qty = toInt(item?.qty, 0);
  const { low, critical } = normalizeThresholds(item);
  if (qty <= critical) return "crit";
  if (qty <= low) return "low";
  return "ok";
}
function badgeHTML(st) {
  if (st === "crit") return `<span class="badge crit">CRIT</span>`;
  if (st === "low") return `<span class="badge low">BAS</span>`;
  return `<span class="badge ok">OK</span>`;
}

// --- Cache ---
let itemsCache = [];              // {id, ...data}
let selectedItemId = null;
let selectedForLabels = new Set(); // ids

// --- Moves listener ---
let unsubscribeMoves = null;
function startMovesListener() {
  const q = query(movesColRef(), orderBy("at", "desc"), limit(12));
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

// --- Items listener ---
let unsubscribeItems = null;
function startItemsListener() {
  const q = query(itemsColRef(), orderBy("name"), limit(1500));
  return onSnapshot(
    q,
    (snap) => {
      itemsCache = [];
      snap.forEach((d) => itemsCache.push({ id: d.id, ...d.data() }));
      renderDashboard();
      renderStockList();

      // refresh editor
      if (selectedItemId) {
        const it = itemsCache.find(x => x.id === selectedItemId);
        if (it) fillEditor(it);
      }
    },
    (err) => console.warn("Items listener error:", err)
  );
}

// --- Dashboard ---
function renderDashboard() {
  const q = safeTrim(dashSearch.value).toLowerCase();
  const filtered = itemsCache.filter(it => {
    const hay = `${it.name || ""} ${it.barcode || it.id || ""} ${(it.tags || []).join(" ")}`.toLowerCase();
    return !q || hay.includes(q);
  });

  let cCrit = 0, cLow = 0, cOk = 0;
  const criticalItems = [];

  for (const it of filtered) {
    const st = itemStatus(it);
    if (st === "crit") { cCrit++; criticalItems.push(it); }
    else if (st === "low") cLow++;
    else cOk++;
  }

  kpiCrit.textContent = String(cCrit);
  kpiLow.textContent = String(cLow);
  kpiOk.textContent = String(cOk);

  dashCriticalList.innerHTML = "";
  if (criticalItems.length === 0) {
    dashCriticalHint.textContent = "Aucun article en critique 🎉";
    return;
  }

  dashCriticalHint.textContent = `${criticalItems.length} article(s) en critique.`;
  criticalItems
    .sort((a, b) => toInt(a.qty, 0) - toInt(b.qty, 0))
    .slice(0, 12)
    .forEach((it) => {
      const st = itemStatus(it);
      const { low, critical } = normalizeThresholds(it);
      const row = document.createElement("div");
      row.className = "userRow";
      row.innerHTML = `
        <div class="top">
          <div class="email">${it.name || "(sans nom)"}</div>
          ${badgeHTML(st)}
        </div>
        <div class="meta">
          Code: ${it.barcode || it.id} — Qty: <b>${toInt(it.qty, 0)}</b>
          — Bas: ${low} — Crit: ${critical}
        </div>
        <div class="actions">
          <button class="ghost">Ouvrir dans Stock</button>
        </div>
      `;
      row.querySelector("button").addEventListener("click", () => {
        setActiveTab("stock");
        selectItem(it.id);
      });
      dashCriticalList.appendChild(row);
    });
}
dashSearch.addEventListener("input", renderDashboard);

// --- Stock list + selection ---
function matchesStockFilter(it) {
  const f = stockFilter.value;
  if (f === "all") return true;
  return itemStatus(it) === f;
}
function matchesStockSearch(it) {
  const q = safeTrim(stockSearch.value).toLowerCase();
  if (!q) return true;
  const hay = `${it.name || ""} ${it.barcode || it.id || ""} ${(it.tags || []).join(" ")}`.toLowerCase();
  return hay.includes(q);
}

function renderStockList() {
  const list = itemsCache.filter(it => matchesStockFilter(it) && matchesStockSearch(it));
  stockHint.textContent = `${list.length} article(s)`;

  // Table
  stockTableBody.innerHTML = "";
  list.forEach((it) => {
    const st = itemStatus(it);
    const { low, critical } = normalizeThresholds(it);

    const checked = selectedForLabels.has(it.id) ? "checked" : "";
    const tr = document.createElement("tr");
    tr.className = "stockRow";
    tr.innerHTML = `
      <td><input type="checkbox" data-sel="1" ${checked}></td>
      <td>${badgeHTML(st)}</td>
      <td>${it.name || "(sans nom)"}</td>
      <td>${it.barcode || it.id}</td>
      <td class="num"><b>${toInt(it.qty, 0)}</b></td>
      <td class="num">${low}</td>
      <td class="num">${critical}</td>
    `;
    tr.addEventListener("click", (ev) => {
      // évite sélection si click sur checkbox
      const cb = ev.target?.closest('input[type="checkbox"]');
      if (cb) return;
      selectItem(it.id);
    });
    tr.querySelector('input[type="checkbox"]').addEventListener("change", (ev) => {
      ev.stopPropagation();
      if (ev.target.checked) selectedForLabels.add(it.id);
      else selectedForLabels.delete(it.id);
    });

    stockTableBody.appendChild(tr);
  });

  // Cards (mobile)
  stockCards.innerHTML = "";
  list.forEach((it) => {
    const st = itemStatus(it);
    const { low, critical } = normalizeThresholds(it);
    const div = document.createElement("div");
    div.className = "stockCard";
    div.innerHTML = `
      <div class="top">
        <div class="name">${it.name || "(sans nom)"}</div>
        ${badgeHTML(st)}
      </div>
      <div class="meta">
        Code: ${it.barcode || it.id} — Qty: <b>${toInt(it.qty, 0)}</b><br/>
        Bas: ${low} — Crit: ${critical}
      </div>
      <div class="row" style="margin-top:8px">
        <label class="checkRow" style="margin:0">
          <input type="checkbox" ${selectedForLabels.has(it.id) ? "checked":""}> Sélection étiquette
        </label>
      </div>
    `;
    div.addEventListener("click", () => selectItem(it.id));
    div.querySelector('input[type="checkbox"]').addEventListener("click", (ev) => ev.stopPropagation());
    div.querySelector('input[type="checkbox"]').addEventListener("change", (ev) => {
      if (ev.target.checked) selectedForLabels.add(it.id);
      else selectedForLabels.delete(it.id);
    });
    stockCards.appendChild(div);
  });
}

stockSearch.addEventListener("input", renderStockList);
stockFilter.addEventListener("change", renderStockList);

function setEditorEnabled(enabled) {
  [edBarcode, edName, edUnit, edLocation, edLow, edCritical, edTags].forEach(el => el.disabled = !enabled);
  btnSaveItem.disabled = !enabled;
  btnDeleteItem.disabled = !enabled;
}
function clearEditor() {
  selectedItemId = null;
  edBarcode.value = "";
  edName.value = "";
  edUnit.value = "";
  edLocation.value = "";
  edLow.value = "5";
  edCritical.value = "2";
  edTags.value = "";
  setStatus(stockStatus, "");
  edBarcode.disabled = !isAdmin();
}
function fillEditor(it) {
  const { low, critical } = normalizeThresholds(it);
  edBarcode.value = it.barcode || it.id || "";
  edName.value = it.name || "";
  edUnit.value = it.unit || "";
  edLocation.value = it.location || "";
  edLow.value = String(low);
  edCritical.value = String(critical);
  edTags.value = Array.isArray(it.tags) ? it.tags.join(", ") : "";
  setStatus(stockStatus, "");

  setEditorEnabled(isAdmin());
  edBarcode.disabled = true; // locked for existing
}
function selectItem(id) {
  selectedItemId = id;
  const it = itemsCache.find(x => x.id === id);
  if (it) fillEditor(it);
}

btnNewItem.addEventListener("click", () => {
  if (!isAdmin()) return setStatus(stockStatus, "Admin uniquement.", true);
  clearEditor();
  setEditorEnabled(true);
  edBarcode.disabled = false;
  setStatus(stockStatus, "Création : renseigne le code + nom puis Enregistrer.");
});

btnSaveItem.addEventListener("click", async () => {
  if (!isAdmin()) return setStatus(stockStatus, "Admin uniquement.", true);

  const code = safeTrim(edBarcode.value);
  const nm = safeTrim(edName.value);
  if (!code) return setStatus(stockStatus, "Code-barres obligatoire.", true);
  if (!nm) return setStatus(stockStatus, "Nom obligatoire.", true);

  const unit = safeTrim(edUnit.value);
  const location = safeTrim(edLocation.value);
  const low = Math.max(0, toInt(edLow.value, 5));
  const critical = Math.max(0, toInt(edCritical.value, 2));

  const tags = safeTrim(edTags.value)
    .split(/[,|]/g)
    .map(s => s.trim())
    .filter(Boolean);

  try {
    const ref = itemDocRef(code);
    const snap = await getDoc(ref);
    const isNew = !snap.exists();

    await setDoc(ref, {
      barcode: code,
      name: nm,
      unit,
      location,
      tags,
      thresholds: { low, critical },
      ...(isNew ? { qty: 0 } : {}),
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser?.uid || ""
    }, { merge: true });

    setStatus(stockStatus, isNew ? "Article créé." : "Article mis à jour.");
    selectedItemId = code;
    edBarcode.disabled = true;
  } catch (e) {
    setStatus(stockStatus, e.message, true);
  }
});

btnDeleteItem.addEventListener("click", async () => {
  if (!isAdmin()) return setStatus(stockStatus, "Admin uniquement.", true);
  const code = safeTrim(edBarcode.value);
  if (!code) return setStatus(stockStatus, "Sélectionne un article.", true);
  const ok = confirm(`Supprimer l'article ${code} ? (irréversible)`);
  if (!ok) return;
  try {
    await deleteDoc(itemDocRef(code));
    setStatus(stockStatus, "Article supprimé.");
    clearEditor();
  } catch (e) {
    setStatus(stockStatus, e.message, true);
  }
});

// --- Scan / Moves ---
async function loadItem(code) {
  setStatus(appStatus, "");
  itemBox.hidden = true;

  const snap = await getDoc(itemDocRef(code));
  if (!snap.exists()) {
    itemBox.hidden = false;
    itemBox.textContent = `Article inconnu : ${code} (création admin via Stock)`;
    return null;
  }

  const data = snap.data();
  const st = itemStatus(data);
  const { low, critical } = normalizeThresholds(data);

  itemBox.hidden = false;
  itemBox.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:center">
      <div><b>${data.name || "(sans nom)"}</b></div>
      ${badgeHTML(st)}
    </div>
    <div style="margin-top:6px"><b>Code:</b> ${code}</div>
    <div><b>Quantité:</b> ${data.qty ?? 0}</div>
    <div style="color:#666;font-size:12px;margin-top:6px">
      Bas: ${low} — Crit: ${critical}
    </div>
  `;
  return { id: snap.id, ...data };
}

async function moveQty(delta) {
  if (!auth.currentUser) return setStatus(appStatus, "Connecte-toi d’abord.", true);
  if (!canMoveStock()) return setStatus(appStatus, "Droits insuffisants (lecture seule).", true);

  const code = safeTrim(barcode.value);
  const label = safeTrim(name.value);
  const why = safeTrim(reason.value);
  const n = Math.abs(delta);

  if (!code) return setStatus(appStatus, "Entre/scanne un code-barres.", true);

  const uid = auth.currentUser.uid;

  try {
    await runTransaction(db, async (tx) => {
      const ref = itemDocRef(code);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("Article inconnu (création admin via Stock).");

      const cur = snap.data().qty ?? 0;
      const newQty = clampMin(cur + delta, 0);

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
      absQty: n,
      reason: why || "",
      uid,
      at: serverTimestamp(),
      clientAt: nowISO()
    });

    setStatus(appStatus, delta > 0 ? "Ajout OK." : "Retrait OK.");
    await loadItem(code);
  } catch (e) {
    setStatus(appStatus, e.message, true);
  }
}

btnAdd.addEventListener("click", async () => {
  const n = Math.max(1, toInt(qtyDelta.value, 1));
  await moveQty(+n);
});
btnRemove.addEventListener("click", async () => {
  const n = Math.max(1, toInt(qtyDelta.value, 1));
  await moveQty(-n);
});
btnLoad.addEventListener("click", async () => {
  const code = safeTrim(barcode.value);
  if (!code) return setStatus(appStatus, "Entre/scanne un code-barres.", true);
  await loadItem(code);
});
barcode.addEventListener("change", async () => {
  const code = safeTrim(barcode.value);
  if (code) await loadItem(code);
});

// --- Scan (camera) ---
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
    if (pass.length < 6) return setStatus(status, "Mot de passe : 6 caractères minimum.", true);
    await createUserWithEmailAndPassword(auth, safeTrim(email.value), pass);
    await ensureMyPendingProfile();
    setStatus(status, "Compte créé. En attente de validation admin.");
  } catch (e) {
    setStatus(status, e.message, true);
  }
});
btnLogout.addEventListener("click", async () => { await signOut(auth); });
btnLogout2.addEventListener("click", async () => { await signOut(auth); });

// --- Admin: pending validation + clear stock ---
async function refreshPendingUsers() {
  if (!isAdmin()) return;
  setStatus(adminStatus, "Chargement...");
  pendingList.innerHTML = "";

  try {
    const q = query(usersColRef(), where("approved", "==", false));
    const snap = await getDocs(q);

    if (snap.empty) {
      setStatus(adminStatus, "Aucun compte en attente.");
      return;
    }

    setStatus(adminStatus, `${snap.size} compte(s) non approuvé(s).`);

    snap.forEach((d) => {
      const u = d.data();
      const uid = d.id;
      const mail = u.email || "(sans email)";
      const role = u.role || "pending";

      const row = document.createElement("div");
      row.className = "userRow";
      row.innerHTML = `
        <div class="top">
          <div class="email">${mail}</div>
          <div style="font-weight:800;color:#666;font-size:12px">${uid.slice(0,6)}…</div>
        </div>
        <div class="meta">Rôle actuel: ${role} — approved: ${u.approved === true}</div>
        <div class="actions">
          <button class="ghost" data-act="approve-stock">Valider STOCK</button>
          <button class="ghost" data-act="approve-visu">Valider VISU</button>
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
          } else if (act === "approve-visu") {
            await updateDoc(userDocRef(uid), {
              approved: true,
              role: "visu",
              approvedAt: serverTimestamp(),
              approvedBy: auth.currentUser?.uid || ""
            });
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
  if (!isAdmin()) return setStatus(adminStatus, "Admin uniquement.", true);

  if (!chkConfirmClear.checked || safeTrim(txtConfirmClear.value).toUpperCase() !== "VIDER") {
    return setStatus(adminStatus, "Confirmation invalide (case + texte 'VIDER').", true);
  }
  const ok = confirm("Dernière confirmation : mettre TOUTES les quantités (qty) à 0 ?");
  if (!ok) return;

  setStatus(adminStatus, "Vidage du stock en cours...");

  try {
    let lastDoc = null;
    let total = 0;

    while (true) {
      let q = query(itemsColRef(), orderBy("barcode"), limit(450));
      if (lastDoc) q = query(itemsColRef(), orderBy("barcode"), startAfter(lastDoc), limit(450));

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

      lastDoc = snap.docs[snap.docs.length - 1];
      if (snap.size < 450) break;
    }

    setStatus(adminStatus, `Stock vidé : ${total} article(s) mis à 0.`);
    chkConfirmClear.checked = false;
    txtConfirmClear.value = "";
  } catch (e) {
    setStatus(adminStatus, e.message, true);
  }
}
btnClearStock.addEventListener("click", clearStockQtyToZero);

// --- IMPORT CSV (ADMIN) ---
function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

btnDownloadCsvTemplate.addEventListener("click", () => {
  const sample =
`barcode;name;qty;unit;location;low;critical;tags
3560071234567;Gaine ICTA 20;12;boite;Armoire 1;5;2;consommable|atelier
3700000000000;Disjoncteur 16A;6;pcs;Rayon DJ;3;1;protection|schneider
`;
  downloadTextFile("gstock_template.csv", sample);
});

function parseCsv(text) {
  // auto delimiter guess
  const firstLine = (text.split(/\r?\n/).find(l => l.trim().length) || "");
  const semis = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const delimiter = semis >= commas ? ";" : ",";

  const res = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    delimiter
  });

  if (res.errors?.length) {
    const msg = res.errors[0]?.message || "Erreur CSV";
    throw new Error("CSV: " + msg);
  }
  return res.data;
}

function normalizeRow(r) {
  const barcode = safeTrim(r.barcode || r.code || r.id);
  const name = safeTrim(r.name || r.nom);
  const qty = toInt(r.qty ?? r.quantite ?? 0, 0);
  const unit = safeTrim(r.unit || r.unite || "");
  const location = safeTrim(r.location || r.emplacement || "");
  const low = Math.max(0, toInt(r.low ?? r.seuilbas ?? 5, 5));
  const critical = Math.max(0, toInt(r.critical ?? r.seuilcritique ?? 2, 2));

  const rawTags = safeTrim(r.tags || "");
  const tags = rawTags
    ? rawTags.split(/[|,]/g).map(s => s.trim()).filter(Boolean)
    : [];

  if (!barcode) return null;
  return { barcode, name, qty, unit, location, low, critical, tags };
}

async function importRows(rows, merge = true) {
  if (!isAdmin()) throw new Error("Admin uniquement.");

  // Firestore batch: max 500 writes => on fait 450 safe
  const CHUNK = 450;
  let total = 0;

  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = writeBatch(db);
    const slice = rows.slice(i, i + CHUNK);

    for (const r of slice) {
      const ref = itemDocRef(r.barcode);
      const payload = {
        barcode: r.barcode,
        name: r.name || "(à compléter)",
        qty: Math.max(0, r.qty),
        unit: r.unit,
        location: r.location,
        tags: r.tags,
        thresholds: { low: r.low, critical: r.critical },
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid || ""
      };

      if (merge) batch.set(ref, payload, { merge: true });
      else batch.set(ref, payload); // overwrite
      total++;
    }

    await batch.commit();
  }

  return total;
}

btnImportCsv.addEventListener("click", async () => {
  if (!isAdmin()) return setStatus(importStatus, "Admin uniquement.", true);
  if (!csvFile.files?.length) return setStatus(importStatus, "Choisis un fichier CSV.", true);

  setStatus(importStatus, "Lecture du fichier...");
  try {
    const file = csvFile.files[0];
    const text = await file.text();
    const parsed = parseCsv(text);
    const rows = parsed.map(normalizeRow).filter(Boolean);

    if (!rows.length) return setStatus(importStatus, "Aucune ligne valide.", true);

    setStatus(importStatus, `Import en cours (${rows.length} lignes)...`);
    const total = await importRows(rows, chkImportMerge.checked);
    setStatus(importStatus, `Import terminé ✅ (${total} lignes écrites).`);

    csvFile.value = "";
  } catch (e) {
    setStatus(importStatus, e.message, true);
  }
});

// --- ÉTIQUETTES / CODES BARRES ---
function makeBarcodeSvg(value) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  // EAN13 si 13 chiffres, sinon CODE128
  const isEan13 = /^\d{13}$/.test(value);
  JsBarcode(svg, value, {
    format: isEan13 ? "EAN13" : "CODE128",
    displayValue: false,
    margin: 0,
    width: 2,
    height: 48
  });
  return svg.outerHTML;
}

function buildLabelsHtml(items) {
  const css = `
    <style>
      body { margin: 0; font-family: Arial, sans-serif; }
      .page { padding: 10mm; }
      .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6mm; }
      .label {
        border: 1px solid #000;
        padding: 3mm;
        height: 35mm;
        overflow: hidden;
        display: grid;
        grid-template-rows: auto 1fr auto;
        gap: 2mm;
      }
      .name { font-weight: 800; font-size: 11pt; line-height: 1.1; }
      .meta { font-size: 9pt; color: #111; }
      .barcode { display:flex; justify-content:center; }
      .code { font-size: 9pt; text-align:center; font-weight:700; letter-spacing: .5px; }
      @media print {
        .noPrint { display:none; }
      }
    </style>
  `;

  const labels = items.map(it => {
    const code = it.barcode || it.id;
    const nm = it.name || "(sans nom)";
    const loc = it.location ? `📍 ${it.location}` : "";
    return `
      <div class="label">
        <div class="name">${escapeHtml(nm)}</div>
        <div class="barcode">${makeBarcodeSvg(code)}</div>
        <div>
          <div class="code">${escapeHtml(code)}</div>
          <div class="meta">${escapeHtml(loc)}</div>
        </div>
      </div>
    `;
  }).join("");

  return `<!doctype html><html><head><meta charset="utf-8"/>${css}</head>
  <body>
    <div class="page">
      <div class="noPrint" style="margin-bottom:10px">
        <button onclick="window.print()">Imprimer</button>
        <button onclick="window.close()">Fermer</button>
      </div>
      <div class="grid">${labels}</div>
    </div>
  </body></html>`;
}

function openPrintWindow(html) {
  const w = window.open("", "_blank");
  if (!w) return alert("Pop-up bloquée. Autorise les pop-ups pour imprimer.");
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

btnPrintOne.addEventListener("click", () => {
  const code = safeTrim(edBarcode.value);
  if (!code) return setStatus(stockStatus, "Sélectionne un article.", true);
  const it = itemsCache.find(x => (x.barcode || x.id) === code);
  const item = it || { id: code, barcode: code, name: safeTrim(edName.value), location: safeTrim(edLocation.value) };
  openPrintWindow(buildLabelsHtml([item]));
});

btnPrintSelected.addEventListener("click", () => {
  const ids = Array.from(selectedForLabels);
  if (!ids.length) return setStatus(stockStatus, "Sélectionne des articles (cases).", true);
  const items = ids.map(id => itemsCache.find(x => x.id === id)).filter(Boolean);
  if (!items.length) return setStatus(stockStatus, "Sélection invalide.", true);
  openPrintWindow(buildLabelsHtml(items));
});

// --- Auth state + gating ---
function stopAllListeners() {
  if (unsubscribeMoves) unsubscribeMoves();
  unsubscribeMoves = null;
  if (unsubscribeItems) unsubscribeItems();
  unsubscribeItems = null;

  moves.innerHTML = "";
  itemsCache = [];
  selectedForLabels.clear();
}

function applyRoleUI() {
  roleLabel.textContent = currentRole;

  // scan
  btnAdd.disabled = !canMoveStock();
  btnRemove.disabled = !canMoveStock();

  // stock editor
  const admin = isAdmin();
  btnNewItem.disabled = !admin;
  btnSaveItem.disabled = !admin;
  btnDeleteItem.disabled = !admin;
  [edBarcode, edName, edUnit, edLocation, edLow, edCritical, edTags].forEach(el => el.disabled = !admin);
  if (!admin) edBarcode.disabled = true;

  // settings panels
  adminPanel.hidden = !admin;
  importPanel.hidden = !admin;
}

onAuthStateChanged(auth, async (user) => {
  stopAllListeners();

  setStatus(status, "");
  setStatus(appStatus, "");
  setStatus(adminStatus, "");
  setStatus(importStatus, "");
  pendingList.innerHTML = "";
  dashCriticalList.innerHTML = "";
  dashCriticalHint.textContent = "";
  stockTableBody.innerHTML = "";
  stockCards.innerHTML = "";
  stockHint.textContent = "";
  clearEditor();

  currentRole = "pending";
  currentApproved = false;
  applyRoleUI();

  if (!user) {
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

  authState.textContent = `Connecté : ${user.email} — rôle: ${currentRole}${currentApproved ? "" : " (non validé)"}`;
  applyRoleUI();

  if (!currentApproved || currentRole === "pending") {
    showView("pending");
    pendingInfo.textContent = "En attente de validation par un admin.";
    return;
  }

  showView("app");
  setActiveTab("dash");

  // admin: refresh pending
  if (isAdmin()) await refreshPendingUsers();

  // listeners
  unsubscribeItems = startItemsListener();
  unsubscribeMoves = startMovesListener();
});

// --- Logout
btnLogout.addEventListener("click", async () => { await signOut(auth); });
btnLogout2.addEventListener("click", async () => { await signOut(auth); });

// --- Login/Signup
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
    if (pass.length < 6) return setStatus(status, "Mot de passe : 6 caractères minimum.", true);
    await createUserWithEmailAndPassword(auth, safeTrim(email.value), pass);
    await ensureMyPendingProfile();
    setStatus(status, "Compte créé. En attente de validation admin.");
  } catch (e) {
    setStatus(status, e.message, true);
  }
});

// --- Scan actions
btnLoad.addEventListener("click", async () => {
  const code = safeTrim(barcode.value);
  if (!code) return setStatus(appStatus, "Entre/scanne un code-barres.", true);
  await loadItem(code);
});
btnAdd.addEventListener("click", async () => {
  const n = Math.max(1, toInt(qtyDelta.value, 1));
  await moveQty(+n);
});
btnRemove.addEventListener("click", async () => {
  const n = Math.max(1, toInt(qtyDelta.value, 1));
  await moveQty(-n);
});
barcode.addEventListener("change", async () => {
  const code = safeTrim(barcode.value);
  if (code) await loadItem(code);
});

// --- Camera scan
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
