import { on, $ } from "./core.js";
const moves = $("moves");
function renderMoves(snap){
  if(!moves) return;
  moves.innerHTML = "";
  snap.forEach((docu)=>{
    const m = docu.data();
    const delta = m.delta ?? 0;
    const sign = delta > 0 ? "+" : "";
    const when = m.at?.toDate ? m.at.toDate().toLocaleString() : (m.clientAt || "");
    const el = document.createElement("div");
    el.className = "move";
    el.innerHTML = `
      <div class="top">
        <div class="code">${m.barcode || m.code || "—"}</div>
        <div style="font-weight:900">${sign}${delta}</div>
      </div>
      <div class="meta">${m.reason ? m.reason + " — " : ""}${when}</div>
    `;
    moves.appendChild(el);
  });
}
on("moves:snapshot", renderMoves);
