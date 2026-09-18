#!/usr/bin/env node
/**
 * Fait accepter la session forge (req.session.user) par requireAuth natif.
 * Sans ça : login forge OK (/api/me) mais /dashboard.html → 302 login (boucle).
 *
 * Usage : node patch-require-auth-forge.js /home/ubuntu/torinvest-formation
 */
"use strict";

const fs = require("fs");
const path = require("path");

const APP_DIR = process.argv[2] || "/home/ubuntu/torinvest-formation";
const serverPath = path.join(APP_DIR, "server.js");

if (!fs.existsSync(serverPath)) {
  console.error("ERREUR:", serverPath, "introuvable");
  process.exit(1);
}

let text = fs.readFileSync(serverPath, "utf8");
const original = text;

const MARK_BEGIN = "/* TORINVEST_FORGE_REQUIRE_AUTH_BEGIN */";
const MARK_END = "/* TORINVEST_FORGE_REQUIRE_AUTH_END */";

const forgeGuard = [
  MARK_BEGIN,
  "  try {",
  "    const __forgeUser = (req.session && req.session.user) || null;",
  "    if (__forgeUser && __forgeUser.email) {",
  "      if (!req.user) req.user = __forgeUser;",
  "      return typeof next === 'function' ? next() : undefined;",
  "    }",
  "  } catch (_e) {}",
  MARK_END,
].join("\n");

// Idempotent : retirer ancienne injection
text = text.replace(
  new RegExp(
    MARK_BEGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
      "[\\s\\S]*?" +
      MARK_END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
      "\\s*",
    "g"
  ),
  ""
);

function injectAfterOpenBrace(src, openBraceIdx) {
  let i = openBraceIdx + 1;
  // skip whitespace/newlines
  while (i < src.length && /[ \t\r\n]/.test(src[i])) i++;
  return src.slice(0, i) + forgeGuard + "\n" + src.slice(i);
}

function findRequireAuthBodies(src) {
  const hits = [];
  const patterns = [
    /function\s+requireAuth\s*\(\s*req\s*,\s*res\s*,\s*next\s*\)\s*\{/g,
    /(?:const|let|var)\s+requireAuth\s*=\s*function\s*\(\s*req\s*,\s*res\s*,\s*next\s*\)\s*\{/g,
    /(?:const|let|var)\s+requireAuth\s*=\s*\(\s*req\s*,\s*res\s*,\s*next\s*\)\s*=>\s*\{/g,
    /(?:const|let|var)\s+requireAuth\s*=\s*async\s*\(\s*req\s*,\s*res\s*,\s*next\s*\)\s*=>\s*\{/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(src))) {
      hits.push(m.index + m[0].length - 1); // index of '{'
    }
  }
  return [...new Set(hits)].sort((a, b) => b - a); // inject from end
}

const braces = findRequireAuthBodies(text);
if (!braces.length) {
  // Fallback : middleware dédié juste avant la 1re utilisation de requireAuth
  console.warn("WARN: définition requireAuth introuvable — injection middleware bypass dashboard");
  const MARK_MW_B = "/* TORINVEST_DASHBOARD_PUBLIC_BEGIN */";
  const MARK_MW_E = "/* TORINVEST_DASHBOARD_PUBLIC_END */";
  text = text.replace(
    new RegExp(
      MARK_MW_B.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
        "[\\s\\S]*?" +
        MARK_MW_E.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
        "\\s*",
      "g"
    ),
    ""
  );
  const mw = [
    MARK_MW_B,
    "(function () {",
    '  const __path = require("path");',
    '  const __fs = require("fs");',
    '  const dashFile = __path.join(__dirname, "public", "dashboard.html");',
    '  app.get(["/dashboard.html", "/dashboard"], function (req, res, next) {',
    "    if (!__fs.existsSync(dashFile)) return next();",
    "    return res.sendFile(dashFile, function (err) { if (err) next(err); });",
    "  });",
    "})();",
    MARK_MW_E,
    "",
  ].join("\n");

  const appDecl = /(?:const|let|var)\s+app\s*=\s*express\s*\(\s*\)\s*;?/.exec(text);
  if (!appDecl) {
    console.error("ERREUR: ni requireAuth ni app=express() — abandon");
    process.exit(1);
  }
  const at = appDecl.index + appDecl[0].length;
  text = text.slice(0, at) + "\n" + mw + text.slice(at);
  console.log("OK fallback: route GET /dashboard.html publique (gate client)");
} else {
  for (const braceIdx of braces) {
    text = injectAfterOpenBrace(text, braceIdx);
  }
  console.log("OK forge guard injecté dans", braces.length, "requireAuth");
}

if (text === original) {
  console.log("Aucun changement (déjà à jour ?)");
  process.exit(0);
}

const backup = serverPath + ".bak.forgeauth." + Date.now();
fs.writeFileSync(backup, original);
fs.writeFileSync(serverPath, text);
console.log("Sauvegarde:", backup);
console.log("OK requireAuth accepte session forge (req.session.user)");
