import { tabsBar, AppEvents, canRead, canMove, canManageSuppliers, isAdmin, canManageUsers, canManageRoles, canManageItems } from "./core.js";
const panels={dash:document.getElementById("tabDash"),scan:document.getElementById("tabScan"),stock:document.getElementById("tabStock"),orders:document.getElementById("tabOrders"),suppliers:document.getElementById("tabSuppliers"),settings:document.getElementById("tabSettings")};
function setActive(tab){Object.entries(panels).forEach(([k,el])=>{if(el)el.hidden=(k!==tab);});tabsBar?.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.getAttribute("data-tab")===tab));}
function applyVisibility(){
  const show={tabBtnDash:canRead(),tabBtnScan:canMove(),tabBtnStock:canRead(),tabBtnOrders:canRead(),tabBtnSuppliers:(canManageSuppliers()||isAdmin()),tabBtnSettings:true};
  for(const [id,ok] of Object.entries(show)){const el=document.getElementById(id); if(el) el.style.display=ok?"":"none";}
  const rolesPanel=document.getElementById("rolesPanel"); if(rolesPanel) rolesPanel.hidden=!(canManageRoles()||isAdmin());
  const usersPanel=document.getElementById("usersPanel"); if(usersPanel) usersPanel.hidden=!(canManageUsers()||isAdmin());
  const importPanel=document.getElementById("importPanel"); if(importPanel) importPanel.hidden=!(canManageItems()||isAdmin());
  const adminPanel=document.getElementById("adminPanel"); if(adminPanel) adminPanel.hidden=!isAdmin();
}
window.__GstockApplyVisibility=applyVisibility;
tabsBar?.addEventListener("click",(e)=>{const b=e.target.closest("button.tab"); if(!b)return; const tab=b.getAttribute("data-tab"); if(tab) setActive(tab);});
window.__GstockSetTab=setActive;
AppEvents.addEventListener("auth:signedIn",()=>{applyVisibility(); const first=[...tabsBar.querySelectorAll(".tab")].find(b=>b.style.display!=="none"); setActive(first?.getAttribute("data-tab")||"dash");});
