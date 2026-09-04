/**
 * Pont La Forge Premium → Trading Journal Pro (PHP sur radar).
 * Proxy same-origin /journal-embed → https://radar…/trading_journal.php
 * (évite le CSP Helmet frame-src qui bloque les iframes cross-origin)
 */
"use strict";

const express = require("express");

function radarBaseUrl() {
  const explicit = String(
    process.env.FORGE_JOURNAL_RADAR_URL ||
      process.env.FORGE_FONDAMENTAL_RADAR_URL ||
      process.env.FORGE_RADAR_URL ||
      ""
  ).replace(/\/$/, "");
  if (explicit) return explicit;
  return "https://radar.torinvest-trading.com";
}

function journalPhpPath() {
  return String(process.env.FORGE_JOURNAL_PHP_PATH || "/trading_journal.php");
}

function radarHostHeader(baseUrl) {
  try {
    const u = new URL(baseUrl);
    if (u.hostname === "127.0.0.1" || u.hostname === "localhost") {
      return process.env.FORGE_JOURNAL_RADAR_HOST || "radar.torinvest-trading.com";
    }
    return u.hostname;
  } catch (_) {
    return "radar.torinvest-trading.com";
  }
}

function radarFetchHeaders(baseUrl, extra) {
  const headers = { ...(extra || {}) };
  const host = radarHostHeader(baseUrl);
  if (host) headers.Host = host;
  return headers;
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
  if (isPremiumSessionUser(synthetic)) return synthetic;
  return null;
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

const PHPSESS_COOKIE = "forge_tj_phpsessid";

function readReqCookie(req, name) {
  const raw = String(req.headers.cookie || "");
  const re = new RegExp(
    "(?:^|;\\s*)" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)"
  );
  const m = raw.match(re);
  return m ? decodeURIComponent(m[1]) : null;
}

function parsePhpSessid(setCookieHeaders) {
  const list = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  for (const raw of list) {
    if (!raw) continue;
    const m = String(raw).match(/PHPSESSID=([^;]+)/i);
    if (m) return m[1];
  }
  return null;
}

