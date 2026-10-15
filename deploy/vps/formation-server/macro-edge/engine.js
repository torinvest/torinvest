/**
 * Orchestrateur snapshot Gold Desk Macro Edge.
 */
"use strict";

const cache = require("./cache");
const market = require("./marketDataProvider");
const { correlationMatrix, correlationShift } = require("./correlation");
const { detectSmtPair, detectMacroSmtGold } = require("./swingSmt");
const {
  computeGoldDriver,
  computeUsdDriver,
  computeRateDecomposition,
} = require("./drivers");
const { buildAlerts, explainMarket } = require("./alerts");

async function buildGoldDeskSnapshot(store) {
  const config = store.loadConfig();
  const ttl = (config.cacheTtlMs && config.cacheTtlMs.snapshot) || 3 * 60 * 1000;

  return cache.getOrSet("snapshot:gold_desk", ttl, async () => {
    const { series, errors, updatedAt } = await market.fetchAllSeries(
      config,
      store.dataDir
    );
    const symbols = config.goldDeskSymbols || Object.keys(series);
    const lookback = (config.correlation && config.correlation.defaultLookback) || 50;
    const matrix = correlationMatrix(series, symbols, lookback);

    const corrDetails = {};
    const pairs = (config.correlation && config.correlation.pairs) || [];
    const shortLb = 20;
    const longLb = 100;
    const thr =
      (config.correlation && config.correlation.breakdownThreshold) || 0.35;
    for (const [a, b] of pairs) {
      if (!series[a] || !series[b]) {
        corrDetails[a + "/" + b] = { status: "Data unavailable" };
        continue;
      }
      corrDetails[a + "/" + b] = correlationShift(
        series[a].bars,
        series[b].bars,
        shortLb,
        longLb,
        thr
      );
    }

    const smt = (config.smtPairs || []).map((p) =>
      detectSmtPair(
        series[p.a],
        series[p.b],
        p,
        config.swing || {},
        config.smtWeights || {}
      )
    );

    const macroSmt = detectMacroSmtGold(series, config.swing || {});
    const goldDriver = computeGoldDriver(series, config);
    const usdDriver = computeUsdDriver(series);
    const rateDecomposition = computeRateDecomposition(series);
    const alerts = buildAlerts(series, config, macroSmt);

    const snapshot = {
      module: "TORINVEST MACRO EDGE — SMT MONITOR",
      version: "1.0.0-mvp-gold-desk",
      mode: "GOLD_DESK",
      philosophy: "Le fondamental explique pourquoi ; la technique décide quand.",
      timeframe: "D1",
      updatedAt,
      levels: market.summarizeLevels(series),
      seriesMeta: Object.fromEntries(
        Object.entries(series).map(([k, v]) => [
          k,
          {
            source: v.source,
            bars: (v.bars && v.bars.length) || 0,
            updatedAt: v.updatedAt,
            warning: v.warning || null,
            status: v.status || (v.source === "demo" ? "demo" : "ok"),
          },
        ])
      ),
      providerErrors: errors,
      correlations: {
        lookback,
        matrix,
        details: corrDetails,
        note: "Pearson sur returns. Corrélation ≠ causalité.",
      },
      smt,
      macroSmt,
      goldDriver,
      usdDriver,
      rateDecomposition,
      alerts,
      pedagogy: config.pedagogy || {},
      disclaimer: config.disclaimer,
      scoreNote:
        "Score analytique TORINVEST — aide à l'interprétation, pas recommandation financière.",
    };

    snapshot.explain = explainMarket(snapshot);

    try {
      store.appendHistory("snapshots", {
        goldScore: goldDriver.score,
        usdScore: usdDriver.score,
        alerts: (alerts.items || []).map((a) => a.id),
        smtCount: smt.reduce((n, p) => n + (p.signals || []).length, 0),
        macroSmt: !!(macroSmt && macroSmt.active),
      });
      if (macroSmt && macroSmt.active) {
        store.appendHistory("macro-smt", {
          score: macroSmt.score,
          divergenceCount: macroSmt.divergenceCount,
        });
      }
      for (const p of smt) {
        for (const sig of p.signals || []) {
          store.appendHistory("smt", {
            pair: sig.pair,
            side: sig.side,
            strength: sig.strength,
          });
        }
      }
    } catch (_) {
      /* persist best-effort */
    }

    return snapshot;
  });
}

module.exports = { buildGoldDeskSnapshot };
