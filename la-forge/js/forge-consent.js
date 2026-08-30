/**
 * Bandeau cookies — vitrine La Forge uniquement (pas espace membre).
 * AdSense chargé seulement après acceptation.
 */
(function () {
  const CONSENT_KEY = "torinvest_forge_cookie_consent";
  const AD_CLIENT = "ca-pub-7026076448428574";

  function isMemberPage() {
    return Boolean(document.querySelector("[data-forge-member-header]"));
  }

  function loadAdSense() {
    if (document.querySelector("script[src*='adsbygoogle']")) return;
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + AD_CLIENT;
    s.crossOrigin = "anonymous";
    document.head.appendChild(s);
  }

  function saveConsent(choice) {
    try {
      localStorage.setItem(CONSENT_KEY, choice);
    } catch (_) {}
    if (choice === "accept") loadAdSense();
  }

  function showBanner() {
    if (document.getElementById("forge-cookie-banner")) return;
    const bar = document.createElement("div");
    bar.id = "forge-cookie-banner";
    bar.className = "forge-cookie-banner";
    bar.setAttribute("role", "dialog");
    bar.setAttribute("aria-label", "Consentement cookies");
    bar.innerHTML =
      '<div class="forge-cookie-inner">' +
      "<p><strong>Cookies</strong> — Nous utilisons des cookies techniques (session, progression locale) " +
      "et, si vous acceptez, des cookies publicitaires (Google AdSense). " +
      '<a href="/la-forge/legal/cookies.html">Politique cookies</a></p>' +
      '<div class="forge-cookie-actions">' +
      '<button type="button" class="btn btn-secondary" data-consent="reject">Refuser les pubs</button>' +
      '<button type="button" class="btn btn-primary" data-consent="accept">Accepter</button>' +
      "</div></div>";
    document.body.appendChild(bar);
    bar.querySelectorAll("[data-consent]").forEach((btn) => {
      btn.addEventListener("click", () => {
        saveConsent(btn.dataset.consent);
        bar.remove();
      });
    });
  }

  function initForgeConsent() {
    if (isMemberPage()) return;
    let prior = null;
    try {
      prior = localStorage.getItem(CONSENT_KEY);
    } catch (_) {}
    if (prior === "accept") {
      loadAdSense();
      return;
    }
    if (prior === "reject") return;
    showBanner();
  }

  window.initForgeConsent = initForgeConsent;
  document.addEventListener("DOMContentLoaded", initForgeConsent);
})();
