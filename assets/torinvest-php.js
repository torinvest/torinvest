/**
 * Configuration hébergement hybride TORINVEST
 * -----------------------------------------
 * Netlify  → site statique (HTML/CSS/JS)
 * VPS OVH  → PHP (crypto-radar, api/)
 *
 * Modifiez phpBaseUrl avec l'URL de votre VPS une fois le sous-domaine configuré.
 * Exemple : "https://radar.torinvest-trading.com"
 * Laisser "" pour appeler /api/... sur www (Netlify proxy 200! → radar).
 */
window.TORINVEST_CONFIG = window.TORINVEST_CONFIG || {
  phpBaseUrl: "",
  /** RPC Solana (TorPass) — same-origin /api/solana-rpc.php (proxy Netlify → radar) */
  solanaRpcUrl: "",
  /** UI Chainwork (laisser "" pour masquer le bouton flottant) */
  chainworkUrl: "",
};

window.TORINVEST_PHP = {
  url: function (path) {
    var base = (window.TORINVEST_CONFIG.phpBaseUrl || "").replace(/\/$/, "");
    var p = path.charAt(0) === "/" ? path : "/" + path;
    return base ? base + p : window.location.origin + p;
  },

  solanaRpcUrl: function () {
    if (window.TORINVEST_CONFIG.solanaRpcUrl) {
      return window.TORINVEST_CONFIG.solanaRpcUrl;
    }
    return window.TORINVEST_PHP.url("/api/solana-rpc.php");
  },

  applyLinks: function () {
    document.querySelectorAll("[data-torinvest-php]").forEach(function (el) {
      var path = el.getAttribute("data-torinvest-php");
      if (!path) return;
      if (el.tagName === "A" || el.tagName === "a") {
        el.href = window.TORINVEST_PHP.url(path);
      }
    });
    var chainBtn = document.getElementById("chainworkBtn");
    var chainUrl = (window.TORINVEST_CONFIG.chainworkUrl || "").trim();
    if (chainBtn) {
      if (chainUrl) {
        chainBtn.href = chainUrl;
        chainBtn.style.display = "";
      } else {
        chainBtn.style.display = "none";
      }
    }
  },

  fetch: function (path, options) {
    return fetch(window.TORINVEST_PHP.url(path), options);
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function () {
    window.TORINVEST_PHP.applyLinks();
  });
} else {
  window.TORINVEST_PHP.applyLinks();
}
