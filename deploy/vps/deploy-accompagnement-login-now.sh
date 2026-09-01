#!/usr/bin/env bash
# Déploie login accompagnement sur le VPS formation (branche PR jusqu'à merge main).
#
# Usage sur le VPS formation (ubuntu) :
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/cursor/formation-accompagnement-login-691a/deploy/vps/deploy-accompagnement-login-now.sh" | bash -s -- ~/torinvest-formation
#
# Avec secret provision (recommandé — même valeur que radar config.local.php) :
#   FORGE_FORMATION_PROVISION_SECRET='votre_secret' curl -fsSL "..." | bash -s -- ~/torinvest-formation

set -euo pipefail

APP_DIR="${1:-$HOME/torinvest-formation}"
SHA="${SHA:-cursor/formation-accompagnement-login-691a}"
BASE="https://raw.githubusercontent.com/torinvest/torinvest/${SHA}"

if [[ ! -d "$APP_DIR/public/js" ]]; then
  echo "ERREUR: $APP_DIR/public/js introuvable — mauvais chemin La Forge"
  exit 1
fi

echo "==> deploy-accompagnement-login → $APP_DIR (ref $SHA)"

dl() {
  local gh_path="$1"
  local dest="$2"
  mkdir -p "$(dirname "$dest")"
  echo "  $(basename "$dest")"
  curl -fsSL "$BASE/$gh_path" -o "$dest"
}

mkdir -p "$APP_DIR/deploy/vps" "$APP_DIR/server-patches"

dl "deploy/vps/wire-formation-accompagnement-auth.js" "$APP_DIR/deploy/vps/wire-formation-accompagnement-auth.js"
dl "deploy/vps/recover-formation-server.sh" "$APP_DIR/deploy/vps/recover-formation-server.sh"
dl "deploy/vps/apply-unlock-now.sh" "$APP_DIR/deploy/vps/apply-unlock-now.sh"

for src in formation-users-lib.js accompagnement-worker-lib.js routes-formation-auth.js; do
  dl "deploy/vps/formation-server/$src" "$APP_DIR/server-patches/$src"
done

dl "deploy/vps/app-shells/login.html" "$APP_DIR/public/login.html"
dl "la-forge/js/auth.js" "$APP_DIR/public/js/auth.js"

bash "$APP_DIR/deploy/vps/apply-unlock-now.sh" "$APP_DIR" || true

if [[ -n "${FORGE_FORMATION_PROVISION_SECRET:-}" ]]; then
  export FORGE_FORMATION_PROVISION_SECRET
fi

if ! node --check "$APP_DIR/server.js" 2>/dev/null; then
  echo "==> server.js invalide — restauration sauvegarde"
  bash "$APP_DIR/deploy/vps/recover-formation-server.sh" "$APP_DIR"
fi

echo "==> wire accompagnement auth"
node "$APP_DIR/deploy/vps/wire-formation-accompagnement-auth.js" "$APP_DIR"

if pm2 describe la-forge >/dev/null 2>&1; then
  pm2 restart la-forge
elif pm2 describe torinvest-formation >/dev/null 2>&1; then
  pm2 restart torinvest-formation
else
  echo "WARN — redémarrer PM2 manuellement"
fi

sleep 2
pm2 list
CODE="$(curl -s -o /dev/null -w '%{http_code}' https://app.torinvest-trading.com/login.html || echo 000)"
echo "==> login.html HTTP $CODE"
if [[ "${FORGE_FORMATION_PROVISION_SECRET:-}" == "" ]]; then
  echo ""
  echo "NOTE: FORGE_FORMATION_PROVISION_SECRET non défini — login avec clé TOR OK, provision auto CRM non."
  echo "  export FORGE_FORMATION_PROVISION_SECRET='...'  # puis pm2 restart la-forge"
fi
echo "OK — deploy accompagnement login terminé"
