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

set -euo pipefail

APP_DIR="${1:-/home/ubuntu/torinvest-formation}"
BRANCH="${BRANCH:-main}"
SHA="${SHA:-}"
if [[ -n "$SHA" ]]; then
  RAW_BASE="https://raw.githubusercontent.com/torinvest/torinvest/${SHA}/la-forge"
  REF_LABEL="$SHA"
else
  RAW_BASE="https://raw.githubusercontent.com/torinvest/torinvest/${BRANCH}/la-forge"
  REF_LABEL="$BRANCH"
fi

JS_FILES=(
  auth.js
  chart-exercise-registry.js
  course-data.js
  fondamental-data.js
  course-index.js
  forge-annotations.js
  forge-brand.js
  forge-calendar.js
  forge-consent.js
  forge-fondamental.js
  forge-journal.js
  books-data.js
  forge-books.js
  forge-gate.js
  forge-unlock.js
  forge-legal.js
  forge-onboarding.js
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

IMG_FILES=(
  forge-anvil.png
  torinvest-logo-full.png
  live-trading-banner.png
)

if [[ ! -d "$APP_DIR/public/js" ]]; then
  echo "ERREUR: $APP_DIR/public/js introuvable"
  echo "Vérifie le chemin de l'app : ls /home/ubuntu/"
  exit 1
fi

echo "==> Téléchargement GitHub ($REF_LABEL) → $APP_DIR/public"
FAIL=0

pull_file() {
  local subdir="$1"
  local name="$2"
  local url="$RAW_BASE/$subdir/$name"
  local dest="$APP_DIR/public/$subdir/$name"
  echo "  $subdir/$name"
  if curl -fsSL "$url" -o "$dest"; then
    return 0
  fi
  echo "  ERREUR 404 ou réseau : $url"
  FAIL=$((FAIL + 1))
  return 1
}

for f in "${JS_FILES[@]}"; do
  pull_file js "$f" || true
done

for f in "${CSS_FILES[@]}"; do
  pull_file css "$f" || true
done

mkdir -p "$APP_DIR/public/img" "$APP_DIR/public/la-forge/img"
for f in "${IMG_FILES[@]}"; do
  echo "  img/$f"
  if curl -fsSL "$RAW_BASE/img/$f" -o "$APP_DIR/public/img/$f"; then
    cp "$APP_DIR/public/img/$f" "$APP_DIR/public/la-forge/img/$f"
  else
    echo "  ERREUR 404 ou réseau : $RAW_BASE/img/$f"
    FAIL=$((FAIL + 1))
  fi
done

if [[ "$FAIL" -gt 0 ]]; then
  echo ""
  echo "ÉCHEC : $FAIL fichier(s) introuvable(s) pour la ref $REF_LABEL."
  echo "→ Utilisez un SHA qui contient tous les fichiers, ex. :"
  echo "   SHA=d5c5695 curl -fsSL \"https://raw.githubusercontent.com/torinvest/torinvest/d5c5695/deploy/vps/pull-forge-assets.sh\" | bash"
  exit 1
fi

echo "OK — JS/CSS formation mis à jour ($(date -Iseconds)). Hard refresh (Ctrl+Shift+R)."
