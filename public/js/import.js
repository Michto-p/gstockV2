import Papa from "https://cdn.jsdelivr.net/npm/papaparse@5.4.1/+esm";
import { AppEvents, isAdmin, setStatus, safeTrim, toInt, itemDocRef, auth, db } from "./core.js";
import { writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
const importPanel=document.getElementById("importPanel");
const btnDownloadCsvTemplate=document.getElementById("btnDownloadCsvTemplate");
const csvFile=document.getElementById("csvFile");
const chkImportMerge=document.getElementById("chkImportMerge");
const btnImportCsv=document.getElementById("btnImportCsv");
const importStatus=document.getElementById("importStatus");
function applyRole(){ if(importPanel) importPanel.hidden=!isAdmin(); }
AppEvents.addEventListener("auth:signedIn",applyRole);
AppEvents.addEventListener("auth:signedOut",applyRole);
AppEvents.addEventListener("auth:pending",applyRole);
btnDownloadCsvTemplate?.addEventListener("click",()=>{
  const sample="barcode;name;qty;unit;location;low;critical;tags\nDISJLGDX16;Disjoncteur DX 16A;12;pcs;Armoire 1;5;2;protection|legrand\n";
  const blob=new Blob([sample],{type:"text/csv;charset=utf-8"}); const url=URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url; a.download="gstock_template.csv"; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});
function parseCsv(text){
  const first=(text.split(/\r?\n/).find(l=>l.trim().length)||"");
  const semi=(first.match(/;/g)||[]).length, comma=(first.match(/,/g)||[]).length;
  const delimiter=semi>=comma?";":",";
  const res=Papa.parse(text,{header:true,skipEmptyLines:true,delimiter});
  if(res.errors?.length) throw new Error("CSV: "+(res.errors[0]?.message||"Erreur"));
  return res.data;
}
function norm(r){
  const barcode=safeTrim(r.barcode||r.code||r.id); if(!barcode) return null;
  const name=safeTrim(r.name||r.nom)||"(à compléter)";
  const qty=Math.max(0,toInt(r.qty??0,0));
  const unit=safeTrim(r.unit||""); const location=safeTrim(r.location||"");
  const low=Math.max(0,toInt(r.low??5,5)); const critical=Math.max(0,toInt(r.critical??2,2));
  const tags=safeTrim(r.tags||"").split(/[|,]/g).map(s=>s.trim()).filter(Boolean);
  return {barcode,name,qty,unit,location,low,critical,tags};
}
async function importRows(rows, merge=true){
  const CHUNK=450; let total=0;
  for(let i=0;i<rows.length;i+=CHUNK){
    const batch=writeBatch(db);
    for(const r of rows.slice(i,i+CHUNK)){
      const ref=itemDocRef(r.barcode);
      const payload={barcode:r.barcode,name:r.name,qty:r.qty,unit:r.unit,location:r.location,tags:r.tags,thresholds:{low:r.low,critical:r.critical},updatedAt:serverTimestamp(),updatedBy:auth.currentUser?.uid||""};
      merge?batch.set(ref,payload,{merge:true}):batch.set(ref,payload);
      total++;
    }
    await batch.commit();
  }
  return total;
}
btnImportCsv?.addEventListener("click", async ()=>{
  if(!isAdmin()) return setStatus(importStatus,"Admin uniquement.",true);
  if(!csvFile?.files?.length) return setStatus(importStatus,"Choisis un CSV.",true);
  try{
    setStatus(importStatus,"Lecture...");
    const text=await csvFile.files[0].text();
    const rows=parseCsv(text).map(norm).filter(Boolean);
    if(!rows.length) return setStatus(importStatus,"Aucune ligne valide.",true);
    setStatus(importStatus,`Import ${rows.length}...`);
    const total=await importRows(rows, !!chkImportMerge?.checked);
    setStatus(importStatus,`Import terminé ✅ (${total}).`);
    csvFile.value="";
  }catch(e){ setStatus(importStatus,e.message,true); }
});
