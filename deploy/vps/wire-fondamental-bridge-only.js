#!/usr/bin/env node
/**
 * Ajoute uniquement routes-fondamental-bridge si absent (sans toucher le reste).
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const APP_DIR = process.argv[2] || "/home/ubuntu/torinvest-formation";
const serverPath = ["server.js", "app.js", "index.js"]
  .map((n) => path.join(APP_DIR, n))
  .find((p) => fs.existsSync(p));

if (!serverPath) {
  console.error("ERREUR : server.js introuvable dans", APP_DIR);
  process.exit(1);
}

let content = fs.readFileSync(serverPath, "utf8");
const original = content;

if (/createFondamentalBridgeRouter|routes-fondamental-bridge/.test(content)) {
  console.log("OK — fondamental-bridge déjà dans", serverPath);
  process.exit(0);
}

const MARK_BEGIN = "/* TORINVEST_FONDAMENTAL_BRIDGE_BEGIN */";
const MARK_END = "/* TORINVEST_FONDAMENTAL_BRIDGE_END */";

const block = [
  MARK_BEGIN,
  "const createFondamentalBridgeRouter = require(\"./server-patches/routes-fondamental-bridge\");",
  "app.use(",
  "  createFondamentalBridgeRouter({",
  "    bridgeSecret: process.env.FORGE_FONDAMENTAL_BRIDGE_SECRET || process.env.AI_ACCESS_HMAC_SECRET,",
  "  })",
  ");",
  MARK_END,
  "",
].join("\n");

let insertPoint = -1;
const markers = [
  "/* TORINVEST_ACCOMPAGNEMENT_AUTH_END */",
  "/* TORINVEST_FORMATION_PATCHES_END */",
  "app.post(\"/api/login\"",
  "app.post('/api/login'",
  "express.static(",
  "express.static",
];

for (const marker of markers) {
  const idx = content.indexOf(marker);
  if (idx >= 0) {
    insertPoint = idx + marker.length;
    if (marker.includes("END */")) {
      const after = content.slice(insertPoint);
      const nl = after.indexOf("\n");
      insertPoint = insertPoint + (nl >= 0 ? nl + 1 : 0);
    }
    break;
  }
}

if (insertPoint < 0) {
  console.error("ERREUR : point d'insertion introuvable.");
  process.exit(1);
}

content = content.slice(0, insertPoint) + "\n" + block + content.slice(insertPoint);
console.log("Bloc fondamental-bridge inséré dans", serverPath);

const backup = serverPath + ".bak." + Date.now();
fs.writeFileSync(backup, original);
fs.writeFileSync(serverPath, content);

try {
  execSync("node --check " + JSON.stringify(serverPath), { stdio: "pipe" });
} catch (e) {
  fs.writeFileSync(serverPath, original);
  console.error("ERREUR : server.js invalide — restauré.");
  process.exit(1);
}

console.log("Sauvegarde :", backup);
console.log("→ pm2 restart la-forge --update-env");
