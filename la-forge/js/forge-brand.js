/**
 * TORINVEST — La Forge · branding & réseaux
 * Modifier les URLs social ici (une seule source de vérité).
 */
const FORGE_BRAND = {
  name: "La Forge",
  title: "La Forge ICT-SMC-PRICE ACTION — ÉLITE",
  slogan: "La force d'un esprit libre",
  site: "torinvest-trading.com",
  /** Site principal TORINVEST (hors app formation) — URL absolue pour app.* */
  homeUrl: "https://www.torinvest-trading.com/",
  logos: {
    anvil: "/la-forge/img/forge-anvil.png?v=20260630",
    full: "/la-forge/img/torinvest-logo-full.png?v=20260630",
    liveBanner: "/la-forge/img/live-trading-banner.png",
    bull: "/la-forge/img/icon-bull.svg?v=1",
    bear: "/la-forge/img/icon-bear.svg?v=1",
  },
  social: {
    youtube: {
      label: "YouTube Live",
      hint: "Live trading · présentations · Q&A",
      url: "https://www.youtube.com/@ONZERtv",
      color: "#ff0000",
    },
    tiktok: {
      label: "TikTok",
      hint: "Clips · replays · coulisses",
      url: "https://www.tiktok.com/@live_b00stfr?lang=fr",
      color: "#00f2ea",
    },
    kick: {
      label: "Kick",
      hint: "Sessions live interactives",
      url: "https://kick.com/onzertv",
      color: "#53fc18",
    },
    discord: {
      label: "Discord",
      hint: "Communauté · entraide · annonces",
      url: "https://discord.gg/vwkPp2aeEM",
      color: "#5865f2",
    },
  },
};

function forgeMainSiteHref() {
  return FORGE_BRAND.homeUrl || "https://www.torinvest-trading.com/";
}

function forgeWwwOrigin() {
  return "https://www.torinvest-trading.com";
}

function isForgeAppHost() {
  return typeof window !== "undefined" && window.location.hostname === "app.torinvest-trading.com";
}

function forgePublicUrl(path) {
  const p = path.startsWith("/") ? path : "/" + path;
  if (isForgeAppHost()) {
    return forgeWwwOrigin() + p;
  }
  return p;
}

/** App VPS : logos en même origine (/img) — Helmet img-src 'self' bloque www. */
function applyForgeAppLogos() {
  if (!isForgeAppHost()) return;
  FORGE_BRAND.logos = {
    anvil: "/img/forge-anvil.png?v=20260630",
    full: "/img/torinvest-logo-full.png?v=20260630",
    liveBanner: "/img/live-trading-banner.png",
    bull: "/img/icon-bull.svg?v=1",
    bear: "/img/icon-bear.svg?v=1",
  };
}

function rewriteForgeAssetUrls() {
  if (!isForgeAppHost()) return;
  const toLocal = (url) => {
    if (!url) return url;
    return url
      .replace("https://www.torinvest-trading.com/la-forge/img/", "/img/")
      .replace("/la-forge/img/", "/img/");
  };
  document.querySelectorAll("img[src*='la-forge/img/'], img[src^='/img/']").forEach((el) => {
    el.src = toLocal(el.getAttribute("src"));
  });
  document.querySelectorAll('link[rel="icon"]').forEach((el) => {
    const href = el.getAttribute("href") || "";
    if (href.includes("la-forge/img/") || href.startsWith("/img/")) {
      el.href = toLocal(href);
    }
  });
}

/** Lien nav + bouton fixe vers le site principal (toutes pages formation). */
function forgeBackHomeNavHtml() {
  return (
    '<a href="' +
    forgeMainSiteHref() +
    '" class="forge-back-home-nav" aria-label="Retour au site principal TORINVEST">← Site principal</a>'
  );
}

function initForgeBackHome() {
  if (document.getElementById("forge-back-home-btn")) return;
  if (!document.getElementById("forge-back-home-style")) {
    const style = document.createElement("style");
    style.id = "forge-back-home-style";
    style.textContent =
      ".forge-back-home-nav{color:#e8b84a!important;font-weight:700;padding:.35rem .7rem;border:1px solid rgba(232,184,74,.45);border-radius:999px;text-decoration:none!important}" +
      ".forge-back-home-nav:hover{background:rgba(249,115,22,.18);border-color:rgba(250,204,21,.7);color:#fff7d6!important}" +
      ".forge-back-home-btn{position:fixed;bottom:max(16px,env(safe-area-inset-bottom));left:max(14px,env(safe-area-inset-left));z-index:10000;padding:9px 14px;font-size:12px;font-weight:700;text-decoration:none;border-radius:999px;background:rgba(8,12,20,.92);border:1px solid rgba(232,184,74,.5);color:#facc15;backdrop-filter:blur(6px);box-shadow:0 8px 24px rgba(0,0,0,.35)}" +
      ".forge-back-home-btn:hover{background:rgba(249,115,22,.28);border-color:rgba(250,204,21,.75);color:#fff7d6}";
    document.head.appendChild(style);
  }
  const a = document.createElement("a");
  a.id = "forge-back-home-btn";
  a.className = "forge-back-home-btn";
  a.href = forgeMainSiteHref();
  a.setAttribute("aria-label", "Retour au site principal TORINVEST");
  a.textContent = "← Site principal";
  document.body.appendChild(a);
}


