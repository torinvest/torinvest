#!/usr/bin/env bash
# Sur le VPS — après upload du dossier « oct 2026 » (tar ou scp).
# Aplatit les PDF dans /var/lib/torinvest/books (catalogue Livres La Forge).
#
# Upload recommandé (PowerShell, ~521 Mo) :
#   cd "E:\TORINVEST\livre pdf"
#   tar -cf oct-2026-books.tar "oct 2026"
#   scp oct-2026-books.tar ubuntu@164.132.46.191:~/
#
# Puis VPS :
#   bash <(curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/UPLOAD-BOOKS-OCT2026.sh)
#
set -euo pipefail

DIR="${FORGE_BOOKS_DIR:-/var/lib/torinvest/books}"
TAR_SRC="${TAR_SRC:-$HOME/oct-2026-books.tar}"
SRC_DIR="${SRC_DIR:-}"

echo "======== UPLOAD BOOKS OCT 2026 ========"
sudo mkdir -p "$DIR"
sudo chown "${SUDO_USER:-ubuntu}:${SUDO_USER:-ubuntu}" "$DIR" 2>/dev/null || true
chmod 750 "$DIR" || true

WORK="/tmp/forge-books-oct-$$"
mkdir -p "$WORK"

if [[ -n "$SRC_DIR" && -d "$SRC_DIR" ]]; then
  echo "Source dir : $SRC_DIR"
  find "$SRC_DIR" -type f -iname '*.pdf' -print0 | while IFS= read -r -d '' f; do
    base=$(basename "$f")
    if [[ -f "$DIR/$base" ]]; then
      echo "  skip (déjà là) : $base"
    else
      cp -n "$f" "$DIR/$base"
      echo "  + $base"
    fi
  done
elif [[ -f "$TAR_SRC" ]]; then
  echo "Source tar : $TAR_SRC ($(ls -lh "$TAR_SRC" | awk '{print $5}'))"
  tar -xf "$TAR_SRC" -C "$WORK"
  find "$WORK" -type f -iname '*.pdf' -print0 | while IFS= read -r -d '' f; do
    base=$(basename "$f")
    if [[ -f "$DIR/$base" ]]; then
      echo "  skip (déjà là) : $base"
    else
      cp -n "$f" "$DIR/$base"
      echo "  + $base"
    fi
  done
else
  # Fallback : PDFs déjà déposés dans ~/oct-2026 / ~/books-oct / Downloads
  shopt -s nullglob
  candidates=(
    "$HOME/oct-2026"
    "$HOME/oct 2026"
    "$HOME/books-oct-2026"
    "$HOME/Downloads/oct 2026"
  )
  found=""
  for c in "${candidates[@]}"; do
    if [[ -d "$c" ]]; then
      found="$c"
      break
    fi
  done
  shopt -u nullglob
  if [[ -z "$found" ]]; then
    echo "ERREUR : ni tar ($TAR_SRC) ni dossier source."
    echo ""
    echo "PowerShell :"
    echo "  cd \"E:\\TORINVEST\\livre pdf\""
    echo "  tar -cf oct-2026-books.tar \"oct 2026\""
    echo "  scp oct-2026-books.tar ubuntu@164.132.46.191:~/"
    echo "Puis relance ce script."
    exit 1
  fi
  echo "Source dir : $found"
  find "$found" -type f -iname '*.pdf' -print0 | while IFS= read -r -d '' f; do
    base=$(basename "$f")
    if [[ -f "$DIR/$base" ]]; then
      echo "  skip (déjà là) : $base"
    else
      cp -n "$f" "$DIR/$base"
      echo "  + $base"
    fi
  done
fi

rm -rf "$WORK"
count=$(find "$DIR" -maxdepth 1 -type f -iname '*.pdf' 2>/dev/null | wc -l | tr -d ' ')
echo ""
echo "OK — $count PDF(s) dans $DIR"
curl -sS "https://app.torinvest-trading.com/api/books/ping" || true
echo ""
echo "→ https://app.torinvest-trading.com/books.html"
echo "======== DONE ========"
