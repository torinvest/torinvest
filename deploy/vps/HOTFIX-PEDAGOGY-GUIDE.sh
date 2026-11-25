#!/usr/bin/env bash
# Déploie pédagogie + guide écosystème (PR pedagogy-ecosystem-guide).
#
#   SHA=<commit> bash <(curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/$SHA/deploy/vps/HOTFIX-PEDAGOGY-GUIDE.sh)

set -euo pipefail
SHA="${SHA:-main}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${SHA}"
APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"

echo "==> Pedagogy + ecosystem guide ($SHA) → $APP_DIR"
export BRANCH="" SHA
bash <(curl -fsSL "${RAW}/deploy/vps/pull-forge-all.sh") "$APP_DIR"

mkdir -p "$APP_DIR/server-patches"
curl -fsSL "${RAW}/deploy/vps/formation-server/routes-journal-trades.js" \
  -o "$APP_DIR/server-patches/routes-journal-trades.js"
curl -fsSL "${RAW}/deploy/vps/formation-server/routes-coaching-lives.js" \
  -o "$APP_DIR/server-patches/routes-coaching-lives.js"

if command -v pm2 >/dev/null 2>&1; then
  pm2 restart la-forge --update-env || pm2 restart torinvest-formation --update-env || true
fi

echo "Vérifs :"
grep -q 'ecosystem-guide-root' "$APP_DIR/public/start.html" && echo "OK start guide" || echo "WARN start"
grep -q 'ForgePedagogy' "$APP_DIR/public/js/forge-pedagogy.js" && echo "OK pedagogy JS" || echo "WARN pedagogy"
grep -q 'c16-price-action' "$APP_DIR/public/js/chart-exercise-registry.js" && echo "OK crypto charts" || echo "WARN crypto charts"
grep -q 'review' "$APP_DIR/server-patches/routes-journal-trades.js" && echo "OK journal review" || echo "WARN journal"
echo "Done HOTFIX-PEDAGOGY-GUIDE SHA=$SHA"
