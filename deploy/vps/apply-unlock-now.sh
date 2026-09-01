#!/usr/bin/env bash
# Déploiement unlock — URLs fixes sur main (pas de variable SHA).
#
# Sur le VPS Ubuntu (user ubuntu), copier-coller TOUT le bloc :
#
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/apply-unlock-now.sh" | bash -s -- ~/torinvest-formation
#   pm2 restart la-forge
#
# Attention : -fsSL en minuscules (pas -fSSL). Avec pipe | bash, passer le chemin via bash -s --

set -euo pipefail

resolve_app_dir() {
  local candidate="${1:-}"
  if [[ -n "$candidate" && -d "$candidate/public/js" ]]; then
    echo "$candidate"
    return 0
  fi
  if [[ -n "${APP_DIR:-}" && -d "$APP_DIR/public/js" ]]; then
    echo "$APP_DIR"
    return 0
  fi
  for candidate in \
    "$HOME/torinvest-formation" \
    "/home/ubuntu/torinvest-formation" \
    "$HOME/torinvest/torinvest-formation"; do
    if [[ -d "$candidate/public/js" ]]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

APP_DIR="$(resolve_app_dir "${1:-}")" || APP_DIR="${1:-${APP_DIR:-$HOME/torinvest-formation}}"
SHA="${SHA:-main}"
BASE="https://raw.githubusercontent.com/torinvest/torinvest/${SHA}"

if [[ ! -d "$APP_DIR/public/js" ]]; then
  echo "ERREUR: $APP_DIR/public/js introuvable"
  echo ""
  echo "Ce script doit s'exécuter sur le VPS où La Forge est installée"
  echo "(dossier avec public/js/, server.js, PM2 la-forge)."
  echo ""
  echo "Sur votre PC Windows/WSL il n'y a souvent PAS ce dossier — connectez-vous au VPS :"
  echo "  ssh ubuntu@<ip-du-vps>"
  echo ""
  echo "Puis sur le VPS :"
  echo "  curl -fsSL \"$BASE/deploy/vps/apply-unlock-now.sh\" | bash -s -- ~/torinvest-formation"
  echo "  pm2 restart la-forge"
  echo ""
  echo "Ou avec chemin explicite :"
  echo "  bash apply-unlock-now.sh /chemin/vers/torinvest-formation"
  exit 1
fi

echo "==> apply-unlock-now → $APP_DIR"

dl() {
  local gh_path="$1"
  local dest="$APP_DIR/public/$2"
  mkdir -p "$(dirname "$dest")"
  echo "  $2"
  curl -fsSL "$BASE/$gh_path" -o "$dest"
}

dl "la-forge/js/progress.js" "js/progress.js"
dl "la-forge/js/course-data.js" "js/course-data.js"
dl "la-forge/js/course-index.js" "js/course-index.js"
dl "la-forge/js/forge-unlock.js" "js/forge-unlock.js"
dl "la-forge/js/lesson-core.js" "js/lesson-core.js"
dl "la-forge/js/forge-replay.js" "js/forge-replay.js"
dl "la-forge/js/forge-annotations.js" "js/forge-annotations.js"
dl "la-forge/css/forge-charts.css" "css/forge-charts.css"
dl "deploy/vps/app-shells/course/index.html" "course/index.html"
dl "deploy/vps/app-shells/dashboard.html" "dashboard.html"
dl "deploy/vps/app-shells/fondamental.html" "fondamental.html"
dl "deploy/vps/app-shells/login.html" "login.html"
dl "la-forge/js/forge-fondamental.js" "js/forge-fondamental.js"
dl "la-forge/js/forge-brand.js" "js/forge-brand.js"
dl "la-forge/js/auth.js" "js/auth.js"

PATCHES="$APP_DIR/server-patches"
mkdir -p "$PATCHES"
for src in middleware-require-subscribed.js forge-unlock-server.js forge-progress-rules.js routes-progress.js course-module-order.json fondamental-bridge-lib.js routes-fondamental-bridge.js formation-users-lib.js accompagnement-worker-lib.js routes-formation-auth.js; do
  echo "  server-patches/$src"
  curl -fsSL "$BASE/deploy/vps/formation-server/$src" -o "$PATCHES/$src" || echo "  WARN — $src"
done

echo ""
wc -c "$APP_DIR/public/js/progress.js" \
  "$APP_DIR/public/js/course-index.js" \
  "$APP_DIR/public/js/course-data.js"
echo ""
echo "OK — unlock appliqué ($(date -Iseconds))."
if [[ -f "$APP_DIR/deploy/vps/patch-lesson-unlock-scripts.js" ]]; then
  echo "==> patch lesson HTML (unlock scripts)"
  node "$APP_DIR/deploy/vps/patch-lesson-unlock-scripts.js" "$APP_DIR" || true
else
  PATCH_JS="$APP_DIR/deploy/vps/patch-lesson-unlock-scripts.js"
  mkdir -p "$(dirname "$PATCH_JS")"
  curl -fsSL "$BASE/deploy/vps/patch-lesson-unlock-scripts.js" -o "$PATCH_JS"
  node "$PATCH_JS" "$APP_DIR" || true
fi

REPLAY_PATCH="$APP_DIR/deploy/vps/patch-lesson-replay-scripts.js"
if [[ -f "$REPLAY_PATCH" ]]; then
  echo "==> patch lesson HTML (replay scripts)"
  node "$REPLAY_PATCH" "$APP_DIR" || true
else
  mkdir -p "$(dirname "$REPLAY_PATCH")"
  curl -fsSL "$BASE/deploy/vps/patch-lesson-replay-scripts.js" -o "$REPLAY_PATCH"
  node "$REPLAY_PATCH" "$APP_DIR" || true
fi

if grep -q 'enrichFrames' "$APP_DIR/public/js/forge-replay.js"; then
  echo "  OK replay pédagogique (enrichFrames)"
else
  echo "  WARN — forge-replay.js ancien : curl deploy-replay-now.sh"
fi
echo "→ pm2 restart la-forge"
echo "→ node deploy/vps/wire-formation-accompagnement-auth.js $APP_DIR  # login accompagnement"
echo "→ export FORGE_FORMATION_PROVISION_SECRET=...  # = formation_provision_secret radar"
echo "→ wc -c public/js/progress.js  (attendu ~6700, unlock dans forge-unlock.js)"
