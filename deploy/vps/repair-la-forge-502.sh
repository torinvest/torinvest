#!/usr/bin/env bash
# Réparer la-forge + déployer fix activate Fondamental
set -euo pipefail

FORM_DIR="${1:-$HOME/torinvest-formation}"
REF="${TORINVEST_DEPLOY_REF:-cursor/fondamental-activate-fix-691a}"
BASE="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"

echo "==> repair la-forge ($REF)"

curl -fsSL "$BASE/deploy/vps/formation-server/routes-fondamental-bridge.js" \
  -o "$FORM_DIR/server-patches/routes-fondamental-bridge.js"

grep -q premiumUserViaMe "$FORM_DIR/server-patches/routes-fondamental-bridge.js" || {
  echo "ERREUR: routes-fondamental-bridge.js sans premiumUserViaMe"
  exit 1
}
echo "OK — routes-fondamental-bridge.js (activate via /api/me)"

node --check "$FORM_DIR/server.js"
node --check "$FORM_DIR/server-patches/routes-fondamental-bridge.js"

curl -fsSL "$BASE/deploy/vps/relocate-fondamental-bridge.js" -o /tmp/relocate-fb.js
node /tmp/relocate-fb.js "$FORM_DIR"

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
echo "==> Si ok:true ci-dessus → Ctrl+Shift+R sur fondamental.html"
