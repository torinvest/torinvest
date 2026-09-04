/**
 * Pont La Forge Premium → Trading Journal (session radar + embed same-origin).
 * Secret : FORGE_FONDAMENTAL_BRIDGE_SECRET (= ai_access_hmac_secret radar).
 */
"use strict";

const express = require("express");
const { generateBridgeToken } = require("./fondamental-bridge-lib");

function bridgeSecret(opts) {
  return String(
    opts.bridgeSecret ||
      process.env.FORGE_JOURNAL_BRIDGE_SECRET ||
      process.env.FORGE_FONDAMENTAL_BRIDGE_SECRET ||
      process.env.AI_ACCESS_HMAC_SECRET ||
      ""
  );
}

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

function parseJournalCookie(setCookieHeaders) {
  const list = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  for (const raw of list) {
    if (!raw) continue;
    const m = String(raw).match(/torinvest_journal=([^;]+)/);
    if (m) return m[1];
  }
  return null;
}

const FORGE_JOURNAL_COOKIE = "forge_journal_embed";

function readReqCookie(req, name) {
  const raw = String(req.headers.cookie || "");
  const re = new RegExp(
    "(?:^|;\\s*)" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)"
  );
  const m = raw.match(re);
  return m ? decodeURIComponent(m[1]) : null;
}

function journalToken(req) {
  return req.session?.journalAccessToken || readReqCookie(req, FORGE_JOURNAL_COOKIE) || null;
}

function storeJournalAccess(req, res, token, email, expiresAt) {
  if (req.session) {
    req.session.journalAccessToken = token;
    req.session.journalEmail = String(email || "").trim() || null;
    req.session.journalExpiresAt = expiresAt || null;
  }
  res.cookie(FORGE_JOURNAL_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 12 * 60 * 60 * 1000,
    path: "/",
  });
}

async function activateOnRadar(bridgeToken) {
  const base = radarBaseUrl();
  const url = base + "/api/journal-access.php";
  const headers = radarFetchHeaders(base, {
    "Content-Type": "application/json",
    Accept: "application/json",
  });

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      action: "login_formation_bridge",
      bridgeToken,
    }),
    signal: AbortSignal.timeout(25000),
  });

  const rawText = await res.text();
  let data = {};
  try {
    data = JSON.parse(rawText);
  } catch (_) {
    data = { ok: false, error: "bridge_non_json", body: rawText.slice(0, 200) };
  }
  if (!res.ok || !data.ok) {
    const err = new Error(data.error || "bridge_activate_failed");
    err.status = res.status;
    err.payload = { ...data, httpStatus: res.status, radarUrl: url };
    throw err;
  }

  let sessionToken = data.sessionToken || null;
  if (!sessionToken && typeof res.headers.getSetCookie === "function") {
    sessionToken = parseJournalCookie(res.headers.getSetCookie());
  }
  if (!sessionToken) {
    sessionToken = parseJournalCookie(res.headers.get("set-cookie"));
  }
  if (!sessionToken) {
    const err = new Error("journal_cookie_missing");
    err.payload = data;
    throw err;
  }

  return { sessionToken, data };
}

function createEmbedProxy() {
  return async function embedProxy(req, res) {
    const token = journalToken(req);
    if (!token) {
      res.status(401);
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.send("Session Journal requise — rechargez depuis La Forge (Premium).");
    }

    let subPath = req.path || "/";
    if (subPath === "/" || subPath === "") {
      subPath = "/index.html";
    }
    subPath = subPath.replace(/^\//, "");

    const radar = radarBaseUrl();
    const query = new URLSearchParams();
    query.set("path", subPath);
    query.set("access_token", token);
    const rawQs = req.originalUrl.includes("?")
      ? req.originalUrl.slice(req.originalUrl.indexOf("?") + 1)
      : "";
    if (rawQs) {
      const extra = new URLSearchParams(rawQs);
      for (const [k, v] of extra.entries()) {
        if (k !== "path") query.append(k, v);
      }
    }

    const target = `${radar}/api/journal-serve.php?${query.toString()}`;
    const upstreamHeaders = radarFetchHeaders(radar, {
      Accept: req.headers.accept || "*/*",
      Cookie: `torinvest_journal=${token}`,
    });

    try {
      const upstream = await fetch(target, {
        method: "GET",
        headers: upstreamHeaders,
        signal: AbortSignal.timeout(60000),
      });

      res.status(upstream.status);
      const skip = new Set([
        "connection",
        "transfer-encoding",
        "content-encoding",
        "content-length",
      ]);
      upstream.headers.forEach((value, key) => {
        if (!skip.has(key.toLowerCase())) {
          res.setHeader(key, value);
        }
      });

      const buf = Buffer.from(await upstream.arrayBuffer());
      if (upstream.status === 404) {
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        return res
          .status(502)
          .send(
            "Radar Journal 404 — déployer appjournal sur le VPS (/var/lib/torinvest/appjournal)."
          );
      }
      if (upstream.status === 503) {
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        return res.status(503).send(buf.toString("utf8") || "Journal non déployé sur le VPS.");
      }
      return res.send(buf);
    } catch (e) {
      return res.status(502).send("Proxy Journal indisponible : " + String(e.message || e));
    }
  };
}

module.exports = function createJournalBridgeRouter(options) {
  const opts = options || {};
  const router = express.Router();
  const secret = bridgeSecret(opts);

  router.get("/api/journal-bridge/ping", (req, res) => {
    res.json({ ok: true, mounted: true, app: "journal" });
  });

  router.get("/api/journal-bridge/status", (req, res) => {
    const token = journalToken(req);
    if (!token) {
      return res.json({ ok: false, active: false });
    }
    return res.json({
      ok: true,
      active: true,
      email: req.session?.journalEmail || null,
      expiresAt: req.session?.journalExpiresAt || null,
    });
  });

  router.post("/api/journal-bridge/activate", async (req, res) => {
    try {
      let user = premiumUser(req);
      if (!user) user = await premiumUserViaMe(req);
      if (!user?.email) {
        return res.status(403).json({
          ok: false,
          error: "premium_required",
          hint: "Connexion La Forge Premium requise pour le Trading Journal.",
        });
      }
      if (!secret) {
        return res.status(503).json({
          ok: false,
          error: "bridge_secret_missing",
          hint: "FORGE_FONDAMENTAL_BRIDGE_SECRET (ou FORGE_JOURNAL_BRIDGE_SECRET) manquant.",
        });
      }

      const { bridgeToken } = generateBridgeToken(user.email, secret);
      const { sessionToken, data } = await activateOnRadar(bridgeToken);
      storeJournalAccess(req, res, sessionToken, user.email, data.expiresAt);

      const finish = () =>
        res.json({
          ok: true,
          email: user.email,
          expiresAt: data.expiresAt,
          embed: "/appjournal/",
        });

      if (typeof req.session?.save === "function") {
        return req.session.save((err) => {
          if (err) return res.status(500).json({ ok: false, error: "session_save_failed" });
          return finish();
        });
      }
      return finish();
    } catch (e) {
      const status = e.status && e.status >= 400 ? e.status : 502;
      return res.status(status).json({
        ok: false,
        error: String(e.message || e),
        detail: e.payload || null,
      });
    }
  });

  const embedProxy = createEmbedProxy();
  router.use("/appjournal", embedProxy);
  router.use("/journal-embed", embedProxy);

  return router;
};
