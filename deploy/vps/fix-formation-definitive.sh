#!/usr/bin/env bash
# Fix définitif crash la-forge — tout en un seul curl (pas de 2e fichier relocate).
#
# Usage :
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/fix-formation-definitive.sh" | bash -s -- ~/torinvest-formation

set -euo pipefail

APP_DIR="${1:-$HOME/torinvest-formation}"
# Défaut main ; repli commit si raw GitHub encore en cache (401 sur users.json existants)
REF="${TORINVEST_DEPLOY_REF:-main}"
FALLBACK_REF="${TORINVEST_DEPLOY_FALLBACK_REF:-e33541a}"
BASE="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"

echo "==> fix-formation-definitive (git $REF) → $APP_DIR"

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

curl -fsSL --retry 3 "$BASE/deploy/vps/formation-server/routes-fondamental-bridge.js" \
  -o "$APP_DIR/server-patches/routes-fondamental-bridge.js" || true
curl -fsSL --retry 3 "$BASE/deploy/vps/formation-server/fondamental-bridge-lib.js" \
  -o "$APP_DIR/server-patches/fondamental-bridge-lib.js" || true

for jsdir in "$APP_DIR/public/js" "$APP_DIR/js"; do
  if [ -d "$jsdir" ] || [ "$jsdir" = "$APP_DIR/public/js" ]; then
    mkdir -p "$jsdir"
    curl -fsSL --retry 3 "$BASE/la-forge/js/auth.js" -o "$jsdir/auth.js" && echo "OK — $jsdir/auth.js"
    curl -fsSL --retry 3 "$BASE/la-forge/js/forge-fondamental.js" -o "$jsdir/forge-fondamental.js" && echo "OK — $jsdir/forge-fondamental.js"
  fi
done

for html in login.html fondamental.html; do
  for hdir in "$APP_DIR/public" "$APP_DIR"; do
  if [ -d "$hdir" ] || [ "$hdir" = "$APP_DIR/public" ]; then
    curl -fsSL --retry 3 "$BASE/deploy/vps/app-shells/$html" -o "$hdir/$html" && echo "OK — $hdir/$html"
  fi
  done
done
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

# Fondamental bridge — un seul montage après express-session
curl -fsSL "$BASE/deploy/vps/ensure-fondamental-after-session.js" -o /tmp/ensure-fb.js
node /tmp/ensure-fb.js "$APP_DIR"

source ~/.profile 2>/dev/null || true
pm2 restart la-forge --update-env || pm2 restart la-forge
sleep 3

echo "==> PM2"
pm2 list | grep la-forge || true

# Mots de passe UNIQUEMENT via env (jamais en dur dans le repo).
DEMO_EMAIL="${FORGE_DEMO_EMAIL:-}"
DEMO_PASSWORD="${FORGE_DEMO_PASSWORD:-}"
if [ -n "$DEMO_EMAIL" ] && [ -n "$DEMO_PASSWORD" ]; then
  echo "==> login démo Premium (FORGE_DEMO_EMAIL)"
  LOGIN_DEMO=$(curl -s -m 20 -X POST 'https://app.torinvest-trading.com/api/login' \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$DEMO_EMAIL\",\"password\":\"$DEMO_PASSWORD\"}")
  echo "$LOGIN_DEMO"
  if echo "$LOGIN_DEMO" | grep -q '"ok"'; then
    echo "OK — login démo Premium"
  else
    echo "WARN — login démo KO"
  fi
else
  echo "INFO — FORGE_DEMO_EMAIL / FORGE_DEMO_PASSWORD absents : skip test login"
fi

ADMIN_EMAIL="${FORGE_ADMIN_EMAIL:-}"
ADMIN_PASSWORD="${FORGE_ADMIN_PASSWORD:-}"
if [ -n "${FORGE_FORMATION_PROVISION_SECRET:-}" ] && [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
  echo "==> reprovision admin (FORGE_ADMIN_EMAIL)"
  curl -s -m 20 -X POST 'http://127.0.0.1:3001/api/internal/formation-provision' \
    -H 'Content-Type: application/json' \
    -H "x-formation-provision-key: $FORGE_FORMATION_PROVISION_SECRET" \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\",\"subscribed\":true}"
  echo ""
  LOGIN_PROV=$(curl -s -m 20 -X POST 'https://app.torinvest-trading.com/api/login' \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
  echo "$LOGIN_PROV"
  if echo "$LOGIN_PROV" | grep -q '"ok"'; then
    echo "OK — login provisionné"
  fi
else
  echo "INFO — provision admin skip (secret ou FORGE_ADMIN_EMAIL/PASSWORD absents)"
fi
pm2 logs la-forge --lines 8 --nostream 2>/dev/null | tail -12 || true
echo "==> terminé"
