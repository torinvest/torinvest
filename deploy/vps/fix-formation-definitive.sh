#!/usr/bin/env bash
# Fix définitif crash la-forge — tout en un seul curl (pas de 2e fichier relocate).
#
# Usage (préférer le commit figé — raw GitHub met en cache « main » plusieurs minutes) :
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/501cb3e/deploy/vps/fix-formation-definitive.sh" | bash -s -- ~/torinvest-formation
#
# Ou main (si le script affiche encore « dede4e3 », le cache n’est pas à jour — utiliser l’URL ci-dessus) :
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/fix-formation-definitive.sh" | bash -s -- ~/torinvest-formation

set -euo pipefail

FIX_SCRIPT_VERSION="3"
APP_DIR="${1:-$HOME/torinvest-formation}"
# Défaut main ; repli commit si raw GitHub encore en cache (401 sur users.json existants)
REF="${TORINVEST_DEPLOY_REF:-main}"
FALLBACK_REF="${TORINVEST_DEPLOY_FALLBACK_REF:-e33541a}"
BASE="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"

echo "==> fix-formation-definitive v${FIX_SCRIPT_VERSION} (git $REF) → $APP_DIR"

mkdir -p "$APP_DIR/server-patches" "$APP_DIR/deploy/vps"

fetch_auth_routes() {
  local ref="$1"
  curl -fsSL --retry 3 \
    "https://raw.githubusercontent.com/torinvest/torinvest/${ref}/deploy/vps/formation-server/routes-formation-auth.js" \
    -o "$APP_DIR/server-patches/routes-formation-auth.js"
}

fetch_auth_routes "$REF"
if grep -q 'Identifiants incorrects' "$APP_DIR/server-patches/routes-formation-auth.js"; then
  echo "WARN — routes obsolètes sur $REF, repli $FALLBACK_REF"
  fetch_auth_routes "$FALLBACK_REF"
fi

grep -q 'if (!req.session)' "$APP_DIR/server-patches/routes-formation-auth.js" || {
  echo "ERREUR: routes-formation-auth.js invalide (req.session guard)"
  exit 1
}
grep -q 'Identifiants incorrects' "$APP_DIR/server-patches/routes-formation-auth.js" && {
  echo "ERREUR: routes-formation-auth.js bloque encore le login natif (401 users.json)"
  echo "       Définir TORINVEST_DEPLOY_REF=e33541a ou pousser le fix sur main"
  exit 1
}
echo "OK — routes-formation-auth.js (délégation login natif si échec)"

curl -fsSL --retry 3 "$BASE/deploy/vps/formation-server/formation-users-lib.js" \
  -o "$APP_DIR/server-patches/formation-users-lib.js" || true
if [ -f "$APP_DIR/server-patches/formation-users-lib.js" ]; then
  echo "OK — formation-users-lib.js"
fi

curl -fsSL --retry 3 "$BASE/deploy/vps/formation-server/accompagnement-worker-lib.js" \
  -o "$APP_DIR/server-patches/accompagnement-worker-lib.js" || true

export APP_DIR
node <<'NODE'
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const APP_DIR = process.env.APP_DIR;
const serverPath = path.join(APP_DIR, "server.js");
if (!fs.existsSync(serverPath)) {
  console.error("ERREUR:", serverPath, "introuvable");
  process.exit(1);
}

let content = fs.readFileSync(serverPath, "utf8");
const original = content;

const blockRe =
  /\/\* TORINVEST_ACCOMPAGNEMENT_AUTH_BEGIN \*\/[\s\S]*?\/\* TORINVEST_ACCOMPAGNEMENT_AUTH_END \*\/\s*/;

