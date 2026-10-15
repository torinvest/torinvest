/**
 * Corrélation Pearson sur les RETURNS (pas les niveaux).
 */
"use strict";

function closes(bars) {
  return (bars || [])
    .map((b) => (b && Number.isFinite(b.c) ? b.c : NaN))
    .filter((v) => Number.isFinite(v));
}

function returnsFromCloses(px) {
  const out = [];
  for (let i = 1; i < px.length; i++) {
    if (px[i - 1] === 0) continue;
    out.push((px[i] - px[i - 1]) / px[i - 1]);
  }
  return out;
}

function alignReturns(barsA, barsB) {
  const mapB = new Map();
  for (const b of barsB || []) {
    if (!b || !b.t || !Number.isFinite(b.c)) continue;
    mapB.set(String(b.t).slice(0, 10), b.c);
  }
  const pairedA = [];
  const pairedB = [];
  for (const a of barsA || []) {
    if (!a || !a.t || !Number.isFinite(a.c)) continue;
    const key = String(a.t).slice(0, 10);
    if (!mapB.has(key)) continue;
    pairedA.push(a.c);
    pairedB.push(mapB.get(key));
  }
  return {
    ra: returnsFromCloses(pairedA),
    rb: returnsFromCloses(pairedB),
    n: Math.min(pairedA.length, pairedB.length),
  };
}

function pearson(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  if (n < 5) return null;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i];
    sy += ys[i];
  }
  const mx = sx / n;
  const my = sy / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const ax = xs[i] - mx;
    const ay = ys[i] - my;
    num += ax * ay;
    dx += ax * ax;
    dy += ay * ay;
  }
  if (dx <= 0 || dy <= 0) return null;
  return num / Math.sqrt(dx * dy);
}

function classifyAbs(r) {
  if (r == null || !Number.isFinite(r)) return "unavailable";
  const a = Math.abs(r);
  if (a < 0.3) return "faible";
  if (a < 0.5) return "modérée";
  if (a < 0.7) return "significative";
  return "forte";
}

function sliceLast(arr, n) {
  if (!arr || arr.length <= n) return arr || [];
  return arr.slice(-n);
}

function correlationPair(barsA, barsB, lookback) {
  const aligned = alignReturns(barsA, barsB);
  const lb = Math.max(10, Number(lookback) || 50);
  const ra = sliceLast(aligned.ra, lb);
  const rb = sliceLast(aligned.rb, lb);
  const r = pearson(ra, rb);
  return {
    coefficient: r == null ? null : Math.round(r * 1000) / 1000,
    classification: classifyAbs(r),
    samples: Math.min(ra.length, rb.length),
    lookback: lb,
  };
}

function correlationMatrix(seriesMap, symbols, lookback) {
  const matrix = {};
  for (const a of symbols) {
    matrix[a] = {};
    for (const b of symbols) {
      if (a === b) {
        matrix[a][b] = { coefficient: 1, classification: "forte", samples: 0, lookback };
        continue;
      }
      const sa = seriesMap[a];
      const sb = seriesMap[b];
      if (!sa || !sb || !sa.bars || !sb.bars) {
        matrix[a][b] = {
          coefficient: null,
          classification: "unavailable",
          samples: 0,
          lookback,
          status: "Data unavailable",
        };
        continue;
      }
      matrix[a][b] = correlationPair(sa.bars, sb.bars, lookback);
    }
  }
  return matrix;
}

function correlationShift(barsA, barsB, shortLb, longLb, threshold) {
  const current = correlationPair(barsA, barsB, shortLb);
  const normal = correlationPair(barsA, barsB, longLb);
  let shift = null;
  if (
    current.coefficient != null &&
    normal.coefficient != null &&
    Number.isFinite(current.coefficient) &&
    Number.isFinite(normal.coefficient)
  ) {
    shift = Math.round((current.coefficient - normal.coefficient) * 1000) / 1000;
  }
  const breakdown =
    shift != null && Math.abs(shift) >= (Number(threshold) || 0.35);
  return {
    current,
    normal,
    shift,
    breakdown,
    note: "Corrélation ≠ causalité. Score analytique TORINVEST — aide à l'interprétation, pas recommandation financière.",
  };
}

module.exports = {
  closes,
  returnsFromCloses,
  pearson,
  classifyAbs,
  correlationPair,
  correlationMatrix,
  correlationShift,
};
