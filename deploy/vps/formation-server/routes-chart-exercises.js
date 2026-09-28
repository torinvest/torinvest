/**
 * Exercices chart — notes + screens élèves (Premium) ; lecture admin.
 *
 *   GET    /api/chart-exercises/:moduleId
 *   PUT    /api/chart-exercises/:moduleId
 *   POST   /api/chart-exercises/migrate-local  — récupère notes localStorage → VPS
 *   POST   /api/chart-exercises/:moduleId/images
 *   DELETE /api/chart-exercises/:moduleId/images/:imageId
 *   GET    /api/chart-exercises/:moduleId/media/:fileName
 *   GET    /api/chart-exercises-admin          (admin)
 *   GET    /api/chart-exercises-admin/:email/:moduleId
 */
"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

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

function isValidModuleId(id) {
  return typeof id === "string" && /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(id);
}

function emailSlug(email) {
  return normalizeEmail(email).replace(/[^a-z0-9@._+-]/g, "_");
}

module.exports = function createChartExercisesRouter({ dataDir, requireAuth }) {
  if (typeof requireAuth !== "function") {
    throw new Error("createChartExercisesRouter: requireAuth requis");
  }

  const rootDir = path.join(dataDir, "chart-exercises");
  fs.mkdirSync(rootDir, { recursive: true });

  function userDir(email) {
    const dir = path.join(rootDir, emailSlug(email));
    fs.mkdirSync(path.join(dir, "media"), { recursive: true });
    return dir;
  }

  function modulePath(email, moduleId) {
    return path.join(userDir(email), moduleId + ".json");
  }

  function readModule(email, moduleId) {
    try {
      const p = modulePath(email, moduleId);
      if (!fs.existsSync(p)) {
        return {
          moduleId,
          notes: "",
          done: [],
          images: [],
          updatedAt: null,
        };
      }
      const raw = JSON.parse(fs.readFileSync(p, "utf8"));
      return {
        moduleId,
        notes: clip(raw.notes, 12000),
        done: Array.isArray(raw.done)
          ? raw.done.map((n) => Number(n)).filter((n) => Number.isFinite(n)).slice(0, 40)
          : [],
        images: Array.isArray(raw.images) ? raw.images.slice(0, 12) : [],
        updatedAt: raw.updatedAt || null,
        email: normalizeEmail(email),
      };
    } catch (_) {
      return { moduleId, notes: "", done: [], images: [], updatedAt: null };
    }
  }

  function writeModule(email, moduleId, data) {
    const p = modulePath(email, moduleId);
    const tmp = p + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
    fs.renameSync(tmp, p);
  }

  /** Fusionne notes locales (navigateur) sans écraser un contenu serveur plus riche. */
  function mergeLocalIntoServer(prev, incoming) {
    const inNotes = clip(incoming.notes, 12000);
    const prevNotes = clip(prev.notes, 12000);
    let notes = prevNotes;
    if (inNotes) {
      if (!prevNotes) notes = inNotes;
      else if (inNotes === prevNotes) notes = prevNotes;
      else if (inNotes.length > prevNotes.length) notes = inNotes;
      else if (!prevNotes.includes(inNotes) && !inNotes.includes(prevNotes)) {
        // Deux versions différentes : garder la plus longue, sinon concat légère
        notes = prevNotes.length >= inNotes.length ? prevNotes : inNotes;
      }
    }

    const prevDone = Array.isArray(prev.done) ? prev.done : [];
    const inDone = Array.isArray(incoming.done)
      ? incoming.done.map((n) => Number(n)).filter((n) => Number.isFinite(n)).slice(0, 40)
      : [];
    const doneSet = new Set(prevDone.concat(inDone));
    const done = Array.from(doneSet)
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b)
      .slice(0, 40);

    const inAt = incoming.savedAt ? Date.parse(String(incoming.savedAt)) : NaN;
    const prevAt = prev.updatedAt ? Date.parse(String(prev.updatedAt)) : NaN;
    const touched =
      notes !== prevNotes ||
      done.length !== prevDone.length ||
      done.some((d, i) => d !== prevDone[i]);

    return {
      moduleId: prev.moduleId || incoming.moduleId,
      email: prev.email || incoming.email,
      notes,
      done,
      images: Array.isArray(prev.images) ? prev.images : [],
      updatedAt: touched
        ? new Date().toISOString()
        : prev.updatedAt ||
          (Number.isFinite(inAt) ? new Date(inAt).toISOString() : null) ||
          (Number.isFinite(prevAt) ? prev.updatedAt : null),
      _merged: touched,
    };
  }

  const router = express.Router();

  // Avant /:moduleId — récupération notes localStorage (clés forge_chart_ex_*)
  router.post("/api/chart-exercises/migrate-local", requireAuth, (req, res) => {
    const email = sessionEmail(req);
    if (!email) return res.status(401).json({ error: "Non authentifié" });
    if (!isAdminEmail(email) && !isSubscribed(req)) {
      return res.status(403).json({ error: "Premium requis" });
    }
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) return res.json({ ok: true, migrated: 0, results: [] });

    const results = [];
    let migrated = 0;
    for (const raw of items.slice(0, 80)) {
      const moduleId = String(raw?.moduleId || "").trim();
      if (!isValidModuleId(moduleId)) {
        results.push({ moduleId, error: "moduleId invalide" });
        continue;
      }
      const prev = readModule(email, moduleId);
      const next = mergeLocalIntoServer(
        { ...prev, email, moduleId },
        {
          moduleId,
          email,
          notes: raw.notes,
          done: raw.done,
          savedAt: raw.savedAt,
        }
      );
      delete next._merged;
      const changed =
        next.notes !== (prev.notes || "") ||
        JSON.stringify(next.done || []) !== JSON.stringify(prev.done || []);
      if (changed) {
        next.email = email;
        next.moduleId = moduleId;
        next.updatedAt = new Date().toISOString();
        writeModule(email, moduleId, next);
        migrated += 1;
      }
      results.push({
        moduleId,
        migrated: changed,
        notesLen: (next.notes || "").length,
        doneCount: (next.done || []).length,
      });
    }
    return res.json({ ok: true, migrated, results });
  });

  router.get("/api/chart-exercises/:moduleId", requireAuth, (req, res) => {
    const email = sessionEmail(req);
    if (!email) return res.status(401).json({ error: "Non authentifié" });
    if (!isAdminEmail(email) && !isSubscribed(req)) {
      return res.status(403).json({ error: "Premium requis" });
    }
    const moduleId = String(req.params.moduleId || "");
    if (!isValidModuleId(moduleId)) return res.status(400).json({ error: "moduleId invalide" });
    return res.json({ exercise: readModule(email, moduleId), isAdmin: isAdminEmail(email) });
  });

  router.put("/api/chart-exercises/:moduleId", requireAuth, (req, res) => {
    const email = sessionEmail(req);
    if (!email) return res.status(401).json({ error: "Non authentifié" });
    if (!isAdminEmail(email) && !isSubscribed(req)) {
      return res.status(403).json({ error: "Premium requis" });
    }
    const moduleId = String(req.params.moduleId || "");
    if (!isValidModuleId(moduleId)) return res.status(400).json({ error: "moduleId invalide" });
    const prev = readModule(email, moduleId);
    const body = req.body || {};
    const next = {
      moduleId,
      email,
      notes: clip(body.notes, 12000),
      done: Array.isArray(body.done)
        ? body.done.map((n) => Number(n)).filter((n) => Number.isFinite(n)).slice(0, 40)
        : prev.done,
      images: prev.images || [],
      updatedAt: new Date().toISOString(),
    };
    writeModule(email, moduleId, next);
    return res.json({ exercise: next });
  });

  router.post("/api/chart-exercises/:moduleId/images", requireAuth, async (req, res) => {
    const email = sessionEmail(req);
    if (!email) return res.status(401).json({ error: "Non authentifié" });
    if (!isAdminEmail(email) && !isSubscribed(req)) {
      return res.status(403).json({ error: "Premium requis" });
    }
    const moduleId = String(req.params.moduleId || "");
    if (!isValidModuleId(moduleId)) return res.status(400).json({ error: "moduleId invalide" });

    const dataUrl = String(req.body?.dataUrl || "");
    const m = dataUrl.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/);
    if (!m) return res.status(400).json({ error: "Image invalide (jpeg/png/webp/gif)" });
    const ext = ALLOWED_MIME[m[1]];
    if (!ext) return res.status(400).json({ error: "Type non supporté" });
    let buf;
    try {
      buf = Buffer.from(m[2].replace(/\s+/g, ""), "base64");
    } catch (_) {
      return res.status(400).json({ error: "Décodage échoué" });
    }
    if (!buf.length || buf.length > MAX_IMAGE_BYTES) {
      return res.status(400).json({ error: "Image trop lourde (max 6 Mo)" });
    }

    const imgId = newId("cimg_");
    const fileName = imgId + ext;
    const mediaDir = path.join(userDir(email), "media", moduleId);
    fs.mkdirSync(mediaDir, { recursive: true });
    fs.writeFileSync(path.join(mediaDir, fileName), buf);

    const prev = readModule(email, moduleId);
    const img = {
      id: imgId,
      file: fileName,
      caption: clip(req.body?.caption, 300),
      createdAt: new Date().toISOString(),
    };
    prev.images = Array.isArray(prev.images) ? prev.images.slice() : [];
    if (prev.images.length >= 12) {
      return res.status(400).json({ error: "Maximum 12 screens par module" });
    }
    prev.images.push(img);
    prev.updatedAt = new Date().toISOString();
    prev.email = email;
    prev.moduleId = moduleId;
    writeModule(email, moduleId, prev);
    return res.status(201).json({ image: img, exercise: prev });
  });

  router.delete("/api/chart-exercises/:moduleId/images/:imageId", requireAuth, (req, res) => {
    const email = sessionEmail(req);
    if (!email) return res.status(401).json({ error: "Non authentifié" });
    const moduleId = String(req.params.moduleId || "");
    if (!isValidModuleId(moduleId)) return res.status(400).json({ error: "moduleId invalide" });
    const prev = readModule(email, moduleId);
    const img = (prev.images || []).find((i) => i.id === req.params.imageId);
    if (!img) return res.status(404).json({ error: "Image introuvable" });
    prev.images = prev.images.filter((i) => i.id !== req.params.imageId);
    prev.updatedAt = new Date().toISOString();
    writeModule(email, moduleId, prev);
    try {
      fs.unlinkSync(path.join(userDir(email), "media", moduleId, img.file));
    } catch (_) {}
    return res.json({ exercise: prev });
  });

  router.get("/api/chart-exercises/:moduleId/media/:fileName", requireAuth, (req, res) => {
    const email = sessionEmail(req);
    if (!email) return res.status(401).json({ error: "Non authentifié" });
    const moduleId = String(req.params.moduleId || "");
    const fileName = path.basename(String(req.params.fileName || ""));
    if (!isValidModuleId(moduleId) || !fileName || fileName.includes("..")) {
      return res.status(400).json({ error: "Requête invalide" });
    }

    let owner = email;
    const asUser = normalizeEmail(req.query.email || "");
    if (asUser && isAdminEmail(email)) owner = asUser;

    const ex = readModule(owner, moduleId);
    if (!(ex.images || []).some((i) => i.file === fileName)) {
      return res.status(404).json({ error: "Fichier inconnu" });
    }
    if (!isAdminEmail(email) && owner !== email) {
      return res.status(403).json({ error: "Interdit" });
    }
    const full = path.join(userDir(owner), "media", moduleId, fileName);
    if (!fs.existsSync(full)) return res.status(404).json({ error: "Manquant" });
    return res.sendFile(full);
  });

  router.get("/api/chart-exercises-admin", requireAuth, (req, res) => {
    const email = sessionEmail(req);
    if (!isAdminEmail(email)) return res.status(403).json({ error: "Admin uniquement" });
    const items = [];
    try {
      const users = fs.readdirSync(rootDir, { withFileTypes: true }).filter((d) => d.isDirectory());
      for (const u of users) {
        const dir = path.join(rootDir, u.name);
        const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
        for (const f of files) {
          try {
            const raw = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
            const moduleId = f.replace(/\.json$/, "");
            const notes = clip(raw.notes, 12000);
            if (!notes && !(raw.images || []).length && !(raw.done || []).length) continue;
            items.push({
              email: normalizeEmail(raw.email) || u.name,
              emailSlug: u.name,
              moduleId,
              notesPreview: notes.slice(0, 280),
              notesLen: notes.length,
              doneCount: Array.isArray(raw.done) ? raw.done.length : 0,
              imageCount: Array.isArray(raw.images) ? raw.images.length : 0,
              updatedAt: raw.updatedAt || null,
            });
          } catch (_) {}
        }
      }
    } catch (_) {}
    items.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    return res.json({ items, isAdmin: true });
  });

  router.get("/api/chart-exercises-admin/:emailSlug/:moduleId", requireAuth, (req, res) => {
    const email = sessionEmail(req);
    if (!isAdminEmail(email)) return res.status(403).json({ error: "Admin uniquement" });
    const slug = String(req.params.emailSlug || "").replace(/[^a-z0-9@._+-]/gi, "");
    const moduleId = String(req.params.moduleId || "");
    if (!slug || !isValidModuleId(moduleId)) return res.status(400).json({ error: "Paramètres invalides" });
    const userFolder = path.join(rootDir, slug);
    if (!fs.existsSync(userFolder)) return res.status(404).json({ error: "Élève introuvable" });
    // email réel depuis JSON si présent
    const p = path.join(userFolder, moduleId + ".json");
    if (!fs.existsSync(p)) return res.status(404).json({ error: "Exercice introuvable" });
    const raw = JSON.parse(fs.readFileSync(p, "utf8"));
    const ownerEmail = normalizeEmail(raw.email || slug);
    const exercise = readModule(ownerEmail, moduleId);
    exercise.email = ownerEmail;
    exercise.emailSlug = slug;
    return res.json({ exercise, isAdmin: true });
  });

  return router;
};
