/**
 * La Forge — intégration appli Fondamental (session Premium → www/applifonda).
 */
(function () {
  "use strict";

  var WWW = "https://www.torinvest-trading.com";
  var FONDA_API = WWW + "/api/fondamental-access.php";
  var FONDA_APP = WWW + "/applifonda/";

  function setStatus(text, kind) {
    var el = document.getElementById("fonda-status");
    if (!el) return;
    el.textContent = text || "";
    el.className = "alert " + (kind === "ok" ? "alert-success" : kind === "warn" ? "alert-warn" : "alert-error");
    el.hidden = !text;
  }

  function showFrame() {
    var wrap = document.getElementById("fonda-frame-wrap");
    var frame = document.getElementById("fonda-frame");
    if (wrap) wrap.hidden = false;
    if (frame) frame.src = FONDA_APP;
  }

  function apiJson(url, options) {
    return fetch(url, options || {}).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok || j && j.ok === false) {
          var err = new Error((j && (j.error || j.message)) || "HTTP " + r.status);
          err.payload = j || {};
          err.status = r.status;
          throw err;
        }
        return j;
      });
    });
  }

  async function tryFormationBridge() {
    setStatus("Connexion à Fondamental via votre abonnement La Forge…", "ok");
    var bridge = await apiJson("/api/fondamental-bridge", { credentials: "include" });
    await apiJson(FONDA_API, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "login_formation_bridge",
        bridgeToken: bridge.bridgeToken,
      }),
    });
    setStatus("Accès Fondamental ouvert — chargement de l'application…", "ok");
    showFrame();
  }

  async function initFondamentalEmbed() {
    var locked = document.getElementById("fonda-locked");
    var me = typeof getMe === "function" ? await getMe() : null;
    if (!me) {
      window.location.href =
        "/login.html?next=" + encodeURIComponent("/fondamental.html");
      return;
    }
    if (!me.subscribed) {
      if (locked) locked.hidden = false;
      setStatus(
        "Fondamental est inclus dans l'abonnement La Forge Premium (349€/an).",
        "warn"
      );
      return;
    }
    try {
      await tryFormationBridge();
    } catch (e) {
      var code = (e.payload && e.payload.error) || e.message || "";
      if (code === "bridge_not_configured") {
        setStatus(
          "Pont serveur en cours d'activation — ouvrez Fondamental sur le site principal (Phantom + KRM).",
          "warn"
        );
      } else {
        setStatus(
          "Ouverture via le site principal : Phantom ou session KRM TorPass ACADEMY.",
          "warn"
        );
      }
      var fallback = document.getElementById("fonda-fallback");
      if (fallback) fallback.hidden = false;
    }
  }

  document.addEventListener("DOMContentLoaded", initFondamentalEmbed);

  window.ForgeFondamental = {
    openExternal: function () {
      window.open(FONDA_APP, "_blank", "noopener,noreferrer");
    },
  };
})();