const loginPatterns = [
  /app\.post\s*\(\s*["']\/api\/login["']/m,
  /app\.post\s*\(\s*`\/api\/login`/m,
  /\.post\s*\(\s*["']\/api\/login["']/m,
];

let block = null;
const existing = content.match(blockRe);
if (existing) {
  block = existing[0];
  content = content.slice(0, existing.index) + content.slice(existing.index + block.length);
}

if (!block) {
  block = [
    "/* TORINVEST_ACCOMPAGNEMENT_AUTH_BEGIN */",
    "const createFormationAuthRouter = require(\"./server-patches/routes-formation-auth\");",
    "app.use(",
    "  createFormationAuthRouter({",
    "    dataDir: path.join(__dirname, \"data\"),",
    "    workerUrl: process.env.FORGE_WORKER_URL || process.env.WORKER_URL || \"https://morning-hall-d8f6.onzerimes.workers.dev\",",
    "    provisionSecret: process.env.FORGE_FORMATION_PROVISION_SECRET,",
    "  })",
    ");",
    "/* TORINVEST_ACCOMPAGNEMENT_AUTH_END */",
    "",
  ].join("\n");
}

let insertAt = -1;
for (const re of loginPatterns) {
  const m = content.match(re);
  if (m && m.index >= 0) {
    insertAt = m.index;
    break;
  }
}

const backup = serverPath + ".bak." + Date.now();
fs.writeFileSync(backup, original);

if (insertAt < 0) {
  console.warn("WARN — /api/login introuvable : bloc accompagnement SUPPRIMÉ (stop crash)");
  if (existing) {
    fs.writeFileSync(serverPath, content);
    try {
      execSync("node --check " + JSON.stringify(serverPath), { stdio: "pipe" });
    } catch {
      fs.writeFileSync(serverPath, original);
      console.error("ERREUR server.js après suppression bloc");
      process.exit(1);
    }
    console.log("Sauvegarde:", backup);
    process.exit(0);
  }
  console.error("ERREUR: pas de bloc et pas de /api/login — server.js inconnu");
  process.exit(1);
}

const before = content.slice(Math.max(0, insertAt - 500), insertAt);
if (before.includes("ACCOMPAGNEMENT_AUTH_BEGIN")) {
  console.log("OK — bloc déjà avant /api/login");
  process.exit(0);
}

const newContent = content.slice(0, insertAt) + block + content.slice(insertAt);
fs.writeFileSync(serverPath, newContent);
try {
  execSync("node --check " + JSON.stringify(serverPath), { stdio: "pipe" });
} catch (e) {
  fs.writeFileSync(serverPath, original);
  console.error("ERREUR: server.js invalide — restauré");
  process.exit(1);
}
console.log("OK — bloc placé avant /api/login");
console.log("Sauvegarde:", backup);
NODE

node --check "$APP_DIR/server.js"

# Fondamental bridge
if ! grep -q 'fondamental-bridge' "$APP_DIR/server.js"; then
  curl -fsSL "$BASE/deploy/vps/wire-fondamental-bridge-only.js" -o /tmp/wire-fb.js
  node /tmp/wire-fb.js "$APP_DIR" || true
fi

source ~/.profile 2>/dev/null || true
pm2 restart la-forge --update-env || pm2 restart la-forge
sleep 3

echo "==> PM2"
pm2 list | grep la-forge || true

echo "==> login (provisionné AdminFonda2026!)"
LOGIN_PROV=$(curl -s -m 20 -X POST 'https://app.torinvest-trading.com/api/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"abonne@torinvest-trading.com","password":"AdminFonda2026!"}')
echo "$LOGIN_PROV"
if echo "$LOGIN_PROV" | grep -q '"ok"'; then
  echo "OK — login provisionné"
else
  echo "WARN — login provisionné KO — essai mot de passe démo natif (grep server.js) :"
  grep -E 'abonne@|password.*abonne|DEMO|demoPassword' "$APP_DIR/server.js" 2>/dev/null | head -5 || true
fi
pm2 logs la-forge --lines 8 --nostream 2>/dev/null | tail -12 || true
echo "==> terminé"
