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

/**
 * Remonte notes chart encore en localStorage (forge_chart_ex_*) vers le compte serveur.
 * Ainsi l’admin les voit même si l’élève avait enregistré avant la sync VPS.
 */
async function syncLocalChartExercisesToServer() {
  try {
    if (window.__forgeChartMigrateBusy) return { migrated: 0 };
    if (typeof localStorage === "undefined") return { migrated: 0 };
    const items = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || key.indexOf("forge_chart_ex_") !== 0) continue;
      const moduleId = key.slice("forge_chart_ex_".length);
      if (!/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(moduleId)) continue;
      let raw;
      try {
        raw = JSON.parse(localStorage.getItem(key) || "{}") || {};
      } catch (_) {
        continue;
      }
      const notes = String(raw.notes || "").trim();
      const done = Array.isArray(raw.done) ? raw.done : [];
      if (!notes && !done.length) continue;
      items.push({
        moduleId: moduleId,
        notes: notes,
        done: done,
        savedAt: raw.savedAt || null,
      });
    }
    if (!items.length) return { migrated: 0 };
    window.__forgeChartMigrateBusy = true;
    const res = await fetch("/api/chart-exercises/migrate-local", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: items }),
    });
    const data = await res.json().catch(function () {
      return {};
    });
    return { migrated: data.migrated || 0, ok: res.ok };
  } catch (_) {
    return { migrated: 0 };
  } finally {
    window.__forgeChartMigrateBusy = false;
  }
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

  if (me && (me.subscribed || me.isAdmin)) {
    syncLocalChartExercisesToServer().catch(function () {});
  }

  return me;
}

window.initForgeGate = initForgeGate;
window.forgeLoginUrl = forgeLoginUrl;
window.forgeDashboardUrl = forgeDashboardUrl;
window.forgePricingUrl = forgePricingUrl;
window.syncLocalChartExercisesToServer = syncLocalChartExercisesToServer;
