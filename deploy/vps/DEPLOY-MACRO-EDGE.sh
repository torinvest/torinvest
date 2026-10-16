#!/usr/bin/env bash
# Déploie TORINVEST Macro Edge — SMT Monitor (Gold Desk + FX Desk).
#
#   REF=cursor/macro-edge-fx-desk-691a curl -fsSL \
#     https://raw.githubusercontent.com/torinvest/torinvest/${REF}/deploy/vps/DEPLOY-MACRO-EDGE.sh \
#     -o /tmp/d-me.sh && REF=cursor/macro-edge-fx-desk-691a bash /tmp/d-me.sh
#
# Env optionnelle sur le VPS (PM2) :
#   FRED_API_KEY=...   # gratuit sur https://fred.stlouisfed.org/docs/api/api_key.html
#
# En cas de 502 après deploy :
#   bash …/HOTFIX-MACRO-EDGE-502.sh
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
REF="${REF:-cursor/macro-edge-fx-desk-691a}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"

echo "======== DEPLOY MACRO EDGE ($REF) ========"
mkdir -p \
  "$APP_DIR/public/js" \
  "$APP_DIR/public/css" \
  "$APP_DIR/server-patches/macro-edge" \
  "$APP_DIR/data/macro-edge"

pull() { echo "← $(basename "$2")"; curl -fsSL "$1" -o "$2"; }

# Backup avant wire (rollback si syntaxe cassée)
if [[ -f "$APP_DIR/server.js" ]]; then
  BAK="$APP_DIR/server.js.bak.me.$(date +%s)"
  cp "$APP_DIR/server.js" "$BAK"
  echo "Backup server.js → $BAK"
fi

pull "$RAW/deploy/vps/app-shells/macro-edge.html" "$APP_DIR/public/macro-edge.html"
pull "$RAW/deploy/vps/app-shells/dashboard.html" "$APP_DIR/public/dashboard.html"
pull "$RAW/la-forge/js/forge-macro-edge.js" "$APP_DIR/public/js/forge-macro-edge.js"
pull "$RAW/la-forge/css/forge-macro-edge.css" "$APP_DIR/public/css/forge-macro-edge.css"
pull "$RAW/la-forge/js/forge-brand.js" "$APP_DIR/public/js/forge-brand.js"
pull "$RAW/deploy/vps/formation-server/routes-macro-edge.js" "$APP_DIR/server-patches/routes-macro-edge.js"
pull "$RAW/deploy/vps/wire-formation-server-patches.js" "$APP_DIR/wire-formation-server-patches.js"

for f in config.js cache.js fredAdapter.js stooqAdapter.js yahooAdapter.js workerAdapter.js \
  demoSeries.js marketDataProvider.js correlation.js swingSmt.js drivers.js alerts.js \
  store.js engine.js centralBanks.js policyDifferentials.js; do
  pull "$RAW/deploy/vps/formation-server/macro-edge/${f}" \
    "$APP_DIR/server-patches/macro-edge/${f}"
done

# Fichiers critiques FX Desk (évite MODULE_NOT_FOUND → crash PM2 → 502)
for f in centralBanks.js policyDifferentials.js engine.js; do
  if [[ ! -s "$APP_DIR/server-patches/macro-edge/$f" ]]; then
    echo "ERREUR — fichier manquant ou vide : macro-edge/$f"
    exit 1
  fi
done

node "$APP_DIR/wire-formation-server-patches.js" "$APP_DIR"

# Syntaxe rapide — patches + server.js (obligatoire avant pm2)
node --check "$APP_DIR/server-patches/routes-macro-edge.js"
node --check "$APP_DIR/public/js/forge-macro-edge.js"
for f in "$APP_DIR/server-patches/macro-edge"/*.js; do
  node --check "$f"
done
if ! node --check "$APP_DIR/server.js"; then
  echo "ERREUR — server.js invalide après wire"
  if [[ -n "${BAK:-}" && -f "$BAK" ]]; then
    echo "Rollback → $BAK"
    cp "$BAK" "$APP_DIR/server.js"
  fi
  exit 1
fi

node -e "
const p=require('path');
const d=p.join('$APP_DIR','server-patches','macro-edge');
require(p.join(d,'engine'));
require(p.join(d,'centralBanks'));
require(p.join(d,'policyDifferentials'));
console.log('OK require engine+CB+policy');
"

source ~/.profile 2>/dev/null || true
if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe la-forge >/dev/null 2>&1; then
    pm2 restart la-forge --update-env
  elif pm2 describe torinvest-formation >/dev/null 2>&1; then
    pm2 restart torinvest-formation --update-env
  else
    echo "WARN — aucun process PM2 la-forge / torinvest-formation"
  fi
fi

sleep 3
echo ""
LOCAL="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 8 http://127.0.0.1:3001/macro-edge.html || echo 000)"
echo "macro-edge.html local → $LOCAL"
grep -n "createMacroEdgeRouter\|routes-macro-edge" "$APP_DIR/server.js" 2>/dev/null | head -5 || true

if [[ "$LOCAL" == "502" || "$LOCAL" == "000" ]]; then
  echo "WARN — app ne répond pas. Lancer HOTFIX-MACRO-EDGE-502.sh ou :"
  echo "  pm2 logs la-forge --lines 40 --nostream"
  exit 1
fi

echo "→ https://app.torinvest-trading.com/macro-edge.html"
echo "Optionnel : export FRED_API_KEY=... puis pm2 restart"
echo "======== DONE ========"
