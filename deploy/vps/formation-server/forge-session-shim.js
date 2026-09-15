/**
 * Middleware req.session autonome (cookie signé) pour La Forge
 * quand server.js n'a pas express-session (auth cookie COOKIE_NAME maison).
 *
 * Ne remplace PAS le cookie natif torinvest_session : cookie dédié
 * torinvest_forge_sess pour le pont formation (users.json + /api/me).
 */
"use strict";

const crypto = require("crypto");

const DEFAULT_COOKIE = "torinvest_forge_sess";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromB64url(str) {
  const s = String(str || "").replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s + pad, "base64");
}

function sign(payloadB64, secret) {
  return b64url(crypto.createHmac("sha256", secret).update(payloadB64).digest());
}

function encodeSession(data, secret) {
  const payloadB64 = b64url(JSON.stringify(data || {}));
  return payloadB64 + "." + sign(payloadB64, secret);
}

function decodeSession(raw, secret) {
  const parts = String(raw || "").split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  const expected = sign(payloadB64, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const json = fromB64url(payloadB64).toString("utf8");
    const data = JSON.parse(json);
    return data && typeof data === "object" ? data : null;
  } catch (_) {
    return null;
  }
}

function readCookieHeader(req, name) {
  if (req.cookies && req.cookies[name] != null) return String(req.cookies[name]);
  const header = String(req.headers?.cookie || "");
  if (!header) return "";
  const parts = header.split(";");
  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    if (k === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return "";
}

function createForgeSessionShim(options) {
  const cookieName = (options && options.cookieName) || DEFAULT_COOKIE;
  const secret =
    (options && options.secret) ||
    process.env.FORGE_SESSION_SECRET ||
    process.env.SESSION_SECRET ||
    process.env.FORGE_FORMATION_PROVISION_SECRET ||
    "torinvest-forge-session";

  return function forgeSessionShim(req, res, next) {
    // Si express-session / cookie-session déjà là → ne pas écraser
    if (req.session && typeof req.session === "object") {
      return next();
    }

    const raw = readCookieHeader(req, cookieName);
    const data = (raw && decodeSession(raw, secret)) || {};
    let dirty = false;

    const session = Object.create(null);
    Object.assign(session, data);

    session.save = function save(cb) {
      try {
        const plain = {};
        for (const key of Object.keys(session)) {
          if (key === "save" || key === "destroy" || typeof session[key] === "function") continue;
          plain[key] = session[key];
        }
        const token = encodeSession(plain, secret);
        if (typeof res.cookie === "function") {
          res.cookie(cookieName, token, {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            maxAge: MAX_AGE_MS,
            secure: process.env.NODE_ENV === "production" || process.env.FORGE_COOKIE_SECURE === "1",
          });
        } else {
          const parts = [
            cookieName + "=" + encodeURIComponent(token),
            "Path=/",
            "HttpOnly",
            "SameSite=Lax",
            "Max-Age=" + Math.floor(MAX_AGE_MS / 1000),
          ];
          if (process.env.NODE_ENV === "production" || process.env.FORGE_COOKIE_SECURE === "1") {
            parts.push("Secure");
          }
          const prev = res.getHeader("Set-Cookie");
          if (!prev) res.setHeader("Set-Cookie", parts.join("; "));
          else if (Array.isArray(prev)) res.setHeader("Set-Cookie", prev.concat(parts.join("; ")));
          else res.setHeader("Set-Cookie", [prev, parts.join("; ")]);
        }
        dirty = false;
        if (typeof cb === "function") cb(null);
      } catch (err) {
        if (typeof cb === "function") cb(err);
        else throw err;
      }
    };

    session.destroy = function destroy(cb) {
      try {
        for (const key of Object.keys(session)) {
          if (key === "save" || key === "destroy") continue;
          delete session[key];
        }
        if (typeof res.clearCookie === "function") {
          res.clearCookie(cookieName, { path: "/" });
        } else {
          res.setHeader(
            "Set-Cookie",
            cookieName + "=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"
          );
        }
        dirty = false;
        if (typeof cb === "function") cb(null);
      } catch (err) {
        if (typeof cb === "function") cb(err);
        else throw err;
      }
    };

    // Marquer dirty si on mute (approx — finishLogin appelle save())
    const handler = {
      set(target, prop, value) {
        if (prop !== "save" && prop !== "destroy") dirty = true;
        target[prop] = value;
        return true;
      },
      deleteProperty(target, prop) {
        if (prop !== "save" && prop !== "destroy") dirty = true;
        delete target[prop];
        return true;
      },
    };

    req.session = new Proxy(session, handler);
    req._forgeSessionDirty = () => dirty;
    return next();
  };
}

module.exports = createForgeSessionShim;
module.exports.DEFAULT_COOKIE = DEFAULT_COOKIE;
