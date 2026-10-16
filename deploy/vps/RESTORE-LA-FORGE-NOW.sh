#!/usr/bin/env bash
# Remonte la-forge IMMÉDIATEMENT (502 / MODULE_NOT_FOUND centralBanks).
# URL en dur — coller tel quel sur le VPS :
#
#   curl -fsSL \
#     "https://raw.githubusercontent.com/torinvest/torinvest/cursor/hotfix-macro-edge-502-691a/deploy/vps/RESTORE-LA-FORGE-NOW.sh" \
#     -o /tmp/restore-lf.sh && bash /tmp/restore-lf.sh
#
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
# Commit pin (évite cache / branche stale)
PIN="${PIN:-3f19969e636f503c0c0a657f4d8049242e07119e}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${PIN}"
ME="$APP_DIR/server-patches/macro-edge"

echo "======== RESTORE LA-FORGE ($PIN) ========"
mkdir -p "$ME" "$APP_DIR/public/js" "$APP_DIR/public/css"

pull() {
  echo "← $2"
  curl -fsSL "$1" -o "$2"
}

# 1) Fichiers critiques d'abord (cause du crash)
pull "$RAW/deploy/vps/formation-server/macro-edge/centralBanks.js" "$ME/centralBanks.js"
pull "$RAW/deploy/vps/formation-server/macro-edge/policyDifferentials.js" "$ME/policyDifferentials.js"
pull "$RAW/deploy/vps/formation-server/macro-edge/engine.js" "$ME/engine.js"
pull "$RAW/deploy/vps/formation-server/routes-macro-edge.js" \
  "$APP_DIR/server-patches/routes-macro-edge.js"

# 2) Reste Macro Edge (best effort)
for f in config.js cache.js fredAdapter.js stooqAdapter.js yahooAdapter.js workerAdapter.js \
  demoSeries.js marketDataProvider.js correlation.js swingSmt.js drivers.js alerts.js store.js; do
  curl -fsSL "$RAW/deploy/vps/formation-server/macro-edge/${f}" -o "$ME/${f}" \
    && echo "← $f" || echo "WARN skip $f"
done
curl -fsSL "$RAW/la-forge/js/forge-macro-edge.js" -o "$APP_DIR/public/js/forge-macro-edge.js" || true
curl -fsSL "$RAW/la-forge/css/forge-macro-edge.css" -o "$APP_DIR/public/css/forge-macro-edge.css" || true
curl -fsSL "$RAW/deploy/vps/app-shells/macro-edge.html" -o "$APP_DIR/public/macro-edge.html" || true

# 3) Vérifs
test -s "$ME/centralBanks.js"
test -s "$ME/policyDifferentials.js"
node --check "$ME/engine.js"
node --check "$APP_DIR/server-patches/routes-macro-edge.js"
node --check "$APP_DIR/server.js"
node -e "
const p=require('path');
const d='$ME';
require(p.join(d,'centralBanks'));
require(p.join(d,'policyDifferentials'));
require(p.join(d,'engine'));
console.log('OK require centralBanks + policy + engine');
"

# 4) Restart
source ~/.profile 2>/dev/null || true
if pm2 describe la-forge >/dev/null 2>&1; then
  pm2 restart la-forge --update-env
elif pm2 describe torinvest-formation >/dev/null 2>&1; then
  pm2 restart torinvest-formation --update-env
else
  echo "ERREUR — process PM2 introuvable"; pm2 list; exit 1
fi

sleep 4
LOCAL=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 8 http://127.0.0.1:3001/login.html || echo 000)
EXT=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 12 https://app.torinvest-trading.com/login.html || echo 000)
echo "local=$LOCAL public=$EXT"
pm2 list | head -20

if [[ "$LOCAL" == "200" || "$LOCAL" == "301" || "$LOCAL" == "302" || "$LOCAL" == "401" || "$LOCAL" == "403" ]]; then
  echo "OK — la-forge est remonte."
else
  echo "Encore down — logs :"
  pm2 logs la-forge --err --lines 30 --nostream || true
  exit 1
fi
echo "======== DONE ========"
