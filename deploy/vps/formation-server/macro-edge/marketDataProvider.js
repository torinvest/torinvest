/**
 * Couche data provider abstraite — adapters FRED / Stooq / demo.
 */
"use strict";

const cache = require("./cache");
const { fetchFredSeries } = require("./fredAdapter");
const { fetchStooqDaily } = require("./stooqAdapter");
const { buildDemoSeries } = require("./demoSeries");

async function fetchOne(symbol, meta, config) {
  const ttlFred = (config.cacheTtlMs && config.cacheTtlMs.fred) || 6 * 3600 * 1000;
  const ttlMkt = (config.cacheTtlMs && config.cacheTtlMs.marketDaily) || 5 * 60 * 1000;
  const cacheKey = "series:" + symbol;
  const hit = cache.get(cacheKey);
  if (hit) return hit;

  let series = null;
  let error = null;

  try {
    if (meta.source === "fred" && meta.fred) {
      series = await fetchFredSeries(meta.fred, { symbol, limit: 400 });
      cache.set(cacheKey, series, ttlFred);
      return series;
    }
    if (meta.source === "stooq" && meta.stooq) {
      series = await fetchStooqDaily(meta.stooq, { symbol, limit: 400 });
      cache.set(cacheKey, series, ttlMkt);
      return series;
    }
  } catch (e) {
    error = e;
  }

  // Fallback demo — jamais afficher 0 comme valeur réelle
  const demo = buildDemoSeries(symbol, { limit: 260 });
  demo.error = error ? String(error.message || error) : "provider_unavailable";
  demo.status = "demo_fallback";
  cache.set(cacheKey, demo, Math.min(ttlMkt, 120000));
  return demo;
}

async function fetchAllSeries(config) {
  const assets = config.assets || {};
  const symbols = config.goldDeskSymbols || Object.keys(assets);
  const out = {};
  const errors = {};

  await Promise.all(
    symbols.map(async (sym) => {
      const meta = assets[sym] || { source: "demo" };
      try {
        out[sym] = await fetchOne(sym, meta, config);
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
