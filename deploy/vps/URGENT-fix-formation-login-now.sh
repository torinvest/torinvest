#!/usr/bin/env bash
# FIX URGENT login formation — à coller EN ENTIER sur le VPS.
#
# ssh ubuntu@164.132.46.191
# curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/URGENT-fix-formation-login-now.sh | bash
#
# Ou avec email client :
# CLIENT_EMAIL=nassim.harrat92000@gmail.com bash <(curl -fsSL …/URGENT-fix-formation-login-now.sh)
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
REF="${TORINVEST_DEPLOY_REF:-cursor/urgent-formation-login-691a}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"
# Fichiers auth déjà merge sur main ; script + ensure-* sur cette branche
AUTH_REF="${TORINVEST_AUTH_REF:-main}"
AUTH_RAW="https://raw.githubusercontent.com/torinvest/torinvest/${AUTH_REF}"
CLIENT_EMAIL="${CLIENT_EMAIL:-nassim.harrat92000@gmail.com}"
API_DIR="${API_DIR:-/var/www/torinvest/api}"

echo "=========================================="
echo " URGENT fix login La Forge ($REF)"
echo " auth files: $AUTH_REF"
echo " APP_DIR=$APP_DIR"
echo " CLIENT=$CLIENT_EMAIL"
echo "=========================================="

if [[ ! -d "$APP_DIR" ]]; then
  echo "ERREUR: $APP_DIR introuvable"
  exit 1
fi

mkdir -p "$APP_DIR/server-patches" "$APP_DIR/public" "$APP_DIR/public/js" "$APP_DIR/deploy/vps"

echo "==> 1) Fichiers auth formation"
for f in routes-formation-auth.js accompagnement-worker-lib.js formation-users-lib.js; do
  curl -fsSL "$AUTH_RAW/deploy/vps/formation-server/$f" -o "$APP_DIR/server-patches/$f"
  echo "  OK $f"
done

echo "==> 2) Pages login + forgot + account-password"
for page in login.html forgot-password.html account-password.html; do
  curl -fsSL "$AUTH_RAW/deploy/vps/app-shells/$page" -o "$APP_DIR/public/$page"
  echo "  OK public/$page"
done
curl -fsSL "$AUTH_RAW/la-forge/js/auth.js" -o "$APP_DIR/public/js/auth.js"

echo "==> 3) Placer le pont auth APRÈS express-session (critique)"
curl -fsSL "$RAW/deploy/vps/ensure-accompagnement-after-session.js" -o /tmp/ensure-acc-after-session.js
node /tmp/ensure-acc-after-session.js "$APP_DIR"

# Garde-fou : le login ne doit PLUS faire next() vers Identifiants incorrects
if ! grep -q 'Ne jamais déléguer' "$APP_DIR/server-patches/routes-formation-auth.js"; then
  echo "ERREUR: routes-formation-auth.js trop ancien (pas le fix délégation)"
  exit 1
fi

# Vérifier ordre dans server.js : session avant ACCOMPAGNEMENT_AUTH
SESSION_LINE="$(grep -n 'app.use(session' "$APP_DIR/server.js" | head -1 | cut -d: -f1 || true)"
AUTH_LINE="$(grep -n 'ACCOMPAGNEMENT_AUTH_BEGIN' "$APP_DIR/server.js" | head -1 | cut -d: -f1 || true)"
echo "  session L${SESSION_LINE:-?} / auth L${AUTH_LINE:-?}"
if [[ -n "$SESSION_LINE" && -n "$AUTH_LINE" && "$AUTH_LINE" -le "$SESSION_LINE" ]]; then
  echo "ERREUR: auth encore AVANT session — abort"
  exit 1
fi

node --check "$APP_DIR/server-patches/routes-formation-auth.js"
node --check "$APP_DIR/server.js"

echo "==> 4) Restart PM2 la-forge"
# Charger .env sans source CRLF
if [[ -f "$APP_DIR/.env" ]]; then
  sed -i 's/\r$//' "$APP_DIR/.env" || true
  set -a
  # shellcheck disable=SC1090
  source <(tr -d '\r' < "$APP_DIR/.env" | grep -E '^[A-Za-z_][A-Za-z0-9_]*=' || true)
  set +a
fi

pm2 restart la-forge --update-env 2>/dev/null || pm2 restart torinvest-formation --update-env
sleep 3

