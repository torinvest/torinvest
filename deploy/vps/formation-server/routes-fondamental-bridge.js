/**
 * Pont La Forge Premium → Fondamental (session radar + embed same-origin).
 * Secret bridge : FORGE_FONDAMENTAL_BRIDGE_SECRET (= ai_access_hmac_secret radar).
 */
const express = require("express");
const { generateBridgeToken } = require("./fondamental-bridge-lib");

function bridgeSecret(opts) {
  return String(
    opts.bridgeSecret ||
      process.env.FORGE_FONDAMENTAL_BRIDGE_SECRET ||
      process.env.AI_ACCESS_HMAC_SECRET ||
      ""
  );
}

function radarBaseUrl() {
  return String(
    process.env.FORGE_FONDAMENTAL_RADAR_URL ||
      process.env.FORGE_RADAR_URL ||
      "https://radar.torinvest-trading.com"
  ).replace(/\/$/, "");
}

function internalProvisionKey() {
  return String(process.env.FORGE_FORMATION_PROVISION_SECRET || "");
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

/** Lit Premium via /api/me (même logique que le site) si session.user incomplète. */
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

function parseFondamentalCookie(setCookieHeaders) {
  const list = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  for (const raw of list) {
    if (!raw) continue;
    const m = String(raw).match(/torinvest_fondamental=([^;]+)/);
    if (m) return m[1];
  }
  return null;
}

const FORGE_FONDA_COOKIE = "forge_fondamental_embed";

function readReqCookie(req, name) {
  const raw = String(req.headers.cookie || "");
  const re = new RegExp("(?:^|;\\s*)" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)");
  const m = raw.match(re);
  return m ? decodeURIComponent(m[1]) : null;
}

function fondamentalToken(req) {
  return req.session?.fondamentalAccessToken || readReqCookie(req, FORGE_FONDA_COOKIE) || null;
}

function storeFondamentalAccess(req, res, token, email, expiresAt) {
  if (req.session) {
    req.session.fondamentalAccessToken = token;
    req.session.fondamentalEmail = email;
    req.session.fondamentalExpiresAt = expiresAt || null;
  }
  const maxAgeMs = 12 * 60 * 60 * 1000;
  res.cookie(FORGE_FONDA_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: maxAgeMs,
    path: "/",
  });
}

async function activateOnRadar(bridgeToken, secret) {
  const url = radarBaseUrl() + "/api/fondamental-access.php";
  const headers = { "Content-Type": "application/json", Accept: "application/json" };
  const internal = internalProvisionKey();
  if (internal) {
    headers["X-Forge-Fondamental-Internal"] = internal;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      action: "login_formation_bridge",
      bridgeToken,
    }),
    signal: AbortSignal.timeout(25000),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    const err = new Error(data.error || "bridge_activate_failed");
    err.status = res.status;
    err.payload = data;
    throw err;
  }

  let sessionToken = data.sessionToken || null;
  if (!sessionToken && typeof res.headers.getSetCookie === "function") {
    sessionToken = parseFondamentalCookie(res.headers.getSetCookie());
  }
  if (!sessionToken) {
    sessionToken = parseFondamentalCookie(res.headers.get("set-cookie"));
  }
  if (!sessionToken) {
    const err = new Error("fondamental_cookie_missing");
    err.payload = data;
    throw err;
  }

  return { sessionToken, data };
}

module.exports = function createFondamentalBridgeRouter(options) {
  const opts = options || {};
  const router = express.Router();

  router.get("/api/fondamental-bridge/ping", (req, res) => {
    res.json({ ok: true, mounted: true, cookieFallback: true });
  });

  router.get("/api/fondamental-bridge/status", (req, res) => {
    const token = fondamentalToken(req);
    if (!token) {
      return res.status(401).json({ ok: false, error: "fondamental_session_required" });
    }
    return res.json({
      ok: true,
      source: "formation",
      email:
        req.session?.fondamentalEmail ||
        req.session?.user?.email ||
        readReqCookie(req, "forge_fondamental_email") ||
        "",
      expiresAt: req.session?.fondamentalExpiresAt || null,
    });
  });

  router.post("/api/fondamental-bridge/activate", async (req, res) => {
    let user = premiumUser(req);
    if (!user) {
      user = await premiumUserViaMe(req);
    }
    if (!user) {
      return res.status(403).json({ ok: false, error: "premium_required" });
    }

    const secret = bridgeSecret(opts);
    if (!secret) {
      return res.status(503).json({
        ok: false,
        error: "bridge_not_configured",
        hint: "FORGE_FONDAMENTAL_BRIDGE_SECRET (= ai_access_hmac_secret radar)",
      });
    }

    try {
      const { bridgeToken } = generateBridgeToken(user.email, secret, 120);
      const activated = await activateOnRadar(bridgeToken, secret);
      const expiresAt = activated.data.expiresAt || null;
      storeFondamentalAccess(req, res, activated.sessionToken, user.email, expiresAt);

      const finish = () =>
        res.json({
          ok: true,
          source: "formation",
          email: user.email,
          expiresAt,
        });

      if (req.session && typeof req.session.save === "function") {
        return req.session.save((err) => {
          if (err) {
            return res.status(500).json({ ok: false, error: "session_save_failed" });
          }
          return finish();
        });
      }
      return finish();
    } catch (e) {
      const status = e.status && e.status >= 400 ? e.status : 502;
      return res.status(status).json({
        ok: false,
        error: e.message || "bridge_activate_failed",
        detail: e.payload || undefined,
      });
    }
  });

  router.get("/api/fondamental-bridge", (req, res) => {
    const user = req.session?.user || req.user;
    if (!user?.email) {
      return res.status(401).json({ ok: false, error: "login_required" });
    }
    if (!isPremiumSessionUser(user)) {
      return res.status(403).json({ ok: false, error: "premium_required" });
    }

    const secret = bridgeSecret(opts);
    if (!secret) {
      return res.status(503).json({
        ok: false,
        error: "bridge_not_configured",
        hint: "Définir FORGE_FONDAMENTAL_BRIDGE_SECRET sur le VPS (même valeur que ai_access_hmac_secret radar).",
      });
    }

    const { bridgeToken, expiresAt } = generateBridgeToken(user.email, secret, 120);
    res.json({
      ok: true,
      bridgeToken,
      expiresAt,
      email: user.email,
    });
  });

  router.use("/fondamental-embed", async (req, res) => {
    const token = fondamentalToken(req);
    if (!token) {
      res.status(401);
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.send("Session Fondamental requise — rechargez la page depuis La Forge.");
    }

    let subPath = req.path || "/";
    if (subPath === "/" || subPath === "") {
      subPath = "/index.html";
    }
    subPath = subPath.replace(/^\//, "");

    const radar = radarBaseUrl();
    const query = new URLSearchParams();
    query.set("path", subPath);
    const rawQs = req.originalUrl.includes("?")
      ? req.originalUrl.slice(req.originalUrl.indexOf("?") + 1)
      : "";
    if (rawQs) {
      const extra = new URLSearchParams(rawQs);
      for (const [k, v] of extra.entries()) {
        if (k !== "path") query.append(k, v);
      }
    }

    const target = `${radar}/api/fondamental-serve.php?${query.toString()}`;

    try {
      const upstream = await fetch(target, {
        method: "GET",
        headers: {
          Cookie: `torinvest_fondamental=${token}`,
          Accept: req.headers.accept || "*/*",
        },
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
      return res.send(buf);
    } catch (e) {
      return res.status(502).send("Proxy Fondamental indisponible : " + String(e.message || e));
    }
  });

  return router;
};
