/**
 * Lives coaching 1:1 — calendrier La Forge.
 *
 * Admin (FORGE_ADMIN_EMAILS) propose un créneau.
 * Élève Premium confirme sa présence.
 *
 * Usage (server.js) :
 *   const createCoachingLivesRouter = require("./server-patches/routes-coaching-lives");
 *   app.use(createCoachingLivesRouter({ dataDir, requireAuth }));
 *
 * Env :
 *   FORGE_ADMIN_EMAILS=toi@exemple.com
 *   FORGE_COACHING_SLOTS_JSON=[...]  (optionnel : 2 dimanches + 1 samedi par défaut)
 */
"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DEFAULT_TEMPLATES = [
  {
    id: "sun-am",
    weekday: 0,
    start: "10:00",
    end: "11:00",
    label: "Live coaching — dimanche matin",
  },
  {
    id: "sun-pm",
    weekday: 0,
    start: "18:00",
    end: "19:00",
    label: "Live coaching — dimanche soir",
  },
  {
    id: "sat-pm",
    weekday: 6,
    start: "18:00",
    end: "19:00",
    label: "Live coaching — samedi",
  },
];

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

function loadTemplates() {
  const raw = String(process.env.FORGE_COACHING_SLOTS_JSON || "").trim();
  if (!raw) return DEFAULT_TEMPLATES.slice();
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return DEFAULT_TEMPLATES.slice();
    return parsed
      .map((t, i) => ({
        id: String(t.id || "slot-" + i),
        weekday: Number(t.weekday),
        start: String(t.start || "18:00"),
        end: String(t.end || "19:00"),
        label: String(t.label || "Live coaching"),
      }))
      .filter((t) => Number.isFinite(t.weekday) && t.weekday >= 0 && t.weekday <= 6);
  } catch (_) {
    return DEFAULT_TEMPLATES.slice();
  }
}

function isTime(value) {
  return /^\d{2}:\d{2}$/.test(String(value || ""));
}

function isDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function weekdayOfDateKey(dateKey) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

function nextDateForWeekday(fromDate, weekday) {
  const d = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  const delta = (weekday - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + (delta === 0 ? 7 : delta));
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return y + "-" + mo + "-" + day;
}

