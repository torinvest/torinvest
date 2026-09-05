/**
 * Pont La Forge Premium → USA War Atlas (SPA Vite + API Express).
 *
 * Embed : /atlas-embed/ et /appliatlas/
 * Statique : FORGE_ATLAS_APP_DIR (build apps/web/dist)
 * API     : proxy …/api/* → FORGE_ATLAS_API_URL (défaut http://127.0.0.1:3001)
 */
"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");

const MOUNTS = ["/atlas-embed", "/appliatlas"];

function atlasAppDir() {
  const fromEnv = String(process.env.FORGE_ATLAS_APP_DIR || "").trim();
  if (fromEnv) return fromEnv;
  return "/var/lib/torinvest/appliatlas";
}

function atlasApiBase() {
  return String(process.env.FORGE_ATLAS_API_URL || "http://127.0.0.1:3001").replace(
    /\/$/,
    ""
  );
}

function isPremiumSessionUser(user) {
  if (!user?.email) return false;
  if (user.subscribed === true || user.subscribed === 1 || user.subscribed === "true") {
    return true;
  }
  const plan = String(user.plan || "").toLowerCase();
  return plan === "premium" || plan === "subscribed";
}

function premiumUser(req) {
  const s = req.session;
  if (!s) return null;
  const user = s.user || req.user;
  if (isPremiumSessionUser(user)) return user;
  const email = String(user?.email || s.email || "").trim();
  if (!email) return null;
  const synthetic = {
    email,
    subscribed: user?.subscribed ?? s.subscribed,
    plan: user?.plan ?? s.plan,
    name: user?.name ?? s.name,
  };
  return isPremiumSessionUser(synthetic) ? synthetic : null;
}

async function premiumUserViaMe(req) {
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
    if (isPremiumSessionUser(me)) return me;
  } catch (_) {
    /* ignore */
  }
  return null;
}

async function requirePremium(req) {
  let user = premiumUser(req);
  if (!user) user = await premiumUserViaMe(req);
  return user;
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".map": "application/json",
    ".ico": "image/x-icon",
  };
  return map[ext] || "application/octet-stream";
}

function safeJoin(root, rel) {
  const rootReal = path.resolve(root);
  const target = path.resolve(rootReal, rel);
  if (!target.startsWith(rootReal + path.sep) && target !== rootReal) {
    return null;
  }
  return target;
}

function stripMount(urlPath) {
  const raw = String(urlPath || "");
  const q = raw.indexOf("?");
  const pathname = q >= 0 ? raw.slice(0, q) : raw;
  const query = q >= 0 ? raw.slice(q) : "";
  for (const mount of MOUNTS) {
    if (pathname === mount || pathname === mount + "/") {
      return { rel: "", query };
    }
    if (pathname.startsWith(mount + "/")) {
      return { rel: pathname.slice(mount.length + 1), query };
    }
  }
  return null;
}

function proxyToAtlasApi(req, res, apiPathWithQuery) {
  const base = atlasApiBase();
  let target;
  try {
    target = new URL(
      apiPathWithQuery.startsWith("/") ? apiPathWithQuery : "/" + apiPathWithQuery,
      base + "/"
    );
  } catch (_) {
    return res.status(502).json({ ok: false, error: "atlas_api_bad_url" });
  }

  const lib = target.protocol === "https:" ? https : http;
  const headers = { ...req.headers };
  delete headers.host;
  delete headers["content-length"];
  headers.host = target.host;
  headers["x-forwarded-proto"] = "https";
  headers["x-forge-atlas"] = "1";

  const upstream = lib.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === "https:" ? 443 : 80),
      path: target.pathname + target.search,
      method: req.method,
      headers,
      timeout: 30000,
    },
    (upRes) => {
      res.status(upRes.statusCode || 502);
      for (const [k, v] of Object.entries(upRes.headers || {})) {
        if (!v) continue;
        const key = String(k).toLowerCase();
        if (key === "transfer-encoding" || key === "connection") continue;
        res.setHeader(k, v);
      }
      upRes.pipe(res);
    }
  );

  upstream.on("error", (err) => {
    if (!res.headersSent) {
      res.status(502).json({
        ok: false,
        error: "atlas_api_unreachable",
        detail: String(err.message || err),
        hint: "Démarrer l’API Atlas (PM2) sur " + base,
      });
    }
  });

  if (req.method === "GET" || req.method === "HEAD") {
    upstream.end();
  } else if (Buffer.isBuffer(req.body) || typeof req.body === "string") {
    upstream.end(req.body);
  } else if (req.body && typeof req.body === "object") {
    const raw = JSON.stringify(req.body);
    upstream.setHeader("content-type", "application/json");
    upstream.end(raw);
  } else {
    req.pipe(upstream);
  }
}

