/**
 * La Forge — hub USA War Atlas (Premium → iframe /atlas-embed/).
 */
(function () {
  "use strict";

  var ATLAS_APP = "/atlas-embed/";

  function setStatus(text, kind) {
    var el = document.getElementById("atlas-status");
    if (!el) return;
    el.textContent = text || "";
    el.className =
      "alert " + (kind === "ok" ? "alert-success" : kind === "warn" ? "alert-warn" : "alert-error");
    el.hidden = !text;
  }

  function showGate() {
    document.body.classList.remove("atlas-app-open");
    var g = document.getElementById("atlas-gate");
    if (g) g.hidden = false;
  }

  function hideGate() {
    var g = document.getElementById("atlas-gate");
    if (g) g.hidden = true;
  }

  function showFrame() {
    hideGate();
    document.body.classList.add("atlas-app-open");
    var wrap = document.getElementById("atlas-frame-wrap");
    var frame = document.getElementById("atlas-frame");
    if (wrap) wrap.hidden = false;
    if (frame) frame.src = ATLAS_APP;
  }

  function isPremiumMe(me) {
    if (!me) return false;
    if (me.subscribed === true || me.subscribed === 1 || me.subscribed === "true") {
      return true;
    }
    var plan = String(me.plan || "").toLowerCase();
    return plan === "premium" || plan === "subscribed";
  }

  async function boot() {
    var openBtn = document.getElementById("atlas-open-premium");
    var loginHint = document.getElementById("atlas-login-hint");

    if (openBtn) {
      openBtn.addEventListener("click", function () {
        setStatus("Ouverture de USA War Atlas…", "ok");
        showFrame();
      });
    }

    var me = null;
    try {
      if (typeof getMe === "function") {
        me = await getMe();
      }
    } catch (e) {
      me = null;
    }

    var premium = isPremiumMe(me);
    if (loginHint) loginHint.hidden = !!me;
    if (openBtn) openBtn.hidden = !premium;

    if (!me) {
      showGate();
      setStatus("Connecte-toi à La Forge (email Premium) pour ouvrir Atlas.", "warn");
      return;
    }

    if (!premium) {
      showGate();
      setStatus("USA War Atlas est réservé aux abonnés La Forge Premium.", "warn");
      return;
    }

    if (window.ForgeOnboarding && me.email) {
      ForgeOnboarding.markDone(me.email, "atlas");
    }

    setStatus("Ouverture automatique — session La Forge Premium.", "ok");
    showFrame();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
