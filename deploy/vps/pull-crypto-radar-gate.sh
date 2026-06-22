#!/bin/bash
# Garde accompagnement Crypto Radar — depuis GitHub main.
# Usage (sur le VPS) : bash pull-crypto-radar-gate.sh

set -euo pipefail
RADAR_DIR="/var/www/torinvest/crypto-radar"
BASE="https://raw.githubusercontent.com/torinvest/torinvest/main/crypto-radar"

FILES=(
  accompagnement-gate.php
  update.php
  portfolio.php
  blog.php
  blog_post.php
  stats.php
  portfolio_manager.php
  iron-poxy.php
)

for f in "${FILES[@]}"; do
  echo "→ $f"
  curl -fsSL -o "/tmp/$f" "$BASE/$f"
  sudo mv "/tmp/$f" "$RADAR_DIR/$f"
done

sudo chown www-data:www-data "${FILES[@]/#/$RADAR_DIR/}"
echo "OK — garde Crypto Radar à jour."
echo "Recharge le serveur web : sudo systemctl reload nginx"
