#!/usr/bin/env bash
# Déploie les fonds d'écran forge (taureau / ours) + CSS/JS ambient sur le VPS.
#
# Sur le VPS :
#   curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/DEPLOY-FORGE-WALLPAPERS.sh | bash
# Ou avant merge :
#   REF=cursor/forge-wallpapers-691a curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/${REF}/deploy/vps/DEPLOY-FORGE-WALLPAPERS.sh | bash
set -euo pipefail

if [[ -d /mnt/c/Windows ]] || [[ "$(hostname)" == DESKTOP* ]]; then
  echo "ERREUR: lance sur le VPS ubuntu@164.132.46.191, pas Windows/WSL."
  exit 1
fi

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
REF="${REF:-main}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"

echo "======== DEPLOY FORGE WALLPAPERS ($REF) ========"
echo "APP=$APP_DIR"

mkdir -p "$APP_DIR/public/js" "$APP_DIR/public/css" "$APP_DIR/public/img" "$APP_DIR/public/la-forge/img"

pull() {
  local url="$1" dest="$2"
  echo "  → $dest"
  curl -fsSL "$url" -o "$dest"
}

pull "$RAW/la-forge/css/main.css" "$APP_DIR/public/css/main.css"
pull "$RAW/la-forge/js/forge-brand.js" "$APP_DIR/public/js/forge-brand.js"

for f in \
  forge-wallpaper-bull.webp \
  forge-wallpaper-bull.jpg \
  forge-wallpaper-bear.webp \
  forge-wallpaper-bear.jpg
do
  pull "$RAW/la-forge/img/$f" "$APP_DIR/public/img/$f"
  cp "$APP_DIR/public/img/$f" "$APP_DIR/public/la-forge/img/$f"
done

ls -lah \
  "$APP_DIR/public/css/main.css" \
  "$APP_DIR/public/js/forge-brand.js" \
  "$APP_DIR/public/img/forge-wallpaper-bull.webp" \
  "$APP_DIR/public/img/forge-wallpaper-bear.webp"

echo ""
echo "Vérif locale :"
curl -sS -o /dev/null -w "bull.webp %{http_code}\n" "http://127.0.0.1:3001/img/forge-wallpaper-bull.webp" || true
curl -sS -o /dev/null -w "bear.webp %{http_code}\n" "http://127.0.0.1:3001/img/forge-wallpaper-bear.webp" || true
curl -sS -o /dev/null -w "main.css %{http_code}\n" "http://127.0.0.1:3001/css/main.css" || true

echo ""
echo "Public (hard refresh Ctrl+Shift+R) :"
echo "  https://app.torinvest-trading.com/dashboard.html"
echo "======== DONE ========"