function rewriteJournalHtml(html) {
  let out = String(html);
  // Garder les POST dans le proxy same-origin
  out = out.replace(
    /(<form[^>]*\saction=["'])\/?trading_journal\.php(["'][^>]*>)/gi,
    "$1/journal-embed/$2"
  );
  out = out.replace(/(<form)([^>]*>)/gi, (full, open, rest) => {
    if (/\saction=/i.test(rest)) return full;
    return open + ' action="/journal-embed/"' + rest;
  });
  // Liens relatifs éventuels
  out = out.replace(
    /href=(["'])\/?trading_journal\.php\1/gi,
    'href="/journal-embed/"'
  );
  return out;
}

async function requirePremium(req) {
  let user = premiumUser(req);
  if (!user) user = await premiumUserViaMe(req);
  return user;
}

function createPhpProxy() {
  return async function phpProxy(req, res) {
    const user = await requirePremium(req);
    if (!user?.email) {
      res.status(403);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(
        "<!doctype html><html lang=fr><body style='font-family:system-ui;padding:2rem'>" +
          "<p>Session La Forge Premium requise.</p>" +
          "<p><a href='/login.html?next=%2Fjournal.html'>Connexion</a></p>" +
          "</body></html>"
      );
    }

    const radar = radarBaseUrl();
    const phpPath = journalPhpPath();
    const target = radar + phpPath;

    const phpSess =
      (req.session && req.session.tjPhpSessid) || readReqCookie(req, PHPSESS_COOKIE) || "";

    const method = (req.method || "GET").toUpperCase();
    const upstreamHeaders = radarFetchHeaders(radar, {
      Accept: req.headers.accept || "text/html,application/xhtml+xml,*/*",
      "User-Agent": req.headers["user-agent"] || "TorInvest-Journal-Proxy",
    });
    if (phpSess) {
      upstreamHeaders.Cookie = "PHPSESSID=" + phpSess;
    }

    let body;
    if (method === "POST" || method === "PUT" || method === "PATCH") {
      const ctype = String(req.headers["content-type"] || "");
      upstreamHeaders["Content-Type"] = ctype || "application/x-www-form-urlencoded";
      if (req.readable && !req.readableEnded && req.body == null) {
        // raw body via express may already be parsed; fall back
        body = undefined;
      }
      if (Buffer.isBuffer(req.body)) {
        body = req.body;
      } else if (typeof req.body === "string") {
        body = req.body;
      } else if (req.body && typeof req.body === "object") {
        if (ctype.includes("application/json")) {
          body = JSON.stringify(req.body);
        } else {
          body = new URLSearchParams(
            Object.entries(req.body).map(([k, v]) => [k, v == null ? "" : String(v)])
          ).toString();
          upstreamHeaders["Content-Type"] = "application/x-www-form-urlencoded";
        }
      }
    }

    try {
      const upstream = await fetch(target, {
        method,
        headers: upstreamHeaders,
        body: method === "GET" || method === "HEAD" ? undefined : body,
        redirect: "manual",
        signal: AbortSignal.timeout(60000),
      });

      let newSess = null;
      if (typeof upstream.headers.getSetCookie === "function") {
        newSess = parsePhpSessid(upstream.headers.getSetCookie());
      }
      if (!newSess) {
        newSess = parsePhpSessid(upstream.headers.get("set-cookie"));
      }
      if (newSess) {
        if (req.session) req.session.tjPhpSessid = newSess;
        res.cookie(PHPSESS_COOKIE, newSess, {
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          maxAge: 12 * 60 * 60 * 1000,
          path: "/",
        });
      }

      // Follow one redirect to same journal if needed
      if (upstream.status >= 300 && upstream.status < 400) {
        const loc = upstream.headers.get("location") || "";
        if (/trading_journal\.php/i.test(loc) || loc === "/" || loc === phpPath) {
          res.redirect(302, "/journal-embed/");
          return;
        }
      }

      res.status(upstream.status);
      const ctype = String(upstream.headers.get("content-type") || "text/html; charset=utf-8");
      res.setHeader("Content-Type", ctype);
      res.setHeader("Cache-Control", "private, no-store");

      const buf = Buffer.from(await upstream.arrayBuffer());
      if (ctype.includes("text/html")) {
        return res.send(rewriteJournalHtml(buf.toString("utf8")));
      }
      return res.send(buf);
    } catch (e) {
      return res
        .status(502)
        .send("Proxy Trading Journal indisponible : " + String(e.message || e));
    }
  };
}

module.exports = function createJournalBridgeRouter(options) {
  const opts = options || {};
  const router = express.Router();
  const proxy = createPhpProxy();

  // Body parser for journal POSTs (login form) — only on embed paths
  router.use(["/journal-embed", "/appjournal"], express.urlencoded({ extended: true }));
  router.use(["/journal-embed", "/appjournal"], express.json());

  router.get("/api/journal-bridge/ping", (req, res) => {
    res.json({
      ok: true,
      mounted: true,
      app: "trading_journal_pro",
      upstream: radarBaseUrl() + journalPhpPath(),
    });
  });

  router.get("/api/journal-bridge/status", async (req, res) => {
    const user = await requirePremium(req);
    if (!user?.email) {
      return res.json({ ok: false, active: false, premium: false });
    }
    return res.json({
      ok: true,
      active: true,
      premium: true,
      email: user.email,
      embed: "/journal-embed/",
    });
  });

  // Compat : plus besoin d'activate HMAC pour le PHP journal
  router.post("/api/journal-bridge/activate", async (req, res) => {
    const user = await requirePremium(req);
    if (!user?.email) {
      return res.status(403).json({
        ok: false,
        error: "premium_required",
        hint: "Connexion La Forge Premium requise pour le Trading Journal.",
      });
    }
    return res.json({
      ok: true,
      email: user.email,
      embed: "/journal-embed/",
      note: "proxy_php_radar",
    });
  });

  router.all("/journal-embed", proxy);
  router.all("/journal-embed/", proxy);
  router.all("/appjournal", proxy);
  router.all("/appjournal/", proxy);

  return router;
};
