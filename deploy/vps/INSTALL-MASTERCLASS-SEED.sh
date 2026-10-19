#!/usr/bin/env bash
# Installe les 23 chapitres Masterclass dans data/masterclass/chapters/
# À lancer SUR le VPS après scp du seed (ou du 7z / docx).
#
#   MASTERCLASS_SEED_TGZ=/tmp/masterclass-seed.tar.gz bash /tmp/INSTALL-MASTERCLASS-SEED.sh
#   MASTERCLASS_SEED_7Z=/tmp/chapitre1a23.7z bash /tmp/INSTALL-MASTERCLASS-SEED.sh
#
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
CH_DIR="$APP_DIR/data/masterclass/chapters"
mkdir -p "$CH_DIR" "$APP_DIR/data/masterclass/progress"

REF="${MASTERCLASS_REF:-main}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"

echo "======== INSTALL MASTERCLASS SEED ========"

SEED_TGZ="${MASTERCLASS_SEED_TGZ:-/tmp/masterclass-seed.tar.gz}"
SEED_7Z="${MASTERCLASS_SEED_7Z:-/tmp/chapitre1a23.7z}"
SEED_DOCX_DIR="${MASTERCLASS_DOCX_DIR:-/tmp/masterclass-docx}"

installed=0

if [[ -f "$SEED_TGZ" ]]; then
  echo "==> Extract $SEED_TGZ"
  tar -xzf "$SEED_TGZ" -C "$APP_DIR/data/masterclass"
  installed=1
elif [[ -f "$SEED_7Z" ]]; then
  echo "==> Extract 7z $SEED_7Z"
  WORK=/tmp/mc-docx-$$
  mkdir -p "$WORK" "$SEED_DOCX_DIR"
  if command -v 7z >/dev/null 2>&1; then
    7z x -y -o"$WORK" "$SEED_7Z" >/dev/null
  elif command -v 7za >/dev/null 2>&1; then
    7za x -y -o"$WORK" "$SEED_7Z" >/dev/null
  else
    sudo apt-get update -qq && sudo apt-get install -y -qq p7zip-full
    7z x -y -o"$WORK" "$SEED_7Z" >/dev/null
  fi
  find "$WORK" -type f -iname 'chapitre*.docx' -exec cp -f {} "$SEED_DOCX_DIR/" \;
  installed=0  # continue via import below
fi

if [[ "$installed" != "1" ]]; then
  DOC_COUNT=$(find "$SEED_DOCX_DIR" -maxdepth 1 -iname 'chapitre*.docx' 2>/dev/null | wc -l | tr -d ' ')
  if [[ "${DOC_COUNT:-0}" -gt 0 ]]; then
    echo "==> Import $DOC_COUNT docx → JSON"
    curl -fsSL "$RAW/scripts/import-masterclass-docx.py" -o /tmp/import-masterclass-docx.py
    python3 /tmp/import-masterclass-docx.py \
      --src "$SEED_DOCX_DIR" \
      --out /tmp/mc-content \
      --seed /tmp/mc-seed-out
    cp -a /tmp/mc-seed-out/chapters/. "$CH_DIR/"
    [[ -f /tmp/mc-seed-out/index.json ]] && cp /tmp/mc-seed-out/index.json "$APP_DIR/data/masterclass/index.json"
    installed=1
  fi
fi

if [[ "$installed" != "1" ]]; then
  echo "ERREUR — aucun seed trouvé."
  echo "  Place l’un de :"
  echo "    $SEED_TGZ"
  echo "    $SEED_7Z"
  echo "    $SEED_DOCX_DIR/chapitre*.docx"
  echo "Puis relance."
  exit 1
fi

# Index métadonnées si absent
if [[ ! -f "$APP_DIR/data/masterclass/index.json" ]]; then
  curl -fsSL "$RAW/deploy/vps/masterclass-seed/index.json" \
    -o "$APP_DIR/data/masterclass/index.json" || true
fi

CH_COUNT=$(find "$CH_DIR" -maxdepth 1 -name '*.json' | wc -l | tr -d ' ')
echo "Chapitres installés : $CH_COUNT"
if [[ "$CH_COUNT" -lt 1 ]]; then
  echo "ERREUR — 0 chapitre après install"
  exit 1
fi

# Pas besoin de restart PM2 : lecture fichier à chaque requête
echo "Test local chapitre 1 (sans cookie → 401 attendu) :"
curl -sS -o /dev/null -w "catalog:%{http_code}\n" --max-time 8 http://127.0.0.1:3001/api/masterclass/catalog || true
echo "→ Ctrl+Shift+R sur /masterclass.html puis ouvrir un chapitre"
echo "======== DONE ========"
