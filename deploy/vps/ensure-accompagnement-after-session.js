#!/usr/bin/env node
/**
 * Place TORINVEST_ACCOMPAGNEMENT_AUTH APRÈS express-session.
 *
 * Bug prod : monté trop tôt → req.session undefined →
 * "Session serveur indisponible" / session_missing sur /api/login.
 *
 * Usage : node deploy/vps/ensure-accompagnement-after-session.js /home/ubuntu/torinvest-formation
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

let content = fs.readFileSync(serverPath, "utf8");
const original = content;

const standaloneBlock = [
  "/* TORINVEST_ACCOMPAGNEMENT_AUTH_BEGIN */",
  "const createFormationAuthRouter = require(\"./server-patches/routes-formation-auth\");",
  "app.use(",
  "  createFormationAuthRouter({",
  "    dataDir: path.join(__dirname, \"data\"),",
  "    workerUrl: process.env.FORGE_WORKER_URL || process.env.WORKER_URL || \"https://morning-hall-d8f6.onzerimes.workers.dev\",",
  "    provisionSecret: process.env.FORGE_FORMATION_PROVISION_SECRET,",
  "  })",
  ");",
  "/* TORINVEST_ACCOMPAGNEMENT_AUTH_END */",
  "",
].join("\n");

function findInsertAfterSession(text) {
  const sessionUse = text.match(/app\.use\s*\(\s*session\s*\(/m);
  if (!sessionUse || sessionUse.index < 0) return -1;

  let i = sessionUse.index;
  let depth = 0;
  let started = false;
  for (; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(") {
      depth += 1;
      started = true;
    } else if (ch === ")") {
      depth -= 1;
      if (started && depth === 0) {
        let end = i + 1;
        while (end < text.length && /[\s;]/.test(text[end])) end += 1;
        return end;
      }
    }
  }
  return -1;
}

function stripAll(text) {
  let out = text;
  let n = 0;
  const markedRe =
    /\/\* TORINVEST_ACCOMPAGNEMENT_AUTH_BEGIN \*\/[\s\S]*?\/\* TORINVEST_ACCOMPAGNEMENT_AUTH_END \*\/\s*/g;
  const marked = (out.match(markedRe) || []).length;
  if (marked) {
    out = out.replace(markedRe, "");
    n += marked;
    console.log("OK — " + marked + " bloc(s) ACCOMPAGNEMENT_AUTH retiré(s)");
  }
  // Orphelins
  const reqRe =
    /\n?const createFormationAuthRouter = require\(["']\.\/server-patches\/routes-formation-auth["']\);\s*/g;
  const reqN = (out.match(reqRe) || []).length;
  if (reqN) {
    out = out.replace(reqRe, "\n");
    n += reqN;
  }
  const useRe = /\n?app\.use\(\s*createFormationAuthRouter\(\{[\s\S]*?\}\)\s*\);\s*/g;
  const useN = (out.match(useRe) || []).length;
  if (useN) {
    out = out.replace(useRe, "\n");
    n += useN;
    console.log("OK — " + useN + " app.use formation-auth orphelin(s) retiré(s)");
  }
  return { out, n };
}

const stripped = stripAll(content);
content = stripped.out;

let insertAt = findInsertAfterSession(content);
if (insertAt < 0) {
  // Repli : juste avant /api/login
  const loginRe = /app\.post\s*\(\s*["']\/api\/login["']/m;
  const m = content.match(loginRe);
  if (m && m.index >= 0) {
    insertAt = m.index;
    console.warn("WARN — express-session introuvable ; insertion avant /api/login");
  }
}

if (insertAt < 0) {
  console.error("ERREUR: ni session ni /api/login trouvés dans server.js");
  process.exit(1);
}

// Vérifier que l'insertion est bien APRÈS session si session existe
const sessionAt = (() => {
  const m = content.match(/app\.use\s*\(\s*session\s*\(/m);
  return m ? m.index : -1;
})();
if (sessionAt >= 0 && insertAt <= sessionAt) {
  console.error("ERREUR: point d'insertion avant session — abort");
  process.exit(1);
}

content = content.slice(0, insertAt) + standaloneBlock + content.slice(insertAt);
console.log("OK — bloc accompagnement inséré APRÈS express-session (insertAt=" + insertAt + ")");

if (!/require\(["']path["']\)/.test(content) && !/require\(['"]path['"]\)/.test(content)) {
  content = 'const path = require("path");\n' + content;
  console.log("OK — require('path') ajouté");
}

const mounts = (content.match(/app\.use\(\s*createFormationAuthRouter/g) || []).length;
if (mounts !== 1) {
  console.error("ERREUR: " + mounts + " montages createFormationAuthRouter — attendu 1");
  process.exit(1);
}

if (content === original) {
  console.log("Aucun changement");
  process.exit(0);
}

const backup = serverPath + ".bak." + Date.now();
fs.writeFileSync(backup, original);
fs.writeFileSync(serverPath, content);

try {
  execSync("node --check " + JSON.stringify(serverPath), { stdio: "pipe" });
} catch (e) {
  fs.writeFileSync(serverPath, original);
  console.error("ERREUR: server.js invalide — restauré");
  process.exit(1);
}

console.log("Sauvegarde:", backup);
console.log("→ pm2 restart la-forge --update-env");
