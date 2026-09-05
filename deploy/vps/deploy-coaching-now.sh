#!/usr/bin/env bash
# Déploie lives coaching + correctif session auth, puis redémarre la-forge.
#
# Sur le VPS :
#   ADMIN_EMAIL=abonne@torinvest-trading.com bash <(curl -fsSL \
#     "https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/deploy-coaching-now.sh")
#
# Ou branche de fix :
#   REF=cursor/coaching-session-fix-691a ADMIN_EMAIL=abonne@torinvest-trading.com bash <(curl -fsSL \
#     "https://raw.githubusercontent.com/torinvest/torinvest/${REF}/deploy/vps/deploy-coaching-now.sh")

set -euo pipefail

APP_DIR="${1:-/home/ubuntu/torinvest-formation}"
REF="${REF:-main}"
ADMIN_EMAIL="${ADMIN_EMAIL:-abonne@torinvest-trading.com}"
APP_URL="${APP_URL:-https://app.torinvest-trading.com}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"

echo "==> deploy-coaching-now (REF=$REF APP_DIR=$APP_DIR ADMIN=$ADMIN_EMAIL)"

if [[ ! -d "$APP_DIR" ]]; then
  echo "ERREUR : dossier introuvable : $APP_DIR"
  exit 1
fi

echo "==> 1) pull-forge-all"
export BRANCH="$REF" SHA="$REF"
bash <(curl -fsSL "${RAW}/deploy/vps/pull-forge-all.sh") "$APP_DIR"

echo "==> 2) wire server patches (calendar + coaching + auth)"
node "$APP_DIR/deploy/vps/wire-formation-server-patches.js" "$APP_DIR"

# Forcer aussi le patch auth le plus récent (session guard)
mkdir -p "$APP_DIR/server-patches"
curl -fsSL "${RAW}/deploy/vps/formation-server/routes-formation-auth.js" \
  -o "$APP_DIR/server-patches/routes-formation-auth.js"
curl -fsSL "${RAW}/deploy/vps/formation-server/routes-coaching-lives.js" \
  -o "$APP_DIR/server-patches/routes-coaching-lives.js"

echo "==> 3) vérifier fichiers"
ls -la "$APP_DIR/server-patches/routes-coaching-lives.js"
ls -la "$APP_DIR/server-patches/routes-formation-auth.js"
ls -la "$APP_DIR/public/js/forge-coaching-lives.js" 2>/dev/null \
  || ls -la "$APP_DIR/public/la-forge/js/forge-coaching-lives.js" 2>/dev/null \
  || echo "WARN — forge-coaching-lives.js introuvable dans public/"

if ! grep -q "createCoachingLivesRouter\|routes-coaching-lives" "$APP_DIR/server.js" 2>/dev/null; then
  echo "WARN — coaching pas encore dans server.js, re-wire…"
  node "$APP_DIR/deploy/vps/wire-formation-server-patches.js" "$APP_DIR"
fi

if ! grep -q "createCoachingLivesRouter\|routes-coaching-lives" "$APP_DIR/server.js" 2>/dev/null; then
  echo "ERREUR : routes-coaching-lives toujours absent de server.js"
  echo "→ ouvre server.js et cherche createCalendarRouter ; colle createCoachingLivesRouter juste après."
  exit 1
fi
echo "OK — coaching monté dans server.js"

echo "==> 4) FORGE_ADMIN_EMAILS=$ADMIN_EMAIL"
ENV_FILE="$APP_DIR/.env"
touch "$ENV_FILE"
if grep -q '^FORGE_ADMIN_EMAILS=' "$ENV_FILE" 2>/dev/null; then
  sed -i "s|^FORGE_ADMIN_EMAILS=.*|FORGE_ADMIN_EMAILS=${ADMIN_EMAIL}|" "$ENV_FILE"
else
  echo "FORGE_ADMIN_EMAILS=${ADMIN_EMAIL}" >> "$ENV_FILE"
fi
export FORGE_ADMIN_EMAILS="$ADMIN_EMAIL"

echo "==> 5) restart PM2 la-forge"
if pm2 describe la-forge >/dev/null 2>&1; then
  pm2 restart la-forge --update-env
elif pm2 describe torinvest-formation >/dev/null 2>&1; then
  pm2 restart torinvest-formation --update-env
else
  echo "ERREUR : process PM2 la-forge introuvable"
  pm2 list || true
  exit 1
fi
pm2 save

sleep 2
echo "==> 6) vérifs"
pm2 list || true
echo "--- templates (attendu 401 sans cookie, PAS 404) ---"
code=$(curl -sS -o /tmp/coach-tpl.json -w "%{http_code}" "${APP_URL}/api/coaching-lives/templates" || echo "000")
echo "HTTP $code"
head -c 300 /tmp/coach-tpl.json 2>/dev/null; echo
if [[ "$code" == "404" ]]; then
  echo "FAIL — toujours 404 : la route n'est pas montée ou mauvais reverse-proxy"
  pm2 logs la-forge --lines 40 --nostream || true
  exit 1
fi

echo ""
echo "OK — déploiement coaching terminé."
echo "→ Connecte-toi avec ${ADMIN_EMAIL}"
echo "→ Ouvre ${APP_URL}/calendar.html puis Ctrl+Shift+R"
echo "→ Tu dois voir le panneau admin « Proposer la semaine »"
