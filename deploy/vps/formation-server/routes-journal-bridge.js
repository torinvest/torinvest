/**
 * Pont La Forge Premium → Trading Journal Pro (PHP sur radar).
 * Proxy same-origin /journal-embed + SSO forge_sso (plus auto-login env en secours).
 */
"use strict";

const express = require("express");
const { generateBridgeToken } = require("./fondamental-bridge-lib");

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

function bridgeSecret() {
  return String(
    process.env.FORGE_JOURNAL_BRIDGE_SECRET ||
      process.env.FORGE_FONDAMENTAL_BRIDGE_SECRET ||
      process.env.AI_ACCESS_HMAC_SECRET ||
      ""
  );
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

function looksLikeLoginPage(html) {
  const h = String(html || "");
  return (
    /name=["']login_action["']/i.test(h) ||
    (/Trading Journal Pro/i.test(h) && /name=["']password["']/i.test(h) && /name=["']username["']/i.test(h))
  );
}

function rewriteJournalHtml(html) {
  let out = String(html);
  out = out.replace(
    /(<form[^>]*\saction=["'])\/?trading_journal\.php(["'][^>]*>)/gi,
    "$1/journal-embed/$2"
  );
  out = out.replace(/(<form)([^>]*>)/gi, (full, open, rest) => {
    if (/\saction=/i.test(rest)) return full;
    return open + ' action="/journal-embed/"' + rest;
  });
  out = out.replace(/href=(["'])\/?trading_journal\.php\1/gi, 'href="/journal-embed/"');
  return out;
}

function makeSsoToken(email) {
  const secret = bridgeSecret();
  if (!secret || !email) return null;
  const crypto = require("crypto");
  const expiresAt = Math.floor(Date.now() / 1000) + 600;
  const payload = JSON.stringify({
    exp: expiresAt,
    nonce: crypto.randomBytes(12).toString("hex"),
    role: "client",
    meta: {
      source: "forge_journal_sso",
      email: String(email || "").trim(),
    },
  });
  const b64 = Buffer.from(payload)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  const sig = crypto.createHmac("sha256", secret).update(b64).digest("hex");
  return `${b64}.${sig}`;
}

async function requirePremium(req) {
  let user = premiumUser(req);
  if (!user) user = await premiumUserViaMe(req);
  return user;
}

function storePhpSess(req, res, newSess) {
  if (!newSess) return;
  if (req.session) req.session.tjPhpSessid = newSess;
  res.cookie(PHPSESS_COOKIE, newSess, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 12 * 60 * 60 * 1000,
    path: "/",
  });
}

async function upstreamFetch(target, method, headers, body) {
  const upstream = await fetch(target, {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : body,
    redirect: "manual",
    signal: AbortSignal.timeout(60000),
  });
  let newSess = null;
  if (typeof upstream.headers.getSetCookie === "function") {
    newSess = parsePhpSessid(upstream.headers.getSetCookie());
  }
  if (!newSess) newSess = parsePhpSessid(upstream.headers.get("set-cookie"));
  const buf = Buffer.from(await upstream.arrayBuffer());
  const ctype = String(upstream.headers.get("content-type") || "text/html; charset=utf-8");
  return { upstream, newSess, buf, ctype };
}

async function tryEnvAutoLogin(target, baseHeaders, phpSess) {
  const user = String(process.env.FORGE_JOURNAL_USER || process.env.TJ_USER || "").trim();
  const pass = String(process.env.FORGE_JOURNAL_PASSWORD || process.env.TJ_PASSWORD || "");
  if (!user || !pass) return null;

  const headers = { ...baseHeaders };
  headers["Content-Type"] = "application/x-www-form-urlencoded";
  if (phpSess) headers.Cookie = "PHPSESSID=" + phpSess;

  const body = new URLSearchParams({
    login_action: "1",
    username: user,
    password: pass,
  }).toString();

  return upstreamFetch(target, "POST", headers, body);
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
    let target = radar + phpPath;

    let phpSess =
      (req.session && req.session.tjPhpSessid) || readReqCookie(req, PHPSESS_COOKIE) || "";

    const method = (req.method || "GET").toUpperCase();
    const upstreamHeaders = radarFetchHeaders(radar, {
      Accept: req.headers.accept || "text/html,application/xhtml+xml,*/*",
      "User-Agent": req.headers["user-agent"] || "TorInvest-Journal-Proxy",
    });

    const sso = makeSsoToken(user.email);
    if (sso) {
      upstreamHeaders["X-Forge-Journal-Sso"] = sso;
      if (method === "GET" || method === "HEAD") {
        const u = new URL(target);
        u.searchParams.set("forge_sso", sso);
        target = u.toString();
      }
    }

    if (phpSess) {
      upstreamHeaders.Cookie = "PHPSESSID=" + phpSess;
    }

    let body;
    if (method === "POST" || method === "PUT" || method === "PATCH") {
      const ctype = String(req.headers["content-type"] || "");
      upstreamHeaders["Content-Type"] = ctype || "application/x-www-form-urlencoded";
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
      let result = await upstreamFetch(target, method, upstreamHeaders, body);
      storePhpSess(req, res, result.newSess);
      if (result.newSess) phpSess = result.newSess;

      if (result.upstream.status >= 300 && result.upstream.status < 400) {
        const loc = result.upstream.headers.get("location") || "";
        if (/trading_journal\.php/i.test(loc) || loc === "/" || loc === phpPath) {
          res.redirect(302, "/journal-embed/");
          return;
        }
      }

      let html =
        result.ctype.includes("text/html") ? result.buf.toString("utf8") : null;

      // SSO pas encore patché côté PHP → auto-login admin via env (une fois)
      if (
        html &&
        looksLikeLoginPage(html) &&
        method === "GET" &&
        !req.session?.tjAutoLoginTried
      ) {
        if (req.session) req.session.tjAutoLoginTried = true;
        const auto = await tryEnvAutoLogin(radar + phpPath, upstreamHeaders, phpSess);
        if (auto) {
          storePhpSess(req, res, auto.newSess);
          result = auto;
          html = auto.ctype.includes("text/html") ? auto.buf.toString("utf8") : null;
        }
      }

      res.status(result.upstream.status);
      res.setHeader("Content-Type", result.ctype);
      res.setHeader("Cache-Control", "private, no-store");

      if (html != null) {
        return res.send(rewriteJournalHtml(html));
      }
      return res.send(result.buf);
    } catch (e) {
      return res
        .status(502)
        .send("Proxy Trading Journal indisponible : " + String(e.message || e));
    }
  };
}

module.exports = function createJournalBridgeRouter(options) {
  const router = express.Router();
  const proxy = createPhpProxy();

  router.use(["/journal-embed", "/appjournal"], express.urlencoded({ extended: true }));
  router.use(["/journal-embed", "/appjournal"], express.json());

  router.get("/api/journal-bridge/ping", (req, res) => {
    res.json({
      ok: true,
      mounted: true,
      app: "trading_journal_pro",
      upstream: radarBaseUrl() + journalPhpPath(),
      sso: !!bridgeSecret(),
      autoLoginEnv: !!(
        process.env.FORGE_JOURNAL_PASSWORD || process.env.TJ_PASSWORD
      ),
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
      note: "sso_or_proxy",
    });
  });

  router.all("/journal-embed", proxy);
  router.all("/journal-embed/", proxy);
  router.all("/appjournal", proxy);
  router.all("/appjournal/", proxy);

  return router;
};
