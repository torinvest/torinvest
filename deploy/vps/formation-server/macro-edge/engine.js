/**
 * Orchestrateur snapshots Macro Edge — Gold Desk + FX Desk.
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

/** FX-only libs — lazy pour ne pas crasher Gold Desk / tout le serveur si fichiers absents. */
function loadFxLibs() {
  const { buildFxAlerts, explainFxMarket } = require("./alerts");
  const { buildCentralBankWatch } = require("./centralBanks");
  const { buildPolicyDifferentials } = require("./policyDifferentials");
  const { computeFxDrivers } = require("./drivers");
  return {
    buildFxAlerts,
    explainFxMarket,
    buildCentralBankWatch,
    buildPolicyDifferentials,
    computeFxDrivers,
  };
}

function seriesMeta(series) {
  return Object.fromEntries(
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
  );
}

function buildCorrDetails(series, pairs, thr) {
  const corrDetails = {};
  const shortLb = 20;
  const longLb = 100;
  for (const [a, b] of pairs || []) {
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
  return corrDetails;
}

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
    const thr =
      (config.correlation && config.correlation.breakdownThreshold) || 0.35;
    const corrDetails = buildCorrDetails(
      series,
      (config.correlation && config.correlation.pairs) || [],
      thr
    );

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
      version: "2.0.0-mvp-fx-desk",
      mode: "GOLD_DESK",
      philosophy: "Le fondamental explique pourquoi ; la technique décide quand.",
      timeframe: "D1",
      updatedAt,
      levels: market.summarizeLevels(series),
      seriesMeta: seriesMeta(series),
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
        desk: "gold",
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

async function buildFxDeskSnapshot(store) {
  const config = store.loadConfig();
  const ttl = (config.cacheTtlMs && config.cacheTtlMs.snapshot) || 3 * 60 * 1000;
  let fx;
  try {
    fx = loadFxLibs();
  } catch (e) {
    const err = new Error(
      "FX Desk modules missing (centralBanks/policyDifferentials) — " +
        String(e.message || e)
    );
    err.code = "fx_modules_missing";
    throw err;
  }

  return cache.getOrSet("snapshot:fx_desk", ttl, async () => {
    const fxCorr = config.fxCorrelation || {};
    const { series, errors, updatedAt } = await market.fetchAllSeries(
      config,
      store.dataDir,
      {
        symbols: config.fxDeskSymbols,
        assetOverrides: config.fxAssetOverrides || {},
      }
    );

    const matrixSymbols =
      fxCorr.matrixSymbols ||
      (config.fxDeskSymbols || []).filter((s) => !/^US\d|^REAL|^BE/.test(s));
    const lookback = fxCorr.defaultLookback || 50;
    const matrix = correlationMatrix(series, matrixSymbols, lookback);
    const thr = fxCorr.breakdownThreshold || 0.35;
    const corrDetails = buildCorrDetails(series, fxCorr.pairs || [], thr);

    const smt = (config.fxSmtPairs || []).map((p) =>
      detectSmtPair(
        series[p.a],
        series[p.b],
        p,
        config.swing || {},
        config.smtWeights || {}
      )
    );

    const centralBankWatch = fx.buildCentralBankWatch(config);
    const policyDifferentials = fx.buildPolicyDifferentials(
      centralBankWatch,
      config.policyDiffPairs
    );
    const fxDrivers = fx.computeFxDrivers(series, centralBankWatch);
    const alerts = fx.buildFxAlerts(series, config, smt, policyDifferentials);

    // Niveaux affichés : paires FX + DXY + yields (ordre pédagogique)
    const levelOrder = config.fxDeskSymbols || Object.keys(series);
    const allLevels = market.summarizeLevels(series);
    const levels = {};
    for (const sym of levelOrder) {
      if (allLevels[sym]) levels[sym] = allLevels[sym];
    }

    const snapshot = {
      module: "TORINVEST MACRO EDGE — SMT MONITOR",
      version: "2.0.0-mvp-fx-desk",
      mode: "FX_DESK",
      philosophy: "Le fondamental explique pourquoi ; la technique décide quand.",
      timeframe: "D1",
      updatedAt,
      levels,
      seriesMeta: seriesMeta(series),
      providerErrors: errors,
      correlations: {
        lookback,
        matrix,
        details: corrDetails,
        note: "Pearson sur returns. Corrélation ≠ causalité.",
      },
      smt,
      centralBankWatch,
      policyDifferentials,
      usdDriver: fxDrivers.usdDriver,
      eurDriver: fxDrivers.eurDriver,
      riskDriver: fxDrivers.riskDriver,
      policyDriver: fxDrivers.policyDriver,
      alerts,
      pedagogy: config.pedagogy || {},
      disclaimer: config.disclaimer,
      scoreNote:
        "Score analytique TORINVEST — aide à l'interprétation, pas recommandation financière.",
      dxyNote:
        (config.pedagogy && config.pedagogy.dxy) ||
        "FX Desk utilise le DXY Worker (pas le proxy FRED Gold Desk).",
    };

    snapshot.explain = fx.explainFxMarket(snapshot);

    try {
      store.appendHistory("snapshots", {
        desk: "fx",
        usdScore: fxDrivers.usdDriver && fxDrivers.usdDriver.score,
        eurScore: fxDrivers.eurDriver && fxDrivers.eurDriver.score,
        alerts: (alerts.items || []).map((a) => a.id),
        smtCount: smt.reduce((n, p) => n + (p.signals || []).length, 0),
      });
      for (const p of smt) {
        for (const sig of p.signals || []) {
          store.appendHistory("smt", {
            desk: "fx",
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

async function buildSnapshot(store, desk) {
  const mode = String(desk || "gold").toLowerCase();
  if (mode === "fx" || mode === "forex" || mode === "fx_desk") {
    return buildFxDeskSnapshot(store);
  }
  return buildGoldDeskSnapshot(store);
}

module.exports = {
  buildGoldDeskSnapshot,
  buildFxDeskSnapshot,
  buildSnapshot,
};
