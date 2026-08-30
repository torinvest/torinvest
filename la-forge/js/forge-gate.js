/**
 * La Forge — contrôle accès membre / Premium (côté client + complément serveur).
 * Le contenu course reste sur le VPS ; ce script ne publie rien sur GitHub public.
 */
function forgeAppOrigin() {
  return window.location.hostname === "app.torinvest-trading.com"
    ? ""
    : "https://app.torinvest-trading.com";
}

function forgeLoginUrl() {
  return forgeAppOrigin() + "/login.html";
}

function forgeDashboardUrl() {
  return forgeAppOrigin() + "/dashboard.html";
}

function forgePricingUrl() {
  return "https://www.torinvest-trading.com/la-forge/pricing.html";
}

async function initForgeGate(options) {
  const opts = options || {};
  const requireLogin = opts.requireLogin !== false;
  const requirePremium = opts.requirePremium === true;

  const me = typeof getMe === "function" ? await getMe() : null;

  if (requireLogin && !me) {
    const next = encodeURIComponent(
      window.location.pathname + window.location.search + window.location.hash
    );
    window.location.replace(forgeLoginUrl() + "?next=" + next);
    return null;
  }

  if (requirePremium && me && !me.subscribed) {
    window.location.replace(forgeDashboardUrl() + "?locked=1");
    return null;
  }

  return me;
}

window.initForgeGate = initForgeGate;
window.forgeLoginUrl = forgeLoginUrl;
window.forgeDashboardUrl = forgeDashboardUrl;
window.forgePricingUrl = forgePricingUrl;
