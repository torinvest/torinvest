/**
 * Login formation La Forge — abonnement accompagnement (≠ compte membre site www).
 * - Email + mot de passe (provisionné après paiement Stripe)
 * - Email + clé TOR-ACCOMPAGNEMENT (champ mot de passe)
 * Monte AVANT le handler /api/login natif du VPS (délègue via next() si besoin).
 */
"use strict";

const express = require("express");
const users = require("./formation-users-lib");
const worker = require("./accompagnement-worker-lib");

function sessionUser(email, subscribed) {
  return {
    email: users.normalizeEmail(email),
    subscribed: !!subscribed,
  };
}

function demoAccounts() {
  return [
    {
      email: users.normalizeEmail(
        process.env.DEMO_SUBSCRIBER_EMAIL || "abonne@torinvest-trading.com"
      ),
      password: String(process.env.DEMO_SUBSCRIBER_PASSWORD || "Forge2026!"),
      subscribed: true,
    },
    {
      email: users.normalizeEmail(
        process.env.DEMO_FREE_EMAIL || "visiteur@torinvest-trading.com"
      ),
      password: String(process.env.DEMO_FREE_PASSWORD || "Visiteur2026!"),
      subscribed: false,
    },
  ];
}

function matchDemoLogin(email, password) {
  for (const demo of demoAccounts()) {
    if (email === demo.email && password === demo.password) {
      return demo;
    }
  }
  return null;
}

function mePayload(user) {
  const subscribed = !!user?.subscribed;
  return {
    email: user.email,
    subscribed,
    name: user.name || (subscribed ? "Membre Premium" : "Visiteur"),
    plan: subscribed ? "premium" : "free",
  };
}

function finishLogin(req, res, next, fields) {
  const user = req.session?.user;
  if (!user?.email) {
    return next(new Error("session_user_missing"));
  }
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

  router.get("/api/me", (req, res, next) => {
    if (!req.session?.user?.email) {
      return next();
    }
    const me = mePayload(req.session.user);
    return res.json({ ok: true, user: me, ...me });
  });

  router.post("/api/login", async (req, res, next) => {
    if (!req.session) {
      return next();
    }

    const email = users.normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");
    if (!email || !password) {
      return res.status(400).json({ error: "Email et mot de passe requis" });
    }

    const store = users.readStore(dataDir);
    const existing = users.findUser(store, email);
    const hash = existing ? users.passwordHashFromUser(existing) : "";

    if (hash && (await users.verifyPassword(hash, password))) {
      req.session.user = sessionUser(email, existing.subscribed);
      return finishLogin(req, res, next, { via: "password" });
    }

    const lic = await worker.validateAccompagnementLicense(workerUrl, email, password);
    if (lic.ok) {
      users.upsertUser(dataDir, email, { subscribed: true });
      req.session.user = sessionUser(email, true);
      return finishLogin(req, res, next, { via: "accompagnement_license" });
    }

    const demo = matchDemoLogin(email, password);
    if (demo) {
      req.session.user = sessionUser(email, demo.subscribed);
      return finishLogin(req, res, next, { via: "demo" });
    }

    return next();
  });

  router.post("/api/internal/formation-provision", async (req, res) => {
    const headerKey = String(req.headers["x-formation-provision-key"] || "");
    if (!provisionSecret || headerKey !== provisionSecret) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    const email = users.normalizeEmail(req.body?.email);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ ok: false, error: "email_invalid" });
    }

    const subscribed = req.body?.subscribed !== false;
    let plainPassword = String(req.body?.password || "").trim();
    const generated = !plainPassword;
    if (generated) {
      plainPassword = users.generatePassword();
    }

    const passwordHash = await users.hashPassword(plainPassword);
    users.upsertUser(dataDir, email, {
      passwordHash,
      subscribed,
    });

    const body = {
      ok: true,
      email,
      subscribed,
      generated,
    };
    if (generated) {
      body.password = plainPassword;
    }
    return res.json(body);
  });

  return router;
}

module.exports = createFormationAuthRouter;
