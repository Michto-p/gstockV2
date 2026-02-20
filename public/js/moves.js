
// moves.js — opérations stock (transactions) + historique
import { AppEvents, db, auth, itemsCache, itemDocRef, movesColRef, $, setStatus, safeTrim, toInt, canMove, canRead } from "./core.js";
import { doc, getDoc, collection, addDoc, serverTimestamp, runTransaction, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const els = {
  barcode: $("barcode"),
  name: $("name"),
  qtyDelta: $("qtyDelta"),
  reason: $("reason"),
  btnAdd: $("btnAdd"),
  btnRemove: $("btnRemove"),
  btnLoad: $("btnLoad"),
  status: $("appStatus"),
  itemBox: $("itemBox"),
  movesWrap: $("moves"), // dashboard list container (id="moves")
};

function renderItemBox(it){
  if(!els.itemBox) return;
  if(!it){
    els.itemBox.hidden=true;
    els.itemBox.innerHTML="";
    return;
  }
  els.itemBox.hidden=false;
  els.itemBox.innerHTML = `
    <div class="card">
      <div class="cardTitle">${it.name||"(Sans nom)"}</div>
      <div class="cardSub mono">${it.barcode||it.id||""}</div>
      <div class="kpis">
        <div class="kpi"><div class="kpiLabel">Qté</div><div class="kpiVal">${toInt(it.qty,0)}</div></div>
        <div class="kpi"><div class="kpiLabel">Seuil bas</div><div class="kpiVal">${toInt(it.thresholds?.low,0)}</div></div>
        <div class="kpi"><div class="kpiLabel">Critique</div><div class="kpiVal">${toInt(it.thresholds?.critical,0)}</div></div>
      </div>
    </div>
  `;
}

async function loadItem(barcode){
  const code = safeTrim(barcode);
  if(!code) return null;
  const local = itemsCache.find(i=>(i.barcode||i.id)===code);
  if(local) return local;
  const snap = await getDoc(itemDocRef(code));
  return snap.exists() ? {id:snap.id, ...snap.data()} : null;
}

async function applyMove(delta){
  if(!canMove()) return setStatus(els.status, "Droits insuffisants.", true);
  const code = safeTrim(els.barcode?.value);
  if(!code) return setStatus(els.status, "Scanne ou saisis un code-barres.", true);
  const d = Math.max(1, toInt(els.qtyDelta?.value, 1));
  const finalDelta = delta * d;
  const reason = safeTrim(els.reason?.value);
  const nameHint = safeTrim(els.name?.value);

  setStatus(els.status, "Traitement…");
  try{
    let after = null;
    await runTransaction(db, async (tx)=>{
      const ref = itemDocRef(code);
      const snap = await tx.get(ref);
      if(!snap.exists()){
        throw new Error("Article introuvable. (Crée-le dans l'onglet Stock)");
      }
      const it = snap.data();
      const before = toInt(it.qty,0);
      const next = before + finalDelta;
      if(next < 0) throw new Error(`Stock insuffisant (actuel: ${before}).`);
      tx.update(ref, { qty: next, updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.uid||null });
      const mv = {
        barcode: code,
        name: it.name || nameHint || "",
        delta: finalDelta,
        qtyBefore: before,
        qtyAfter: next,
        reason,
        at: serverTimestamp(),
        userId: auth.currentUser?.uid||null,
        userEmail: auth.currentUser?.email||null
      };
      const mvRef = doc(collection(db,"moves"));
      tx.set(mvRef, mv);
      after = { id: code, ...it, qty: next };
    });

    setStatus(els.status, "OK ✅");
    renderItemBox(after);
    // refresh caches & dashboards
    await window.__GstockReloadItems?.();
    await window.__GstockLoadRecentMoves?.();
  }catch(e){
    setStatus(els.status, e.message || String(e), true);
  }
}

async function reloadCurrent(){
  const code = safeTrim(els.barcode?.value);
  const it = await loadItem(code);
  if(!it) return setStatus(els.status, "Article introuvable.", true);
  renderItemBox(it);
  els.name && !safeTrim(els.name.value) && (els.name.value = it.name||"");
  setStatus(els.status, "");
}

function moveRow(m){
  const sign = m.delta>0 ? "+" : "";
  const when = m.at?.toDate ? m.at.toDate() : null;
  const d = when ? when.toLocaleString() : "";
  return `<div class="moveRow">
    <div class="moveMain">
      <div class="moveTitle">${m.name||""} <span class="mono">${m.barcode||""}</span></div>
      <div class="moveSub">${d}${m.userEmail?` • ${m.userEmail}`:""}${m.reason?` • ${m.reason}`:""}</div>
    </div>
    <div class="moveDelta ${m.delta>0?"pos":"neg"}">${sign}${m.delta}</div>
  </div>`;
}

async function loadRecentMoves(){
  if(!canRead()) return;
  if(!els.movesWrap) return;
  const snap = await getDocs(query(movesColRef(), orderBy("at","desc"), limit(20)));
  const data=[];
  snap.forEach(d=>data.push({id:d.id, ...d.data()}));
  els.movesWrap.innerHTML = data.length ? data.map(moveRow).join("") : `<div class="empty">Aucun mouvement</div>`;
}
window.__GstockLoadRecentMoves = loadRecentMoves;

function bind(){
  els.btnAdd?.addEventListener("click", ()=>applyMove(+1));
  els.btnRemove?.addEventListener("click", ()=>applyMove(-1));
  els.btnLoad?.addEventListener("click", ()=>reloadCurrent().catch(e=>setStatus(els.status,e.message,true)));
  els.barcode?.addEventListener("change", ()=>reloadCurrent().catch(()=>{}));
}

AppEvents.addEventListener("auth:signedIn", async ()=>{
  bind();
  await loadRecentMoves().catch(()=>{});
});
