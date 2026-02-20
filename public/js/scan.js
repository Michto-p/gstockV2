
// scan.js — scan code-barres (camera) -> remplit le champ #barcode
import { AppEvents, $, setStatus, canMove } from "./core.js";

const btnScan = $("btnScan");
const btnStop = $("btnStopScan");
const wrap = $("scannerWrap");
const video = $("video");
const barcodeInput = $("barcode");
const statusEl = $("appStatus");

let stream=null;
let rafId=null;
let detector=null;
let lastCode=null;
let lastTs=0;

function supportsDetector(){
  return ("BarcodeDetector" in window);
}

async function start(){
  if(!canMove()) return setStatus(statusEl,"Droits insuffisants.",true);
  setStatus(statusEl,"");
  if(!navigator.mediaDevices?.getUserMedia){
    return setStatus(statusEl,"Caméra non disponible sur ce navigateur.", true);
  }
  if(!supportsDetector()){
    wrap && (wrap.hidden=true);
    return setStatus(statusEl,"BarcodeDetector non supporté. Saisis le code manuellement (iPhone Safari peut être limité).", true);
  }

  detector = new BarcodeDetector({formats:["ean_13","ean_8","code_128","code_39","qr_code","upc_a","upc_e"]});
  stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}, width:{ideal:1280}, height:{ideal:720}}, audio:false});
  video.srcObject = stream;
  await video.play();

  wrap && (wrap.hidden=false);
  btnScan && (btnScan.hidden=true);
  btnStop && (btnStop.hidden=false);
  loop();
}

function stop(){
  if(rafId) cancelAnimationFrame(rafId);
  rafId=null;
  if(stream){
    stream.getTracks().forEach(t=>t.stop());
    stream=null;
  }
  if(video){
    video.pause();
    video.srcObject=null;
  }
  wrap && (wrap.hidden=true);
  btnScan && (btnScan.hidden=false);
  btnStop && (btnStop.hidden=true);
}

async function loop(){
  rafId=requestAnimationFrame(loop);
  if(!detector || !video || video.readyState<2) return;

  const now = performance.now();
  if(now-lastTs < 120) return; // ~8 fps
  lastTs = now;

  try{
    const codes = await detector.detect(video);
    if(!codes?.length) return;
    const code = codes[0].rawValue || "";
    if(!code) return;

    // anti-rebond
    if(code === lastCode) return;
    lastCode = code;

    if(barcodeInput){
      barcodeInput.value = code;
      barcodeInput.dispatchEvent(new Event("change"));
    }
    setStatus(statusEl, `Scanné: ${code} ✅`);
    // option: arrêter après scan
    // stop();
  }catch(e){
    // ignore
  }
}

function bind(){
  btnScan?.addEventListener("click", ()=>start().catch(err=>setStatus(statusEl,err.message,true)));
  btnStop?.addEventListener("click", ()=>stop());
  // stop si on change d'onglet / quitte la page
  window.addEventListener("visibilitychange", ()=>{ if(document.hidden) stop(); });
}

AppEvents.addEventListener("auth:signedIn", ()=>{
  bind();
});
AppEvents.addEventListener("auth:signedOut", ()=>stop());
