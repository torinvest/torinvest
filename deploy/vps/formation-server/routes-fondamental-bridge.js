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

  if (isPremiumSessionUser(s.user)) return s.user;
  if (isPremiumSessionUser(req.user)) return req.user;

  const email = String(s.user?.email || s.email || "").trim();
  if (!email) return null;

  const synthetic = {
    email,
    subscribed: s.user?.subscribed ?? s.subscribed,
    plan: s.user?.plan ?? s.plan,
    name: s.user?.name ?? s.name,
  };
  if (isPremiumSessionUser(synthetic)) return synthetic;

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

  router.get("/api/fondamental-bridge/status", (req, res) => {
    if (!req.session?.fondamentalAccessToken) {
      return res.status(401).json({ ok: false, error: "fondamental_session_required" });
    }
    return res.json({
      ok: true,
      source: "formation",
      email: req.session.fondamentalEmail || req.session?.user?.email || "",
      expiresAt: req.session.fondamentalExpiresAt || null,
    });
  });

  router.post("/api/fondamental-bridge/activate", async (req, res) => {
    const s = req.session;
    if (!s || (!s.user?.email && !s.email)) {
      return res.status(401).json({ ok: false, error: "login_required" });
    }

    const user = premiumUser(req);
    if (!user) {
      return res.status(403).json({
        ok: false,
        error: "premium_required",
        hint: "Session sans Premium — reconnectez-vous ou vérifiez users.json subscribed",
      });
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
      req.session.fondamentalAccessToken = activated.sessionToken;
      req.session.fondamentalEmail = user.email;
      req.session.fondamentalExpiresAt = activated.data.expiresAt || null;

      const finish = () =>
        res.json({
          ok: true,
          source: "formation",
          email: user.email,
          expiresAt: req.session.fondamentalExpiresAt,
        });

      if (typeof req.session.save === "function") {
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
    const token = req.session?.fondamentalAccessToken;
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
