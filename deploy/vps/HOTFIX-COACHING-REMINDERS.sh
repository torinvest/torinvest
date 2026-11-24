#!/usr/bin/env bash
# Déploie rappels live coaching (mails 4h/1h + assets calendrier).
#
# Usage (depuis une machine qui a accès SSH au VPS radar+formation, ou sur chaque VPS) :
#
# Sur le VPS FORMATION (app) :
#   SHA=68d9dca bash <(curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/68d9dca/deploy/vps/HOTFIX-COACHING-REMINDERS.sh) formation
#
# Sur le VPS RADAR (api PHP) :
#   SHA=68d9dca bash <(curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/68d9dca/deploy/vps/HOTFIX-COACHING-REMINDERS.sh) radar
#
# Les deux :
#   SHA=68d9dca bash <(curl -fsSL …/HOTFIX-COACHING-REMINDERS.sh) all

set -euo pipefail

TARGET="${1:-all}"
SHA="${SHA:-68d9dca}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${SHA}"
APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
# Même chemin que FIX-LOGIN-FINAL.sh (souvent le même VPS que formation)
API_DIR="${API_DIR:-/var/www/torinvest/api}"

deploy_formation() {
  echo "==> Formation assets + patches ($APP_DIR)"
  export BRANCH="" SHA
  bash <(curl -fsSL "${RAW}/deploy/vps/pull-forge-all.sh") "$APP_DIR"

  # Garantir le lib reminders à côté de routes-coaching-lives
  mkdir -p "$APP_DIR/server-patches"
  curl -fsSL "${RAW}/deploy/vps/formation-server/coaching-reminders-lib.js" \
    -o "$APP_DIR/server-patches/coaching-reminders-lib.js"
  curl -fsSL "${RAW}/deploy/vps/formation-server/routes-coaching-lives.js" \
    -o "$APP_DIR/server-patches/routes-coaching-lives.js"

  if command -v pm2 >/dev/null 2>&1; then
    pm2 restart la-forge --update-env || pm2 restart torinvest-formation --update-env || true
  fi

  echo "Vérif JS reminder :"
  grep -q 'coach-reminder-modal' "$APP_DIR/public/js/forge-coaching-lives.js" \
    && echo "OK forge-coaching-lives.js" || { echo "FAIL JS"; exit 1; }
  grep -q 'coach-reminder-modal' "$APP_DIR/public/css/main.css" \
    && echo "OK main.css popup" || { echo "FAIL CSS"; exit 1; }
  grep -q 'startCoachingReminders' "$APP_DIR/server-patches/routes-coaching-lives.js" \
    && echo "OK routes wire reminders" || { echo "FAIL routes"; exit 1; }
  test -f "$APP_DIR/server-patches/coaching-reminders-lib.js" && echo "OK coaching-reminders-lib.js"
}

deploy_radar() {
  echo "==> Radar API ($API_DIR)"
  if [[ ! -d "$API_DIR" ]]; then
    echo "API_DIR introuvable: $API_DIR — exporte API_DIR=/chemin/vers/api"
    exit 1
  fi
  sudo mkdir -p "$API_DIR"
  curl -fsSL "${RAW}/api/coaching-live-reminder.php" -o /tmp/coaching-live-reminder.php
  curl -fsSL "${RAW}/api/brevo-lib.php" -o /tmp/brevo-lib.php
  sudo cp /tmp/coaching-live-reminder.php "$API_DIR/coaching-live-reminder.php"
  sudo cp /tmp/brevo-lib.php "$API_DIR/brevo-lib.php"
  sudo chown www-data:www-data "$API_DIR/coaching-live-reminder.php" "$API_DIR/brevo-lib.php" 2>/dev/null || true
  sudo chmod 644 "$API_DIR/coaching-live-reminder.php" "$API_DIR/brevo-lib.php"

  echo "Vérif HTTP :"
  code=$(curl -sS -o /dev/null -w "%{http_code}" -X POST \
    "https://radar.torinvest-trading.com/api/coaching-live-reminder.php" \
    -H "Content-Type: application/json" -d '{}')
  echo "POST sans auth → $code (attendu 401)"
  [[ "$code" == "401" || "$code" == "400" ]] && echo "OK endpoint radar" || echo "WARN endpoint encore KO ($code)"
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

echo ""
echo "Done (SHA=$SHA). Hard refresh /calendar.html — logs: pm2 logs la-forge --lines 40 | grep coaching-reminders"
