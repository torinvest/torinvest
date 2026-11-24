/**
 * Lives collectifs La Forge — calendrier (tous les Premium).
 *
 * Admin planifie ; rappels Brevo liste 4h/1h ; popup calendrier côté client.
 *
 *   app.use(createCollectiveLivesRouter({ dataDir, requireAuth }));
 */
"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

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

function clip(s, n) {
  return String(s || "").trim().slice(0, n || 200);
}

function createCollectiveLivesRouter(options) {
  const dataDir = options && options.dataDir;
  const requireAuth = options && options.requireAuth;
  if (!dataDir || typeof requireAuth !== "function") {
    throw new Error("createCollectiveLivesRouter: dataDir + requireAuth requis");
  }

  const livesDir = path.join(dataDir, "collective-lives");
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

  function publicSession(s) {
    return {
      id: s.id,
      date: s.date,
      start: s.start,
      end: s.end || "",
      label: s.label || "Live collectif",
      channel: s.channel || "",
      url: s.url || "",
      status: s.status || "scheduled",
      notes: s.notes || "",
      createdAt: s.createdAt || null,
      reminders: s.reminders || {},
    };
  }

  const router = express.Router();

  router.get("/api/collective-lives", requireAuth, (req, res) => {
    const email = normalizeEmail(req.user && req.user.email);
    const store = readStore();
    const sessions = store.sessions
      .filter((s) => s && s.status !== "cancelled")
      .map(publicSession)
      .sort((a, b) => String(a.date + a.start).localeCompare(String(b.date + b.start)));
    res.json({
      ok: true,
      isAdmin: isAdminEmail(email),
      sessions,
      updated: store.updated,
    });
  });

  router.post("/api/collective-lives", requireAuth, (req, res) => {
    const email = normalizeEmail(req.user && req.user.email);
    if (!isAdminEmail(email)) {
      return res.status(403).json({ error: "Admin requis" });
    }
    const body = req.body || {};
    const date = clip(body.date, 12);
    const start = clip(body.start, 8);
    const end = clip(body.end, 8);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(start)) {
      return res.status(400).json({ error: "date (YYYY-MM-DD) et start (HH:MM) requis" });
    }
    const store = readStore();
    const session = {
      id: "col_" + crypto.randomBytes(6).toString("hex"),
      date,
      start,
      end: /^\d{2}:\d{2}$/.test(end) ? end : "",
      label: clip(body.label, 120) || "Live collectif",
      channel: clip(body.channel, 40) || "discord",
      url: clip(body.url, 400),
      notes: clip(body.notes, 500),
      status: "scheduled",
      reminders: {},
      createdAt: new Date().toISOString(),
      createdBy: email,
    };
    store.sessions.push(session);
    writeStore(store.sessions);
    res.status(201).json({ ok: true, session: publicSession(session) });
  });

  router.post("/api/collective-lives/:id/cancel", requireAuth, (req, res) => {
    const email = normalizeEmail(req.user && req.user.email);
    if (!isAdminEmail(email)) {
      return res.status(403).json({ error: "Admin requis" });
    }
    const store = readStore();
    const session = store.sessions.find((s) => s.id === req.params.id);
    if (!session) return res.status(404).json({ error: "Live introuvable" });
    session.status = "cancelled";
    session.cancelledAt = new Date().toISOString();
    session.cancelledBy = email;
    writeStore(store.sessions);
    res.json({ ok: true, session: publicSession(session) });
  });

  try {
    const reminders = require("./collective-reminders-lib");
    if (reminders && typeof reminders.startCollectiveReminders === "function") {
      reminders.startCollectiveReminders({ dataDir });
    }
  } catch (err) {
    console.warn(
      "[collective-lives] reminders non démarrés:",
      err && err.message ? err.message : err
    );
  }

  try {
    const digest = require("./weekly-digest-lib");
    if (digest && typeof digest.startWeeklyDigest === "function") {
      digest.startWeeklyDigest({ dataDir });
    }
  } catch (err) {
    console.warn(
      "[collective-lives] weekly digest non démarré:",
      err && err.message ? err.message : err
    );
  }

  return router;
}

module.exports = createCollectiveLivesRouter;
module.exports.isAdminEmail = isAdminEmail;
