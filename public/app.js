import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updatePassword
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
const btnTogglePw = $("btnTogglePw");
const btnForgotPw = $("btnForgotPw");

// tabs
const tabBtnDash = $("tabBtnDash");
const tabBtnScan = $("tabBtnScan");
const tabBtnStock = $("tabBtnStock");
const tabBtnLabels = $("tabBtnLabels");
const tabBtnSettings = $("tabBtnSettings");

const tabDash = $("tabDash");
const tabScan = $("tabScan");
const tabStock = $("tabStock");
const tabLabels = $("tabLabels");
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

// settings/admin/import
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

// password settings panel
const newPassword = $("newPassword");
const newPassword2 = $("newPassword2");
const btnChangePw = $("btnChangePw");
const pwStatus = $("pwStatus");

// labels settings UI (print sheet settings)
const labelPreset = $("labelPreset");
const btnSaveLabelSettings = $("btnSaveLabelSettings");
const btnResetLabelSettings = $("btnResetLabelSettings");
const labelStatus = $("labelStatus");

const lblMarginMm = $("lblMarginMm");
const lblCols = $("lblCols");
const lblWmm = $("lblWmm");
const lblHmm = $("lblHmm");
const lblGapXmm = $("lblGapXmm");
const lblGapYmm = $("lblGapYmm");
const lblNamePt = $("lblNamePt");
const lblCodePt = $("lblCodePt");
const lblBarHmm = $("lblBarHmm");
const lblBarWidthPx = $("lblBarWidthPx");
const lblShowLocation = $("lblShowLocation");
const lblShowQty = $("lblShowQty");
const lblShowBorder = $("lblShowBorder");

// labels tab UI (left list)
const labelsSearch = $("labelsSearch");
const btnLabelsSelectAll = $("btnLabelsSelectAll");
const btnLabelsClear = $("btnLabelsClear");
const btnLabelsPrint = $("btnLabelsPrint");
const labelsHint = $("labelsHint");
const labelsList = $("labelsList");
const labelsSelCount = $("labelsSelCount");
const labelsTotalCount = $("labelsTotalCount");
const labelsPreviewBorder = $("labelsPreviewBorder");

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
  const map = { dash: tabDash, scan: tabScan, stock: tabStock, labels: tabLabels, settings: tabSettings };
  Object.entries(map).forEach(([k, el]) => el.hidden = (k !== tab));

  tabBtnDash.classList.toggle("active", tab === "dash");
  tabBtnScan.classList.toggle("active", tab === "scan");
  tabBtnStock.classList.toggle("active", tab === "stock");
  tabBtnLabels.classList.toggle("active", tab === "labels");
  tabBtnSettings.classList.toggle("active", tab === "settings");
}
tabBtnDash.addEventListener("click", () => setActiveTab("dash"));
tabBtnScan.addEventListener("click", () => setActiveTab("scan"));
tabBtnStock.addEventListener("click", () => setActiveTab("stock"));
tabBtnLabels.addEventListener("click", () => setActiveTab("labels"));
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
let itemsCache = [];               // {id, ...data}
let selectedItemId = null;

// selection for labels (ids)
let selectedForLabels = new Set();
// qty of labels per item id
const labelQtyById = new Map(); // id -> number

// ------------------- LABEL SETTINGS (print sheet) -------------------
const LABEL_SETTINGS_KEY = "gstock_label_settings_v1";

const LABEL_PRESETS = {
  custom: null,
  averyL7160: { marginMm: 10, cols: 3, wMm: 63.5, hMm: 38.1, gapXmm: 2.5, gapYmm: 0, namePt: 10.5, codePt: 9, barHmm: 16, barWidthPx: 2 },
  averyL7163: { marginMm: 10, cols: 2, wMm: 99.1, hMm: 38.1, gapXmm: 2.5, gapYmm: 0, namePt: 11, codePt: 9.5, barHmm: 16, barWidthPx: 2 },
  averyL7651: { marginMm: 8, cols: 3, wMm: 63.5, hMm: 33.9, gapXmm: 2.5, gapYmm: 0, namePt: 10, codePt: 9, barHmm: 14, barWidthPx: 2 },
  generic3x8: { marginMm: 8, cols: 3, wMm: 70, hMm: 35, gapXmm: 2, gapYmm: 2, namePt: 10.5, codePt: 9, barHmm: 15, barWidthPx: 2 }
};

