#!/usr/bin/env bash
# Réparer la-forge + fix définitif session Fondamental (req.session OK)
set -euo pipefail

FORM_DIR="${1:-$HOME/torinvest-formation}"
REF="${TORINVEST_DEPLOY_REF:-cursor/fondamental-activate-fix-691a}"
BASE="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"

echo "==> repair la-forge ($REF)"

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

curl -fsSL "$BASE/deploy/vps/ensure-fondamental-after-session.js" -o /tmp/ensure-fb.js
node /tmp/ensure-fb.js "$FORM_DIR"

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
