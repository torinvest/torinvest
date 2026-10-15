/**
 * Adapter Stooq (CSV daily OHLC) — gratuit, sans clé.
 * Utilisé pour XAUUSD / XAGUSD.
 */
"use strict";

const https = require("https");

function httpGetText(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: timeoutMs || 20000 }, (res) => {
      // Stooq peut rediriger
      if (
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        httpGetText(res.headers.location, timeoutMs).then(resolve, reject);
        res.resume();
        return;
      }
      let raw = "";
      res.on("data", (c) => {
        raw += c;
      });
      res.on("end", () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error("Stooq HTTP " + res.statusCode));
          return;
        }
        resolve(raw);
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Stooq timeout"));
    });
  });
}

function parseStooqCsv(csv) {
  const lines = String(csv || "")
    .trim()
    .split(/\r?\n/);
  if (lines.length < 2) return [];
  const bars = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    if (parts.length < 5) continue;
    const date = parts[0].trim();
    const o = parseFloat(parts[1]);
    const h = parseFloat(parts[2]);
    const l = parseFloat(parts[3]);
    const c = parseFloat(parts[4]);
    if (!date || !Number.isFinite(c)) continue;
    bars.push({
      t: date + "T00:00:00.000Z",
      o: Number.isFinite(o) ? o : c,
      h: Number.isFinite(h) ? h : c,
      l: Number.isFinite(l) ? l : c,
      c,
    });
  }
  return bars;
}

async function fetchStooqDaily(stooqSymbol, options) {
  const opts = options || {};
  const sym = String(stooqSymbol || "").toLowerCase();
  const url = "https://stooq.com/q/d/l/?s=" + encodeURIComponent(sym) + "&i=d";
  const csv = await httpGetText(url);
  let bars = parseStooqCsv(csv);
  if (!bars.length) {
    throw new Error("Stooq empty for " + sym);
  }
  const limit = Math.min(2000, Math.max(50, Number(opts.limit) || 400));
  if (bars.length > limit) bars = bars.slice(-limit);
  return {
    symbol: opts.symbol || sym.toUpperCase(),
    source: "stooq",
    stooq: sym,
    timeframe: "D1",
    bars,
    updatedAt: new Date().toISOString(),
  };
}

module.exports = { fetchStooqDaily, parseStooqCsv };
