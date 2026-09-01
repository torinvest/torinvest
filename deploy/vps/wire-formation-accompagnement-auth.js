#!/usr/bin/env node
/**
 * Monte le router auth accompagnement (login formation ≠ membre site www).
 * Insère AVANT app.post('/api/login') si trouvé, sinon avant patches formation.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

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

function hasPathRequire(src) {
  return /require\s*\(\s*["'](?:node:)?path["']\s*\)/.test(src);
}

function dataDirExpr() {
  const m = content.match(/dataDir:\s*path\.join\(__dirname,\s*["']data["']\)/);
  if (m) return m[0].replace(/^dataDir:\s*/, "");
  const loose = content.match(/dataDir:\s*([\s\S]*?),\s*requireAuth/m);
  if (loose) {
    const expr = loose[1].replace(/\s+/g, " ").trim();
    if (expr.includes("requireAuth")) {
      return "path.join(__dirname, \"data\")";
    }
    return expr;
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

function findInsertPoint() {
  const loginRe = /app\.post\s*\(\s*["']\/api\/login["']/m;
  const loginMatch = content.match(loginRe);
  if (loginMatch && loginMatch.index >= 0) {
    return { index: loginMatch.index, label: "avant app.post(/api/login)" };
  }
  const markers = [
    "/* TORINVEST_FORMATION_PATCHES_BEGIN */",
    "express.static(",
    "express.static",
    "app.listen(",
  ];
  for (const marker of markers) {
    const idx = content.indexOf(marker);
    if (idx >= 0) {
      return { index: idx, label: "avant " + marker };
    }
  }
  return null;
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
  console.log("OK — accompagnement auth déjà présent dans", serverPath);
  process.exit(0);
} else {
  const spot = findInsertPoint();
  if (!spot) {
    console.error("ERREUR : point d'insertion introuvable (login / patches / static).");
    process.exit(1);
  }
  const prefix = hasPathRequire(content) ? "" : "const path = require(\"path\");\n";
  content =
    content.slice(0, spot.index) +
    prefix +
    authBlock(dataDirExpr()) +
    content.slice(spot.index);
  console.log("Bloc accompagnement auth inséré (" + spot.label + ").");
}

if (content === original) {
  console.log("Aucun changement.");
  process.exit(0);
}

const backup = serverPath + ".bak." + Date.now();
fs.writeFileSync(backup, original);

function syntaxOk() {
  try {
    execSync("node --check " + JSON.stringify(serverPath), { stdio: "pipe" });
    return true;
  } catch (e) {
    return e.stderr ? e.stderr.toString() : String(e);
  }
}

fs.writeFileSync(serverPath, content);
const check = syntaxOk();
if (check !== true) {
  fs.writeFileSync(serverPath, original);
  console.error("ERREUR : server.js invalide après patch — restauré.");
  console.error(check);
  console.error("Sauvegarde inchangée :", backup);
  process.exit(1);
}

console.log("Sauvegarde :", backup);
console.log("Modifié :", serverPath);
console.log("→ export FORGE_FORMATION_PROVISION_SECRET=... (identique radar api/config.local.php)");
console.log("→ pm2 restart la-forge");
