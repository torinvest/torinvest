/**
 * La Forge — hub Trading Journal Pro (iframe /journal-embed/ + secours SSO radar).
 * Screens JPG/PNG: inject HARD OFF (CSP/onclick restore — see routes-journal-bridge).
 * v15 shell: Architecture B deep-link button when iframe path fails.
 */
(function () {
  "use strict";

  var JOURNAL_APP = "/journal-embed/";

  function setStatus(text, kind) {
    var el = document.getElementById("journal-status");
    if (!el) return;
    el.textContent = text || "";
    el.className =
      "alert " + (kind === "ok" ? "alert-success" : kind === "warn" ? "alert-warn" : "alert-error");
    el.hidden = !text;
  }

  function showGate() {
    document.body.classList.remove("journal-app-open");
    var g = document.getElementById("journal-gate");
    if (g) g.hidden = false;
    var wrap = document.getElementById("journal-frame-wrap");
    if (wrap) wrap.hidden = true;
  }

  function hideGate() {
    var g = document.getElementById("journal-gate");
    if (g) g.hidden = true;
  }

  function showFrame() {
    hideGate();
    document.body.classList.add("journal-app-open");
    var wrap = document.getElementById("journal-frame-wrap");
    var frame = document.getElementById("journal-frame");
    if (wrap) wrap.hidden = false;
    if (frame && !frame.getAttribute("src")) frame.src = JOURNAL_APP;
    var rescue = document.getElementById("journal-open-radar");
    if (rescue) rescue.hidden = false;
    var rescueBar = document.getElementById("journal-open-radar-bar");
    if (rescueBar) rescueBar.hidden = false;
  }

  function isPremiumMe(me) {
    if (!me) return false;
    if (me.isAdmin === true || me.role === "admin") return true;
    if (me.subscribed === true || me.subscribed === 1 || me.subscribed === "true") {
      return true;
    }
    var plan = String(me.plan || "").toLowerCase();
    return plan === "premium" || plan === "subscribed";
  }

  async function openRadarDeepLink() {
    setStatus("Ouverture Trading Journal (onglet radar SSO)…", "ok");
    try {
      var r = await fetch("/api/journal-bridge/radar-url", {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      var data = await r.json().catch(function () {
        return {};
      });
      if (!r.ok || !data || !data.url) {
        setStatus(
          "Secours SSO indisponible (" +
            (data && data.error ? data.error : "http " + r.status) +
            "). Réessaie l’iframe ou reconnecte-toi.",
          "error"
        );
        return;
      }
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setStatus("Secours SSO échoué — vérifie la connexion.", "error");
    }
  }

  async function boot() {
    var openBtn = document.getElementById("journal-open-premium");
    var loginHint = document.getElementById("journal-login-hint");
    var radarBtn = document.getElementById("journal-open-radar");
    var radarBar = document.getElementById("journal-open-radar-bar");

    if (openBtn) {
      openBtn.addEventListener("click", function () {
        setStatus("Ouverture de Trading Journal Pro…", "ok");
        showFrame();
      });
    }
    function bindRadar(btn) {
      if (btn) btn.addEventListener("click", openRadarDeepLink);
    }
    bindRadar(radarBtn);
    bindRadar(radarBar);

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
    if (radarBtn) radarBtn.hidden = !premium;
    if (radarBar) radarBar.hidden = !premium;

    if (!me) {
      showGate();
      setStatus("Connecte-toi à La Forge (email Premium) pour ouvrir le Trading Journal.", "warn");
      return;
    }

    if (!premium) {
      showGate();
      setStatus("Le Trading Journal est réservé aux abonnés La Forge Premium.", "warn");
      return;
    }

    if (window.ForgeOnboarding && me.email) {
      ForgeOnboarding.markDone(me.email, "journal");
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
