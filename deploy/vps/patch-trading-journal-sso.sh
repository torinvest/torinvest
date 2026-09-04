#!/usr/bin/env bash
# Installe le SSO La Forge → Trading Journal Pro sur le VPS radar.
#
# Usage (ubuntu) :
#   curl -fsSL .../patch-trading-journal-sso.sh | bash
#   bash patch-trading-journal-sso.sh main
set -euo pipefail

REF="${1:-main}"
ROOT="${TORINVEST_WWW:-/var/www/torinvest}"
API_DIR="$ROOT/api"
JOURNAL="$ROOT/trading_journal.php"
SSO_DST="$API_DIR/trading-journal-forge-sso.php"
BASE="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"

echo "==> patch Trading Journal SSO ($REF)"

if [ ! -f "$JOURNAL" ]; then
  echo "ERREUR: $JOURNAL introuvable"
  echo "Cherche :"
  sudo find /var/www -name 'trading_journal.php' 2>/dev/null | head
  exit 1
fi

sudo mkdir -p "$API_DIR/data"
curl -fsSL "$BASE/api/trading-journal-forge-sso.php" -o /tmp/trading-journal-forge-sso.php
sudo mv /tmp/trading-journal-forge-sso.php "$SSO_DST"
sudo chown www-data:www-data "$SSO_DST"

# Détecte les clés $_SESSION utilisées dans le journal
KEYS_FILE="$API_DIR/data/journal-sso-session-keys.txt"
sudo grep -oE "\\\$_SESSION\[['\"][^'\"]+['\"]\]" "$JOURNAL" 2>/dev/null \
  | sed -E "s/.*\[['\"]([^'\"]+)['\"]\].*/\1/" \
  | sort -u \
  | sudo tee "$KEYS_FILE" >/dev/null || true
sudo chown www-data:www-data "$KEYS_FILE" 2>/dev/null || true
echo "Clés session détectées :"
sudo cat "$KEYS_FILE" 2>/dev/null || echo "(aucune)"

MARKER="torinvest-journal-forge-sso"
if sudo grep -q "$MARKER" "$JOURNAL"; then
  echo "OK — bootstrap SSO déjà présent dans trading_journal.php"
else
  sudo cp -a "$JOURNAL" "${JOURNAL}.bak.$(date +%Y%m%d%H%M%S)"
  # Préfixe juste après <?php
  TMP=/tmp/tj-sso-$$.php
  {
    echo '<?php'
    echo "/* $MARKER */"
    echo "require_once __DIR__ . '/api/trading-journal-forge-sso.php';"
    echo 'torinvest_journal_forge_sso_boot();'
    # reste du fichier sans le premier <?php
    sudo sed '1{/^<?php/d;}' "$JOURNAL"
  } > "$TMP"
  sudo mv "$TMP" "$JOURNAL"
  sudo chown www-data:www-data "$JOURNAL"
  echo "OK — bootstrap SSO injecté dans trading_journal.php"
fi

php -l "$SSO_DST"
php -l "$JOURNAL"

echo "OK — SSO Journal. Redéploie aussi le proxy formation (routes-journal-bridge.js)."
echo "→ pm2 restart la-forge --update-env"
