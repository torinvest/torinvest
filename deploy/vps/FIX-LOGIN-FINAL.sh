#!/usr/bin/env bash
# Déploie login + envoi Brevo automatique du MDP au client.
# curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/cursor/brevo-auto-password-mail-691a/deploy/vps/FIX-LOGIN-FINAL.sh | bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
REF="${TORINVEST_DEPLOY_REF:-cursor/brevo-auto-password-mail-691a}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"
EMAIL="${CLIENT_EMAIL:-nassim.harrat92000@gmail.com}"
API_DIR="${API_DIR:-/var/www/torinvest/api}"
RADAR_MAIL_URL="${FORGE_PASSWORD_MAIL_URL:-https://radar.torinvest-trading.com/api/formation-password-mail.php}"

echo "======== FIX LOGIN + BREVO AUTO ========"
echo "APP=$APP_DIR EMAIL=$EMAIL REF=$REF"

mkdir -p "$APP_DIR/server-patches" "$APP_DIR/public" "$APP_DIR/public/js"

echo "==> 1) Auth + pages"
for f in routes-formation-auth.js formation-users-lib.js accompagnement-worker-lib.js; do
  curl -fsSL "$RAW/deploy/vps/formation-server/$f" -o "$APP_DIR/server-patches/$f"
  echo "  $f"
done
for page in login.html forgot-password.html account-password.html; do
  curl -fsSL "$RAW/deploy/vps/app-shells/$page" -o "$APP_DIR/public/$page" || true
done
curl -fsSL "$RAW/la-forge/js/auth.js" -o "$APP_DIR/public/js/auth.js" || true

echo "==> 2) Patch server.js (session COOKIE_NAME)"
curl -fsSL "$RAW/deploy/vps/patch-auth-after-cookie-session.js" -o /tmp/patch-auth-after-cookie-session.js
node /tmp/patch-auth-after-cookie-session.js "$APP_DIR"

echo "==> 3) Radar API (Brevo mail + libs)"
sudo mkdir -p "$API_DIR"
for f in formation-password-mail.php admin-licence-lib.php admin-licence.php brevo-lib.php formation-provision-lib.php; do
  sudo curl -fsSL -o "$API_DIR/$f" "$RAW/api/$f"
  echo "  api/$f"
done
sudo chown www-data:www-data "$API_DIR"/formation-password-mail.php \
  "$API_DIR"/admin-licence-lib.php "$API_DIR"/admin-licence.php \
  "$API_DIR"/brevo-lib.php "$API_DIR"/formation-provision-lib.php 2>/dev/null || true

echo "==> 4) Restart la-forge"
pm2 restart la-forge --update-env
sleep 3

echo "==> 5) Provision MDP (+ Brevo auto via app)"
set +e
# shellcheck disable=SC1090
source <(tr -d '\r' < "$APP_DIR/.env" 2>/dev/null | grep -E '^[A-Za-z_][A-Za-z0-9_]*=' || true)
set -e
SECRET="${FORGE_FORMATION_PROVISION_SECRET:-}"
if [[ -z "$SECRET" && -f "$APP_DIR/.env" ]]; then
  SECRET="$(grep '^FORGE_FORMATION_PROVISION_SECRET=' "$APP_DIR/.env" | head -1 | cut -d= -f2- | tr -d '\r\"'\' )"
fi
if [[ -z "$SECRET" ]]; then
  echo "ERREUR: FORGE_FORMATION_PROVISION_SECRET manquant dans .env"
  exit 1
fi

PROV="$(curl -sS -X POST 'http://127.0.0.1:3001/api/internal/formation-provision' \
  -H 'Content-Type: application/json' \
  -H "X-Formation-Provision-Key: $SECRET" \
  -d "{\"email\":\"$EMAIL\",\"subscribed\":true}")"
echo "provision: $PROV"
PASS="$(echo "$PROV" | sed -n 's/.*"password":"\([^"]*\)".*/\1/p')"
if [[ -z "$PASS" ]]; then
  echo "ERREUR: pas de password dans provision"
  exit 1
fi

# Si l'app n'a pas encore le code Brevo (ancien process), envoi direct radar
if ! echo "$PROV" | grep -q '"brevo"'; then
  echo "==> 5b) Brevo direct radar (fallback)"
  MAIL="$(curl -sS -X POST "$RADAR_MAIL_URL" \
    -H 'Content-Type: application/json' \
    -H "X-Formation-Provision-Key: $SECRET" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")"
  echo "brevo: $MAIL"
  if ! echo "$MAIL" | grep -q '"ok":true'; then
    echo "ERREUR: Brevo n'a pas envoyé le mail — vérifie brevo_api_key sur radar"
    exit 1
  fi
else
  if ! echo "$PROV" | grep -q '"brevo".*"ok":true\|"ok":true.*"brevo"'; then
    # parse loosely
    if echo "$PROV" | grep -q '"brevo"'; then
      echo "$PROV" | grep -q '"ok":true' || {
        echo "ERREUR: provision OK mais Brevo a échoué — voir JSON ci-dessus"
        # retry direct
        MAIL="$(curl -sS -X POST "$RADAR_MAIL_URL" \
          -H 'Content-Type: application/json' \
          -H "X-Formation-Provision-Key: $SECRET" \
          -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")"
        echo "brevo retry: $MAIL"
        echo "$MAIL" | grep -q '"ok":true' || exit 1
      }
    fi
  fi
fi

echo "==> 6) Test login"
RESP="$(curl -sS -X POST 'http://127.0.0.1:3001/api/login' \
  -H 'Content-Type: application/json' \
  -c /tmp/forge-final.cj -b /tmp/forge-final.cj \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")"
echo "$RESP"
if ! echo "$RESP" | grep -Eq '"ok"[[:space:]]*:[[:space:]]*true'; then
  echo "FAIL login — session toujours mal branchée"
  grep -nE 'ACCOMPAGNEMENT_AUTH|COOKIE_NAME|session\(|/api/login' "$APP_DIR/server.js" | head -40
  exit 1
fi

echo ""
echo "================ SUCCESS ================"
echo "Compte OK + email Brevo envoyé automatiquement à :"
echo "  $EMAIL"
echo "Le client reçoit son mot de passe La Forge par mail (vérifier spam)."
echo "Login : https://app.torinvest-trading.com/login.html"
echo "========================================="
