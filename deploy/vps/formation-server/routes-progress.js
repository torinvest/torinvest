/**
 * Route Express /api/progress — à monter sur torinvest-formation (VPS).
 * completed recalculé côté serveur (anti-forge unlock).
 */
const express = require("express");
const fs = require("fs");
const path = require("path");
const rules = require("./forge-progress-rules");
const moduleOrder = require("./course-module-order.json");

const ALLOWED_IDS = moduleOrder.map((m) => m.id);

function safeEmailFile(email) {
  return String(email || "guest").replace(/[^a-z0-9@._-]/gi, "_");
}

module.exports = function createProgressRouter(options) {
  const dataDir = options.dataDir || path.join(__dirname, "..", "data");
  const progressDir = path.join(dataDir, "progress");
  const requireAuth = options.requireAuth;

  if (!requireAuth) {
    throw new Error("createProgressRouter requires requireAuth middleware");
  }

  fs.mkdirSync(progressDir, { recursive: true });

  const router = express.Router();

  function filePath(email) {
    return path.join(progressDir, safeEmailFile(email) + ".json");
  }

  function readModules(email) {
    try {
      const raw = fs.readFileSync(filePath(email), "utf8");
      const parsed = JSON.parse(raw);
      const modules = parsed.modules || parsed;
      return rules.sanitizeModulesPayload(modules, {}, ALLOWED_IDS);
    } catch {
      return {};
    }
  }

  function writeModules(email, modules) {
    const payload = {
      modules,
      updated: new Date().toISOString(),
    };
    fs.writeFileSync(filePath(email), JSON.stringify(payload, null, 2));
  }

  router.get("/api/progress", requireAuth, (req, res) => {
    const email = req.session?.user?.email || req.user?.email;
    if (!email) return res.status(401).json({ error: "Non authentifié" });
    res.json({ modules: readModules(email) });
  });

  router.put("/api/progress", requireAuth, (req, res) => {
    const email = req.session?.user?.email || req.user?.email;
    if (!email) return res.status(401).json({ error: "Non authentifié" });
    if (!req.session?.user?.subscribed) {
      return res.status(403).json({ error: "Premium requis" });
    }
    const modules = req.body?.modules;
    if (!modules || typeof modules !== "object") {
      return res.status(400).json({ error: "Body modules requis" });
    }
    const existing = readModules(email);
    const sanitized = rules.sanitizeModulesPayload(modules, existing, ALLOWED_IDS);
    writeModules(email, sanitized);
    res.json({ ok: true, modules: sanitized });
  });

  return router;
};
