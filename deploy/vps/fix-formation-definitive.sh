#!/usr/bin/env bash
# Fix définitif crash login la-forge (req.session) — une seule commande.
#
# Usage :
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/fix-formation-definitive.sh" | bash -s -- ~/torinvest-formation

set -euo pipefail

APP_DIR="${1:-$HOME/torinvest-formation}"
REF="${TORINVEST_DEPLOY_REF:-main}"
BASE="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"

echo "==> fix-formation-definitive (ref: $REF) → $APP_DIR"

dl() {
  curl -fsSL --retry 3 --retry-delay 2 "$BASE/$1" -o "$2"
}

mkdir -p "$APP_DIR/server-patches" "$APP_DIR/deploy/vps"

dl "deploy/vps/formation-server/routes-formation-auth.js" "$APP_DIR/server-patches/routes-formation-auth.js"
dl "deploy/vps/relocate-accompagnement-auth.js" "$APP_DIR/deploy/vps/relocate-accompagnement-auth.js"

if ! grep -q 'if (!req.session)' "$APP_DIR/server-patches/routes-formation-auth.js"; then
  echo "ERREUR: routes-formation-auth.js invalide (pas de garde session)"
  exit 1
fi

node "$APP_DIR/deploy/vps/relocate-accompagnement-auth.js" "$APP_DIR"

# Pont Fondamental si absent
if ! grep -q 'fondamental-bridge' "$APP_DIR/server.js"; then
  dl "deploy/vps/wire-fondamental-bridge-only.js" /tmp/wire-fondamental-bridge-only.js
  node /tmp/wire-fondamental-bridge-only.js "$APP_DIR" || true
fi

node --check "$APP_DIR/server.js"

source ~/.profile 2>/dev/null || true
pm2 restart la-forge --update-env || pm2 restart la-forge

sleep 3
echo "==> PM2"
pm2 list | grep la-forge || true

echo "==> login abonne@"
LOGIN=$(curl -s -m 15 -X POST 'https://app.torinvest-trading.com/api/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"abonne@torinvest-trading.com","password":"AdminFonda2026!"}')
echo "$LOGIN" | head -c 200
echo ""

if echo "$LOGIN" | grep -q '"ok":true'; then
  echo "OK — login fonctionne"
else
  echo "WARN — login pas OK — logs :"
  pm2 logs la-forge --lines 15 --nostream | tail -20
fi
