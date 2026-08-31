#!/usr/bin/env bash
# Hotfix déblocage modules — sans full pull-forge-all.
#
# Sur le VPS (note : -fsSL en minuscules, pas -fSSL) :
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/pull-unlock-hotfix.sh" | bash
#
# Ou avec SHA explicite :
#   SHA=main curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/pull-unlock-hotfix.sh" | bash
#
# Si le repo Git est sur le VPS (la-forge/ présent) :
#   bash deploy/vps/deploy-unlock-local.sh
#
# Puis Ctrl+Shift+R sur /course/index.html

set -euo pipefail

APP_DIR="${1:-/home/ubuntu/torinvest-formation}"
SHA="${SHA:-main}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${SHA}"

echo "==> pull-unlock-hotfix ($SHA) → $APP_DIR"

if [[ ! -d "$APP_DIR/public/js" ]]; then
  echo "ERREUR: $APP_DIR/public/js introuvable"
  echo "Passez le chemin : bash pull-unlock-hotfix.sh /chemin/vers/app"
  exit 1
fi

pull() {
  local rel="$1"
  local required="${2:-1}"
  local dest="$APP_DIR/public/$rel"
  mkdir -p "$(dirname "$dest")"
  echo "  $rel"
  if curl -fsSL "$RAW/la-forge/$rel" -o "$dest"; then
    return 0
  fi
  if [[ "$required" == "1" ]]; then
    echo "  ERREUR 404 : $RAW/la-forge/$rel"
    echo "  → Le SHA $SHA n'est peut-être pas mergé. Essayez SHA=main"
    exit 1
  fi
  echo "  WARN — optionnel, ignoré"
  return 1
}

pull "js/progress.js" 1
pull "js/course-data.js" 1
pull "js/course-index.js" 1
pull "js/forge-unlock.js" 0
pull "js/lesson-core.js" 0

if curl -fsSL "$RAW/deploy/vps/app-shells/course/index.html" \
  -o "$APP_DIR/public/course/index.html"; then
  echo "  course/index.html"
else
  echo "  WARN — course/index.html non mis à jour (404)"
fi

PATCHES="$APP_DIR/server-patches"
mkdir -p "$PATCHES"
for f in middleware-require-subscribed.js forge-unlock-server.js forge-progress-rules.js routes-progress.js course-module-order.json; do
  echo "  server-patches/$f"
  curl -fsSL "$RAW/deploy/vps/formation-server/$f" -o "$PATCHES/$f" || echo "  WARN — $f"
done

if [[ -f "$APP_DIR/deploy/vps/patch-lesson-unlock-scripts.js" ]]; then
  echo "==> patch lesson HTML"
  node "$APP_DIR/deploy/vps/patch-lesson-unlock-scripts.js" "$APP_DIR" || true
elif curl -fsSL "$RAW/deploy/vps/patch-lesson-unlock-scripts.js" -o "$APP_DIR/deploy/vps/patch-lesson-unlock-scripts.js"; then
  node "$APP_DIR/deploy/vps/patch-lesson-unlock-scripts.js" "$APP_DIR" || true
fi

echo ""
echo "Tailles déployées :"
wc -c "$APP_DIR/public/js/progress.js" \
  "$APP_DIR/public/js/course-index.js" \
  "$APP_DIR/public/js/course-data.js" 2>/dev/null || true

echo ""
echo "OK — hotfix unlock ($(date -Iseconds))."
echo "→ pm2 restart la-forge"
echo "→ curl -fsSL \"$RAW/deploy/vps/verify-unlock-live.sh\" | bash"
