// public/js/tabs.js
import {
  tabsBar, AppEvents,
  canRead, canMove, canManageSuppliers,
  canManageUsers, canManageRoles, canManageItems, isAdmin
} from "./core.js";

const panels = {
  dash: document.getElementById("tabDash"),
  scan: document.getElementById("tabScan"),
  stock: document.getElementById("tabStock"),
  orders: document.getElementById("tabOrders"),
  suppliers: document.getElementById("tabSuppliers"),
  settings: document.getElementById("tabSettings"),
};

function setActive(tab) {
  Object.entries(panels).forEach(([k, el]) => { if (el) el.hidden = (k !== tab); });
  tabsBar?.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.getAttribute("data-tab") === tab));
}

function setTabVisible(tab, visible) {
  const btn = tabsBar?.querySelector(`.tab[data-tab="${tab}"]`);
  if (btn) btn.hidden = !visible;
}

function applySettingsPanels() {
  // Sous-panneaux paramètres
  const importPanel = document.getElementById("importPanel");
  const rolesPanel = document.getElementById("rolesPanel");
  const usersPanel = document.getElementById("usersPanel");
  const adminPanel = document.getElementById("adminPanel");

  if (importPanel) importPanel.hidden = !(isAdmin() || canManageItems());
  if (rolesPanel) rolesPanel.hidden = !(isAdmin() || canManageRoles());
  if (usersPanel) usersPanel.hidden = !(isAdmin() || canManageUsers());
  if (adminPanel) adminPanel.hidden = !isAdmin();
}

function applyVisibility() {
  const read = canRead();
  setTabVisible("dash", read);
  setTabVisible("scan", canMove());
  setTabVisible("stock", read);
  setTabVisible("orders", read);
  setTabVisible("suppliers", read && canManageSuppliers());
  setTabVisible("settings", read); // Paramètres visible si connecté validé (les sous-panneaux filtrent)

  applySettingsPanels();

  // Basculer sur dash si l'actif est masqué
  const activeBtn = tabsBar?.querySelector(".tab.active");
  if (activeBtn && activeBtn.hidden) {
    const firstVisible = tabsBar?.querySelector(".tab:not([hidden])");
    if (firstVisible) setActive(firstVisible.getAttribute("data-tab"));
  }
}

tabsBar?.addEventListener("click", (e) => {
  const b = e.target.closest(".tab");
  const tab = b?.getAttribute("data-tab");
  if (!tab || b.hidden) return;
  setActive(tab);
});

AppEvents.addEventListener("auth:signedIn", () => {
  applyVisibility();
  setActive("dash");
});

AppEvents.addEventListener("roles:updated", () => {
  applyVisibility();
});

AppEvents.addEventListener("auth:signedOut", () => {
  tabsBar?.querySelectorAll(".tab").forEach(b => { b.hidden = false; b.classList.remove("active"); });
});
