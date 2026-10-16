/**
 * TORINVEST Macro Edge — SMT Monitor (Gold Desk + FX Desk).
 *
 *   const createMacroEdgeRouter = require("./server-patches/routes-macro-edge");
 *   app.use(createMacroEdgeRouter({ dataDir, requireAuth }));
 *
 * Env :
 *   FRED_API_KEY (optionnel) — séries FRED (yields, Gold Desk DXY proxy)
 *   FORGE_WORKER_URL / WORKER_URL — prix live métaux + FX (TradingView → /market/blocks)
 *   FORGE_ADMIN_EMAILS — panneau config admin
 */
"use strict";

const express = require("express");
const path = require("path");
const { createStore } = require("./macro-edge/store");
const { buildSnapshot } = require("./macro-edge/engine");
const cache = require("./macro-edge/cache");
const market = require("./macro-edge/marketDataProvider");

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function parseAdminEmails() {
  const raw = String(
    process.env.FORGE_ADMIN_EMAILS || process.env.ADMIN_EMAILS || ""
  ).trim();
  if (!raw) return [];
  return raw
    .split(/[,;\s]+/)
    .map(normalizeEmail)
    .filter(Boolean);
}

function isAdminEmail(email) {
  const admins = parseAdminEmails();
  if (!admins.length) return false;
  return admins.includes(normalizeEmail(email));
}

function sessionUser(req) {
  return req.session?.user || req.user || {};
}

function isSubscribed(req) {
  const u = sessionUser(req);
  if (u.subscribed === true || u.subscribed === 1 || u.subscribed === "true") {
    return true;
  }
  if (u.isAdmin || isAdminEmail(u.email)) return true;
  const plan = String(u.plan || "").toLowerCase();
  return plan === "premium" || plan === "subscribed";
}

function parseDesk(q) {
  const d = String((q && q.desk) || "gold")
    .trim()
    .toLowerCase();
  if (d === "fx" || d === "forex" || d === "fx_desk") return "fx";
  return "gold";
}

