/**
 * Screenshots de trades (Journal TJ Pro) — Premium.
 * Stockage hors Git, liés à l’email session + clé trade.
 *
 * GET    /api/journal-trade-screens
 * GET    /api/journal-trade-screens/:tradeKey
 * PUT    /api/journal-trade-screens/:tradeKey
 * POST   /api/journal-trade-screens/:tradeKey/images
 * DELETE /api/journal-trade-screens/:tradeKey/images/:imageId
 * POST   /api/journal-trade-screens/:tradeKey/images/:imageId/delete  (fallback)
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
  "image/x-jpeg": ".jpg",
  "image/jfif": ".jpg",
  "image/png": ".png",
  "image/x-png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

function normalizeMime(raw) {
  const m = String(raw || "")
    .toLowerCase()
    .trim()
    .split(";")[0]
    .trim();
  if (m === "image/jpg" || m === "image/pjpeg" || m === "image/x-jpeg" || m === "image/jfif") {
    return "image/jpeg";
  }
  if (m === "image/x-png") return "image/png";
  return m;
}

/** Parse data URL — tolerates charset= / extra params / whitespace in base64. */
function parseImageDataUrl(dataUrl) {
  const raw = String(dataUrl || "").trim();
  if (!raw) return null;
  // data:[mime][;param=…]*;base64,<payload>
  let m = raw.match(/^data:([^;,]+)?((?:;[^,]*)*);base64,([\s\S]+)$/i);
  if (!m) {
    // Rare: data:base64,… or bare base64 payload
    m = raw.match(/^data:;?base64,([\s\S]+)$/i);
    if (m) return { mime: "image/jpeg", b64: String(m[1] || "").replace(/\s+/g, "") };
    if (/^[A-Za-z0-9+/=\s]+$/.test(raw) && raw.replace(/\s+/g, "").length >= 32) {
      return { mime: "image/jpeg", b64: raw.replace(/\s+/g, "") };
    }
    return null;
  }
  let mime = normalizeMime(m[1] || "");
  if (!mime || mime === "application/octet-stream" || mime === "binary/octet-stream") {
    mime = "image/jpeg";
  }
  const b64 = String(m[3] || "").replace(/\s+/g, "");
  if (!b64 || b64.length < 8) return null;
  return { mime, b64 };
}

function sniffImageMime(buf) {
  if (!buf || buf.length < 4) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image/gif";
  if (
    buf.length > 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45
  ) {
    return "image/webp";
  }
  return null;
}

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

function parseAdminEmails() {
  const raw = String(process.env.FORGE_ADMIN_EMAILS || process.env.ADMIN_EMAILS || "").trim();
  if (!raw) return [];
  return raw
    .split(/[,;\s]+/)
    .map(normalizeEmail)
    .filter(Boolean);
}

function isAdminUser(user) {
  if (!user?.email) return false;
  if (user.isAdmin === true || user.role === "admin") return true;
  return parseAdminEmails().includes(normalizeEmail(user.email));
}

