#!/usr/bin/env bash
# HOTFIX immédiat — page fiches coaching bloquée sur « Chargement… »
# Cause : auth.js absent du HTML → getMe undefined.
#
# Sur le VPS :
#   curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/cursor/fix-coaching-fiches-691a/deploy/vps/HOTFIX-coaching-fiches-now.sh | bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
# SHA figé du fix (auth.js + dashboard + JS)
SHA="${SHA:-9c7ed24}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${SHA}"
ADMIN_EMAIL="${ADMIN_EMAIL:-abonne@torinvest-trading.com}"

echo "======== HOTFIX COACHING FICHES ($SHA) ========"
echo "APP=$APP_DIR"

mkdir -p "$APP_DIR/public/js" "$APP_DIR/public/css" "$APP_DIR/data/coaching-fiches"

curl -fsSL "$RAW/deploy/vps/app-shells/coaching-fiches.html" -o "$APP_DIR/public/coaching-fiches.html"
curl -fsSL "$RAW/deploy/vps/app-shells/coaching-fiche.html" -o "$APP_DIR/public/coaching-fiche.html"
curl -fsSL "$RAW/deploy/vps/app-shells/dashboard.html" -o "$APP_DIR/public/dashboard.html"
curl -fsSL "$RAW/la-forge/js/forge-coaching-fiches.js" -o "$APP_DIR/public/js/forge-coaching-fiches.js"
curl -fsSL "$RAW/la-forge/css/forge-coaching-fiches.css" -o "$APP_DIR/public/css/forge-coaching-fiches.css"

# Garantir auth.js présent dans le HTML
if ! grep -q 'auth.js' "$APP_DIR/public/coaching-fiches.html"; then
  echo "ERREUR: auth.js toujours absent après pull — abort"
  exit 1
fi

# Admin email pour isAdmin / lien dashboard
ENV_FILE="$APP_DIR/.env"
touch "$ENV_FILE"
if grep -q '^FORGE_ADMIN_EMAILS=' "$ENV_FILE"; then
  if ! grep -qi "^FORGE_ADMIN_EMAILS=.*${ADMIN_EMAIL}" "$ENV_FILE"; then
    cur=$(grep '^FORGE_ADMIN_EMAILS=' "$ENV_FILE" | head -1 | cut -d= -f2-)
    sed -i "s|^FORGE_ADMIN_EMAILS=.*|FORGE_ADMIN_EMAILS=${cur},${ADMIN_EMAIL}|" "$ENV_FILE"
  fi
else
  echo "FORGE_ADMIN_EMAILS=${ADMIN_EMAIL}" >> "$ENV_FILE"
fi
export FORGE_ADMIN_EMAILS="$(grep '^FORGE_ADMIN_EMAILS=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
echo "FORGE_ADMIN_EMAILS=$FORGE_ADMIN_EMAILS"

# API route si absente
if [[ -f "$APP_DIR/server-patches/routes-coaching-fiches.js" ]] || true; then
  curl -fsSL "$RAW/deploy/vps/formation-server/routes-coaching-fiches.js" \
    -o "$APP_DIR/server-patches/routes-coaching-fiches.js" || true
fi

if [[ -f "$APP_DIR/server.js" ]] && ! grep -q 'routes-coaching-fiches\|createCoachingFichesRouter' "$APP_DIR/server.js"; then
  echo "→ wire API fiches…"
  curl -fsSL "$RAW/deploy/vps/DEPLOY-COACHING-FICHES.sh" -o /tmp/DEPLOY-COACHING-FICHES.sh
  # Ne relance pas tout le deploy : injection minimale
  APP_DIR="$APP_DIR" node <<'NODE'
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const APP_DIR = process.env.APP_DIR;
const serverPath = path.join(APP_DIR, "server.js");
let content = fs.readFileSync(serverPath, "utf8");
const original = content;
if (/createCoachingFichesRouter|routes-coaching-fiches/.test(content)) {
  console.log("API déjà montée");
  process.exit(0);
}
if (!/createCoachingFichesRouter/.test(content)) {
  content = content.replace(
    /(const createCoachingLivesRouter = require\([^)]+\);)/,
    '$1\nconst createCoachingFichesRouter = require("./server-patches/routes-coaching-fiches");'
  );
  if (content === original) {
    content = content.replace(
      /(const createCalendarRouter = require\([^)]+\);)/,
      '$1\nconst createCoachingFichesRouter = require("./server-patches/routes-coaching-fiches");'
    );
  }
}
const livesUse = /app\.use\(\s*createCoachingLivesRouter\(\{[\s\S]*?\}\)\s*\);/m;
const calUse = /app\.use\(\s*createCalendarRouter\(\{[\s\S]*?\}\)\s*\);/m;
const m = content.match(livesUse) || content.match(calUse);
if (!m) { console.error("point insertion introuvable"); process.exit(1); }
const dataDir = ((m[0].match(/dataDir:\s*([\s\S]*?),\s*requireAuth/) || [])[1] || 'path.join(__dirname, "data")').trim();
const block = `app.use(\n  createCoachingFichesRouter({\n    dataDir: ${dataDir},\n    requireAuth,\n  })\n);`;
content = content.replace(m[0], m[0] + "\n" + block);
fs.writeFileSync(serverPath, content);
execSync("node --check " + JSON.stringify(serverPath));
console.log("API fiches montée");
NODE
fi

pm2 restart la-forge --update-env 2>/dev/null || pm2 restart all --update-env || true
sleep 1

echo ""
echo "Vérif :"
grep -n "auth.js" "$APP_DIR/public/coaching-fiches.html" | head -3
curl -sS -o /dev/null -w "page %{http_code}\n" "http://127.0.0.1:3001/coaching-fiches.html" || true
curl -sS "http://127.0.0.1:3001/coaching-fiches.html" | grep -c "auth.js" || true

echo ""
echo "→ Hard refresh : https://app.torinvest-trading.com/coaching-fiches.html"
echo "======== DONE ========"
