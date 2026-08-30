#!/usr/bin/env bash
# Déploie JS/CSS La Forge sur l’app formation (VPS).
# Usage sur le VPS :
#   cd /home/ubuntu/torinvest-formation
#   bash deploy/vps/pull-forge-assets.sh
# Ou depuis le repo torinvest cloné sur le VPS :
#   bash /path/to/torinvest/deploy/vps/pull-forge-assets.sh /home/ubuntu/torinvest-formation

set -euo pipefail

APP_DIR="${1:-/home/ubuntu/torinvest-formation}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../" && pwd)"
SRC="$REPO_ROOT/la-forge"

if [[ ! -d "$SRC/js" ]]; then
  echo "ERREUR: $SRC/js introuvable. Clone torinvest ou passe APP_DIR."
  exit 1
fi

if [[ ! -d "$APP_DIR/public/js" ]]; then
  echo "ERREUR: $APP_DIR/public/js introuvable"
  exit 1
fi

echo "==> Sync la-forge/js → $APP_DIR/public/js"
rsync -av "$SRC/js/" "$APP_DIR/public/js/"

echo "==> Sync la-forge/css → $APP_DIR/public/css"
rsync -av "$SRC/css/" "$APP_DIR/public/css/"

echo "OK — redéploiement JS/CSS formation. Hard refresh navigateur (Ctrl+Shift+R)."
