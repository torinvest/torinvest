#!/usr/bin/env bash
# Déploiement complet La Forge (assets + shells + auth + fondamental + verify).
set -euo pipefail

APP_DIR="${1:-}"
if [ -z "$APP_DIR" ]; then
  if [ -d "/home/ubuntu/torinvest-formation/public/js" ]; then
    APP_DIR="/home/ubuntu/torinvest-formation"
  elif [ -d "$HOME/torinvest-formation/public/js" ]; then
    APP_DIR="$HOME/torinvest-formation"
  else
    APP_DIR="/home/ubuntu/torinvest-formation"
  fi
fi
BRANCH="${BRANCH:-main}"
SHA="${SHA:-}"
SCRIPT_REF="${SHA:-$BRANCH}"
BASE="https://raw.githubusercontent.com/torinvest/torinvest/${SCRIPT_REF}/deploy/vps"

echo "==> deploy-la-forge-full ($SCRIPT_REF) → $APP_DIR"

if [ ! -d "$APP_DIR/public/js" ]; then
  echo "ERREUR: $APP_DIR/public/js introuvable"
  echo "Tu es probablement connecté en mauvais user (besoin: ubuntu)."
  echo "Essaie :"
  echo "  sudo -iu ubuntu"
  echo "  ou : curl ... | bash -s -- /home/ubuntu/torinvest-formation"
  echo "Chemins possibles :"
  ls -ld /home/ubuntu/torinvest-formation /home/*/torinvest-formation 2>/dev/null || true
  exit 1
fi

export BRANCH SHA
bash <(curl -fsSL "${BASE}/pull-forge-all.sh") "$APP_DIR"

RADAR_API="/var/www/torinvest/api"
if [ -d "$RADAR_API" ]; then
  echo "==> API radar Fondamental"
  bash <(curl -fsSL "${BASE}/pull-fondamental.sh") "$SCRIPT_REF" || true
fi

if [ -f "$APP_DIR/deploy/vps/verify-formation-deploy.sh" ]; then
  bash "$APP_DIR/deploy/vps/verify-formation-deploy.sh" || true
fi

if grep -q 'FORGE_TOTAL_HOURS = 70' "$APP_DIR/public/js/course-data.js"; then
  echo "OK — course-data.js 70 h"
else
  echo "WARN — course-data.js pas à jour (70 h)"
fi

if grep -q 'activate-wallet' "$APP_DIR/server-patches/routes-fondamental-bridge.js"; then
  echo "OK — bridge wallet KRM"
else
  echo "WARN — routes-fondamental-bridge.js sans activate-wallet"
fi

source ~/.profile 2>/dev/null || true
pm2 restart la-forge --update-env 2>/dev/null || pm2 restart torinvest-formation --update-env 2>/dev/null || true

echo "OK — Ctrl+Shift+R https://app.torinvest-trading.com/dashboard.html"
