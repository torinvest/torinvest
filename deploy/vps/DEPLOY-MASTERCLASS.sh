#!/usr/bin/env bash
# Déploie la Masterclass Macro (nouvelle rubrique) — sans toucher au parcours ÉLITE.
#
#   curl -fsSL \
#     "https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/DEPLOY-MASTERCLASS.sh" \
#     -o /tmp/d-mc.sh && bash /tmp/d-mc.sh
#
# Contenu pédagogique : importer le seed (hors Git public) :
#   scp masterclass-seed.tar.gz ubuntu@VPS:/tmp/
#   MASTERCLASS_SEED_TGZ=/tmp/masterclass-seed.tar.gz bash /tmp/d-mc.sh
#
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
PIN="${MACRO_EDGE_PIN:-}" # unused; prefer branch/SHA
REF="${MASTERCLASS_REF:-${MACRO_EDGE_REF:-main}}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"

echo "======== DEPLOY MASTERCLASS ($REF) ========"
mkdir -p \
  "$APP_DIR/public/js" \
  "$APP_DIR/public/css" \
  "$APP_DIR/server-patches/masterclass" \
  "$APP_DIR/data/masterclass/chapters" \
  "$APP_DIR/data/masterclass/progress"

pull() { echo "← $(basename "$2")"; curl -fsSL "$1" -o "$2"; }

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

# Seed chapitres (tarball scp'é, ou dossier local)
SEED_TGZ="${MASTERCLASS_SEED_TGZ:-}"
SEED_DIR="${MASTERCLASS_SEED_DIR:-}"
if [[ -n "$SEED_TGZ" && -f "$SEED_TGZ" ]]; then
  echo "==> Extract seed $SEED_TGZ"
  tar -xzf "$SEED_TGZ" -C "$APP_DIR/data/masterclass"
elif [[ -n "$SEED_DIR" && -d "$SEED_DIR/chapters" ]]; then
  echo "==> Copy seed dir $SEED_DIR"
  cp -a "$SEED_DIR/chapters/." "$APP_DIR/data/masterclass/chapters/"
  [[ -f "$SEED_DIR/../masterclass-seed/index.json" ]] || true
  [[ -f "$SEED_DIR/index.json" ]] && cp "$SEED_DIR/index.json" "$APP_DIR/data/masterclass/index.json"
else
  echo "WARN — aucun seed chapitres. Place MASTERCLASS_SEED_TGZ=... ou importe plus tard."
fi

# Config draft si absente
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

node "$APP_DIR/wire-formation-server-patches.js" "$APP_DIR"
node --check "$APP_DIR/server.js"
node --check "$APP_DIR/server-patches/routes-masterclass.js"
node --check "$APP_DIR/public/js/forge-masterclass.js"
for f in "$APP_DIR/server-patches/masterclass"/*.js; do node --check "$f"; done

CH_COUNT=0
if [[ -d "$APP_DIR/data/masterclass/chapters" ]]; then
  CH_COUNT=$(find "$APP_DIR/data/masterclass/chapters" -maxdepth 1 -name '*.json' | wc -l | tr -d ' ')
fi
echo "Chapitres sur disque : $CH_COUNT"

source ~/.profile 2>/dev/null || true
if pm2 describe la-forge >/dev/null 2>&1; then
  pm2 restart la-forge --update-env
elif pm2 describe torinvest-formation >/dev/null 2>&1; then
  pm2 restart torinvest-formation --update-env
fi

sleep 3
echo "local masterclass.html → $(curl -sS -o /dev/null -w '%{http_code}' --max-time 8 http://127.0.0.1:3001/masterclass.html || echo 000)"
echo "→ https://app.torinvest-trading.com/masterclass.html (admin only)"
echo "======== DONE ========"
