/**
 * Questions module — 1 thread par élève / module, réponses coach.
 *
 * Élève Premium : crée et lit SES questions sur le module courant.
 * Admin (FORGE_ADMIN_EMAILS) : voit tout, répond, clôture.
 *
 *   const createModuleQaRouter = require("./server-patches/routes-module-qa");
 *   app.use(createModuleQaRouter({ dataDir, requireAuth }));
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

function sessionEmail(req) {
  return normalizeEmail(req.session?.user?.email || req.user?.email || "");
}

function sessionName(req) {
  const u = req.session?.user || req.user || {};
  return String(u.name || u.displayName || "").trim().slice(0, 120);
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

function emptyStore() {
  return { threads: [] };
}

module.exports = function createModuleQaRouter({ dataDir, requireAuth }) {
  if (typeof requireAuth !== "function") {
    throw new Error("createModuleQaRouter: requireAuth requis");
  }

  const dir = path.join(dataDir, "module-qa");
  const storePath = path.join(dir, "index.json");
  fs.mkdirSync(dir, { recursive: true });

  function readStore() {
    try {
      if (!fs.existsSync(storePath)) return emptyStore();
      const raw = JSON.parse(fs.readFileSync(storePath, "utf8"));
      if (!raw || !Array.isArray(raw.threads)) return emptyStore();
      return { threads: raw.threads };
    } catch (_) {
      return emptyStore();
    }
  }

  function writeStore(store) {
    const tmp = storePath + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
    fs.renameSync(tmp, storePath);
  }

  function publicThread(t) {
    return {
      id: t.id,
      moduleId: t.moduleId,
      studentEmail: t.studentEmail,
      studentName: t.studentName || "",
      question: t.question,
      status: t.status || "open",
      messages: Array.isArray(t.messages) ? t.messages : [],
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  }

  const router = express.Router();

  // Liste
  router.get("/api/module-qa", requireAuth, (req, res) => {
    const email = sessionEmail(req);
    const admin = isAdminEmail(email);
    if (!admin && !isSubscribed(req)) {
      return res.status(403).json({ error: "Premium requis" });
    }

    const moduleId = clip(req.query.moduleId, 80);
    const status = clip(req.query.status, 40);
    const student = normalizeEmail(req.query.student || "");
    let threads = readStore().threads;

    if (admin) {
      if (moduleId) threads = threads.filter((t) => t.moduleId === moduleId);
      if (student) threads = threads.filter((t) => t.studentEmail === student);
      if (status) threads = threads.filter((t) => t.status === status);
    } else {
      threads = threads.filter((t) => t.studentEmail === email);
      if (moduleId) threads = threads.filter((t) => t.moduleId === moduleId);
    }

    threads = threads
      .slice()
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));

    return res.json({
      isAdmin: admin,
      threads: threads.map(publicThread),
    });
  });

  // Créer une question (élève)
  router.post("/api/module-qa", requireAuth, (req, res) => {
    const email = sessionEmail(req);
    const admin = isAdminEmail(email);
    if (!admin && !isSubscribed(req)) {
      return res.status(403).json({ error: "Premium requis" });
    }

    const moduleId = clip(req.body?.moduleId, 80);
    const question = clip(req.body?.question, 4000);
    if (!moduleId) return res.status(400).json({ error: "moduleId requis" });
    if (question.length < 5) return res.status(400).json({ error: "Question trop courte" });

    const now = new Date().toISOString();
    const thread = {
      id: newId("qa_"),
      moduleId,
      studentEmail: admin && req.body?.studentEmail ? normalizeEmail(req.body.studentEmail) : email,
      studentName: admin && req.body?.studentName ? clip(req.body.studentName, 120) : sessionName(req),
      question,
      status: "open",
      messages: [
        {
          id: newId("msg_"),
          by: email,
          role: admin ? "admin" : "student",
          body: question,
          at: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    const store = readStore();
    store.threads.push(thread);
    writeStore(store);
    return res.status(201).json({ thread: publicThread(thread) });
  });

  // Détail
  router.get("/api/module-qa/:id", requireAuth, (req, res) => {
    const email = sessionEmail(req);
    const admin = isAdminEmail(email);
    if (!admin && !isSubscribed(req)) {
      return res.status(403).json({ error: "Premium requis" });
    }
    const thread = readStore().threads.find((t) => t.id === req.params.id);
    if (!thread) return res.status(404).json({ error: "Introuvable" });
    if (!admin && thread.studentEmail !== email) {
      return res.status(403).json({ error: "Accès refusé" });
    }
    return res.json({ isAdmin: admin, thread: publicThread(thread) });
  });

  // Répondre (élève ou admin)
  router.post("/api/module-qa/:id/reply", requireAuth, (req, res) => {
    const email = sessionEmail(req);
    const admin = isAdminEmail(email);
    if (!admin && !isSubscribed(req)) {
      return res.status(403).json({ error: "Premium requis" });
    }

    const body = clip(req.body?.body, 4000);
    if (body.length < 1) return res.status(400).json({ error: "Message vide" });

    const store = readStore();
    const idx = store.threads.findIndex((t) => t.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: "Introuvable" });

    const thread = store.threads[idx];
    if (!admin && thread.studentEmail !== email) {
      return res.status(403).json({ error: "Accès refusé" });
    }
    if (thread.status === "closed" && !admin) {
      return res.status(400).json({ error: "Conversation clôturée" });
    }

    const now = new Date().toISOString();
    if (!Array.isArray(thread.messages)) thread.messages = [];
    thread.messages.push({
      id: newId("msg_"),
      by: email,
      role: admin ? "admin" : "student",
      body,
      at: now,
    });
    thread.updatedAt = now;
    if (admin) thread.status = "answered";
    else if (thread.status === "answered") thread.status = "open";

    store.threads[idx] = thread;
    writeStore(store);
    return res.json({ thread: publicThread(thread) });
  });

  // Statut (admin)
  router.patch("/api/module-qa/:id", requireAuth, (req, res) => {
    const email = sessionEmail(req);
    if (!isAdminEmail(email)) return res.status(403).json({ error: "Admin uniquement" });

    const status = clip(req.body?.status, 40);
    if (!["open", "answered", "closed"].includes(status)) {
      return res.status(400).json({ error: "Statut invalide" });
    }

    const store = readStore();
    const idx = store.threads.findIndex((t) => t.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: "Introuvable" });

    store.threads[idx].status = status;
    store.threads[idx].updatedAt = new Date().toISOString();
    writeStore(store);
    return res.json({ thread: publicThread(store.threads[idx]) });
  });

  return router;
};
