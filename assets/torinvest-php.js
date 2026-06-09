/**
 * Configuration hébergement hybride TORINVEST
 * -----------------------------------------
 * Netlify  → site statique (HTML/CSS/JS)
 * VPS OVH  → PHP (crypto-radar, api/)
 *
 * Modifiez phpBaseUrl avec l'URL de votre VPS une fois le sous-domaine configuré.
 * Exemple : "https://radar.torinvest-trading.com"
 * Laisser "" si tout tourne sur le même serveur (VPS seul, sans Netlify).
 */
window.TORINVEST_CONFIG = window.TORINVEST_CONFIG || {
  phpBaseUrl: "https://radar.torinvest-trading.com"
};

window.TORINVEST_PHP = {
  url: function (path) {
    var base = (window.TORINVEST_CONFIG.phpBaseUrl || "").replace(/\/$/, "");
    var p = path.charAt(0) === "/" ? path : "/" + path;
    return base ? base + p : p;
  },

  applyLinks: function () {
    document.querySelectorAll("[data-torinvest-php]").forEach(function (el) {
      var path = el.getAttribute("data-torinvest-php");
      if (!path) return;
      if (el.tagName === "A" || el.tagName === "a") {
        el.href = window.TORINVEST_PHP.url(path);
      }
    });
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
