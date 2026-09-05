/**
 * Sert les PDF bibliothèque La Forge (Premium only).
 * Fichiers hors Git : FORGE_BOOKS_DIR ou /var/lib/torinvest/books
 *
 * GET /api/books/ping
 * GET /api/books/list   (login)
 * GET /api/books/file?name=....pdf  (Premium)
 */
"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");

function booksDir() {
  const fromEnv = String(process.env.FORGE_BOOKS_DIR || "").trim();
  if (fromEnv) return fromEnv;
  return "/var/lib/torinvest/books";
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

function safePdfName(name) {
  const raw = String(name || "").trim();
  if (!raw || raw.includes("..") || raw.includes("/") || raw.includes("\\")) {
    return null;
  }
  if (!/\.pdf$/i.test(raw)) return null;
  if (!/^[a-zA-Z0-9._()\-\s]+\.pdf$/i.test(raw)) return null;
  return raw;
}

module.exports = function createBooksRouter() {
  const router = express.Router();

  router.get("/api/books/ping", (req, res) => {
    const dir = booksDir();
    let count = 0;
    let ready = false;
    try {
      if (fs.existsSync(dir)) {
        count = fs.readdirSync(dir).filter((f) => /\.pdf$/i.test(f)).length;
        ready = true;
      }
    } catch (_) {
      count = -1;
      ready = false;
    }
    // Ne pas exposer le chemin filesystem (audit)
    res.json({ ok: true, ready, pdfCount: count });
  });

  router.get("/api/books/list", async (req, res) => {
    const user = await resolveUser(req);
    if (!user) {
      return res.status(401).json({ ok: false, error: "login_required" });
    }
    const dir = booksDir();
    let files = [];
    try {
      files = fs.existsSync(dir)
        ? fs.readdirSync(dir).filter((f) => /\.pdf$/i.test(f)).sort()
        : [];
    } catch (e) {
      return res.status(500).json({ ok: false, error: String(e.message || e) });
    }
    return res.json({
      ok: true,
      premium: isPremiumUser(user),
      files,
      count: files.length,
    });
  });

  router.get("/api/books/file", async (req, res) => {
    const user = await resolveUser(req);
    if (!user) {
      return res.status(401).json({ ok: false, error: "login_required" });
    }
    if (!isPremiumUser(user)) {
      return res.status(403).json({ ok: false, error: "premium_required" });
    }

    const name = safePdfName(req.query.name);
    if (!name) {
      return res.status(400).json({ ok: false, error: "invalid_name" });
    }

    const dir = path.resolve(booksDir());
    const full = path.resolve(path.join(dir, name));
    if (!full.startsWith(dir + path.sep) && full !== dir) {
      return res.status(400).json({ ok: false, error: "invalid_path" });
    }
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
      return res.status(404).json({
        ok: false,
        error: "not_found",
        hint: "Dépose le PDF dans " + dir,
      });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'inline; filename="' + name.replace(/"/g, "") + '"'
    );
    res.setHeader("Cache-Control", "private, no-store");
    return fs.createReadStream(full).pipe(res);
  });

  return router;
};
