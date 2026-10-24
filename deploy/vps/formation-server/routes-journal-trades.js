/**
 * Journal de trading natif — La Forge
 *
 * Isolation :
 *   - chaque élève Premium lit/écrit UNIQUEMENT son dossier
 *     {dataDir}/journal-trades/{emailSlug}/
 *   - un élève ne peut PAS voir les trades d’un autre
 *   - admin (FORGE_ADMIN_EMAILS) peut lister tous les élèves
 *     et ouvrir un journal via ?owner=email
 *
 *   GET    /api/journal-trades
 *   GET    /api/journal-trades/:id
 *   POST   /api/journal-trades
 *   PUT    /api/journal-trades/:id
 *   DELETE /api/journal-trades/:id
 *   POST   /api/journal-trades/:id/images          (1 ou N screens)
 *   PATCH  /api/journal-trades/:id/images/:imageId (caption)
 *   DELETE /api/journal-trades/:id/images/:imageId
 *   GET    /api/journal-trades/:id/media/:fileName
 *   GET    /api/journal-trades-admin/students       (admin)
 *   GET    /api/journal-trades/ping
 */
"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_TRADES = 500;
const MAX_IMAGES_PER_TRADE = 24;
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
    .slice(0, MAX_IMAGES_PER_TRADE);
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
      if (!fs.existsSync(p)) return { version: 1, owner: normalizeEmail(email), trades: [] };
      const raw = JSON.parse(fs.readFileSync(p, "utf8"));
      const trades = Array.isArray(raw.trades) ? raw.trades : [];
      return {
        version: 1,
        owner: normalizeEmail(raw.owner || email),
        trades: trades.slice(0, MAX_TRADES),
      };
    } catch (_) {
      return { version: 1, owner: normalizeEmail(email), trades: [] };
    }
  }

  function writeStore(email, store) {
    const p = storePath(email);
    const tmp = p + ".tmp";
    const payload = {
      version: 1,
      owner: normalizeEmail(email),
      updatedAt: new Date().toISOString(),
      trades: Array.isArray(store.trades) ? store.trades.slice(0, MAX_TRADES) : [],
    };
    fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf8");
    fs.renameSync(tmp, p);
  }

  function requireMember(req, res) {
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

  /**
   * Isolation stricte :
   * - élève → toujours son email
   * - admin → peut passer ?owner=autre@email (sinon son propre journal)
   * - tout autre owner demandé par un non-admin → 403
   */
  function resolveOwner(req, res) {
    const self = requireMember(req, res);
    if (!self) return null;
    const requested = normalizeEmail(req.query.owner || req.body?.owner || "");
    if (!requested || requested === self) {
      return { self, owner: self, isAdmin: isAdminEmail(self), viewingOther: false };
    }
    if (!isAdminEmail(self)) {
      res.status(403).json({
        error: "Accès refusé — tu ne peux voir que ton propre journal",
      });
      return null;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requested)) {
      res.status(400).json({ error: "Email owner invalide" });
      return null;
    }
    return { self, owner: requested, isAdmin: true, viewingOther: true };
  }

  function decodeDataUrl(dataUrl) {
    const m = String(dataUrl || "").match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!m) return { error: "dataUrl image invalide" };
    const mime = m[1].toLowerCase();
    const ext = ALLOWED_MIME[mime];
    if (!ext) return { error: "Type image non supporté" };
    let buf;
    try {
      buf = Buffer.from(m[2], "base64");
    } catch (_) {
      return { error: "Base64 invalide" };
    }
    if (!buf.length || buf.length > MAX_IMAGE_BYTES) {
      return { error: "Image trop lourde", status: 413 };
    }
    return { buf, ext, mime };
  }

  const router = express.Router();

  router.get("/api/journal-trades/ping", (_req, res) => {
    res.json({
      ok: true,
      app: "forge-journal-native",
      version: 2,
      isolation: "per-email",
      admin: "FORGE_ADMIN_EMAILS + ?owner=",
      screens: "multi+edit-caption",
      contract: "list→view→edit",
    });
  });

  // Admin : liste des élèves qui ont un journal (pas visible aux élèves)
  router.get("/api/journal-trades-admin/students", requireAuth, (req, res) => {
    const self = sessionEmail(req);
    if (!isAdminEmail(self)) {
      return res.status(403).json({ error: "Admin uniquement" });
    }
    const students = [];
    try {
      const dirs = fs.readdirSync(rootDir, { withFileTypes: true }).filter((d) => d.isDirectory());
      for (const d of dirs) {
        const slug = d.name;
        const p = path.join(rootDir, slug, "trades.json");
        let owner = slug.includes("@") ? normalizeEmail(slug) : "";
        let count = 0;
        let updatedAt = null;
        if (fs.existsSync(p)) {
          try {
            const raw = JSON.parse(fs.readFileSync(p, "utf8"));
            owner = normalizeEmail(raw.owner || owner);
            count = Array.isArray(raw.trades) ? raw.trades.length : 0;
            updatedAt = raw.updatedAt || null;
          } catch (_) {}
        }
        if (!owner) continue;
        students.push({
          email: owner,
          emailSlug: slug,
          tradeCount: count,
          updatedAt,
        });
      }
    } catch (_) {}
    students.sort((a, b) => String(a.email).localeCompare(String(b.email)));
    res.json({ ok: true, students, count: students.length });
  });

  router.get("/api/journal-trades", requireAuth, (req, res) => {
    const ctx = resolveOwner(req, res);
    if (!ctx) return;
    const store = readStore(ctx.owner);
    const trades = store.trades
      .slice()
      .sort((a, b) =>
        String(b.openedAt || b.updatedAt || "").localeCompare(String(a.openedAt || a.updatedAt || ""))
      );
    res.json({
      ok: true,
      owner: ctx.owner,
      viewingOther: ctx.viewingOther,
      isAdmin: ctx.isAdmin,
      trades: trades.map(summaryOf),
      count: trades.length,
    });
  });

  router.get("/api/journal-trades/:id", requireAuth, (req, res) => {
    const ctx = resolveOwner(req, res);
    if (!ctx) return;
    const id = clip(req.params.id, 40);
    const store = readStore(ctx.owner);
    const trade = store.trades.find((t) => t.id === id);
    if (!trade) return res.status(404).json({ error: "Trade introuvable" });
    res.json({
      ok: true,
      owner: ctx.owner,
      viewingOther: ctx.viewingOther,
      isAdmin: ctx.isAdmin,
      trade,
    });
  });

  router.post("/api/journal-trades", requireAuth, (req, res) => {
    const ctx = resolveOwner(req, res);
    if (!ctx) return;
    const store = readStore(ctx.owner);
    if (store.trades.length >= MAX_TRADES) {
      return res.status(400).json({ error: "Limite de trades atteinte" });
    }
    const trade = sanitizeTrade(req.body || {}, null);
    store.trades.unshift(trade);
    writeStore(ctx.owner, store);
    res.status(201).json({ ok: true, owner: ctx.owner, trade });
  });

  router.put("/api/journal-trades/:id", requireAuth, (req, res) => {
    const ctx = resolveOwner(req, res);
    if (!ctx) return;
    const id = clip(req.params.id, 40);
    const store = readStore(ctx.owner);
    const idx = store.trades.findIndex((t) => t.id === id);
    if (idx < 0) return res.status(404).json({ error: "Trade introuvable" });
    const trade = sanitizeTrade({ ...(req.body || {}), id }, store.trades[idx]);
    store.trades[idx] = trade;
    writeStore(ctx.owner, store);
    res.json({ ok: true, owner: ctx.owner, trade });
  });

  router.delete("/api/journal-trades/:id", requireAuth, (req, res) => {
    const ctx = resolveOwner(req, res);
    if (!ctx) return;
    const id = clip(req.params.id, 40);
    const store = readStore(ctx.owner);
    const prev = store.trades.find((t) => t.id === id);
    if (!prev) return res.status(404).json({ error: "Trade introuvable" });
    store.trades = store.trades.filter((t) => t.id !== id);
    writeStore(ctx.owner, store);
    try {
      const mediaDir = path.join(userDir(ctx.owner), "media", id);
      if (fs.existsSync(mediaDir)) {
        for (const f of fs.readdirSync(mediaDir)) {
          fs.unlinkSync(path.join(mediaDir, f));
        }
        fs.rmdirSync(mediaDir);
      }
    } catch (_) {}
    res.json({ ok: true, deleted: id, owner: ctx.owner });
  });

  // 1 ou plusieurs screens (dataUrl ou dataUrls[])
  router.post("/api/journal-trades/:id/images", requireAuth, (req, res) => {
    const ctx = resolveOwner(req, res);
    if (!ctx) return;
    const id = clip(req.params.id, 40);
    const store = readStore(ctx.owner);
    const idx = store.trades.findIndex((t) => t.id === id);
    if (idx < 0) return res.status(404).json({ error: "Trade introuvable" });

    const rawList = Array.isArray(req.body?.dataUrls)
      ? req.body.dataUrls
      : req.body?.dataUrl
        ? [req.body.dataUrl]
        : [];
    if (!rawList.length) {
      return res.status(400).json({ error: "Aucune image (dataUrl / dataUrls)" });
    }

    const trade = store.trades[idx];
    const images = sanitizeImages(trade.images || []);
    const added = [];
    const mediaDir = path.join(userDir(ctx.owner), "media", id);
    fs.mkdirSync(mediaDir, { recursive: true });
    const defaultCaption = clip(req.body?.caption, 300);
    const captions = Array.isArray(req.body?.captions) ? req.body.captions : [];

    for (let i = 0; i < rawList.length && images.length < MAX_IMAGES_PER_TRADE; i++) {
      const decoded = decodeDataUrl(rawList[i]);
      if (decoded.error) {
        return res.status(decoded.status || 400).json({ error: decoded.error });
      }
      const imgId = newId("img_");
      const fileName = imgId + decoded.ext;
      fs.writeFileSync(path.join(mediaDir, fileName), decoded.buf);
      const img = {
        id: imgId,
        file: fileName,
        caption: clip(captions[i] != null ? captions[i] : defaultCaption, 300),
        createdAt: new Date().toISOString(),
      };
      images.push(img);
      added.push(img);
    }

    trade.images = images.slice(0, MAX_IMAGES_PER_TRADE);
    trade.updatedAt = new Date().toISOString();
    store.trades[idx] = trade;
    writeStore(ctx.owner, store);
    res.status(201).json({ ok: true, owner: ctx.owner, trade, added, count: added.length });
  });

  router.patch("/api/journal-trades/:id/images/:imageId", requireAuth, (req, res) => {
    const ctx = resolveOwner(req, res);
    if (!ctx) return;
    const id = clip(req.params.id, 40);
    const imageId = clip(req.params.imageId, 40);
    const store = readStore(ctx.owner);
    const idx = store.trades.findIndex((t) => t.id === id);
    if (idx < 0) return res.status(404).json({ error: "Trade introuvable" });
    const trade = store.trades[idx];
    const images = sanitizeImages(trade.images || []);
    const img = images.find((x) => x.id === imageId);
    if (!img) return res.status(404).json({ error: "Image introuvable" });
    if (req.body && Object.prototype.hasOwnProperty.call(req.body, "caption")) {
      img.caption = clip(req.body.caption, 300);
    }
    trade.images = images;
    trade.updatedAt = new Date().toISOString();
    store.trades[idx] = trade;
    writeStore(ctx.owner, store);
    res.json({ ok: true, owner: ctx.owner, trade, image: img });
  });

  router.delete("/api/journal-trades/:id/images/:imageId", requireAuth, (req, res) => {
    const ctx = resolveOwner(req, res);
    if (!ctx) return;
    const id = clip(req.params.id, 40);
    const imageId = clip(req.params.imageId, 40);
    const store = readStore(ctx.owner);
    const idx = store.trades.findIndex((t) => t.id === id);
    if (idx < 0) return res.status(404).json({ error: "Trade introuvable" });
    const trade = store.trades[idx];
    const images = sanitizeImages(trade.images || []);
    const victim = images.find((img) => img.id === imageId);
    trade.images = images.filter((img) => img.id !== imageId);
    trade.updatedAt = new Date().toISOString();
    store.trades[idx] = trade;
    writeStore(ctx.owner, store);
    if (victim && victim.file) {
      try {
        fs.unlinkSync(path.join(userDir(ctx.owner), "media", id, victim.file));
      } catch (_) {}
    }
    res.json({ ok: true, owner: ctx.owner, trade });
  });

  router.get("/api/journal-trades/:id/media/:fileName", requireAuth, (req, res) => {
    const ctx = resolveOwner(req, res);
    if (!ctx) return;
    const id = clip(req.params.id, 40);
    const fileName = path.basename(String(req.params.fileName || ""));
    if (!fileName || fileName.includes("..")) {
      return res.status(400).json({ error: "Fichier invalide" });
    }
    const store = readStore(ctx.owner);
    const trade = store.trades.find((t) => t.id === id);
    if (!trade) return res.status(404).json({ error: "Trade introuvable" });
    const ok = (trade.images || []).some((img) => img.file === fileName);
    if (!ok) return res.status(404).json({ error: "Image introuvable" });
    const filePath = path.join(userDir(ctx.owner), "media", id, fileName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Fichier manquant" });
    res.sendFile(filePath);
  });

  return router;
};
