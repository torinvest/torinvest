#!/usr/bin/env bash
# Déploie course-data.js (70 h) + dashboard sur l'app formation VPS.
set -euo pipefail
REF="${TORINVEST_DEPLOY_REF:-b15d540}"
BASE="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"
FORM_DIR="${1:-$HOME/torinvest-formation}"
JS="$FORM_DIR/public/js"

echo "==> Deploy 70 h formation stats (ref $REF) → $FORM_DIR"
mkdir -p "$JS"
curl -fsSL "$BASE/la-forge/js/course-data.js" -o "$JS/course-data.js"
curl -fsSL "$BASE/la-forge/js/course-index.js" -o "$JS/course-index.js"
curl -fsSL "$BASE/la-forge/js/fondamental-data.js" -o "$JS/fondamental-data.js"
curl -fsSL "$BASE/deploy/vps/app-shells/dashboard.html" -o "$FORM_DIR/public/dashboard.html"

grep -q 'FORGE_TOTAL_HOURS = 70' "$JS/course-data.js" || {
  echo "ERREUR: course-data.js pas à jour (attendu FORGE_TOTAL_HOURS=70)"
  exit 1
}
echo "OK — course-data.js FORGE_TOTAL_HOURS=70"
echo "Ctrl+Shift+R https://app.torinvest-trading.com/dashboard.html"
