#!/bin/bash
# Met à jour les API PHP TORINVEST sur radar depuis GitHub main.
# Usage (sur le VPS) : bash pull-api.sh

set -euo pipefail
API_DIR="/var/www/torinvest/api"
BASE="https://raw.githubusercontent.com/torinvest/torinvest/main/api"

FILES=(
  http-session.php
  rate-limit.php
  ai-access.php
  ai-access-lib.php
  accompagnement-access.php
  accompagnement-access-lib.php
  admin-licence.php
  admin-licence-lib.php
  license-provision.php
  stripe-webhook.php
  stripe-lib.php
  brevo-lib.php
  access-config.php
  solana-rpc.php
)

for f in "${FILES[@]}"; do
  echo "→ $f"
  curl -fsSL -o "/tmp/$f" "$BASE/$f"
  sudo mv "/tmp/$f" "$API_DIR/$f"
done

sudo chown www-data:www-data "${FILES[@]/#/$API_DIR/}"
ls -la "${FILES[@]/#/$API_DIR/}"
echo "OK — API radar à jour."
