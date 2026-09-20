#!/usr/bin/env bash
# Déploie Atlas Psychologie sur le VPS.
# ssh ubuntu@164.132.46.191
# curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/cursor/psychology-atlas-691a/deploy/vps/DEPLOY-PSYCHO-ATLAS.sh | bash
set -euo pipefail

if [[ -d /mnt/c/Windows ]] || [[ "$(hostname)" == DESKTOP* ]]; then
  echo "ERREUR: lance sur le VPS, pas Windows/WSL."
  exit 1
fi

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
REF="${REF:-cursor/psychology-atlas-691a}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"

echo "======== DEPLOY ATLAS PSYCHO ($REF) ========"
mkdir -p "$APP_DIR/public/js" "$APP_DIR/public/css" "$APP_DIR/public/img" "$APP_DIR/public/course"

pull() { echo "  → $2"; curl -fsSL "$1" -o "$2"; }

pull "$RAW/deploy/vps/app-shells/psycho-atlas.html" "$APP_DIR/public/psycho-atlas.html"
pull "$RAW/deploy/vps/app-shells/dashboard.html" "$APP_DIR/public/dashboard.html"
pull "$RAW/deploy/vps/app-shells/course/index.html" "$APP_DIR/public/course/index.html"
pull "$RAW/la-forge/js/forge-psycho-atlas.js" "$APP_DIR/public/js/forge-psycho-atlas.js"
pull "$RAW/la-forge/js/forge-brand.js" "$APP_DIR/public/js/forge-brand.js"
pull "$RAW/la-forge/css/forge-psycho-atlas.css" "$APP_DIR/public/css/forge-psycho-atlas.css"
pull "$RAW/la-forge/img/psycho-atlas-icon.svg" "$APP_DIR/public/img/psycho-atlas-icon.svg"

ls -lah "$APP_DIR/public/psycho-atlas.html" "$APP_DIR/public/js/forge-psycho-atlas.js"
echo "URL: https://app.torinvest-trading.com/psycho-atlas.html"
echo "======== DONE ========"
