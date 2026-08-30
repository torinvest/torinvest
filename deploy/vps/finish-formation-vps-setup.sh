#!/usr/bin/env bash
# Finalise la formation sur le VPS : pull assets, wire server.js, vérif, backup optionnel, restart PM2.
#
# Sur le VPS (one-liner depuis GitHub) :
#   SHA=d70b955 curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/${SHA}/deploy/vps/finish-formation-vps-setup.sh" | bash
#
# Ou si déjà cloné :
#   bash /home/ubuntu/torinvest-formation/deploy/vps/finish-formation-vps-setup.sh

set -euo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu/torinvest-formation}"
SHA="${SHA:-main}"
RUN_BACKUP="${RUN_BACKUP:-0}"
PM2_NAME="${PM2_NAME:-}"

echo "==> finish-formation-vps-setup (APP_DIR=$APP_DIR SHA=$SHA)"

BASE="https://raw.githubusercontent.com/torinvest/torinvest/${SHA}/deploy/vps"
export SHA BRANCH="${SHA}"
bash <(curl -fsSL "${BASE}/pull-forge-all.sh") "$APP_DIR"

echo ""
echo "==> Wire server.js (progress + calendar + paywall)"
node "$APP_DIR/deploy/vps/wire-formation-server-patches.js" "$APP_DIR"

echo ""
echo "==> Vérification"
bash "$APP_DIR/deploy/vps/verify-formation-live.sh" "$APP_DIR"

if [[ "$RUN_BACKUP" == "1" ]]; then
  echo ""
  echo "==> Sauvegarde privée course/"
  bash "$APP_DIR/deploy/vps/backup-course-private.sh" "$APP_DIR"
fi

echo ""
echo "==> Redémarrage PM2"
if [[ -n "$PM2_NAME" ]]; then
  pm2 restart "$PM2_NAME"
else
  if pm2 describe la-forge >/dev/null 2>&1; then
    pm2 restart la-forge
  elif pm2 describe torinvest-formation >/dev/null 2>&1; then
    pm2 restart torinvest-formation
  else
    echo "WARN — process PM2 introuvable (la-forge / torinvest-formation). Redémarrer manuellement."
    pm2 list || true
  fi
fi

echo ""
echo "OK — setup formation terminé."
echo "Test navigateur : $APP_URL/login.html → dashboard → formation"
