/**
 * Bouton / lien Retour accueil TORINVEST — injecté dans l'UI Fondamental
 * (sidebar + barre haute), toutes les pages SPA.
 */
(function () {
  "use strict";

  var HOME = "/";
  var LINK_ID = "tf-back-home-bar";
  var NAV_ID = "tf-back-home-nav";

  function ensureStyles() {
    if (document.getElementById("tf-back-home-style")) return;
    var style = document.createElement("style");
    style.id = "tf-back-home-style";
    style.textContent =
      "#" +
      LINK_ID +
      "{position:fixed;top:0;left:0;right:0;z-index:2147483000;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 14px;padding-top:max(8px,env(safe-area-inset-top));background:linear-gradient(90deg,#111827,#1f2937 55%,#111827);border-bottom:1px solid rgba(250,204,21,.45);font-family:system-ui,sans-serif}" +
      "#" +
      LINK_ID +
      " a.tf-home{color:#facc15;font-weight:800;font-size:13px;text-decoration:none;letter-spacing:.03em}" +
      "#" +
      LINK_ID +
      " a.tf-home:hover{color:#fff7d6}" +
      "#" +
      LINK_ID +
      " span{color:#9ca3af;font-size:12px}" +
      "body.tf-has-back-bar{padding-top:44px}" +
      "#" +
      NAV_ID +
      "{display:flex;min-h-11;align-items:center;gap:10px;margin:8px 0 4px;border-radius:12px;padding:10px 12px;border:1px solid rgba(250,204,21,.35);background:rgba(249,115,22,.12);color:#facc15;font-size:13px;font-weight:700;text-decoration:none}" +
      "#" +
      NAV_ID +
      ":hover{background:rgba(249,115,22,.22);color:#fff7d6}";
    document.head.appendChild(style);
  }

  function ensureTopBar() {
    if (document.getElementById(LINK_ID)) return;
    ensureStyles();
    var bar = document.createElement("div");
    bar.id = LINK_ID;
    bar.innerHTML =
      '<a class="tf-home" href="' +
      HOME +
      '">← Accueil site TORINVEST</a>' +
      "<span>Fondamental · KRM</span>";
    document.body.appendChild(bar);
    document.body.classList.add("tf-has-back-bar");
  }

  function injectSidebarLink() {
    if (document.getElementById(NAV_ID)) return;
    var nav =
      document.querySelector('aside nav[aria-label="Navigation principale"]') ||
      document.querySelector("aside nav");
    if (!nav) return;
    ensureStyles();
    var a = document.createElement("a");
    a.id = NAV_ID;
    a.href = HOME;
    a.textContent = "← Accueil site TORINVEST";
    nav.parentNode.insertBefore(a, nav);
  }

  function tick() {
    ensureTopBar();
    injectSidebarLink();
  }

  function start() {
    tick();
    var obs = new MutationObserver(function () {
      tick();
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    setInterval(tick, 1500);
  }

  // Désactive l'ancien service worker qui pouvait cacher un vieux index.html
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      regs.forEach(function (r) {
        r.unregister();
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
