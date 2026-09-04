/**
 * La Forge — hub Trading Journal dans l'app formation.
 * Accès : abonnement Premium La Forge (même session que la formation).
 */
(function () {
  "use strict";

  var JOURNAL_APP = "/appjournal/";

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

  function apiJson(url, options) {
    var opts = options || {};
    opts.credentials = "include";
    return fetch(url, opts).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok || (j && j.ok === false)) {
          var err = new Error((j && (j.error || j.message)) || "HTTP " + r.status);
          err.payload = j || {};
          err.status = r.status;
          throw err;
        }
        return j;
      });
    });
  }

  function isPremiumMe(me) {
    if (!me) return false;
    if (me.subscribed === true || me.subscribed === 1 || me.subscribed === "true") {
      return true;
    }
    var plan = String(me.plan || "").toLowerCase();
    return plan === "premium" || plan === "subscribed";
  }

  function formatActivateError(e) {
    var p = (e && e.payload) || {};
    var parts = [];
    if (p.error) parts.push(String(p.error));
    if (p.detail && typeof p.detail === "object" && p.detail.error) {
      parts.push(String(p.detail.error));
    } else if (p.detail) {
      parts.push(String(p.detail));
    }
    if (p.hint) parts.push(String(p.hint));
    if (e && e.message && parts.indexOf(e.message) === -1) parts.push(e.message);
    return parts.join(" — ") || "activation impossible";
  }

  async function pingJournalSession() {
    try {
      return await apiJson("/api/journal-bridge/status", { method: "GET" });
    } catch (e) {
      return null;
    }
  }

  async function tryFormationBridge() {
    await apiJson("/api/journal-bridge/activate", { method: "POST" });
    return true;
  }

  async function openJournal() {
    setStatus("Ouverture du Trading Journal…", "warn");
    try {
      await tryFormationBridge();
      setStatus("Session Journal active.", "ok");
      showFrame();
    } catch (e) {
      showGate();
      setStatus("Impossible d'ouvrir le Journal : " + formatActivateError(e), "err");
    }
  }

  async function boot() {
    var openBtn = document.getElementById("journal-open-premium");
    var loginHint = document.getElementById("journal-login-hint");

    if (openBtn) {
      openBtn.addEventListener("click", function () {
        openJournal();
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
      setStatus("Connecte-toi à La Forge (email Premium) pour ouvrir le Trading Journal.", "warn");
      return;
    }

    if (!premium) {
      showGate();
      setStatus("Le Trading Journal est réservé aux abonnés La Forge Premium.", "warn");
      return;
    }

    var status = await pingJournalSession();
    if (status && status.active) {
      setStatus("Session Journal active.", "ok");
      showFrame();
      return;
    }

    await openJournal();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
