#!/usr/bin/env bash
# Force-pull CSS/JS Crypto (corrige le cas où les shells HTML sont à jour
# mais forge-crypto.css / crypto-schemas.js sont restés sur une ancienne version).
#
# Usage sur le VPS :
#   SHA=fcb7d37 bash <(curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/fcb7d37/deploy/vps/HOTFIX-CRYPTO-ASSETS.sh)
#   # ou après merge d’un SHA plus récent :
#   SHA=<merge> bash <(curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/$SHA/deploy/vps/HOTFIX-CRYPTO-ASSETS.sh)

set -euo pipefail

APP_DIR="${1:-$HOME/torinvest-formation}"
SHA="${SHA:-fcb7d37}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${SHA}/la-forge"

echo "==> HOTFIX crypto assets → $APP_DIR (SHA=$SHA)"

mkdir -p "$APP_DIR/public/css" "$APP_DIR/public/js" "$APP_DIR/public/crypto"

curl -fsSL "${RAW}/css/forge-crypto.css" -o "$APP_DIR/public/css/forge-crypto.css"
curl -fsSL "${RAW}/js/crypto-schemas.js" -o "$APP_DIR/public/js/crypto-schemas.js"
curl -fsSL "${RAW}/js/crypto-course-data.js" -o "$APP_DIR/public/js/crypto-course-data.js"
curl -fsSL "${RAW}/js/crypto-course-index.js" -o "$APP_DIR/public/js/crypto-course-index.js"
curl -fsSL "${RAW}/js/crypto-lesson.js" -o "$APP_DIR/public/js/crypto-lesson.js"

SHELL_RAW="https://raw.githubusercontent.com/torinvest/torinvest/${SHA}"
curl -fsSL "${SHELL_RAW}/deploy/vps/app-shells/crypto/index.html" -o "$APP_DIR/public/crypto/index.html"
curl -fsSL "${SHELL_RAW}/deploy/vps/app-shells/crypto/module.html" -o "$APP_DIR/public/crypto/module.html"

echo "==> Vérifs"
wc -c "$APP_DIR/public/css/forge-crypto.css" "$APP_DIR/public/js/crypto-schemas.js"
head -n 2 "$APP_DIR/public/css/forge-crypto.css"
grep -q 'crypto-chip' "$APP_DIR/public/css/forge-crypto.css" && echo "OK CSS futuriste (crypto-chip)" || {
  echo "FAIL CSS encore ancien"
  exit 1
}
grep -q 'crypto-ticker' "$APP_DIR/public/crypto/index.html" && echo "OK HTML ticker" || {
  echo "FAIL HTML sans ticker"
  exit 1
}
grep -q 'HYPE\|f7931a\|Univers tickers' "$APP_DIR/public/js/crypto-schemas.js" && echo "OK schemas tickers" || echo "WARN schemas sans marqueur HYPE (SHA trop vieux ?)"

echo ""
echo "Done. Hard refresh https://app.torinvest-trading.com/crypto/index.html (Ctrl+Shift+R)"
