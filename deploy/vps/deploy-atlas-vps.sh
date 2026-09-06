#!/usr/bin/env bash
# Déploie USA War Atlas sur le VPS formation (Linux bash — PAS PowerShell).
#
# Sur le VPS :
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/deploy-atlas-vps.sh" -o /tmp/deploy-atlas-vps.sh
#   bash /tmp/deploy-atlas-vps.sh
#
# Ports :
#   la-forge (formation) = :3001
#   usa-war-atlas-api    = :3011   ← volontairement différent

set -euo pipefail

REF="${REF:-main}"
APP_DIR="${APP_DIR:-/home/ubuntu/torinvest-formation}"
ATLAS_SRC="${ATLAS_SRC:-/home/ubuntu/usa-war-atlas}"
ATLAS_DIST="${ATLAS_DIST:-/var/lib/torinvest/appliatlas}"
ATLAS_PORT="${ATLAS_PORT:-3011}"
APP_URL="${APP_URL:-https://app.torinvest-trading.com}"
PM2_FORMATION="${PM2_FORMATION:-}"

echo "==> deploy-atlas-vps (REF=$REF ATLAS_PORT=$ATLAS_PORT)"

# --- 1) Source Atlas ---
if [[ ! -f "$ATLAS_SRC/package.json" ]]; then
  echo "==> Téléchargement private/appliatlas → $ATLAS_SRC"
  rm -rf "$ATLAS_SRC"
  mkdir -p "$ATLAS_SRC"
  TMP=$(mktemp -d)
  ARCHIVE="$TMP/src.tgz"

  echo "    curl codeload…/${REF}"
  if ! curl -fL --retry 3 --retry-delay 2 \
    "https://codeload.github.com/torinvest/torinvest/tar.gz/${REF}" \
    -o "$ARCHIVE"; then
    echo "ERREUR : impossible de télécharger l'archive GitHub (REF=$REF)"
    rm -rf "$TMP"
    exit 1
  fi

  echo "    archive: $(du -h "$ARCHIVE" | awk '{print $1}')"
  # Éviter SIGPIPE + pipefail (tar|head → exit 141) qui tuait le script sans message
  ROOT=$(tar -tzf "$ARCHIVE" | awk -F/ 'NR==1 { print $1; exit 0 }') || true
  if [[ -z "${ROOT:-}" ]]; then
    echo "ERREUR : archive invalide / vide"
    file "$ARCHIVE" || true
    rm -rf "$TMP"
    exit 1
  fi
  echo "    archive root: $ROOT"

  echo "    extraction…"
  tar -xzf "$ARCHIVE" -C "$TMP"
  if [[ ! -d "$TMP/$ROOT/private/appliatlas" ]]; then
    echo "ERREUR : private/appliatlas introuvable dans l'archive $REF"
    ls "$TMP/$ROOT/private" 2>/dev/null || ls "$TMP/$ROOT" | head
    rm -rf "$TMP"
    exit 1
  fi
  cp -a "$TMP/$ROOT/private/appliatlas/." "$ATLAS_SRC/"
  rm -rf "$TMP"
  echo "    OK source → $ATLAS_SRC"
else
  echo "==> Source déjà présente : $ATLAS_SRC"
fi

cd "$ATLAS_SRC"
if [[ ! -f package.json ]]; then
  echo "ERREUR : package.json manquant dans $ATLAS_SRC"
  exit 1
fi

echo "==> npm install ($ATLAS_SRC)"
npm install

# --- 2) .env production ---
if [[ ! -f .env ]]; then
  cp .env.example .env
fi
sed -i "s/^API_PORT=.*/API_PORT=${ATLAS_PORT}/" .env || true
grep -q '^API_PORT=' .env || echo "API_PORT=${ATLAS_PORT}" >> .env
sed -i "s|^CORS_ORIGIN=.*|CORS_ORIGIN=${APP_URL}|" .env || true
grep -q '^CORS_ORIGIN=' .env || echo "CORS_ORIGIN=${APP_URL}" >> .env
sed -i 's|^DATABASE_URL=.*|DATABASE_URL="file:./prod.db"|' .env || true
grep -q '^DATABASE_URL=' .env || echo 'DATABASE_URL="file:./prod.db"' >> .env
grep -q '^NODE_ENV=' .env || echo "NODE_ENV=production" >> .env

# --- 3) DB + builds ---
echo "==> Prisma + builds"
npm run db:generate
npm run db:deploy
npm run db:seed || echo "WARN — seed échoué ou déjà fait (ok si DB existante)"
npm run build -w @usa-war-atlas/shared
npm run build -w @usa-war-atlas/api

echo "==> Build web (embed La Forge)"
export VITE_BASE="/atlas-embed/"
export VITE_API_URL="/atlas-embed"
npm run build -w @usa-war-atlas/web

