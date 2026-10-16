#!/usr/bin/env bash
# Restaure La Forge après un 502 lié au déploiement Macro Edge (FX Desk).
#
# Causes typiques :
#   - engine.js charge centralBanks.js / policyDifferentials.js absents
#   - wire a corrompu server.js (syntaxe)
#   - PM2 en crash loop
#
# Sur le VPS (URL en dur — NE PAS écrire REF=... curl "...${REF}..." :
#   bash développe ${REF} AVANT l'export → URL vide → 404) :
#
#   curl -fsSL \
#     "https://raw.githubusercontent.com/torinvest/torinvest/cursor/hotfix-macro-edge-502-691a/deploy/vps/HOTFIX-MACRO-EDGE-502.sh" \
#     -o /tmp/hotfix-me-502.sh && bash /tmp/hotfix-me-502.sh
#
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
# Pin commit (évite 404 raw / branche stale). Override: PIN=... ou REF=...
PIN="${PIN:-3f19969e636f503c0c0a657f4d8049242e07119e}"
REF="${REF:-}"
if [[ -n "$REF" ]]; then
  RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"
  echo "======== HOTFIX MACRO EDGE 502 (REF=$REF) ========"
else
  RAW="https://raw.githubusercontent.com/torinvest/torinvest/${PIN}"
  echo "======== HOTFIX MACRO EDGE 502 (PIN=$PIN) ========"
fi
echo "APP_DIR=$APP_DIR"

mkdir -p \
  "$APP_DIR/public/js" \
  "$APP_DIR/public/css" \
  "$APP_DIR/server-patches/macro-edge" \
  "$APP_DIR/data/macro-edge" \
  "$APP_DIR/deploy/vps"

pull() {
  echo "← $(basename "$2")"
  curl -fsSL "$1" -o "$2"
}

# 1) Diagnostics
echo ""
echo "==> Diagnostic PM2 / syntaxe / dernières erreurs"
source ~/.profile 2>/dev/null || true
pm2 list 2>/dev/null | head -30 || true
echo "--- pm2 error log (la-forge) ---"
pm2 logs la-forge --err --lines 40 --nostream 2>/dev/null || \
  pm2 logs torinvest-formation --err --lines 40 --nostream 2>/dev/null || true
echo "---"
if [[ -f "$APP_DIR/server.js" ]]; then
  if node --check "$APP_DIR/server.js" 2>/tmp/me-server-check.err; then
    echo "OK — server.js syntaxe"
  else
    echo "BROKEN — server.js syntaxe :"
    cat /tmp/me-server-check.err || true
  fi
else
  echo "ERREUR — $APP_DIR/server.js introuvable"
  exit 1
fi

echo ""
echo "==> Modules macro-edge présents ?"
for f in engine.js centralBanks.js policyDifferentials.js config.js marketDataProvider.js; do
  if [[ -f "$APP_DIR/server-patches/macro-edge/$f" ]]; then
    echo "  OK $f"
  else
    echo "  MISSING $f"
  fi
done

# 2) Backup server.js
BAK="$APP_DIR/server.js.bak.me502.$(date +%s)"
cp "$APP_DIR/server.js" "$BAK"
echo ""
echo "==> Backup → $BAK"

# 3) CRITIQUES d'abord (débloque le crash PM2), puis le reste
ME="$APP_DIR/server-patches/macro-edge"
echo ""
echo "==> Pull fichiers critiques (centralBanks / policy / engine / routes)"
pull "$RAW/deploy/vps/formation-server/macro-edge/centralBanks.js" "$ME/centralBanks.js"
pull "$RAW/deploy/vps/formation-server/macro-edge/policyDifferentials.js" "$ME/policyDifferentials.js"
pull "$RAW/deploy/vps/formation-server/macro-edge/engine.js" "$ME/engine.js"
pull "$RAW/deploy/vps/formation-server/routes-macro-edge.js" \
  "$APP_DIR/server-patches/routes-macro-edge.js"

echo ""
echo "==> Pull reste Macro Edge + wire helpers"
pull "$RAW/deploy/vps/wire-formation-server-patches.js" \
  "$APP_DIR/wire-formation-server-patches.js" || echo "WARN wire script"
