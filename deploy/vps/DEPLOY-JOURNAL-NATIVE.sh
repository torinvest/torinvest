#!/usr/bin/env bash
# Déploie le Journal de trading NATIF (La Forge) — remplace le flux TJ Pro radar.
#
# VPS formation (app.*) :
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/cursor/forge-journal-native-691a/deploy/vps/DEPLOY-JOURNAL-NATIVE.sh?$(date +%s)" | bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
BRANCH="${JOURNAL_NATIVE_BRANCH:-cursor/forge-journal-native-691a}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${BRANCH}"
TS="$(date +%s)"

echo ""
echo "############################################################"
echo "#  DEPLOY JOURNAL NATIF La Forge v2                       #"
echo "#  isolation élève + admin · multi-screens                #"
echo "#  branch: $BRANCH                                        #"
echo "############################################################"

mkdir -p "$APP_DIR/public/js" "$APP_DIR/public/css" "$APP_DIR/server-patches" "$APP_DIR/public"

curl -fsSL "${RAW}/la-forge/js/forge-journal-native.js?ts=${TS}" -o "$APP_DIR/public/js/forge-journal-native.js"
curl -fsSL "${RAW}/la-forge/css/forge-journal-native.css?ts=${TS}" -o "$APP_DIR/public/css/forge-journal-native.css"
curl -fsSL "${RAW}/deploy/vps/app-shells/journal.html?ts=${TS}" -o "$APP_DIR/public/journal.html"
curl -fsSL "${RAW}/deploy/vps/app-shells/dashboard.html?ts=${TS}" -o "$APP_DIR/public/dashboard.html"
curl -fsSL "${RAW}/deploy/vps/formation-server/routes-journal-trades.js?ts=${TS}" \
  -o "$APP_DIR/server-patches/routes-journal-trades.js"
curl -fsSL "${RAW}/deploy/vps/wire-formation-server-patches.js?ts=${TS}" \
  -o "$APP_DIR/deploy/vps/wire-formation-server-patches.js"

grep -q 'createJournalTradesRouter' "$APP_DIR/server-patches/routes-journal-trades.js" || {
  echo "ÉCHEC: routes-journal-trades.js invalide"
  exit 1
}
grep -q 'journal-native-root' "$APP_DIR/public/journal.html" || {
  echo "ÉCHEC: journal.html natif manquant"
  exit 1
}
grep -q 'initJournalNative' "$APP_DIR/public/js/forge-journal-native.js" || {
  echo "ÉCHEC: forge-journal-native.js invalide"
  exit 1
}
node --check "$APP_DIR/server-patches/routes-journal-trades.js"

# Wire server.js
WIRE="$APP_DIR/deploy/vps/wire-formation-server-patches.js"
if [[ -f "$WIRE" ]]; then
  echo "==> wire patches"
  node "$WIRE" "$APP_DIR" || node "$WIRE" || true
fi

# Restart PM2
if command -v pm2 >/dev/null 2>&1; then
  pm2 restart la-forge --update-env 2>/dev/null \
    || pm2 restart torinvest-formation --update-env 2>/dev/null \
    || pm2 restart all 2>/dev/null \
    || true
fi

sleep 1
echo ""
echo "Ping API :"
curl -sS "https://app.torinvest-trading.com/api/journal-trades/ping" | head -c 400 || true
echo ""
echo ""
echo "OK — Journal natif déployé."
echo "→ https://app.torinvest-trading.com/journal.html"
echo "  1) Nouveau trade → Enregistrer"
echo "  2) Clic ligne → lecture seule"
echo "  3) Bouton Modifier → édition"
echo "======== DONE ========"
