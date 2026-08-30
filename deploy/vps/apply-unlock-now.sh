#!/usr/bin/env bash
# Déploiement unlock — URLs fixes sur main (pas de variable SHA).
#
# Sur le VPS, copier-coller TOUT le bloc :
#
#   cd ~/torinvest-formation
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/apply-unlock-now.sh" | bash
#
# Attention : -fsSL en minuscules (pas -fSSL)

set -euo pipefail

APP_DIR="${1:-/home/ubuntu/torinvest-formation}"
BASE="https://raw.githubusercontent.com/torinvest/torinvest/main"

if [[ ! -d "$APP_DIR/public/js" ]]; then
  echo "ERREUR: $APP_DIR/public/js introuvable"
  echo "Essayez: bash apply-unlock-now.sh /chemin/vers/torinvest-formation"
  exit 1
fi

echo "==> apply-unlock-now → $APP_DIR"

dl() {
  local gh_path="$1"
  local dest="$APP_DIR/public/$2"
  mkdir -p "$(dirname "$dest")"
  echo "  $2"
  curl -fsSL "$BASE/$gh_path" -o "$dest"
}

dl "la-forge/js/progress.js" "js/progress.js"
dl "la-forge/js/course-data.js" "js/course-data.js"
dl "la-forge/js/course-index.js" "js/course-index.js"
dl "la-forge/js/forge-unlock.js" "js/forge-unlock.js"
dl "la-forge/js/lesson-core.js" "js/lesson-core.js"
dl "deploy/vps/app-shells/course/index.html" "course/index.html"

PATCHES="$APP_DIR/server-patches"
mkdir -p "$PATCHES"
for pair in \
  "middleware-require-subscribed.js:middleware-require-subscribed.js" \
  "forge-unlock-server.js:forge-unlock-server.js" \
  "course-module-order.json:course-module-order.json"
do
  src="${pair%%:*}"
  echo "  server-patches/$src"
  curl -fsSL "$BASE/deploy/vps/formation-server/$src" -o "$PATCHES/$src" || echo "  WARN — $src"
done

echo ""
wc -c "$APP_DIR/public/js/progress.js" \
  "$APP_DIR/public/js/course-index.js" \
  "$APP_DIR/public/js/course-data.js"
echo ""
echo "OK — unlock appliqué ($(date -Iseconds))."
echo "→ pm2 restart la-forge"
echo "→ wc -c public/js/progress.js  (attendu ~14845)"
