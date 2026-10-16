/**
 * Tests unitaires Macro Edge (sans dépendance réseau obligatoire).
 *   node deploy/vps/tests/test-macro-edge.js
 */
"use strict";

const assert = require("assert");
const path = require("path");
const fs = require("fs");
const os = require("os");

const root = path.join(__dirname, "..", "formation-server", "macro-edge");
const { pearson, correlationPair, correlationShift } = require(path.join(
  root,
  "correlation"
));
const { findSwingPivots, detectSmtPair, detectMacroSmtGold } = require(
  path.join(root, "swingSmt")
);
const {
  computeGoldDriver,
  computeUsdDriver,
  computeRateDecomposition,
  computeFxDrivers,
} = require(path.join(root, "drivers"));
const { buildDemoSeries } = require(path.join(root, "demoSeries"));
const { createStore } = require(path.join(root, "store"));
const {
  buildAlerts,
  explainMarket,
  buildFxAlerts,
  explainFxMarket,
} = require(path.join(root, "alerts"));
const { mergeConfig } = require(path.join(root, "config"));
const { buildCentralBankWatch } = require(path.join(root, "centralBanks"));
const { buildPolicyDifferentials } = require(path.join(
  root,
  "policyDifferentials"
));

let passed = 0;
function ok(name) {
  passed++;
  console.log("  OK", name);
}

// Pearson perfect correlation
{
  const xs = [1, 2, 3, 4, 5, 6, 7, 8];
  const ys = xs.map((x) => x * 2);
  const r = pearson(xs, ys);
  assert.ok(Math.abs(r - 1) < 1e-9);
  ok("pearson +1");
}

// Returns correlation on bars
{
  const a = [];
  const b = [];
  for (let i = 0; i < 60; i++) {
    const d = new Date(Date.UTC(2024, 0, 1 + i));
    const ts = d.toISOString();
    a.push({ t: ts, o: 100 + i, h: 101 + i, l: 99 + i, c: 100 + i });
    b.push({
      t: ts,
      o: 50 + i * 0.5,
      h: 51 + i * 0.5,
      l: 49 + i * 0.5,
      c: 50 + i * 0.5,
    });
  }
  const c = correlationPair(a, b, 40);
  assert.ok(c.coefficient != null && c.coefficient > 0.9);
  ok("correlationPair trending");
}

// Swing pivots
{
  const bars = [];
  for (let i = 0; i < 80; i++) {
    const d = new Date(Date.UTC(2024, 0, 1 + i));
    let c = 100 + Math.sin(i / 5) * 10;
    if (i === 40) c = 70;
    if (i === 55) c = 130;
    bars.push({ t: d.toISOString(), o: c, h: c + 1, l: c - 1, c });
  }
  const piv = findSwingPivots(bars, {
    pivotLength: 2,
    lookbackBars: 80,
    atrFilterMult: 0,
  });
  assert.ok(piv.length > 0);
  ok("findSwingPivots");
}

const series = {
  XAUUSD: buildDemoSeries("XAUUSD"),
  XAGUSD: buildDemoSeries("XAGUSD"),
  DXY: buildDemoSeries("DXY"),
  US02Y: buildDemoSeries("US02Y"),
  US10Y: buildDemoSeries("US10Y"),
  REAL10Y: buildDemoSeries("REAL10Y"),
  BE10Y: buildDemoSeries("BE10Y"),
  EURUSD: buildDemoSeries("EURUSD"),
  GBPUSD: buildDemoSeries("GBPUSD"),
  USDJPY: buildDemoSeries("USDJPY"),
  USDCAD: buildDemoSeries("USDCAD"),
  AUDUSD: buildDemoSeries("AUDUSD"),
  NZDUSD: buildDemoSeries("NZDUSD"),
  EURJPY: buildDemoSeries("EURJPY"),
  EURGBP: buildDemoSeries("EURGBP"),
};

