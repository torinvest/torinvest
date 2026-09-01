/**
 * GET /api/fondamental-bridge — token court pour membres Premium La Forge.
 * Secret : FORGE_FONDAMENTAL_BRIDGE_SECRET (identique à ai_access_hmac_secret sur radar).
 */
const express = require("express");
const { generateBridgeToken } = require("./fondamental-bridge-lib");

module.exports = function createFondamentalBridgeRouter(options) {
  const opts = options || {};
  const router = express.Router();

  router.get("/api/fondamental-bridge", (req, res) => {
    const user = req.session?.user || req.user;
    if (!user || !user.email) {
      return res.status(401).json({ ok: false, error: "login_required" });
    }
    if (!user.subscribed) {
      return res.status(403).json({ ok: false, error: "premium_required" });
    }

    const secret =
      opts.bridgeSecret ||
      process.env.FORGE_FONDAMENTAL_BRIDGE_SECRET ||
      process.env.AI_ACCESS_HMAC_SECRET ||
      "";
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

  return router;
};
