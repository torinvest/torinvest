/**
 * Fiches de suivi coaching 1:1 — La Forge.
 *
 * Admin (FORGE_ADMIN_EMAILS) crée / édite / annote (notes privées).
 * Lien partage (?t=TOKEN) : lecture seule sans notes coach.
 * Élève Premium connecté : voit ses fiches assignées (sans notes privées).
 *
 * Usage (server.js) :
 *   const createCoachingFichesRouter = require("./server-patches/routes-coaching-fiches");
 *   app.use(createCoachingFichesRouter({ dataDir, requireAuth }));
 */
"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const LEVELS = ["faible", "progres", "bonne", "solide"];

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function parseAdminEmails() {
  const raw = String(process.env.FORGE_ADMIN_EMAILS || "").trim();
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

function newId() {
  return "cf_" + crypto.randomBytes(8).toString("hex");
}

function newShareToken() {
  return crypto.randomBytes(18).toString("base64url");
}

function clip(s, max) {
  return String(s || "").trim().slice(0, max);
}

function clipList(arr, maxItems, maxLen) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => clip(x, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeLevel(v) {
  const s = String(v || "").trim().toLowerCase();
  return LEVELS.includes(s) ? s : "";
}

function emptyFicheBody() {
  return {
    studentName: "",
    studentEmail: "",
    date: "",
    moduleTheme: "",
    duration: "",
    positives: ["", "", ""],
    difficulties: ["", "", ""],
    priorityAxis: "",
    mustUnderstand: ["", "", ""],
    mustDo: ["", "", ""],
    exercise1: "",
    exercise2: "",
    routine: "",
    errorsToAvoid: ["", "", ""],
    nextLiveGoal: "",
    evolution: {
      comprehension: "",
      regularite: "",
      autonomie: "",
      application: "",
    },
    coachKeyPoint: "",
    axeDuMoment: "STRUCTURE — COMPRÉHENSION — APPLICATION — RÉGULARITÉ",
    coachPrivateNotes: "",
  };
}

function sanitizeBody(input, { keepPrivate }) {
  const src = input && typeof input === "object" ? input : {};
  const base = emptyFicheBody();
  const out = {
    studentName: clip(src.studentName, 120),
    studentEmail: normalizeEmail(src.studentEmail).slice(0, 160),
    date: clip(src.date, 40),
    moduleTheme: clip(src.moduleTheme, 200),
    duration: clip(src.duration, 40),
    positives: clipList(src.positives != null ? src.positives : base.positives, 8, 400),
    difficulties: clipList(src.difficulties != null ? src.difficulties : base.difficulties, 8, 400),
    priorityAxis: clip(src.priorityAxis, 600),
    mustUnderstand: clipList(
      src.mustUnderstand != null ? src.mustUnderstand : base.mustUnderstand,
      8,
      400
    ),
    mustDo: clipList(src.mustDo != null ? src.mustDo : base.mustDo, 8, 400),
    exercise1: clip(src.exercise1, 800),
    exercise2: clip(src.exercise2, 800),
    routine: clip(src.routine, 600),
    errorsToAvoid: clipList(
      src.errorsToAvoid != null ? src.errorsToAvoid : base.errorsToAvoid,
      8,
      400
    ),
    nextLiveGoal: clip(src.nextLiveGoal, 600),
    evolution: {
      comprehension: normalizeLevel(src.evolution && src.evolution.comprehension),
      regularite: normalizeLevel(src.evolution && src.evolution.regularite),
      autonomie: normalizeLevel(src.evolution && src.evolution.autonomie),
      application: normalizeLevel(src.evolution && src.evolution.application),
    },
    coachKeyPoint: clip(src.coachKeyPoint, 800),
    axeDuMoment: clip(src.axeDuMoment, 200) || base.axeDuMoment,
  };
  if (keepPrivate) {
    out.coachPrivateNotes = clip(src.coachPrivateNotes, 4000);
  }
  return out;
}

function publicView(fiche) {
  if (!fiche) return null;
  const { coachPrivateNotes, shareToken, ...rest } = fiche;
  return {
    ...rest,
    shared: Boolean(fiche.shared),
    shareUrlPath: fiche.shareToken
      ? "/coaching-fiche.html?t=" + encodeURIComponent(fiche.shareToken)
      : null,
  };
}

function adminView(fiche) {
  if (!fiche) return null;
  return {
    ...fiche,
    shareUrlPath: fiche.shareToken
      ? "/coaching-fiche.html?t=" + encodeURIComponent(fiche.shareToken)
      : null,
  };
}

function createCoachingFichesRouter(opts) {
  const dataDir = opts && opts.dataDir;
  const requireAuth = opts && opts.requireAuth;
  if (!dataDir || typeof requireAuth !== "function") {
    throw new Error("createCoachingFichesRouter: dataDir + requireAuth requis");
  }

  const fichesDir = path.join(dataDir, "coaching-fiches");
  fs.mkdirSync(fichesDir, { recursive: true });
  const storePath = path.join(fichesDir, "index.json");

  function readStore() {
    try {
      const raw = fs.readFileSync(storePath, "utf8");
      const parsed = JSON.parse(raw);
      const fiches = Array.isArray(parsed.fiches) ? parsed.fiches : [];
      return fiches;
    } catch (_) {
      return [];
    }
  }

  function writeStore(fiches) {
    const payload = {
      fiches: fiches || [],
      updated: new Date().toISOString(),
    };
    const tmp = storePath + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(payload, null, 2));
    fs.renameSync(tmp, storePath);
  }

  const router = express.Router();

  // ——— Partage public (token) — pas d'auth, sans notes privées ———
  router.get("/api/coaching-fiches/share/:token", (req, res) => {
    const token = String(req.params.token || "").trim();
    if (!token || token.length < 12) {
      return res.status(400).json({ error: "Token invalide" });
    }
    const fiche = readStore().find((f) => f.shareToken === token && f.shared === true);
    if (!fiche) {
      return res.status(404).json({ error: "Fiche introuvable ou non partagée" });
    }
    return res.json({ fiche: publicView(fiche) });
  });

  // ——— Liste ———
  router.get("/api/coaching-fiches", requireAuth, (req, res) => {
    const email = sessionEmail(req);
    const admin = isAdminEmail(email);
    const all = readStore();

    if (admin) {
      const q = normalizeEmail(req.query.student || "");
      const filtered = q ? all.filter((f) => f.studentEmail === q) : all;
      filtered.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
      return res.json({
        isAdmin: true,
        fiches: filtered.map(adminView),
      });
    }

    if (!isSubscribed(req)) {
      return res.status(403).json({ error: "Premium requis" });
    }

    const mine = all
      .filter((f) => f.studentEmail === email && f.shared === true)
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    return res.json({
      isAdmin: false,
      fiches: mine.map(publicView),
    });
  });

  // ——— Détail ———
  router.get("/api/coaching-fiches/:id", requireAuth, (req, res) => {
    const email = sessionEmail(req);
    const admin = isAdminEmail(email);
    const fiche = readStore().find((f) => f.id === req.params.id);
    if (!fiche) return res.status(404).json({ error: "Fiche introuvable" });

    if (admin) return res.json({ isAdmin: true, fiche: adminView(fiche) });

    if (!isSubscribed(req)) return res.status(403).json({ error: "Premium requis" });
    if (fiche.studentEmail !== email || !fiche.shared) {
      return res.status(403).json({ error: "Accès refusé" });
    }
    return res.json({ isAdmin: false, fiche: publicView(fiche) });
  });

  // ——— Créer ———
  router.post("/api/coaching-fiches", requireAuth, (req, res) => {
    const email = sessionEmail(req);
    if (!isAdminEmail(email)) return res.status(403).json({ error: "Admin uniquement" });

    const body = sanitizeBody(req.body || {}, { keepPrivate: true });
    const now = new Date().toISOString();
    const fiche = {
      id: newId(),
      shareToken: newShareToken(),
      shared: false,
      createdAt: now,
      updatedAt: now,
      createdBy: email,
      ...body,
    };

    const all = readStore();
    all.push(fiche);
    writeStore(all);
    return res.status(201).json({ fiche: adminView(fiche) });
  });

  // ——— Mettre à jour ———
  router.put("/api/coaching-fiches/:id", requireAuth, (req, res) => {
    const email = sessionEmail(req);
    if (!isAdminEmail(email)) return res.status(403).json({ error: "Admin uniquement" });

    const all = readStore();
    const idx = all.findIndex((f) => f.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: "Fiche introuvable" });

    const prev = all[idx];
    const body = sanitizeBody(req.body || {}, { keepPrivate: true });
    const next = {
      ...prev,
      ...body,
      id: prev.id,
      shareToken: prev.shareToken || newShareToken(),
      shared: typeof req.body?.shared === "boolean" ? req.body.shared : prev.shared,
      createdAt: prev.createdAt,
      createdBy: prev.createdBy,
      updatedAt: new Date().toISOString(),
      updatedBy: email,
    };
    all[idx] = next;
    writeStore(all);
    return res.json({ fiche: adminView(next) });
  });

  // ——— Activer / couper le partage ———
  router.post("/api/coaching-fiches/:id/share", requireAuth, (req, res) => {
    const email = sessionEmail(req);
    if (!isAdminEmail(email)) return res.status(403).json({ error: "Admin uniquement" });

    const all = readStore();
    const idx = all.findIndex((f) => f.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: "Fiche introuvable" });

    const enable = req.body && req.body.enable === false ? false : true;
    const rotate = Boolean(req.body && req.body.rotateToken);
    const fiche = { ...all[idx] };
    if (!fiche.shareToken || rotate) fiche.shareToken = newShareToken();
    fiche.shared = enable;
    fiche.updatedAt = new Date().toISOString();
    fiche.updatedBy = email;
    all[idx] = fiche;
    writeStore(all);

    const origin = String(req.headers.origin || "https://app.torinvest-trading.com").replace(/\/$/, "");
    return res.json({
      fiche: adminView(fiche),
      shareUrl: enable
        ? origin + "/coaching-fiche.html?t=" + encodeURIComponent(fiche.shareToken)
        : null,
    });
  });

  // ——— Supprimer ———
  router.delete("/api/coaching-fiches/:id", requireAuth, (req, res) => {
    const email = sessionEmail(req);
    if (!isAdminEmail(email)) return res.status(403).json({ error: "Admin uniquement" });

    const all = readStore();
    const next = all.filter((f) => f.id !== req.params.id);
    if (next.length === all.length) return res.status(404).json({ error: "Fiche introuvable" });
    writeStore(next);
    return res.json({ ok: true });
  });

  return router;
}

module.exports = createCoachingFichesRouter;
