import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updatePassword
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import { auth, $, setStatus, safeTrim, ensureMyPendingProfile, status } from "./core.js";

const email = $("email");
const password = $("password");
const btnLogin = $("btnLogin");
const btnSignup = $("btnSignup");
const btnTogglePw = $("btnTogglePw");
const btnForgotPw = $("btnForgotPw");

const newPassword = $("newPassword");
const newPassword2 = $("newPassword2");
const btnChangePw = $("btnChangePw");
const pwStatus = $("pwStatus");

function humanAuthError(e){
  const msg = e?.message || String(e);
  if (msg.includes("OPERATION_NOT_ALLOWED")) return "Email/Password n'est pas activé dans Firebase Auth (console).";
  if (msg.includes("API_KEY_HTTP_REFERRER_BLOCKED")) return "Clé API restreinte: autorise le domaine web.app/firebaseapp.com dans Google Cloud Console.";
  return msg;
}

btnTogglePw?.addEventListener("click", ()=>{
  const isPw = password.type === "password";
  password.type = isPw ? "text" : "password";
  btnTogglePw.textContent = isPw ? "Masquer" : "Afficher";
});

btnForgotPw?.addEventListener("click", async ()=>{
  try{
    const mail = safeTrim(email?.value);
    if(!mail) return setStatus(status, "Entre ton email puis clique 'Mot de passe oublié'.", true);
    await sendPasswordResetEmail(auth, mail);
    setStatus(status, "Email de réinitialisation envoyé ✅ (vérifie tes spams).");
  }catch(e){
    setStatus(status, humanAuthError(e), true);
  }
});

btnLogin?.addEventListener("click", async ()=>{
  try{
    setStatus(status, "");
    await signInWithEmailAndPassword(auth, safeTrim(email?.value), safeTrim(password?.value));
  }catch(e){
    setStatus(status, humanAuthError(e), true);
  }
});

btnSignup?.addEventListener("click", async ()=>{
  try{
    setStatus(status, "");
    const pass = safeTrim(password?.value);
    if(pass.length < 6) return setStatus(status, "Mot de passe : 6 caractères minimum.", true);
    await createUserWithEmailAndPassword(auth, safeTrim(email?.value), pass);
    await ensureMyPendingProfile();
    setStatus(status, "Compte créé. En attente de validation admin.");
  }catch(e){
    setStatus(status, humanAuthError(e), true);
  }
});

btnChangePw?.addEventListener("click", async ()=>{
  try{
    if(!auth.currentUser) return setStatus(pwStatus, "Connecte-toi d’abord.", true);
    const p1 = safeTrim(newPassword?.value);
    const p2 = safeTrim(newPassword2?.value);
    if(p1.length < 6) return setStatus(pwStatus, "6 caractères minimum.", true);
    if(p1 !== p2) return setStatus(pwStatus, "Les mots de passe ne correspondent pas.", true);

    await updatePassword(auth.currentUser, p1);
    newPassword.value = "";
    newPassword2.value = "";
    setStatus(pwStatus, "Mot de passe changé ✅");
  }catch(e){
    setStatus(pwStatus, humanAuthError(e), true);
  }
});