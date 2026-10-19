#!/usr/bin/env bash
# Déploie quiz + examen Masterclass (code) et régénère/installe le seed.
# Sur le VPS :
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/cursor/masterclass-quiz-exam-691a/deploy/vps/DEPLOY-MASTERCLASS-QUIZ.sh" \
#     -o /tmp/d-mcq.sh && bash /tmp/d-mcq.sh
#
# Seed optionnel :
#   MASTERCLASS_SEED_TGZ=/tmp/masterclass-seed.tar.gz bash /tmp/d-mcq.sh
#   MASTERCLASS_SEED_7Z=/tmp/chapitre1a23.7z bash /tmp/d-mcq.sh
#
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
REF="${MASTERCLASS_REF:-cursor/masterclass-quiz-exam-691a}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"

echo "======== DEPLOY MASTERCLASS QUIZ ($REF) ========"
mkdir -p \
  "$APP_DIR/public/js" "$APP_DIR/public/css" \
  "$APP_DIR/server-patches/masterclass" \
  "$APP_DIR/data/masterclass/chapters"

pull() { echo "← $(basename "$2")"; curl -fsSL "$1" -o "$2"; }

pull "$RAW/deploy/vps/app-shells/masterclass.html" "$APP_DIR/public/masterclass.html"
pull "$RAW/deploy/vps/app-shells/masterclass-chapter.html" "$APP_DIR/public/masterclass-chapter.html"
pull "$RAW/la-forge/js/forge-masterclass.js" "$APP_DIR/public/js/forge-masterclass.js"
pull "$RAW/la-forge/css/forge-masterclass.css" "$APP_DIR/public/css/forge-masterclass.css"
pull "$RAW/deploy/vps/formation-server/routes-masterclass.js" "$APP_DIR/server-patches/routes-masterclass.js"
pull "$RAW/deploy/vps/formation-server/masterclass/config.js" "$APP_DIR/server-patches/masterclass/config.js"
pull "$RAW/deploy/vps/formation-server/masterclass/store.js" "$APP_DIR/server-patches/masterclass/store.js"
pull "$RAW/deploy/vps/wire-formation-server-patches.js" "$APP_DIR/wire-formation-server-patches.js"
pull "$RAW/deploy/vps/masterclass-seed/index.json" "$APP_DIR/data/masterclass/index.json" || true
pull "$RAW/scripts/generate-masterclass-quizzes.py" /tmp/generate-masterclass-quizzes.py
pull "$RAW/deploy/vps/INSTALL-MASTERCLASS-SEED.sh" /tmp/INSTALL-MASTERCLASS-SEED.sh
chmod +x /tmp/INSTALL-MASTERCLASS-SEED.sh

# Seed : tarball / 7z / ou régénérer quiz sur chapitres déjà présents
SEED_TGZ="${MASTERCLASS_SEED_TGZ:-/tmp/masterclass-seed.tar.gz}"
SEED_7Z="${MASTERCLASS_SEED_7Z:-/tmp/chapitre1a23.7z}"
CH_BEFORE=$(find "$APP_DIR/data/masterclass/chapters" -maxdepth 1 -name '*.json' 2>/dev/null | wc -l | tr -d ' ')

if [[ -f "$SEED_TGZ" ]] || [[ -f "$SEED_7Z" ]]; then
  MASTERCLASS_REF="$REF" MASTERCLASS_SEED_TGZ="$SEED_TGZ" MASTERCLASS_SEED_7Z="$SEED_7Z" \
    bash /tmp/INSTALL-MASTERCLASS-SEED.sh
elif [[ "${CH_BEFORE:-0}" -gt 0 ]]; then
  echo "==> Régénération quiz/examen sur $CH_BEFORE chapitres existants"
  python3 /tmp/generate-masterclass-quizzes.py \
    --chapters "$APP_DIR/data/masterclass/chapters" \
    --seed-dir "$APP_DIR/data/masterclass"
else
  echo "WARN — pas de seed. scp masterclass-seed.tar.gz ou chapitre1a23.7z vers /tmp/ puis relance."
fi

node "$APP_DIR/wire-formation-server-patches.js" "$APP_DIR"
node --check "$APP_DIR/server-patches/routes-masterclass.js"
node --check "$APP_DIR/public/js/forge-masterclass.js"

source ~/.profile 2>/dev/null || true
if pm2 describe la-forge >/dev/null 2>&1; then
  pm2 restart la-forge --update-env
elif pm2 describe torinvest-formation >/dev/null 2>&1; then
  pm2 restart torinvest-formation --update-env
fi

sleep 3
CH_COUNT=$(find "$APP_DIR/data/masterclass/chapters" -maxdepth 1 -name '*.json' 2>/dev/null | wc -l | tr -d ' ')
echo "Chapitres : $CH_COUNT"
echo "catalog → $(curl -sS -o /dev/null -w '%{http_code}' --max-time 8 http://127.0.0.1:3001/api/masterclass/catalog || echo 000) (401 OK)"
# sample quiz presence
if [[ -f "$APP_DIR/data/masterclass/chapters/01.json" ]]; then
  APP_DIR="$APP_DIR" python3 -c "import json,os; d=json.load(open(os.environ['APP_DIR']+'/data/masterclass/chapters/01.json')); print('ch01 quiz', len((d.get('quiz') or {}).get('questions') or []), 'exam', len((d.get('exam') or {}).get('questions') or []))"
fi
echo "→ Ctrl+Shift+R /masterclass-chapter.html?n=1"
echo "======== DONE ========"