function createMacroEdgeRouter(options) {
  const opts = options || {};
  const requireAuth = opts.requireAuth;
  if (typeof requireAuth !== "function") {
    throw new Error("createMacroEdgeRouter: requireAuth middleware required");
  }
  const dataDir = opts.dataDir || path.join(__dirname, "..", "data");
  const store = createStore(dataDir);
  const router = express.Router();

  function requirePremium(req, res, next) {
    if (!isSubscribed(req)) {
      return res.status(403).json({
        error: "premium_required",
        message: "Macro Edge est réservé aux membres Premium La Forge.",
      });
    }
    return next();
  }

  function requireAdmin(req, res, next) {
    const email = normalizeEmail(sessionUser(req).email);
    if (!isAdminEmail(email) && !sessionUser(req).isAdmin) {
      return res.status(403).json({ error: "admin_required" });
    }
    return next();
  }

  router.get(
    "/api/macro-edge/health",
    requireAuth,
    requirePremium,
    (req, res) => {
      const cfg = store.loadConfig();
      const { workerBase } = require("./macro-edge/workerAdapter");
      res.json({
        ok: true,
        module: "macro-edge",
        version: "2.0.0-mvp-fx-desk",
        desks: ["gold", "fx"],
        fredConfigured: !!String(process.env.FRED_API_KEY || "").trim(),
        workerUrl: workerBase(),
        assets: Object.keys(cfg.assets || {}),
        fxDeskSymbols: cfg.fxDeskSymbols || [],
      });
    }
  );

  router.get(
    "/api/macro-edge/snapshot",
    requireAuth,
    requirePremium,
    async (req, res) => {
      try {
        const desk = parseDesk(req.query);
        const snapshot = await buildSnapshot(store, desk);
        res.json(snapshot);
      } catch (e) {
        res.status(500).json({
          error: "snapshot_failed",
          message: String(e.message || e),
          status: "Data unavailable",
        });
      }
    }
  );

  router.get(
    "/api/macro-edge/explain",
    requireAuth,
    requirePremium,
    async (req, res) => {
      try {
        const desk = parseDesk(req.query);
        const snapshot = await buildSnapshot(store, desk);
        res.json(snapshot.explain || { status: "Data unavailable" });
      } catch (e) {
        res.status(500).json({
          error: "explain_failed",
          message: String(e.message || e),
        });
      }
    }
  );

  router.get(
    "/api/macro-edge/series",
    requireAuth,
    requirePremium,
    async (req, res) => {
      try {
        const cfg = store.loadConfig();
        const desk = parseDesk(req.query);
        const fetchOpts =
          desk === "fx"
            ? {
                symbols: cfg.fxDeskSymbols,
                assetOverrides: cfg.fxAssetOverrides || {},
              }
            : {};
        const { series } = await market.fetchAllSeries(cfg, dataDir, fetchOpts);
        const want = String(req.query.symbols || "")
          .split(",")
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean);
        const keys = want.length
          ? want
          : desk === "fx"
            ? cfg.fxDeskSymbols
            : cfg.goldDeskSymbols;
        const out = {};
        for (const k of keys) {
          if (!series[k]) {
            out[k] = { status: "Data unavailable" };
            continue;
          }
          const limit = Math.min(
            500,
            Math.max(20, Number(req.query.limit) || 120)
          );
          const bars = series[k].bars.slice(-limit);
          out[k] = {
            symbol: k,
            source: series[k].source,
            timeframe: series[k].timeframe || "D1",
            bars,
            updatedAt: series[k].updatedAt,
            warning: series[k].warning || null,
            status: series[k].status || "ok",
          };
        }
        res.json({
          desk,
          series: out,
          updatedAt: new Date().toISOString(),
        });
      } catch (e) {
        res.status(500).json({
          error: "series_failed",
          message: String(e.message || e),
          status: "Data unavailable",
        });
      }
    }
  );

  router.get(
    "/api/macro-edge/config",
    requireAuth,
    requirePremium,
    (req, res) => {
      const cfg = store.loadConfig();
      const email = normalizeEmail(sessionUser(req).email);
      const admin = isAdminEmail(email) || !!sessionUser(req).isAdmin;
      if (!admin) {
        return res.json({
          mode: cfg.mode,
          version: cfg.version,
          goldDeskSymbols: cfg.goldDeskSymbols,
          fxDeskSymbols: cfg.fxDeskSymbols,
          pedagogy: cfg.pedagogy,
          disclaimer: cfg.disclaimer,
          correlation: {
            lookbacks: cfg.correlation.lookbacks,
            defaultLookback: cfg.correlation.defaultLookback,
            breakdownThreshold: cfg.correlation.breakdownThreshold,
          },
          scoreNote:
            "Score analytique TORINVEST — aide à l'interprétation, pas recommandation financière.",
        });
      }
      return res.json(cfg);
    }
  );

  router.put(
    "/api/macro-edge/config",
    requireAuth,
    requirePremium,
    requireAdmin,
    express.json({ limit: "200kb" }),
    (req, res) => {
      try {
        const body = req.body || {};
        const allowed = [
          "goldDriverWeights",
          "smtWeights",
          "alerts",
          "correlation",
          "fxCorrelation",
          "swing",
          "smtPairs",
          "fxSmtPairs",
          "policyDiffPairs",
          "centralBanks",
          "centralBanksUpdatedAt",
          "pedagogy",
          "cacheTtlMs",
        ];
        const patch = {};
        for (const k of allowed) {
          if (body[k] !== undefined) patch[k] = body[k];
        }
        if (patch.centralBanks && !patch.centralBanksUpdatedAt) {
          patch.centralBanksUpdatedAt = new Date().toISOString();
        }
        const next = store.saveConfig(patch);
        cache.clear("snapshot:");
        cache.clear("series:");
        res.json({ ok: true, config: next });
      } catch (e) {
        res.status(500).json({ error: String(e.message || e) });
      }
    }
  );

  router.post(
    "/api/macro-edge/refresh",
    requireAuth,
    requirePremium,
    requireAdmin,
    (req, res) => {
      cache.clear("snapshot:");
      cache.clear("series:");
      res.json({ ok: true, cleared: true });
    }
  );

  router.get(
    "/api/macro-edge/history/:kind",
    requireAuth,
    requirePremium,
    requireAdmin,
    (req, res) => {
      const kind = String(req.params.kind || "").replace(/[^a-z0-9_-]/gi, "");
      if (!kind) return res.status(400).json({ error: "bad_kind" });
      const rows = store.readHistory(kind, Number(req.query.limit) || 50);
      res.json({ kind, rows });
    }
  );

  return router;
}

module.exports = createMacroEdgeRouter;