function defaultLabelSettings() {
  return {
    preset: "averyL7160",
    marginMm: 10,
    cols: 3,
    wMm: 63.5,
    hMm: 38.1,
    gapXmm: 2.5,
    gapYmm: 0,
    namePt: 10.5,
    codePt: 9,
    barHmm: 16,
    barWidthPx: 2,
    showLocation: true,
    showQty: false,
    showBorder: false
  };
}
function readLabelSettings() {
  try {
    const raw = localStorage.getItem(LABEL_SETTINGS_KEY);
    if (!raw) return defaultLabelSettings();
    const s = JSON.parse(raw);
    return { ...defaultLabelSettings(), ...s };
  } catch {
    return defaultLabelSettings();
  }
}
function writeLabelSettings(s) {
  localStorage.setItem(LABEL_SETTINGS_KEY, JSON.stringify(s));
}
function uiToLabelSettings() {
  return {
    preset: labelPreset?.value || "custom",
    marginMm: Number(lblMarginMm.value) || 0,
    cols: Math.max(1, parseInt(lblCols.value || "3", 10)),
    wMm: Number(lblWmm.value) || 63.5,
    hMm: Number(lblHmm.value) || 38.1,
    gapXmm: Number(lblGapXmm.value) || 0,
    gapYmm: Number(lblGapYmm.value) || 0,
    namePt: Number(lblNamePt.value) || 10,
    codePt: Number(lblCodePt.value) || 9,
    barHmm: Number(lblBarHmm.value) || 16,
    barWidthPx: Math.max(1, parseInt(lblBarWidthPx.value || "2", 10)),
    showLocation: !!lblShowLocation.checked,
    showQty: !!lblShowQty.checked,
    showBorder: !!lblShowBorder.checked
  };
}
function applyLabelSettingsToUI(s) {
  labelPreset.value = s.preset || "custom";
  lblMarginMm.value = String(s.marginMm);
  lblCols.value = String(s.cols);
  lblWmm.value = String(s.wMm);
  lblHmm.value = String(s.hMm);
  lblGapXmm.value = String(s.gapXmm);
  lblGapYmm.value = String(s.gapYmm);
  lblNamePt.value = String(s.namePt);
  lblCodePt.value = String(s.codePt);
  lblBarHmm.value = String(s.barHmm);
  lblBarWidthPx.value = String(s.barWidthPx);
  lblShowLocation.checked = !!s.showLocation;
  lblShowQty.checked = !!s.showQty;
  lblShowBorder.checked = !!s.showBorder;
}
function applyPreset(presetKey) {
  const base = readLabelSettings();
  const p = LABEL_PRESETS[presetKey];
  if (!p) return;
  const next = { ...base, preset: presetKey, ...p };
  applyLabelSettingsToUI(next);
  writeLabelSettings(next);
  setStatus(labelStatus, "Preset appliqué.");
}

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
  const q = query(itemsColRef(), orderBy("name"), limit(2000));
  return onSnapshot(
    q,
    (snap) => {
      itemsCache = [];
      snap.forEach((d) => itemsCache.push({ id: d.id, ...d.data() }));
      renderDashboard();
      renderStockList();
      renderLabelsTab();

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
          <button class="ghost" type="button">Ouvrir dans Stock</button>
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

// --- Stock list ---
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

  // Table (PC)
  stockTableBody.innerHTML = "";
  list.forEach((it) => {
    const st = itemStatus(it);
    const { low, critical } = normalizeThresholds(it);
    const checked = selectedForLabels.has(it.id) ? "checked" : "";

    const tr = document.createElement("tr");
    tr.className = "stockRow";
    tr.innerHTML = `
      <td><input type="checkbox" ${checked}></td>
      <td>${badgeHTML(st)}</td>
      <td>${it.name || "(sans nom)"}</td>
      <td>${it.barcode || it.id}</td>
      <td class="num"><b>${toInt(it.qty, 0)}</b></td>
      <td class="num">${low}</td>
      <td class="num">${critical}</td>
    `;

    tr.addEventListener("click", (ev) => {
      const cb = ev.target?.closest('input[type="checkbox"]');
      if (cb) return;
      selectItem(it.id);
    });

    tr.querySelector('input[type="checkbox"]').addEventListener("change", (ev) => {
      ev.stopPropagation();
      if (ev.target.checked) selectedForLabels.add(it.id);
      else selectedForLabels.delete(it.id);
      renderLabelsTab();
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
      renderLabelsTab();
    });

    stockCards.appendChild(div);
  });
}
stockSearch.addEventListener("input", renderStockList);
stockFilter.addEventListener("change", renderStockList);

// --- Editor ---
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

    // default label qty for new item
    if (!labelQtyById.has(code)) labelQtyById.set(code, 1);
    renderLabelsTab();
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
    selectedForLabels.delete(code);
    labelQtyById.delete(code);
    clearEditor();
    renderLabelsTab();
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

// --- Camera scan (ZXing) ---
let codeReaderZX = null;
let scanning = false;

async function startScan() {
  setStatus(appStatus, "");
  if (scanning) return;

  scannerWrap.hidden = false;
  btnStopScan.hidden = false;
  btnScan.disabled = true;

  codeReaderZX = new BrowserMultiFormatReader();
  scanning = true;

  try {
    const result = await codeReaderZX.decodeOnceFromVideoDevice(null, video);
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

  try { if (codeReaderZX) codeReaderZX.reset(); } catch {}
  codeReaderZX = null;

  try {
    const stream = video.srcObject;
    if (stream && stream.getTracks) stream.getTracks().forEach(t => t.stop());
    video.srcObject = null;
  } catch {}
}

btnScan.addEventListener("click", startScan);
btnStopScan.addEventListener("click", stopScan);

// --- Auth UI ---
btnTogglePw.addEventListener("click", () => {
  const isPw = password.type === "password";
  password.type = isPw ? "text" : "password";
  btnTogglePw.textContent = isPw ? "Masquer" : "Afficher";
});

btnForgotPw.addEventListener("click", async () => {
  try {
    const mail = safeTrim(email.value);
    if (!mail) return setStatus(status, "Entre ton email puis clique 'Mot de passe oublié'.", true);
    await sendPasswordResetEmail(auth, mail);
    setStatus(status, "Email de réinitialisation envoyé ✅ (vérifie tes spams).");
  } catch (e) {
    setStatus(status, e.message, true);
  }
});

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

btnChangePw.addEventListener("click", async () => {
  try {
    if (!auth.currentUser) return setStatus(pwStatus, "Connecte-toi d’abord.", true);

    const p1 = safeTrim(newPassword.value);
    const p2 = safeTrim(newPassword2.value);
    if (p1.length < 6) return setStatus(pwStatus, "6 caractères minimum.", true);
    if (p1 !== p2) return setStatus(pwStatus, "Les mots de passe ne correspondent pas.", true);

    await updatePassword(auth.currentUser, p1);
    newPassword.value = "";
    newPassword2.value = "";
    setStatus(pwStatus, "Mot de passe changé ✅");
  } catch (e) {
    setStatus(pwStatus, e.message, true);
  }
});

// --- Admin: pending + clear stock ---
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
          <button class="ghost" type="button" data-act="approve-stock">Valider STOCK</button>
          <button class="ghost" type="button" data-act="approve-visu">Valider VISU</button>
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
DISJLGDX16;Disjoncteur Legrand DX 16A;12;pcs;Armoire 1;5;2;protection|legrand
3560071234567;Gaine ICTA 20;6;boite;Armoire 2;5;2;consommable|atelier
`;
  downloadTextFile("gstock_template.csv", sample);
});
function parseCsv(text) {
  const firstLine = (text.split(/\r?\n/).find(l => l.trim().length) || "");
  const semis = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const delimiter = semis >= commas ? ";" : ",";

  const res = Papa.parse(text, { header: true, skipEmptyLines: true, delimiter });
  if (res.errors?.length) throw new Error("CSV: " + (res.errors[0]?.message || "Erreur"));
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
  const tags = rawTags ? rawTags.split(/[|,]/g).map(s => s.trim()).filter(Boolean) : [];

  if (!barcode) return null;
  return { barcode, name, qty, unit, location, low, critical, tags };
};

async function importRows(rows, merge = true) {
  if (!isAdmin()) throw new Error("Admin uniquement.");

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
      else batch.set(ref, payload);
      total++;

      if (!labelQtyById.has(r.barcode)) labelQtyById.set(r.barcode, 1);
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

// --- PRINT LABELS / BARCODE SVG ---
function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function openPrintWindow(html) {
  const w = window.open("", "_blank");
  if (!w) return alert("Pop-up bloquée. Autorise les pop-ups pour imprimer.");
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function makeBarcodeSvg(value, opt) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const isEan13 = /^\d{13}$/.test(value);
  JsBarcode(svg, value, {
    format: isEan13 ? "EAN13" : "CODE128",
    displayValue: false,
    margin: 0,
    width: opt?.barWidthPx ?? 2,
    height: opt?.barPxHeight ?? 48
  });
  return svg.outerHTML;
}

function buildLabelsHtml(items) {
  const s = readLabelSettings();

  const pageMargin = `${s.marginMm}mm`;
  const colCount = s.cols;

  // 96dpi ~ 3.78px/mm
  const pxPerMm = 3.78;
  const barPxHeight = Math.max(20, Math.round(s.barHmm * pxPerMm));

  const borderCss = s.showBorder ? "1px solid #000" : "0";

  const css = `
    <style>
      @page { size: A4; margin: ${pageMargin}; }
      body { margin: 0; font-family: Arial, sans-serif; }
      .grid {
        display: grid;
        grid-template-columns: repeat(${colCount}, ${s.wMm}mm);
        grid-auto-rows: ${s.hMm}mm;
        column-gap: ${s.gapXmm}mm;
        row-gap: ${s.gapYmm}mm;
        align-content: start;
      }
      .label {
        border: ${borderCss};
        padding: 2.5mm;
        box-sizing: border-box;
        overflow: hidden;
        display: grid;
        grid-template-rows: auto 1fr auto;
        gap: 1.5mm;
      }
      .name {
        font-weight: 800;
        font-size: ${s.namePt}pt;
        line-height: 1.05;
        max-height: 2.4em;
        overflow: hidden;
      }
      .barcode { display:flex; justify-content:center; align-items:center; }
      .code { font-size: ${s.codePt}pt; text-align:center; font-weight:700; letter-spacing: .4px; }
      .meta { font-size: ${Math.max(7, s.codePt - 1)}pt; color: #111; text-align:center; }
      .noPrint { margin: 10px; display:flex; gap: 10px; flex-wrap: wrap; }
      @media print { .noPrint { display:none; } }
    </style>
  `;

  const labels = items.map(it => {
    const code = it.barcode || it.id;
    const nm = it.name || "(sans nom)";
    const loc = s.showLocation && it.location ? `📍 ${it.location}` : "";
    const qty = s.showQty ? `Qté: ${toInt(it.qty, 0)}` : "";
    const meta = [loc, qty].filter(Boolean).join(" • ");

    return `
      <div class="label">
        <div class="name">${escapeHtml(nm)}</div>
        <div class="barcode">${makeBarcodeSvg(code, { barWidthPx: s.barWidthPx, barPxHeight })}</div>
        <div>
          <div class="code">${escapeHtml(code)}</div>
          <div class="meta">${escapeHtml(meta)}</div>
        </div>
      </div>
    `;
  }).join("");

  return `<!doctype html><html><head><meta charset="utf-8"/>${css}</head>
  <body>
    <div class="noPrint">
      <button onclick="window.print()">Imprimer</button>
      <button onclick="window.close()">Fermer</button>
    </div>
    <div class="grid">${labels}</div>
  </body></html>`;
}

// Stock buttons print
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

// --- LABELS TAB (left list, qty per item) ---
function getLabelPlanItems() {
  const ids = Array.from(selectedForLabels);
  const out = [];
  let total = 0;

  for (const id of ids) {
    const it = itemsCache.find(x => x.id === id);
    if (!it) continue;

    const n = Math.max(1, toInt(labelQtyById.get(id) ?? 1, 1));
    for (let i = 0; i < n; i++) {
      out.push(it);
      total++;
    }
  }
  return { items: out, total, selectedCount: ids.length };
}

function updateLabelCounters() {
  const plan = getLabelPlanItems();
  labelsSelCount.textContent = String(plan.selectedCount);
  labelsTotalCount.textContent = String(plan.total);
}

function renderLabelsTab() {
  const q = safeTrim(labelsSearch.value).toLowerCase();
  const list = itemsCache.filter(it => {
    const code = (it.barcode || it.id || "").toLowerCase();
    const nm = (it.name || "").toLowerCase();
    return !q || code.includes(q) || nm.includes(q);
  });

  labelsHint.textContent = `${list.length} article(s)`;
  labelsList.innerHTML = "";

  for (const it of list) {
    const id = it.id;
    const code = it.barcode || it.id;
    const checked = selectedForLabels.has(id);
    const qty = Math.max(1, toInt(labelQtyById.get(id) ?? 1, 1));

    const row = document.createElement("div");
    row.className = "lblRow";
    row.innerHTML = `
      <div class="lblRowTop">
        <div class="lblRowName">${escapeHtml(it.name || "(sans nom)")}</div>
        <label class="checkRow" style="margin:0">
          <input type="checkbox" ${checked ? "checked" : ""}>
          <span style="font-size:12px;color:#666;font-weight:800">Imprimer</span>
        </label>
      </div>
      <div class="lblRowCode">${escapeHtml(code)}</div>
      <div class="lblRowMeta">${escapeHtml(it.location || "")}</div>

      <div class="lblRowControls">
        <div style="min-width:220px;flex:1">
          ${makeBarcodeSvg(code, { barWidthPx: 2, barPxHeight: 36 })}
        </div>

        <div class="lblQtyInput">
          <label style="margin-top:0">Nb étiquettes</label>
          <input type="number" min="1" step="1" value="${qty}">
        </div>

        <button class="ghost" type="button">Ouvrir</button>
      </div>
    `;

    const cb = row.querySelector('input[type="checkbox"]');
    cb.addEventListener("change", (ev) => {
      if (ev.target.checked) {
        selectedForLabels.add(id);
        if (!labelQtyById.has(id)) labelQtyById.set(id, 1);
      } else {
        selectedForLabels.delete(id);
      }
      updateLabelCounters();
    });

    const qtyInput = row.querySelector('input[type="number"]');
    qtyInput.addEventListener("change", (ev) => {
      const v = Math.max(1, toInt(ev.target.value, 1));
      ev.target.value = String(v);
      labelQtyById.set(id, v);
      updateLabelCounters();
    });

    row.querySelector("button").addEventListener("click", () => {
      selectItem(id);
      setActiveTab("stock");
    });

    labelsList.appendChild(row);
  }

  updateLabelCounters();
}

labelsSearch.addEventListener("input", renderLabelsTab);

btnLabelsSelectAll.addEventListener("click", () => {
  itemsCache.forEach(it => {
    selectedForLabels.add(it.id);
    if (!labelQtyById.has(it.id)) labelQtyById.set(it.id, 1);
  });
  renderLabelsTab();
});

btnLabelsClear.addEventListener("click", () => {
  selectedForLabels.clear();
  renderLabelsTab();
});

btnLabelsPrint.addEventListener("click", () => {
  const plan = getLabelPlanItems();
  if (!plan.items.length) return alert("Sélectionne au moins 1 article.");

  // option contour uniquement pour cette impression
  const s = readLabelSettings();
  const patched = { ...s, showBorder: labelsPreviewBorder.checked ? true : s.showBorder };
  writeLabelSettings(patched);

  openPrintWindow(buildLabelsHtml(plan.items));

  // restore
  writeLabelSettings(s);
});

// --- Label settings init + actions ---
(function initLabelSettings() {
  const s = readLabelSettings();
  applyLabelSettingsToUI(s);

  labelPreset.addEventListener("change", () => {
    const key = labelPreset.value;
    if (key === "custom") {
      const cur = uiToLabelSettings();
      writeLabelSettings(cur);
      setStatus(labelStatus, "Mode personnalisé.");
      return;
    }
    applyPreset(key);
  });

  btnSaveLabelSettings.addEventListener("click", () => {
    const cur = uiToLabelSettings();
    writeLabelSettings(cur);
    setStatus(labelStatus, "Réglages enregistrés ✅");
  });

  btnResetLabelSettings.addEventListener("click", () => {
    const def = defaultLabelSettings();
    applyLabelSettingsToUI(def);
    writeLabelSettings(def);
    setStatus(labelStatus, "Réglages réinitialisés.");
  });
})();

// --- Auth state + gating ---
function stopAllListeners() {
  if (unsubscribeMoves) unsubscribeMoves();
  unsubscribeMoves = null;
  if (unsubscribeItems) unsubscribeItems();
  unsubscribeItems = null;

  moves.innerHTML = "";
  itemsCache = [];
  selectedForLabels.clear();
  labelQtyById.clear();
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

  // panels
  adminPanel.hidden = !admin;
  importPanel.hidden = !admin;
}

onAuthStateChanged(auth, async (user) => {
  stopAllListeners();

  setStatus(status, "");
  setStatus(appStatus, "");
  setStatus(adminStatus, "");
  setStatus(importStatus, "");
  setStatus(labelStatus, "");
  setStatus(pwStatus, "");

  pendingList.innerHTML = "";
  dashCriticalList.innerHTML = "";
  dashCriticalHint.textContent = "";
  stockTableBody.innerHTML = "";
  stockCards.innerHTML = "";
  stockHint.textContent = "";
  labelsList.innerHTML = "";
  labelsHint.textContent = "";
  labelsSelCount.textContent = "0";
  labelsTotalCount.textContent = "0";
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

  if (isAdmin()) await refreshPendingUsers();

  unsubscribeItems = startItemsListener();
  unsubscribeMoves = startMovesListener();
});
