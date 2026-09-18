#!/usr/bin/env node
/**
 * Rétablit l'accès /dashboard.html pour les sessions forge.
 *
 * Deux filets (les deux sont appliqués) :
 * 1) requireAuth accepte req.session.user (cookie torinvest_forge_sess)
 * 2) GET /dashboard.html servi tôt sans requireAuth natif (gate client getMe)
 *    — même modèle que start.html / calendar.html déjà en 200 public
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
const MARK_MW_B = "/* TORINVEST_DASHBOARD_PUBLIC_BEGIN */";
const MARK_MW_E = "/* TORINVEST_DASHBOARD_PUBLIC_END */";

function stripMarked(src, begin, end) {
  return src.replace(
    new RegExp(
      begin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
        "[\\s\\S]*?" +
        end.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
        "\\s*",
      "g"
    ),
    ""
  );
}

text = stripMarked(text, MARK_BEGIN, MARK_END);
text = stripMarked(text, MARK_MW_B, MARK_MW_E);

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

function injectAfterOpenBrace(src, openBraceIdx) {
  let i = openBraceIdx + 1;
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
    /(?:const|let|var)\s+requireAuth\s*=\s*async\s+function\s*\(\s*req\s*,\s*res\s*,\s*next\s*\)\s*\{/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(src))) {
      hits.push(m.index + m[0].length - 1);
    }
  }
  return [...new Set(hits)].sort((a, b) => b - a);
}

const braces = findRequireAuthBodies(text);
if (braces.length) {
  for (const braceIdx of braces) {
    text = injectAfterOpenBrace(text, braceIdx);
  }
  console.log("OK forge guard injecté dans", braces.length, "requireAuth");
} else {
  console.warn("WARN: définition requireAuth introuvable — filet public dashboard seulement");
}

// Toujours : route publique dashboard (avant middleware auth)
const mw = [
  MARK_MW_B,
  "(function () {",
  '  const __path = require("path");',
  '  const __fs = require("fs");',
  '  const dashFile = __path.join(__dirname, "public", "dashboard.html");',
  "  function sendDash(req, res, next) {",
  "    if (!__fs.existsSync(dashFile)) return next();",
  "    return res.sendFile(dashFile, function (err) { if (err) next(err); });",
  "  }",
  '  app.get(["/dashboard.html", "/dashboard"], sendDash);',
  "  // Si un middleware global redirige encore, court-circuiter avant",
  "  app.use(function forgeDashPublic(req, res, next) {",
  '    const p = String(req.path || "").split("?")[0];',
  '    if (p !== "/dashboard.html" && p !== "/dashboard") return next();',
  "    return sendDash(req, res, next);",
  "  });",
  "})();",
  MARK_MW_E,
  "",
].join("\n");

function findEarlyInsert(s) {
  const appDecl = /(?:const|let|var)\s+app\s*=\s*express\s*\(\s*\)\s*;?/.exec(s);
  if (appDecl) return appDecl.index + appDecl[0].length;

  // Après cookie-parser / json si pas d'express() clair
  const patterns = [
    /app\.use\s*\(\s*(?:cookieParser|cookie-parser)\s*\(/,
    /app\.use\s*\(\s*express\.json\s*\(/,
  ];
  function endOfCall(str, openIdx) {
    let depth = 0;
    let started = false;
    for (let i = openIdx; i < str.length; i++) {
      if (str[i] === "(") {
        depth++;
        started = true;
      } else if (str[i] === ")") {
        depth--;
        if (started && depth === 0) {
          let end = i + 1;
          while (end < str.length && /[\s;]/.test(str[end])) end++;
          return end;
        }
      }
    }
    return -1;
  }
  for (const re of patterns) {
    const m = re.exec(s);
    if (!m) continue;
    const open = s.indexOf("(", m.index);
    const end = endOfCall(s, open);
    if (end > 0) return end;
  }
  return -1;
}

const insertAt = findEarlyInsert(text);
if (insertAt < 0) {
  console.error("ERREUR: point d'insertion dashboard public introuvable");
  process.exit(1);
}
text = text.slice(0, insertAt) + "\n" + mw + text.slice(insertAt);
console.log("OK route GET /dashboard.html publique (gate client) @", insertAt);

if (text === original) {
  console.log("Aucun changement");
  process.exit(0);
}

const backup = serverPath + ".bak.forgeauth." + Date.now();
fs.writeFileSync(backup, original);
fs.writeFileSync(serverPath, text);
console.log("Sauvegarde:", backup);
console.log("OK dashboard access patch appliqué");
