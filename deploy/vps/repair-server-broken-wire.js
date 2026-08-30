#!/usr/bin/env node
/**
 * Répare server.js après un wire cassé (path.join coupé au virgule).
 * Pattern typique ligne ~344 :
 *   dataDir: path.join(__dirname,
 *   requireAuth,
 *
 * Usage :
 *   node deploy/vps/repair-server-broken-wire.js /home/ubuntu/torinvest-formation
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const APP_DIR = process.argv[2] || "/home/ubuntu/torinvest-formation";
const serverPath = path.join(APP_DIR, "server.js");

if (!fs.existsSync(serverPath)) {
  console.error("ERREUR :", serverPath, "introuvable");
  process.exit(1);
}

let content = fs.readFileSync(serverPath, "utf8");
const original = content;

const fixes = [
  {
    name: "calendar dataDir path.join coupé",
    re: /createCalendarRouter\(\{\s*dataDir:\s*path\.join\(__dirname,\s*requireAuth,/g,
    rep: "createCalendarRouter({\n    dataDir: path.join(__dirname, \"data\"),\n    requireAuth,",
  },
  {
    name: "progress dataDir path.join coupé",
    re: /createProgressRouter\(\{\s*dataDir:\s*path\.join\(__dirname,\s*requireAuth,/g,
    rep: "createProgressRouter({\n    dataDir: path.join(__dirname, \"data\"),\n    requireAuth,",
  },
];

let changed = 0;
fixes.forEach((f) => {
  const before = content;
  content = content.replace(f.re, f.rep);
  if (content !== before) {
    console.log("Réparé :", f.name);
    changed++;
  }
});

if (!content.includes("trust proxy")) {
  const trust =
    "\n// Nginx reverse proxy (rate-limit / sessions)\napp.set(\"trust proxy\", 1);\n";
  const m = content.match(/const app = express\(\);?\s*\n/);
  if (m) {
    const idx = content.indexOf(m[0]) + m[0].length;
    content = content.slice(0, idx) + trust + content.slice(idx);
    console.log("Ajouté : app.set(\"trust proxy\", 1)");
    changed++;
  }
}

if (changed === 0) {
  console.log("Aucun pattern cassé détecté — vérifier ligne 344 manuellement :");
  console.log("  sed -n '338,350p' " + serverPath);
  try {
    execSync("node --check " + JSON.stringify(serverPath), { stdio: "inherit" });
    console.log("node --check : OK");
  } catch {
    console.error("node --check : ÉCHEC — utiliser recover-formation-server.sh");
    process.exit(1);
  }
  process.exit(0);
}

const backup = serverPath + ".repair." + Date.now();
fs.writeFileSync(backup, original);
fs.writeFileSync(serverPath, content);

try {
  execSync("node --check " + JSON.stringify(serverPath), { stdio: "pipe" });
} catch {
  fs.writeFileSync(serverPath, original);
  console.error("Réparation invalide — restauré. Backup :", backup);
  process.exit(1);
}

console.log("Backup :", backup);
console.log("OK — server.js réparé. → pm2 restart la-forge");
