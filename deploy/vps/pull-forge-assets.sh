#!/usr/bin/env bash
# Déploie JS/CSS La Forge sur l'app formation (VPS).
#
# SÉCURITÉ CONTENU : les 37 modules HTML restent sur le VPS (accès login).
# Ce script ne publie que le moteur JS/CSS — pas les leçons.
# Versionner les modules : repo GitHub PRIVÉ ou git local sur le VPS (pas public).
#
# Sur le VPS :
#   SHA=abc1234 curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/${SHA}/deploy/vps/pull-forge-assets.sh" | bash
#
# Ou branche :
#   BRANCH=cursor/formation-platform-691a curl -fsSL .../pull-forge-assets.sh | bash

set -eo pipefail

APP_DIR="${1:-/home/ubuntu/torinvest-formation}"
BRANCH="${BRANCH:-main}"
SHA="${SHA:-}"
if [[ -n "$SHA" ]]; then
  RAW_BASE="https://raw.githubusercontent.com/torinvest/torinvest/${SHA}/la-forge"
else
  RAW_BASE="https://raw.githubusercontent.com/torinvest/torinvest/${BRANCH}/la-forge"
fi

JS_FILES=(
  auth.js
  chart-exercise-registry.js
  course-data.js
  course-index.js
  forge-annotations.js
  forge-brand.js
  forge-calendar.js
  forge-consent.js
  forge-gate.js
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

echo "==> Téléchargement GitHub (${SHA:-$BRANCH}) → $APP_DIR/public"

for f in "${JS_FILES[@]}"; do
  echo "  js/$f"
  curl -fsSL "$RAW_BASE/js/$f" -o "$APP_DIR/public/js/$f"
done

for f in "${CSS_FILES[@]}"; do
  echo "  css/$f"
  curl -fsSL "$RAW_BASE/css/$f" -o "$APP_DIR/public/css/$f"
done

echo "OK — JS/CSS formation mis à jour ($(date -Iseconds)). Hard refresh (Ctrl+Shift+R)."
