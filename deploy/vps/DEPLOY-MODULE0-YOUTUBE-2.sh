#!/usr/bin/env bash
# Déploie la 2ᵉ vidéo Module 0 (YouTube) + CSP frame-src.
#
#   curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/DEPLOY-MODULE0-YOUTUBE-2.sh | bash
# Avant merge :
#   REF=cursor/module0-yt2-691a curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/${REF}/deploy/vps/DEPLOY-MODULE0-YOUTUBE-2.sh" | bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
REF="${REF:-main}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"

echo "======== DEPLOY MODULE0 YOUTUBE 2 ($REF) ========"

mkdir -p "$APP_DIR/deploy/vps"
curl -fsSL "$RAW/deploy/vps/wire-module0-youtube-2.sh" -o "$APP_DIR/deploy/vps/wire-module0-youtube-2.sh"
curl -fsSL "$RAW/deploy/vps/patch-helmet-journal-frames.js" -o "$APP_DIR/deploy/vps/patch-helmet-journal-frames.js"
chmod +x "$APP_DIR/deploy/vps/wire-module0-youtube-2.sh"

APP_DIR="$APP_DIR" bash "$APP_DIR/deploy/vps/wire-module0-youtube-2.sh" "$APP_DIR"

echo "==> CSP YouTube (frame-src)"
node "$APP_DIR/deploy/vps/patch-helmet-journal-frames.js" "$APP_DIR" || true

pm2 restart la-forge --update-env 2>/dev/null || pm2 restart all --update-env || true
sleep 1

echo ""
echo "→ https://app.torinvest-trading.com/course/intro-metier.html"
echo "======== DONE ========"