/** Icônes marché (taureau / ours) — couleur via CSS currentColor. */
function forgeMarketIconSvg(side) {
  const s = String(side || "").toLowerCase();
  if (s === "bear" || s === "bearish" || s === "ours") {
    return (
      '<svg class="forge-mkt-icon" viewBox="0 0 64 64" width="18" height="18" aria-hidden="true" focusable="false">' +
      '<circle cx="18" cy="18" r="10" fill="currentColor"/>' +
      '<circle cx="46" cy="18" r="10" fill="currentColor"/>' +
      '<path fill="currentColor" d="M12 28c0-10 8-18 20-18s20 8 20 18v10c0 12-8 20-20 20S12 50 12 38V28z"/>' +
      '<circle cx="24" cy="34" r="3.5" fill="#0a0a0f"/>' +
      '<circle cx="40" cy="34" r="3.5" fill="#0a0a0f"/>' +
      '<ellipse cx="32" cy="42" rx="5" ry="3.5" fill="#0a0a0f"/>' +
      "</svg>"
    );
  }
  return (
    '<svg class="forge-mkt-icon" viewBox="0 0 64 64" width="18" height="18" aria-hidden="true" focusable="false">' +
    '<path fill="currentColor" d="M8 22c2-8 10-14 18-14h12c8 0 16 6 18 14l4 14c1 4-1 8-5 9l-6 2v7c0 4-3 7-7 7H22c-4 0-7-3-7-7v-7l-6-2c-4-1-6-5-5-9l4-14z"/>' +
    '<path fill="#0a0a0f" d="M24 34a4 4 0 1 0 .01 0zm16 0a4 4 0 1 0 .01 0z"/>' +
    '<path stroke="#0a0a0f" stroke-width="2.5" stroke-linecap="round" d="M28 44c2.5 3 5.5 3 8 0"/>' +
    '<path fill="currentColor" d="M6 18c-2-6 2-12 8-10 3 1 5 4 6 8l-8 4c-3 1-5-.5-6-2zm52 0c2-6-2-12-8-10-3 1-5 4-6 8l8 4c3 1 5-.5 6-2z"/>' +
    "</svg>"
  );
}

function forgeBiasChipHtml(side, label) {
  const s = String(side || "bull").toLowerCase();
  const cls = s === "bear" || s === "bearish" || s === "ours" ? "bear" : "bull";
  const text =
    label ||
    (cls === "bear" ? "Bearish · pression vendeuse" : "Bullish · pression acheteuse");
  return (
    '<span class="forge-bias-chip ' +
    cls +
    '">' +
    forgeMarketIconSvg(cls) +
    "<span>" +
    text +
    "</span></span>"
  );
}

/** Emblème Forge animé (anneau or + enclume). */
function forgeEmblemHtml(opts) {
  const o = opts || {};
  const size = o.size || 120;
  return (
    '<div class="forge-emblem" style="--emblem-size:' +
    size +
    'px" role="img" aria-label="La Forge TORINVEST">' +
    '<span class="forge-emblem-ring" aria-hidden="true"></span>' +
    '<img src="' +
    FORGE_BRAND.logos.anvil +
    '" alt="" class="forge-emblem-core" width="' +
    Math.round(size * 0.58) +
    '" height="' +
    Math.round(size * 0.58) +
    '" decoding="async" />' +
    '<span class="forge-emblem-spark" aria-hidden="true"></span>' +
    '<span class="forge-emblem-spark" aria-hidden="true"></span>' +
    '<span class="forge-emblem-spark" aria-hidden="true"></span>' +
    "</div>"
  );
}

function forgeMarketLegendHtml() {
  return (
    '<div class="forge-bias-row" aria-label="Légende biais de marché">' +
    forgeBiasChipHtml("bull", "Bullish (taureau)") +
    forgeBiasChipHtml("bear", "Bearish (ours)") +
    '<span class="forge-bias-chip forge"><img src="' +
    FORGE_BRAND.logos.anvil +
    '" alt="" width="16" height="16" />La Forge</span>' +
    "</div>"
  );
}

