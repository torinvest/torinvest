#!/usr/bin/env bash
# Déploie le fix : login formation = email Stripe + clé TOR (pas de 2e système).
# Sur le VPS :
#   REF=cursor/tor-license-login-fix-691a bash <(curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/$REF/deploy/vps/deploy-tor-license-login-fix.sh)
set -euo pipefail

APP="${1:-/home/ubuntu/torinvest-formation}"
REF="${REF:-main}"
BASE="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"

echo "==> App: $APP  ref: $REF"
mkdir -p "$APP/server-patches" "$APP/public/js"

curl -fsSL "$BASE/deploy/vps/formation-server/accompagnement-worker-lib.js" \
  -o "$APP/server-patches/accompagnement-worker-lib.js"
curl -fsSL "$BASE/deploy/vps/formation-server/routes-formation-auth.js" \
  -o "$APP/server-patches/routes-formation-auth.js"
curl -fsSL "$BASE/deploy/vps/formation-server/formation-users-lib.js" \
  -o "$APP/server-patches/formation-users-lib.js"
curl -fsSL "$BASE/deploy/vps/app-shells/login.html" -o "$APP/public/login.html"
curl -fsSL "$BASE/la-forge/js/auth.js" -o "$APP/public/js/auth.js"

curl -fsSL "$BASE/deploy/vps/wire-formation-accompagnement-auth.js" \
  -o /tmp/wire-formation-accompagnement-auth.js
node /tmp/wire-formation-accompagnement-auth.js "$APP"

pm2 restart la-forge --update-env || pm2 restart all --update-env

echo "==> Ping"
curl -sS "http://127.0.0.1:3001/api/accompagnement-auth/ping" || curl -sS "https://app.torinvest-trading.com/api/accompagnement-auth/ping" || true
echo
echo "OK — client : email Stripe + clé TOR-ACCOMPAGNEMENT dans mot de passe"
