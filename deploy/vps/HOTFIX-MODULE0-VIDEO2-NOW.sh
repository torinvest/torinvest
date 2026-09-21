#!/usr/bin/env bash
# Hotfix immédiat Module 0 vidéo 2 — remplace YouTube par MP4 protégé.
# Prérequis : ~/module-0-metier.mkv (ou .mp4) déjà uploadé via scp.
#
#   curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/cursor/module0-yt2-691a/deploy/vps/HOTFIX-MODULE0-VIDEO2-NOW.sh | bash
set -euo pipefail

export VIDEO_SRC="${VIDEO_SRC:-}"
if [[ -z "$VIDEO_SRC" ]]; then
  for c in "$HOME/module-0-metier.mkv" "$HOME/module-0-metier.mp4" \
           "$HOME/torinvest-formation/public/course/videos/module-0-metier.mp4"; do
    [[ -f "$c" ]] && VIDEO_SRC="$c" && break
  done
fi
export VIDEO_SRC
export REF="${REF:-cursor/module0-yt2-691a}"
export APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"

echo "HOTFIX VIDEO2 — SRC=${VIDEO_SRC:-?} APP=$APP_DIR REF=$REF"
if [[ -z "${VIDEO_SRC:-}" || ! -f "$VIDEO_SRC" ]]; then
  echo "ERREUR: ~/module-0-metier.mkv introuvable. Refais le scp d'abord."
  ls -lh "$HOME"/module-0-metier.* 2>/dev/null || true
  exit 1
fi

curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/${REF}/deploy/vps/DEPLOY-MODULE0-VIDEO2-FROM-FILE.sh" | bash
