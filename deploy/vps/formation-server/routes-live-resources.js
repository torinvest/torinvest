/**
 * PDF / slides téléchargeables après lives & modules (Premium).
 * Index JSON + fichiers hors Git (comme /books).
 *
 * GET  /api/live-resources/ping
 * GET  /api/live-resources
 * GET  /api/live-resources/:id
 * GET  /api/live-resources/:id/file/:fileName
 * POST /api/live-resources          (admin)
 * PATCH /api/live-resources/:id     (admin)
 * DELETE /api/live-resources/:id    (admin)
 *
 * Env:
 *   LIVE_RESOURCES_DIR   défaut /var/lib/torinvest/live-resources
 *   LIVE_RESOURCES_INDEX défaut <dir>/index.json
 *   FORGE_ADMIN_EMAILS
 */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");

const DEFAULT_DIR = "/var/lib/torinvest/live-resources";

function resourcesDir() {
  const fromEnv = String(process.env.LIVE_RESOURCES_DIR || "").trim();
  return fromEnv || DEFAULT_DIR;
}

function indexPath() {
  const fromEnv = String(process.env.LIVE_RESOURCES_INDEX || "").trim();
  return fromEnv || path.join(resourcesDir(), "index.json");
}

function ensureDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (_) {
    /* ignore */
  }
}

function readJsonSafe(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch (_) {
    return fallback;
  }
}

function writeJsonAtomic(filePath, data) {
  ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, filePath);
}

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function parseAdminEmails() {
  return String(process.env.FORGE_ADMIN_EMAILS || process.env.ADMIN_EMAILS || "")
    .split(/[,;\s]+/)
    .map(normalizeEmail)
    .filter(Boolean);
}

function isPremiumUser(user) {
  if (!user) return false;
  if (user.subscribed === true || user.subscribed === 1 || user.subscribed === "true") {
    return true;
  }
  const plan = String(user.plan || "").toLowerCase();
  return plan === "premium" || plan === "subscribed";
}

