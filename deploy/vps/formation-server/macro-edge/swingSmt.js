/**
 * Détection de swings (pivots) + moteur SMT MVP.
 * Abstraction extensible (pivot length, ATR filter, lookback).
 */
"use strict";

const { correlationPair } = require("./correlation");

function atr(bars, period) {
  const p = Math.max(2, Number(period) || 14);
  if (!bars || bars.length < p + 1) return null;
  const trs = [];
  for (let i = 1; i < bars.length; i++) {
    const h = bars[i].h;
    const l = bars[i].l;
    const pc = bars[i - 1].c;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  if (trs.length < p) return null;
  let sum = 0;
  for (let i = trs.length - p; i < trs.length; i++) sum += trs[i];
  return sum / p;
}

/**
 * Swing high confirmé si high[i] > highs des `left` précédentes et `right` suivantes.
 */
function findSwingPivots(bars, options) {
  const opts = options || {};
  const left = Math.max(1, Number(opts.pivotLength) || 3);
  const right = left;
  const atrPeriod = Number(opts.atrPeriod) || 14;
  const atrMult = Number(opts.atrFilterMult) || 0;
  const lookback = Math.max(20, Number(opts.lookbackBars) || 120);
  const slice = (bars || []).slice(-lookback);
  const pivots = [];
  if (slice.length < left + right + 3) return pivots;

  const lastAtr = atr(slice, atrPeriod);

  for (let i = left; i < slice.length - right; i++) {
    const hi = slice[i].h;
    const lo = slice[i].l;
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= left; j++) {
      if (slice[i - j].h >= hi) isHigh = false;
      if (slice[i - j].l <= lo) isLow = false;
    }
    for (let j = 1; j <= right; j++) {
      if (slice[i + j].h >= hi) isHigh = false;
      if (slice[i + j].l <= lo) isLow = false;
    }
    if (atrMult > 0 && lastAtr != null) {
      const move = Math.abs(slice[i].c - slice[i - left].c);
      if (move < lastAtr * atrMult) {
        isHigh = false;
        isLow = false;
      }
    }
    if (isHigh) {
      pivots.push({
        type: "high",
        index: i,
        t: slice[i].t,
        price: hi,
        absoluteIndex: bars.length - slice.length + i,
      });
    }
    if (isLow) {
      pivots.push({
        type: "low",
        index: i,
        t: slice[i].t,
        price: lo,
        absoluteIndex: bars.length - slice.length + i,
      });
    }
  }
  return pivots;
}

function lastPivot(pivots, type) {
  for (let i = pivots.length - 1; i >= 0; i--) {
    if (pivots[i].type === type) return pivots[i];
  }
  return null;
}

