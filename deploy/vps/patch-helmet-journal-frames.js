/**
 * Élarget Helmet CSP pour Journal (radar iframe) + Atlas (MapLibre blob workers + tuiles CARTO).
 *
 *   node deploy/vps/patch-helmet-journal-frames.js /home/ubuntu/torinvest-formation
 *
 * Idempotent : remplace un ancien bloc si le marqueur / une version plus ancienne est présent.
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
const versionMarker = "/* torinvest-csp-v2-atlas-maplibre */";

const patchBody = `
${marker}
${versionMarker}
try {
  const helmet = require("helmet");
  // Remplace / étend CSP si helmet déjà monté plus haut : on remonte une politique élargie.
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'", "'unsafe-inline'", "blob:"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:", "blob:", "https:"],
        "connect-src": [
          "'self'",
          "https:",
          "https://radar.torinvest-trading.com",
          "https://www.torinvest-trading.com",
          "https://*.basemaps.cartocdn.com",
        ],
        "worker-src": ["'self'", "blob:"],
        "child-src": ["'self'", "blob:"],
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
  console.log("[torinvest] helmet CSP élargi (journal + atlas MapLibre)");
} catch (e) {
  console.warn("[torinvest] patch helmet journal/atlas ignoré:", e && e.message);
}
`;

function stripExistingCspPatch(input) {
  // Bloc inséré après helmet : du marqueur jusqu'à la fin du try/catch patch.
  const start = input.indexOf(marker);
  if (start < 0) return input;
  const after = input.slice(start);
  const endMatch = after.match(
    /\}\s*catch\s*\([^)]*\)\s*\{[\s\S]*?\}\s*\n?/
  );
  if (!endMatch || endMatch.index == null) {
    // Fallback : retirer jusqu'à 80 lignes
    const lines = input.split("\n");
    const lineStart = input.slice(0, start).split("\n").length - 1;
    lines.splice(lineStart, 80);
    return lines.join("\n");
  }
  const end = start + endMatch.index + endMatch[0].length;
  return input.slice(0, start) + input.slice(end);
}

if (src.includes(versionMarker)) {
  console.log("OK — patch CSP journal+atlas (v2) déjà présent");
  process.exit(0);
}

if (src.includes(marker)) {
  console.log("→ Mise à jour patch CSP (v1 journal → v2 atlas MapLibre)");
  src = stripExistingCspPatch(src);
}

const helmetRe = /app\.use\(\s*helmet\s*\([^)]*\)\s*\)\s*;?/;
if (helmetRe.test(src)) {
  src = src.replace(helmetRe, (m) => m + "\n" + patchBody);
} else {
  const listenRe = /app\.listen\s*\(/;
  if (listenRe.test(src)) {
    src = src.replace(listenRe, patchBody + "\napp.listen(");
  } else {
    src += "\n" + patchBody + "\n";
  }
}

fs.writeFileSync(serverJs, src);
console.log("OK — CSP journal+atlas patché dans", serverJs);
console.log("→ pm2 restart la-forge --update-env");
