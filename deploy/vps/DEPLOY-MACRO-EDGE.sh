#!/usr/bin/env bash
# Déploie TORINVEST Macro Edge — SMT Monitor (Gold Desk + FX Desk).
#
#   REF=cursor/macro-edge-fx-desk-691a curl -fsSL \
#     https://raw.githubusercontent.com/torinvest/torinvest/${REF}/deploy/vps/DEPLOY-MACRO-EDGE.sh \
#     -o /tmp/d-me.sh && REF=cursor/macro-edge-fx-desk-691a bash /tmp/d-me.sh
#
# Env optionnelle sur le VPS (PM2) :
#   FRED_API_KEY=...   # gratuit sur https://fred.stlouisfed.org/docs/api/api_key.html
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

pull "$RAW/deploy/vps/app-shells/macro-edge.html" "$APP_DIR/public/macro-edge.html"
pull "$RAW/deploy/vps/app-shells/dashboard.html" "$APP_DIR/public/dashboard.html"
pull "$RAW/la-forge/js/forge-macro-edge.js" "$APP_DIR/public/js/forge-macro-edge.js"
pull "$RAW/la-forge/css/forge-macro-edge.css" "$APP_DIR/public/css/forge-macro-edge.css"
pull "$RAW/la-forge/js/forge-brand.js" "$APP_DIR/public/js/forge-brand.js"
pull "$RAW/deploy/vps/formation-server/routes-macro-edge.js" "$APP_DIR/server-patches/routes-macro-edge.js"
pull "$RAW/deploy/vps/wire-formation-server-patches.js" "$APP_DIR/wire-formation-server-patches.js"

for f in config.js cache.js fredAdapter.js stooqAdapter.js yahooAdapter.js workerAdapter.js demoSeries.js marketDataProvider.js correlation.js swingSmt.js drivers.js alerts.js store.js engine.js centralBanks.js policyDifferentials.js; do
  pull "$RAW/deploy/vps/formation-server/macro-edge/${f}" "$APP_DIR/server-patches/macro-edge/${f}"
done

node "$APP_DIR/wire-formation-server-patches.js" "$APP_DIR"

# Syntaxe rapide
node --check "$APP_DIR/server-patches/routes-macro-edge.js"
node --check "$APP_DIR/public/js/forge-macro-edge.js"
for f in "$APP_DIR/server-patches/macro-edge"/*.js; do
  node --check "$f"
done

if command -v pm2 >/dev/null 2>&1; then
  pm2 restart la-forge --update-env || pm2 restart torinvest-formation --update-env || true
fi

echo ""
curl -sS -o /dev/null -w "macro-edge.html %{http_code}\n" "http://127.0.0.1:3001/macro-edge.html" || true
grep -n "createMacroEdgeRouter\|routes-macro-edge" "$APP_DIR/server.js" 2>/dev/null | head -5 || true
echo "→ https://app.torinvest-trading.com/macro-edge.html"
echo ""
echo "Optionnel : export FRED_API_KEY=... puis pm2 restart (sinon fallback DEMO + Stooq métaux)."
echo "======== DONE ========"