function initForgeAmbient() {
  document.body.classList.add("forge-ambient");
  document.querySelectorAll(".forge-logo-img, .footer-anvil").forEach((img) => {
    img.classList.add("forge-logo-img");
  });
  document.querySelectorAll("[data-forge-emblem]").forEach((el) => {
    const size = Number(el.getAttribute("data-forge-emblem")) || 120;
    el.innerHTML = forgeEmblemHtml({ size: size });
  });
  document.querySelectorAll("[data-forge-market-legend]").forEach((el) => {
    el.innerHTML = forgeMarketLegendHtml();
  });
  document.querySelectorAll(".legend .l-bull, .legend .l-bear").forEach((el) => {
    if (el.querySelector(".forge-mkt-icon")) return;
    const side = el.classList.contains("l-bear") ? "bear" : "bull";
    el.insertAdjacentHTML("afterbegin", forgeMarketIconSvg(side));
  });
}

function forgeLogoHtml(size) {
  const s = size || "header";
  if (s === "header") {
    return (
      '<a href="' + forgePublicUrl("/la-forge/") + '" class="forge-logo forge-logo-header" aria-label="TORINVEST La Forge">' +
      '<img src="' + FORGE_BRAND.logos.anvil + '" alt="" width="36" height="36" class="forge-logo-img" decoding="async" />' +
      '<span class="forge-logo-text forge-logo-compact">' +
      '<strong>TORINVEST</strong>' +
      '<span class="forge-logo-sub">LA FORGE</span>' +
      "</span></a>"
    );
  }
  const cls = s === "hero" ? "forge-logo forge-logo-hero" : "forge-logo forge-logo-header";
  return (
    '<a href="' + forgePublicUrl("/la-forge/") + '" class="' + cls + '" aria-label="TORINVEST La Forge">' +
    '<img src="' + FORGE_BRAND.logos.anvil + '" alt="La Forge — enclume TORINVEST" class="forge-logo-img" width="' + (s === "hero" ? 120 : 44) + '" height="' + (s === "hero" ? 120 : 44) + '" decoding="async" />' +
    '<span class="forge-logo-text">' +
    '<strong>TORINVEST</strong>' +
    '<span class="forge-logo-sub">LA FORGE</span>' +
    '<em>' + FORGE_BRAND.slogan + '</em>' +
    "</span></a>"
  );
}

function forgeNavHref(path) {
  const onLaForge =
    window.location.pathname.startsWith("/la-forge/") || window.location.pathname === "/la-forge";
  if (path === "/#live" && onLaForge) return "/la-forge/#live";
  if (path === "/" && onLaForge) return "/la-forge/";
  return path;
}

function renderForgeHeader(active, extraNav) {
  const nav = [
    { id: "accueil", href: forgeNavHref("/"), label: "Accueil" },
    { id: "live", href: forgeNavHref("/#live"), label: "Live" },
    { id: "tarifs", href: "/la-forge/pricing.html", label: "Tarifs" },
    { id: "connexion", href: "https://app.torinvest-trading.com/login.html", label: "Connexion" },
  ];
  let navHtml =
    forgeBackHomeNavHtml() +
    nav
      .map((n) => '<a href="' + n.href + '"' + (active === n.id ? ' class="active"' : "") + ">" + n.label + "</a>")
      .join("");
  if (extraNav) navHtml += extraNav;
  return (
    '<div class="header-brand">' + forgeLogoHtml("header") + "</div>" +
    '<nav class="header-nav">' + navHtml + "</nav>"
  );
}

function renderForgeFooter() {
  const social = Object.keys(FORGE_BRAND.social)
    .map((k) => {
      const s = FORGE_BRAND.social[k];
      return '<a class="social-pill" href="' + s.url + '" target="_blank" rel="noopener noreferrer" style="--pill-color:' + s.color + '">' + s.label + "</a>";
    })
    .join("");
  return (
    '<div class="footer-brand">' +
    '<img src="' + FORGE_BRAND.logos.anvil + '" alt="" width="36" height="36" class="footer-anvil" />' +
    "<div><strong>" + FORGE_BRAND.title + "</strong><br/><em>" + FORGE_BRAND.slogan + "</em></div>" +
    "</div>" +
    '<div class="footer-social">' + social + "</div>" +
    '<nav class="footer-legal-nav" aria-label="Mentions légales">' +
    '<a href="' + forgePublicUrl("/la-forge/legal/mentions-legales.html") + '">Mentions légales</a> · <a href="' + forgePublicUrl("/la-forge/legal/cgu.html") + '">CGU</a> · <a href="' + forgePublicUrl("/la-forge/legal/cgv.html") + '">CGV</a> · <a href="' + forgePublicUrl("/la-forge/legal/confidentialite.html") + '">Confidentialité</a> · <a href="' + forgePublicUrl("/la-forge/legal/cookies.html") + '">Cookies</a> · <a href="' + forgePublicUrl("/la-forge/legal/avertissement-risques.html") + '">Avertissement risques</a>' +
    "</nav>" +
    "<p class=\"footer-copy\">© TORINVEST · " + FORGE_BRAND.site + " · La force d'un esprit libre · Pas de promesses, que des processus.</p>"
  );
}

