import { AppEvents, movesColRef, escapeHtml } from "./core.js";
import { query, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
const movesEl=document.getElementById("moves");
let unsub=null;
function render(snap){
  if(!movesEl) return;
  movesEl.innerHTML="";
  snap.forEach(d=>{
    const m=d.data(); const delta=m.delta??0; const sign=delta>0?"+":"";
    const when=m.at?.toDate?m.at.toDate().toLocaleString():(m.clientAt||"");
    const el=document.createElement("div");
    el.className="move";
    el.innerHTML=`<div class="top"><div class="code">${escapeHtml(m.barcode||"—")}</div><div style="font-weight:800">${sign}${delta}</div></div><div class="meta">${escapeHtml(m.reason?m.reason+" — ":"")}${escapeHtml(when)}</div>`;
    movesEl.appendChild(el);
  });
}
function start(){ if(unsub) unsub(); unsub=onSnapshot(query(movesColRef(),orderBy("at","desc"),limit(12)),render,(e)=>console.warn("moves:",e)); }
function stop(){ if(unsub) unsub(); unsub=null; if(movesEl) movesEl.innerHTML=""; }
AppEvents.addEventListener("auth:signedIn", start);
AppEvents.addEventListener("auth:signedOut", stop);
AppEvents.addEventListener("auth:pending", stop);
