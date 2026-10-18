#!/usr/bin/env bash
# Corrige /masterclass.html → « HTTP 404 » (HTML présent, API non montée).
# À lancer SUR le VPS :
#
#   curl -fsSL \
#     "https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/HOTFIX-MASTERCLASS-404.sh" \
#     -o /tmp/hotfix-mc.sh && bash /tmp/hotfix-mc.sh
#
# Avec seed chapitres (scp avant) :
#   scp masterclass-seed.tar.gz ubuntu@VPS:/tmp/
#   MASTERCLASS_SEED_TGZ=/tmp/masterclass-seed.tar.gz bash /tmp/hotfix-mc.sh
#
set -euo pipefail

if [[ "$(uname -s)" == "MINGW"* ]] || [[ "$(uname -s)" == "CYGWIN"* ]]; then
  echo "ERREUR: lance sur le VPS ubuntu@164.132.46.191, pas Windows."
  exit 1
fi

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
REF="${MASTERCLASS_REF:-main}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"

echo "======== HOTFIX MASTERCLASS 404 ($REF) ========"
mkdir -p \
  "$APP_DIR/public/js" \
  "$APP_DIR/public/css" \
  "$APP_DIR/server-patches/masterclass" \
  "$APP_DIR/data/masterclass/chapters" \
  "$APP_DIR/data/masterclass/progress"

pull() {
  echo "← $(basename "$2")"
  curl -fsSL "$1" -o "$2"
}

if [[ -f "$APP_DIR/server.js" ]]; then
  cp "$APP_DIR/server.js" "$APP_DIR/server.js.bak.mc.$(date +%s)"
fi

pull "$RAW/deploy/vps/app-shells/masterclass.html" "$APP_DIR/public/masterclass.html"
pull "$RAW/deploy/vps/app-shells/masterclass-chapter.html" "$APP_DIR/public/masterclass-chapter.html"
pull "$RAW/deploy/vps/app-shells/dashboard.html" "$APP_DIR/public/dashboard.html"
pull "$RAW/la-forge/js/forge-masterclass.js" "$APP_DIR/public/js/forge-masterclass.js"
pull "$RAW/la-forge/css/forge-masterclass.css" "$APP_DIR/public/css/forge-masterclass.css"
pull "$RAW/deploy/vps/formation-server/routes-masterclass.js" "$APP_DIR/server-patches/routes-masterclass.js"
pull "$RAW/deploy/vps/formation-server/masterclass/config.js" "$APP_DIR/server-patches/masterclass/config.js"
pull "$RAW/deploy/vps/formation-server/masterclass/store.js" "$APP_DIR/server-patches/masterclass/store.js"
pull "$RAW/deploy/vps/wire-formation-server-patches.js" "$APP_DIR/wire-formation-server-patches.js"
pull "$RAW/deploy/vps/masterclass-seed/index.json" "$APP_DIR/data/masterclass/index.json" || true

SEED_TGZ="${MASTERCLASS_SEED_TGZ:-/tmp/masterclass-seed.tar.gz}"
SEED_DIR="${MASTERCLASS_SEED_DIR:-}"
if [[ -f "$SEED_TGZ" ]]; then
  echo "==> Extract seed $SEED_TGZ"
  tar -xzf "$SEED_TGZ" -C "$APP_DIR/data/masterclass"
elif [[ -n "$SEED_DIR" && -d "$SEED_DIR/chapters" ]]; then
  echo "==> Copy seed dir $SEED_DIR"
  cp -a "$SEED_DIR/chapters/." "$APP_DIR/data/masterclass/chapters/"
  [[ -f "$SEED_DIR/index.json" ]] && cp "$SEED_DIR/index.json" "$APP_DIR/data/masterclass/index.json"
else
  echo "WARN — pas de seed chapitres (API OK, sommaire vide jusqu'à import)."
fi

if [[ ! -f "$APP_DIR/data/masterclass/config.json" ]]; then
  cat > "$APP_DIR/data/masterclass/config.json" <<'JSON'
{
  "publication_status": "draft",
  "visibility": "admin_only",
  "sales_enabled": false,
  "price_amount": null,
  "payment_url": null,
  "chapterCount": 23
}
JSON
  echo "OK — config draft créée"
fi

echo "==> Wire router"
node "$APP_DIR/wire-formation-server-patches.js" "$APP_DIR"
node --check "$APP_DIR/server.js"
node --check "$APP_DIR/server-patches/routes-masterclass.js"
node --check "$APP_DIR/public/js/forge-masterclass.js"
for f in "$APP_DIR/server-patches/masterclass"/*.js; do node --check "$f"; done

if ! grep -q 'createMasterclassRouter' "$APP_DIR/server.js"; then
  echo "ERREUR — createMasterclassRouter absent de server.js après wire"
  exit 1
fi
echo "OK — createMasterclassRouter monté dans server.js"

# Ne PAS faire planter le script si 0 chapitre (set -e + ls glob)
CH_COUNT=0
if [[ -d "$APP_DIR/data/masterclass/chapters" ]]; then
  CH_COUNT=$(find "$APP_DIR/data/masterclass/chapters" -maxdepth 1 -name '*.json' | wc -l | tr -d ' ')
fi
echo "Chapitres sur disque : $CH_COUNT"

# Preflight require (détecte module manquant avant restart)
node -e "
const path=require('path');
const p=path.join(process.env.APP_DIR||'$APP_DIR','server-patches','routes-masterclass.js');
require(p);
console.log('OK — require routes-masterclass');
" || { echo "ERREUR — require routes-masterclass a échoué"; exit 1; }

source ~/.profile 2>/dev/null || true
RESTARTED=0
if pm2 describe la-forge >/dev/null 2>&1; then
  echo "==> pm2 restart la-forge"
  pm2 restart la-forge --update-env
  RESTARTED=1
elif pm2 describe torinvest-formation >/dev/null 2>&1; then
  echo "==> pm2 restart torinvest-formation"
  pm2 restart torinvest-formation --update-env
  RESTARTED=1
else
  echo "WARN — pm2 process introuvable — liste :"
  pm2 ls || true
fi
[[ "$RESTARTED" = "1" ]] || echo "WARN — aucun restart PM2"

sleep 4
HTML_CODE=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 8 http://127.0.0.1:3001/masterclass.html || echo 000)
CAT_CODE=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 8 http://127.0.0.1:3001/api/masterclass/catalog || echo 000)
echo "local html → $HTML_CODE"
echo "local catalog → $CAT_CODE (attendu 401 sans cookie ; 404 = API toujours absente)"
if [[ "$CAT_CODE" = "404" ]]; then
  echo "DIAG — grep masterclass dans server.js :"
  grep -n 'masterclass\|Masterclass' "$APP_DIR/server.js" | head -20 || true
  echo "DIAG — ls server-patches :"
  ls -la "$APP_DIR/server-patches/routes-masterclass.js" "$APP_DIR/server-patches/masterclass/" 2>&1 || true
  echo "DIAG — pm2 logs (20 lignes) :"
  pm2 logs --nostream --lines 20 2>&1 | tail -40 || true
  exit 1
fi
echo "→ https://app.torinvest-trading.com/masterclass.html (Ctrl+Shift+R)"
echo "======== DONE ========"
