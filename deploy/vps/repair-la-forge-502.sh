#!/usr/bin/env bash
# Réparer la-forge en crash / 502 Bad Gateway
set -euo pipefail

FORM_DIR="${1:-$HOME/torinvest-formation}"
REF="${TORINVEST_DEPLOY_REF:-main}"
BASE="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"

echo "========== REPAIR la-forge (502) =========="
echo "APP: $FORM_DIR | git: $REF"

if [ ! -f "$FORM_DIR/server.js" ]; then
  echo "ERREUR: $FORM_DIR/server.js introuvable"
  exit 1
fi

echo ""
echo "==> 1) Logs erreur PM2"
pm2 logs la-forge --lines 20 --nostream 2>/dev/null | tail -25 || true

echo ""
echo "==> 2) Syntaxe server.js"
if node --check "$FORM_DIR/server.js" 2>/dev/null; then
  echo "OK — server.js"
else
  echo "ERREUR server.js — restauration backup"
  BAK=$(ls -t "$FORM_DIR"/server.js.bak.* 2>/dev/null | head -1)
  if [ -n "$BAK" ]; then
    cp "$BAK" "$FORM_DIR/server.js"
    echo "Restauré depuis $BAK"
    node --check "$FORM_DIR/server.js" || { echo "Backup aussi invalide"; exit 1; }
  else
    echo "Pas de backup — corriger server.js manuellement"
    exit 1
  fi
fi

echo ""
echo "==> 3) Patches server-patches"
mkdir -p "$FORM_DIR/server-patches"
for f in fondamental-bridge-lib.js routes-fondamental-bridge.js routes-formation-auth.js formation-users-lib.js accompagnement-worker-lib.js; do
  curl -fsSL "$BASE/deploy/vps/formation-server/$f" -o "$FORM_DIR/server-patches/$f"
  node --check "$FORM_DIR/server-patches/$f" && echo "OK — $f"
done

echo ""
echo "==> 4) Test require (depuis $FORM_DIR)"
cd "$FORM_DIR"
node -e "
try {
  require('./server-patches/fondamental-bridge-lib');
  require('./server-patches/routes-fondamental-bridge');
  console.log('OK — modules chargent');
} catch (e) {
  console.error('ERREUR require:', e.message);
  process.exit(1);
}
"

echo ""
echo "==> 5) Restart PM2"
source ~/.profile 2>/dev/null || true
pm2 restart la-forge --update-env || pm2 start "$FORM_DIR/server.js" --name la-forge
sleep 4

echo ""
echo "==> 6) Test local"
CODE=$(curl -s -o /tmp/la-forge-ping.txt -w "%{http_code}" --max-time 5 http://127.0.0.1:3001/login.html || echo "000")
echo "HTTP localhost:3001/login.html → $CODE"
if [ "$CODE" = "200" ]; then
  echo "OK — app répond"
else
  echo "ERREUR — encore down. Logs:"
  pm2 logs la-forge --lines 15 --nostream 2>/dev/null | tail -20
  exit 1
fi

echo ""
echo "========== RÉPARÉ — reteste login / activate =========="
