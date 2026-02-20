// public/js/scan.js
import { AppEvents, setStatus, canRead } from "./core.js";

const btnScan = document.getElementById("btnScan");
const btnStopScan = document.getElementById("btnStopScan");
const scannerWrap = document.getElementById("scannerWrap");
const video = document.getElementById("video");
const barcode = document.getElementById("barcode");
const appStatus = document.getElementById("appStatus");
const btnLoad = document.getElementById("btnLoad");

let stream = null;
let detector = null;
let rafId = null;

async function startScan() {
  setStatus(appStatus, "");
  if (!canRead()) return;

  if (!("mediaDevices" in navigator) || !navigator.mediaDevices.getUserMedia) {
    return setStatus(appStatus, "Caméra non supportée sur ce navigateur.", true);
  }
  if (!("BarcodeDetector" in window)) {
    return setStatus(appStatus, "BarcodeDetector non supporté (iPhone: utilise la saisie manuelle).", true);
  }

  try {
    detector = new BarcodeDetector({ formats: ["ean_13", "ean_8", "code_128", "qr_code", "upc_a", "upc_e"] });
  } catch (e) {
    detector = new BarcodeDetector();
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    if (video) {
      video.srcObject = stream;
      await video.play();
    }
    if (scannerWrap) scannerWrap.hidden = false;
    btnScan && (btnScan.hidden = true);
    btnStopScan && (btnStopScan.hidden = false);

    loop();
    setStatus(appStatus, "Scan démarré…", false);
  } catch (e) {
    console.error(e);
    setStatus(appStatus, "Impossible d'accéder à la caméra.", true);
  }
}

function stopScan() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;

  if (video) video.pause();

  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  detector = null;

  if (scannerWrap) scannerWrap.hidden = true;
  btnScan && (btnScan.hidden = false);
  btnStopScan && (btnStopScan.hidden = true);
}

async function loop() {
  if (!video || !detector) return;
  try {
    const codes = await detector.detect(video);
    if (codes && codes.length) {
      const raw = codes[0].rawValue || "";
      if (raw && barcode) {
        barcode.value = raw;
        setStatus(appStatus, `Détecté: ${raw}`, false);
        // charge l'article (stock.js)
        btnLoad?.click();
        // petite pause pour éviter spam
        stopScan();
        return;
      }
    }
  } catch (e) {
    // ignore
  }
  rafId = requestAnimationFrame(loop);
}

btnScan?.addEventListener("click", startScan);
btnStopScan?.addEventListener("click", stopScan);

// stop scan when leaving app
AppEvents.addEventListener("auth:signedOut", stopScan);