pull "$RAW/deploy/vps/repair-server-broken-wire.js" \
  "$APP_DIR/deploy/vps/repair-server-broken-wire.js" || echo "WARN repair script"
pull "$RAW/deploy/vps/app-shells/macro-edge.html" "$APP_DIR/public/macro-edge.html" || true
pull "$RAW/la-forge/js/forge-macro-edge.js" "$APP_DIR/public/js/forge-macro-edge.js" || true
pull "$RAW/la-forge/css/forge-macro-edge.css" "$APP_DIR/public/css/forge-macro-edge.css" || true

for f in config.js cache.js fredAdapter.js stooqAdapter.js yahooAdapter.js workerAdapter.js \
  demoSeries.js marketDataProvider.js correlation.js swingSmt.js drivers.js alerts.js store.js; do
  curl -fsSL "$RAW/deploy/vps/formation-server/macro-edge/${f}" -o "$ME/${f}" \
    && echo "← $f" || echo "WARN skip $f"
done

# 4) Réparer wire cassé connu
echo ""
echo "==> repair-server-broken-wire"
node "$APP_DIR/deploy/vps/repair-server-broken-wire.js" "$APP_DIR" || true

# 5) Re-wire macro-edge (idempotent si déjà monté)
echo ""
echo "==> wire-formation-server-patches"
if ! node "$APP_DIR/wire-formation-server-patches.js" "$APP_DIR"; then
  echo "WARN — wire a échoué — restauration backup"
  cp "$BAK" "$APP_DIR/server.js"
fi

# 6) Vérifs syntaxe + require
echo ""
echo "==> Checks"
node --check "$APP_DIR/server.js"
node --check "$APP_DIR/server-patches/routes-macro-edge.js"
for f in "$APP_DIR/server-patches/macro-edge"/*.js; do
  node --check "$f"
done

# Require réel depuis le dossier app (détecte MODULE_NOT_FOUND)
node - <<NODE
"use strict";
const path = require("path");
const appDir = process.env.APP_DIR || "$APP_DIR";
process.chdir(appDir);
// Routes require express — présent sur le VPS dans node_modules de l'app
try {
  require(path.join(appDir, "server-patches/macro-edge/engine"));
  require(path.join(appDir, "server-patches/macro-edge/centralBanks"));
  require(path.join(appDir, "server-patches/macro-edge/policyDifferentials"));
  console.log("OK — require macro-edge engine + CB + policy");
} catch (e) {
  console.error("ERREUR require macro-edge:", e && e.message ? e.message : e);
  process.exit(1);
}
NODE

# 7) Restart PM2
echo ""
echo "==> PM2 restart"
if pm2 describe la-forge >/dev/null 2>&1; then
  pm2 restart la-forge --update-env
elif pm2 describe torinvest-formation >/dev/null 2>&1; then
  pm2 restart torinvest-formation --update-env
else
  echo "WARN — process PM2 inconnu ; pm2 list :"
  pm2 list || true
  exit 1
fi

sleep 4

# 8) Health
echo ""
echo "==> Health"
LOCAL="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 8 http://127.0.0.1:3001/login.html || echo 000)"
EXT="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 12 https://app.torinvest-trading.com/login.html || echo 000)"
ME="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 12 https://app.torinvest-trading.com/macro-edge.html || echo 000)"
echo "local login.html  → $LOCAL"
echo "public login.html → $EXT"
echo "macro-edge.html   → $ME (302/200/401 OK ; 502 = encore down)"

if [[ "$LOCAL" == "000" || "$LOCAL" == "502" ]]; then
  echo ""
  echo "ÉCHEC — process encore down. Logs :"
  pm2 logs la-forge --lines 40 --nostream 2>/dev/null || \
    pm2 logs torinvest-formation --lines 40 --nostream 2>/dev/null || true
  echo ""
  echo "Fallback : bash $APP_DIR/deploy/vps/recover-formation-server.sh $APP_DIR"
  echo "  (nécessite un server.js.bak.* antérieur au crash)"
  exit 1
fi

echo ""
echo "OK — La Forge répond. Hard refresh sur macro-edge.html"
echo "======== DONE ========"
