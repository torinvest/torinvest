#!/usr/bin/env bash
# Déploie Voir + Télécharger synthèse élève sur les fiches coaching.
#
#   curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/DEPLOY-COACHING-FICHE-EXPORT.sh | bash
# Avant merge :
#   REF=cursor/coaching-fiche-export-691a curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/${REF}/deploy/vps/DEPLOY-COACHING-FICHE-EXPORT.sh" | bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
REF="${REF:-main}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"

echo "======== DEPLOY FICHE EXPORT ($REF) ========"
mkdir -p "$APP_DIR/public/js" "$APP_DIR/public/css"

curl -fsSL "$RAW/la-forge/js/forge-coaching-fiches.js" -o "$APP_DIR/public/js/forge-coaching-fiches.js"
curl -fsSL "$RAW/la-forge/css/forge-coaching-fiches.css" -o "$APP_DIR/public/css/forge-coaching-fiches.css"
curl -fsSL "$RAW/deploy/vps/app-shells/coaching-fiches.html" -o "$APP_DIR/public/coaching-fiches.html"

grep -n "Télécharger\|data-cf-download\|v=3" "$APP_DIR/public/coaching-fiches.html" "$APP_DIR/public/js/forge-coaching-fiches.js" | head -15

echo ""
echo "→ Hard refresh : https://app.torinvest-trading.com/coaching-fiches.html"
echo "======== DONE ========"
