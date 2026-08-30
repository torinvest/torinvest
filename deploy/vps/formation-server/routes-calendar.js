/**
 * Route Express /api/calendar — à monter sur torinvest-formation (VPS).
 *
 * Usage (server.js) :
 *   const createCalendarRouter = require("./server-patches/routes-calendar");
 *   app.use(createCalendarRouter({ dataDir: "/home/ubuntu/torinvest-formation/data", requireAuth }));
 */
const express = require("express");
const fs = require("fs");
const path = require("path");

function safeEmailFile(email) {
  return String(email || "guest").replace(/[^a-z0-9@._-]/gi, "_");
}

module.exports = function createCalendarRouter(options) {
  const dataDir = options.dataDir || path.join(__dirname, "..", "data");
  const calendarDir = path.join(dataDir, "calendar");
  const requireAuth = options.requireAuth;

  if (!requireAuth) {
    throw new Error("createCalendarRouter requires requireAuth middleware");
  }

  fs.mkdirSync(calendarDir, { recursive: true });

  const router = express.Router();

  function filePath(email) {
    return path.join(calendarDir, safeEmailFile(email) + ".json");
  }

  function readPayload(email) {
    try {
      const raw = fs.readFileSync(filePath(email), "utf8");
      const parsed = JSON.parse(raw);
      return {
        days: parsed.days || {},
        meta: parsed.meta || {},
        updated: parsed.updated || null,
      };
    } catch {
      return { days: {}, meta: {}, updated: null };
    }
  }

  function writePayload(email, days, meta) {
    const payload = {
      days: days || {},
      meta: meta || {},
      updated: new Date().toISOString(),
    };
    fs.writeFileSync(filePath(email), JSON.stringify(payload, null, 2));
    return payload;
  }

  router.get("/api/calendar", requireAuth, (req, res) => {
    const email = req.session?.user?.email || req.user?.email;
    if (!email) return res.status(401).json({ error: "Non authentifié" });
    const data = readPayload(email);
    res.json({ days: data.days, meta: data.meta, updated: data.updated });
  });

  router.put("/api/calendar", requireAuth, (req, res) => {
    const email = req.session?.user?.email || req.user?.email;
    if (!email) return res.status(401).json({ error: "Non authentifié" });
    const days = req.body?.days;
    if (!days || typeof days !== "object") {
      return res.status(400).json({ error: "Body days requis" });
    }
    const meta = req.body?.meta && typeof req.body.meta === "object" ? req.body.meta : {};
    const saved = writePayload(email, days, meta);
    res.json({ ok: true, updated: saved.updated });
  });

  return router;
};