function isAdminUser(user) {
  if (!user) return false;
  if (user.isAdmin === true || user.role === "admin") return true;
  const email = normalizeEmail(user.email);
  if (!email) return false;
  return parseAdminEmails().includes(email);
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
    isAdmin: user?.isAdmin,
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

function newId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `lr_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

function safePdfName(name) {
  const base = path.basename(String(name || "").trim()).replace(/[^a-zA-Z0-9._\-]/g, "_");
  if (!base || base === "." || base === "..") return null;
  if (!/\.pdf$/i.test(base)) return null;
  return base;
}

function loadIndex() {
  const data = readJsonSafe(indexPath(), { version: 1, packs: [] });
  if (!Array.isArray(data.packs)) data.packs = [];
  data.version = 1;
  return data;
}

function saveIndex(data) {
  writeJsonAtomic(indexPath(), data);
}

function fileReady(fileName) {
  const safe = safePdfName(fileName);
  if (!safe) return false;
  try {
    return fs.existsSync(path.join(resourcesDir(), safe));
  } catch (_) {
    return false;
  }
}

function isPublished(pack, now = Date.now()) {
  if (!pack || pack.published === false) return false;
  if (pack.visibleAfter) {
    const t = Date.parse(String(pack.visibleAfter));
    if (Number.isFinite(t) && t > now) return false;
  }
  return true;
}

function toPublicPack(pack, { admin = false } = {}) {
  const files = Array.isArray(pack.files) ? pack.files : [];
  const out = {
    id: pack.id,
    title: pack.title || "",
    description: pack.description || "",
    kind: pack.kind || "live",
    moduleSlug: pack.moduleSlug || null,
    liveDate: pack.liveDate || null,
    tags: Array.isArray(pack.tags) ? pack.tags : [],
    published: pack.published !== false,
    visibleAfter: pack.visibleAfter || null,
    createdAt: pack.createdAt || null,
    updatedAt: pack.updatedAt || null,
    files: files.map((f) => ({
      label: f.label || f.file || "Document",
      file: f.file,
      ready: fileReady(f.file),
    })),
  };
  if (admin) {
    out.notes = pack.notes || "";
    out.createdBy = pack.createdBy || null;
  }
  return out;
}

function normalizeFiles(filesIn) {
  const files = [];
  for (const item of filesIn || []) {
    const file = safePdfName(item && (item.file || item.name));
    if (!file) continue;
    files.push({
      label: String((item && (item.label || item.title)) || file.replace(/\.pdf$/i, "")).trim() || file,
      file,
    });
  }
  return files;
}

module.exports = function createLiveResourcesRouter() {
  const router = express.Router();
  ensureDir(resourcesDir());
  if (!fs.existsSync(indexPath())) {
    saveIndex({ version: 1, packs: [] });
  }

  async function requirePremium(req, res) {
    const user = await resolveUser(req);
    if (!user) {
      res.status(401).json({ error: "Non authentifié" });
      return null;
    }
    const admin = isAdminUser(user);
    if (!isPremiumUser(user) && !admin) {
      res.status(403).json({ error: "Réservé aux abonnés Premium" });
      return null;
    }
    req.user = user;
    req._liveAdmin = admin;
    return user;
  }

  router.get("/api/live-resources/ping", (req, res) => {
    const dir = resourcesDir();
    let ready = false;
    let pdfCount = 0;
    let packCount = 0;
    try {
      if (fs.existsSync(dir)) {
        ready = true;
        pdfCount = fs.readdirSync(dir).filter((f) => /\.pdf$/i.test(f)).length;
      }
      packCount = loadIndex().packs.length;
    } catch (_) {
      ready = false;
      pdfCount = -1;
    }
    res.json({ ok: true, ready, pdfCount, packCount });
  });

  router.get("/api/live-resources", async (req, res) => {
    try {
      const user = await requirePremium(req, res);
      if (!user) return;
      const admin = req._liveAdmin;

      const q = String(req.query.q || "")
        .trim()
        .toLowerCase();
      const kind = String(req.query.kind || "")
        .trim()
        .toLowerCase();
      const moduleSlug = String(req.query.module || "")
        .trim()
        .toLowerCase();
      const liveDate = String(req.query.liveDate || req.query.date || "")
        .trim()
        .slice(0, 10);

      let packs = loadIndex().packs.map((p) => toPublicPack(p, { admin }));
      if (!admin) packs = packs.filter((p) => isPublished(p));
      if (kind) packs = packs.filter((p) => String(p.kind || "").toLowerCase() === kind);
      if (moduleSlug) {
        packs = packs.filter((p) => String(p.moduleSlug || "").toLowerCase() === moduleSlug);
      }
      if (liveDate) packs = packs.filter((p) => String(p.liveDate || "") === liveDate);
      if (q) {
        packs = packs.filter((p) => {
          const hay = `${p.title} ${p.description} ${(p.tags || []).join(" ")}`.toLowerCase();
          return hay.includes(q);
        });
      }

      packs.sort((a, b) =>
        String(b.liveDate || b.updatedAt || "").localeCompare(String(a.liveDate || a.updatedAt || ""))
      );

      return res.json({ ok: true, isAdmin: admin, count: packs.length, packs });
    } catch (err) {
      console.error("[live-resources] list", err && err.message);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  });

  router.get("/api/live-resources/:id", async (req, res) => {
    try {
      const user = await requirePremium(req, res);
      if (!user) return;
      const admin = req._liveAdmin;
      const pack = loadIndex().packs.find((p) => p.id === req.params.id);
      if (!pack) return res.status(404).json({ error: "Ressource introuvable" });
      if (!admin && !isPublished(pack)) {
        return res.status(404).json({ error: "Ressource introuvable" });
      }
      return res.json({ ok: true, isAdmin: admin, pack: toPublicPack(pack, { admin }) });
    } catch (err) {
      console.error("[live-resources] get", err && err.message);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  });

  router.get("/api/live-resources/:id/file/:fileName", async (req, res) => {
    try {
      const user = await requirePremium(req, res);
      if (!user) return;
      const admin = req._liveAdmin;
      const pack = loadIndex().packs.find((p) => p.id === req.params.id);
      if (!pack) return res.status(404).json({ error: "Ressource introuvable" });
      if (!admin && !isPublished(pack)) {
        return res.status(404).json({ error: "Ressource introuvable" });
      }

      const safe = safePdfName(req.params.fileName);
      if (!safe) return res.status(400).json({ error: "Nom de fichier invalide" });

      const allowed = (Array.isArray(pack.files) ? pack.files : []).some(
        (f) => safePdfName(f.file) === safe
      );
      if (!allowed) return res.status(404).json({ error: "Fichier non listé" });

      const dir = path.resolve(resourcesDir());
      const abs = path.resolve(path.join(dir, safe));
      if (!abs.startsWith(dir + path.sep) && abs !== dir) {
        return res.status(400).json({ error: "Chemin invalide" });
      }
      if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
        return res.status(404).json({
          error: "PDF pas encore déposé sur le serveur",
          hint: `Déposer le fichier dans ${dir}/${safe}`,
        });
      }

      const download = String(req.query.download || "") === "1";
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `${download ? "attachment" : "inline"}; filename="${safe.replace(/"/g, "")}"`
      );
      res.setHeader("Cache-Control", "private, no-store");
      return fs.createReadStream(abs).pipe(res);
    } catch (err) {
      console.error("[live-resources] file", err && err.message);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  });

  router.post("/api/live-resources", async (req, res) => {
    try {
      const user = await requirePremium(req, res);
      if (!user) return;
      if (!req._liveAdmin) {
        return res.status(403).json({ error: "Accès admin requis" });
      }

      const body = req.body && typeof req.body === "object" ? req.body : {};
      const title = String(body.title || body.label || "").trim();
      if (!title) return res.status(400).json({ error: "title requis" });

      const files = normalizeFiles(Array.isArray(body.files) ? body.files : []);
      if (!files.length) {
        return res.status(400).json({
          error: "Au moins un fichier PDF (files[].file) est requis",
          hint: "Dépose ensuite le PDF sur le VPS dans LIVE_RESOURCES_DIR",
        });
      }

      const now = new Date().toISOString();
      const pack = {
        id: newId(),
        title,
        description: String(body.description || "").trim(),
        kind: String(body.kind || "live").trim().toLowerCase() || "live",
        moduleSlug: body.moduleSlug ? String(body.moduleSlug).trim() : null,
        liveDate: body.liveDate || body.date ? String(body.liveDate || body.date).trim().slice(0, 10) : null,
        tags: Array.isArray(body.tags)
          ? body.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 20)
          : [],
        published: body.published !== false,
        visibleAfter: body.visibleAfter ? String(body.visibleAfter).trim() : null,
        notes: String(body.notes || "").trim(),
        files,
        createdAt: now,
        updatedAt: now,
        createdBy: normalizeEmail(user.email) || null,
      };

      const data = loadIndex();
      data.packs.unshift(pack);
      saveIndex(data);

      const missingFiles = files.filter((f) => !fileReady(f.file)).map((f) => f.file);
      return res.status(201).json({
        ok: true,
        pack: toPublicPack(pack, { admin: true }),
        missingFiles,
        uploadHint: `scp tes.pdf ubuntu@VPS:${resourcesDir()}/`,
      });
    } catch (err) {
      console.error("[live-resources] create", err && err.message);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  });

  router.patch("/api/live-resources/:id", async (req, res) => {
    try {
      const user = await requirePremium(req, res);
      if (!user) return;
      if (!req._liveAdmin) {
        return res.status(403).json({ error: "Accès admin requis" });
      }

      const body = req.body && typeof req.body === "object" ? req.body : {};
      const data = loadIndex();
      const idx = data.packs.findIndex((p) => p.id === req.params.id);
      if (idx < 0) return res.status(404).json({ error: "Ressource introuvable" });

      const pack = data.packs[idx];
      if (body.title != null || body.label != null) {
        pack.title = String(body.title || body.label).trim() || pack.title;
      }
      if (body.description != null) pack.description = String(body.description).trim();
      if (body.kind != null) pack.kind = String(body.kind).trim().toLowerCase() || pack.kind;
      if (body.moduleSlug !== undefined) {
        pack.moduleSlug = body.moduleSlug ? String(body.moduleSlug).trim() : null;
      }
      if (body.liveDate !== undefined || body.date !== undefined) {
        const d = body.liveDate !== undefined ? body.liveDate : body.date;
        pack.liveDate = d ? String(d).trim().slice(0, 10) : null;
      }
      if (body.tags != null && Array.isArray(body.tags)) {
        pack.tags = body.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 20);
      }
      if (body.published != null) pack.published = Boolean(body.published);
      if (body.visibleAfter !== undefined) {
        pack.visibleAfter = body.visibleAfter ? String(body.visibleAfter).trim() : null;
      }
      if (body.notes != null) pack.notes = String(body.notes).trim();
      if (Array.isArray(body.files)) {
        const files = normalizeFiles(body.files);
        if (files.length) pack.files = files;
      }
      pack.updatedAt = new Date().toISOString();
      data.packs[idx] = pack;
      saveIndex(data);

      const missingFiles = (pack.files || []).filter((f) => !fileReady(f.file)).map((f) => f.file);
      return res.json({
        ok: true,
        pack: toPublicPack(pack, { admin: true }),
        missingFiles,
      });
    } catch (err) {
      console.error("[live-resources] patch", err && err.message);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  });

  router.delete("/api/live-resources/:id", async (req, res) => {
    try {
      const user = await requirePremium(req, res);
      if (!user) return;
      if (!req._liveAdmin) {
        return res.status(403).json({ error: "Accès admin requis" });
      }

      const data = loadIndex();
      const before = data.packs.length;
      data.packs = data.packs.filter((p) => p.id !== req.params.id);
      if (data.packs.length === before) {
        return res.status(404).json({ error: "Ressource introuvable" });
      }
      saveIndex(data);
      return res.json({ ok: true });
    } catch (err) {
      console.error("[live-resources] delete", err && err.message);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  });

  return router;
};

module.exports.RESOURCES_DIR = DEFAULT_DIR;
