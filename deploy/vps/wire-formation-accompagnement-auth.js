#!/usr/bin/env node
/**
 * Monte le router auth accompagnement (login formation ≠ membre site www).
 * Insère AVANT express.static('public') ou le bloc TORINVEST_FORMATION_PATCHES.
 *
 * Usage :
 *   node deploy/vps/wire-formation-accompagnement-auth.js /home/ubuntu/torinvest-formation
 */
"use strict";

const fs = require("fs");
const path = require("path");

const APP_DIR = process.argv[2] || "/home/ubuntu/torinvest-formation";
const candidates = ["server.js", "app.js", "index.js"];

let serverPath = null;
for (const name of candidates) {
  const p = path.join(APP_DIR, name);
  if (fs.existsSync(p)) {
    serverPath = p;
    break;
  }
}

if (!serverPath) {
  console.error("ERREUR : aucun server.js dans", APP_DIR);
  process.exit(1);
}

let content = fs.readFileSync(serverPath, "utf8");
const original = content;

const MARK_BEGIN = "/* TORINVEST_ACCOMPAGNEMENT_AUTH_BEGIN */";
const MARK_END = "/* TORINVEST_ACCOMPAGNEMENT_AUTH_END */";

function dataDirExpr() {
  const m = content.match(/dataDir:\s*([\s\S]*?),\s*requireAuth/m);
  if (m) return m[1].replace(/\s+/g, " ").trim();
  if (/path\.join\(__dirname,\s*["']data["']\)/.test(content)) {
    return "path.join(__dirname, \"data\")";
  }
  return "path.join(__dirname, \"data\")";
}

function authBlock(expr) {
  return [
    MARK_BEGIN,
    "const createFormationAuthRouter = require(\"./server-patches/routes-formation-auth\");",
    "app.use(",
    "  createFormationAuthRouter({",
    "    dataDir: " + expr + ",",
    "    workerUrl: process.env.FORGE_WORKER_URL || process.env.WORKER_URL || \"https://morning-hall-d8f6.onzerimes.workers.dev\",",
    "    provisionSecret: process.env.FORGE_FORMATION_PROVISION_SECRET,",
    "  })",
    ");",
    MARK_END,
    "",
  ].join("\n");
}

if (content.includes(MARK_BEGIN) && content.includes(MARK_END)) {
  const block = authBlock(dataDirExpr());
  content = content.replace(
    new RegExp(
      MARK_BEGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
        "[\\s\\S]*?" +
        MARK_END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    ),
    block.trimEnd()
  );
  console.log("Bloc TORINVEST_ACCOMPAGNEMENT_AUTH mis à jour.");
} else if (/createFormationAuthRouter|routes-formation-auth/.test(content)) {
  const relocate = path.join(APP_DIR, "deploy/vps/relocate-accompagnement-auth.js");
  if (fs.existsSync(relocate)) {
    const { execSync } = require("child_process");
    execSync("node " + JSON.stringify(relocate) + " " + JSON.stringify(APP_DIR), { stdio: "inherit" });
    process.exit(0);
  }
  console.log("OK — accompagnement auth déjà présent dans", serverPath);
  process.exit(0);
} else {
  const loginRe = /app\.post\s*\(\s*["']\/api\/login["']/m;
  const loginMatch = content.match(loginRe);
  let insertPoint = -1;
  if (loginMatch && loginMatch.index >= 0) {
    insertPoint = loginMatch.index;
  } else {
    const insertMarkers = [
      "/* TORINVEST_FORMATION_PATCHES_BEGIN */",
      "express.static",
      "app.listen",
    ];
    for (const marker of insertMarkers) {
      const idx = content.indexOf(marker);
      if (idx >= 0) {
        insertPoint = idx;
        break;
      }
    }
  }
  if (insertPoint < 0) {
    console.error("ERREUR : point d'insertion introuvable.");
    process.exit(1);
  }

  const needsPath = !/require\(["']path["']\)/.test(content);
  const prefix = needsPath ? "const path = require(\"path\");\n" : "";
  content =
    content.slice(0, insertPoint) + prefix + authBlock(dataDirExpr()) + content.slice(insertPoint);
  console.log(
    loginMatch ? "Bloc accompagnement auth inséré (avant app.post(/api/login))." : "Bloc accompagnement auth inséré."
  );
}

if (content === original) {
  console.log("Aucun changement.");
  process.exit(0);
}

const backup = serverPath + ".bak." + Date.now();
fs.writeFileSync(backup, original);

function syntaxOk() {
  try {
    const { execSync } = require("child_process");
    execSync("node --check " + JSON.stringify(serverPath), { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

fs.writeFileSync(serverPath, content);
if (!syntaxOk()) {
  fs.writeFileSync(serverPath, original);
  console.error("ERREUR : server.js invalide — restauré.");
  process.exit(1);
}

console.log("Sauvegarde :", backup);
console.log("Modifié :", serverPath);
console.log("→ export FORGE_FORMATION_PROVISION_SECRET=... (identique radar api/config.local.php)");
console.log("→ pm2 restart la-forge");