function previousPivot(pivots, type, beforeIndex) {
  for (let i = pivots.length - 1; i >= 0; i--) {
    if (pivots[i].type === type && pivots[i].index < beforeIndex) {
      return pivots[i];
    }
  }
  return null;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

/**
 * Détecte bullish/bearish SMT entre deux séries.
 * expected: "positive" | "inverse"
 */
function detectSmtPair(seriesA, seriesB, pairCfg, swingCfg, weights) {
  const aBars = (seriesA && seriesA.bars) || [];
  const bBars = (seriesB && seriesB.bars) || [];
  if (aBars.length < 40 || bBars.length < 40) {
    return {
      id: pairCfg.id,
      a: pairCfg.a,
      b: pairCfg.b,
      status: "Data unavailable",
      signals: [],
    };
  }

  const pivA = findSwingPivots(aBars, swingCfg);
  const pivB = findSwingPivots(bBars, swingCfg);
  const maxDist = Math.max(5, Number(swingCfg.maxPivotDistance) || 25);
  const histCorr = correlationPair(aBars, bBars, 100);
  const shortCorr = correlationPair(aBars, bBars, 20);
  const signals = [];

  const expected = pairCfg.expected || "positive";

  // Bearish SMT : A nouveau swing high, B ne confirme pas
  const aHH = lastPivot(pivA, "high");
  if (aHH) {
    const aPrevH = previousPivot(pivA, "high", aHH.index);
    const isNewHH = aPrevH && aHH.price > aPrevH.price;
    if (isNewHH) {
      const bHH = lastPivot(pivB, "high");
      const bPrevH = bHH ? previousPivot(pivB, "high", bHH.index) : null;
      let bConfirms = false;
      if (bHH && Math.abs(bHH.index - aHH.index) <= maxDist) {
        bConfirms = !bPrevH || bHH.price > bPrevH.price;
      }
      const divergence =
        expected === "positive" ? !bConfirms : bConfirms === false && !!bHH;
      // For inverse pairs: bearish for A when A makes HH but B does NOT make LL
      let bearish = false;
      if (expected === "positive") {
        bearish = isNewHH && !bConfirms;
      } else {
        const bLL = lastPivot(pivB, "low");
        const bPrevL = bLL ? previousPivot(pivB, "low", bLL.index) : null;
        const bNewLL = bLL && bPrevL && bLL.price < bPrevL.price;
        const near = bLL && Math.abs(bLL.index - aHH.index) <= maxDist;
        bearish = isNewHH && !(near && bNewLL);
      }
      if (bearish) {
        signals.push(
          buildSignal({
            side: "bearish",
            a: pairCfg.a,
            b: pairCfg.b,
            id: pairCfg.id,
            pivotA: aHH,
            histCorr,
            shortCorr,
            aBars,
            weights,
            expected,
          })
        );
      }
    }
  }

  // Bullish SMT : A nouveau swing low, B ne confirme pas
  const aLL = lastPivot(pivA, "low");
  if (aLL) {
    const aPrevL = previousPivot(pivA, "low", aLL.index);
    const isNewLL = aPrevL && aLL.price < aPrevL.price;
    if (isNewLL) {
      let bullish = false;
      if (expected === "positive") {
        const bLL = lastPivot(pivB, "low");
        const bPrevL = bLL ? previousPivot(pivB, "low", bLL.index) : null;
        const bConfirms =
          bLL &&
          Math.abs(bLL.index - aLL.index) <= maxDist &&
          bPrevL &&
          bLL.price < bPrevL.price;
        bullish = !bConfirms;
      } else {
        const bHH = lastPivot(pivB, "high");
        const bPrevH = bHH ? previousPivot(pivB, "high", bHH.index) : null;
        const bNewHH = bHH && bPrevH && bHH.price > bPrevH.price;
        const near = bHH && Math.abs(bHH.index - aLL.index) <= maxDist;
        bullish = !(near && bNewHH);
      }
      if (bullish) {
        signals.push(
          buildSignal({
            side: "bullish",
            a: pairCfg.a,
            b: pairCfg.b,
            id: pairCfg.id,
            pivotA: aLL,
            histCorr,
            shortCorr,
            aBars,
            weights,
            expected,
          })
        );
      }
    }
  }

  return {
    id: pairCfg.id,
    a: pairCfg.a,
    b: pairCfg.b,
    expected,
    timeframe: "D1",
    histCorrelation: histCorr,
    currentCorrelation: shortCorr,
    pivotsA: pivA.slice(-8),
    pivotsB: pivB.slice(-8),
    signals,
    note: "Score SMT propriétaire analytique — pas une probabilité garantie de réussite.",
  };
}

function buildSignal(ctx) {
  const w = ctx.weights || {};
  const hist = ctx.histCorr && ctx.histCorr.coefficient;
  const short = ctx.shortCorr && ctx.shortCorr.coefficient;
  const swingScore = 80;
  const histScore =
    hist == null
      ? 40
      : clamp(Math.abs(hist) * 100, 0, 100);
  const ampScore = 55;
  const volScore = 50;
  const htfScore = 45;
  const macroScore =
    short == null
      ? 40
      : ctx.expected === "positive"
        ? clamp(50 + (hist - short) * 80, 0, 100)
        : clamp(50 + (Math.abs(hist) - Math.abs(short)) * 80, 0, 100);

  const strength = Math.round(
    swingScore * (w.swingDivergence || 0.3) +
      histScore * (w.histCorrelation || 0.2) +
      ampScore * (w.amplitude || 0.15) +
      volScore * (w.volatility || 0.1) +
      htfScore * (w.htfProximity || 0.1) +
      macroScore * (w.macroConfirm || 0.15)
  );

  return {
    side: ctx.side,
    label: (ctx.side === "bullish" ? "BULLISH" : "BEARISH") + " SMT",
    pair: ctx.a + " / " + ctx.b,
    timeframe: "D1",
    strength: clamp(strength, 0, 100),
    pivot: ctx.pivotA,
    updatedAt: new Date().toISOString(),
    disclaimer:
      "Score analytique TORINVEST — aide à l'interprétation, pas recommandation financière.",
  };
}

/**
 * Macro SMT Gold : LL/HH gold vs drivers macro habituels.
 */
function detectMacroSmtGold(seriesMap, swingCfg) {
  const gold = seriesMap.XAUUSD;
  if (!gold || !gold.bars || gold.bars.length < 40) {
    return { status: "Data unavailable", drivers: [] };
  }
  const pivG = findSwingPivots(gold.bars, swingCfg);
  const lastLow = lastPivot(pivG, "low");
  const prevLow = lastLow ? previousPivot(pivG, "low", lastLow.index) : null;
  const goldLL = !!(lastLow && prevLow && lastLow.price < prevLow.price);

  const lastHigh = lastPivot(pivG, "high");
  const prevHigh = lastHigh
    ? previousPivot(pivG, "high", lastHigh.index)
    : null;
  const goldHH = !!(lastHigh && prevHigh && lastHigh.price > prevHigh.price);

  const driverDefs = [
    { symbol: "XAGUSD", role: "positive", label: "Silver" },
    { symbol: "DXY", role: "inverse", label: "DXY" },
    { symbol: "REAL10Y", role: "inverse", label: "Real Yield" },
    { symbol: "US10Y", role: "inverse", label: "US10Y" },
    { symbol: "BE10Y", role: "positive", label: "Breakeven 10Y" },
  ];

  const drivers = [];
  let divergenceCount = 0;

  if (goldLL) {
    for (const d of driverDefs) {
      const s = seriesMap[d.symbol];
      if (!s || !s.bars) {
        drivers.push({
          symbol: d.symbol,
          label: d.label,
          status: "Data unavailable",
        });
        continue;
      }
      const piv = findSwingPivots(s.bars, swingCfg);
      let confirms = false;
      let detail = "";
      if (d.role === "positive") {
        const ll = lastPivot(piv, "low");
        const prev = ll ? previousPivot(piv, "low", ll.index) : null;
        confirms = !!(ll && prev && ll.price < prev.price);
        detail = confirms ? "LL confirmé" : "divergence (pas de LL)";
      } else {
        const hh = lastPivot(piv, "high");
        const prev = hh ? previousPivot(piv, "high", hh.index) : null;
        confirms = !!(hh && prev && hh.price > prev.price);
        detail = confirms ? "HH confirmé (macro adverse)" : "divergence";
      }
      if (!confirms) divergenceCount++;
      drivers.push({
        symbol: d.symbol,
        label: d.label,
        role: d.role,
        confirms,
        detail,
      });
    }
  }

  const active = goldLL && divergenceCount >= 2;
  const score = active
    ? clamp(40 + divergenceCount * 12, 0, 100)
    : goldLL
      ? clamp(20 + divergenceCount * 8, 0, 100)
      : 0;

  return {
    asset: "XAUUSD",
    label: "MACRO SMT GOLD",
    active,
    gold: goldLL
      ? { event: "LL confirmé", pivot: lastLow }
      : goldHH
        ? { event: "HH récent (pas de LL macro)", pivot: lastHigh }
        : { event: "Pas de nouveau LL récent", pivot: null },
    drivers,
    divergenceCount,
    score,
    timeframe: "D1",
    disclaimer:
      "Score analytique TORINVEST — aide à l'interprétation, pas recommandation financière.",
  };
}

module.exports = {
  atr,
  findSwingPivots,
  detectSmtPair,
  detectMacroSmtGold,
};
