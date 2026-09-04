#!/usr/bin/env bash
# Prépare le dossier livres sur le VPS (à lancer EN TANT QUE ubuntu sur le VPS).
# Les PDF eux-mêmes viennent de E:\TORINVEST\livre pdf via scp/rsync (voir BOOKS-PRIVATE.md).
set -euo pipefail

DIR="${FORGE_BOOKS_DIR:-/var/lib/torinvest/books}"
echo "==> books dir: $DIR"
sudo mkdir -p "$DIR"
sudo chown "${SUDO_USER:-ubuntu}:${SUDO_USER:-ubuntu}" "$DIR" 2>/dev/null || true
chmod 750 "$DIR" || true
count=$(find "$DIR" -maxdepth 1 -type f -iname '*.pdf' 2>/dev/null | wc -l | tr -d ' ')
echo "OK — $count PDF(s) présents"
echo "Upload depuis Windows :"
echo "  scp \"E:\\\\TORINVEST\\\\livre pdf\\\\*.pdf\" ubuntu@HOST:$DIR/"
