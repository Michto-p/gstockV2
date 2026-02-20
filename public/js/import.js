// public/js/import.js
import {
  AppEvents, canManageItems, setStatus,
  itemDocRef
} from "./core.js";

import {
  setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const importPanel = document.getElementById("importPanel");
const btnDownloadCsvTemplate = document.getElementById("btnDownloadCsvTemplate");
const csvFile = document.getElementById("csvFile");
const chkImportMerge = document.getElementById("chkImportMerge");
const btnImportCsv = document.getElementById("btnImportCsv");
const importStatus = document.getElementById("importStatus");

function downloadTemplate() {
  const header = ["barcode","name","qty","low","critical","unit","location","tags","suppliers"];
  const sample = ["1234567890123","Exemple article","10","5","0","pcs","atelier","outil",""];
  const csv = [header, sample].map(r => r.map(v => `"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "gstock_modele.csv";
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

function parseCsv(text) {
  // Parser simple (CSV standard avec virgules et guillemets)
  const rows = [];
  let row = [];
  let cur = "";
  let inQ = false;
  for (let i=0;i<text.length;i++){
    const c = text[i];
    if (c === '"') {
      if (inQ && text[i+1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
      continue;
    }
    if (!inQ && c === ',') { row.push(cur); cur=""; continue; }
    if (!inQ && (c === '\n' || c === '\r')) {
      if (c === '\r' && text[i+1] === '\n') i++;
      row.push(cur); cur="";
      if (row.some(v=>v!== "")) rows.push(row);
      row=[];
      continue;
    }
    cur += c;
  }
  row.push(cur);
  if (row.some(v=>v!== "")) rows.push(row);
  return rows;
}

async function importCsv() {
  setStatus(importStatus, "");
  if (!canManageItems()) return setStatus(importStatus, "Droits insuffisants.", true);
  const file = csvFile?.files?.[0];
  if (!file) return setStatus(importStatus, "Choisis un fichier CSV.", true);

  const merge = !!chkImportMerge?.checked;

  try {
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length < 2) return setStatus(importStatus, "CSV vide.", true);

    const header = rows[0].map(h => (h||"").trim().toLowerCase());
    const idx = (name) => header.indexOf(name);

    const iBarcode = idx("barcode");
    const iName = idx("name");
    if (iBarcode < 0 || iName < 0) return setStatus(importStatus, "Colonnes requises: barcode, name.", true);

    let count = 0;
    for (let r=1;r<rows.length;r++) {
      const line = rows[r];
      const barcode = (line[iBarcode]||"").trim();
      const name = (line[iName]||"").trim();
      if (!barcode || !name) continue;

      const payload = {
        barcode, name,
        qty: Number(line[idx("qty")] || 0),
        low: Number(line[idx("low")] || 0),
        critical: Number(line[idx("critical")] || 0),
        unit: (line[idx("unit")]||"").trim(),
        location: (line[idx("location")]||"").trim(),
        tags: (line[idx("tags")]||"").trim(),
        suppliers: (line[idx("suppliers")]||"").split("|").map(s=>s.trim()).filter(Boolean),
        updatedAt: serverTimestamp(),
      };
      if (!merge) payload.createdAt = serverTimestamp();
      await setDoc(itemDocRef(barcode), payload, { merge: true });
      count++;
    }

    setStatus(importStatus, `Import terminé: ${count} ligne(s).`, false);
    AppEvents.dispatchEvent(new CustomEvent("items:updated", { detail: {} }));
  } catch (e) {
    console.error(e);
    setStatus(importStatus, e?.message || String(e), true);
  }
}

btnDownloadCsvTemplate?.addEventListener("click", downloadTemplate);
btnImportCsv?.addEventListener("click", importCsv);

AppEvents.addEventListener("auth:signedIn", () => {
  // panneau visible/masqué via tabs.js
});
