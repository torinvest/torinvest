#!/usr/bin/env node
/**
 * Place TORINVEST_ACCOMPAGNEMENT_AUTH juste AVANT app.post('/api/login')
 * (après express-session dans server.js standard).
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

let content = fs.readFileSync(serverPath, "utf8");
const original = content;

const blockRe =
  /\/\* TORINVEST_ACCOMPAGNEMENT_AUTH_BEGIN \*\/[\s\S]*?\/\* TORINVEST_ACCOMPAGNEMENT_AUTH_END \*\/\s*/;
const loginRe = /app\.post\s*\(\s*["']\/api\/login["']/m;

let block = null;
const existing = content.match(blockRe);
if (existing) {
  block = existing[0];
  content = content.slice(0, existing.index) + content.slice(existing.index + block.length);
}

if (!block) {
  block = [
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
  console.log("Bloc accompagnement absent — création du bloc standard.");
}

const loginMatch = content.match(loginRe);
if (!loginMatch || loginMatch.index < 0) {
  console.error("ERREUR: app.post('/api/login') introuvable dans server.js");
  console.error("→ Édition manuelle requise ou envoyer server.js au support.");
  process.exit(1);
}

const insertAt = loginMatch.index;
const alreadyThere =
  content.slice(Math.max(0, insertAt - 400), insertAt).includes("ACCOMPAGNEMENT_AUTH_BEGIN");

if (alreadyThere) {
  console.log("OK — bloc accompagnement déjà juste avant /api/login");
  if (content !== original) {
    const backup = serverPath + ".bak." + Date.now();
    fs.writeFileSync(backup, original);
    fs.writeFileSync(serverPath, content);
    console.log("Sauvegarde:", backup);
  }
  process.exit(0);
}

const backup = serverPath + ".bak." + Date.now();
fs.writeFileSync(backup, original);
const newContent = content.slice(0, insertAt) + block + content.slice(insertAt);
fs.writeFileSync(serverPath, newContent);

try {
  require("child_process").execSync("node --check " + JSON.stringify(serverPath), { stdio: "pipe" });
} catch (e) {
  fs.writeFileSync(serverPath, original);
  console.error("ERREUR: server.js invalide après patch — restauré");
  process.exit(1);
}

console.log("OK — bloc placé avant app.post('/api/login')");
console.log("Sauvegarde:", backup);
