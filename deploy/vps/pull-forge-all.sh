#!/usr/bin/env bash
# Déploie JS/CSS + shells HTML + patches serveur sur l'app formation (VPS).
#
# Sur le VPS :
#   SHA=<commit> curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/${SHA}/deploy/vps/pull-forge-all.sh" | bash
#
# Ou branche :
#   BRANCH=main curl -fsSL .../pull-forge-all.sh | bash

set -euo pipefail

APP_DIR="${1:-/home/ubuntu/torinvest-formation}"
BRANCH="${BRANCH:-main}"
SHA="${SHA:-}"
SCRIPT_REF="${SHA:-$BRANCH}"
BASE="https://raw.githubusercontent.com/torinvest/torinvest/${SCRIPT_REF}/deploy/vps"

echo "==> pull-forge-all ($SCRIPT_REF) → $APP_DIR"

# JS/CSS via pull-forge-assets (même ref)
export BRANCH SHA
bash <(curl -fsSL "${BASE}/pull-forge-assets.sh") "$APP_DIR"

RAW_ROOT="https://raw.githubusercontent.com/torinvest/torinvest/${SCRIPT_REF}"

pull_shell() {
  local src_rel="$1"
  local dest_rel="$2"
  local dest="$APP_DIR/$dest_rel"
  mkdir -p "$(dirname "$dest")"
  echo "  $dest_rel"
  curl -fsSL "${RAW_ROOT}/${src_rel}" -o "$dest"
}

echo "==> Shells HTML (public/)"
for page in dashboard.html calendar.html calendar-day.html login.html; do
  pull_shell "deploy/vps/app-shells/${page}" "public/${page}"
done
pull_shell "deploy/vps/app-shells/course/index.html" "public/course/index.html"

echo "==> Patches serveur (server-patches/)"
PATCHES_DIR="$APP_DIR/server-patches"
mkdir -p "$PATCHES_DIR"
for f in routes-progress.js middleware-require-subscribed.js routes-calendar.js; do
  echo "  server-patches/$f"
  curl -fsSL "${RAW_ROOT}/deploy/vps/formation-server/${f}" -o "$PATCHES_DIR/${f}"
done

echo "==> Scripts & docs (deploy/vps/)"
DEPLOY_DIR="$APP_DIR/deploy/vps"
mkdir -p "$DEPLOY_DIR/formation-server"
curl -fsSL "${RAW_ROOT}/deploy/vps/verify-formation-deploy.sh" -o "$DEPLOY_DIR/verify-formation-deploy.sh"
chmod +x "$DEPLOY_DIR/verify-formation-deploy.sh"
echo "  deploy/vps/verify-formation-deploy.sh"
curl -fsSL "${RAW_ROOT}/deploy/vps/backup-course-private.sh" -o "$DEPLOY_DIR/backup-course-private.sh"
chmod +x "$DEPLOY_DIR/backup-course-private.sh"
echo "  deploy/vps/backup-course-private.sh"
curl -fsSL "${RAW_ROOT}/deploy/vps/formation-server/INSTALL-VPS.md" \
  -o "$DEPLOY_DIR/formation-server/INSTALL-VPS.md"
echo "  deploy/vps/formation-server/INSTALL-VPS.md"

echo ""
echo "OK — formation complète ($(date -Iseconds))."
echo "→ Vérif : bash $DEPLOY_DIR/verify-formation-deploy.sh"
echo "→ Si première install : monter server-patches dans server.js (voir INSTALL-VPS.md)"
echo "→ pm2 restart torinvest-formation"
echo "→ Hard refresh navigateur (Ctrl+Shift+R)"
