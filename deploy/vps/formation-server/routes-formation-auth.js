/**
 * Login formation La Forge — abonnement accompagnement (≠ compte membre site www).
 *
 * Flux PRINCIPAL (celui du produit) :
 *   email Stripe + clé TOR-ACCOMPAGNEMENT dans le champ mot de passe
 *
 * Correctifs audit :
 *   - email Worker lié à la clé (boundEmail)
 *   - rate-limit /api/login
 *   - démo sans mots de passe hardcodés
 *   - provision secret en timing-safe
 *
 * Monte AVANT le handler /api/login natif du VPS.
 */
"use strict";

const crypto = require("crypto");
const express = require("express");
const users = require("./formation-users-lib");
const worker = require("./accompagnement-worker-lib");
const createFondamentalBridgeRouter = require("./routes-fondamental-bridge");
const createJournalBridgeRouter = require("./routes-journal-bridge");
const createAtlasBridgeRouter = require("./routes-atlas-bridge");
const createBooksRouter = require("./routes-books");

function sessionUser(email, subscribed) {
  return {
    email: users.normalizeEmail(email),
    subscribed: !!subscribed,
  };
}

function timingSafeEqualString(a, b) {
  const left = Buffer.from(String(a || ""), "utf8");
  const right = Buffer.from(String(b || ""), "utf8");
  if (left.length !== right.length) return false;
  try {
    return crypto.timingSafeEqual(left, right);
  } catch (_) {
    return false;
  }
}

function createLoginRateLimiter(options) {
  const windowMs = Math.max(1000, Number(options && options.windowMs) || 15 * 60 * 1000);
  const max = Math.max(1, Number(options && options.max) || 20);
  const hits = new Map();

  function clientKey(req) {
    const xf = String(req.headers["x-forwarded-for"] || "")
      .split(",")[0]
      .trim();
    return xf || req.ip || (req.socket && req.socket.remoteAddress) || "unknown";
  }

  function prune(now) {
    if (hits.size < 500) return;
    for (const [key, entry] of hits.entries()) {
      if (now - entry.start >= windowMs) hits.delete(key);
    }
  }

  return function loginRateLimit(req, res, next) {
    const now = Date.now();
    const key = clientKey(req);
    prune(now);
    let entry = hits.get(key);
    if (!entry || now - entry.start >= windowMs) {
      entry = { start: now, count: 0 };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      const retrySec = Math.max(1, Math.ceil((windowMs - (now - entry.start)) / 1000));
      res.setHeader("Retry-After", String(retrySec));
      return res.status(429).json({
        error: "Trop de tentatives. Réessaie dans quelques minutes.",
        reason: "rate_limited",
      });
    }
    return next();
  };
}

/**
 * Comptes démo uniquement si FORGE_DEMO_ENABLED + email/mot de passe env (min 12 car).
 * Aucun default hardcodé.
 */
function demoAccounts() {
  const enabled =
    process.env.FORGE_DEMO_ENABLED === "1" ||
    process.env.FORGE_DEMO_ENABLED === "true";
  if (!enabled) return [];

  const out = [];
  const subEmail = users.normalizeEmail(process.env.DEMO_SUBSCRIBER_EMAIL || "");
  const subPass = String(process.env.DEMO_SUBSCRIBER_PASSWORD || "");
  if (subEmail && subPass.length >= 12) {
    out.push({ email: subEmail, password: subPass, subscribed: true });
  }

  const freeEmail = users.normalizeEmail(process.env.DEMO_FREE_EMAIL || "");
  const freePass = String(process.env.DEMO_FREE_PASSWORD || "");
  if (freeEmail && freePass.length >= 12) {
    out.push({ email: freeEmail, password: freePass, subscribed: false });
  }

  if (!out.length) {
    console.warn(
      "[auth] FORGE_DEMO_ENABLED but DEMO_*_EMAIL/PASSWORD missing or password < 12 chars — demo disabled"
    );
  }
  return out;
}

function matchDemoLogin(email, password) {
  for (const demo of demoAccounts()) {
    if (email === demo.email && password === demo.password) return demo;
  }
  return null;
}

function mePayload(user) {
  if (!user?.email) return null;
  const subscribed = !!user.subscribed;
  const email = String(user.email).trim().toLowerCase();
  const adminList = String(process.env.FORGE_ADMIN_EMAILS || "")
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const isAdmin = adminList.includes(email);
  return {
    email: user.email,
    subscribed,
    name: user.name || (subscribed ? "Membre Premium" : "Visiteur"),
    plan: subscribed ? "premium" : "free",
    isAdmin,
  };
}

function finishLogin(req, res, next, fields) {
  const user = req.session?.user;
  if (!user?.email) return next(new Error("session_user_missing"));
  const me = mePayload(user);
  const body = {
    ok: true,
    email: me.email,
    subscribed: me.subscribed,
    user: me,
  };
  if (fields?.via) body.via = fields.via;

  if (typeof req.session.save === "function") {
    return req.session.save((err) => {
      if (err) return next(err);
      return res.json(body);
    });
  }
  return res.json(body);
}

function licenseErrorMessage(reason) {
  switch (String(reason || "")) {
    case "worker_unreachable":
      return "Serveur licences injoignable. Réessaie dans une minute.";
    case "license_not_found":
    case "license_invalid":
    case "not_found":
    case "invalid_or_revoked":
      return "Clé TOR introuvable. Recopie la clé reçue par email (sans espace).";
    case "expired":
      return "Clé TOR expirée.";
    case "not_accompagnement_plan":
      return "Cette clé n'est pas une licence Accompagnement La Forge.";
    case "email_mismatch":
      return "Cette clé TOR est liée à un autre email. Utilise l'email Stripe du paiement.";
    case "email_required":
      return "Cette clé n'est pas encore liée à un email. Contacte le support.";
    case "missing_params":
      return "Email et clé TOR requis.";
    default:
      return (
        "Connexion refusée avec cette clé (" +
        (reason || "inconnue") +
        "). Utilise l'email Stripe + la clé TOR-ACCOMPAGNEMENT du mail."
      );
  }
}

