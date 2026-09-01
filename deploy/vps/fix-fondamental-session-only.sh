#!/usr/bin/env bash
# Fix Fondamental : routes + force mount server.js + test localhost
set -euo pipefail
FORM_DIR="${1:-$HOME/torinvest-formation}"
REF="${TORINVEST_DEPLOY_REF:-cursor/fondamental-activate-fix-691a}"
BASE="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"

echo "==> fix-fondamental-session-only → $FORM_DIR"

mkdir -p "$FORM_DIR/server-patches"
curl -fsSL "$BASE/deploy/vps/formation-server/routes-fondamental-bridge.js" \
  -o "$FORM_DIR/server-patches/routes-fondamental-bridge.js"
grep -q FORGE_FONDA_COOKIE "$FORM_DIR/server-patches/routes-fondamental-bridge.js" || {
  echo "ERREUR: routes sans cookie fallback"
  exit 1
}
echo "OK — routes-fondamental-bridge.js"

curl -fsSL "$BASE/deploy/vps/wire-fondamental-bridge-force.js" -o /tmp/wire-fb-force.js
node /tmp/wire-fb-force.js "$FORM_DIR"

node --check "$FORM_DIR/server.js"

source ~/.profile 2>/dev/null || true
pm2 restart la-forge --update-env
sleep 5

echo "==> ping route (localhost)"
PING=$(curl -s -m 10 http://127.0.0.1:3001/api/fondamental-bridge/ping || true)
echo "$PING"
echo "$PING" | grep -q '"mounted":true' || {
  echo "ERREUR: route fondamental-bridge non montée (ping KO)"
  pm2 logs la-forge --lines 20 --nostream 2>/dev/null | tail -25 || true
  exit 1
}
echo "OK — route montée"

rm -f /tmp/t.cookie
curl -s -c /tmp/t.cookie -b /tmp/t.cookie -X POST 'http://127.0.0.1:3001/api/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"abonne@torinvest-trading.com","password":"Forge2026!"}'
echo ""
ACTIVATE=$(curl -s -m 20 -b /tmp/t.cookie -X POST 'http://127.0.0.1:3001/api/fondamental-bridge/activate')
echo "$ACTIVATE"
echo "$ACTIVATE" | grep -q '"ok":true' || {
  echo "==> ÉCHEC activate (localhost)"
  pm2 logs la-forge --lines 25 --nostream 2>/dev/null | tail -30 || true
  exit 1
}
echo "==> SUCCÈS — Ctrl+Shift+R https://app.torinvest-trading.com/fondamental.html"
