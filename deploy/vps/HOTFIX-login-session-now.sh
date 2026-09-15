#!/usr/bin/env bash
# Hotfix immédiat : login MDP sans bloquer sur session_missing
# + diagnostic session + replace auth router
set -euo pipefail
APP_DIR="${1:-$HOME/torinvest-formation}"
REF="${TORINVEST_DEPLOY_REF:-cursor/urgent-formation-login-691a}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"
EMAIL="${CLIENT_EMAIL:-nassim.harrat92000@gmail.com}"
PASS="${CLIENT_PASS:-SK3WZvEnK4uHN4}"

echo "==> Pull routes-formation-auth (délègue si pas de session)"
curl -fsSL "$RAW/deploy/vps/formation-server/routes-formation-auth.js" \
  -o "$APP_DIR/server-patches/routes-formation-auth.js"

echo "==> ensure-accompagnement-after-session"
curl -fsSL "$RAW/deploy/vps/ensure-accompagnement-after-session.js" -o /tmp/ensure-acc.js
node /tmp/ensure-acc.js "$APP_DIR"

pm2 restart la-forge --update-env
sleep 3

echo "==> Test login MDP $EMAIL"
curl -sS -X POST 'http://127.0.0.1:3001/api/login' \
  -H 'Content-Type: application/json' \
  -c /tmp/t.cj -b /tmp/t.cj \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}"
echo
echo "==> /api/me"
curl -sS 'http://127.0.0.1:3001/api/me' -b /tmp/t.cj -c /tmp/t.cj
echo
