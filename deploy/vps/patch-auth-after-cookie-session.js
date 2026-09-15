#!/usr/bin/env node
/**
 * Place shim req.session + pont auth formation.
 * Cas VPS réel : server.js utilise COOKIE_NAME / torinvest_session (pas express-session).
 * → on injecte forge-session-shim puis routes-formation-auth avant /api/login.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const APP_DIR = process.argv[2] || "/home/ubuntu/torinvest-formation";
const serverPath = path.join(APP_DIR, "server.js");

if (!fs.existsSync(serverPath)) {
  console.error("ERREUR:", serverPath, "introuvable");
  process.exit(1);
}

let text = fs.readFileSync(serverPath, "utf8");
const original = text;

const block = [
  "/* TORINVEST_ACCOMPAGNEMENT_AUTH_BEGIN */",
  '(function () {',
  '  const createForgeSessionShim = require("./server-patches/forge-session-shim");',
  '  const createFormationAuthRouter = require("./server-patches/routes-formation-auth");',
  '  app.use(createForgeSessionShim({',
  '    secret: process.env.FORGE_SESSION_SECRET || process.env.SESSION_SECRET || process.env.FORGE_FORMATION_PROVISION_SECRET,',
  "  }));",
  "  app.use(",
  "    createFormationAuthRouter({",
  '      dataDir: path.join(__dirname, "data"),',
  '      workerUrl: process.env.FORGE_WORKER_URL || process.env.WORKER_URL || "https://morning-hall-d8f6.onzerimes.workers.dev",',
  "      provisionSecret: process.env.FORGE_FORMATION_PROVISION_SECRET,",
  "    })",
  "  );",
  "})();",
  "/* TORINVEST_ACCOMPAGNEMENT_AUTH_END */",
  "",
].join("\n");

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

