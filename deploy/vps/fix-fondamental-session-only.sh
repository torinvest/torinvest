#!/usr/bin/env bash
# Fix Fondamental Premium : routes + API radar (access_token embed) + test
set -euo pipefail
FORM_DIR="${1:-$HOME/torinvest-formation}"
REF="${TORINVEST_DEPLOY_REF:-main}"
BASE="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"
RADAR_API="/var/www/torinvest/api"

echo "==> fix-fondamental Premium login (pas Phantom) → $FORM_DIR"

mkdir -p "$FORM_DIR/server-patches"
curl -fsSL "$BASE/deploy/vps/formation-server/routes-fondamental-bridge.js" \
  -o "$FORM_DIR/server-patches/routes-fondamental-bridge.js"
curl -fsSL "$BASE/deploy/vps/formation-server/routes-formation-auth.js" \
  -o "$FORM_DIR/server-patches/routes-formation-auth.js"
curl -fsSL "$BASE/la-forge/js/forge-fondamental.js" \
  -o "$FORM_DIR/public/js/forge-fondamental.js"
curl -fsSL "$BASE/la-forge/js/fondamental-data.js" \
  -o "$FORM_DIR/public/js/fondamental-data.js"
curl -fsSL "$BASE/la-forge/js/course-data.js" \
  -o "$FORM_DIR/public/js/course-data.js"
curl -fsSL "$BASE/la-forge/js/course-index.js" \
  -o "$FORM_DIR/public/js/course-index.js"
curl -fsSL "$BASE/deploy/vps/app-shells/fondamental.html" \
  -o "$FORM_DIR/public/fondamental.html"
curl -fsSL "$BASE/deploy/vps/app-shells/dashboard.html" \
  -o "$FORM_DIR/public/dashboard.html"

grep -q 'FORGE_TOTAL_HOURS = 70' "$FORM_DIR/public/js/course-data.js" || {
  echo "ERREUR: course-data.js sans FORGE_TOTAL_HOURS=70 (branche $REF incorrecte ?)"
  exit 1
}
echo "OK — course-data.js FORGE_TOTAL_HOURS=70"

grep -q access_token "$FORM_DIR/server-patches/routes-fondamental-bridge.js" || {
  echo "ERREUR: routes-fondamental-bridge sans access_token embed"
  exit 1
}
grep -q 'activate-wallet' "$FORM_DIR/server-patches/routes-fondamental-bridge.js" || {
  echo "ERREUR: routes-fondamental-bridge sans activate-wallet (Phantom KRM)"
  exit 1
}
echo "OK — formation server-patches"

if [ -d "$RADAR_API" ]; then
  echo "==> API radar (fondamental-serve access_token)"
  curl -fsSL "$BASE/api/fondamental-serve.php" -o /tmp/fondamental-serve.php
  curl -fsSL "$BASE/api/fondamental-access-lib.php" -o /tmp/fondamental-access-lib.php
  sudo mv /tmp/fondamental-serve.php "$RADAR_API/fondamental-serve.php"
  sudo mv /tmp/fondamental-access-lib.php "$RADAR_API/fondamental-access-lib.php"
  sudo chown www-data:www-data "$RADAR_API/fondamental-serve.php" "$RADAR_API/fondamental-access-lib.php"
  php -l "$RADAR_API/fondamental-serve.php"
  php -l "$RADAR_API/fondamental-access-lib.php"
  echo "OK — API radar"
else
  echo "WARN — $RADAR_API absent, pull API manuellement"
fi

node --check "$FORM_DIR/server-patches/routes-fondamental-bridge.js"
node --check "$FORM_DIR/server-patches/routes-formation-auth.js"

source ~/.profile 2>/dev/null || true
pm2 restart la-forge --update-env
sleep 5

rm -f /tmp/t.cookie
curl -s -c /tmp/t.cookie -b /tmp/t.cookie -X POST 'http://127.0.0.1:3001/api/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"abonne@torinvest-trading.com","password":"Forge2026!"}'
echo ""
ACTIVATE=$(curl -s -m 25 -b /tmp/t.cookie -X POST 'http://127.0.0.1:3001/api/fondamental-bridge/activate')
echo "$ACTIVATE"
echo "$ACTIVATE" | grep -q '"ok":true' || { echo "ÉCHEC activate"; exit 1; }

curl -s -m 20 -b /tmp/t.cookie -D /tmp/embed.hdr -o /tmp/embed.html \
  'http://127.0.0.1:3001/applifonda/index.html' >/dev/null
if grep -qi 'X-Fondamental-Gate: login' /tmp/embed.hdr; then
  echo "ERREUR: embed retourne gate Phantom (session radar non reconnue)"
  head -5 /tmp/embed.hdr
  exit 1
fi
if grep -qi 'Connecter Phantom' /tmp/embed.html; then
  echo "ERREUR: HTML embed contient encore gate Phantom"
  exit 1
fi
echo "OK — embed session Premium (pas gate wallet)"

echo "==> SUCCÈS — Ctrl+Shift+R https://app.torinvest-trading.com/dashboard.html"
echo "   Vérif: curl -s https://app.torinvest-trading.com/js/course-data.js | grep FORGE_TOTAL_HOURS"
