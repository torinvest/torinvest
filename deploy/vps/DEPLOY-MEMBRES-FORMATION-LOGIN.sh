#!/usr/bin/env bash
# Déploie l’endpoint /api/internal/formation-verify (VPS formation)
# pour que www membres.html accepte le même email/MDP que La Forge.
#
#   curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/cursor/membres-formation-login-691a/deploy/vps/DEPLOY-MEMBRES-FORMATION-LOGIN.sh | bash
#
# Radar (PHP) : merger la PR puis sync api/member-auth-lib.php +
# api/formation-provision-lib.php + membres.html sur le site www/radar.
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
REF="${REF:-cursor/membres-formation-login-691a}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"

echo "======== DEPLOY MEMBRES ← FORMATION LOGIN ($REF) ========"
mkdir -p "$APP_DIR/server-patches"

curl -fsSL "$RAW/deploy/vps/formation-server/routes-formation-auth.js" \
  -o "$APP_DIR/server-patches/routes-formation-auth.js"

# Sync copies éventuelles ailleurs dans APP_DIR
while IFS= read -r -d '' f; do
  cp -f "$APP_DIR/server-patches/routes-formation-auth.js" "$f"
  echo "Sync → $f"
done < <(find "$APP_DIR" -name 'routes-formation-auth.js' -not -path '*/server-patches/*' -print0 2>/dev/null || true)

if [[ -f "$APP_DIR/wire-formation-server-patches.js" ]]; then
  node "$APP_DIR/wire-formation-server-patches.js" "$APP_DIR" || true
elif [[ -f "$APP_DIR/wire-formation-accompagnement-auth.js" ]]; then
  node "$APP_DIR/wire-formation-accompagnement-auth.js" "$APP_DIR" || true
fi

if command -v pm2 >/dev/null 2>&1; then
  pm2 restart la-forge --update-env || pm2 restart all --update-env || true
fi

echo ""
grep -n "formation-verify" "$APP_DIR/server-patches/routes-formation-auth.js" | head -5
echo ""
echo "Vérif local (doit 401 sans clé) :"
curl -sS -o /dev/null -w "formation-verify %{http_code}\n" \
  -X POST "http://127.0.0.1:3001/api/internal/formation-verify" \
  -H "Content-Type: application/json" \
  -d '{"email":"x@y.z","password":"x"}' || true
echo ""
echo "OK — endpoint formation-verify déployé."
echo "→ Ensuite : déployer les PHP radar (member-auth-lib + formation-provision-lib) + membres.html"
echo "======== DONE ========"
