/**
 * Ajoute radar.torinvest-trading.com à Helmet frame-src / connect-src
 * (secours si iframe cross-origin ; le proxy /journal-embed/ reste préféré).
 *
 *   node deploy/vps/patch-helmet-journal-frames.js /home/ubuntu/torinvest-formation
 */
"use strict";

const fs = require("fs");
const path = require("path");

const APP_DIR = process.argv[2] || "/home/ubuntu/torinvest-formation";
const serverJs = path.join(APP_DIR, "server.js");

if (!fs.existsSync(serverJs)) {
  console.error("ERREUR: server.js introuvable:", serverJs);
  process.exit(1);
}

let src = fs.readFileSync(serverJs, "utf8");
const marker = "/* torinvest-journal-csp */";

if (src.includes(marker)) {
  console.log("OK — patch CSP journal déjà présent");
  process.exit(0);
}

const patch = `
${marker}
try {
  const helmet = require("helmet");
  // Remplace / étend CSP si helmet déjà monté plus haut : on remonte une politique élargie.
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'", "'unsafe-inline'"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:", "https:"],
        "connect-src": ["'self'", "https://radar.torinvest-trading.com", "https://www.torinvest-trading.com"],
        "frame-src": ["'self'", "https://www.tradingview.com", "https://radar.torinvest-trading.com"],
        "font-src": ["'self'", "https:", "data:"],
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'", "https://radar.torinvest-trading.com"],
        "frame-ancestors": ["'self'"],
        "script-src-attr": ["'none'"],
        "upgrade-insecure-requests": [],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));
  console.log("[torinvest] helmet CSP élargi (journal radar frame-src)");
} catch (e) {
  console.warn("[torinvest] patch helmet journal ignoré:", e && e.message);
}
`;

// Insérer après la première occurrence de app.use(helmet… ) ou avant listen
const helmetRe = /app\.use\(\s*helmet\s*\([^)]*\)\s*\)\s*;?/;
if (helmetRe.test(src)) {
  src = src.replace(helmetRe, (m) => m + "\n" + patch);
} else {
  const listenRe = /app\.listen\s*\(/;
  if (listenRe.test(src)) {
    src = src.replace(listenRe, patch + "\napp.listen(");
  } else {
    src += "\n" + patch + "\n";
  }
}

fs.writeFileSync(serverJs, src);
console.log("OK — CSP journal patché dans", serverJs);
console.log("→ pm2 restart la-forge --update-env");
