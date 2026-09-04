/**
 * Pont La Forge Premium → Trading Journal Pro (PHP radar).
 * Proxy same-origin robuste : query, POST body, redirects, rewrite HTML/JS.
 */
"use strict";

const express = require("express");
const crypto = require("crypto");

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

const PHPSESS_COOKIE = "forge_tj_phpsessid";
const EMBED_PATH = "/journal-embed/";

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
    (/Trading Journal Pro/i.test(h) &&
      /name=["']password["']/i.test(h) &&
      /name=["']username["']/i.test(h))
  );
}

function makeSsoToken(email) {
  const secret = bridgeSecret();
  if (!secret || !email) return null;
  const expiresAt = Math.floor(Date.now() / 1000) + 600;
  const payload = JSON.stringify({
    exp: expiresAt,
    nonce: crypto.randomBytes(12).toString("hex"),
    role: "client",
    meta: { source: "forge_journal_sso", email: String(email || "").trim() },
  });
  const b64 = Buffer.from(payload)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  const sig = crypto.createHmac("sha256", secret).update(b64).digest("hex");
  return `${b64}.${sig}`;
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

function clientQueryString(req) {
  const i = String(req.originalUrl || "").indexOf("?");
  if (i < 0) return "";
  return String(req.originalUrl).slice(i + 1);
}

function buildUpstreamUrl(req, ssoToken) {
  const u = new URL(radarBaseUrl() + journalPhpPath());
  const qs = clientQueryString(req);
  if (qs) {
    const extra = new URLSearchParams(qs);
    for (const [k, v] of extra.entries()) {
      if (k === "forge_sso") continue;
      u.searchParams.append(k, v);
    }
  }
  if (ssoToken) u.searchParams.set("forge_sso", ssoToken);
  return u.toString();
}

function mapRedirectToEmbed(location) {
  if (!location) return EMBED_PATH;
  const loc = String(location).trim();

  if (loc.startsWith("?")) {
    return "/journal-embed/" + loc;
  }

  try {
    const abs = new URL(loc, radarBaseUrl());
    const isJournal =
      /trading_journal\.php$/i.test(abs.pathname) ||
      abs.pathname === "/" ||
      abs.hostname.includes("radar.torinvest-trading.com");
    if (isJournal || /trading_journal\.php/i.test(loc)) {
      return "/journal-embed/" + (abs.search || "");
    }
  } catch (_) {
    /* ignore */
  }

  if (/trading_journal\.php/i.test(loc)) {
    const q = loc.includes("?") ? loc.slice(loc.indexOf("?")) : "";
    return "/journal-embed/" + q;
  }

  return null;
}

function injectProxyShim(html) {
  const shim = `<script>(function(){
  if (window.__tjForgeProxyShim) return; window.__tjForgeProxyShim = 1;
  var P = "/journal-embed/";
  function fix(u){
    if (!u || typeof u !== "string") return u;
    if (/^https?:\\/\\/radar\\.torinvest-trading\\.com\\/trading_journal\\.php/i.test(u)) {
      var q = u.indexOf("?"); return P + (q>=0 ? u.slice(q) : "");
    }
    if (/^\\/?trading_journal\\.php/i.test(u)) {
      var q2 = u.indexOf("?"); return P + (q2>=0 ? u.slice(q2) : "");
    }
    return u;
  }
  document.addEventListener("submit", function(e){
    var f = e.target; if (!f || !f.action) return;
    var a = fix(f.getAttribute("action") || f.action);
    if (a && a !== f.action) f.action = a;
  }, true);
  var ofetch = window.fetch;
  if (ofetch) {
    window.fetch = function(input, init){
      if (typeof input === "string") input = fix(input);
      else if (input && typeof input.url === "string") {
        try { input = new Request(fix(input.url), input); } catch(e){}
      }
      return ofetch.call(this, input, init);
    };
  }
  var oOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(m, url){
    arguments[1] = fix(url);
    return oOpen.apply(this, arguments);
  };
})();</script>`;
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, shim + "</head>");
  if (/<body[^>]*>/i.test(html)) return html.replace(/<body([^>]*)>/i, "<body$1>" + shim);
  return shim + html;
}

function rewriteJournalHtml(html) {
  let out = String(html);
  const radar = radarBaseUrl().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  out = out.replace(
    new RegExp(`https?:\\/\\/${radar.replace(/\\\//g, "/")}\\/trading_journal\\.php`, "gi"),
    "/journal-embed/"
  );
  // simpler absolute replace
  out = out.replace(
    /https?:\/\/radar\.torinvest-trading\.com\/trading_journal\.php/gi,
    "/journal-embed/"
  );
  out = out.replace(
    /(<form[^>]*\saction=["'])\/?trading_journal\.php([^"']*)(["'][^>]*>)/gi,
    "$1/journal-embed/$2$3"
  );
  out = out.replace(/(<form)((?![^>]*\saction=)[^>]*>)/gi, '$1 action="/journal-embed/"$2');
  out = out.replace(
    /href=(["'])\/?trading_journal\.php([^"']*)\1/gi,
    'href="/journal-embed/$2"'
  );
  out = out.replace(
    /action=(["'])\/?trading_journal\.php([^"']*)\1/gi,
    'action="/journal-embed/$2"'
  );

  return injectProxyShim(out);
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

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    if (Buffer.isBuffer(req.body)) return resolve(req.body);
    if (typeof req.body === "string") return resolve(Buffer.from(req.body));
    // already parsed object — re-encode
    if (req.body && typeof req.body === "object" && Object.keys(req.body).length) {
      const ctype = String(req.headers["content-type"] || "");
      if (ctype.includes("application/json")) {
        return resolve(Buffer.from(JSON.stringify(req.body)));
      }
      return resolve(
        Buffer.from(
          new URLSearchParams(
            Object.entries(req.body).map(([k, v]) => [k, v == null ? "" : String(v)])
          ).toString()
        )
      );
    }
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
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

    let phpSess =
      (req.session && req.session.tjPhpSessid) || readReqCookie(req, PHPSESS_COOKIE) || "";

    const method = (req.method || "GET").toUpperCase();
    const sso = makeSsoToken(user.email);
    const target = buildUpstreamUrl(req, method === "GET" || method === "HEAD" ? sso : null);

    const upstreamHeaders = radarFetchHeaders(radarBaseUrl(), {
      Accept: req.headers.accept || "text/html,application/xhtml+xml,application/json,*/*",
      "User-Agent": req.headers["user-agent"] || "TorInvest-Journal-Proxy",
    });
    if (sso) upstreamHeaders["X-Forge-Journal-Sso"] = sso;
    if (phpSess) upstreamHeaders.Cookie = "PHPSESSID=" + phpSess;

    let body;
    if (method !== "GET" && method !== "HEAD") {
      const ctype = String(req.headers["content-type"] || "application/x-www-form-urlencoded");
      upstreamHeaders["Content-Type"] = ctype;
      try {
        body = await readRawBody(req);
        if (body && body.length) {
          upstreamHeaders["Content-Length"] = String(body.length);
        }
      } catch (e) {
        body = undefined;
      }
      // POST also needs SSO in query for session refresh
      if (sso) {
        const u = new URL(target);
        u.searchParams.set("forge_sso", sso);
        // rebuild — buildUpstreamUrl already used; add sso for POST
      }
    }

    let finalTarget = target;
    if (sso && method !== "GET" && method !== "HEAD") {
      const u = new URL(radarBaseUrl() + journalPhpPath());
      const qs = clientQueryString(req);
      if (qs) {
        const extra = new URLSearchParams(qs);
        for (const [k, v] of extra.entries()) {
          if (k !== "forge_sso") u.searchParams.append(k, v);
        }
      }
      u.searchParams.set("forge_sso", sso);
      finalTarget = u.toString();
    }

    try {
      let result = await upstreamFetch(finalTarget, method, upstreamHeaders, body);
      storePhpSess(req, res, result.newSess);
      if (result.newSess) phpSess = result.newSess;

      if (result.upstream.status >= 300 && result.upstream.status < 400) {
        const loc = result.upstream.headers.get("location") || "";
        const mapped = mapRedirectToEmbed(loc);
        if (mapped) {
          res.redirect(302, mapped.replace(/([^:]\/)\/+/g, "$1"));
          return;
        }
      }

      let html = result.ctype.includes("text/html") ? result.buf.toString("utf8") : null;

      if (
        html &&
        looksLikeLoginPage(html) &&
        method === "GET" &&
        !req.session?.tjAutoLoginTried
      ) {
        if (req.session) req.session.tjAutoLoginTried = true;
        const auto = await tryEnvAutoLogin(
          radarBaseUrl() + journalPhpPath(),
          upstreamHeaders,
          phpSess
        );
        if (auto) {
          storePhpSess(req, res, auto.newSess);
          result = auto;
          html = auto.ctype.includes("text/html") ? auto.buf.toString("utf8") : null;
        }
      }

      res.status(result.upstream.status);
      res.setHeader("Content-Type", result.ctype);
      res.setHeader("Cache-Control", "private, no-store");

      // JSON APIs éventuelles — ne pas réécrire
      if (html != null) return res.send(rewriteJournalHtml(html));
      return res.send(result.buf);
    } catch (e) {
      return res
        .status(502)
        .send("Proxy Trading Journal indisponible : " + String(e.message || e));
    }
  };
}

module.exports = function createJournalBridgeRouter() {
  const router = express.Router();
  const proxy = createPhpProxy();

  // Ne pas parser avant : on lit le body brut pour ne rien perdre (multipart / fields)
  router.use(["/journal-embed", "/appjournal"], (req, res, next) => {
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

  router.get("/api/journal-bridge/ping", (req, res) => {
    res.json({
      ok: true,
      mounted: true,
      app: "trading_journal_pro",
      upstream: radarBaseUrl() + journalPhpPath(),
      sso: !!bridgeSecret(),
      autoLoginEnv: !!(process.env.FORGE_JOURNAL_PASSWORD || process.env.TJ_PASSWORD),
    });
  });

  router.get("/api/journal-bridge/status", async (req, res) => {
    const user = await requirePremium(req);
    if (!user?.email) return res.json({ ok: false, active: false, premium: false });
    return res.json({
      ok: true,
      active: true,
      premium: true,
      email: user.email,
      embed: EMBED_PATH,
    });
  });

  router.post("/api/journal-bridge/activate", async (req, res) => {
    const user = await requirePremium(req);
    if (!user?.email) {
      return res.status(403).json({ ok: false, error: "premium_required" });
    }
    return res.json({ ok: true, email: user.email, embed: EMBED_PATH });
  });

  router.all("/journal-embed", proxy);
  router.all("/journal-embed/", proxy);
  router.all("/journal-embed/*", proxy);
  router.all("/appjournal", proxy);
  router.all("/appjournal/", proxy);
  router.all("/appjournal/*", proxy);

  return router;
};
