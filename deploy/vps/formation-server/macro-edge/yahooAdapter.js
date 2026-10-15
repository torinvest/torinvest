/**
 * Adapter Yahoo Finance chart (seed historique OHLC, gratuit, sans clé).
 * Utilisé uniquement pour bootstrap si Worker n'a pas encore d'historique daily.
 */
"use strict";

const https = require("https");

const YAHOO_MAP = {
  XAUUSD: "GC=F",
  XAGUSD: "SI=F",
};

function httpGetJson(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        timeout: timeoutMs || 20000,
        headers: {
          "User-Agent": "TORINVEST-MacroEdge/1.0",
          Accept: "application/json",
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => {
          raw += c;
        });
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error("Yahoo HTTP " + res.statusCode));
            return;
          }
          try {
            resolve(JSON.parse(raw));
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Yahoo timeout"));
    });
  });
}

async function fetchYahooDaily(symbol, options) {
  const opts = options || {};
  const ySym = YAHOO_MAP[String(symbol).toUpperCase()];
  if (!ySym) {
    throw new Error("No Yahoo map for " + symbol);
  }
  const range = opts.range || "2y";
  const url =
    "https://query1.finance.yahoo.com/v8/finance/chart/" +
    encodeURIComponent(ySym) +
    "?interval=1d&range=" +
    encodeURIComponent(range);
  const data = await httpGetJson(url);
  const result =
    data &&
    data.chart &&
    data.chart.result &&
    data.chart.result[0];
  if (!result || !result.timestamp) {
    throw new Error("Yahoo empty for " + ySym);
  }
  const quote = (result.indicators && result.indicators.quote && result.indicators.quote[0]) || {};
  const bars = [];
  for (let i = 0; i < result.timestamp.length; i++) {
    const c = quote.close && quote.close[i];
    if (!Number.isFinite(c)) continue;
    const ts = new Date(result.timestamp[i] * 1000).toISOString().slice(0, 10);
    bars.push({
      t: ts + "T00:00:00.000Z",
      o: Number.isFinite(quote.open && quote.open[i]) ? quote.open[i] : c,
      h: Number.isFinite(quote.high && quote.high[i]) ? quote.high[i] : c,
      l: Number.isFinite(quote.low && quote.low[i]) ? quote.low[i] : c,
      c,
    });
  }
  if (!bars.length) throw new Error("Yahoo no bars for " + ySym);
  return {
    symbol: String(symbol).toUpperCase(),
    source: "yahoo",
    yahoo: ySym,
    timeframe: "D1",
    bars,
    updatedAt: new Date().toISOString(),
  };
}

module.exports = { fetchYahooDaily, YAHOO_MAP };
