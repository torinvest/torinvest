/**
 * TORINVEST — Bandeau cookies & consentement RGPD
 * Charge AdSense uniquement après consentement marketing.
 */
(function () {
  var STORAGE_KEY = "torinvest_cookie_consent_v1";
  var ADSENSE_CLIENT = "ca-pub-7026076448428574";

  var defaultConsent = {
    necessary: true,
    analytics: false,
    marketing: false,
    date: null
  };

  function getConsent() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveConsent(consent) {
    consent.date = new Date().toISOString();
    consent.necessary = true;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
    applyConsent(consent);
    hideBanner();
  }

  function loadAdSense() {
    if (document.querySelector('script[data-torinvest-adsense]')) return;
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(ADSENSE_CLIENT);
    s.crossOrigin = "anonymous";
    s.setAttribute("data-torinvest-adsense", "1");
    document.head.appendChild(s);
  }

  function applyConsent(consent) {
    if (consent.marketing) loadAdSense();
    window.torinvestConsent = consent;
    document.dispatchEvent(new CustomEvent("torinvest:consent", { detail: consent }));
  }

  function injectStyles() {
    if (document.getElementById("torinvest-rgpd-style")) return;
    var css = document.createElement("style");
    css.id = "torinvest-rgpd-style";
    css.textContent = [
      "#torinvest-rgpd-banner{position:fixed;inset:auto 16px 16px 16px;z-index:100000;",
      "max-width:560px;margin:0 auto;padding:18px 18px 16px;border-radius:18px;",
      "background:rgba(8,8,14,.96);border:1px solid rgba(255,180,0,.28);",
      "box-shadow:0 18px 50px rgba(0,0,0,.55);color:#f6f6f8;font-family:system-ui,sans-serif;font-size:13px;line-height:1.5}",
      "#torinvest-rgpd-banner h3{margin:0 0 8px;font-size:15px;color:#ffb400}",
      "#torinvest-rgpd-banner p{margin:0 0 12px;color:#9a9aad}",
      "#torinvest-rgpd-banner .rgpd-links{margin-bottom:12px}",
      "#torinvest-rgpd-banner .rgpd-links a{color:#ffb400;text-decoration:underline}",
      "#torinvest-rgpd-banner .rgpd-actions{display:flex;flex-wrap:wrap;gap:8px}",
      "#torinvest-rgpd-banner button{border:none;border-radius:999px;padding:10px 14px;font-weight:700;cursor:pointer;font-size:12px}",
      "#torinvest-rgpd-banner .rgpd-accept{background:linear-gradient(135deg,#ffb400,#ff4b5c);color:#1b1200}",
      "#torinvest-rgpd-banner .rgpd-refuse,#torinvest-rgpd-banner .rgpd-custom{background:rgba(255,255,255,.06);color:#f6f6f8;border:1px solid rgba(255,255,255,.12)!important}",
      "#torinvest-rgpd-panel{display:none;margin:10px 0 12px;padding:10px;border-radius:12px;background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.08)}",
      "#torinvest-rgpd-panel label{display:flex;align-items:flex-start;gap:8px;margin:8px 0;color:#c8c8d4;font-size:12px}",
      "#torinvest-rgpd-panel input{margin-top:2px}",
      ".torinvest-rgpd-manage{position:fixed;left:16px;bottom:16px;z-index:99998;padding:8px 12px;border-radius:999px;",
      "background:rgba(8,8,14,.9);border:1px solid rgba(255,255,255,.12);color:#9a9aad;font-size:11px;cursor:pointer}",
      "@media(max-width:560px){#torinvest-rgpd-banner{inset:auto 10px 10px 10px}.torinvest-rgpd-manage{left:10px;bottom:10px}}"
    ].join("");
    document.head.appendChild(css);
  }

  function hideBanner() {
    var b = document.getElementById("torinvest-rgpd-banner");
    if (b) b.remove();
    showManageButton();
  }

  function showManageButton() {
    if (document.querySelector(".torinvest-rgpd-manage")) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "torinvest-rgpd-manage";
    btn.textContent = "Cookies";
    btn.setAttribute("aria-label", "Gérer les cookies");
    btn.onclick = showBanner;
    document.body.appendChild(btn);
  }

  function showBanner() {
    var existing = document.getElementById("torinvest-rgpd-banner");
    if (existing) return;

    injectStyles();
    var current = getConsent() || defaultConsent;

    var el = document.createElement("div");
    el.id = "torinvest-rgpd-banner";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", "Consentement cookies");
    el.innerHTML = [
      "<h3>Respect de votre vie privée</h3>",
      "<p>Nous utilisons des cookies nécessaires au fonctionnement du site et, avec votre accord, des cookies publicitaires (Google AdSense). Vous pouvez accepter, refuser ou personnaliser.</p>",
      "<div class=\"rgpd-links\"><a href=\"/confidentialite.html\">Confidentialité</a> · <a href=\"/cookies.html\">Politique cookies</a> · <a href=\"/mentions-legales.html\">Mentions légales</a></div>",
      "<div id=\"torinvest-rgpd-panel\">",
      "  <label><input type=\"checkbox\" checked disabled> Cookies nécessaires (obligatoires)</label>",
      "  <label><input type=\"checkbox\" id=\"rgpd-analytics\" " + (current.analytics ? "checked" : "") + "> Mesure d'audience</label>",
      "  <label><input type=\"checkbox\" id=\"rgpd-marketing\" " + (current.marketing ? "checked" : "") + "> Publicité (Google AdSense)</label>",
      "</div>",
      "<div class=\"rgpd-actions\">",
      "  <button type=\"button\" class=\"rgpd-accept\">Tout accepter</button>",
      "  <button type=\"button\" class=\"rgpd-refuse\">Tout refuser</button>",
      "  <button type=\"button\" class=\"rgpd-custom\">Enregistrer mes choix</button>",
      "</div>"
    ].join("");

    document.body.appendChild(el);

    el.querySelector(".rgpd-accept").onclick = function () {
      saveConsent({ necessary: true, analytics: true, marketing: true });
    };
    el.querySelector(".rgpd-refuse").onclick = function () {
      saveConsent({ necessary: true, analytics: false, marketing: false });
    };
    el.querySelector(".rgpd-custom").onclick = function () {
      saveConsent({
        necessary: true,
        analytics: !!document.getElementById("rgpd-analytics").checked,
        marketing: !!document.getElementById("rgpd-marketing").checked
      });
    };
  }

  injectStyles();
  var saved = getConsent();
  if (saved) {
    applyConsent(saved);
    showManageButton();
  } else {
    showBanner();
  }

  window.TORINVEST_RGPD = {
    getConsent: getConsent,
    openSettings: showBanner,
    reset: function () {
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    }
  };
})();
