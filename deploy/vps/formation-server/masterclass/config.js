/**
 * Masterclass Macroéconomie & Marchés Financiers — config par défaut.
 * Contenu pédagogique hors Git (data/masterclass/ sur le VPS).
 */
"use strict";

const DEFAULT_CONFIG = {
  id: "masterclass-macro",
  title: "Masterclass Macroéconomie & Marchés Financiers",
  brand: "TORINVEST — LA FORGE",
  type: "optional_premium",
  publication_status: "draft",
  visibility: "admin_only",
  access_policy: "admin_or_grant",
  sales_enabled: false,
  price_amount: null,
  currency: "EUR",
  payment_provider: null,
  payment_url: null,
  coaching: {
    enabled: false,
    title: "Coaching Masterclass (personnalisé)",
    price_amount: null,
    currency: "EUR",
    payment_provider: null,
    payment_url: null,
  },
  chapterCount: 23,
  disclaimer:
    "Formation pédagogique TORINVEST — La Forge. Contenu réservé aux accès autorisés. Ne constitue pas un conseil en investissement.",
  updatedAt: null,
};

function deepMerge(base, over) {
  if (!over || typeof over !== "object") return base;
  const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
  Object.keys(over).forEach((k) => {
    if (
      over[k] &&
      typeof over[k] === "object" &&
      !Array.isArray(over[k]) &&
      base[k] &&
      typeof base[k] === "object" &&
      !Array.isArray(base[k])
    ) {
      out[k] = deepMerge(base[k], over[k]);
    } else {
      out[k] = over[k];
    }
  });
  return out;
}

function getDefaultConfig() {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}

function mergeConfig(override) {
  return deepMerge(getDefaultConfig(), override || {});
}

/** Champs exposables hors admin (jamais de secrets). */
function publicCatalog(config) {
  const c = mergeConfig(config);
  const salesOn = c.sales_enabled === true && c.publication_status === "published";
  return {
    id: c.id,
    title: c.title,
    brand: c.brand,
    type: c.type,
    publication_status: c.publication_status,
    visibility: c.visibility,
    sales_enabled: !!c.sales_enabled,
    // Prix / lien uniquement si ventes explicitement ouvertes
    price_amount: salesOn ? c.price_amount : null,
    currency: salesOn ? c.currency : null,
    payment_url: salesOn ? c.payment_url : null,
    coaching: {
      enabled: !!(c.coaching && c.coaching.enabled && salesOn),
      title: (c.coaching && c.coaching.title) || null,
      price_amount:
        salesOn && c.coaching && c.coaching.enabled ? c.coaching.price_amount : null,
      currency: salesOn && c.coaching ? c.coaching.currency : null,
      payment_url:
        salesOn && c.coaching && c.coaching.enabled ? c.coaching.payment_url : null,
    },
    chapterCount: c.chapterCount,
    disclaimer: c.disclaimer,
  };
}

module.exports = {
  DEFAULT_CONFIG,
  getDefaultConfig,
  mergeConfig,
  publicCatalog,
};
