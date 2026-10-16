/**
 * Central Bank Watch — scores analytiques configurables (pas de news hallucinées).
 * Échelle : -3 très dovish … 0 neutre … +3 très hawkish.
 */
"use strict";

const BIAS_LABELS = {
  "-3": "TRÈS DOVISH",
  "-2": "DOVISH",
  "-1": "LÉGÈREMENT DOVISH",
  "0": "NEUTRE",
  "1": "LÉGÈREMENT HAWKISH",
  "2": "HAWKISH",
  "3": "TRÈS HAWKISH",
};

const DEFAULT_BANKS = {
  FED: {
    id: "FED",
    name: "Federal Reserve",
    governor: "Jerome Powell",
    currency: "USD",
    policyRate: null,
    lastDecision: null,
    nextMeeting: null,
    biasScore: 1,
    lastBiasChange: null,
    inflation: "à surveiller",
    growth: "résiliente",
    labor: "stable",
    risks: ["inflation sticky", "marché du travail"],
    speechSummary: null,
    sourceNote: "Score initial pédagogique — à mettre à jour via admin / news sourcées (V3).",
  },
  ECB: {
    id: "ECB",
    name: "European Central Bank",
    governor: "Christine Lagarde",
    currency: "EUR",
    policyRate: null,
    lastDecision: null,
    nextMeeting: null,
    biasScore: 0,
    lastBiasChange: null,
    inflation: "modérée",
    growth: "fragile",
    labor: "stable",
    risks: ["croissance zone euro", "fragmentation"],
    speechSummary: null,
    sourceNote: "Score initial pédagogique — à mettre à jour via admin / news sourcées (V3).",
  },
  BOJ: {
    id: "BOJ",
    name: "Bank of Japan",
    governor: "Kazuo Ueda",
    currency: "JPY",
    policyRate: null,
    lastDecision: null,
    nextMeeting: null,
    biasScore: -1,
    lastBiasChange: null,
    inflation: "proche cible",
    growth: "modérée",
    labor: "tendu",
    risks: ["normalisation progressive", "yen"],
    speechSummary: null,
    sourceNote: "Score initial pédagogique — à mettre à jour via admin / news sourcées (V3).",
  },
  BOE: {
    id: "BOE",
    name: "Bank of England",
    governor: "Andrew Bailey",
    currency: "GBP",
    policyRate: null,
    lastDecision: null,
    nextMeeting: null,
    biasScore: 0,
    lastBiasChange: null,
    inflation: "persistante",
    growth: "faible",
    labor: "ralentissement",
    risks: ["services inflation", "croissance UK"],
    speechSummary: null,
    sourceNote: "Score initial pédagogique — à mettre à jour via admin / news sourcées (V3).",
  },
  BOC: {
    id: "BOC",
    name: "Bank of Canada",
    governor: "Tiff Macklem",
    currency: "CAD",
    policyRate: null,
    lastDecision: null,
    nextMeeting: null,
    biasScore: 0,
    lastBiasChange: null,
    inflation: "proche cible",
    growth: "modérée",
    labor: "stable",
    risks: ["immobilier", "huile"],
    speechSummary: null,
    sourceNote: "Score initial pédagogique — à mettre à jour via admin / news sourcées (V3).",
  },
  RBA: {
    id: "RBA",
    name: "Reserve Bank of Australia",
    governor: "Michele Bullock",
    currency: "AUD",
    policyRate: null,
    lastDecision: null,
    nextMeeting: null,
    biasScore: 1,
    lastBiasChange: null,
    inflation: "élevée",
    growth: "modérée",
    labor: "tendu",
    risks: ["services", "Chine / commodities"],
    speechSummary: null,
    sourceNote: "Score initial pédagogique — à mettre à jour via admin / news sourcées (V3).",
  },
  RBNZ: {
    id: "RBNZ",
    name: "Reserve Bank of New Zealand",
    governor: "Adrian Orr",
    currency: "NZD",
    policyRate: null,
    lastDecision: null,
    nextMeeting: null,
    biasScore: 0,
    lastBiasChange: null,
    inflation: "modérée",
    growth: "faible",
    labor: "stable",
    risks: ["croissance domestique"],
    speechSummary: null,
    sourceNote: "Score initial pédagogique — à mettre à jour via admin / news sourcées (V3).",
  },
};

function clampBias(n) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 0;
  return Math.max(-3, Math.min(3, v));
}

function biasLabel(score) {
  return BIAS_LABELS[String(clampBias(score))] || "NEUTRE";
}

function buildCentralBankWatch(config) {
  const over = (config && config.centralBanks) || {};
  const banks = [];
  for (const id of Object.keys(DEFAULT_BANKS)) {
    const base = DEFAULT_BANKS[id];
    const patch = over[id] || {};
    const biasScore = clampBias(
      patch.biasScore != null ? patch.biasScore : base.biasScore
    );
    banks.push(
      Object.assign({}, base, patch, {
        id,
        biasScore,
        bias: biasLabel(biasScore),
        monetaryScore: biasScore,
      })
    );
  }
  return {
    label: "CENTRAL BANK WATCH",
    banks,
    scale: BIAS_LABELS,
    updatedAt: (config && config.centralBanksUpdatedAt) || null,
    disclaimer:
      "Score analytique TORINVEST — aide à l'interprétation, pas recommandation financière. Ne jamais traiter un score auto comme une vérité certaine. Les news factuelles exigent source + date + URL (V3).",
  };
}

module.exports = {
  DEFAULT_BANKS,
  BIAS_LABELS,
  clampBias,
  biasLabel,
  buildCentralBankWatch,
};
