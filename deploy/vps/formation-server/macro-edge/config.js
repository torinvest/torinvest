/**
 * TORINVEST Macro Edge — configuration MVP V1 (Gold Desk).
 * Pondérations / seuils surchargeables via data/macro-edge/config.json (admin).
 */
"use strict";

const DEFAULT_CONFIG = {
  version: 2,
  mode: "gold_desk",
  assets: {
    XAUUSD: {
      label: "Gold",
      kind: "metal",
      source: "worker",
      stooq: "xauusd",
      fredSeed: "GOLDAMGBD228NLBM",
    },
    XAGUSD: {
      label: "Silver",
      kind: "metal",
      source: "worker",
      stooq: "xagusd",
    },
    DXY: { label: "US Dollar Index (FRED TWI)", kind: "macro", source: "fred", fred: "DTWEXBGS" },
    US02Y: { label: "US 2Y Yield", kind: "yield", source: "fred", fred: "DGS2" },
    US10Y: { label: "US 10Y Yield", kind: "yield", source: "fred", fred: "DGS10" },
    REAL10Y: { label: "US 10Y Real Yield", kind: "yield", source: "fred", fred: "DFII10" },
    BE10Y: { label: "US 10Y Breakeven", kind: "inflation", source: "fred", fred: "T10YIE" },
    EURUSD: { label: "EURUSD", kind: "fx", source: "worker", stooq: "eurusd" },
    GBPUSD: { label: "GBPUSD", kind: "fx", source: "worker", stooq: "gbpusd" },
    USDJPY: { label: "USDJPY", kind: "fx", source: "worker", stooq: "usdjpy" },
    USDCAD: { label: "USDCAD", kind: "fx", source: "worker", stooq: "usdcad" },
    AUDUSD: { label: "AUDUSD", kind: "fx", source: "worker", stooq: "audusd" },
    NZDUSD: { label: "NZDUSD", kind: "fx", source: "worker", stooq: "nzdusd" },
    EURJPY: { label: "EURJPY", kind: "fx", source: "worker", stooq: "eurjpy" },
    EURGBP: { label: "EURGBP", kind: "fx", source: "worker", stooq: "eurgbp" },
    USDCHF: { label: "USDCHF", kind: "fx", source: "worker", stooq: "usdchf" },
  },
  /** Sur FX Desk, DXY vient du Worker (ICE-like) plutôt que FRED TWI */
  fxAssetOverrides: {
    DXY: { label: "DXY", kind: "macro", source: "worker" },
  },
  goldDeskSymbols: ["XAUUSD", "XAGUSD", "DXY", "US02Y", "US10Y", "REAL10Y", "BE10Y"],
  fxDeskSymbols: [
    "EURUSD",
    "GBPUSD",
    "USDJPY",
    "USDCAD",
    "AUDUSD",
    "NZDUSD",
    "EURJPY",
    "EURGBP",
    "DXY",
    "US02Y",
    "US10Y",
  ],
  correlation: {
    defaultLookback: 50,
    lookbacks: [20, 50, 100],
    breakdownThreshold: 0.35,
    reference: "XAUUSD",
    pairs: [
      ["XAUUSD", "DXY"],
      ["XAUUSD", "US10Y"],
      ["XAUUSD", "REAL10Y"],
      ["XAUUSD", "BE10Y"],
      ["XAUUSD", "XAGUSD"],
      ["XAUUSD", "US02Y"],
    ],
  },
  fxCorrelation: {
    defaultLookback: 50,
    breakdownThreshold: 0.35,
    reference: "EURUSD",
    pairs: [
      ["EURUSD", "GBPUSD"],
      ["EURUSD", "DXY"],
      ["GBPUSD", "DXY"],
      ["AUDUSD", "NZDUSD"],
      ["EURJPY", "USDJPY"],
      ["EURUSD", "EURGBP"],
      ["USDCAD", "DXY"],
      ["AUDUSD", "DXY"],
    ],
    matrixSymbols: [
      "EURUSD",
      "GBPUSD",
      "USDJPY",
      "USDCAD",
      "AUDUSD",
      "NZDUSD",
      "EURJPY",
      "EURGBP",
      "DXY",
    ],
  },
  swing: {
    pivotLength: 3,
    lookbackBars: 120,
    atrPeriod: 14,
    atrFilterMult: 0.15,
    maxPivotDistance: 25,
  },
  smtPairs: [
    { id: "xau_xag", a: "XAUUSD", b: "XAGUSD", expected: "positive" },
    { id: "xau_dxy", a: "XAUUSD", b: "DXY", expected: "inverse" },
    { id: "xau_real", a: "XAUUSD", b: "REAL10Y", expected: "inverse" },
  ],
  fxSmtPairs: [
    { id: "eur_gbp", a: "EURUSD", b: "GBPUSD", expected: "positive" },
    { id: "aud_nzd", a: "AUDUSD", b: "NZDUSD", expected: "positive" },
    { id: "eur_gbp_jpy", a: "EURJPY", b: "USDJPY", expected: "positive" },
  ],
  policyDiffPairs: [
    "EURUSD",
    "GBPUSD",
    "USDJPY",
    "USDCAD",
    "AUDUSD",
    "NZDUSD",
    "EURGBP",
    "EURJPY",
  ],
  centralBanks: {},
  centralBanksUpdatedAt: null,
  smtWeights: {
    swingDivergence: 0.3,
    histCorrelation: 0.2,
    amplitude: 0.15,
    volatility: 0.1,
    htfProximity: 0.1,
    macroConfirm: 0.15,
  },
  goldDriverWeights: {
    realYield: 0.35,
    dxy: 0.25,
    breakeven: 0.15,
    fedBias: 0.15,
    riskVix: 0.1,
  },
  /** Relations directionnelles indicatives — jamais absolues */
  goldDriverDirections: {
    realYield: "inverse",
    dxy: "inverse",
    breakeven: "positive",
    fedBias: "inverse",
    riskVix: "positive",
  },
  alerts: {
    realYieldShockPct: 0.08,
    dollarBreakoutAtr: 1.5,
    inflationRepricingPct: 0.06,
    goldDisconnectThreshold: 0.4,
  },
  cacheTtlMs: {
    marketDaily: 5 * 60 * 1000,
    fred: 6 * 60 * 60 * 1000,
    snapshot: 3 * 60 * 1000,
  },
  disclaimer:
    "TORINVEST Macro Edge est un outil pédagogique et analytique. Les informations, scores, corrélations et signaux affichés ne constituent pas des conseils en investissement ni des recommandations d'achat ou de vente. Les relations historiques entre actifs peuvent évoluer et une corrélation n'implique pas de causalité.",
  pedagogy: {
    breakeven:
      "Le breakeven inflationniste (ex. BE10Y) est l'écart entre le rendement nominal et le rendement réel d'une maturité donnée. Il estime les anticipations d'inflation du marché, pas l'inflation réalisée.",
    realYield:
      "Le taux réel approxime le rendement nominal moins les anticipations d'inflation. Une hausse du taux réel renchérit le coût d'opportunité de détenir de l'or (actif non rémunéré).",
    correlation:
      "La corrélation Pearson est calculée sur les rendements (variations), pas sur les niveaux de prix. Une forte corrélation n'implique pas de causalité.",
    smt:
      "Une SMT (Smart Money Technique / divergence inter-actifs) apparaît quand deux actifs normalement liés ne confirment pas mutuellement un nouveau swing high ou swing low.",
    dxy:
      "Gold Desk utilise un proxy FRED (DTWEXBGS, trade-weighted). FX Desk utilise le DXY du Worker (flux TradingView). Ce ne sont pas exactement la même série.",
    monetaryDiff:
      "Le différentiel monétaire compare le biais relatif des banques centrales. Un avantage relatif USD n'est pas une prédiction de baisse d'EURUSD.",
  },
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

module.exports = {
  DEFAULT_CONFIG,
  getDefaultConfig,
  mergeConfig,
  deepMerge,
};