function isPremiumUser(user) {
  if (!user?.email) return false;
  if (isAdminUser(user)) return true;
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

/** Entrées sans image (ex. « add_trade add_trade · 0 screen(s) ») — à ne pas lister */
function isEmptyTrade(t) {
  const imgs = t && Array.isArray(t.images) ? t.images : [];
  return imgs.length === 0;
}

function pruneEmptyTrades(email) {
  const idx = readIndex(email);
  let changed = false;
  for (const k of Object.keys(idx.trades || {})) {
    const t = idx.trades[k];
    if (!t || isEmptyTrade(t)) {
      delete idx.trades[k];
      changed = true;
    }
  }
  if (changed) writeIndex(email, idx);
  return idx;
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
    req._jtsAdmin = isAdminUser(user);
    return user;
  }

  function listAllMemberTrades() {
    const root = screensRoot();
    if (!fs.existsSync(root)) return [];
    const out = [];
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const indexFile = path.join(root, entry.name, "index.json");
      if (!fs.existsSync(indexFile)) continue;
      let idx;
      try {
        idx = JSON.parse(fs.readFileSync(indexFile, "utf8"));
      } catch (_) {
        continue;
      }
      const trades = idx && idx.trades && typeof idx.trades === "object" ? idx.trades : {};
      let memberEmail = "";
      for (const t of Object.values(trades)) {
        if (t && t.email) {
          memberEmail = normalizeEmail(t.email);
          break;
        }
      }
      if (!memberEmail) {
        memberEmail = entry.name.includes("@") ? entry.name : entry.name;
      }
      for (const k of Object.keys(trades)) {
        const pub = publicTrade(trades[k]);
        if (!pub.imageCount) continue;
        out.push({
          email: memberEmail,
          ...pub,
          mediaBase:
            "/api/journal-trade-screens/" +
            encodeURIComponent(pub.tradeKey) +
            "/media/",
          mediaQuery: "?member=" + encodeURIComponent(memberEmail),
        });
      }
    }
    out.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    return out;
  }

  router.get("/api/journal-trade-screens/ping", (_req, res) => {
    res.json({
      ok: true,
      ready: true,
      version: 12,
      jpgPng: true,
      mimeLoose: true,
      sniff: true,
      deleteFix: true,
      deletePostFallback: true,
      clickDetailFix: true,
      tradeClickFix2: true,
      tradeClickNuke: true,
      safeMode: true,
      clickRestore: true,
      cspClickFix: true,
      hrefClickFix: true,
      injectHardOff: true,
      injectDisabled: true,
      inject: "off",
      note:
        "screens off + CSP onclick OK + location.href → /journal-embed/ (no 404 trading_journal.php)",
    });
  });

  router.get("/api/journal-trade-screens-admin", async (req, res) => {
    try {
      const user = await requirePremium(req, res);
      if (!user) return;
      if (!req._jtsAdmin) {
        return res.status(403).json({ error: "Accès admin requis" });
      }
      const trades = listAllMemberTrades();
      return res.json({ ok: true, count: trades.length, trades });
    } catch (err) {
      console.error("[journal-trade-screens] admin", err && err.message);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  });

  router.get("/api/journal-trade-screens", async (req, res) => {
    try {
      const user = await requirePremium(req, res);
      if (!user) return;
      const idx = pruneEmptyTrades(user.email);
      const items = Object.keys(idx.trades)
        .map((k) => publicTrade(idx.trades[k]))
        .filter((t) => (t.imageCount || 0) > 0)
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

      // Priorité mime+base64 (évite dataUrl tronqué par proxy / body limit)
      let parsed = null;
      if (req.body?.base64 || req.body?.imageBase64) {
        const mime = normalizeMime(
          req.body.mime || req.body.contentType || req.body.type || "image/jpeg"
        );
        const b64 = String(req.body.base64 || req.body.imageBase64 || "").replace(/\s+/g, "");
        if (b64.length >= 8) parsed = { mime, b64 };
      }
      if (!parsed) {
        const dataUrl = String(req.body?.dataUrl || req.body?.data_url || "");
        parsed = parseImageDataUrl(dataUrl);
      }
      if (!parsed) return res.status(400).json({ error: "Image invalide (JPG ou PNG)" });

      let buf;
      try {
        buf = Buffer.from(parsed.b64, "base64");
      } catch (_) {
        return res.status(400).json({ error: "Décodage échoué" });
      }
      if (!buf.length || buf.length > MAX_IMAGE_BYTES) {
        return res.status(400).json({ error: "Image trop lourde (max 6 Mo)" });
      }

      // Magic bytes win over declared MIME (image/jpg, empty type, octet-stream, etc.)
      const sniffed = sniffImageMime(buf);
      let mime = sniffed || normalizeMime(parsed.mime);
      if (!sniffed) {
        // Last resort: declared jpeg/png family even if magic soft-fail (truncated prefix)
        if (mime !== "image/jpeg" && mime !== "image/png" && mime !== "image/webp" && mime !== "image/gif") {
          return res.status(400).json({ error: "Image invalide (JPG ou PNG)" });
        }
      }
      mime = normalizeMime(mime);
      const ext = ALLOWED_MIME[mime] || ALLOWED_MIME[normalizeMime(mime)];
      if (!ext) return res.status(400).json({ error: "Type non supporté (JPG ou PNG)" });
      const finalExt =
        mime === "image/png" ? ".png" : mime === "image/gif" ? ".gif" : mime === "image/webp" ? ".webp" : ".jpg";

      const idx = readIndex(user.email);
      const prev = idx.trades[tradeKey] || emptyTrade(tradeKey);
      prev.images = Array.isArray(prev.images) ? prev.images : [];
      if (prev.images.length >= 24) {
        return res.status(400).json({ error: "Maximum 24 screens par trade" });
      }

      const imgId = newId("jts_");
      const fileName = imgId + finalExt;
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

  async function deleteTradeImage(req, res) {
    try {
      const user = await requirePremium(req, res);
      if (!user) return;
      const tradeKey = safeTradeKey(req.params.tradeKey);
      if (!tradeKey) return res.status(400).json({ error: "tradeKey invalide" });
      const imageIdRaw = String(req.params.imageId || "").trim();
      let imageId = imageIdRaw;
      try {
        imageId = decodeURIComponent(imageIdRaw);
      } catch (_) {
        imageId = imageIdRaw;
      }
      if (!imageId) return res.status(400).json({ error: "imageId invalide" });
      const idx = readIndex(user.email);
      const prev = idx.trades[tradeKey];
      if (!prev) return res.status(404).json({ error: "Trade introuvable" });
      const imgs = prev.images || [];
      const img = imgs.find(
        (i) =>
          i &&
          (i.id === imageId ||
            i.file === imageId ||
            String(i.id || "") === imageIdRaw ||
            String(i.file || "") === imageIdRaw ||
            String(i.file || "").startsWith(imageId) ||
            String(i.file || "").replace(/\.[^.]+$/, "") === imageId)
      );
      if (!img) {
        console.warn(
          "[journal-trade-screens] delete miss",
          tradeKey,
          imageId,
          "have=",
          imgs.map((i) => i && i.id)
        );
        return res.status(404).json({
          error: "Image introuvable",
          imageId,
          knownIds: imgs.map((i) => (i && i.id) || null).filter(Boolean),
        });
      }
      prev.images = (prev.images || []).filter((i) => i && i.id !== img.id);
      prev.updatedAt = new Date().toISOString();
      idx.trades[tradeKey] = prev;
      writeIndex(user.email, idx);
      try {
        fs.unlinkSync(path.join(userDir(user.email), "media", tradeKey, img.file));
      } catch (_) {}
      return res.json({ ok: true, deleted: img.id, trade: publicTrade(prev) });
    } catch (err) {
      console.error("[journal-trade-screens] delete", err && err.message);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  }

  router.delete("/api/journal-trade-screens/:tradeKey/images/:imageId", deleteTradeImage);
  // Fallback si DELETE bloqué (proxy / CDN)
  router.post("/api/journal-trade-screens/:tradeKey/images/:imageId/delete", deleteTradeImage);

  router.get("/api/journal-trade-screens/:tradeKey/media/:fileName", async (req, res) => {
    try {
      const user = await requirePremium(req, res);
      if (!user) return;
      const tradeKey = safeTradeKey(req.params.tradeKey);
      const fileName = path.basename(String(req.params.fileName || ""));
      if (!tradeKey || !fileName || fileName.includes("..")) {
        return res.status(400).json({ error: "Requête invalide" });
      }
      let ownerEmail = normalizeEmail(user.email);
      const memberQ = normalizeEmail(req.query.member || req.query.email || "");
      if (memberQ && memberQ !== ownerEmail) {
        if (!req._jtsAdmin) {
          return res.status(403).json({ error: "Accès admin requis" });
        }
        ownerEmail = memberQ;
      }
      const idx = readIndex(ownerEmail);
      const t = idx.trades[tradeKey];
      if (!t || !(t.images || []).some((i) => i.file === fileName)) {
        return res.status(404).json({ error: "Fichier inconnu" });
      }
      const full = path.join(userDir(ownerEmail), "media", tradeKey, fileName);
      if (!fs.existsSync(full)) return res.status(404).json({ error: "Manquant" });
      return res.sendFile(full);
    } catch (err) {
      console.error("[journal-trade-screens] media", err && err.message);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  });

  return router;
};
