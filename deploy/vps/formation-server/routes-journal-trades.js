/**
 * Journal de trading natif — La Forge (remplace le TJ Pro radar pour le flux élève).
 *
 *   GET    /api/journal-trades
 *   GET    /api/journal-trades/:id
 *   POST   /api/journal-trades
 *   PUT    /api/journal-trades/:id
 *   DELETE /api/journal-trades/:id
 *   POST   /api/journal-trades/:id/images
 *   DELETE /api/journal-trades/:id/images/:imageId
 *   GET    /api/journal-trades/:id/media/:fileName
 *   GET    /api/journal-trades/ping
 *
 * Stockage : {dataDir}/journal-trades/{emailSlug}/trades.json + media/
 */
"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_TRADES = 500;
const ALLOWED_MIME = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};
const SIDES = ["long", "short"];
const STATUSES = ["open", "closed", "idea"];
const PNL_UNITS = ["usd", "r", "pips", "%"];

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function parseAdminEmails() {
  const raw = String(process.env.FORGE_ADMIN_EMAILS || process.env.ADMIN_EMAILS || "").trim();
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

function sessionEmail(req) {
  return normalizeEmail(req.session?.user?.email || req.user?.email || "");
}

function isSubscribed(req) {
  const u = req.session?.user || req.user || {};
  if (u.subscribed === true || u.subscribed === 1 || u.subscribed === "true") return true;
  const plan = String(u.plan || "").toLowerCase();
  return plan === "premium" || plan === "subscribed";
}

function clip(s, max) {
  return String(s || "").trim().slice(0, max);
}

function newId(prefix) {
  return prefix + crypto.randomBytes(8).toString("hex");
}

function emailSlug(email) {
  return normalizeEmail(email).replace(/[^a-z0-9@._+-]/g, "_");
}

function toNum(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function sanitizeImages(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((img) => ({
      id: clip(img && img.id, 40) || newId("img_"),
      file: clip(img && img.file, 120),
      caption: clip(img && img.caption, 300),
      createdAt: clip(img && img.createdAt, 40),
    }))
    .filter((img) => img.file)
    .slice(0, 24);
}

function sanitizeTrade(input, prev) {
  const src = input && typeof input === "object" ? input : {};
  const side = String(src.side || "long").toLowerCase();
  const status = String(src.status || "open").toLowerCase();
  const pnlUnit = String(src.pnlUnit || "usd").toLowerCase();
  const now = new Date().toISOString();
  return {
    id: prev?.id || clip(src.id, 40) || newId("tr_"),
    symbol: clip(src.symbol || src.pair, 40).toUpperCase() || "XAUUSD",
    side: SIDES.includes(side) ? side : "long",
    status: STATUSES.includes(status) ? status : "open",
    entry: toNum(src.entry),
    sl: toNum(src.sl),
    tp: toNum(src.tp),
    exit: toNum(src.exit),
    pnl: toNum(src.pnl),
    pnlUnit: PNL_UNITS.includes(pnlUnit) ? pnlUnit : "usd",
    riskR: toNum(src.riskR),
    openedAt: clip(src.openedAt, 40) || prev?.openedAt || now.slice(0, 10),
    closedAt: clip(src.closedAt, 40) || null,
    setup: clip(src.setup, 120),
    timeframe: clip(src.timeframe, 20),
    notes: clip(src.notes, 12000),
    tags: Array.isArray(src.tags)
      ? src.tags.map((t) => clip(t, 40)).filter(Boolean).slice(0, 12)
      : typeof src.tags === "string"
        ? String(src.tags)
            .split(/[,;]+/)
            .map((t) => clip(t, 40))
            .filter(Boolean)
            .slice(0, 12)
        : prev?.tags || [],
    images: sanitizeImages(src.images != null ? src.images : prev?.images),
    createdAt: prev?.createdAt || now,
    updatedAt: now,
  };
}

function summaryOf(t) {
  return {
    id: t.id,
    symbol: t.symbol,
    side: t.side,
    status: t.status,
    entry: t.entry,
    exit: t.exit,
    pnl: t.pnl,
    pnlUnit: t.pnlUnit,
    openedAt: t.openedAt,
    closedAt: t.closedAt,
    setup: t.setup,
    timeframe: t.timeframe,
    imageCount: Array.isArray(t.images) ? t.images.length : 0,
    updatedAt: t.updatedAt,
  };
}

module.exports = function createJournalTradesRouter({ dataDir, requireAuth }) {
  if (typeof requireAuth !== "function") {
    throw new Error("createJournalTradesRouter: requireAuth requis");
  }

  const rootDir = path.join(dataDir, "journal-trades");
  fs.mkdirSync(rootDir, { recursive: true });

  function userDir(email) {
    const dir = path.join(rootDir, emailSlug(email));
    fs.mkdirSync(path.join(dir, "media"), { recursive: true });
    return dir;
  }

  function storePath(email) {
    return path.join(userDir(email), "trades.json");
  }

  function readStore(email) {
    try {
      const p = storePath(email);
      if (!fs.existsSync(p)) return { version: 1, trades: [] };
      const raw = JSON.parse(fs.readFileSync(p, "utf8"));
      const trades = Array.isArray(raw.trades) ? raw.trades : [];
      return { version: 1, trades: trades.slice(0, MAX_TRADES) };
    } catch (_) {
      return { version: 1, trades: [] };
    }
  }

  function writeStore(email, store) {
    const p = storePath(email);
    const tmp = p + ".tmp";
    const payload = {
      version: 1,
      updatedAt: new Date().toISOString(),
      trades: Array.isArray(store.trades) ? store.trades.slice(0, MAX_TRADES) : [],
    };
    fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf8");
    fs.renameSync(tmp, p);
  }

  function requirePremium(req, res) {
    const email = sessionEmail(req);
    if (!email) {
      res.status(401).json({ error: "Non authentifié" });
      return null;
    }
    if (!isAdminEmail(email) && !isSubscribed(req)) {
      res.status(403).json({ error: "Premium requis" });
      return null;
    }
    return email;
  }

  const router = express.Router();

  router.get("/api/journal-trades/ping", (_req, res) => {
    res.json({
      ok: true,
      app: "forge-journal-native",
      version: 1,
      contract: "list→view→edit",
    });
  });

  router.get("/api/journal-trades", requireAuth, (req, res) => {
    const email = requirePremium(req, res);
    if (!email) return;
    const store = readStore(email);
    const trades = store.trades
      .slice()
      .sort((a, b) => String(b.openedAt || b.updatedAt || "").localeCompare(String(a.openedAt || a.updatedAt || "")));
    res.json({ ok: true, trades: trades.map(summaryOf), count: trades.length });
  });

  router.get("/api/journal-trades/:id", requireAuth, (req, res) => {
    const email = requirePremium(req, res);
    if (!email) return;
    const id = clip(req.params.id, 40);
    const store = readStore(email);
    const trade = store.trades.find((t) => t.id === id);
    if (!trade) return res.status(404).json({ error: "Trade introuvable" });
    res.json({ ok: true, trade });
  });

  router.post("/api/journal-trades", requireAuth, (req, res) => {
    const email = requirePremium(req, res);
    if (!email) return;
    const store = readStore(email);
    if (store.trades.length >= MAX_TRADES) {
      return res.status(400).json({ error: "Limite de trades atteinte" });
    }
    const trade = sanitizeTrade(req.body || {}, null);
    store.trades.unshift(trade);
    writeStore(email, store);
    res.status(201).json({ ok: true, trade });
  });

  router.put("/api/journal-trades/:id", requireAuth, (req, res) => {
    const email = requirePremium(req, res);
    if (!email) return;
    const id = clip(req.params.id, 40);
    const store = readStore(email);
    const idx = store.trades.findIndex((t) => t.id === id);
    if (idx < 0) return res.status(404).json({ error: "Trade introuvable" });
    const trade = sanitizeTrade({ ...(req.body || {}), id }, store.trades[idx]);
    store.trades[idx] = trade;
    writeStore(email, store);
    res.json({ ok: true, trade });
  });

  router.delete("/api/journal-trades/:id", requireAuth, (req, res) => {
    const email = requirePremium(req, res);
    if (!email) return;
    const id = clip(req.params.id, 40);
    const store = readStore(email);
    const prev = store.trades.find((t) => t.id === id);
    if (!prev) return res.status(404).json({ error: "Trade introuvable" });
    store.trades = store.trades.filter((t) => t.id !== id);
    writeStore(email, store);
    // best-effort media cleanup
    try {
      const mediaDir = path.join(userDir(email), "media", id);
      if (fs.existsSync(mediaDir)) {
        for (const f of fs.readdirSync(mediaDir)) {
          fs.unlinkSync(path.join(mediaDir, f));
        }
        fs.rmdirSync(mediaDir);
      }
    } catch (_) {}
    res.json({ ok: true, deleted: id });
  });

  router.post("/api/journal-trades/:id/images", requireAuth, (req, res) => {
    const email = requirePremium(req, res);
    if (!email) return;
    const id = clip(req.params.id, 40);
    const store = readStore(email);
    const idx = store.trades.findIndex((t) => t.id === id);
    if (idx < 0) return res.status(404).json({ error: "Trade introuvable" });

    const dataUrl = String(req.body?.dataUrl || "");
    const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!m) return res.status(400).json({ error: "dataUrl image invalide" });
    const mime = m[1].toLowerCase();
    const ext = ALLOWED_MIME[mime];
    if (!ext) return res.status(400).json({ error: "Type image non supporté" });
    let buf;
    try {
      buf = Buffer.from(m[2], "base64");
    } catch (_) {
      return res.status(400).json({ error: "Base64 invalide" });
    }
    if (!buf.length || buf.length > MAX_IMAGE_BYTES) {
      return res.status(413).json({ error: "Image trop lourde" });
    }

    const imgId = newId("img_");
    const fileName = imgId + ext;
    const mediaDir = path.join(userDir(email), "media", id);
    fs.mkdirSync(mediaDir, { recursive: true });
    fs.writeFileSync(path.join(mediaDir, fileName), buf);

    const trade = store.trades[idx];
    const images = sanitizeImages(trade.images || []);
    images.push({
      id: imgId,
      file: fileName,
      caption: clip(req.body?.caption, 300),
      createdAt: new Date().toISOString(),
    });
    trade.images = images.slice(0, 24);
    trade.updatedAt = new Date().toISOString();
    store.trades[idx] = trade;
    writeStore(email, store);
    res.status(201).json({ ok: true, trade, image: images[images.length - 1] });
  });

  router.delete("/api/journal-trades/:id/images/:imageId", requireAuth, (req, res) => {
    const email = requirePremium(req, res);
    if (!email) return;
    const id = clip(req.params.id, 40);
    const imageId = clip(req.params.imageId, 40);
    const store = readStore(email);
    const idx = store.trades.findIndex((t) => t.id === id);
    if (idx < 0) return res.status(404).json({ error: "Trade introuvable" });
    const trade = store.trades[idx];
    const images = sanitizeImages(trade.images || []);
    const victim = images.find((img) => img.id === imageId);
    trade.images = images.filter((img) => img.id !== imageId);
    trade.updatedAt = new Date().toISOString();
    store.trades[idx] = trade;
    writeStore(email, store);
    if (victim && victim.file) {
      try {
        fs.unlinkSync(path.join(userDir(email), "media", id, victim.file));
      } catch (_) {}
    }
    res.json({ ok: true, trade });
  });

  router.get("/api/journal-trades/:id/media/:fileName", requireAuth, (req, res) => {
    const email = requirePremium(req, res);
    if (!email) return;
    const id = clip(req.params.id, 40);
    const fileName = path.basename(String(req.params.fileName || ""));
    if (!fileName || fileName.includes("..")) {
      return res.status(400).json({ error: "Fichier invalide" });
    }
    const store = readStore(email);
    const trade = store.trades.find((t) => t.id === id);
    if (!trade) return res.status(404).json({ error: "Trade introuvable" });
    const ok = (trade.images || []).some((img) => img.file === fileName);
    if (!ok) return res.status(404).json({ error: "Image introuvable" });
    const filePath = path.join(userDir(email), "media", id, fileName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Fichier manquant" });
    res.sendFile(filePath);
  });

  return router;
};
