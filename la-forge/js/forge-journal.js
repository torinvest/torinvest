/**
 * La Forge — Trading Journal Pro.
 * v16 DEFAULT: ouverture SSO directe sur radar (TJ natif) — menus/clics OK.
 * Iframe /journal-embed/ = mode optionnel (?embed=1 ou « Mode intégré »).
 */
(function () {
  "use strict";

  var JOURNAL_APP = "/journal-embed/";
  var wantEmbed =
    /(?:\?|&)embed=1(?:&|$)/.test(String(location.search || "")) ||
    localStorage.getItem("forge_journal_embed") === "1";

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
    if (frame) frame.src = JOURNAL_APP;
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

  function goTop(url) {
    try {
      if (window.top && window.top.location) {
        window.top.location = url;
        return;
      }
    } catch (e) {
      /* cross-origin top — fall through */
    }
    window.location.href = url;
  }

  async function fetchRadarUrl() {
    var r = await fetch("/api/journal-bridge/radar-url", {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    var data = await r.json().catch(function () {
      return {};
    });
    if (!r.ok || !data || !data.url) {
      var err = new Error((data && data.error) || "http_" + r.status);
      err.data = data;
      throw err;
    }
    return data.url;
  }

  /** Default path: top-level navigation to native TJ (no iframe proxy). */
  async function openRadarDirect() {
    setStatus("Ouverture Trading Journal Pro (SSO)…", "ok");
    try {
      var url = await fetchRadarUrl();
      goTop(url);
    } catch (e) {
      setStatus(
        "SSO indisponible (" +
          (e && e.message ? e.message : "erreur") +
          "). Réessaie ou passe en mode intégré.",
        "error"
      );
      showGate();
    }
  }

  async function boot() {
    var openBtn = document.getElementById("journal-open-premium");
    var embedBtn = document.getElementById("journal-open-embed");
    var loginHint = document.getElementById("journal-login-hint");

    if (openBtn) {
      openBtn.addEventListener("click", function () {
        localStorage.removeItem("forge_journal_embed");
        openRadarDirect();
      });
    }
    if (embedBtn) {
      embedBtn.addEventListener("click", function () {
        localStorage.setItem("forge_journal_embed", "1");
        setStatus("Mode intégré (iframe) — menus peuvent rester limités.", "warn");
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
    if (embedBtn) embedBtn.hidden = !premium;

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

    if (wantEmbed) {
      setStatus("Mode intégré — préfère « Ouvrir Trading Journal Pro » si clics cassés.", "warn");
      showFrame();
      return;
    }

    setStatus("Redirection Trading Journal Pro…", "ok");
    await openRadarDirect();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
