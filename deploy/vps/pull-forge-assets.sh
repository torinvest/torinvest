#!/usr/bin/env bash
# Déploie JS/CSS La Forge sur l’app formation (VPS).
#
# Sur le VPS :
#   curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/cursor/formation-audit-fixes-691a/deploy/vps/pull-forge-assets.sh | bash
#
# Ou :
#   curl -fsSL ... -o /tmp/pull-forge.sh && bash /tmp/pull-forge.sh

set -eo pipefail

APP_DIR="${1:-/home/ubuntu/torinvest-formation}"
BRANCH="${BRANCH:-cursor/formation-audit-fixes-691a}"
RAW_BASE="https://raw.githubusercontent.com/torinvest/torinvest/${BRANCH}/la-forge"

JS_FILES=(
  auth.js
  chart-exercise-registry.js
  course-data.js
  course-index.js
  forge-annotations.js
  forge-brand.js
  forge-calendar.js
  forge-legal.js
  forge-replay.js
  legal-page.js
  lesson-core.js
  progress.js
)

CSS_FILES=(
  forge-charts.css
  landing.css
  legal.css
  lesson-pro.css
  main.css
)

if [[ ! -d "$APP_DIR/public/js" ]]; then
  echo "ERREUR: $APP_DIR/public/js introuvable"
  echo "Vérifie le chemin de l'app : ls /home/ubuntu/"
  exit 1
fi

echo "==> Téléchargement GitHub ($BRANCH) → $APP_DIR/public"

for f in "${JS_FILES[@]}"; do
  echo "  js/$f"
  curl -fsSL "$RAW_BASE/js/$f" -o "$APP_DIR/public/js/$f"
done

for f in "${CSS_FILES[@]}"; do
  echo "  css/$f"
  curl -fsSL "$RAW_BASE/css/$f" -o "$APP_DIR/public/css/$f"
done

echo "OK — JS/CSS formation mis à jour. Hard refresh (Ctrl+Shift+R)."
