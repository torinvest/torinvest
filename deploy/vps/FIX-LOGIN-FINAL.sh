#!/usr/bin/env bash
# FIX FINAL login La Forge — une seule commande VPS.
# curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/cursor/urgent-formation-login-691a/deploy/vps/FIX-LOGIN-FINAL.sh | bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
REF="${TORINVEST_DEPLOY_REF:-cursor/urgent-formation-login-691a}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"
EMAIL="${CLIENT_EMAIL:-nassim.harrat92000@gmail.com}"

echo "======== FIX LOGIN FINAL ========"
echo "APP=$APP_DIR EMAIL=$EMAIL REF=$REF"

mkdir -p "$APP_DIR/server-patches" "$APP_DIR/public" "$APP_DIR/public/js"

echo "==> 1) Fichiers auth"
for f in routes-formation-auth.js formation-users-lib.js accompagnement-worker-lib.js; do
  curl -fsSL "$RAW/deploy/vps/formation-server/$f" -o "$APP_DIR/server-patches/$f"
  echo "  $f"
done
for page in login.html forgot-password.html account-password.html; do
  curl -fsSL "$RAW/deploy/vps/app-shells/$page" -o "$APP_DIR/public/$page" || true
done
curl -fsSL "$RAW/la-forge/js/auth.js" -o "$APP_DIR/public/js/auth.js" || true

echo "==> 2) Patch server.js (après session COOKIE_NAME)"
curl -fsSL "$RAW/deploy/vps/patch-auth-after-cookie-session.js" -o /tmp/patch-auth-after-cookie-session.js
node /tmp/patch-auth-after-cookie-session.js "$APP_DIR"

echo "==> 3) Restart"
pm2 restart la-forge --update-env
sleep 3

echo "==> 4) Re-provision MDP"
# shellcheck disable=SC1090
set +e
source <(tr -d '\r' < "$APP_DIR/.env" 2>/dev/null | grep -E '^[A-Za-z_][A-Za-z0-9_]*=' || true)
set -e
SECRET="${FORGE_FORMATION_PROVISION_SECRET:-}"
if [[ -z "$SECRET" && -f "$APP_DIR/.env" ]]; then
  SECRET="$(grep '^FORGE_FORMATION_PROVISION_SECRET=' "$APP_DIR/.env" | head -1 | cut -d= -f2- | tr -d '\r\"'\' )"
fi
if [[ -z "$SECRET" ]]; then
  echo "ERREUR: FORGE_FORMATION_PROVISION_SECRET manquant"
  exit 1
fi

PROV="$(curl -sS -X POST 'http://127.0.0.1:3001/api/internal/formation-provision' \
  -H 'Content-Type: application/json' \
  -H "X-Formation-Provision-Key: $SECRET" \
  -d "{\"email\":\"$EMAIL\",\"subscribed\":true}")"
echo "$PROV"
PASS="$(echo "$PROV" | sed -n 's/.*"password":"\([^"]*\)".*/\1/p')"
if [[ -z "$PASS" ]]; then
  echo "ERREUR: pas de password dans provision"
  exit 1
fi

echo "==> 5) Vérifie hash dans data/users.json"
node <<NODE
const fs = require("fs");
const path = require("path");
const email = "${EMAIL}".toLowerCase();
const pass = "${PASS}";
const file = path.join("${APP_DIR}", "data", "users.json");
if (!fs.existsSync(file)) { console.error("MANQUE", file); process.exit(1); }
const raw = JSON.parse(fs.readFileSync(file, "utf8"));
let users = Array.isArray(raw) ? raw : (raw.users || Object.entries(raw).map(([e,u]) => ({ email: e, ...(u||{}) })));
const u = users.find((x) => String(x.email||"").toLowerCase() === email);
if (!u) { console.error("EMAIL ABSENT de users.json"); process.exit(1); }
const hash = u.passwordHash || u.password_hash || u.hash || "";
console.log("user keys", Object.keys(u), "hash?", !!hash);
async function main() {
  let ok = false;
  for (const name of ["bcryptjs", "bcrypt"]) {
    try {
      const lib = require(name);
      ok = await lib.compare(pass, hash);
      console.log(name, "compare", ok);
      if (ok) break;
    } catch (e) { console.log(name, "skip", e.message); }
  }
  if (!ok) process.exit(2);
}
main();
NODE

echo "==> 6) Test login"
RESP="$(curl -sS -X POST 'http://127.0.0.1:3001/api/login' \
  -H 'Content-Type: application/json' \
  -c /tmp/forge-final.cj -b /tmp/forge-final.cj \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")"
echo "$RESP"
if ! echo "$RESP" | grep -Eq '"ok"[[:space:]]*:[[:space:]]*true'; then
  echo "FAIL login"
  echo "--- ordre middlewares (extrait) ---"
  grep -nE 'ACCOMPAGNEMENT_AUTH|COOKIE_NAME|session\(|/api/login' "$APP_DIR/server.js" | head -40
  exit 1
fi

ME="$(curl -sS 'http://127.0.0.1:3001/api/me' -b /tmp/forge-final.cj)"
echo "me: $ME"

echo ""
echo "================ SUCCESS ================"
echo "Email : $EMAIL"
echo "MDP   : $PASS"
echo "URL   : https://app.torinvest-trading.com/login.html"
echo "Envoie CES identifiants au client."
echo "========================================="
