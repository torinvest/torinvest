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
      return res.json({
        ok: true,
        email: req.session.user.email,
        subscribed: req.session.user.subscribed,
      });
    }

    const lic = await worker.validateAccompagnementLicense(workerUrl, email, password);
    if (lic.ok) {
      users.upsertUser(dataDir, email, { subscribed: true });
      req.session.user = sessionUser(email, true);
      return res.json({
        ok: true,
        email: req.session.user.email,
        subscribed: true,
        via: "accompagnement_license",
      });
    }

    if (existing) {
      return res.status(401).json({ error: "Identifiants incorrects" });
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
