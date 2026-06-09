#!/bin/bash
# Déploie la partie PHP TORINVEST sur le VPS OVH
# Usage : ./deploy/vps/install-php-part.sh /var/www/torinvest
set -euo pipefail

TARGET="${1:-/var/www/torinvest}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

echo "→ Déploiement PHP vers $TARGET"

mkdir -p "$TARGET/api" "$TARGET/crypto-radar" "$TARGET/assets"

rsync -av --delete \
  "$ROOT/crypto-radar/" "$TARGET/crypto-radar/" \
  --exclude 'logs/' --exclude 'cache/' --exclude 'data/' --exclude '*.db'

rsync -av "$ROOT/api/" "$TARGET/api/" \
  --exclude 'config.local.php'

cp -n "$ROOT/api/config.example.php" "$TARGET/api/config.local.php" 2>/dev/null || true

echo ""
echo "✓ Fichiers copiés."
echo "→ Éditez $TARGET/api/config.local.php (clé Helius + PIN dev)"
echo "→ Initialisez crypto-radar : php $TARGET/crypto-radar/init_db.php"
echo "→ Configurez Apache : deploy/vps/apache-torinvest-php.conf"
