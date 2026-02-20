import { BrowserMultiFormatReader } from "https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm";
import { AppEvents, auth, db, itemDocRef, movesColRef, canMoveStock, setStatus, safeTrim, toInt, nowISO } from "./core.js";
import { getDoc, runTransaction, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
const btnScan=document.getElementById("btnScan"), btnStopScan=document.getElementById("btnStopScan"), scannerWrap=document.getElementById("scannerWrap"), video=document.getElementById("video");
const barcode=document.getElementById("barcode"), name=document.getElementById("name"), qtyDelta=document.getElementById("qtyDelta"), reason=document.getElementById("reason");
const btnAdd=document.getElementById("btnAdd"), btnRemove=document.getElementById("btnRemove"), btnLoad=document.getElementById("btnLoad");
const appStatus=document.getElementById("appStatus"), itemBox=document.getElementById("itemBox");
let reader=null, scanning=false;
async function loadItem(code){
  setStatus(appStatus,""); itemBox.hidden=true;
  const snap=await getDoc(itemDocRef(code));
  if(!snap.exists()){ itemBox.hidden=false; itemBox.textContent=`Article inconnu : ${code} (admin: créer dans Stock).`; return null; }
  const d=snap.data(); itemBox.hidden=false;
  itemBox.innerHTML=`<div><b>${d.name||"(sans nom)"}</b></div><div style="margin-top:6px"><b>Code:</b> ${code}</div><div><b>Quantité:</b> ${d.qty??0}</div>`;
  return {id:snap.id,...d};
}
async function move(deltaSign){
  if(!auth.currentUser) return setStatus(appStatus,"Connecte-toi d’abord.",true);
  if(!canMoveStock()) return setStatus(appStatus,"Lecture seule.",true);
  const code=safeTrim(barcode.value); if(!code) return setStatus(appStatus,"Entre/scanne un code-barres.",true);
  const nm=safeTrim(name.value), why=safeTrim(reason.value);
  const n=Math.max(1,toInt(qtyDelta.value,1));
  const delta=deltaSign>0?+n:-n;
  try{
    await runTransaction(db, async (tx)=>{
      const ref=itemDocRef(code); const snap=await tx.get(ref);
      if(!snap.exists()) throw new Error("Article inconnu (admin: créer dans Stock).");
      const cur=snap.data().qty??0; const newQty=Math.max(0,cur+delta);
      tx.set(ref,{qty:newQty,updatedAt:serverTimestamp(),updatedBy:auth.currentUser.uid,lastMoveAt:serverTimestamp()},{merge:true});
    });
    await addDoc(movesColRef(),{barcode:code,name:nm||"",delta,reason:why||"",uid:auth.currentUser.uid,at:serverTimestamp(),clientAt:nowISO()});
    setStatus(appStatus,delta>0?"Ajout OK.":"Retrait OK."); await loadItem(code);
  }catch(e){ setStatus(appStatus,e.message,true); }
}
btnAdd?.addEventListener("click",()=>move(+1));
btnRemove?.addEventListener("click",()=>move(-1));
btnLoad?.addEventListener("click",()=>{ const code=safeTrim(barcode.value); if(!code) return setStatus(appStatus,"Entre/scanne un code-barres.",true); loadItem(code); });
barcode?.addEventListener("change",()=>{ const code=safeTrim(barcode.value); if(code) loadItem(code); });
async function startScan(){
  if(scanning) return;
  setStatus(appStatus,""); scannerWrap.hidden=false; btnStopScan.hidden=false; btnScan.disabled=true;
  reader=new BrowserMultiFormatReader(); scanning=true;
  try{ const res=await reader.decodeOnceFromVideoDevice(null,video); const text=res?.getText?res.getText():"";
    if(text){ barcode.value=text; setStatus(appStatus,"Scan OK: "+text); await loadItem(text); }
    else setStatus(appStatus,"Scan annulé / non détecté.",true);
  }catch(e){ setStatus(appStatus,"Erreur scan: "+e.message,true); } finally { stopScan(); }
}
function stopScan(){
  scanning=false; btnScan.disabled=false; btnStopScan.hidden=true; scannerWrap.hidden=true;
  try{ reader?.reset(); }catch{} reader=null;
  try{ const stream=video.srcObject; stream?.getTracks?.().forEach(t=>t.stop()); video.srcObject=null; }catch{}
}
btnScan?.addEventListener("click",startScan);
btnStopScan?.addEventListener("click",stopScan);
AppEvents.addEventListener("auth:signedOut",()=>{ stopScan(); itemBox&&(itemBox.hidden=true); setStatus(appStatus,""); });
AppEvents.addEventListener("auth:pending",()=>stopScan());
