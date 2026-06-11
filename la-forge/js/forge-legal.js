/**
 * TORINVEST — Mentions légales · CGU · CGV · RGPD
 * Complétez les champs [À COMPLÉTER] avant mise en production.
 */
const FORGE_LEGAL = {
  site: "https://www.torinvest-trading.com",
  domain: "torinvest-trading.com",
  brand: "TORINVEST",
  email: "contact@torinvest-trading.com",
  emailLegal: "legal@torinvest-trading.com",
  editor: {
    name: "[À COMPLÉTER — Raison sociale / Nom]",
    legalForm: "[À COMPLÉTER — Auto-entrepreneur / SASU / etc.]",
    address: "[À COMPLÉTER — Adresse postale]",
    country: "France",
    siret: "[À COMPLÉTER — SIRET]",
    tva: "[À COMPLÉTER — TVA intracommunautaire ou N/A]",
    director: "[À COMPLÉTER — Directeur de publication]",
  },
  hosting: {
    site: "Netlify, Inc. — 512 2nd Street, Fl 2, San Francisco, CA 94107, USA",
    app: "OVH SAS — 2 rue Kellermann, 59100 Roubaix, France (VPS application formation)",
    worker: "Cloudflare, Inc. — Worker TORINVEST (API MT5 · signaux · licences)",
  },
  offers: {
    signalPublic: "Gratuit — aperçu signaux dashboard",
    robotAccess: "79 €/mois TTC (promo) — EA MT5 + Worker",
    formation: "349 €/an TTC (offre lancement) — La Forge ICT-SMC ÉLITE",
  },
  lastUpdate: "10 juin 2026",
};

const LEGAL_PAGES = [
  { href: "/la-forge/legal/mentions-legales.html", label: "Mentions légales" },
  { href: "/la-forge/legal/cgu.html", label: "CGU" },
  { href: "/la-forge/legal/cgv.html", label: "CGV" },
  { href: "/la-forge/legal/confidentialite.html", label: "Confidentialité" },
  { href: "/la-forge/legal/cookies.html", label: "Cookies" },
  { href: "/la-forge/legal/avertissement-risques.html", label: "Avertissement risques" },
];

function renderLegalLinksHtml(separator) {
  const sep = separator || " · ";
  return LEGAL_PAGES.map((p) => '<a href="' + p.href + '">' + p.label + "</a>").join(sep);
}

function renderLegalBarHtml(options) {
  const opts = options || {};
  const includeLinks = opts.includeLinks !== false && !document.querySelector(".forge-footer");
  let html =
    '<div class="legal-bar-inner">' +
    '<p class="legal-risk">' +
    "<strong>Avertissement :</strong> Le trading comporte un risque élevé de perte en capital. " +
    "Les performances passées ne garantissent pas les résultats futurs. " +
    "TORINVEST ne fournit pas de conseil en investissement personnalisé. " +
    "Robot Access / signaux ≠ garantie de profit. " +
    '<a href="/la-forge/legal/avertissement-risques.html">En savoir plus</a>.' +
    "</p>";
  if (includeLinks) {
    html +=
      '<nav class="legal-nav" aria-label="Mentions légales">' +
      renderLegalLinksHtml(" · ") +
      ' · <a href="mailto:' +
      FORGE_LEGAL.emailLegal +
      '">' +
      FORGE_LEGAL.emailLegal +
      "</a></nav>";
  }
  html += "</div>";
  return html;
}

function renderLegalFooterBlock() {
  return (
    '<div class="footer-legal">' +
    renderLegalBarHtml() +
    '<p class="footer-copy">© ' +
    new Date().getFullYear() +
    " " +
    FORGE_LEGAL.brand +
    " · " +
    FORGE_LEGAL.domain +
    " · Dernière mise à jour documents : " +
    FORGE_LEGAL.lastUpdate +
    "</p></div>"
  );
}

function injectLegalBar() {
  if (document.getElementById("forge-legal-bar")) return;
  const bar = document.createElement("aside");
  bar.id = "forge-legal-bar";
  bar.className = "legal-bar";
  bar.setAttribute("role", "contentinfo");
  bar.innerHTML = renderLegalBarHtml();
  document.body.appendChild(bar);
}

function initLegalCompliance() {
  injectLegalBar();
}

document.addEventListener("DOMContentLoaded", initLegalCompliance);

window.FORGE_LEGAL = FORGE_LEGAL;
window.LEGAL_PAGES = LEGAL_PAGES;
window.renderLegalLinksHtml = renderLegalLinksHtml;
window.initLegalCompliance = initLegalCompliance;
