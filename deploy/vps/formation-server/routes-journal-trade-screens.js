/**
 * Screenshots de trades (Journal TJ Pro) — Premium.
 * Stockage hors Git, liés à l’email session + clé trade.
 *
 * GET    /api/journal-trade-screens
 * GET    /api/journal-trade-screens/:tradeKey
 * PUT    /api/journal-trade-screens/:tradeKey
 * POST   /api/journal-trade-screens/:tradeKey/images
 * DELETE /api/journal-trade-screens/:tradeKey/images/:imageId
 * GET    /api/journal-trade-screens/:tradeKey/media/:fileName
 */
"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const ALLOWED_MIME = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/pjpeg": ".jpg",
  "image/png": ".png",
  "image/x-png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

function screensRoot() {
  const fromEnv = String(process.env.JOURNAL_TRADE_SCREENS_DIR || "").trim();
  if (fromEnv) return fromEnv;
  return "/var/lib/torinvest/journal-trade-screens";
}

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function isPremiumUser(user) {
  if (!user?.email) return false;
  if (user.subscribed === true || user.subscribed === 1 || user.subscribed === "true") {
    return true;
  }
  const plan = String(user.plan || "").toLowerCase();
  return plan === "premium" || plan === "subscribed";
}

function loggedInUser(req) {
  const s = req.session;
  if (!s) return null;
  const user = s.user || req.user;
  const email = String(user?.email || s.email || "").trim();
  if (!email) return null;
  return {
    email,
    subscribed: user?.subscribed ?? s.subscribed,
    plan: user?.plan ?? s.plan,
    name: user?.name,
  };
}

