#!/usr/bin/env bash
# Met à jour l'API Journal (+ http-session) sur radar.
# Usage (VPS) : bash pull-journal.sh [ref]
set -euo pipefail

REF="${1:-main}"
API_DIR="${2:-/var/www/torinvest/api}"
BASE="https://raw.githubusercontent.com/torinvest/torinvest/${REF}/api"

echo "==> pull-journal ($REF) → $API_DIR"

if [ ! -d "$API_DIR" ]; then
  echo "ERREUR: $API_DIR introuvable"
  echo "Connecte-toi en ubuntu (sudo -iu ubuntu) puis :"
  echo "  ls -ld /var/www/torinvest /var/www/torinvest/api"
  echo "Ou passe le chemin : bash pull-journal.sh main /chemin/api"
  exit 1
fi

for f in http-session.php journal-access.php journal-access-lib.php journal-serve.php; do
  echo "  $f"
  curl -fsSL -o "/tmp/$f" "$BASE/$f"
  sudo mv "/tmp/$f" "$API_DIR/$f"
  sudo chown www-data:www-data "$API_DIR/$f"
  php -l "$API_DIR/$f"
done

echo "OK — API Journal. Déployer aussi appjournal + pull-forge-all (hub + bridge)."
echo "→ Voir deploy/vps/JOURNAL-PRIVATE.md"