function licenseHttpStatus(reason) {
  if (reason === "worker_unreachable") return 503;
  if (reason === "email_mismatch" || reason === "email_required") return 403;
  return 401;
}

function applyLicenseLogin(req, res, next, dataDir, lic, submittedEmail) {
  const sessionEmail = users.normalizeEmail(lic.boundEmail || submittedEmail);
  if (!sessionEmail) {
    return res.status(403).json({
      error: licenseErrorMessage("email_required"),
      reason: "email_required",
    });
  }
  users.upsertUser(dataDir, sessionEmail, { subscribed: true });
  req.session.user = sessionUser(sessionEmail, true);
  return finishLogin(req, res, next, {
    via: lic.via === "key_bound_email" ? "accompagnement_license_bound" : "accompagnement_license",
  });
}

function createFormationAuthRouter(options) {
  const dataDir = options.dataDir;
  const workerUrl =
    options.workerUrl ||
    process.env.FORGE_WORKER_URL ||
    process.env.WORKER_URL ||
    "https://morning-hall-d8f6.onzerimes.workers.dev";
  const provisionSecret = String(
    options.provisionSecret || process.env.FORGE_FORMATION_PROVISION_SECRET || ""
  );

  if (!dataDir) {
    throw new Error("createFormationAuthRouter requires dataDir");
  }

  const router = express.Router();
  const loginRateLimit = createLoginRateLimiter({
    windowMs: Number(process.env.FORGE_LOGIN_RATE_WINDOW_MS) || 15 * 60 * 1000,
    max: Number(process.env.FORGE_LOGIN_RATE_MAX) || 20,
  });

  router.use(
    createFondamentalBridgeRouter({
      bridgeSecret:
        process.env.FORGE_FONDAMENTAL_BRIDGE_SECRET || process.env.AI_ACCESS_HMAC_SECRET,
    })
  );

  router.use(
    createJournalBridgeRouter({
      bridgeSecret:
        process.env.FORGE_JOURNAL_BRIDGE_SECRET ||
        process.env.FORGE_FONDAMENTAL_BRIDGE_SECRET ||
        process.env.AI_ACCESS_HMAC_SECRET,
    })
  );

  router.use(createAtlasBridgeRouter());

  router.use(createBooksRouter());

  router.get("/api/accompagnement-auth/ping", (_req, res) => {
    res.json({
      ok: true,
      licenseLogin: true,
      hint: "Connexion = email Stripe + clé TOR-ACCOMPAGNEMENT (champ mot de passe)",
    });
  });

  router.get("/api/me", (req, res, next) => {
    if (!req.session?.user?.email) return next();
    const me = mePayload(req.session.user);
    if (!me) return next();
    return res.json({ ok: true, user: me, ...me });
  });

  router.post("/api/login", loginRateLimit, async (req, res, next) => {
    if (!req.session) return next();

    const email = users.normalizeEmail(req.body?.email);
    const rawPassword = String(req.body?.password || "");
    const password = worker.normalizeLicenseKey(rawPassword) || rawPassword.trim();
    if (!email || !password) {
      return res.status(400).json({ error: "Email et mot de passe requis" });
    }

    const isTorKey = worker.looksLikeTorLicense(password);

    // Chemin principal produit : clé TOR (email lié obligatoire côté Worker)
    if (isTorKey) {
      const lic = await worker.validateAccompagnementLicense(workerUrl, email, password);
      if (lic.ok) {
        return applyLicenseLogin(req, res, next, dataDir, lic, email);
      }
      return res.status(licenseHttpStatus(lic.reason)).json({
        error: licenseErrorMessage(lic.reason),
        reason: lic.reason || "license_invalid",
      });
    }

    // Mot de passe compte (si existe)
    const store = users.readStore(dataDir);
    const existing = users.findUser(store, email);
    const hash = existing ? users.passwordHashFromUser(existing) : "";
    if (hash && (await users.verifyPassword(hash, rawPassword))) {
      req.session.user = sessionUser(email, !!existing.subscribed);
      return finishLogin(req, res, next, { via: "password" });
    }

    // Dernière chance licence (clé sans préfixe TOR clair) — même binding email
    const lic = await worker.validateAccompagnementLicense(workerUrl, email, password);
    if (lic.ok) {
      return applyLicenseLogin(req, res, next, dataDir, lic, email);
    }

    const demo = matchDemoLogin(email, rawPassword);
    if (demo) {
      req.session.user = sessionUser(email, demo.subscribed);
      return finishLogin(req, res, next, { via: "demo" });
    }

    return next();
  });

  router.post("/api/internal/formation-provision", async (req, res) => {
    const headerKey = String(req.headers["x-formation-provision-key"] || "");
    if (!provisionSecret || !timingSafeEqualString(headerKey, provisionSecret)) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    const email = users.normalizeEmail(req.body?.email);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ ok: false, error: "email_invalid" });
    }

    const subscribed = req.body?.subscribed !== false;
    let plainPassword = String(req.body?.password || "").trim();
    const generated = !plainPassword;
    if (generated) plainPassword = users.generatePassword();

    const passwordHash = await users.hashPassword(plainPassword);
    users.upsertUser(dataDir, email, { passwordHash, subscribed });

    const body = { ok: true, email, subscribed, generated };
    if (generated) body.password = plainPassword;
    return res.json(body);
  });

  return router;
}

module.exports = createFormationAuthRouter;