async function meFromCookie(req) {
  const cookie = String(req.headers.cookie || "");
  if (!cookie) return null;
  const port = Number(process.env.PORT || 3001);
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/me`, {
      headers: { cookie, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    const data = await r.json().catch(() => ({}));
    const me = data.user && typeof data.user === "object" ? data.user : data;
    if (!me?.email) return null;
    return me;
  } catch (_) {
    return null;
  }
}

async function resolveUser(req) {
  return loggedInUser(req) || (await meFromCookie(req));
}

function emailSlug(email) {
  return normalizeEmail(email).replace(/[^a-z0-9@._+-]/g, "_");
}

function safeTradeKey(key) {
  const k = String(key || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._+-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  if (!k || k === "." || k === "..") return null;
  return k;
}

function clip(s, max) {
  return String(s || "").trim().slice(0, max);
}

function newId(prefix) {
  return prefix + crypto.randomBytes(8).toString("hex");
}

function userDir(email) {
  const dir = path.join(screensRoot(), emailSlug(email));
  fs.mkdirSync(path.join(dir, "media"), { recursive: true });
  return dir;
}

function indexPath(email) {
  return path.join(userDir(email), "index.json");
}

function readIndex(email) {
  try {
    const p = indexPath(email);
    if (!fs.existsSync(p)) return { version: 1, trades: {} };
    const raw = JSON.parse(fs.readFileSync(p, "utf8"));
    if (!raw || typeof raw !== "object") return { version: 1, trades: {} };
    if (!raw.trades || typeof raw.trades !== "object") raw.trades = {};
    raw.version = 1;
    return raw;
  } catch (_) {
    return { version: 1, trades: {} };
  }
}

function writeIndex(email, data) {
  const p = indexPath(email);
  const tmp = p + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, p);
}

function emptyTrade(tradeKey) {
  return {
    tradeKey,
    label: "",
    pair: "",
    direction: "",
    tradeDate: "",
    notes: "",
    images: [],
    createdAt: null,
    updatedAt: null,
  };
}

function publicTrade(t) {
  return {
    tradeKey: t.tradeKey,
    label: t.label || "",
    pair: t.pair || "",
    direction: t.direction || "",
    tradeDate: t.tradeDate || "",
    notes: t.notes || "",
    images: Array.isArray(t.images) ? t.images : [],
    imageCount: Array.isArray(t.images) ? t.images.length : 0,
    createdAt: t.createdAt || null,
    updatedAt: t.updatedAt || null,
  };
}

module.exports = function createJournalTradeScreensRouter() {
  const router = express.Router();
  fs.mkdirSync(screensRoot(), { recursive: true });

  async function requirePremium(req, res) {
    const user = await resolveUser(req);
    if (!user?.email) {
      res.status(401).json({ error: "Non authentifié" });
      return null;
    }
    if (!isPremiumUser(user)) {
      res.status(403).json({ error: "Réservé aux abonnés Premium" });
      return null;
    }
    req.user = user;
    return user;
  }

  router.get("/api/journal-trade-screens/ping", (_req, res) => {
    res.json({ ok: true, ready: true, version: 1 });
  });

  router.get("/api/journal-trade-screens", async (req, res) => {
    try {
      const user = await requirePremium(req, res);
      if (!user) return;
      const idx = readIndex(user.email);
      const items = Object.keys(idx.trades)
        .map((k) => publicTrade(idx.trades[k]))
        .filter((t) => t.imageCount > 0 || t.label || t.pair)
        .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
      return res.json({ ok: true, count: items.length, trades: items });
    } catch (err) {
      console.error("[journal-trade-screens] list", err && err.message);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  });

  router.get("/api/journal-trade-screens/:tradeKey", async (req, res) => {
    try {
      const user = await requirePremium(req, res);
      if (!user) return;
      const tradeKey = safeTradeKey(req.params.tradeKey);
      if (!tradeKey) return res.status(400).json({ error: "tradeKey invalide" });
      const idx = readIndex(user.email);
      const t = idx.trades[tradeKey] || emptyTrade(tradeKey);
      return res.json({ ok: true, trade: publicTrade({ ...t, tradeKey }) });
    } catch (err) {
      console.error("[journal-trade-screens] get", err && err.message);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  });

  router.put("/api/journal-trade-screens/:tradeKey", async (req, res) => {
    try {
      const user = await requirePremium(req, res);
      if (!user) return;
      const tradeKey = safeTradeKey(req.params.tradeKey);
      if (!tradeKey) return res.status(400).json({ error: "tradeKey invalide" });
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const idx = readIndex(user.email);
      const prev = idx.trades[tradeKey] || emptyTrade(tradeKey);
      const now = new Date().toISOString();
      const next = {
        ...prev,
        tradeKey,
        label: body.label != null ? clip(body.label, 200) : prev.label,
        pair: body.pair != null ? clip(body.pair, 40) : prev.pair,
        direction: body.direction != null ? clip(body.direction, 20) : prev.direction,
        tradeDate: body.tradeDate != null ? clip(body.tradeDate, 40) : prev.tradeDate,
        notes: body.notes != null ? clip(body.notes, 2000) : prev.notes,
        images: Array.isArray(prev.images) ? prev.images : [],
        createdAt: prev.createdAt || now,
        updatedAt: now,
        email: normalizeEmail(user.email),
      };
      idx.trades[tradeKey] = next;
      writeIndex(user.email, idx);
      return res.json({ ok: true, trade: publicTrade(next) });
    } catch (err) {
      console.error("[journal-trade-screens] put", err && err.message);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  });

  router.post("/api/journal-trade-screens/:tradeKey/images", async (req, res) => {
    try {
      const user = await requirePremium(req, res);
      if (!user) return;
      const tradeKey = safeTradeKey(req.params.tradeKey);
      if (!tradeKey) return res.status(400).json({ error: "tradeKey invalide" });

      const dataUrl = String(req.body?.dataUrl || "");
      const m = dataUrl.match(
        /^data:(image\/(?:jpeg|jpg|pjpeg|png|x-png|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/i
      );
      if (!m) return res.status(400).json({ error: "Image invalide (JPG ou PNG)" });
      const mime = String(m[1] || "").toLowerCase();
      const ext = ALLOWED_MIME[mime];
      if (!ext) return res.status(400).json({ error: "Type non supporté (JPG ou PNG)" });
      let buf;
      try {
        buf = Buffer.from(String(m[2]).replace(/\s+/g, ""), "base64");
      } catch (_) {
        return res.status(400).json({ error: "Décodage échoué" });
      }
      if (!buf.length || buf.length > MAX_IMAGE_BYTES) {
        return res.status(400).json({ error: "Image trop lourde (max 6 Mo)" });
      }

      const idx = readIndex(user.email);
      const prev = idx.trades[tradeKey] || emptyTrade(tradeKey);
      prev.images = Array.isArray(prev.images) ? prev.images : [];
      if (prev.images.length >= 24) {
        return res.status(400).json({ error: "Maximum 24 screens par trade" });
      }

      const imgId = newId("jts_");
      const fileName = imgId + ext;
      const mediaDir = path.join(userDir(user.email), "media", tradeKey);
      fs.mkdirSync(mediaDir, { recursive: true });
      fs.writeFileSync(path.join(mediaDir, fileName), buf);

      const img = {
        id: imgId,
        file: fileName,
        caption: clip(req.body?.caption, 300),
        createdAt: new Date().toISOString(),
      };
      prev.images.push(img);
      const now = new Date().toISOString();
      prev.tradeKey = tradeKey;
      prev.email = normalizeEmail(user.email);
      prev.createdAt = prev.createdAt || now;
      prev.updatedAt = now;
      if (req.body?.label) prev.label = clip(req.body.label, 200);
      if (req.body?.pair) prev.pair = clip(req.body.pair, 40);
      if (req.body?.direction) prev.direction = clip(req.body.direction, 20);
      if (req.body?.tradeDate) prev.tradeDate = clip(req.body.tradeDate, 40);

      idx.trades[tradeKey] = prev;
      writeIndex(user.email, idx);
      return res.status(201).json({ ok: true, image: img, trade: publicTrade(prev) });
    } catch (err) {
      console.error("[journal-trade-screens] upload", err && err.message);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  });

  router.delete("/api/journal-trade-screens/:tradeKey/images/:imageId", async (req, res) => {
    try {
      const user = await requirePremium(req, res);
      if (!user) return;
      const tradeKey = safeTradeKey(req.params.tradeKey);
      if (!tradeKey) return res.status(400).json({ error: "tradeKey invalide" });
      const idx = readIndex(user.email);
      const prev = idx.trades[tradeKey];
      if (!prev) return res.status(404).json({ error: "Trade introuvable" });
      const img = (prev.images || []).find((i) => i.id === req.params.imageId);
      if (!img) return res.status(404).json({ error: "Image introuvable" });
      prev.images = prev.images.filter((i) => i.id !== req.params.imageId);
      prev.updatedAt = new Date().toISOString();
      idx.trades[tradeKey] = prev;
      writeIndex(user.email, idx);
      try {
        fs.unlinkSync(path.join(userDir(user.email), "media", tradeKey, img.file));
      } catch (_) {}
      return res.json({ ok: true, trade: publicTrade(prev) });
    } catch (err) {
      console.error("[journal-trade-screens] delete", err && err.message);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  });

  router.get("/api/journal-trade-screens/:tradeKey/media/:fileName", async (req, res) => {
    try {
      const user = await requirePremium(req, res);
      if (!user) return;
      const tradeKey = safeTradeKey(req.params.tradeKey);
      const fileName = path.basename(String(req.params.fileName || ""));
      if (!tradeKey || !fileName || fileName.includes("..")) {
        return res.status(400).json({ error: "Requête invalide" });
      }
      const idx = readIndex(user.email);
      const t = idx.trades[tradeKey];
      if (!t || !(t.images || []).some((i) => i.file === fileName)) {
        return res.status(404).json({ error: "Fichier inconnu" });
      }
      const full = path.join(userDir(user.email), "media", tradeKey, fileName);
      if (!fs.existsSync(full)) return res.status(404).json({ error: "Manquant" });
      return res.sendFile(full);
    } catch (err) {
      console.error("[journal-trade-screens] media", err && err.message);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  });

  return router;
};
