/**
 * La Forge — hub Trading Journal (Trading Journal Pro sur radar).
 * Accès hub : Premium La Forge. App : https://radar.torinvest-trading.com/trading_journal.php
 */
(function () {
  "use strict";

  var JOURNAL_APP = "https://radar.torinvest-trading.com/trading_journal.php";

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
    if (frame && frame.src !== JOURNAL_APP) frame.src = JOURNAL_APP;
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
    var openBtn = document.getElementById("journal-open-premium");
    var loginHint = document.getElementById("journal-login-hint");
    var openTab = document.getElementById("journal-open-tab");

    if (openBtn) {
      openBtn.addEventListener("click", function () {
        setStatus("Ouverture de Trading Journal Pro…", "ok");
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
    if (openTab) {
      openTab.hidden = !premium;
      openTab.href = JOURNAL_APP;
    }

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

    setStatus(
      "Session La Forge Premium OK — connecte-toi ensuite à Trading Journal Pro si demandé.",
      "ok"
    );
    showFrame();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
