#!/usr/bin/env bash
# Déploie le déblocage modules depuis le clone Git local (VPS avec repo complet).
#
# Usage sur le VPS :
#   cd ~/torinvest-formation   # ou cd ~/torinvest && APP_DIR=...
#   bash deploy/vps/deploy-unlock-local.sh
#
# Ou depuis n'importe où :
#   bash /home/ubuntu/torinvest-formation/deploy/vps/deploy-unlock-local.sh /home/ubuntu/torinvest-formation

set -euo pipefail

APP_DIR="${1:-${APP_DIR:-/home/ubuntu/torinvest-formation}}"
REPO_ROOT="${REPO_ROOT:-$APP_DIR}"

echo "==> deploy-unlock-local (APP_DIR=$APP_DIR)"

if [[ ! -d "$APP_DIR/public/js" ]]; then
  echo "ERREUR: $APP_DIR/public/js introuvable"
  exit 1
fi

if [[ -d "$REPO_ROOT/.git" ]]; then
  echo "==> git pull origin main"
  git -C "$REPO_ROOT" fetch origin main
  git -C "$REPO_ROOT" checkout main 2>/dev/null || true
  git -C "$REPO_ROOT" pull origin main
fi

SRC_JS="$REPO_ROOT/la-forge/js"
if [[ ! -d "$SRC_JS" ]]; then
  echo "ERREUR: $SRC_JS introuvable — ce clone n'a pas la-forge/."
  echo "Utilisez plutôt : SHA=main curl -fsSL \"https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/pull-unlock-hotfix.sh\" | bash"
  exit 1
fi

copy_js() {
  local name="$1"
  echo "  public/js/$name"
  cp "$SRC_JS/$name" "$APP_DIR/public/js/$name"
}

copy_js progress.js
copy_js course-data.js
copy_js course-index.js
copy_js forge-unlock.js
copy_js lesson-core.js

INDEX_SRC="$REPO_ROOT/deploy/vps/app-shells/course/index.html"
if [[ -f "$INDEX_SRC" ]]; then
  echo "  public/course/index.html"
  cp "$INDEX_SRC" "$APP_DIR/public/course/index.html"
fi

PATCH_SRC="$REPO_ROOT/deploy/vps/formation-server"
PATCH_DEST="$APP_DIR/server-patches"
if [[ -d "$PATCH_SRC" ]]; then
  mkdir -p "$PATCH_DEST"
  for f in middleware-require-subscribed.js forge-unlock-server.js course-module-order.json; do
    if [[ -f "$PATCH_SRC/$f" ]]; then
      echo "  server-patches/$f"
      cp "$PATCH_SRC/$f" "$PATCH_DEST/$f"
    fi
  done
fi

echo ""
echo "OK — fichiers copiés ($(date -Iseconds))."
echo "Tailles :"
wc -c "$APP_DIR/public/js/progress.js" "$APP_DIR/public/js/course-index.js" "$APP_DIR/public/js/course-data.js"
echo "→ pm2 restart la-forge"
echo "→ bash deploy/vps/verify-unlock-live.sh"
