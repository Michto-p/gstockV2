// public/js/auth.js
import {
  auth, $, setStatus, safeTrim, ensureMyProfile, status
} from "./core.js";

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updatePassword
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const email = $("email");
const password = $("password");
const btnLogin = $("btnLogin");
const btnSignup = $("btnSignup");
const btnForgotPw = $("btnForgotPw");
const btnTogglePw = $("btnTogglePw");

const newPassword = $("newPassword");
const newPassword2 = $("newPassword2");
const btnChangePw = $("btnChangePw");
const pwStatus = $("pwStatus");

function togglePw() {
  if (!password) return;
  const isPw = password.type === "password";
  password.type = isPw ? "text" : "password";
  if (btnTogglePw) btnTogglePw.textContent = isPw ? "Masquer" : "Afficher";
}
btnTogglePw?.addEventListener("click", togglePw);

btnLogin?.addEventListener("click", async () => {
  setStatus(status, "");
  try {
    const em = safeTrim(email?.value);
    const pw = safeTrim(password?.value);
    if (!em || !pw) return setStatus(status, "Email et mot de passe requis.", true);
    await signInWithEmailAndPassword(auth, em, pw);
    // profile auto via core onAuthStateChanged
  } catch (e) {
    console.error(e);
    setStatus(status, e?.message || String(e), true);
  }
});

btnSignup?.addEventListener("click", async () => {
  setStatus(status, "");
  try {
    const em = safeTrim(email?.value);
    const pw = safeTrim(password?.value);
    if (!em || !pw) return setStatus(status, "Email et mot de passe requis.", true);
    if (pw.length < 6) return setStatus(status, "Mot de passe min 6 caractères.", true);

    await createUserWithEmailAndPassword(auth, em, pw);
    // Crée profil tout de suite (au cas où)
    await ensureMyProfile();
    setStatus(status, "Compte créé. En attente de validation admin.", false);
  } catch (e) {
    console.error(e);
    setStatus(status, e?.message || String(e), true);
  }
});

btnForgotPw?.addEventListener("click", async () => {
  setStatus(status, "");
  try {
    const em = safeTrim(email?.value);
    if (!em) return setStatus(status, "Entre ton email d’abord.", true);
    await sendPasswordResetEmail(auth, em);
    setStatus(status, "Email de réinitialisation envoyé.", false);
  } catch (e) {
    console.error(e);
    setStatus(status, e?.message || String(e), true);
  }
});

// Change password (settings)
btnChangePw?.addEventListener("click", async () => {
  setStatus(pwStatus, "");
  try {
    const pw1 = safeTrim(newPassword?.value);
    const pw2 = safeTrim(newPassword2?.value);
    if (!pw1 || !pw2) return setStatus(pwStatus, "Champs requis.", true);
    if (pw1 !== pw2) return setStatus(pwStatus, "Les mots de passe ne correspondent pas.", true);
    if (pw1.length < 6) return setStatus(pwStatus, "Min 6 caractères.", true);

    if (!auth.currentUser) return setStatus(pwStatus, "Non connecté.", true);
    await updatePassword(auth.currentUser, pw1);
    setStatus(pwStatus, "Mot de passe changé.", false);
    if (newPassword) newPassword.value = "";
    if (newPassword2) newPassword2.value = "";
  } catch (e) {
    console.error(e);
    setStatus(pwStatus, e?.message || String(e), true);
  }
});
