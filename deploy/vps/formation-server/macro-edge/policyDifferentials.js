/**
 * Différentiels de politique monétaire entre banques centrales.
 * Formulation prudente : « avantage relatif » — jamais « la paire va baisser ».
 */
"use strict";

const { clampBias, biasLabel } = require("./centralBanks");

/** Paire → { baseBank, quoteBank } pour XXXYYY où avantage base = score(base)-score(quote) en convention FX base/quote.
 *  Pour EURUSD : base=EUR (ECB), quote=USD (FED). Diff EUR-USD = ECB - FED.
 *  Avantage relatif USD si FED > ECB.
 */
const PAIR_BANKS = {
  EURUSD: { base: "ECB", quote: "FED", baseCcy: "EUR", quoteCcy: "USD" },
  GBPUSD: { base: "BOE", quote: "FED", baseCcy: "GBP", quoteCcy: "USD" },
  USDJPY: { base: "FED", quote: "BOJ", baseCcy: "USD", quoteCcy: "JPY" },
  USDCAD: { base: "FED", quote: "BOC", baseCcy: "USD", quoteCcy: "CAD" },
  AUDUSD: { base: "RBA", quote: "FED", baseCcy: "AUD", quoteCcy: "USD" },
  NZDUSD: { base: "RBNZ", quote: "FED", baseCcy: "NZD", quoteCcy: "USD" },
  EURGBP: { base: "ECB", quote: "BOE", baseCcy: "EUR", quoteCcy: "GBP" },
  EURJPY: { base: "ECB", quote: "BOJ", baseCcy: "EUR", quoteCcy: "JPY" },
  GBPJPY: { base: "BOE", quote: "BOJ", baseCcy: "GBP", quoteCcy: "JPY" },
  AUDJPY: { base: "RBA", quote: "BOJ", baseCcy: "AUD", quoteCcy: "JPY" },
};

function scoreMap(watch) {
  const map = {};
  for (const b of (watch && watch.banks) || []) {
    map[b.id] = clampBias(b.biasScore);
  }
  return map;
}

function buildPolicyDifferentials(watch, pairs) {
  const scores = scoreMap(watch);
  const list = pairs || Object.keys(PAIR_BANKS);
  const items = [];

  for (const pair of list) {
    const meta = PAIR_BANKS[pair];
    if (!meta) continue;
    const baseScore = scores[meta.base];
    const quoteScore = scores[meta.quote];
    if (baseScore == null || quoteScore == null) {
      items.push({
        pair,
        status: "Data unavailable",
        baseBank: meta.base,
        quoteBank: meta.quote,
      });
      continue;
    }
    // Différentiel monétaire base vs quote (hawkish relatif de la devise de base)
    const diff = baseScore - quoteScore;
    let advantage = "NEUTRE";
    let reading =
      "Pas d'avantage monétaire clair entre " +
      meta.baseCcy +
      " et " +
      meta.quoteCcy +
      ".";
    if (diff >= 1) {
      advantage = "AVANTAGE " + meta.baseCcy;
      reading =
        "Avantage relatif " +
        meta.baseCcy +
        " sur le différentiel monétaire (" +
        meta.base +
        " " +
        biasLabel(baseScore) +
        " vs " +
        meta.quote +
        " " +
        biasLabel(quoteScore) +
        ").";
    } else if (diff <= -1) {
      advantage = "AVANTAGE " + meta.quoteCcy;
      reading =
        "Avantage relatif " +
        meta.quoteCcy +
        " sur le différentiel monétaire (" +
        meta.quote +
        " " +
        biasLabel(quoteScore) +
        " vs " +
        meta.base +
        " " +
        biasLabel(baseScore) +
        ").";
    }

    items.push({
      pair,
      baseBank: meta.base,
      quoteBank: meta.quote,
      baseCcy: meta.baseCcy,
      quoteCcy: meta.quoteCcy,
      baseScore,
      quoteScore,
      differential: diff,
      advantage,
      reading,
      note: "Lecture prudente — pas une prédiction de direction de la paire.",
    });
  }

  return {
    label: "DIFFÉRENTIEL DE POLITIQUE MONÉTAIRE",
    items,
    disclaimer:
      "Score analytique TORINVEST — aide à l'interprétation, pas recommandation financière.",
  };
}

module.exports = {
  PAIR_BANKS,
  buildPolicyDifferentials,
};
