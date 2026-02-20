import { tabBtnDash, tabBtnScan, tabBtnStock, tabBtnLabels, tabBtnSettings, setActiveTab } from "./core.js";
tabBtnDash?.addEventListener("click", ()=>setActiveTab("dash"));
tabBtnScan?.addEventListener("click", ()=>setActiveTab("scan"));
tabBtnStock?.addEventListener("click", ()=>setActiveTab("stock"));
tabBtnLabels?.addEventListener("click", ()=>setActiveTab("labels"));
tabBtnSettings?.addEventListener("click", ()=>setActiveTab("settings"));
