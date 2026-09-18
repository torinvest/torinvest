#!/usr/bin/env node
/**
 * Rétablit l'accès /dashboard.html pour les sessions forge.
 *
 * 1) requireAuth accepte req.session.user
 * 2) Middleware PRIORITAIRE qui sert dashboard.html et ne fait JAMAIS next()
 *    (évite 302 si le fichier existe ; erreur claire s'il manque)
 * 3) Retire requireAuth des routes app.get(/dashboard.html, requireAuth, ...)
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

// Retirer requireAuth des handlers dashboard explicites
text = text.replace(
  /app\.get\(\s*(\[[^\]]*\/dashboard\.html[^\]]*\]|['"]\/dashboard\.html['"]|['"]\/dashboard['"])\s*,\s*requireAuth\s*,/g,
  "app.get($1, /* requireAuth removed TORINVEST */"
);

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

const mw = [
  MARK_MW_B,
  "(function () {",
  '  const __path = require("path");',
  '  const __fs = require("fs");',
  "  function resolveDashFile() {",
  "    const candidates = [",
  '      __path.join(__dirname, "public", "dashboard.html"),',
  '      __path.join(__dirname, "public", "la-forge", "dashboard.html"),',
  '      __path.join(process.cwd(), "public", "dashboard.html"),',
  "    ];",
  "    for (const f of candidates) {",
  "      if (__fs.existsSync(f)) return f;",
  "    }",
  "    return null;",
  "  }",
  "  function sendDash(req, res) {",
  "    const dashFile = resolveDashFile();",
  "    if (!dashFile) {",
  '      console.error("[forge-dash] dashboard.html introuvable sous public/");',
  '      return res.status(500).type("text").send("dashboard.html missing on server");',
  "    }",
  "    return res.sendFile(dashFile, function (err) {",
  "      if (err && !res.headersSent) {",
  '        console.error("[forge-dash] sendFile", err && err.message);',
  "        res.status(500).type('text').send('dashboard send failed');",
  "      }",
  "    });",
  "  }",
  "  // Premier middleware : ne JAMAIS next() pour dashboard (coupe tout requireAuth après)",
  "  app.use(function forgeDashPublicFirst(req, res, next) {",
  '    const p = String(req.path || req.url || "").split("?")[0];',
  '    if (p !== "/dashboard.html" && p !== "/dashboard") return next();',
  "    return sendDash(req, res);",
  "  });",
  "})();",
  MARK_MW_E,
  "",
].join("\n");

function findEarlyInsert(s) {
  const appDecl = /(?:const|let|var)\s+app\s*=\s*express\s*\(\s*\)\s*;?/.exec(s);
  if (appDecl) return appDecl.index + appDecl[0].length;

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
console.log("OK middleware dashboard PRIORITAIRE (no next) @", insertAt);

const dashOnDisk = path.join(APP_DIR, "public", "dashboard.html");
if (!fs.existsSync(dashOnDisk)) {
  console.warn("WARN: manque", dashOnDisk, "— le FIX script doit le télécharger avant restart");
} else {
  console.log("OK fichier présent:", dashOnDisk);
}

if (text === original) {
  console.log("Aucun changement");
  process.exit(0);
}

const backup = serverPath + ".bak.forgeauth." + Date.now();
fs.writeFileSync(backup, original);
fs.writeFileSync(serverPath, text);
console.log("Sauvegarde:", backup);
console.log("OK dashboard access patch appliqué");
