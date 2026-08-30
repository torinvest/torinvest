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
    '<a href="https://app.torinvest-trading.com/course/index.html"' + (active === "course" ? ' class="active"' : "") + ">Formation</a>" +
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
});

window.FORGE_BRAND = FORGE_BRAND;
window.ForgeBrand = {
  initForgeHeader,
  initForgeFooter,
  initLiveSection,
  initMemberHeader,
  initForgeBackHome,
  renderLiveSection,
  forgeLogoHtml,
};