echo "==> 5) Radar API (Brevo + list MDP + provision_formation)"
if [[ -d "$API_DIR" ]]; then
  for f in admin-licence.php admin-licence-lib.php brevo-lib.php formation-provision-lib.php; do
    sudo curl -fsSL -o "$API_DIR/$f" "$AUTH_RAW/api/$f"
    echo "  OK api/$f"
  done
  sudo chown www-data:www-data "$API_DIR"/admin-licence.php "$API_DIR"/admin-licence-lib.php \
    "$API_DIR"/brevo-lib.php "$API_DIR"/formation-provision-lib.php 2>/dev/null || true
else
  echo "WARN: $API_DIR absent — CRM Brevo/list MDP non mis à jour"
fi

echo "==> 6) Re-provision mot de passe pour $CLIENT_EMAIL"
SECRET="${FORGE_FORMATION_PROVISION_SECRET:-}"
if [[ -z "$SECRET" ]]; then
  # Essayer depuis pm2 env
  SECRET="$(pm2 env "$(pm2 id la-forge 2>/dev/null | head -1)" 2>/dev/null | grep FORGE_FORMATION_PROVISION_SECRET | head -1 | cut -d= -f2- || true)"
fi
if [[ -z "$SECRET" && -f "$APP_DIR/.env" ]]; then
  SECRET="$(grep -E '^FORGE_FORMATION_PROVISION_SECRET=' "$APP_DIR/.env" | head -1 | cut -d= -f2- | tr -d '\r' | tr -d '"' | tr -d "'")"
fi

NEW_PASS=""
if [[ -n "$SECRET" ]]; then
  PROV="$(curl -sS -X POST 'http://127.0.0.1:3001/api/internal/formation-provision' \
    -H 'Content-Type: application/json' \
    -H "X-Formation-Provision-Key: $SECRET" \
    -d "{\"email\":\"$CLIENT_EMAIL\",\"subscribed\":true}")"
  echo "  provision: $PROV"
  NEW_PASS="$(echo "$PROV" | sed -n 's/.*"password":"\([^"]*\)".*/\1/p')"
else
  echo "WARN: FORGE_FORMATION_PROVISION_SECRET introuvable — saute re-provision"
fi

echo "==> 7) Tests login"
echo "--- TOR clé fake (doit être message licence, PAS Identifiants / PAS session_missing) ---"
TOR_RESP="$(curl -sS -X POST 'http://127.0.0.1:3001/api/login' \
  -H 'Content-Type: application/json' \
  -c /tmp/forge-login.cj -b /tmp/forge-login.cj \
  -d "{\"email\":\"$CLIENT_EMAIL\",\"password\":\"TOR-ACCOMPAGNEMENT-TEST-FAKE\"}")"
echo "$TOR_RESP"
if echo "$TOR_RESP" | grep -q 'Identifiants incorrects'; then
  echo "FAIL: login délègue encore au natif."
  exit 1
fi
if echo "$TOR_RESP" | grep -q 'session_missing'; then
  echo "FAIL: req.session absent — auth encore avant express-session."
  exit 1
fi
echo "OK: pont auth actif (plus Identifiants incorrects / session_missing)"

if [[ -n "$NEW_PASS" ]]; then
  echo "--- Mot de passe fraîchement généré ---"
  PASS_RESP="$(curl -sS -X POST 'http://127.0.0.1:3001/api/login' \
    -H 'Content-Type: application/json' \
    -c /tmp/forge-login2.cj -b /tmp/forge-login2.cj \
    -d "{\"email\":\"$CLIENT_EMAIL\",\"password\":\"$NEW_PASS\"}")"
  echo "$PASS_RESP"
  if echo "$PASS_RESP" | grep -Eq '"ok"[[:space:]]*:[[:space:]]*true'; then
    echo "OK LOGIN PASSWORD"
  else
    echo "FAIL login password — vérifie users.json / bcrypt"
    ls -la "$APP_DIR/data/users.json" 2>/dev/null || true
    exit 1
  fi
fi

echo ""
echo "=========================================="
echo " SUCCÈS — envoie au client :"
echo "  URL   : https://app.torinvest-trading.com/login.html"
echo "  Email : $CLIENT_EMAIL"
if [[ -n "$NEW_PASS" ]]; then
  echo "  MDP   : $NEW_PASS"
fi
echo "  (ou sa clé TOR-ACCOMPAGNEMENT dans le champ mot de passe)"
echo "  Self-service : https://app.torinvest-trading.com/forgot-password.html"
echo "=========================================="
