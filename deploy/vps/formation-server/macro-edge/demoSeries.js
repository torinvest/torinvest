/**
 * Séries démo déterministes — utilisées si FRED/Stooq indisponibles.
 * Toujours marquées source: "demo" pour ne jamais passer pour des données live.
 */
"use strict";

function hashSeed(str) {
  let h = 2166136261;
  const s = String(str || "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BASES = {
  XAUUSD: 2350,
  XAGUSD: 28,
  DXY: 104,
  US02Y: 4.2,
  US10Y: 4.3,
  REAL10Y: 1.8,
  BE10Y: 2.3,
};

const VOL = {
  XAUUSD: 0.006,
  XAGUSD: 0.01,
  DXY: 0.0025,
  US02Y: 0.008,
  US10Y: 0.006,
  REAL10Y: 0.01,
  BE10Y: 0.005,
};

function buildDemoSeries(symbol, options) {
  const opts = options || {};
  const n = Math.min(800, Math.max(80, Number(opts.limit) || 260));
  const seed = hashSeed(symbol + "|macro-edge-v1");
  const rnd = mulberry32(seed);
  const base = BASES[symbol] || 100;
  const vol = VOL[symbol] || 0.005;
  const bars = [];
  let price = base;
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);

  // Légère décorrélation intentionnelle XAU vs REAL10Y sur les 20 dernières barres
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end.getTime() - i * 86400000);
    // skip weekends roughly
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) continue;

    let shock = (rnd() - 0.48) * vol;
    if (symbol === "XAUUSD" && i < 25) shock += 0.0025;
    if (symbol === "REAL10Y" && i < 25) shock += 0.003;
    if (symbol === "DXY" && i < 25) shock += 0.001;
    if (symbol === "XAGUSD" && i < 20) shock -= 0.0015;

    const prev = price;
    price = Math.max(0.01, price * (1 + shock));
    const high = Math.max(prev, price) * (1 + rnd() * vol * 0.4);
    const low = Math.min(prev, price) * (1 - rnd() * vol * 0.4);
    bars.push({
      t: d.toISOString().slice(0, 10) + "T00:00:00.000Z",
      o: prev,
      h: high,
      l: low,
      c: price,
    });
  }

  return {
    symbol,
    source: "demo",
    timeframe: "D1",
    bars,
    updatedAt: new Date().toISOString(),
    warning:
      "Data unavailable from live providers — showing DEMO series for pedagogy only.",
  };
}

module.exports = { buildDemoSeries };
