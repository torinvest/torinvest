#!/usr/bin/env bash
# Corrige crash login formation (req.session undefined).
set -euo pipefail

APP_DIR="${1:-$HOME/torinvest-formation}"
SHA="${SHA:-main}"
BASE="https://raw.githubusercontent.com/torinvest/torinvest/${SHA}"

echo "==> fix-formation-login-crash → $APP_DIR"

curl -fsSL "$BASE/deploy/vps/formation-server/routes-formation-auth.js" \
  -o "$APP_DIR/server-patches/routes-formation-auth.js"

grep -q 'if (!req.session)' "$APP_DIR/server-patches/routes-formation-auth.js" || {
  echo "ERREUR: garde session absente dans routes-formation-auth.js"
  exit 1
}
echo "OK — routes-formation-auth.js"

curl -fsSL "$BASE/deploy/vps/relocate-accompagnement-auth.js" \
  -o /tmp/relocate-accompagnement-auth.js
node /tmp/relocate-accompagnement-auth.js "$APP_DIR"

node --check "$APP_DIR/server.js"

source ~/.profile 2>/dev/null || true
pm2 restart la-forge --update-env || pm2 restart la-forge

sleep 2
TEST_EMAIL="${FORGE_ADMIN_EMAIL:-${FORGE_DEMO_EMAIL:-}}"
TEST_PASSWORD="${FORGE_ADMIN_PASSWORD:-${FORGE_DEMO_PASSWORD:-}}"
if [ -z "$TEST_EMAIL" ] || [ -z "$TEST_PASSWORD" ]; then
  echo "ERREUR: définir FORGE_ADMIN_EMAIL + FORGE_ADMIN_PASSWORD (ou FORGE_DEMO_*)"
  exit 1
fi
curl -s -X POST 'https://app.torinvest-trading.com/api/login' \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}"
echo ""
pm2 logs la-forge --lines 5 --nostream | tail -8
echo "OK"
