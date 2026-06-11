/**
 * Shell pages légales — titre + contenu injecté
 */
function initLegalPage(title, bodyHtml) {
  document.title = title + " — TORINVEST";
  const root = document.getElementById("legal-content");
  if (root) root.innerHTML = bodyHtml;
  const bc = document.getElementById("legal-breadcrumb");
  if (bc) bc.textContent = title;
}

window.initLegalPage = initLegalPage;
