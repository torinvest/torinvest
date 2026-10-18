/**
 * TORINVEST Masterclass Macro — API gated (admin ou grant).
 *
 *   app.use(createMasterclassRouter({ dataDir, requireAuth }));
 *
 * Env : FORGE_ADMIN_EMAILS
 *
 * Accès contenu : jamais via fichiers statiques publics.
 * Draft + admin_only par défaut — sales_enabled=false.
 */
"use strict";

const express = require("express");
const path = require("path");
const { createMasterclassStore } = require("./masterclass/store");
const { publicCatalog } = require("./masterclass/config");

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

function createMasterclassRouter(options) {
  const opts = options || {};
  const requireAuth = opts.requireAuth;
  if (typeof requireAuth !== "function") {
    throw new Error("createMasterclassRouter: requireAuth middleware required");
  }
  const dataDir = opts.dataDir || path.join(__dirname, "..", "data");
  const store = createMasterclassStore(dataDir);
  const router = express.Router();

  function emailOf(req) {
    return normalizeEmail(sessionUser(req).email);
  }

  function canAccessContent(req) {
    const email = emailOf(req);
    if (!email) return { ok: false, reason: "auth_required" };
    if (isAdminEmail(email) || sessionUser(req).isAdmin) {
      return { ok: true, role: "admin", email };
    }
    const cfg = store.loadConfig();
    if (cfg.publication_status !== "published") {
      return { ok: false, reason: "not_published" };
    }
    if (cfg.visibility === "admin_only") {
      return { ok: false, reason: "admin_only" };
    }
    if (store.hasGrant(email)) {
      return { ok: true, role: "granted", email };
    }
    return { ok: false, reason: "no_grant" };
  }

  function requireContentAccess(req, res, next) {
    const access = canAccessContent(req);
    if (!access.ok) {
      const status = access.reason === "auth_required" ? 401 : 403;
      return res.status(status).json({
        error: "masterclass_forbidden",
        reason: access.reason,
        message:
          "Masterclass réservée à l'administrateur ou aux accès autorisés.",
      });
    }
    req.masterclassAccess = access;
    return next();
  }

  function requireAdmin(req, res, next) {
    const email = emailOf(req);
    if (!email) return res.status(401).json({ error: "auth_required" });
    if (!isAdminEmail(email) && !sessionUser(req).isAdmin) {
      return res.status(403).json({ error: "admin_required" });
    }
    return next();
  }

  // Catalog public minimal (pas de contenu pédagogique)
  router.get("/api/masterclass/catalog", requireAuth, (req, res) => {
    const cfg = store.loadConfig();
    const email = emailOf(req);
    const admin = isAdminEmail(email) || !!sessionUser(req).isAdmin;
    const access = canAccessContent(req);
    res.json({
      ok: true,
      catalog: publicCatalog(cfg),
      access: {
        isAdmin: admin,
        canRead: access.ok,
        reason: access.ok ? null : access.reason,
        hasGrant: email ? store.hasGrant(email) : false,
      },
    });
  });

  router.get(
    "/api/masterclass/index",
    requireAuth,
    requireContentAccess,
    (req, res) => {
      const index = store.loadIndex();
      const progress = store.loadProgress(req.masterclassAccess.email);
      res.json({
        ok: true,
        index,
        progress: progress.chapters || {},
        access: req.masterclassAccess,
      });
    }
  );

  router.get(
    "/api/masterclass/chapters/:num",
    requireAuth,
    requireContentAccess,
    (req, res) => {
      const num = Number(req.params.num);
      if (!Number.isFinite(num) || num < 1 || num > 99) {
        return res.status(400).json({ error: "bad_chapter" });
      }
      const chapter = store.loadChapter(num);
      if (!chapter) {
        return res.status(404).json({
          error: "chapter_not_found",
          message: "Chapitre non importé sur ce serveur.",
        });
      }
      // Élève : uniquement chapitres publishés (admin voit draft)
      if (
        req.masterclassAccess.role !== "admin" &&
        chapter.status &&
        chapter.status !== "published"
      ) {
        return res.status(403).json({ error: "chapter_not_published" });
      }
      res.json({ ok: true, chapter });
    }
  );

  router.get(
    "/api/masterclass/progress",
    requireAuth,
    requireContentAccess,
    (req, res) => {
      res.json({ ok: true, progress: store.loadProgress(req.masterclassAccess.email) });
    }
  );

  router.put(
    "/api/masterclass/progress",
    requireAuth,
    requireContentAccess,
    express.json({ limit: "100kb" }),
    (req, res) => {
      const email = req.masterclassAccess.email;
      const body = req.body || {};
      const prev = store.loadProgress(email);
      const chapters = Object.assign({}, prev.chapters || {});
      const num = Number(body.chapter);
      if (!Number.isFinite(num) || num < 1) {
        return res.status(400).json({ error: "bad_chapter" });
      }
      const key = String(num);
      const cur = chapters[key] || {};
      chapters[key] = {
        sectionsDone: Math.max(
          Number(cur.sectionsDone) || 0,
          Number(body.sectionsDone) || 0
        ),
        completed: !!(cur.completed || body.completed),
        lastAt: new Date().toISOString(),
      };
      const next = store.saveProgress(email, { chapters });
      res.json({ ok: true, progress: next });
    }
  );

  // --- Admin ---
  router.get("/api/masterclass/admin/config", requireAuth, requireAdmin, (req, res) => {
    res.json({
      ok: true,
      config: store.loadConfig(),
      grants: store.loadGrants(),
      chapterNumbers: store.listChapterNumbers(),
      index: store.loadIndex(),
    });
  });

  router.put(
    "/api/masterclass/admin/config",
    requireAuth,
    requireAdmin,
    express.json({ limit: "200kb" }),
    (req, res) => {
      const body = req.body || {};
      const allowed = [
        "publication_status",
        "visibility",
        "access_policy",
        "sales_enabled",
        "price_amount",
        "currency",
        "payment_provider",
        "payment_url",
        "coaching",
        "title",
        "disclaimer",
        "chapterCount",
      ];
      const patch = {};
      for (const k of allowed) {
        if (body[k] !== undefined) patch[k] = body[k];
      }
      // Garde-fous : ne jamais forcer un prix inventé — null autorisé
      if (patch.sales_enabled === true) {
        const cfg = store.loadConfig();
        const nextPrice =
          patch.price_amount !== undefined ? patch.price_amount : cfg.price_amount;
        const nextUrl =
          patch.payment_url !== undefined ? patch.payment_url : cfg.payment_url;
        if (nextPrice == null || !nextUrl) {
          return res.status(400).json({
            error: "sales_requires_price_and_url",
            message:
              "Impossible d'activer les ventes sans price_amount et payment_url renseignés.",
          });
        }
      }
      const config = store.saveConfig(patch);
      res.json({ ok: true, config: publicCatalog(config), full: config });
    }
  );

  router.post(
    "/api/masterclass/admin/grants",
    requireAuth,
    requireAdmin,
    express.json({ limit: "50kb" }),
    (req, res) => {
      const email = normalizeEmail(req.body && req.body.email);
      if (!email || !email.includes("@")) {
        return res.status(400).json({ error: "bad_email" });
      }
      const grants = store.loadGrants().filter(
        (g) => normalizeEmail(g.email) !== email || g.revokedAt
      );
      grants.push({
        email,
        grantedAt: new Date().toISOString(),
        grantedBy: emailOf(req),
        source: String((req.body && req.body.source) || "admin"),
        expiresAt: (req.body && req.body.expiresAt) || null,
        revokedAt: null,
      });
      store.saveGrants(grants);
      res.json({ ok: true, grants: store.loadGrants() });
    }
  );

  router.delete(
    "/api/masterclass/admin/grants/:email",
    requireAuth,
    requireAdmin,
    (req, res) => {
      const email = normalizeEmail(req.params.email);
      const grants = store.loadGrants().map((g) => {
        if (normalizeEmail(g.email) !== email || g.revokedAt) return g;
        return Object.assign({}, g, {
          revokedAt: new Date().toISOString(),
          revokedBy: emailOf(req),
        });
      });
      store.saveGrants(grants);
      res.json({ ok: true, grants });
    }
  );

  return router;
}

module.exports = createMasterclassRouter;
