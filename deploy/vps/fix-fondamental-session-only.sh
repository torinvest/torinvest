#!/usr/bin/env bash
# Fix server.js seul — si repair-la-forge-502 échoue sur ensure (cache GitHub).
# Usage: curl -fsSL .../fix-fondamental-session-only.sh | bash
set -euo pipefail
FORM_DIR="${1:-$HOME/torinvest-formation}"
export APP_DIR="$FORM_DIR"
echo "==> fix-fondamental-session-only → $FORM_DIR"
node - "$FORM_DIR" <<'NODE'
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const APP_DIR = process.argv[2];
const serverPath = path.join(APP_DIR, "server.js");
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
  out = out.replace(/\/\* TORINVEST_FONDAMENTAL_BRIDGE_BEGIN \*\/[\s\S]*?\/\* TORINVEST_FONDAMENTAL_BRIDGE_END \*\/\s*/g, "");
  const pm = out.match(/\/\* TORINVEST_FORMATION_PATCHES_BEGIN \*\/[\s\S]*?\/\* TORINVEST_FORMATION_PATCHES_END \*\/\s*/);
  if (pm) {
    let block = pm[0];
    block = block.replace(/\n?const createFondamentalBridgeRouter = require\([^)]+\);\s*/g, "");
    block = block.replace(/\n?app\.use\(\s*createFondamentalBridgeRouter\(\{[\s\S]*?\}\)\s*\);\s*/g, "");
    block = block.replace(/\n?app\.use\(createFondamentalBridgeRouter\(\{[^}]*\}\)\);\s*/g, "");
    out = out.slice(0, pm.index) + block + out.slice(pm.index + pm[0].length);
  }
  out = out.replace(/\n?const createFondamentalBridgeRouter = require\(["']\.\/server-patches\/routes-fondamental-bridge["']\);\s*/g, "\n");
  out = out.replace(/\n?app\.use\(\s*createFondamentalBridgeRouter\(\{[\s\S]*?\}\)\s*\);\s*/g, "\n");
  out = out.replace(/\n?app\.use\(createFondamentalBridgeRouter\(\{[^}]*\}\)\);\s*/g, "\n");
  return out;
}
function findInsertAfterSession(text) {
  const sessionUse = text.match(/app\.use\s*\(\s*session\s*\(/m);
  if (!sessionUse) return -1;
  let i = sessionUse.index, depth = 0, started = false;
  for (; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(") { depth++; started = true; }
    else if (ch === ")") {
      depth--;
      if (started && depth === 0) {
        let end = i + 1;
        while (end < text.length && /[\s;]/.test(text[end])) end++;
        return end;
      }
    }
  }
  return -1;
}
function countMounts(text) {
  return (text.match(/app\.use\(\s*createFondamentalBridgeRouter/g) || []).length;
}
content = stripAll(content);
let insertAt = findInsertAfterSession(content);
if (insertAt < 0) {
  const marker = "/* TORINVEST_ACCOMPAGNEMENT_AUTH_END */";
  const idx = content.indexOf(marker);
  if (idx >= 0) insertAt = idx + marker.length;
}
if (insertAt < 0) {
  const m = content.match(/app\.post\s*\(\s*["']\/api\/login["']/m);
  if (m) insertAt = m.index;
}
if (insertAt < 0) { console.error("ERREUR: insertion introuvable"); process.exit(1); }
if (countMounts(content) === 0) {
  content = content.slice(0, insertAt) + standaloneBlock + content.slice(insertAt);
  console.log("OK — bloc fondamental inséré après session");
}
const mounts = countMounts(content);
console.log("montages fondamental:", mounts);
if (mounts !== 1) { console.error("ERREUR: attendu 1 montage"); process.exit(1); }
if (content !== original) {
  const backup = serverPath + ".bak." + Date.now();
  fs.writeFileSync(backup, original);
  fs.writeFileSync(serverPath, content);
  execSync("node --check " + JSON.stringify(serverPath), { stdio: "pipe" });
  console.log("Sauvegarde:", backup);
} else {
  console.log("OK — déjà correct");
}
NODE
source ~/.profile 2>/dev/null || true
pm2 restart la-forge --update-env
sleep 3
rm -f /tmp/t.cookie
curl -s -c /tmp/t.cookie -b /tmp/t.cookie -X POST 'https://app.torinvest-trading.com/api/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"abonne@torinvest-trading.com","password":"Forge2026!"}'
echo ""
curl -s -b /tmp/t.cookie -X POST 'https://app.torinvest-trading.com/api/fondamental-bridge/activate'
echo ""
