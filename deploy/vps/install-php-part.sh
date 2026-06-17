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
  --exclude 'logs/' --exclude 'cache/' --exclude 'data/' --exclude '*.db' \
  --exclude 'config.local.php'

rsync -av "$ROOT/api/" "$TARGET/api/" \
  --exclude 'config.local.php'

cp -n "$ROOT/api/config.example.php" "$TARGET/api/config.local.php" 2>/dev/null || true
cp -n "$ROOT/crypto-radar/config.local.example.php" "$TARGET/crypto-radar/config.local.php" 2>/dev/null || true

echo ""
echo "✓ Fichiers copiés."
echo "→ Éditez $TARGET/api/config.local.php (Helius, PIN, Stripe, Brevo…)"
echo "→ Éditez $TARGET/crypto-radar/config.local.php (clés Mistral IA radar)"
echo "→ Initialisez crypto-radar : php $TARGET/crypto-radar/init_db.php"
echo "→ Permissions (obligatoire pour SQLite + logs) :"
echo "   sudo chown -R www-data:www-data $TARGET/crypto-radar $TARGET/api"
echo "   sudo chmod -R 775 $TARGET/crypto-radar/logs $TARGET/crypto-radar/cache $TARGET/crypto-radar/data"
echo "   sudo touch $TARGET/crypto-radar/crypto_cache.db && sudo chown www-data:www-data $TARGET/crypto-radar/crypto_cache.db"
echo "→ Premier remplissage : sudo -u www-data php $TARGET/crypto-radar/update.php"
echo "→ Configurez Apache/Nginx : deploy/vps/apache-torinvest-php.conf"
