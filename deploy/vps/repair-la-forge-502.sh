#!/usr/bin/env bash
# Réparer la-forge + fix définitif session Fondamental (req.session OK)
# Le correctif server.js est EMBARQUÉ (pas de cache GitHub raw sur ensure-fb.js).
set -euo pipefail

FORM_DIR="${1:-$HOME/torinvest-formation}"
REF="${TORINVEST_DEPLOY_REF:-cursor/fondamental-activate-fix-691a}"
# Commit pin pour les fichiers curl (évite cache raw 5 min sur branche)
ENSURE_COMMIT="${TORINVEST_ENSURE_COMMIT:-b14eb55}"
BASE="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"
BASE_PIN="https://raw.githubusercontent.com/torinvest/torinvest/${ENSURE_COMMIT}"

echo "==> repair la-forge ($REF / ensure $ENSURE_COMMIT)"

mkdir -p "$FORM_DIR/server-patches" "$FORM_DIR/public/js"

curl -fsSL "$BASE/deploy/vps/formation-server/routes-fondamental-bridge.js" \
  -o "$FORM_DIR/server-patches/routes-fondamental-bridge.js"
curl -fsSL "$BASE/deploy/vps/formation-server/routes-formation-auth.js" \
  -o "$FORM_DIR/server-patches/routes-formation-auth.js"
curl -fsSL "$BASE/la-forge/js/forge-fondamental.js" \
  -o "$FORM_DIR/public/js/forge-fondamental.js"
curl -fsSL "$BASE/la-forge/js/auth.js" \
  -o "$FORM_DIR/public/js/auth.js"
curl -fsSL "$BASE/deploy/vps/app-shells/fondamental.html" \
  -o "$FORM_DIR/public/fondamental.html"

grep -q premiumUserViaMe "$FORM_DIR/server-patches/routes-fondamental-bridge.js" || {
  echo "ERREUR: routes-fondamental-bridge.js sans premiumUserViaMe"
  exit 1
}
echo "OK — patches + frontend Fondamental"

node --check "$FORM_DIR/server.js"
node --check "$FORM_DIR/server-patches/routes-fondamental-bridge.js"

echo "==> ensure fondamental après express-session"
export APP_DIR="$FORM_DIR"
if curl -fsSL "$BASE_PIN/deploy/vps/ensure-fondamental-after-session.js" -o /tmp/ensure-fb.js; then
  if grep -q 'app\.use(createFondamentalBridgeRouter' /tmp/ensure-fb.js; then
    echo "OK — ensure-fb.js (validation app.use)"
    node /tmp/ensure-fb.js "$FORM_DIR"
  else
    echo "WARN — ensure-fb.js obsolète (cache?) → script embarqué"
    node - "$FORM_DIR" <<'ENSURE_NODE'
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const APP_DIR = process.argv[2] || process.env.APP_DIR;
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
if (countMounts(content) !== 1) {
  console.error("ERREUR:", countMounts(content), "montages fondamental");
  process.exit(1);
}
if (content !== original) {
  const backup = serverPath + ".bak." + Date.now();
  fs.writeFileSync(backup, original);
  fs.writeFileSync(serverPath, content);
  execSync("node --check " + JSON.stringify(serverPath), { stdio: "pipe" });
  console.log("Sauvegarde:", backup);
} else {
  console.log("OK — server.js déjà correct");
}
ENSURE_NODE
  fi
else
  echo "ERREUR: impossible de télécharger ensure-fondamental-after-session.js"
  exit 1
fi

source ~/.profile 2>/dev/null || true
pm2 restart la-forge --update-env
sleep 4

rm -f /tmp/t.cookie
LOGIN=$(curl -s -c /tmp/t.cookie -b /tmp/t.cookie -X POST 'https://app.torinvest-trading.com/api/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"abonne@torinvest-trading.com","password":"Forge2026!"}')
echo "$LOGIN"
ACTIVATE=$(curl -s -b /tmp/t.cookie -X POST 'https://app.torinvest-trading.com/api/fondamental-bridge/activate')
echo "$ACTIVATE"

if echo "$ACTIVATE" | grep -q '"ok":true'; then
  echo "==> SUCCÈS activate — Ctrl+Shift+R sur fondamental.html"
else
  echo "==> ÉCHEC activate — vérifier pm2 logs la-forge"
  pm2 logs la-forge --lines 15 --nostream 2>/dev/null | tail -20 || true
  exit 1
fi
