/**
 * Adapter Worker TORINVEST (TradingView → /market/blocks).
 * Fournit le dernier prix live XAUUSD / XAGUSD (+ autres si présents).
 * Construit un historique OHLC daily en append sur disque (pour corrélations / SMT).
 *
 * Env :
 *   FORGE_WORKER_URL / WORKER_URL — défaut morning-hall-d8f6.onzerimes.workers.dev
 */
"use strict";

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

const DEFAULT_WORKER =
  "https://morning-hall-d8f6.onzerimes.workers.dev";

function workerBase() {
  return String(
    process.env.FORGE_WORKER_URL ||
      process.env.WORKER_URL ||
      DEFAULT_WORKER
  )
    .trim()
    .replace(/\/$/, "");
}

function httpGetJson(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, { timeout: timeoutMs || 15000 }, (res) => {
      let raw = "";
      res.on("data", (c) => {
        raw += c;
      });
      res.on("end", () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error("Worker HTTP " + res.statusCode));
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
      reject(new Error("Worker timeout"));
    });
  });
}

function findSymbolQuote(blocks, symbol) {
  const want = String(symbol || "").toUpperCase();
  if (!blocks || typeof blocks !== "object") return null;
  const prefer = ["CORE", "GOLD", "COMMODITIES", "FOREX", "INDICES", "RISK"];
  for (const group of prefer) {
    const g = blocks[group];
    if (g && g[want] && Number.isFinite(Number(g[want].price))) {
      return g[want];
    }
  }
  for (const group of Object.keys(blocks)) {
    const g = blocks[group];
    if (g && g[want] && Number.isFinite(Number(g[want].price))) {
      return g[want];
    }
  }
  return null;
}

async function fetchWorkerBlocks() {
  const url = workerBase() + "/market/blocks";
  const data = await httpGetJson(url);
  if (!data || data.ok === false) {
    throw new Error("Worker /market/blocks unavailable");
  }
  return data;
}

function dayKey(iso) {
  return String(iso || new Date().toISOString()).slice(0, 10);
}

function historyPath(dataDir, symbol) {
  return path.join(dataDir, "macro-edge", "ohlc", symbol.toUpperCase() + ".json");
}

function readHistory(dataDir, symbol) {
  try {
    const raw = JSON.parse(fs.readFileSync(historyPath(dataDir, symbol), "utf8"));
    return Array.isArray(raw.bars) ? raw.bars : [];
  } catch {
    return [];
  }
}

function writeHistory(dataDir, symbol, bars) {
  const file = historyPath(dataDir, symbol);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const trimmed = bars.slice(-800);
  const tmp = file + ".tmp";
  fs.writeFileSync(
    tmp,
    JSON.stringify(
      {
        symbol: symbol.toUpperCase(),
        source: "worker",
        updatedAt: new Date().toISOString(),
        bars: trimmed,
      },
      null,
      2
    ),
    "utf8"
  );
  fs.renameSync(tmp, file);
  return trimmed;
}

/**
 * Upsert barre daily à partir du prix spot worker.
 */
function upsertDailyBar(bars, price, atIso) {
  const t = dayKey(atIso) + "T00:00:00.000Z";
  const p = Number(price);
  if (!Number.isFinite(p) || p <= 0) return bars;
  const out = Array.isArray(bars) ? bars.slice() : [];
  const last = out[out.length - 1];
  if (last && last.t === t) {
    out[out.length - 1] = {
      t,
      o: Number.isFinite(last.o) ? last.o : p,
      h: Math.max(Number(last.h) || p, p),
      l: Math.min(Number(last.l) || p, p),
      c: p,
    };
  } else {
    out.push({ t, o: p, h: p, l: p, c: p });
  }
  return out;
}

/**
 * Fusionne un seed historique (FRED/Stooq) avec l'historique worker, sans écraser les jours worker plus récents.
 */
function mergeSeed(seedBars, workerBars) {
  const map = new Map();
  for (const b of seedBars || []) {
    if (!b || !b.t || !Number.isFinite(b.c)) continue;
    map.set(String(b.t).slice(0, 10), b);
  }
  for (const b of workerBars || []) {
    if (!b || !b.t || !Number.isFinite(b.c)) continue;
    map.set(String(b.t).slice(0, 10), b);
  }
  return Array.from(map.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([, v]) => v);
}

/**
 * Série complète pour un symbole metal depuis le worker + historique disque.
 * @param {object} seedSeries optionnel — série FRED/Stooq pour bootstrap
 */
async function fetchWorkerSeries(symbol, options) {
  const opts = options || {};
  const dataDir = opts.dataDir;
  if (!dataDir) {
    throw new Error("workerAdapter requires dataDir");
  }

  const payload = await fetchWorkerBlocks();
  const quote = findSymbolQuote(payload.blocks, symbol);
  if (!quote) {
    throw new Error("Worker quote missing for " + symbol);
  }

  const price = Number(quote.price);
  const updatedAt =
    payload.updatedAt || quote.receivedAt || new Date().toISOString();

  let bars = readHistory(dataDir, symbol);
  if (opts.seedBars && opts.seedBars.length) {
    bars = mergeSeed(opts.seedBars, bars);
  }
  bars = upsertDailyBar(bars, price, updatedAt);
  bars = writeHistory(dataDir, symbol, bars);

  return {
    symbol: String(symbol).toUpperCase(),
    source: "worker",
    worker: workerBase(),
    timeframe: "D1",
    bars,
    lastPrice: price,
    previousPrice: Number.isFinite(Number(quote.previousPrice))
      ? Number(quote.previousPrice)
      : null,
    macroContext: quote.macroContext || null,
    updatedAt,
    status: "ok",
  };
}

module.exports = {
  workerBase,
  fetchWorkerBlocks,
  findSymbolQuote,
  fetchWorkerSeries,
  readHistory,
  mergeSeed,
  upsertDailyBar,
};