{
  const cfg = mergeConfig({});
  const gd = computeGoldDriver(series, cfg);
  assert.ok(gd.score == null || (gd.score >= -100 && gd.score <= 100));
  ok("computeGoldDriver");

  const usd = computeUsdDriver(series);
  assert.ok(usd.score == null || (usd.score >= -100 && usd.score <= 100));
  ok("computeUsdDriver");

  const rates = computeRateDecomposition(series);
  assert.ok(rates.reading || rates.status);
  ok("rateDecomposition");

  const smt = detectSmtPair(
    series.XAUUSD,
    series.XAGUSD,
    { id: "xau_xag", a: "XAUUSD", b: "XAGUSD", expected: "positive" },
    { pivotLength: 3, lookbackBars: 120, atrFilterMult: 0 },
    cfg.smtWeights
  );
  assert.ok(Array.isArray(smt.signals));
  ok("detectSmtPair");

  const macro = detectMacroSmtGold(series, {
    pivotLength: 3,
    lookbackBars: 120,
    atrFilterMult: 0,
  });
  assert.ok(typeof macro.score === "number");
  ok("detectMacroSmtGold");

  const shift = correlationShift(
    series.XAUUSD.bars,
    series.REAL10Y.bars,
    20,
    100,
    0.35
  );
  assert.ok("breakdown" in shift);
  ok("correlationShift");

  const alerts = buildAlerts(series, cfg, macro);
  assert.ok(Array.isArray(alerts.items));
  ok("buildAlerts");

  const snap = {
    usdDriver: usd,
    goldDriver: gd,
    rateDecomposition: rates,
    smt: [smt],
    macroSmt: macro,
  };
  const explained = explainMarket(snap);
  assert.ok(explained.lines.length >= 8);
  const upper = explained.text.toUpperCase();
  assert.ok(!/\bACHETER\b/.test(upper) && !/\bVENDRE\b/.test(upper));
  ok("explainMarket no trade advice");
}

{
  const cfg = mergeConfig({});
  assert.ok(Array.isArray(cfg.fxDeskSymbols) && cfg.fxDeskSymbols.length >= 8);
  assert.ok(cfg.fxAssetOverrides && cfg.fxAssetOverrides.DXY);
  assert.equal(cfg.fxAssetOverrides.DXY.source, "worker");
  ok("config fx desk symbols + DXY override");

  const watch = buildCentralBankWatch(cfg);
  assert.equal(watch.banks.length, 7);
  assert.ok(watch.banks.every((b) => b.biasScore >= -3 && b.biasScore <= 3));
  ok("centralBankWatch");

  const diffs = buildPolicyDifferentials(watch, cfg.policyDiffPairs);
  assert.ok(diffs.items.length >= 6);
  const eur = diffs.items.find((i) => i.pair === "EURUSD");
  assert.ok(eur && typeof eur.advantage === "string");
  assert.ok(!/va baisser|acheter|vendre/i.test(eur.reading || ""));
  ok("policyDifferentials cautious language");

  const fxDrivers = computeFxDrivers(series, watch);
  assert.ok(
    fxDrivers.usdDriver.score == null ||
      (fxDrivers.usdDriver.score >= -100 && fxDrivers.usdDriver.score <= 100)
  );
  assert.ok(
    fxDrivers.eurDriver.score == null ||
      (fxDrivers.eurDriver.score >= -100 && fxDrivers.eurDriver.score <= 100)
  );
  ok("computeFxDrivers");

  const fxSmt = detectSmtPair(
    series.EURUSD,
    series.GBPUSD,
    { id: "eur_gbp", a: "EURUSD", b: "GBPUSD", expected: "positive" },
    { pivotLength: 3, lookbackBars: 120, atrFilterMult: 0 },
    cfg.smtWeights
  );
  assert.ok(Array.isArray(fxSmt.signals));
  ok("detectSmtPair FX");

  const fxAlerts = buildFxAlerts(series, cfg, [fxSmt], diffs);
  assert.ok(Array.isArray(fxAlerts.items));
  ok("buildFxAlerts");

  const fxSnap = {
    usdDriver: fxDrivers.usdDriver,
    eurDriver: fxDrivers.eurDriver,
    riskDriver: fxDrivers.riskDriver,
    policyDriver: fxDrivers.policyDriver,
    centralBankWatch: watch,
    policyDifferentials: diffs,
    smt: [fxSmt],
  };
  const fxExplained = explainFxMarket(fxSnap);
  assert.ok(fxExplained.lines.length >= 8);
  const fxUpper = fxExplained.text.toUpperCase();
  assert.ok(!/\bACHETER\b/.test(fxUpper) && !/\bVENDRE\b/.test(fxUpper));
  ok("explainFxMarket no trade advice");
}

{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "macro-edge-"));
  const store = createStore(tmp);
  const cfg = store.loadConfig();
  assert.equal(cfg.mode, "gold_desk");
  assert.equal(cfg.version, 2);
  store.saveConfig({
    alerts: { realYieldShockPct: 0.05 },
    centralBanks: { FED: { biasScore: 2 } },
  });
  const cfg2 = store.loadConfig();
  assert.equal(cfg2.alerts.realYieldShockPct, 0.05);
  const watch2 = buildCentralBankWatch(cfg2);
  const fed = watch2.banks.find((b) => b.id === "FED");
  assert.equal(fed.biasScore, 2);
  store.appendHistory("smt", { pair: "XAUUSD / XAGUSD", side: "bullish" });
  const hist = store.readHistory("smt", 10);
  assert.equal(hist.length, 1);
  ok("store config + history + CB override");
}

console.log("\n" + passed + " tests passed.");
