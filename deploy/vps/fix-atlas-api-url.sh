#!/usr/bin/env bash
# Corrige le bug USA War Atlas : FORGE_ATLAS_API_URL pointait vers la formation (:3001)
# au lieu de l'API Atlas (:3011) → la SPA recevait du HTML (<!DOCTYPE…) au lieu de JSON.
#
# Usage (VPS) :
#   bash deploy/vps/fix-atlas-api-url.sh
#   # ou depuis le repo :
#   curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/fix-atlas-api-url.sh | bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu/torinvest-formation}"
ATLAS_SRC="${ATLAS_SRC:-/home/ubuntu/usa-war-atlas}"
ATLAS_PORT="${ATLAS_PORT:-3011}"
APP_URL="${APP_URL:-https://app.torinvest-trading.com}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env}"
PM2_FORMATION="${PM2_FORMATION:-}"

echo "==> Atlas API URL fix (doit être :${ATLAS_PORT}, pas :3001)"

if [[ ! -d "$APP_DIR" ]]; then
  echo "ERREUR : APP_DIR introuvable ($APP_DIR)"
  exit 1
fi

touch "$ENV_FILE"
# Retirer les anciennes lignes puis écrire la bonne valeur
grep -v '^FORGE_ATLAS_API_URL=' "$ENV_FILE" > "${ENV_FILE}.tmp" || true
mv "${ENV_FILE}.tmp" "$ENV_FILE"
echo "FORGE_ATLAS_API_URL=http://127.0.0.1:${ATLAS_PORT}" >> "$ENV_FILE"

if ! grep -q '^FORGE_ATLAS_APP_DIR=' "$ENV_FILE"; then
  echo "FORGE_ATLAS_APP_DIR=/var/lib/torinvest/appliatlas" >> "$ENV_FILE"
fi

echo "→ .env :"
grep '^FORGE_ATLAS_' "$ENV_FILE" || true

# Charger pour ce shell + export pour PM2 --update-env
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
export FORGE_ATLAS_API_URL="http://127.0.0.1:${ATLAS_PORT}"
export FORGE_ATLAS_APP_DIR="${FORGE_ATLAS_APP_DIR:-/var/lib/torinvest/appliatlas}"

# Santé API Atlas
if ! curl -sfS --max-time 3 "http://127.0.0.1:${ATLAS_PORT}/api/health" >/dev/null 2>&1; then
  echo "WARN — API Atlas ne répond pas sur :${ATLAS_PORT} ; tentative démarrage PM2…"
  if [[ -f "$ATLAS_SRC/apps/api/dist/server.js" ]]; then
    pm2 delete usa-war-atlas-api 2>/dev/null || true
    (
      cd "$ATLAS_SRC"
      API_PORT="$ATLAS_PORT" CORS_ORIGIN="$APP_URL" NODE_ENV=production \
        pm2 start apps/api/dist/server.js \
          --name usa-war-atlas-api \
          --cwd "$ATLAS_SRC" \
          --update-env
    )
    pm2 save || true
    sleep 2
  else
    echo "ERREUR : $ATLAS_SRC/apps/api/dist/server.js manquant — lancer deploy-atlas-vps.sh"
    exit 1
  fi
fi

echo "→ health API :"
curl -sS --max-time 5 "http://127.0.0.1:${ATLAS_PORT}/api/health" || true
echo

# Restart formation avec env à jour
if [[ -n "$PM2_FORMATION" ]]; then
  pm2 restart "$PM2_FORMATION" --update-env
elif pm2 describe la-forge >/dev/null 2>&1; then
  pm2 restart la-forge --update-env
elif pm2 describe torinvest-formation >/dev/null 2>&1; then
  pm2 restart torinvest-formation --update-env
else
  echo "WARN — process PM2 formation introuvable"
  pm2 list || true
  exit 1
fi

sleep 2
echo "→ ping bridge (api DOIT être http://127.0.0.1:${ATLAS_PORT}) :"
PING="$(curl -sS --max-time 8 "${APP_URL}/api/atlas-bridge/ping" || true)"
echo "$PING"
if echo "$PING" | grep -q ":${ATLAS_PORT}"; then
  echo "OK — FORGE_ATLAS_API_URL corrigé."
else
  echo "FAIL — le ping n'affiche pas :${ATLAS_PORT}. Vérifier .env + pm2 env."
  exit 1
fi

echo ""
echo "Test Premium : ouvrir ${APP_URL}/atlas.html (session Premium) — plus d'erreur JSON."
echo "Embed API (avec cookie session) : ${APP_URL}/atlas-embed/api/conflicts"
