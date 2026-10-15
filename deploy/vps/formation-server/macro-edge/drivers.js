/**
 * Drivers macro : Gold Driver, US Rate Decomposition.
 */
"use strict";

const { correlationPair } = require("./correlation");

function lastClose(series) {
  if (!series || !series.bars || !series.bars.length) return null;
  const b = series.bars[series.bars.length - 1];
  return Number.isFinite(b.c) ? b.c : null;
}

function pctChange(series, lookback) {
  if (!series || !series.bars || series.bars.length < lookback + 1) return null;
  const a = series.bars[series.bars.length - 1].c;
  const b = series.bars[series.bars.length - 1 - lookback].c;
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
  return (a - b) / Math.abs(b);
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function scaleChangeToScore(chg, invert) {
  if (chg == null || !Number.isFinite(chg)) return null;
  // ~±2% → ±100 (yields) ; metals/dxy use similar soft scale
  const raw = clamp(chg / 0.02, -1, 1) * 100;
  return invert ? -raw : raw;
}

/**
 * Gold Macro Driver -100..+100
 * Hausse real yield / DXY = défavorable (inverse)
 * Hausse breakeven = plutôt favorable
 * fedBias : 0 en V1 si pas de Central Bank Watch (placeholder neutre)
 */
function computeGoldDriver(seriesMap, config) {
  const w = (config && config.goldDriverWeights) || {};
  const dirs = (config && config.goldDriverDirections) || {};
  const components = [];

  function add(key, seriesKey, weight, label) {
    const s = seriesMap[seriesKey];
    if (!s || s.status === "unavailable") {
      components.push({
        key,
        label,
        weight,
        score: null,
        status: "Data unavailable",
        last: null,
        change20: null,
      });
      return;
    }
    const chg = pctChange(s, 20);
    const invert = dirs[key] === "inverse";
    const score = scaleChangeToScore(chg, invert);
    // Ajuste légèrement selon corrélation récente vs Gold
    let corrAdj = 0;
    if (seriesMap.XAUUSD && s.bars) {
      const corr = correlationPair(seriesMap.XAUUSD.bars, s.bars, 50);
      if (corr.coefficient != null) {
        const expectedSign = invert ? -1 : 1;
        if (Math.sign(corr.coefficient) !== expectedSign && Math.abs(corr.coefficient) > 0.2) {
          corrAdj = -10;
        }
      }
    }
    components.push({
      key,
      label,
      weight,
      score: score == null ? null : clamp(Math.round(score + corrAdj), -100, 100),
      last: lastClose(s),
      change20: chg == null ? null : Math.round(chg * 10000) / 10000,
      source: s.source,
      updatedAt: s.updatedAt || null,
    });
  }

  add("realYield", "REAL10Y", w.realYield || 0.35, "US 10Y Real Yield");
  add("dxy", "DXY", w.dxy || 0.25, "DXY");
  add("breakeven", "BE10Y", w.breakeven || 0.15, "Breakeven 10Y");

  // FED bias placeholder V1
  components.push({
    key: "fedBias",
    label: "FED bias (V2)",
    weight: w.fedBias || 0.15,
    score: 0,
    status: "neutral_placeholder",
    note: "Central Bank Watch arrive en V2 — score neutre pour l'instant.",
  });

  // VIX placeholder
  components.push({
    key: "riskVix",
    label: "Risk / VIX (V2)",
    weight: w.riskVix || 0.1,
    score: 0,
    status: "neutral_placeholder",
    note: "VIX non inclus dans le MVP V1 Gold Desk.",
  });

  let num = 0;
  let den = 0;
  let missing = 0;
  for (const c of components) {
    if (c.score == null) {
      missing++;
      continue;
    }
    num += c.score * c.weight;
    den += c.weight;
  }

  if (den <= 0 || missing >= 3) {
    return {
      score: null,
      status: "Data unavailable",
      label: "GOLD DRIVER",
      components,
      disclaimer:
        "Score analytique TORINVEST — aide à l'interprétation, pas recommandation financière.",
    };
  }

  const score = clamp(Math.round(num / den), -100, 100);
  let env = "NEUTRAL GOLD ENVIRONMENT";
  if (score >= 40) env = "SUPPORTIVE GOLD ENVIRONMENT";
  else if (score <= -40) env = "ADVERSE GOLD ENVIRONMENT";

  return {
    score,
    environment: env,
    label: "GOLD DRIVER",
    components,
    updatedAt: new Date().toISOString(),
    disclaimer:
      "Score analytique TORINVEST — aide à l'interprétation, pas recommandation financière. Les relations historiques ne sont pas toujours vraies.",
  };
}

/**
 * Décomposition US10Y = Real + Breakeven (approx pédagogique).
 */
function computeRateDecomposition(seriesMap) {
  const nom = seriesMap.US10Y;
  const real = seriesMap.REAL10Y;
  const be = seriesMap.BE10Y;

  if (!nom || !real || !be || !nom.bars || !real.bars || !be.bars) {
    return { status: "Data unavailable" };
  }

  const lb = 20;
  const dNom = pctChange(nom, lb);
  const dReal = pctChange(real, lb);
  const dBe = pctChange(be, lb);

  if (dNom == null || dReal == null || dBe == null) {
    return { status: "Data unavailable" };
  }

  const absReal = Math.abs(dReal);
  const absBe = Math.abs(dBe);
  let reading = "Contribution mixte real yield / breakeven.";
  if (absReal > absBe * 1.35) {
    reading =
      dNom > 0
        ? "Hausse du 10 ans principalement due au taux réel."
        : "Baisse du 10 ans principalement due au taux réel.";
  } else if (absBe > absReal * 1.35) {
    reading =
      dNom > 0
        ? "Hausse davantage liée aux anticipations inflationnistes (breakeven)."
        : "Baisse davantage liée aux anticipations inflationnistes (breakeven).";
  }

  function row(series, chg) {
    return {
      last: lastClose(series),
      change20: Math.round(chg * 10000) / 10000,
      direction: chg > 0.002 ? "up" : chg < -0.002 ? "down" : "flat",
      source: series.source,
      updatedAt: series.updatedAt || null,
      status: series.warning ? "demo_or_stale" : "ok",
    };
  }

  return {
    label: "US RATE DECOMPOSITION",
    lookback: lb,
    nominal: Object.assign({ symbol: "US10Y" }, row(nom, dNom)),
    realYield: Object.assign({ symbol: "REAL10Y" }, row(real, dReal)),
    breakeven: Object.assign({ symbol: "BE10Y" }, row(be, dBe)),
    reading,
    pedagogy:
      "US10Y nominal ≈ taux réel + breakeven. Distinguer la source de la variation est essentiel pour lire l'or et le dollar.",
    updatedAt: new Date().toISOString(),
  };
}

/**
 * USD Driver simplifié V1 (sans Fed bias complet).
 */
function computeUsdDriver(seriesMap) {
  const parts = [];
  function push(key, sym, invert) {
    const s = seriesMap[sym];
    if (!s) {
      parts.push({ key, score: null, status: "Data unavailable" });
      return;
    }
    const chg = pctChange(s, 20);
    parts.push({
      key,
      score: scaleChangeToScore(chg, invert),
      change20: chg,
      last: lastClose(s),
    });
  }
  push("dxy", "DXY", false);
  push("us02y", "US02Y", false);
  push("us10y", "US10Y", false);
  push("real", "REAL10Y", false);

  let num = 0;
  let n = 0;
  for (const p of parts) {
    if (p.score == null) continue;
    num += p.score;
    n++;
  }
  if (!n) {
    return { score: null, status: "Data unavailable", label: "USD DRIVER" };
  }
  const score = clamp(Math.round(num / n), -100, 100);
  let env = "NEUTRAL USD ENVIRONMENT";
  if (score >= 40) env = "STRONG USD ENVIRONMENT";
  else if (score <= -40) env = "WEAK USD ENVIRONMENT";
  return {
    score,
    environment: env,
    label: "USD DRIVER",
    components: parts,
    disclaimer:
      "Score analytique TORINVEST — aide à l'interprétation, pas recommandation financière.",
  };
}

module.exports = {
  lastClose,
  pctChange,
  computeGoldDriver,
  computeUsdDriver,
  computeRateDecomposition,
};