function newId() {
  return "cl_" + crypto.randomBytes(8).toString("hex");
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

function publicSession(session, viewerEmail, viewerIsAdmin) {
  const mine =
    viewerIsAdmin ||
    (session.studentEmail && normalizeEmail(session.studentEmail) === viewerEmail) ||
    (session.confirmedBy && normalizeEmail(session.confirmedBy) === viewerEmail);

  return {
    id: session.id,
    date: session.date,
    start: session.start,
    end: session.end,
    label: session.label,
    status: session.status,
    templateId: session.templateId || null,
    studentEmail:
      viewerIsAdmin || mine
        ? session.studentEmail || null
        : session.studentEmail
          ? "(réservé)"
          : null,
    confirmedBy: viewerIsAdmin || mine ? session.confirmedBy || null : null,
    confirmedAt: session.confirmedAt || null,
    proposedBy: viewerIsAdmin ? session.proposedBy : undefined,
    proposedAt: session.proposedAt,
    canConfirm:
      session.status === "proposed" &&
      !viewerIsAdmin &&
      (!session.studentEmail || normalizeEmail(session.studentEmail) === viewerEmail),
    canDecline:
      session.status === "proposed" &&
      !!session.studentEmail &&
      normalizeEmail(session.studentEmail) === viewerEmail,
    canCancel: viewerIsAdmin && (session.status === "proposed" || session.status === "confirmed"),
  };
}

function createCoachingLivesRouter(options) {
  const dataDir = options.dataDir || path.join(__dirname, "..", "data");
  const requireAuth = options.requireAuth;
  if (!requireAuth) {
    throw new Error("createCoachingLivesRouter requires requireAuth middleware");
  }

  const livesDir = path.join(dataDir, "coaching-lives");
  fs.mkdirSync(livesDir, { recursive: true });
  const storePath = path.join(livesDir, "sessions.json");

  function readStore() {
    try {
      const parsed = JSON.parse(fs.readFileSync(storePath, "utf8"));
      return {
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        updated: parsed.updated || null,
      };
    } catch (_) {
      return { sessions: [], updated: null };
    }
  }

  function writeStore(sessions) {
    const payload = {
      sessions: sessions || [],
      updated: new Date().toISOString(),
    };
    fs.writeFileSync(storePath, JSON.stringify(payload, null, 2));
    return payload;
  }

  const router = express.Router();

  router.get("/api/coaching-lives/templates", requireAuth, (req, res) => {
    const email = sessionEmail(req);
    if (!email) return res.status(401).json({ error: "Non authentifié" });
    res.json({
      ok: true,
      templates: loadTemplates(),
      isAdmin: isAdminEmail(email),
      adminConfigured: parseAdminEmails().length > 0,
    });
  });

  router.get("/api/coaching-lives", requireAuth, (req, res) => {
    const email = sessionEmail(req);
    if (!email) return res.status(401).json({ error: "Non authentifié" });
    if (!isSubscribed(req) && !isAdminEmail(email)) {
      return res.status(403).json({ error: "Réservé aux abonnés Premium" });
    }

    const from = isDateKey(req.query.from) ? String(req.query.from) : null;
    const to = isDateKey(req.query.to) ? String(req.query.to) : null;
    const admin = isAdminEmail(email);
    const store = readStore();

    let sessions = store.sessions.filter((s) => s.status !== "cancelled");
    if (from) sessions = sessions.filter((s) => s.date >= from);
    if (to) sessions = sessions.filter((s) => s.date <= to);

    if (!admin) {
      sessions = sessions.filter((s) => {
        if (!s.studentEmail) {
          return s.status === "proposed" || normalizeEmail(s.confirmedBy) === email;
        }
        return normalizeEmail(s.studentEmail) === email;
      });
    }

    sessions.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));

    res.json({
      ok: true,
      isAdmin: admin,
      sessions: sessions.map((s) => publicSession(s, email, admin)),
      updated: store.updated,
    });
  });

  router.post("/api/coaching-lives", requireAuth, (req, res) => {
    const email = sessionEmail(req);
    if (!email) return res.status(401).json({ error: "Non authentifié" });
    if (!isAdminEmail(email)) {
      return res.status(403).json({
        error: "Réservé à l'admin coaching. Configure FORGE_ADMIN_EMAILS sur le VPS.",
      });
    }

    const body = req.body || {};
    let date = String(body.date || "").trim();
    let start = String(body.start || "").trim();
    let end = String(body.end || "").trim();
    let label = String(body.label || "").trim();
    const templateId = body.templateId ? String(body.templateId) : null;
    const studentEmail = body.studentEmail ? normalizeEmail(body.studentEmail) : null;

    if (templateId) {
      const tpl = loadTemplates().find((t) => t.id === templateId);
      if (!tpl) return res.status(400).json({ error: "Modèle de créneau inconnu" });
      start = start || tpl.start;
      end = end || tpl.end;
      label = label || tpl.label;
      if (!date) return res.status(400).json({ error: "date requise (YYYY-MM-DD)" });
      if (weekdayOfDateKey(date) !== tpl.weekday) {
        return res.status(400).json({
          error: "La date ne correspond pas au jour du modèle (0=dimanche … 6=samedi)",
        });
      }
    }

    if (!isDateKey(date) || !isTime(start) || !isTime(end)) {
      return res.status(400).json({ error: "date (YYYY-MM-DD), start et end (HH:MM) requis" });
    }
    if (end <= start) {
      return res.status(400).json({ error: "end doit être après start" });
    }

    const store = readStore();
    const clash = store.sessions.find(
      (s) =>
        s.status !== "cancelled" &&
        s.status !== "declined" &&
        s.date === date &&
        s.start === start
    );
    if (clash) {
      return res.status(409).json({ error: "Un live existe déjà sur ce créneau", id: clash.id });
    }

    const session = {
      id: newId(),
      date,
      start,
      end,
      label: label || "Live coaching",
      templateId,
      status: "proposed",
      studentEmail,
      proposedBy: email,
      proposedAt: new Date().toISOString(),
      confirmedBy: null,
      confirmedAt: null,
      notes: String(body.notes || "").slice(0, 500),
    };
    store.sessions.push(session);
    writeStore(store.sessions);
    res.status(201).json({ ok: true, session: publicSession(session, email, true) });
  });

  router.post("/api/coaching-lives/propose-week", requireAuth, (req, res) => {
    const email = sessionEmail(req);
    if (!email) return res.status(401).json({ error: "Non authentifié" });
    if (!isAdminEmail(email)) {
      return res.status(403).json({ error: "Réservé à l'admin coaching" });
    }

    const templates = loadTemplates();
    const from = new Date();
    const store = readStore();
    const created = [];

    for (const tpl of templates) {
      const date = nextDateForWeekday(from, tpl.weekday);
      const exists = store.sessions.some(
        (s) =>
          s.status !== "cancelled" &&
          s.status !== "declined" &&
          s.date === date &&
          s.start === tpl.start
      );
      if (exists) continue;

      const session = {
        id: newId(),
        date,
        start: tpl.start,
        end: tpl.end,
        label: tpl.label,
        templateId: tpl.id,
        status: "proposed",
        studentEmail: null,
        proposedBy: email,
        proposedAt: new Date().toISOString(),
        confirmedBy: null,
        confirmedAt: null,
        notes: "",
      };
      store.sessions.push(session);
      created.push(session);
    }

    writeStore(store.sessions);
    res.json({
      ok: true,
      created: created.map((s) => publicSession(s, email, true)),
      count: created.length,
    });
  });

  router.post("/api/coaching-lives/:id/confirm", requireAuth, (req, res) => {
    const email = sessionEmail(req);
    if (!email) return res.status(401).json({ error: "Non authentifié" });
    if (!isSubscribed(req)) {
      return res.status(403).json({ error: "Réservé aux abonnés Premium" });
    }

    const store = readStore();
    const session = store.sessions.find((s) => s.id === req.params.id);
    if (!session) return res.status(404).json({ error: "Créneau introuvable" });
    if (session.status === "cancelled") {
      return res.status(409).json({ error: "Ce live a été annulé" });
    }
    if (session.status === "confirmed") {
      if (normalizeEmail(session.confirmedBy) === email) {
        return res.json({
          ok: true,
          session: publicSession(session, email, isAdminEmail(email)),
        });
      }
      return res.status(409).json({ error: "Ce créneau est déjà pris" });
    }
    if (session.status !== "proposed") {
      return res.status(409).json({ error: "Créneau non disponible" });
    }
    if (session.studentEmail && normalizeEmail(session.studentEmail) !== email) {
      return res.status(403).json({ error: "Ce live est réservé à un autre élève" });
    }

    session.status = "confirmed";
    session.studentEmail = session.studentEmail || email;
    session.confirmedBy = email;
    session.confirmedAt = new Date().toISOString();
    writeStore(store.sessions);
    res.json({
      ok: true,
      session: publicSession(session, email, isAdminEmail(email)),
    });
  });

  router.post("/api/coaching-lives/:id/decline", requireAuth, (req, res) => {
    const email = sessionEmail(req);
    if (!email) return res.status(401).json({ error: "Non authentifié" });

    const store = readStore();
    const session = store.sessions.find((s) => s.id === req.params.id);
    if (!session) return res.status(404).json({ error: "Créneau introuvable" });
    if (session.status !== "proposed") {
      return res.status(409).json({ error: "Seul un créneau proposé peut être refusé" });
    }
    if (!session.studentEmail || normalizeEmail(session.studentEmail) !== email) {
      return res.status(403).json({ error: "Ce live ne vous est pas assigné" });
    }

    session.status = "declined";
    session.declinedAt = new Date().toISOString();
    writeStore(store.sessions);
    res.json({
      ok: true,
      session: publicSession(session, email, isAdminEmail(email)),
    });
  });

  router.post("/api/coaching-lives/:id/cancel", requireAuth, (req, res) => {
    const email = sessionEmail(req);
    if (!email) return res.status(401).json({ error: "Non authentifié" });
    if (!isAdminEmail(email)) {
      return res.status(403).json({ error: "Réservé à l'admin coaching" });
    }

    const store = readStore();
    const session = store.sessions.find((s) => s.id === req.params.id);
    if (!session) return res.status(404).json({ error: "Créneau introuvable" });
    session.status = "cancelled";
    session.cancelledAt = new Date().toISOString();
    session.cancelledBy = email;
    writeStore(store.sessions);
    res.json({ ok: true, session: publicSession(session, email, true) });
  });

  return router;
}

module.exports = createCoachingLivesRouter;
module.exports.parseAdminEmails = parseAdminEmails;
module.exports.isAdminEmail = isAdminEmail;
module.exports.loadTemplates = loadTemplates;
module.exports.DEFAULT_TEMPLATES = DEFAULT_TEMPLATES;
