/**
 * Route Express /api/progress — à monter sur torinvest-formation (VPS).
 *
 * Usage (server.js) :
 *   const createProgressRouter = require("./server-patches/routes-progress");
 *   app.use(createProgressRouter({ dataDir: "/home/ubuntu/torinvest-formation/data", requireAuth }));
 */
const express = require("express");
const fs = require("fs");
const path = require("path");

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
      return parsed.modules || parsed;
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
    const modules = req.body?.modules;
    if (!modules || typeof modules !== "object") {
      return res.status(400).json({ error: "Body modules requis" });
    }
    writeModules(email, modules);
    res.json({ ok: true });
  });

  return router;
};
