#!/usr/bin/env bash
# Hotfix déblocage modules — sans full pull-forge-all.
#
# Sur le VPS :
#   SHA=<commit> curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/${SHA}/deploy/vps/pull-unlock-hotfix.sh" | bash
#
# Puis Ctrl+Shift+R sur /course/index.html

set -euo pipefail

APP_DIR="${1:-/home/ubuntu/torinvest-formation}"
SHA="${SHA:-main}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${SHA}"

echo "==> pull-unlock-hotfix ($SHA) → $APP_DIR"

pull() {
  local rel="$1"
  local dest="$APP_DIR/public/$rel"
  mkdir -p "$(dirname "$dest")"
  echo "  $rel"
  curl -fsSL "$RAW/la-forge/$rel" -o "$dest"
}

pull "js/course-data.js"
pull "js/course-index.js"
pull "js/forge-unlock.js"
pull "js/lesson-core.js"

curl -fsSL "$RAW/deploy/vps/app-shells/course/index.html" \
  -o "$APP_DIR/public/course/index.html"
echo "  course/index.html"

PATCHES="$APP_DIR/server-patches"
mkdir -p "$PATCHES"
for f in middleware-require-subscribed.js forge-unlock-server.js course-module-order.json; do
  echo "  server-patches/$f"
  curl -fsSL "$RAW/deploy/vps/formation-server/$f" -o "$PATCHES/$f"
done

echo ""
echo "OK — hotfix unlock ($(date -Iseconds))."
echo "→ pm2 restart la-forge"
echo "→ Hard refresh navigateur (Ctrl+Shift+R)"
echo "→ Vérif : curl -sI https://app.torinvest-trading.com/js/course-index.js | head -1"
