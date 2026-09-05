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
for page in dashboard.html start.html calendar.html calendar-day.html login.html fondamental.html journal.html atlas.html ict-atlas.html books.html resources.html; do
  pull_shell "deploy/vps/app-shells/${page}" "public/${page}"
done
pull_shell "deploy/vps/app-shells/course/index.html" "public/course/index.html"

echo "==> Patches serveur (server-patches/)"
PATCHES_DIR="$APP_DIR/server-patches"
mkdir -p "$PATCHES_DIR"
for f in routes-progress.js middleware-require-subscribed.js routes-calendar.js routes-coaching-lives.js forge-unlock-server.js forge-progress-rules.js routes-formation-auth.js routes-fondamental-bridge.js routes-journal-bridge.js routes-atlas-bridge.js routes-books.js routes-live-resources.js fondamental-bridge-lib.js formation-users-lib.js accompagnement-worker-lib.js; do
  echo "  server-patches/$f"
  curl -fsSL "${RAW_ROOT}/deploy/vps/formation-server/${f}" -o "$PATCHES_DIR/${f}"
done
echo "  server-patches/course-module-order.json"
curl -fsSL "${RAW_ROOT}/deploy/vps/formation-server/course-module-order.json" \
  -o "$PATCHES_DIR/course-module-order.json"

echo "==> Scripts & docs (deploy/vps/)"
DEPLOY_DIR="$APP_DIR/deploy/vps"
mkdir -p "$DEPLOY_DIR/formation-server"
curl -fsSL "${RAW_ROOT}/deploy/vps/verify-formation-deploy.sh" -o "$DEPLOY_DIR/verify-formation-deploy.sh"
chmod +x "$DEPLOY_DIR/verify-formation-deploy.sh"
echo "  deploy/vps/verify-formation-deploy.sh"
curl -fsSL "${RAW_ROOT}/deploy/vps/backup-course-private.sh" -o "$DEPLOY_DIR/backup-course-private.sh"
chmod +x "$DEPLOY_DIR/backup-course-private.sh"
echo "  deploy/vps/backup-course-private.sh"
for script in wire-formation-server-patches.js deploy-coaching-now.sh wire-formation-accompagnement-auth.js verify-formation-live.sh finish-formation-vps-setup.sh recover-formation-server.sh repair-server-broken-wire.js fix-trust-proxy.js pull-unlock-hotfix.sh deploy-unlock-local.sh verify-unlock-live.sh patch-lesson-unlock-scripts.js patch-helmet-journal-frames.js patch-helmet-journal-frames.sh seed-live-resources.sh; do
  curl -fsSL "${RAW_ROOT}/deploy/vps/${script}" -o "$DEPLOY_DIR/${script}"
  chmod +x "$DEPLOY_DIR/${script}" 2>/dev/null || true
  echo "  deploy/vps/${script}"
done
curl -fsSL "${RAW_ROOT}/deploy/vps/formation-server/INSTALL-VPS.md" \
  -o "$DEPLOY_DIR/formation-server/INSTALL-VPS.md"
echo "  deploy/vps/formation-server/INSTALL-VPS.md"

echo ""

echo "==> Seed live-resources (PDF + index)"
SEED_DEST="$APP_DIR/deploy/vps/live-resources-seed"
mkdir -p "$SEED_DEST"
curl -fsSL "${RAW_ROOT}/deploy/vps/live-resources-seed/index.json" -o "$SEED_DEST/index.json" || true
curl -fsSL "${RAW_ROOT}/deploy/vps/live-resources-seed/la-forge-integration-client-4-slides.pdf" -o "$SEED_DEST/la-forge-integration-client-4-slides.pdf" || echo "WARN seed PDF (gros) — scp manuel si besoin"
curl -fsSL "${RAW_ROOT}/deploy/vps/LIVE-RESOURCES.md" -o "$APP_DIR/deploy/vps/LIVE-RESOURCES.md" || true
curl -fsSL "${RAW_ROOT}/deploy/vps/seed-live-resources.sh" -o "$APP_DIR/deploy/vps/seed-live-resources.sh" || true
chmod +x "$APP_DIR/deploy/vps/seed-live-resources.sh" 2>/dev/null || true

echo "OK — formation complète ($(date -Iseconds))."
echo "→ Vérif : bash $DEPLOY_DIR/verify-formation-deploy.sh"
echo "→ Si première install : monter server-patches dans server.js (voir INSTALL-VPS.md)"
echo "→ pm2 restart torinvest-formation"
echo "→ Hard refresh navigateur (Ctrl+Shift+R)"