if [[ ! -f apps/web/dist/index.html ]]; then
  echo "ERREUR : apps/web/dist/index.html manquant après build"
  exit 1
fi

# --- 4) Dist statique ---
echo "==> Install dist → $ATLAS_DIST"
sudo mkdir -p "$ATLAS_DIST"
sudo rsync -a --delete "$ATLAS_SRC/apps/web/dist/" "$ATLAS_DIST/"
sudo chown -R www-data:www-data "$ATLAS_DIST" 2>/dev/null || sudo chown -R ubuntu:ubuntu "$ATLAS_DIST"
ls -la "$ATLAS_DIST" | head

# --- 5) PM2 API ---
echo "==> PM2 usa-war-atlas-api :${ATLAS_PORT}"
pm2 delete usa-war-atlas-api 2>/dev/null || true
cd "$ATLAS_SRC"
API_PORT="$ATLAS_PORT" CORS_ORIGIN="$APP_URL" NODE_ENV=production \
  pm2 start apps/api/dist/server.js \
    --name usa-war-atlas-api \
    --cwd "$ATLAS_SRC" \
    --update-env
pm2 save
pm2 describe usa-war-atlas-api | head -20 || true

# --- 6) Hub + bridge formation ---
echo "==> pull-forge-all (hub atlas + bridge)"
export SHA="$REF" BRANCH="$REF"
bash <(curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/${REF}/deploy/vps/pull-forge-all.sh") "$APP_DIR"

echo "==> Patch Helmet CSP (MapLibre blob workers + tuiles)"
if [[ -f "$APP_DIR/deploy/vps/patch-helmet-journal-frames.js" ]]; then
  node "$APP_DIR/deploy/vps/patch-helmet-journal-frames.js" "$APP_DIR" || true
else
  curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/${REF}/deploy/vps/patch-helmet-journal-frames.js" \
    -o /tmp/patch-helmet-journal-frames.js
  node /tmp/patch-helmet-journal-frames.js "$APP_DIR" || true
fi

ENV_FILE="$APP_DIR/.env"
touch "$ENV_FILE"
grep -q '^FORGE_ATLAS_APP_DIR=' "$ENV_FILE" 2>/dev/null \
  && sed -i "s|^FORGE_ATLAS_APP_DIR=.*|FORGE_ATLAS_APP_DIR=${ATLAS_DIST}|" "$ENV_FILE" \
  || echo "FORGE_ATLAS_APP_DIR=${ATLAS_DIST}" >> "$ENV_FILE"
grep -q '^FORGE_ATLAS_API_URL=' "$ENV_FILE" 2>/dev/null \
  && sed -i "s|^FORGE_ATLAS_API_URL=.*|FORGE_ATLAS_API_URL=http://127.0.0.1:${ATLAS_PORT}|" "$ENV_FILE" \
  || echo "FORGE_ATLAS_API_URL=http://127.0.0.1:${ATLAS_PORT}" >> "$ENV_FILE"

export FORGE_ATLAS_APP_DIR="$ATLAS_DIST"
export FORGE_ATLAS_API_URL="http://127.0.0.1:${ATLAS_PORT}"

echo "==> Restart formation"
if [[ -n "$PM2_FORMATION" ]]; then
  pm2 restart "$PM2_FORMATION" --update-env
elif pm2 describe la-forge >/dev/null 2>&1; then
  pm2 restart la-forge --update-env
elif pm2 describe torinvest-formation >/dev/null 2>&1; then
  pm2 restart torinvest-formation --update-env
else
  echo "WARN — process PM2 formation introuvable ; redémarrer manuellement avec --update-env"
  pm2 list || true
fi

echo ""
echo "==> Vérifs"
sleep 2
curl -sS "http://127.0.0.1:${ATLAS_PORT}/api/health" || echo "FAIL api health :${ATLAS_PORT}"
echo
PING_JSON="$(curl -sS "${APP_URL}/api/atlas-bridge/ping" || true)"
echo "$PING_JSON"
if ! echo "$PING_JSON" | grep -q "127.0.0.1:${ATLAS_PORT}"; then
  echo "FAIL — ping atlas-bridge n'affiche pas api :${ATLAS_PORT}"
  echo "    → lancer : bash deploy/vps/fix-atlas-api-url.sh"
  exit 1
fi
if echo "$PING_JSON" | grep -q '"api":"http://127.0.0.1:3001"'; then
  echo "FAIL — FORGE_ATLAS_API_URL pointe encore vers :3001 (collision formation)"
  exit 1
fi
pm2 list
echo ""
echo "OK — Atlas déployé."
echo "→ ${APP_URL}/atlas.html (compte Premium)"
echo "→ Embed : ${APP_URL}/atlas-embed/"
echo "→ API locale : http://127.0.0.1:${ATLAS_PORT}/api/health"
