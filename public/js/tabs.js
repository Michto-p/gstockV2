import {
  tabsBar,
  AppEvents,
  canRead, canMove,
  canManageSuppliers,
  canManageUsers,
  canManageRoles,
  canManageItems
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

function applyVisibility() {
  // ✅ si aucun droit n’est chargé, on ne cache pas tout brutalement :
  // on garde au moins dashboard visible si read=true, sinon on masque tout et l’app montrera “pending/roleMissing”.
  const read = canRead();

  setTabVisible("dash", read);
  setTabVisible("scan", canMove());
  setTabVisible("stock", read);
  setTabVisible("orders", read); // ou canMove() si tu veux réserver la commande au stock
  setTabVisible("suppliers", canManageSuppliers());
  setTabVisible("settings", canManageItems() || canManageSuppliers() || canManageUsers() || canManageRoles());

  // Si l’onglet actif est caché, on retombe sur dash (si possible)
  const anyVisible = Array.from(tabsBar?.querySelectorAll(".tab") || []).some(b => !b.hidden);
  if (!anyVisible) return;

  const active = tabsBar?.querySelector(".tab.active:not([hidden])")?.getAttribute("data-tab");
  if (!active) setActive("dash");
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

AppEvents.addEventListener("auth:signedOut", () => {
  // reset visuel
  tabsBar?.querySelectorAll(".tab").forEach(b => b.hidden = false);
  tabsBar?.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
});

AppEvents.addEventListener("auth:pending", () => {
  // Pas d’app visible -> rien à faire ici
});

AppEvents.addEventListener("auth:roleMissing", () => {
  // Pas d’app visible -> rien à faire ici
});
