/**
 * Analyses & scénarios swing — La Forge.
 *
 * Admin (FORGE_ADMIN_EMAILS) : CRUD, images (screens), publish.
 * Élève Premium : lit les analyses publiées + export PDF (print).
 *
 *   const createSwingAnalysesRouter = require("./server-patches/routes-swing-analyses");
 *   app.use(createSwingAnalysesRouter({ dataDir, requireAuth }));
 */
"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const BIASES = ["bullish", "bearish", "neutral", "range"];
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const ALLOWED_MIME = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

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

function emptyBody() {
  return {
    title: "",
    pair: "XAUUSD",
    timeframe: "H4",
    bias: "neutral",
    horizon: "swing",
    thesis: "",
    context: "",
    structure: "",
    invalidation: "",
    entryZone: "",
    targets: ["", "", ""],
    projections: "",
    scenarioBase: "",
    scenarioBull: "",
    scenarioBear: "",
    checklist: ["", "", ""],
    notes: "",
    images: [],
  };
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

function sanitizeBody(input) {
  const src = input && typeof input === "object" ? input : {};
  const bias = String(src.bias || "neutral").toLowerCase();
  return {
    title: clip(src.title, 200),
    pair: clip(src.pair, 40).toUpperCase() || "XAUUSD",
    timeframe: clip(src.timeframe, 20) || "H4",
    bias: BIASES.includes(bias) ? bias : "neutral",
    horizon: clip(src.horizon, 40) || "swing",
    thesis: clip(src.thesis, 12000),
    context: clip(src.context, 8000),
    structure: clip(src.structure, 8000),
    invalidation: clip(src.invalidation, 2000),
    entryZone: clip(src.entryZone, 2000),
    targets: Array.isArray(src.targets)
      ? src.targets.map((t) => clip(t, 400)).filter(Boolean).slice(0, 8)
      : [],
    projections: clip(src.projections, 8000),
    scenarioBase: clip(src.scenarioBase, 6000),
    scenarioBull: clip(src.scenarioBull, 6000),
    scenarioBear: clip(src.scenarioBear, 6000),
    checklist: Array.isArray(src.checklist)
      ? src.checklist.map((t) => clip(t, 400)).filter(Boolean).slice(0, 12)
      : [],
    notes: clip(src.notes, 4000),
    images: sanitizeImages(src.images),
  };
}

function listView(a, { admin }) {
  return {
    id: a.id,
    title: a.title,
    pair: a.pair,
    timeframe: a.timeframe,
    bias: a.bias,
    horizon: a.horizon,
    published: Boolean(a.published),
    publishedAt: a.publishedAt || null,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    cover: a.images && a.images[0] ? a.images[0] : null,
    imageCount: Array.isArray(a.images) ? a.images.length : 0,
    createdBy: admin ? a.createdBy : undefined,
  };
}

function fullView(a, { admin }) {
  const base = {
    ...listView(a, { admin }),
    thesis: a.thesis,
    context: a.context,
    structure: a.structure,
    invalidation: a.invalidation,
    entryZone: a.entryZone,
    targets: a.targets || [],
    projections: a.projections,
    scenarioBase: a.scenarioBase,
    scenarioBull: a.scenarioBull,
    scenarioBear: a.scenarioBear,
    checklist: a.checklist || [],
    images: a.images || [],
  };
  if (admin) base.notes = a.notes || "";
  return base;
}

module.exports = function createSwingAnalysesRouter({ dataDir, requireAuth }) {
  if (typeof requireAuth !== "function") {
    throw new Error("createSwingAnalysesRouter: requireAuth requis");
  }

  const dir = path.join(dataDir, "swing-analyses");
  const mediaDir = path.join(dir, "media");
  const storePath = path.join(dir, "index.json");
  fs.mkdirSync(mediaDir, { recursive: true });

  function readStore() {
    try {
      if (!fs.existsSync(storePath)) return [];
      const raw = JSON.parse(fs.readFileSync(storePath, "utf8"));
      return Array.isArray(raw) ? raw : Array.isArray(raw.analyses) ? raw.analyses : [];
    } catch (_) {
      return [];
    }
  }

  function writeStore(list) {
    const tmp = storePath + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(list, null, 2), "utf8");
    fs.renameSync(tmp, storePath);
  }

  const router = express.Router();

  router.get("/api/swing-analyses", requireAuth, (req, res) => {
    const email = sessionEmail(req);
    const admin = isAdminEmail(email);
    if (!admin && !isSubscribed(req)) {
      return res.status(403).json({ error: "Premium requis" });
    }
    let all = readStore();
    if (!admin) all = all.filter((a) => a.published === true);
    all = all
      .slice()
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    return res.json({ isAdmin: admin, analyses: all.map((a) => listView(a, { admin })) });
  });

  router.get("/api/swing-analyses/:id", requireAuth, (req, res) => {
    const email = sessionEmail(req);
    const admin = isAdminEmail(email);
    if (!admin && !isSubscribed(req)) {
      return res.status(403).json({ error: "Premium requis" });
    }
    const a = readStore().find((x) => x.id === req.params.id);
    if (!a) return res.status(404).json({ error: "Introuvable" });
    if (!admin && !a.published) return res.status(403).json({ error: "Non publié" });
    return res.json({ isAdmin: admin, analysis: fullView(a, { admin }) });
  });

  router.post("/api/swing-analyses", requireAuth, (req, res) => {
    const email = sessionEmail(req);
    if (!isAdminEmail(email)) return res.status(403).json({ error: "Admin uniquement" });
    const body = sanitizeBody(req.body || {});
    if (!body.title) return res.status(400).json({ error: "Titre requis" });
    const now = new Date().toISOString();
    const analysis = {
      id: newId("sw_"),
      published: false,
      publishedAt: null,
      createdAt: now,
      updatedAt: now,
      createdBy: email,
      ...body,
      images: [],
    };
    const all = readStore();
    all.push(analysis);
    writeStore(all);
    return res.status(201).json({ analysis: fullView(analysis, { admin: true }) });
  });

  router.put("/api/swing-analyses/:id", requireAuth, (req, res) => {
    const email = sessionEmail(req);
    if (!isAdminEmail(email)) return res.status(403).json({ error: "Admin uniquement" });
    const all = readStore();
    const idx = all.findIndex((x) => x.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: "Introuvable" });
    const prev = all[idx];
    const body = sanitizeBody({ ...prev, ...(req.body || {}), images: prev.images });
    const next = {
      ...prev,
      ...body,
      id: prev.id,
      images: prev.images || [],
      createdAt: prev.createdAt,
      createdBy: prev.createdBy,
      published: typeof req.body?.published === "boolean" ? req.body.published : prev.published,
      publishedAt:
        typeof req.body?.published === "boolean"
          ? req.body.published
            ? prev.publishedAt || new Date().toISOString()
            : null
          : prev.publishedAt,
      updatedAt: new Date().toISOString(),
      updatedBy: email,
    };
    all[idx] = next;
    writeStore(all);
    return res.json({ analysis: fullView(next, { admin: true }) });
  });

  async function notifySwingPublished(analysis) {
    const notifyUrl =
      process.env.FORGE_SWING_NOTIFY_URL ||
      "https://radar.torinvest-trading.com/api/swing-analysis-notify.php";
    const secret = String(
      process.env.FORGE_FORMATION_PROVISION_SECRET ||
        process.env.FORMATION_PROVISION_SECRET ||
        ""
    ).trim();
    if (!secret) {
      return { ok: false, error: "FORGE_FORMATION_PROVISION_SECRET manquant" };
    }
    const biasMap = {
      bullish: "Haussier",
      bearish: "Baissier",
      range: "Range",
      neutral: "Neutre",
    };
    const payload = {
      title: analysis.title || "Analyse swing",
      pair: analysis.pair || "XAUUSD",
      timeframe: analysis.timeframe || "",
      bias: biasMap[analysis.bias] || analysis.bias || "",
      thesis: String(analysis.thesis || "").slice(0, 400),
      url: "https://app.torinvest-trading.com/swing-analyses.html",
    };
    try {
      const res = await fetch(notifyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Formation-Provision-Key": secret,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(25000),
      });
      const json = await res.json().catch(() => ({}));
      return {
        ok: res.ok && json && json.ok === true,
        status: res.status,
        ...(json && typeof json === "object" ? json : {}),
      };
    } catch (err) {
      return {
        ok: false,
        error: String(err && err.message ? err.message : err),
      };
    }
  }

  router.post("/api/swing-analyses/:id/publish", requireAuth, async (req, res) => {
    const email = sessionEmail(req);
    if (!isAdminEmail(email)) return res.status(403).json({ error: "Admin uniquement" });
    const all = readStore();
    const idx = all.findIndex((x) => x.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: "Introuvable" });
    const enable = req.body && req.body.enable === false ? false : true;
    const wantNotify = Boolean(req.body && (req.body.notify === true || req.body.notify === 1));
    const a = { ...all[idx] };
    a.published = enable;
    a.publishedAt = enable ? a.publishedAt || new Date().toISOString() : null;
    a.updatedAt = new Date().toISOString();
    a.updatedBy = email;
    all[idx] = a;
    writeStore(all);

    let notify = null;
    if (enable && wantNotify) {
      notify = await notifySwingPublished(a);
      if (notify && notify.ok) {
        a.notifiedAt = new Date().toISOString();
        all[idx] = a;
        writeStore(all);
      } else {
        console.error("[swing-analyses] notify failed", notify);
      }
    }

    return res.json({
      analysis: fullView(a, { admin: true }),
      notify,
    });
  });

  router.post("/api/swing-analyses/:id/images", requireAuth, (req, res) => {
    const email = sessionEmail(req);
    if (!isAdminEmail(email)) return res.status(403).json({ error: "Admin uniquement" });
    const all = readStore();
    const idx = all.findIndex((x) => x.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: "Introuvable" });

    const dataUrl = String(req.body?.dataUrl || "");
    const m = dataUrl.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/);
    if (!m) return res.status(400).json({ error: "Image invalide (jpeg/png/webp/gif)" });
    const mime = m[1];
    const ext = ALLOWED_MIME[mime];
    if (!ext) return res.status(400).json({ error: "Type image non supporté" });
    let buf;
    try {
      buf = Buffer.from(m[2].replace(/\s+/g, ""), "base64");
    } catch (_) {
      return res.status(400).json({ error: "Décodage image échoué" });
    }
    if (!buf.length || buf.length > MAX_IMAGE_BYTES) {
      return res.status(400).json({ error: "Image trop lourde (max 6 Mo)" });
    }

    const imgId = newId("img_");
    const fileName = imgId + ext;
    const analysisDir = path.join(mediaDir, req.params.id);
    fs.mkdirSync(analysisDir, { recursive: true });
    fs.writeFileSync(path.join(analysisDir, fileName), buf);

    const img = {
      id: imgId,
      file: fileName,
      caption: clip(req.body?.caption, 300),
      createdAt: new Date().toISOString(),
    };
    const a = { ...all[idx] };
    a.images = Array.isArray(a.images) ? a.images.slice() : [];
    a.images.push(img);
    a.updatedAt = new Date().toISOString();
    a.updatedBy = email;
    all[idx] = a;
    writeStore(all);
    return res.status(201).json({ image: img, analysis: fullView(a, { admin: true }) });
  });

  router.delete("/api/swing-analyses/:id/images/:imageId", requireAuth, (req, res) => {
    const email = sessionEmail(req);
    if (!isAdminEmail(email)) return res.status(403).json({ error: "Admin uniquement" });
    const all = readStore();
    const idx = all.findIndex((x) => x.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: "Introuvable" });
    const a = { ...all[idx] };
    const images = Array.isArray(a.images) ? a.images : [];
    const img = images.find((i) => i.id === req.params.imageId);
    if (!img) return res.status(404).json({ error: "Image introuvable" });
    a.images = images.filter((i) => i.id !== req.params.imageId);
    a.updatedAt = new Date().toISOString();
    all[idx] = a;
    writeStore(all);
    try {
      fs.unlinkSync(path.join(mediaDir, a.id, img.file));
    } catch (_) {}
    return res.json({ analysis: fullView(a, { admin: true }) });
  });

  router.get("/api/swing-analyses/:id/media/:fileName", requireAuth, (req, res) => {
    const email = sessionEmail(req);
    const admin = isAdminEmail(email);
    if (!admin && !isSubscribed(req)) {
      return res.status(403).json({ error: "Premium requis" });
    }
    const a = readStore().find((x) => x.id === req.params.id);
    if (!a) return res.status(404).json({ error: "Introuvable" });
    if (!admin && !a.published) return res.status(403).json({ error: "Non publié" });
    const fileName = path.basename(String(req.params.fileName || ""));
    if (!fileName || fileName.includes("..")) return res.status(400).json({ error: "Fichier invalide" });
    const has = (a.images || []).some((i) => i.file === fileName);
    if (!has) return res.status(404).json({ error: "Fichier inconnu" });
    const full = path.join(mediaDir, a.id, fileName);
    if (!fs.existsSync(full)) return res.status(404).json({ error: "Fichier manquant" });
    return res.sendFile(full);
  });

  router.delete("/api/swing-analyses/:id", requireAuth, (req, res) => {
    const email = sessionEmail(req);
    if (!isAdminEmail(email)) return res.status(403).json({ error: "Admin uniquement" });
    const all = readStore();
    const prev = all.find((x) => x.id === req.params.id);
    if (!prev) return res.status(404).json({ error: "Introuvable" });
    writeStore(all.filter((x) => x.id !== req.params.id));
    try {
      fs.rmSync(path.join(mediaDir, prev.id), { recursive: true, force: true });
    } catch (_) {}
    return res.json({ ok: true });
  });

  return router;
};