function stripAuth(s) {
  let out = s.replace(
    /\/\* TORINVEST_ACCOMPAGNEMENT_AUTH_BEGIN \*\/[\s\S]*?\/\* TORINVEST_ACCOMPAGNEMENT_AUTH_END \*\/\s*/g,
    ""
  );
  out = out.replace(
    /\n?const createFormationAuthRouter = require\(["']\.\/server-patches\/routes-formation-auth["']\);\s*/g,
    "\n"
  );
  out = out.replace(/\n?app\.use\(\s*createFormationAuthRouter\(\{[\s\S]*?\}\)\s*\);\s*/g, "\n");
  out = out.replace(
    /\n?const createForgeSessionShim = require\(["']\.\/server-patches\/forge-session-shim["']\);\s*/g,
    "\n"
  );
  out = out.replace(/\n?app\.use\(\s*createForgeSessionShim\(\{[\s\S]*?\}\)\s*\);\s*/g, "\n");
  return out;
}

function findSessionInsert(s) {
  const candidates = [];

  const direct = [
    /app\.use\s*\(\s*session\s*\(/g,
    /app\.use\s*\(\s*expressSession\s*\(/g,
    /app\.use\s*\(\s*cookieSession\s*\(/g,
    /app\.use\s*\(\s*require\s*\(\s*["']express-session["']\s*\)\s*\(/g,
  ];
  for (const re of direct) {
    let m;
    while ((m = re.exec(s))) {
      const open = s.indexOf("(", m.index);
      const end = endOfCall(s, open);
      if (end > 0) candidates.push({ end, why: "direct:" + m[0].slice(0, 30) });
    }
  }

  const assignRe =
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:session|expressSession|cookieSession)\s*\(/g;
  let am;
  while ((am = assignRe.exec(s))) {
    const name = am[1];
    const useRe = new RegExp("app\\.use\\s*\\(\\s*" + name.replace(/\$/g, "\\$") + "\\s*\\)", "g");
    let um;
    while ((um = useRe.exec(s))) {
      let end = um.index + um[0].length;
      while (end < s.length && /[\s;]/.test(s[end])) end++;
      candidates.push({ end, why: "assign-use:" + name });
    }
  }

  // cookie-parser (souvent requis avant notre shim)
  const cpRe = /app\.use\s*\(\s*(?:cookieParser|cookie-parser)\s*\(/g;
  let cpm;
  while ((cpm = cpRe.exec(s))) {
    const open = s.indexOf("(", cpm.index);
    const end = endOfCall(s, open);
    if (end > 0) candidates.push({ end, why: "cookie-parser" });
  }
  const cpAssign = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*require\s*\(\s*["']cookie-parser["']\s*\)/g;
  while ((am = cpAssign.exec(s))) {
    const name = am[1];
    const useRe = new RegExp("app\\.use\\s*\\(\\s*" + name.replace(/\$/g, "\\$") + "\\s*\\(", "g");
    let um;
    while ((um = useRe.exec(s))) {
      const open = s.indexOf("(", um.index);
      const end = endOfCall(s, open);
      if (end > 0) candidates.push({ end, why: "cookie-parser-var:" + name });
    }
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => a.end - b.end);
  return candidates[candidates.length - 1];
}

function findFallbackInsert(s) {
  // Avant le login natif (notre router doit répondre en premier)
  const loginRe = /app\.post\s*\(\s*["']\/api\/login["']/m;
  const m = loginRe.exec(s);
  if (m) return { end: m.index, why: "before-/api/login" };

  // Après déclaration COOKIE_NAME + premiers app.use
  const cookieDecl = /(?:const|let|var)\s+COOKIE_NAME\s*=/.exec(s);
  if (cookieDecl) {
    // chercher un app.use après cookie-parser / json près du début
    const after = s.slice(cookieDecl.index, cookieDecl.index + 8000);
    const useJson = /app\.use\s*\(\s*express\.json\s*\(/.exec(after);
    if (useJson) {
      const absOpen = cookieDecl.index + useJson.index;
      const open = s.indexOf("(", absOpen);
      const end = endOfCall(s, open);
      if (end > 0) return { end, why: "after-express.json-near-COOKIE_NAME" };
    }
  }

  // Dernier recours : juste après `const app = express()`
  const appDecl = /(?:const|let|var)\s+app\s*=\s*express\s*\(\s*\)\s*;?/.exec(s);
  if (appDecl) {
    return { end: appDecl.index + appDecl[0].length, why: "after-express()" };
  }
  return null;
}

console.log("==> Lignes session / cookie");
text.split("\n").forEach((line, i) => {
  if (/COOKIE_NAME|express-session|session\(|torinvest_session|cookie-parser|app\.use\(\s*session/i.test(line)) {
    console.log("  L" + (i + 1) + ": " + line.trim().slice(0, 140));
  }
});

text = stripAuth(text);
let found = findSessionInsert(text);
if (!found) {
  found = findFallbackInsert(text);
  if (found) {
    console.warn("WARN: pas d'express-session — insertion via", found.why);
    console.warn("      (shim forge-session-shim fournira req.session)");
  }
}
if (!found) {
  console.error("ERREUR: impossible de trouver un point d'insertion");
  console.error("grep -nE 'COOKIE_NAME|app.post|/api/login|app.use' server.js | head -80");
  process.exit(1);
}

console.log("OK insert:", found.why, "at", found.end);

let insertAt = found.end;
if (!/require\(["']path["']\)/.test(text)) {
  const add = 'const path = require("path");\n';
  text = add + text;
  insertAt += add.length;
}

text = text.slice(0, insertAt) + "\n" + block + text.slice(insertAt);

const mounts = (text.match(/createFormationAuthRouter/g) || []).length;
if (mounts < 1) {
  console.error("ERREUR mounts createFormationAuthRouter=", mounts);
  process.exit(1);
}

const shimPath = path.join(APP_DIR, "server-patches", "forge-session-shim.js");
if (!fs.existsSync(shimPath)) {
  console.error("ERREUR: manque", shimPath, "— déploie forge-session-shim.js d'abord");
  process.exit(1);
}

const backup = serverPath + ".bak." + Date.now();
fs.writeFileSync(backup, original);
fs.writeFileSync(serverPath, text);
try {
  execSync("node --check " + JSON.stringify(serverPath), { stdio: "pipe" });
} catch (e) {
  fs.writeFileSync(serverPath, original);
  console.error("ERREUR syntaxe — restauré");
  process.exit(1);
}
console.log("Sauvegarde:", backup);
console.log("OK server.js patché (shim session + auth formation)");