function renderLiveSection() {
  const cards = Object.keys(FORGE_BRAND.social)
    .map((k) => {
      const s = FORGE_BRAND.social[k];
      return (
        '<a class="live-card" href="' + s.url + '" target="_blank" rel="noopener noreferrer" style="--live-accent:' + s.color + '">' +
        "<h4>" + s.label + "</h4>" +
        "<p>" + s.hint + "</p>" +
        '<span class="live-card-cta">Rejoindre →</span></a>'
      );
    })
    .join("");
  return (
    '<div class="live-section-inner">' +
    '<div class="live-banner-col">' +
    '<img src="' + FORGE_BRAND.logos.liveBanner + '" alt="Live Trading TORINVEST — présentation et démonstration" class="live-banner-img" />' +
    '<p class="live-tagline">La vérité du marché, en direct. Pas de promesses, que des faits.</p>' +
    "</div>" +
    '<div class="live-cards-col"><h3>Retrouvez-moi en live</h3><p class="live-lead">Sessions live trading, replays chart, Q&A communauté — complétez la formation par le terrain.</p><div class="live-cards-grid">' +
    cards +
    "</div></div></div>"
  );
}

function initForgeHeader(active, extraNav) {
  document.querySelectorAll("[data-forge-header]").forEach((el) => {
    el.className = "site-header";
    el.innerHTML = renderForgeHeader(active || el.dataset.forgeHeader || "", extraNav || "");
  });
}

function initForgeFooter() {
  document.querySelectorAll("[data-forge-footer]").forEach((el) => {
    el.className = "site-footer forge-footer";
    el.innerHTML = renderForgeFooter();
  });
}

function initLiveSection() {
  const el = document.getElementById("live-section-root");
  if (el) el.innerHTML = renderLiveSection();
}

function initMemberHeader(active) {
  const nav =
    forgeBackHomeNavHtml() +
    '<a href="https://app.torinvest-trading.com/dashboard.html"' + (active === "dashboard" ? ' class="active"' : "") + ">Dashboard</a>" +
    '<a href="https://app.torinvest-trading.com/start.html"' + (active === "start" ? ' class="active"' : "") + ">Premiers pas</a>" +
    '<a href="https://app.torinvest-trading.com/course/index.html"' + (active === "course" ? ' class="active"' : "") + ">Formation</a>" +
    '<a href="https://app.torinvest-trading.com/fondamental.html"' + (active === "fondamental" ? ' class="active"' : "") + ">Fondamental</a>" +
    '<a href="https://app.torinvest-trading.com/journal.html"' + (active === "journal" ? ' class="active"' : "") + ">Journal</a>" +
    '<a href="https://app.torinvest-trading.com/atlas.html"' + (active === "atlas" ? ' class="active"' : "") + ">Atlas</a>" +
    '<a href="https://app.torinvest-trading.com/books.html"' + (active === "books" ? ' class="active"' : "") + ">Livres</a>" +
    '<a href="https://app.torinvest-trading.com/calendar.html"' + (active === "calendar" ? ' class="active"' : "") + ">Calendrier</a>" +
    '<a href="' + forgePublicUrl("/la-forge/#live") + '"' + (active === "live" ? ' class="active"' : "") + ">Live</a>" +
    '<a href="#" id="logout-btn">Déconnexion</a>';
  document.querySelectorAll("[data-forge-member-header]").forEach((el) => {
    el.className = "site-header";
    el.innerHTML = '<div class="header-brand">' + forgeLogoHtml("header") + "</div><nav class=\"header-nav\">" + nav + "</nav>";
  });
}

document.addEventListener("DOMContentLoaded", () => {
  applyForgeAppLogos();
  rewriteForgeAssetUrls();
  if (document.querySelector("[data-forge-header]")) initForgeHeader();
  if (document.querySelector("[data-forge-member-header]")) initMemberHeader(document.querySelector("[data-forge-member-header]")?.dataset.forgeMemberHeader || "");
  if (document.querySelector("[data-forge-footer]")) initForgeFooter();
  initLiveSection();
  initForgeBackHome();
  initForgeAmbient();
});

window.FORGE_BRAND = FORGE_BRAND;
window.ForgeBrand = {
  initForgeHeader,
  initForgeFooter,
  initLiveSection,
  initMemberHeader,
  initForgeBackHome,
  initForgeAmbient,
  renderLiveSection,
  forgeLogoHtml,
  forgeEmblemHtml,
  forgeMarketIconSvg,
  forgeBiasChipHtml,
  forgeMarketLegendHtml,
};