function denyHtml(res) {
  return res
    .status(403)
    .send(
      '<!doctype html><html lang="fr"><body style="font-family:sans-serif;background:#0a0c12;color:#eee;padding:2rem">' +
        "<p>USA War Atlas — réservé aux abonnés <strong>La Forge Premium</strong>.</p>" +
        '<p><a href="/atlas.html" style="color:#ffd700">Ouvrir le hub Atlas</a> · ' +
        '<a href="/login.html?next=%2Fatlas.html" style="color:#ffd700">Connexion</a></p>' +
        "</body></html>"
    );
}

function createAtlasBridgeRouter() {
  const router = express.Router();

  router.get("/api/atlas-bridge/ping", (_req, res) => {
    const dir = atlasAppDir();
    let hasIndex = false;
    try {
      hasIndex = fs.existsSync(path.join(dir, "index.html"));
    } catch (_) {
      hasIndex = false;
    }
    res.json({
      ok: true,
      mounted: true,
      app: "usa_war_atlas",
      appDir: dir,
      hasIndex,
      api: atlasApiBase(),
      access: "forge_premium",
    });
  });

  router.get("/api/atlas-bridge/status", async (req, res) => {
    const user = await requirePremium(req);
    if (!user?.email) {
      return res.json({ ok: false, active: false, premium: false });
    }
    return res.json({
      ok: true,
      active: true,
      premium: true,
      email: user.email,
      embed: "/atlas-embed/",
    });
  });

  router.post("/api/atlas-bridge/activate", async (req, res) => {
    const user = await requirePremium(req);
    if (!user?.email) {
      return res.status(403).json({ ok: false, error: "premium_required" });
    }
    return res.json({ ok: true, email: user.email, embed: "/atlas-embed/" });
  });

  async function gateAndServe(req, res, next) {
    const user = await requirePremium(req);
    if (!user?.email) {
      if (req.accepts("html")) return denyHtml(res);
      return res.status(403).json({ ok: false, error: "premium_required" });
    }

    const stripped = stripMount(req.originalUrl || req.url);
    if (!stripped) return next();

    if (stripped.rel === "api" || stripped.rel.startsWith("api/")) {
      return proxyToAtlasApi(req, res, "/" + stripped.rel + stripped.query);
    }

    const root = atlasAppDir();
    let rel = stripped.rel || "index.html";
    if (rel.endsWith("/")) rel += "index.html";

    let filePath = safeJoin(root, rel);
    if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = safeJoin(root, "index.html");
    }
    if (!filePath || !fs.existsSync(filePath)) {
      return res
        .status(503)
        .send(
          "USA War Atlas non déployé (index.html manquant dans " +
            root +
            "). Voir deploy/vps/ATLAS-PRIVATE.md"
        );
    }

    res.setHeader("Content-Type", contentTypeFor(filePath));
    res.setHeader(
      "Cache-Control",
      path.basename(filePath) === "index.html" ? "private, no-store" : "public, max-age=3600"
    );
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    fs.createReadStream(filePath).pipe(res);
  }

  router.use(MOUNTS, (req, res, next) => {
    if (req.method === "GET" || req.method === "HEAD") return next();
    if (req._body === true || Buffer.isBuffer(req.body) || typeof req.body === "string") {
      return next();
    }
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      req.body = Buffer.concat(chunks);
      next();
    });
    req.on("error", next);
  });

  for (const mount of MOUNTS) {
    router.all(mount, gateAndServe);
    router.all(mount + "/", gateAndServe);
    router.all(mount + "/*", gateAndServe);
  }

  return router;
}

module.exports = createAtlasBridgeRouter;
