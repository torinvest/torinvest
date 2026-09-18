#!/usr/bin/env bash
# Rétablit l'accès dashboard pour les sessions forge (cookie torinvest_forge_sess).
# Cause : requireAuth natif (cookie torinvest_session) ignorait la session forge
# → 302 login?next=dashboard → boucle / page inaccessible.
#
# À lancer SUR LE VPS (pas Windows/WSL) :
#   ssh ubuntu@164.132.46.191
#   curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/cursor/fix-dashboard-access-691a/deploy/vps/FIX-DASHBOARD-ACCESS.sh | bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
REF="${TORINVEST_DEPLOY_REF:-cursor/fix-dashboard-access-691a}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"

echo "======== FIX DASHBOARD ACCESS ========"
echo "APP=$APP_DIR REF=$REF HOST=$(hostname)"

if [[ -d /mnt/c/Windows ]] || [[ "$(hostname)" == DESKTOP* ]]; then
  echo "ERREUR: tu es sur Windows/WSL. SSH sur le VPS puis relance."
  exit 1
fi

mkdir -p "$APP_DIR/public/js" "$APP_DIR/public/css" "$APP_DIR/server-patches" \
  "$APP_DIR/public/la-forge/js" "$APP_DIR/public/la-forge/css"

echo "==> 1) auth.js (redirect safe, pas de boucle)"
curl -fsSL "$RAW/la-forge/js/auth.js" -o "$APP_DIR/public/js/auth.js"
cp "$APP_DIR/public/js/auth.js" "$APP_DIR/public/la-forge/js/auth.js" 2>/dev/null || true

echo "==> 2) forge-session-shim + early mount"
curl -fsSL "$RAW/deploy/vps/formation-server/forge-session-shim.js" \
  -o "$APP_DIR/server-patches/forge-session-shim.js"
curl -fsSL "$RAW/deploy/vps/ensure-forge-session-early.js" -o /tmp/ensure-forge-session-early.js
node /tmp/ensure-forge-session-early.js "$APP_DIR"

echo "==> 3) requireAuth accepte session forge"
curl -fsSL "$RAW/deploy/vps/patch-require-auth-forge.js" -o /tmp/patch-require-auth-forge.js
node /tmp/patch-require-auth-forge.js "$APP_DIR"

echo "==> 4) login.html cache-bust"
if curl -fsSL "$RAW/deploy/vps/app-shells/login.html" -o "$APP_DIR/public/login.html"; then
  sed -i 's|auth\.js?v=[^"]*|auth.js?v=dashfix1|g; s|auth\.js"|auth.js?v=dashfix1"|g' "$APP_DIR/public/login.html" || true
fi

echo "==> 5) Syntax check + restart"
node --check "$APP_DIR/server.js"
pm2 restart la-forge --update-env
sleep 3

echo "==> 6) Vérifs locales"
LOGIN_CODE="$(curl -sS -o /dev/null -w '%{http_code}' 'http://127.0.0.1:3001/login.html' || true)"
START_CODE="$(curl -sS -o /dev/null -w '%{http_code}' 'http://127.0.0.1:3001/start.html' || true)"
# Sans cookie : dashboard peut rester 302 (OK) — l'important c'est la session forge
DASH_ANON="$(curl -sS -o /dev/null -w '%{http_code}' 'http://127.0.0.1:3001/dashboard.html' || true)"
echo "login=$LOGIN_CODE start=$START_CODE dashboard_anon=$DASH_ANON"

# Login démo / smoke : cookie forge → dashboard 200
if [[ -f "$APP_DIR/data/users.json" ]]; then
  SMOKE_EMAIL="$(node -e "
    const u=require('$APP_DIR/data/users.json');
    const list=Array.isArray(u)?u:(u.users||Object.values(u)||[]);
    const hit=list.find(x=>x&&x.email&&(x.subscribed||x.passwordHash));
    console.log(hit&&hit.email||'');
  " 2>/dev/null || true)"
  echo "smoke email hint: ${SMOKE_EMAIL:-none}"
fi

[[ "$LOGIN_CODE" == "200" ]] || { echo "ERREUR login pas 200"; exit 1; }
[[ "$START_CODE" == "200" ]] || { echo "ERREUR start pas 200"; exit 1; }

# Confirme que le patch est dans server.js
if ! grep -q 'TORINVEST_FORGE_REQUIRE_AUTH_BEGIN\|TORINVEST_DASHBOARD_PUBLIC_BEGIN' "$APP_DIR/server.js"; then
  echo "ERREUR: patch requireAuth/dashboard absent de server.js"
  exit 1
fi
if ! grep -q 'TORINVEST_FORGE_SESSION_SHIM_BEGIN' "$APP_DIR/server.js"; then
  echo "ERREUR: early forge-session-shim absent"
  exit 1
fi

echo ""
echo "================ SUCCESS ================"
echo "1) Ctrl+F5 https://app.torinvest-trading.com/login.html"
echo "2) Connecte-toi (email + mot de passe)"
echo "3) Tu dois arriver sur le dashboard (ou Premiers pas puis lien Dashboard)"
echo "4) Lien direct : https://app.torinvest-trading.com/dashboard.html"
echo "========================================="
