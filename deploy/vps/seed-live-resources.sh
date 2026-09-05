#!/usr/bin/env bash
# Installe le pack seed « Intégration client » (4 slides PDF) sur le VPS.
# Usage :
#   bash deploy/vps/seed-live-resources.sh
#   DIR=/var/lib/torinvest/live-resources bash deploy/vps/seed-live-resources.sh
set -euo pipefail

DIR="${LIVE_RESOURCES_DIR:-/var/lib/torinvest/live-resources}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SEED_DIR="${SCRIPT_DIR}/live-resources-seed"
PDF_NAME="la-forge-integration-client-4-slides.pdf"

if [[ ! -d "$SEED_DIR" ]]; then
  echo "ERREUR: seed introuvable ($SEED_DIR)"
  echo "→ tire d'abord pull-forge-all, ou lance depuis le clone git."
  exit 1
fi

echo "==> live-resources dir: $DIR"
sudo mkdir -p "$DIR"
sudo chown "$(whoami):$(whoami)" "$DIR" 2>/dev/null || true

if [[ -f "$SEED_DIR/$PDF_NAME" ]]; then
  cp -f "$SEED_DIR/$PDF_NAME" "$DIR/$PDF_NAME"
  echo "  OK PDF → $DIR/$PDF_NAME"
else
  echo "WARN: $PDF_NAME absent du seed — dépose-le manuellement dans $DIR"
fi

INDEX="$DIR/index.json"
if [[ ! -f "$INDEX" ]]; then
  cp -f "$SEED_DIR/index.json" "$INDEX"
  echo "  OK index créé"
else
  echo "  index.json existe déjà — on ne l'écrase pas"
  echo "  (pour forcer: cp $SEED_DIR/index.json $INDEX)"
fi

PDF_COUNT=$(find "$DIR" -maxdepth 1 -type f -iname '*.pdf' | wc -l | tr -d ' ')
echo "OK — $PDF_COUNT PDF dans $DIR"
echo "→ page élève : /resources.html"
echo "→ ping : curl -s localhost:3001/api/live-resources/ping || true"
