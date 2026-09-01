#!/usr/bin/env node
/**
 * Un seul montage fondamental-bridge, APRÈS express-session.
 * Supprime tous les doublons (PATCHES, blocs marqués, app.use orphelins).
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

function stripAllFondamentalBridge(text) {
  let out = text;
  let changes = 0;

  const markedRe =
    /\/\* TORINVEST_FONDAMENTAL_BRIDGE_BEGIN \*\/[\s\S]*?\/\* TORINVEST_FONDAMENTAL_BRIDGE_END \*\/\s*/g;
  const marked = (out.match(markedRe) || []).length;
  if (marked > 0) {
    out = out.replace(markedRe, "");
    changes += marked;
    console.log("OK — " + marked + " bloc(s) TORINVEST_FONDAMENTAL_BRIDGE supprimé(s)");
  }

  const patchesRe =
    /\/\* TORINVEST_FORMATION_PATCHES_BEGIN \*\/[\s\S]*?\/\* TORINVEST_FORMATION_PATCHES_END \*\/\s*/;
  const pm = out.match(patchesRe);
  if (pm) {
    let block = pm[0];
    const before = block;
    block = block.replace(
      /\n?const createFondamentalBridgeRouter = require\([^)]+\);\s*/g,
      ""
    );
    block = block.replace(
      /\n?app\.use\(\s*createFondamentalBridgeRouter\(\{[\s\S]*?\}\)\s*\);\s*/g,
      ""
    );
    if (block !== before) {
      console.log("OK — fondamental retiré du bloc TORINVEST_FORMATION_PATCHES");
      changes += 1;
    }
    out = out.slice(0, pm.index) + block + out.slice(pm.index + pm[0].length);
  }

  const requireRe =
    /\n?const createFondamentalBridgeRouter = require\(["']\.\/server-patches\/routes-fondamental-bridge["']\);\s*/g;
  const reqCount = (out.match(requireRe) || []).length;
  if (reqCount > 0) {
    out = out.replace(requireRe, "\n");
    console.log("OK — " + reqCount + " require fondamental-bridge orphelin(s) supprimé(s)");
    changes += reqCount;
  }

  const useRe =
    /\n?app\.use\(\s*createFondamentalBridgeRouter\(\{[\s\S]*?\}\)\s*\);\s*/g;
  const useCount = (out.match(useRe) || []).length;
  if (useCount > 0) {
    out = out.replace(useRe, "\n");
    console.log("OK — " + useCount + " app.use fondamental orphelin(s) supprimé(s)");
    changes += useCount;
  }

  return { out, changes };
}

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

function findInsertPoint(text) {
  const accMarker = "/* TORINVEST_ACCOMPAGNEMENT_AUTH_END */";
  const accIdx = text.indexOf(accMarker);
  if (accIdx >= 0) {
    let at = accIdx + accMarker.length;
    const nl = text.indexOf("\n", at);
    return nl >= 0 ? nl + 1 : at;
  }

  const loginRe = /app\.post\s*\(\s*["']\/api\/login["']/m;
  const loginM = text.match(loginRe);
  if (loginM && loginM.index >= 0) return loginM.index;

  return findInsertAfterSession(text);
}

function countMounts(text) {
  return (text.match(/app\.use\(\s*createFondamentalBridgeRouter/g) || []).length;
}

const stripped = stripAllFondamentalBridge(content);
content = stripped.out;

let insertAt = findInsertPoint(content);
if (insertAt < 0) {
  console.error("ERREUR: point d'insertion introuvable (accompagnement / login / session)");
  process.exit(1);
}

const mountsBefore = countMounts(content);
if (mountsBefore === 0) {
  content = content.slice(0, insertAt) + standaloneBlock + content.slice(insertAt);
  console.log("OK — bloc fondamental inséré après accompagnement auth (insertAt=" + insertAt + ")");
} else if (mountsBefore === 1) {
  console.log("OK — un seul montage fondamental déjà présent");
} else {
  console.error("ERREUR: " + mountsBefore + " montages fondamental — nettoyage incomplet");
  process.exit(1);
}

const mounts = countMounts(content);
if (mounts !== 1) {
  console.error("ERREUR: " + mounts + " app.use(createFondamentalBridgeRouter) — attendu 1");
  process.exit(1);
}

if (content === original) {
  console.log("Aucun changement nécessaire — montage OK");
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
