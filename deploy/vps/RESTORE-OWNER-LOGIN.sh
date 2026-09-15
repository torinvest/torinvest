#!/usr/bin/env bash
# Restaure le login natif (abonne@ etc.) sans casser Nassim / Brevo.
# curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/cursor/restore-owner-login-691a/deploy/vps/RESTORE-OWNER-LOGIN.sh | bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
REF="${TORINVEST_DEPLOY_REF:-cursor/restore-owner-login-691a}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"

echo "======== RESTORE OWNER LOGIN ========"
echo "APP=$APP_DIR REF=$REF"

mkdir -p "$APP_DIR/server-patches"

echo "==> 1) routes-formation-auth (délègue au natif si pas dans users.json)"
curl -fsSL "$RAW/deploy/vps/formation-server/routes-formation-auth.js" \
  -o "$APP_DIR/server-patches/routes-formation-auth.js"

# S'assurer que le shim est présent (déjà déployé par FIX-LOGIN-FINAL)
if [[ ! -f "$APP_DIR/server-patches/forge-session-shim.js" ]]; then
  curl -fsSL "$RAW/deploy/vps/formation-server/forge-session-shim.js" \
    -o "$APP_DIR/server-patches/forge-session-shim.js"
fi

echo "==> 2) Restart la-forge"
pm2 restart la-forge --update-env
sleep 3

echo "==> 3) Ping auth"
curl -sS 'http://127.0.0.1:3001/api/accompagnement-auth/ping' || true
echo

echo "================ SUCCESS ================"
echo "Login natif (abonne@…) rétabli : si le MDP n'est pas dans users.json,"
echo "le pont formation laisse passer server.js."
echo "Clients provisionnés (Nassim) + Brevo : inchangés."
echo "Login : https://app.torinvest-trading.com/login.html"
echo "========================================="
