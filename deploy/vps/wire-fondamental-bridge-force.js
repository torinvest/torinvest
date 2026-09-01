#!/usr/bin/env node
/**
 * Force le montage fondamental-bridge dans server.js (avant app.listen).
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const APP_DIR = process.argv[2] || process.env.APP_DIR || "/home/ubuntu/torinvest-formation";
const serverPath = path.join(APP_DIR, "server.js");

if (!fs.existsSync(serverPath)) {
  console.error("ERREUR:", serverPath, "introuvable");
  process.exit(1);
}

let content = fs.readFileSync(serverPath, "utf8");
const original = content;

const standaloneBlock = [
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

function stripAll(text) {
  let out = text;
  out = out.replace(
    /\/\* TORINVEST_FONDAMENTAL_BRIDGE_BEGIN \*\/[\s\S]*?\/\* TORINVEST_FONDAMENTAL_BRIDGE_END \*\/\s*/g,
    ""
  );
  const pm = out.match(
    /\/\* TORINVEST_FORMATION_PATCHES_BEGIN \*\/[\s\S]*?\/\* TORINVEST_FORMATION_PATCHES_END \*\/\s*/
  );
  if (pm) {
    let block = pm[0];
    block = block.replace(/\n?const createFondamentalBridgeRouter = require\([^)]+\);\s*/g, "");
    block = block.replace(/\n?app\.use\(\s*createFondamentalBridgeRouter\(\{[\s\S]*?\}\)\s*\);\s*/g, "");
    block = block.replace(/\n?app\.use\(createFondamentalBridgeRouter\(\{[^}]*\}\)\);\s*/g, "");
    out = out.slice(0, pm.index) + block + out.slice(pm.index + pm[0].length);
  }
  out = out.replace(
    /\n?const createFondamentalBridgeRouter = require\(["']\.\/server-patches\/routes-fondamental-bridge["']\);\s*/g,
    "\n"
  );
  out = out.replace(/\n?app\.use\(\s*createFondamentalBridgeRouter\(\{[\s\S]*?\}\)\s*\);\s*/g, "\n");
  out = out.replace(/\n?app\.use\(createFondamentalBridgeRouter\(\{[^}]*\}\)\);\s*/g, "\n");
  return out;
}

function afterMarker(text, marker) {
  const idx = text.indexOf(marker);
  if (idx < 0) return -1;
  let at = idx + marker.length;
  const nl = text.indexOf("\n", at);
  return nl >= 0 ? nl + 1 : at;
}

function findInsertPoint(text) {
  const acc = afterMarker(text, "/* TORINVEST_ACCOMPAGNEMENT_AUTH_END */");
  if (acc >= 0) return { at: acc, why: "after accompagnement auth" };

  const login = text.match(/app\.post\s*\(\s*["']\/api\/login["']/m);
  if (login && login.index >= 0) return { at: login.index, why: "before /api/login" };

  const listen = text.match(/app\.listen\s*\(/m);
  if (listen && listen.index >= 0) return { at: listen.index, why: "before app.listen" };

  return { at: -1, why: "" };
}

function countMounts(text) {
  return (text.match(/app\.use\(\s*createFondamentalBridgeRouter/g) || []).length;
}

content = stripAll(content);
const mountsAfterStrip = countMounts(content);
if (mountsAfterStrip > 0) {
  console.error("ERREUR: nettoyage incomplet, montages restants:", mountsAfterStrip);
  process.exit(1);
}

const { at, why } = findInsertPoint(content);
if (at < 0) {
  console.error("ERREUR: point d'insertion introuvable");
  process.exit(1);
}

content = content.slice(0, at) + standaloneBlock + content.slice(at);
console.log("OK — bloc fondamental inséré (" + why + ", at=" + at + ")");

if (countMounts(content) !== 1) {
  console.error("ERREUR: montages après insert:", countMounts(content));
  process.exit(1);
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
