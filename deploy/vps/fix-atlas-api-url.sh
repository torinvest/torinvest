#!/usr/bin/env bash
# Corrige le bug USA War Atlas : FORGE_ATLAS_API_URL pointait vers la formation (:3001)
# au lieu de l'API Atlas (:3011) → la SPA recevait du HTML (<!DOCTYPE…) au lieu de JSON.
#
# Usage (VPS) :
#   bash deploy/vps/fix-atlas-api-url.sh
#   curl -fsSL …/fix-atlas-api-url.sh | bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu/torinvest-formation}"
ATLAS_SRC="${ATLAS_SRC:-/home/ubuntu/usa-war-atlas}"
ATLAS_PORT="${ATLAS_PORT:-3011}"
APP_URL="${APP_URL:-https://app.torinvest-trading.com}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env}"
PM2_FORMATION="${PM2_PROCESS:-}"
API_URL="http://127.0.0.1:${ATLAS_PORT}"
APP_DIR_VAL="/var/lib/torinvest/appliatlas"

echo "==> Atlas API URL fix (doit être :${ATLAS_PORT}, pas :3001)"

if [[ ! -d "$APP_DIR" ]]; then
  echo "ERREUR : APP_DIR introuvable ($APP_DIR)"
  exit 1
fi

touch "$ENV_FILE"
# .env parfois en CRLF (Windows) → casse `source` avec $'\r'
if command -v sed >/dev/null 2>&1; then
  sed -i 's/\r$//' "$ENV_FILE" 2>/dev/null || true
fi

# Réécrire proprement les clés Atlas (LF only)
grep -vE '^FORGE_ATLAS_(API_URL|APP_DIR)=' "$ENV_FILE" > "${ENV_FILE}.tmp" || true
mv "${ENV_FILE}.tmp" "$ENV_FILE"
# S'assurer que le fichier se termine par un newline avant append
if [[ -s "$ENV_FILE" ]] && [[ "$(tail -c1 "$ENV_FILE" | wc -l)" -eq 0 ]]; then
  echo >> "$ENV_FILE"
fi
printf 'FORGE_ATLAS_APP_DIR=%s\n' "$APP_DIR_VAL" >> "$ENV_FILE"
printf 'FORGE_ATLAS_API_URL=%s\n' "$API_URL" >> "$ENV_FILE"
sed -i 's/\r$//' "$ENV_FILE" 2>/dev/null || true

echo "→ .env Atlas :"
grep -E '^FORGE_ATLAS_' "$ENV_FILE" | tr -d '\r' || true

# Ne PAS source le .env entier (autres lignes peuvent casser le shell).
export FORGE_ATLAS_API_URL="$API_URL"
export FORGE_ATLAS_APP_DIR="$APP_DIR_VAL"

# Santé API Atlas
if ! curl -sfS --max-time 3 "${API_URL}/api/health" >/dev/null 2>&1; then
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
curl -sS --max-time 5 "${API_URL}/api/health" || true
echo

restart_formation() {
  local name="$1"
  # --update-env : injecte les exports du shell (sinon PM2 garde l'ancien :3001)
  FORGE_ATLAS_API_URL="$API_URL" FORGE_ATLAS_APP_DIR="$APP_DIR_VAL" \
    pm2 restart "$name" --update-env
}

if [[ -n "$PM2_PROCESS" ]]; then
  restart_formation "$PM2_PROCESS"
elif pm2 describe la-forge >/dev/null 2>&1; then
  restart_formation la-forge
elif pm2 describe torinvest-formation >/dev/null 2>&1; then
  restart_formation torinvest-formation
else
  echo "WARN — process PM2 formation introuvable"
  pm2 list || true
  exit 1
fi

sleep 2
echo "→ ping bridge (api DOIT être ${API_URL}) :"
PING="$(curl -sS --max-time 8 "${APP_URL}/api/atlas-bridge/ping" || true)"
echo "$PING"
if echo "$PING" | grep -q ":${ATLAS_PORT}"; then
  echo "OK — FORGE_ATLAS_API_URL corrigé."
else
  echo "FAIL — le ping n'affiche pas :${ATLAS_PORT}."
  echo "    Vérifier : pm2 env \$(pm2 id la-forge) | grep FORGE_ATLAS"
  echo "    ou redémarrer : FORGE_ATLAS_API_URL=${API_URL} pm2 restart la-forge --update-env"
  exit 1
fi

echo ""
echo "Test Premium : ouvrir ${APP_URL}/atlas.html (session Premium) — plus d'erreur JSON."
echo "Embed API (avec cookie session) : ${APP_URL}/atlas-embed/api/conflicts"
