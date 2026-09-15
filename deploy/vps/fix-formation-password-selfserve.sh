#!/usr/bin/env bash
# Déploie correctif login clé TOR + Brevo MDP + self-service mot de passe.
#
# Sur le VPS (ssh ubuntu@164.132.46.191) :
#   curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/cursor/formation-password-selfserve-691a/deploy/vps/fix-formation-password-selfserve.sh | bash
#
# Puis radar API (même VPS) :
#   bash /var/www/torinvest/deploy/vps/pull-api.sh
#   # ou le bloc curl admin-licence*.php plus bas
set -euo pipefail

APP_DIR="${1:-$HOME/torinvest-formation}"
REF="${TORINVEST_DEPLOY_REF:-cursor/formation-password-selfserve-691a}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"
API_DIR="${API_DIR:-/var/www/torinvest/api}"

echo "==> Formation password self-serve ($REF)"

mkdir -p "$APP_DIR/server-patches" "$APP_DIR/public" "$APP_DIR/public/js"

for f in routes-formation-auth.js accompagnement-worker-lib.js formation-users-lib.js; do
  echo "→ server-patches/$f"
  curl -fsSL "$RAW/deploy/vps/formation-server/$f" -o "$APP_DIR/server-patches/$f"
done

for page in login.html forgot-password.html account-password.html; do
  echo "→ public/$page"
  curl -fsSL "$RAW/deploy/vps/app-shells/$page" -o "$APP_DIR/public/$page"
done

curl -fsSL "$RAW/la-forge/js/auth.js" -o "$APP_DIR/public/js/auth.js"

# Relocate auth avant /api/login natif
if [[ -f "$APP_DIR/deploy/vps/relocate-accompagnement-auth.js" ]]; then
  node "$APP_DIR/deploy/vps/relocate-accompagnement-auth.js" "$APP_DIR" || true
elif [[ -f "$APP_DIR/server.js" ]]; then
  curl -fsSL "$RAW/deploy/vps/relocate-accompagnement-auth.js" -o /tmp/relocate-acc-auth.js
  node /tmp/relocate-acc-auth.js "$APP_DIR" || true
fi

node --check "$APP_DIR/server-patches/routes-formation-auth.js"
node --check "$APP_DIR/server.js" 2>/dev/null || true

pm2 restart la-forge --update-env || pm2 restart torinvest-formation --update-env || true
sleep 2

echo "==> Radar API (Brevo sur reset MDP)"
if [[ -d "$API_DIR" ]]; then
  for f in admin-licence.php admin-licence-lib.php brevo-lib.php formation-provision-lib.php; do
    echo "→ api/$f"
    sudo curl -fsSL -o "$API_DIR/$f" "$RAW/api/$f"
  done
  sudo chown www-data:www-data \
    "$API_DIR/admin-licence.php" \
    "$API_DIR/admin-licence-lib.php" \
    "$API_DIR/brevo-lib.php" \
    "$API_DIR/formation-provision-lib.php" 2>/dev/null || true
else
  echo "WARN — $API_DIR absent. Depuis le VPS radar :"
  echo "  sudo mkdir -p /var/www/torinvest/api && re-lancer ce script"
fi

# Netlify CRM (admin-licence/) : déployé via git/Netlify — pas ce script.
echo ""
echo "OK — tests :"
echo "  curl -sS -X POST https://app.torinvest-trading.com/api/login -H 'Content-Type: application/json' \\"
echo "    -d '{\"email\":\"…\",\"password\":\"TOR-ACCOMPAGNEMENT-…\"}'"
echo "  → ne doit PLUS répondre « Identifiants incorrects » pour une vraie clé"
echo "  CRM → Créer/reset MDP → email Brevo automatique"
echo "  Client → https://app.torinvest-trading.com/forgot-password.html"
