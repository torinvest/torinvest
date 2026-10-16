/**
 * Couche data provider abstraite — Worker / FRED / Stooq / Yahoo / demo.
 */
"use strict";

const cache = require("./cache");
const { fetchFredSeries } = require("./fredAdapter");
const { fetchStooqDaily } = require("./stooqAdapter");
const { fetchYahooDaily } = require("./yahooAdapter");
const { fetchWorkerSeries } = require("./workerAdapter");
const { buildDemoSeries } = require("./demoSeries");

async function trySeedBars(symbol, meta) {
  // Bootstrap historique pour corrélations / SMT si le worker n'a que le spot
  const attempts = [];
  if (meta.fredSeed) {
    attempts.push(() =>
      fetchFredSeries(meta.fredSeed, { symbol, limit: 400 }).then((s) => s.bars)
    );
  }
  if (meta.stooq) {
    attempts.push(() =>
      fetchStooqDaily(meta.stooq, { symbol, limit: 400 }).then((s) => s.bars)
    );
  }
  attempts.push(() => fetchYahooDaily(symbol, { range: "2y" }).then((s) => s.bars));

  for (const fn of attempts) {
    try {
      const bars = await fn();
      if (bars && bars.length >= 40) return bars;
    } catch (_) {
      /* next */
    }
  }
  return null;
}

async function fetchOne(symbol, meta, config, dataDir) {
  const ttlFred = (config.cacheTtlMs && config.cacheTtlMs.fred) || 6 * 3600 * 1000;
  const ttlMkt = (config.cacheTtlMs && config.cacheTtlMs.marketDaily) || 5 * 60 * 1000;
  // Inclure la source dans la clé (ex. DXY FRED vs DXY Worker)
  const cacheKey = "series:" + symbol + ":" + (meta.source || "demo");
  const hit = cache.get(cacheKey);
  if (hit) return hit;

  let series = null;
  let error = null;
  const source = meta.source || "demo";

  try {
    if (source === "fred" && meta.fred) {
      series = await fetchFredSeries(meta.fred, { symbol, limit: 400 });
      cache.set(cacheKey, series, ttlFred);
      return series;
    }

    if (source === "worker") {
      let seedBars = null;
      // Si historique disque trop court, seed une fois
      const { readHistory } = require("./workerAdapter");
      const existing = dataDir ? readHistory(dataDir, symbol) : [];
      if (existing.length < 40) {
        seedBars = await trySeedBars(symbol, meta);
      }
      series = await fetchWorkerSeries(symbol, { dataDir, seedBars });
      cache.set(cacheKey, series, ttlMkt);
      return series;
    }

    if (source === "stooq" && meta.stooq) {
      series = await fetchStooqDaily(meta.stooq, { symbol, limit: 400 });
      cache.set(cacheKey, series, ttlMkt);
      return series;
    }

    if (source === "yahoo") {
      series = await fetchYahooDaily(symbol, { range: "2y" });
      cache.set(cacheKey, series, ttlMkt);
      return series;
    }
  } catch (e) {
    error = e;
  }

  // Chaîne de secours pour métaux : worker → yahoo → stooq → demo
  if (source !== "fred") {
    try {
      if (dataDir && source !== "worker") {
        const seedBars = await trySeedBars(symbol, meta);
        series = await fetchWorkerSeries(symbol, { dataDir, seedBars });
        cache.set(cacheKey, series, ttlMkt);
        return series;
      }
    } catch (e2) {
      error = error || e2;
    }
    try {
      series = await fetchYahooDaily(symbol, { range: "2y" });
      cache.set(cacheKey, series, ttlMkt);
      return series;
    } catch (e3) {
      error = error || e3;
    }
  }

  const demo = buildDemoSeries(symbol, { limit: 260 });
  demo.error = error ? String(error.message || error) : "provider_unavailable";
  demo.status = "demo_fallback";
  cache.set(cacheKey, demo, Math.min(ttlMkt, 120000));
  return demo;
}

async function fetchAllSeries(config, dataDir, options) {
  const opts = options || {};
  const assets = Object.assign({}, config.assets || {}, opts.assetOverrides || {});
  const symbols =
    opts.symbols || config.goldDeskSymbols || Object.keys(assets);
  const out = {};
  const errors = {};

  await Promise.all(
    symbols.map(async (sym) => {
      const meta = assets[sym] || { source: "demo" };
      try {
        out[sym] = await fetchOne(sym, meta, config, dataDir);
        if (out[sym].source === "demo") {
          errors[sym] = out[sym].error || "demo";
        }
      } catch (e) {
        out[sym] = buildDemoSeries(sym, { limit: 260 });
        out[sym].status = "demo_fallback";
        out[sym].error = String(e.message || e);
        errors[sym] = out[sym].error;
      }
    })
  );

  return { series: out, errors, updatedAt: new Date().toISOString() };
}

function summarizeLevels(seriesMap) {
  const levels = {};
  for (const [sym, s] of Object.entries(seriesMap || {})) {
    if (!s || !s.bars || !s.bars.length) {
      levels[sym] = {
        value: null,
        status: "Data unavailable",
        source: s && s.source,
        updatedAt: s && s.updatedAt,
      };
      continue;
    }
    const last = s.bars[s.bars.length - 1];
    levels[sym] = {
      value: last.c,
      t: last.t,
      source: s.source,
      updatedAt: s.updatedAt,
      warning: s.warning || null,
      status: s.source === "demo" ? "demo" : "ok",
    };
  }
  return levels;
}

module.exports = {
  fetchOne,
  fetchAllSeries,
  summarizeLevels,
};
