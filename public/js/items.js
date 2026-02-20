import { AppEvents, itemsColRef, itemsCache } from "./core.js";
import { query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
let unsub=null;
function start(){
  if(unsub) unsub();
  const q=query(itemsColRef(), orderBy("name"));
  unsub=onSnapshot(q,(snap)=>{
    itemsCache.length=0;
    snap.forEach(d=>itemsCache.push({id:d.id,...d.data()}));
    window.__GstockRefreshStock?.();
    window.__GstockRefreshLabels?.();
    window.__GstockRefreshDash?.();
  },(e)=>console.warn("items:",e));
}
function stop(){ if(unsub) unsub(); unsub=null; itemsCache.length=0; }
AppEvents.addEventListener("auth:signedIn", start);
AppEvents.addEventListener("auth:signedOut", stop);
AppEvents.addEventListener("auth:pending", stop);
