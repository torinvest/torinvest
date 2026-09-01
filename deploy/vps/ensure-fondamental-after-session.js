#!/usr/bin/env node
/**
 * Un seul montage fondamental-bridge, APRÈS express-session.
 * Supprime les doublons (TORINVEST_FORMATION_PATCHES + TORINVEST_FONDAMENTAL_BRIDGE).
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

function removeFondamentalFromPatches(text) {
  let out = text;
  const patchesRe =
    /\/\* TORINVEST_FORMATION_PATCHES_BEGIN \*\/[\s\S]*?\/\* TORINVEST_FORMATION_PATCHES_END \*\/\s*/;
  const m = out.match(patchesRe);
  if (!m) return out;

  let block = m[0];
  const hadFb =
    /createFondamentalBridgeRouter|routes-fondamental-bridge/.test(block);

  block = block.replace(
    /\n?const createFondamentalBridgeRouter = require\([^)]+\);\s*/g,
    ""
  );
  block = block.replace(
    /\n?app\.use\(\s*createFondamentalBridgeRouter\(\{[\s\S]*?\}\)\s*\);\s*/g,
    ""
  );

  if (hadFb) {
    console.log("OK — fondamental retiré du bloc TORINVEST_FORMATION_PATCHES");
  }

  return out.slice(0, m.index) + block + out.slice(m.index + m[0].length);
}

const fbBlockRe =
  /\/\* TORINVEST_FONDAMENTAL_BRIDGE_BEGIN \*\/[\s\S]*?\/\* TORINVEST_FONDAMENTAL_BRIDGE_END \*\/\s*/g;

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

content = removeFondamentalFromPatches(content);

let removedStandalone = 0;
content = content.replace(fbBlockRe, () => {
  removedStandalone += 1;
  return "";
});

if (removedStandalone > 0) {
  console.log("OK — " + removedStandalone + " bloc(s) TORINVEST_FONDAMENTAL_BRIDGE supprimé(s)");
}

function findInsertAfterSession(text) {
  const sessionUse = text.match(/app\.use\s*\(\s*session\s*\(/m);
  if (sessionUse && sessionUse.index >= 0) {
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
  }
  return -1;
}

function findInsertAfterAccompagnement(text) {
  const marker = "/* TORINVEST_ACCOMPAGNEMENT_AUTH_END */";
  const idx = text.indexOf(marker);
  if (idx < 0) return -1;
  let at = idx + marker.length;
  const nl = text.indexOf("\n", at);
  return nl >= 0 ? nl + 1 : at;
}

let insertAt = findInsertAfterSession(content);
if (insertAt < 0) {
  insertAt = findInsertAfterAccompagnement(content);
}
if (insertAt < 0) {
  const loginRe = /app\.post\s*\(\s*["']\/api\/login["']/m;
  const m = content.match(loginRe);
  if (m && m.index >= 0) insertAt = m.index;
}

if (insertAt < 0) {
  console.error("ERREUR: point d'insertion introuvable (session / accompagnement / login)");
  process.exit(1);
}

const before = content.slice(Math.max(0, insertAt - 600), insertAt);
if (before.includes("FONDAMENTAL_BRIDGE_BEGIN")) {
  console.log("OK — bloc fondamental déjà présent après session");
} else {
  content = content.slice(0, insertAt) + standaloneBlock + content.slice(insertAt);
  console.log("OK — bloc fondamental inséré après express-session (insertAt=" + insertAt + ")");
}

const fbCount = (content.match(/createFondamentalBridgeRouter/g) || []).length;
if (fbCount !== 1) {
  console.error(
    "ERREUR: " + fbCount + " références createFondamentalBridgeRouter — attendu 1"
  );
  process.exit(1);
}

if (content === original) {
  console.log("Aucun changement nécessaire.");
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
console.log("→ source ~/.profile && pm2 restart la-forge --update-env");
