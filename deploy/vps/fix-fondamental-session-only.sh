#!/usr/bin/env bash
# Fix Fondamental : montage via routes-formation-auth (login OK → fondamental même chaîne)
set -euo pipefail
FORM_DIR="${1:-$HOME/torinvest-formation}"
REF="${TORINVEST_DEPLOY_REF:-cursor/fondamental-activate-fix-691a}"
BASE="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"

echo "==> fix-fondamental-session-only → $FORM_DIR"

mkdir -p "$FORM_DIR/server-patches"
curl -fsSL "$BASE/deploy/vps/formation-server/routes-fondamental-bridge.js" \
  -o "$FORM_DIR/server-patches/routes-fondamental-bridge.js"
curl -fsSL "$BASE/deploy/vps/formation-server/routes-formation-auth.js" \
  -o "$FORM_DIR/server-patches/routes-formation-auth.js"
curl -fsSL "$BASE/deploy/vps/formation-server/fondamental-bridge-lib.js" \
  -o "$FORM_DIR/server-patches/fondamental-bridge-lib.js" || true

grep -q createFondamentalBridgeRouter "$FORM_DIR/server-patches/routes-formation-auth.js" || {
  echo "ERREUR: routes-formation-auth.js sans montage fondamental"
  exit 1
}
grep -q FORGE_FONDA_COOKIE "$FORM_DIR/server-patches/routes-fondamental-bridge.js" || {
  echo "ERREUR: routes-fondamental-bridge.js sans cookie fallback"
  exit 1
}
echo "OK — fondamental monté dans routes-formation-auth.js"

node --check "$FORM_DIR/server-patches/routes-formation-auth.js"
node --check "$FORM_DIR/server-patches/routes-fondamental-bridge.js"

source ~/.profile 2>/dev/null || true
pm2 restart la-forge --update-env
sleep 5

echo "==> ping route (localhost)"
PING=$(curl -s -m 10 http://127.0.0.1:3001/api/fondamental-bridge/ping || true)
echo "$PING"
echo "$PING" | grep -q '"mounted":true' || {
  echo "ERREUR: route fondamental-bridge non montée (ping KO)"
  pm2 logs la-forge --lines 30 --nostream 2>/dev/null | tail -35 || true
  exit 1
}
echo "OK — route montée"

rm -f /tmp/t.cookie
curl -s -c /tmp/t.cookie -b /tmp/t.cookie -X POST 'http://127.0.0.1:3001/api/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"abonne@torinvest-trading.com","password":"Forge2026!"}'
echo ""
ACTIVATE=$(curl -s -m 25 -b /tmp/t.cookie -X POST 'http://127.0.0.1:3001/api/fondamental-bridge/activate')
echo "$ACTIVATE"
echo "$ACTIVATE" | grep -q '"ok":true' || {
  echo "==> ÉCHEC activate"
  pm2 logs la-forge --lines 30 --nostream 2>/dev/null | tail -35 || true
  exit 1
}
echo "==> SUCCÈS — Ctrl+Shift+R https://app.torinvest-trading.com/fondamental.html"
