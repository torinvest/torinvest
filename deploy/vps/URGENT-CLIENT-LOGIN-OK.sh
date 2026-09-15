#!/usr/bin/env bash
# Remet Nassim (ou CLIENT_EMAIL) en état login OK + Brevo auto.
# Ne touche PAS au login natif abonne@ (fallthrough seulement si email absent de users.json).
#
# curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/cursor/owner-login-native-fallthrough-691a/deploy/vps/URGENT-CLIENT-LOGIN-OK.sh | bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
REF="${TORINVEST_DEPLOY_REF:-cursor/owner-login-native-fallthrough-691a}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"
EMAIL="${CLIENT_EMAIL:-nassim.harrat92000@gmail.com}"
DATA_DIR="${FORGE_DATA_DIR:-$APP_DIR/data}"
API_DIR="${API_DIR:-/var/www/torinvest/api}"
RADAR_MAIL_URL="${FORGE_PASSWORD_MAIL_URL:-https://radar.torinvest-trading.com/api/formation-password-mail.php}"

echo "======== URGENT CLIENT LOGIN OK ========"
echo "APP=$APP_DIR DATA=$DATA_DIR EMAIL=$EMAIL REF=$REF"

mkdir -p "$APP_DIR/server-patches" "$DATA_DIR" "$APP_DIR/public"

echo "==> 1) Auth + libs + shim"
for f in routes-formation-auth.js formation-users-lib.js accompagnement-worker-lib.js forge-session-shim.js; do
  curl -fsSL "$RAW/deploy/vps/formation-server/$f" -o "$APP_DIR/server-patches/$f"
  echo "  $f"
done

echo "==> 2) Patch server.js (dataDir FORGE_DATA_DIR)"
curl -fsSL "$RAW/deploy/vps/patch-auth-after-cookie-session.js" -o /tmp/patch-auth-after-cookie-session.js
node /tmp/patch-auth-after-cookie-session.js "$APP_DIR"

echo "==> 3) Radar mail endpoint"
sudo mkdir -p "$API_DIR"
for f in formation-password-mail.php admin-licence-lib.php brevo-lib.php formation-provision-lib.php; do
  sudo curl -fsSL -o "$API_DIR/$f" "$RAW/api/$f"
done
sudo chown www-data:www-data "$API_DIR"/formation-password-mail.php \
  "$API_DIR"/admin-licence-lib.php "$API_DIR"/brevo-lib.php \
  "$API_DIR"/formation-provision-lib.php 2>/dev/null || true

echo "==> 4) .env FORGE_DATA_DIR"
ENV_FILE="$APP_DIR/.env"
touch "$ENV_FILE"
if grep -q '^FORGE_DATA_DIR=' "$ENV_FILE" 2>/dev/null; then
  sed -i "s|^FORGE_DATA_DIR=.*|FORGE_DATA_DIR=$DATA_DIR|" "$ENV_FILE"
else
  echo "FORGE_DATA_DIR=$DATA_DIR" >> "$ENV_FILE"
fi
# strip CRLF that broke source before
sed -i 's/\r$//' "$ENV_FILE" || true

echo "==> 5) Restart"
export FORGE_DATA_DIR="$DATA_DIR"
pm2 restart la-forge --update-env
sleep 4

echo "==> 6) Diagnostic users.json"
USERS_JSON="$DATA_DIR/users.json"
ls -la "$USERS_JSON" 2>/dev/null || echo "(pas encore de users.json)"
if [[ -f "$USERS_JSON" ]]; then
  node -e '
    const fs=require("fs");
    const email=process.argv[1].toLowerCase();
    const raw=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
    let users=[];
    if(Array.isArray(raw)) users=raw;
    else if(raw&&Array.isArray(raw.users)) users=raw.users;
    else if(raw&&typeof raw==="object") users=Object.entries(raw).map(([e,u])=>({email:e,...(u||{})}));
    const hit=users.find(u=>String(u.email||"").toLowerCase()===email);
    console.log("emails:", users.map(u=>u.email).filter(Boolean).slice(0,20).join(", ")||"(aucun)");
    console.log("client_present:", !!hit, "has_hash:", !!(hit&&(hit.passwordHash||hit.password_hash||hit.hash)));
  ' "$EMAIL" "$USERS_JSON"
fi

echo "==> 7) Provision + Brevo"
set +e
# shellcheck disable=SC1090
source <(tr -d '\r' < "$ENV_FILE" 2>/dev/null | grep -E '^[A-Za-z_][A-Za-z0-9_]*=' || true)
set -e
SECRET="${FORGE_FORMATION_PROVISION_SECRET:-}"
if [[ -z "$SECRET" ]]; then
  SECRET="$(grep '^FORGE_FORMATION_PROVISION_SECRET=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r\"'\' )"
fi
[[ -n "$SECRET" ]] || { echo "ERREUR: FORGE_FORMATION_PROVISION_SECRET manquant"; exit 1; }

PROV="$(curl -sS -X POST 'http://127.0.0.1:3001/api/internal/formation-provision' \
  -H 'Content-Type: application/json' \
  -H "X-Formation-Provision-Key: $SECRET" \
  -d "{\"email\":\"$EMAIL\",\"subscribed\":true}")"
echo "provision: $PROV"
PASS="$(echo "$PROV" | sed -n 's/.*"password":"\([^"]*\)".*/\1/p')"
[[ -n "$PASS" ]] || { echo "ERREUR: pas de password"; exit 1; }

if ! echo "$PROV" | grep -q '"brevo"'; then
  MAIL="$(curl -sS -X POST "$RADAR_MAIL_URL" \
    -H 'Content-Type: application/json' \
    -H "X-Formation-Provision-Key: $SECRET" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")"
  echo "brevo fallback: $MAIL"
  echo "$MAIL" | grep -q '"ok":true' || { echo "ERREUR Brevo"; exit 1; }
else
  echo "$PROV" | grep -q '"ok":true' || { echo "ERREUR provision/brevo"; exit 1; }
fi

echo "==> 8) Test login LOCAL (doit ok:true)"
RESP="$(curl -sS -X POST 'http://127.0.0.1:3001/api/login' \
  -H 'Content-Type: application/json' \
  -c /tmp/client-ok.cj -b /tmp/client-ok.cj \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")"
echo "$RESP"
echo "$RESP" | grep -Eq '"ok"[[:space:]]*:[[:space:]]*true' || {
  echo "FAIL login local"
  echo "--- server.js auth markers ---"
  grep -nE 'ACCOMPAGNEMENT_AUTH|FORGE_DATA_DIR|forge-session|createFormationAuth' "$APP_DIR/server.js" | head -40
  exit 1
}

ME="$(curl -sS 'http://127.0.0.1:3001/api/me' -b /tmp/client-ok.cj -c /tmp/client-ok.cj)"
echo "/api/me: $ME"
echo "$ME" | grep -q "$EMAIL" || echo "WARN me sans email (cookie shim?)"

echo ""
echo "================ SUCCESS ================"
echo "Client OK. Nouveau MDP généré + mail Brevo à :"
echo "  $EMAIL"
echo "Mot de passe (aussi dans CRM → Mots de passe formation) :"
echo "  $PASS"
echo "Login : https://app.torinvest-trading.com/login.html"
echo "Dis à Nassim d'utiliser CE mail (spam) — les anciens MDP sont invalidés."
echo "========================================="
