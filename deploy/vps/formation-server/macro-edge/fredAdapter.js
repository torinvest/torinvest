/**
 * Adapter FRED (Federal Reserve Economic Data) — gratuit avec clé API.
 * Env : FRED_API_KEY
 */
"use strict";

const https = require("https");

function httpGetJson(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: timeoutMs || 15000 }, (res) => {
      let raw = "";
      res.on("data", (c) => {
        raw += c;
      });
      res.on("end", () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error("FRED HTTP " + res.statusCode));
          return;
        }
        try {
          resolve(JSON.parse(raw));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("FRED timeout"));
    });
  });
}

async function fetchFredSeries(seriesId, options) {
  const opts = options || {};
  const apiKey = String(process.env.FRED_API_KEY || "").trim();
  if (!apiKey) {
    const err = new Error("FRED_API_KEY missing");
    err.code = "NO_FRED_KEY";
    throw err;
  }
  const limit = Math.min(5000, Math.max(50, Number(opts.limit) || 400));
  const params = new URLSearchParams({
    series_id: seriesId,
    api_key: apiKey,
    file_type: "json",
    sort_order: "asc",
    observation_start: opts.start || "2018-01-01",
    limit: String(limit),
  });
  const url =
    "https://api.stlouisfed.org/fred/series/observations?" + params.toString();
  const data = await httpGetJson(url);
  const obs = Array.isArray(data.observations) ? data.observations : [];
  const bars = [];
  for (const o of obs) {
    const v = parseFloat(o.value);
    if (!Number.isFinite(v)) continue;
    bars.push({
      t: o.date + "T00:00:00.000Z",
      o: v,
      h: v,
      l: v,
      c: v,
    });
  }
  return {
    symbol: opts.symbol || seriesId,
    source: "fred",
    seriesId,
    timeframe: "D1",
    bars,
    updatedAt: new Date().toISOString(),
  };
}

module.exports = { fetchFredSeries };
