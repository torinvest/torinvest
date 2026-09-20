#!/usr/bin/env bash
# Déploie Atlas Styles sur le VPS (page + JS/CSS/icône + nav dashboard).
#
# ssh ubuntu@164.132.46.191
# curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/DEPLOY-STYLES-ATLAS.sh | bash
set -euo pipefail

if [[ -d /mnt/c/Windows ]] || [[ "$(hostname)" == DESKTOP* ]]; then
  echo "ERREUR: lance sur le VPS ubuntu@164.132.46.191, pas Windows/WSL."
  exit 1
fi

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
REF="${REF:-main}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"

echo "======== DEPLOY ATLAS STYLES ($REF) ========"
echo "APP=$APP_DIR"

mkdir -p "$APP_DIR/public/js" "$APP_DIR/public/css" "$APP_DIR/public/img" "$APP_DIR/public/course"

pull() {
  local url="$1" dest="$2"
  echo "  → $dest"
  curl -fsSL "$url" -o "$dest"
}

pull "$RAW/deploy/vps/app-shells/styles-atlas.html" "$APP_DIR/public/styles-atlas.html"
pull "$RAW/deploy/vps/app-shells/dashboard.html" "$APP_DIR/public/dashboard.html"
pull "$RAW/deploy/vps/app-shells/course/index.html" "$APP_DIR/public/course/index.html"
pull "$RAW/la-forge/js/forge-styles-atlas.js" "$APP_DIR/public/js/forge-styles-atlas.js"
pull "$RAW/la-forge/js/forge-brand.js" "$APP_DIR/public/js/forge-brand.js"
pull "$RAW/la-forge/css/forge-styles-atlas.css" "$APP_DIR/public/css/forge-styles-atlas.css"
pull "$RAW/la-forge/img/styles-atlas-icon.svg" "$APP_DIR/public/img/styles-atlas-icon.svg"

# bust cache lightly by touching? version query is in HTML (?v=1)
ls -lah \
  "$APP_DIR/public/styles-atlas.html" \
  "$APP_DIR/public/js/forge-styles-atlas.js" \
  "$APP_DIR/public/css/forge-styles-atlas.css" \
  "$APP_DIR/public/img/styles-atlas-icon.svg"

echo ""
echo "Vérif locale :"
curl -sS -o /dev/null -w "styles-atlas.html %{http_code}\n" "http://127.0.0.1:3001/styles-atlas.html" || true
curl -sS -o /dev/null -w "forge-styles-atlas.js %{http_code}\n" "http://127.0.0.1:3001/js/forge-styles-atlas.js" || true

echo ""
echo "Public :"
echo "  https://app.torinvest-trading.com/styles-atlas.html"
echo "  (connexion Premium requise pour voir le contenu)"
echo "======== DONE ========"
