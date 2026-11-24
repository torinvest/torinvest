#!/usr/bin/env bash
# Déploie les 4 upgrades écosystème :
# 1) Carte Crypto dashboard
# 2) Fiche pré-live Journal → coaching
# 3) Bilan hebdo mail dimanche
# 4) Lives collectifs + rappels 4h/1h
#
# Usage :
#   SHA=<commit> bash <(curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/$SHA/deploy/vps/HOTFIX-ECOSYSTEM-4UP.sh) formation
#   SHA=<commit> bash <(curl -fsSL …/HOTFIX-ECOSYSTEM-4UP.sh) radar
#   SHA=<commit> bash <(curl -fsSL …/HOTFIX-ECOSYSTEM-4UP.sh) all

set -euo pipefail

TARGET="${1:-all}"
SHA="${SHA:-main}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${SHA}"
APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
API_DIR="${API_DIR:-/var/www/torinvest/api}"

deploy_formation() {
  echo "==> Formation assets + patches ($APP_DIR)"
  export BRANCH="" SHA
  bash <(curl -fsSL "${RAW}/deploy/vps/pull-forge-all.sh") "$APP_DIR"

  mkdir -p "$APP_DIR/server-patches"
  for f in routes-collective-lives.js collective-reminders-lib.js weekly-digest-lib.js coaching-reminders-lib.js routes-coaching-lives.js; do
    curl -fsSL "${RAW}/deploy/vps/formation-server/$f" -o "$APP_DIR/server-patches/$f"
    echo "  OK $f"
  done

  if [[ -f "$APP_DIR/server.js" ]]; then
    node "$APP_DIR/wire-formation-server-patches.js" "$APP_DIR/server.js" 2>/dev/null \
      || node "$APP_DIR/server-patches/../wire-formation-server-patches.js" "$APP_DIR/server.js" 2>/dev/null \
      || true
  fi
  # Prefer local copy of wire script from pull
  if [[ -f "$APP_DIR/wire-formation-server-patches.js" && -f "$APP_DIR/server.js" ]]; then
    node "$APP_DIR/wire-formation-server-patches.js" "$APP_DIR/server.js" || true
  fi

  if command -v pm2 >/dev/null 2>&1; then
    pm2 restart la-forge --update-env || pm2 restart torinvest-formation --update-env || true
  fi

  echo "Vérifs :"
  grep -q 'crypto-access' "$APP_DIR/public/dashboard.html" && echo "OK dashboard crypto" || echo "WARN dashboard crypto"
  grep -q 'data-cf-load-journal' "$APP_DIR/public/js/forge-coaching-fiches.js" && echo "OK fiche journal prep" || echo "WARN fiche journal"
  grep -q 'initForgeCollectiveLives' "$APP_DIR/public/js/forge-collective-lives.js" && echo "OK collective JS" || echo "WARN collective JS"
  grep -q 'createCollectiveLivesRouter' "$APP_DIR/server-patches/routes-collective-lives.js" && echo "OK collective routes" || echo "WARN collective routes"
  test -f "$APP_DIR/server-patches/weekly-digest-lib.js" && echo "OK weekly-digest-lib"
}

deploy_radar() {
  echo "==> Radar API ($API_DIR)"
  if [[ ! -d "$API_DIR" ]]; then
    echo "API_DIR introuvable: $API_DIR"
    exit 1
  fi
  sudo mkdir -p "$API_DIR"
  for f in collective-live-reminder.php weekly-digest.php brevo-lib.php; do
    curl -fsSL "${RAW}/api/$f" -o "/tmp/$f"
    sudo cp "/tmp/$f" "$API_DIR/$f"
    sudo chown www-data:www-data "$API_DIR/$f" 2>/dev/null || true
    sudo chmod 644 "$API_DIR/$f"
    echo "  OK $f"
  done

  for ep in collective-live-reminder.php weekly-digest.php; do
    code=$(curl -sS -o /dev/null -w "%{http_code}" -X POST \
      "https://radar.torinvest-trading.com/api/$ep" \
      -H "Content-Type: application/json" -d '{}' || echo "000")
    echo "POST $ep sans auth → $code (attendu 401/400)"
  done
}

case "$TARGET" in
  formation) deploy_formation ;;
  radar) deploy_radar ;;
  all)
    deploy_formation
    deploy_radar
    ;;
  *)
    echo "Usage: $0 [formation|radar|all]"
    exit 1
    ;;
esac

echo "Done HOTFIX-ECOSYSTEM-4UP ($TARGET) SHA=$SHA"
