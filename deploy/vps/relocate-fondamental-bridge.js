#!/usr/bin/env node
/**
 * Place TORINVEST_FONDAMENTAL_BRIDGE après ACCOMPAGNEMENT_AUTH (session express active).
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

const blockRe =
  /\/\* TORINVEST_FONDAMENTAL_BRIDGE_BEGIN \*\/[\s\S]*?\/\* TORINVEST_FONDAMENTAL_BRIDGE_END \*\/\s*/;

let block = null;
const existing = content.match(blockRe);
if (existing) {
  block = existing[0];
  content = content.slice(0, existing.index) + content.slice(existing.index + block.length);
}

if (!block) {
  block = [
    "/* TORINVEST_FONDAMENTAL_BRIDGE_BEGIN */",
    "const createFondamentalBridgeRouter = require(\"./server-patches/routes-fondamental-bridge\");",
    "app.use(",
    "  createFondamentalBridgeRouter({",
    "    bridgeSecret: process.env.FORGE_FONDAMENTAL_BRIDGE_SECRET || process.env.AI_ACCESS_HMAC_SECRET,",
    "  })",
    ");",
    "/* TORINVEST_FONDAMENTAL_BRIDGE_END */",
    "",
  ].join("\n");
  console.log("Bloc fondamental absent — création du bloc standard.");
}

const markers = [
  "/* TORINVEST_ACCOMPAGNEMENT_AUTH_END */",
  /app\.post\s*\(\s*["']\/api\/login["']/m,
];

let insertAt = -1;
const accEnd = content.indexOf("/* TORINVEST_ACCOMPAGNEMENT_AUTH_END */");
if (accEnd >= 0) {
  insertAt = accEnd + "/* TORINVEST_ACCOMPAGNEMENT_AUTH_END */".length;
  const after = content.slice(insertAt);
  const nl = after.indexOf("\n");
  insertAt = insertAt + (nl >= 0 ? nl + 1 : 0);
} else {
  const loginRe = /app\.post\s*\(\s*["']\/api\/login["']/m;
  const m = content.match(loginRe);
  if (m && m.index >= 0) insertAt = m.index;
}

if (insertAt < 0) {
  console.error("ERREUR: point d'insertion introuvable (ACCOMPAGNEMENT_AUTH_END ou /api/login)");
  process.exit(1);
}

const before = content.slice(Math.max(0, insertAt - 500), insertAt);
if (before.includes("FONDAMENTAL_BRIDGE_BEGIN")) {
  console.log("OK — bloc fondamental déjà après accompagnement auth");
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
  execSync("node --check " + JSON.stringify(serverPath), { stdio: "pipe" });
} catch (e) {
  fs.writeFileSync(serverPath, original);
  console.error("ERREUR: server.js invalide — restauré");
  process.exit(1);
}

console.log("OK — bloc fondamental placé après accompagnement auth (req.session OK)");
console.log("Sauvegarde:", backup);
