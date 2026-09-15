#!/usr/bin/env bash
# Restaure abonne@ (login natif) SANS toucher aux clients users.json / Brevo.
# Vérifie que le VPS n'utilise plus l'ancien 401 invalid_credentials du pont.
#
# curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/cursor/owner-login-native-fallthrough-691a/deploy/vps/RESTORE-OWNER-LOGIN.sh | bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
REF="${TORINVEST_DEPLOY_REF:-cursor/owner-login-native-fallthrough-691a}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"
AUTH="$APP_DIR/server-patches/routes-formation-auth.js"

echo "======== RESTORE OWNER LOGIN (native fallthrough) ========"
echo "APP=$APP_DIR REF=$REF"

mkdir -p "$APP_DIR/server-patches"

echo "==> 1) Déploie routes-formation-auth.js"
curl -fsSL "$RAW/deploy/vps/formation-server/routes-formation-auth.js" -o "$AUTH"
if ! grep -q 'next("router")\|next('\''router'\'')' "$AUTH"; then
  echo "ERREUR: fichier déployé sans next('router') — abort"
  grep -n 'invalid_credentials\|return next' "$AUTH" | head -20 || true
  exit 1
fi
echo "OK next('router') présent"

# Shim session (déjà là en principe)
if [[ ! -f "$APP_DIR/server-patches/forge-session-shim.js" ]]; then
  curl -fsSL "$RAW/deploy/vps/formation-server/forge-session-shim.js" \
    -o "$APP_DIR/server-patches/forge-session-shim.js" || true
fi

echo "==> 2) Option: sync abonne@ dans users.json si MDP connu dans .env"
set +e
# shellcheck disable=SC1090
source <(tr -d '\r' < "$APP_DIR/.env" 2>/dev/null | grep -E '^[A-Za-z_][A-Za-z0-9_]*=' || true)
set -e
SECRET="${FORGE_FORMATION_PROVISION_SECRET:-}"
OWNER_EMAIL="${FORGE_ADMIN_EMAIL:-${FORGE_DEMO_EMAIL:-${DEMO_SUBSCRIBER_EMAIL:-abonne@torinvest-trading.com}}}"
OWNER_PASS="${FORGE_ADMIN_PASSWORD:-${FORGE_DEMO_PASSWORD:-${DEMO_SUBSCRIBER_PASSWORD:-}}}"
if [[ -n "$SECRET" && -n "$OWNER_PASS" ]]; then
  echo "  provision $OWNER_EMAIL (skip_brevo) depuis .env"
  curl -sS -X POST 'http://127.0.0.1:3001/api/internal/formation-provision' \
    -H 'Content-Type: application/json' \
    -H "X-Formation-Provision-Key: $SECRET" \
    -d "{\"email\":\"$OWNER_EMAIL\",\"password\":\"$OWNER_PASS\",\"subscribed\":true,\"skip_brevo\":true}" \
    | head -c 400
  echo
else
  echo "  skip sync users.json (pas de FORGE_ADMIN_PASSWORD / DEMO_* dans .env)"
  echo "  → le login passera par server.js natif (next router)"
fi

echo "==> 3) Restart la-forge"
pm2 restart la-forge --update-env
sleep 4

echo "==> 4) Vérif API — ne doit PLUS renvoyer reason=invalid_credentials"
PROBE="$(curl -sS -X POST 'http://127.0.0.1:3001/api/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"abonne@torinvest-trading.com","password":"__probe_wrong_pwd__"}')"
echo "probe: $PROBE"
if echo "$PROBE" | grep -q 'invalid_credentials'; then
  echo "ERREUR: ancien pont encore actif (invalid_credentials)"
  echo "Vérifie: grep -n \"next\" $AUTH | head"
  exit 1
fi
echo "OK — pont ne bloque plus (réponse native ou autre, pas invalid_credentials)"

echo ""
echo "================ SUCCESS ================"
echo "Reconnecte-toi : https://app.torinvest-trading.com/login.html"
echo "  email : abonne@torinvest-trading.com"
echo "  MDP   : ton mot de passe La Forge habituel"
echo "Clients (Nassim) + Brevo : inchangés."
echo "========================================="
