import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, updatePassword } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { auth, $, setStatus, safeTrim, ensureMyPendingProfile, status } from "./core.js";
const email=$("email"), password=$("password");
$("btnTogglePw")?.addEventListener("click", ()=>{
  const isPw=password.type==="password";
  password.type=isPw?"text":"password";
  $("btnTogglePw").textContent=isPw?"Masquer":"Afficher";
});
$("btnForgotPw")?.addEventListener("click", async ()=>{
  try{ const mail=safeTrim(email.value); if(!mail) return setStatus(status,"Entre ton email.",true);
    await sendPasswordResetEmail(auth, mail); setStatus(status,"Email de réinitialisation envoyé ✅");
  }catch(e){ setStatus(status,e.message,true); }
});
$("btnLogin")?.addEventListener("click", async ()=>{
  try{ setStatus(status,""); await signInWithEmailAndPassword(auth, safeTrim(email.value), safeTrim(password.value)); }
  catch(e){ setStatus(status,e.message,true); }
});
$("btnSignup")?.addEventListener("click", async ()=>{
  try{ setStatus(status,""); const pass=safeTrim(password.value); if(pass.length<6) return setStatus(status,"Mot de passe: 6 caractères minimum.",true);
    await createUserWithEmailAndPassword(auth, safeTrim(email.value), pass);
    await ensureMyPendingProfile();
    setStatus(status,"Compte créé. En attente de validation admin.");
  }catch(e){ setStatus(status,e.message,true); }
});
$("btnChangePw")?.addEventListener("click", async ()=>{
  const pwStatus=$("pwStatus");
  try{
    if(!auth.currentUser) return setStatus(pwStatus,"Connecte-toi d’abord.",true);
    const p1=safeTrim($("newPassword").value), p2=safeTrim($("newPassword2").value);
    if(p1.length<6) return setStatus(pwStatus,"6 caractères minimum.",true);
    if(p1!==p2) return setStatus(pwStatus,"Les mots de passe ne correspondent pas.",true);
    await updatePassword(auth.currentUser,p1);
    $("newPassword").value=""; $("newPassword2").value="";
    setStatus(pwStatus,"Mot de passe changé ✅");
  }catch(e){ setStatus(pwStatus,e.message,true); }
});
