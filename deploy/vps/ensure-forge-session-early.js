#!/usr/bin/env node
/**
 * Place forge-session-shim le plus tôt possible (après cookie-parser / json),
 * AVANT tout requireAuth qui protège dashboard.html — sinon boucle login↔dashboard.
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

const SHIM_BEGIN = "/* TORINVEST_FORGE_SESSION_SHIM_BEGIN */";
const SHIM_END = "/* TORINVEST_FORGE_SESSION_SHIM_END */";

const shimBlock = [
  SHIM_BEGIN,
  '(function () {',
  '  try {',
  '    const createForgeSessionShim = require("./server-patches/forge-session-shim");',
  '    app.use(createForgeSessionShim({',
  '      secret: process.env.FORGE_SESSION_SECRET || process.env.SESSION_SECRET || process.env.FORGE_FORMATION_PROVISION_SECRET,',
  "    }));",
  '  } catch (e) { console.error("[forge-session-shim]", e && e.message ? e.message : e); }',
  "})();",
  SHIM_END,
  "",
].join("\n");

// Retirer ancien shim isolé + doublons dans ACCOMPAGNEMENT block (on laisse auth, on extrait shim)
text = text.replace(
  new RegExp(SHIM_BEGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[\\s\\S]*?" + SHIM_END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*", "g"),
  ""
);

// Si le bloc ACCOMPAGNEMENT embarque encore createForgeSessionShim, le laisser (double app.use ok:
// shim no-op si req.session déjà là). On ajoute quand même un shim EARLY.

function endOfCall(s, openIdx) {
  let depth = 0;
  let started = false;
  for (let i = openIdx; i < s.length; i++) {
    if (s[i] === "(") {
      depth++;
      started = true;
    } else if (s[i] === ")") {
      depth--;
      if (started && depth === 0) {
        let end = i + 1;
        while (end < s.length && /[\s;]/.test(s[end])) end++;
        return end;
      }
    }
  }
  return -1;
}

function findEarlyInsert(s) {
  const patterns = [
    /app\.use\s*\(\s*(?:cookieParser|cookie-parser)\s*\(/,
    /app\.use\s*\(\s*express\.json\s*\(/,
    /app\.use\s*\(\s*express\.urlencoded\s*\(/,
  ];
  let best = -1;
  for (const re of patterns) {
    const m = re.exec(s);
    if (!m) continue;
    const open = s.indexOf("(", m.index);
    const end = endOfCall(s, open);
    if (end > best) best = end;
  }
  if (best > 0) return { at: best, why: "after-cookie/json" };

  const appDecl = /(?:const|let|var)\s+app\s*=\s*express\s*\(\s*\)\s*;?/.exec(s);
  if (appDecl) return { at: appDecl.index + appDecl[0].length, why: "after-express()" };
  return null;
}

const insert = findEarlyInsert(text);
if (!insert) {
  console.error("ERREUR: point d'insertion early introuvable");
  process.exit(1);
}

console.log("OK early shim insert:", insert.why, "at", insert.at);
text = text.slice(0, insert.at) + "\n" + shimBlock + text.slice(insert.at);

if (!/require\(["']path["']\)/.test(text)) {
  text = 'const path = require("path");\n' + text;
}

const backup = serverPath + ".bak.shim." + Date.now();
fs.writeFileSync(backup, original);
fs.writeFileSync(serverPath, text);
console.log("Sauvegarde:", backup);
console.log("OK forge-session-shim monté tôt (avant requireAuth / static)");
