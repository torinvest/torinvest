#!/usr/bin/env bash
# Déploie le moteur replay pédagogique sur le VPS (JS + CSS + scripts leçons).
#
# Sur le VPS :
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/deploy-replay-now.sh" | bash -s -- ~/torinvest-formation
#   pm2 restart la-forge
#
# Vérification live : ouvrir https://app.torinvest-trading.com/js/forge-replay.js
# → doit contenir "FORGE_REPLAY_VERSION" et "enrichFrames"

set -euo pipefail

APP_DIR="${1:-/home/ubuntu/torinvest-formation}"
SHA="${SHA:-main}"
BASE="https://raw.githubusercontent.com/torinvest/torinvest/${SHA}"

if [[ ! -d "$APP_DIR/public/js" ]]; then
  echo "ERREUR: $APP_DIR/public/js introuvable — exécutez ce script SUR le VPS."
  exit 1
fi

echo "==> deploy-replay-now → $APP_DIR (ref $SHA)"

dl() {
  local gh_path="$1"
  local dest="$APP_DIR/public/$2"
  mkdir -p "$(dirname "$dest")"
  echo "  $2"
  curl -fsSL "$BASE/$gh_path" -o "$dest"
}

dl "la-forge/js/forge-replay.js" "js/forge-replay.js"
dl "la-forge/js/forge-annotations.js" "js/forge-annotations.js"
dl "la-forge/js/lesson-core.js" "js/lesson-core.js"
dl "la-forge/css/forge-charts.css" "css/forge-charts.css"

PATCH_JS="$APP_DIR/deploy/vps/patch-lesson-replay-scripts.js"
mkdir -p "$(dirname "$PATCH_JS")"
echo "  deploy/vps/patch-lesson-replay-scripts.js"
curl -fsSL "$BASE/deploy/vps/patch-lesson-replay-scripts.js" -o "$PATCH_JS"
node "$PATCH_JS" "$APP_DIR" || true

if grep -q 'FORGE_REPLAY_VERSION' "$APP_DIR/public/js/forge-replay.js"; then
  echo "  OK forge-replay version marker"
else
  echo "  ERREUR: forge-replay.js ne contient pas FORGE_REPLAY_VERSION"
  exit 1
fi

if grep -q 'enrichFrames' "$APP_DIR/public/js/forge-replay.js"; then
  echo "  OK enrichFrames"
else
  echo "  ERREUR: enrichFrames absent"
  exit 1
fi

echo ""
echo "OK — replay déployé ($(date -Iseconds))."
echo "→ pm2 restart la-forge"
echo "→ Hard refresh Ctrl+Shift+R sur une leçon avec replay"
echo "→ Vous devez voir la barre « Lecture guidée » en doré au-dessus du chart"
