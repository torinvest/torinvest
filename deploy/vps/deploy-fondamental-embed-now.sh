#!/usr/bin/env bash
# Déploie le pont Fondamental embed (same-origin) + vérifie les secrets.
#
# Usage :
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/cursor/fondamental-embed-proxy-691a/deploy/vps/deploy-fondamental-embed-now.sh" | bash

set -euo pipefail

REF="${TORINVEST_DEPLOY_REF:-cursor/fondamental-activate-fix-691a}"
BASE="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"
FORM_DIR="${FORM_DIR:-$HOME/torinvest-formation}"
RADAR_API="/var/www/torinvest/api"

echo "==> deploy-fondamental-embed ($REF)"

echo "==> secrets radar (sudo)"
if [ -f "$RADAR_API/config.local.php" ]; then
  sudo grep -E "ai_access_hmac_secret|formation_provision_secret" "$RADAR_API/config.local.php" 2>/dev/null || true
else
  echo "WARN: $RADAR_API/config.local.php introuvable"
fi

echo ""
echo "==> env formation (PM2)"
grep -E 'FORGE_FONDAMENTAL|FORGE_FORMATION_PROVISION' ~/.profile /etc/environment 2>/dev/null || true
pm2 env la-forge 2>/dev/null | grep -E 'FORGE_FONDAMENTAL|FORGE_FORMATION_PROVISION' || true

echo ""
echo "==> pull API radar"
if [ -f "$RADAR_API/fondamental-access.php" ]; then
  curl -fsSL "$BASE/deploy/vps/pull-fondamental.sh" -o /tmp/pull-fondamental.sh
  bash /tmp/pull-fondamental.sh main
else
  echo "SKIP pull-fondamental (pas radar sur ce host?)"
fi

echo ""
echo "==> patches formation → $FORM_DIR"
mkdir -p "$FORM_DIR/server-patches" "$FORM_DIR/public/js"

curl -fsSL "$BASE/deploy/vps/formation-server/routes-fondamental-bridge.js" \
  -o "$FORM_DIR/server-patches/routes-fondamental-bridge.js"
curl -fsSL "$BASE/deploy/vps/formation-server/fondamental-bridge-lib.js" \
  -o "$FORM_DIR/server-patches/fondamental-bridge-lib.js"
curl -fsSL "$BASE/la-forge/js/forge-fondamental.js" \
  -o "$FORM_DIR/public/js/forge-fondamental.js"
curl -fsSL "$BASE/deploy/vps/app-shells/fondamental.html" \
  -o "$FORM_DIR/public/fondamental.html"

grep -q 'fondamental-embed' "$FORM_DIR/server-patches/routes-fondamental-bridge.js" || {
  echo "ERREUR: routes-fondamental-bridge.js invalide"
  exit 1
}
echo "OK — routes-fondamental-bridge.js (embed)"

curl -fsSL "$BASE/la-forge/js/auth.js" \
  -o "$FORM_DIR/public/js/auth.js"

curl -fsSL "$BASE/deploy/vps/ensure-fondamental-after-session.js" -o /tmp/ensure-fb.js
node /tmp/ensure-fb.js "$FORM_DIR"

echo ""
echo "==> si secrets manquants, ajouter à ~/.profile puis :"
echo "   export FORGE_FONDAMENTAL_BRIDGE_SECRET=\"<ai_access_hmac_secret>\""
echo "   export FORGE_FORMATION_PROVISION_SECRET=\"<formation_provision_secret>\""
echo "   source ~/.profile && pm2 restart la-forge --update-env"

source ~/.profile 2>/dev/null || true
pm2 restart la-forge --update-env || true

echo ""
echo "==> test activate (nécessite cookie session — faire login navigateur avant)"
echo "   Ctrl+Shift+R sur https://app.torinvest-trading.com/fondamental.html"
echo "==> terminé"
