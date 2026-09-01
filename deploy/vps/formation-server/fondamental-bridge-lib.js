/**
 * Pont session La Forge Premium → Fondamental (token HMAC compatible ai-access PHP).
 */
const crypto = require("crypto");

function base64UrlEncode(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function generateBridgeToken(email, secret, ttlSeconds = 120) {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = JSON.stringify({
    exp: expiresAt,
    nonce: crypto.randomBytes(12).toString("hex"),
    role: "client",
    meta: { source: "forge_formation", email: String(email || "").trim() },
  });
  const b64 = base64UrlEncode(payload);
  const sig = crypto.createHmac("sha256", secret).update(b64).digest("hex");
  return { bridgeToken: `${b64}.${sig}`, expiresAt };
}

module.exports = { generateBridgeToken };
