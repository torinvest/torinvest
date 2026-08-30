#!/usr/bin/env bash
# Restaure server.js depuis la sauvegarde .bak la plus récente et redémarre PM2.
#
# Usage :
#   bash /home/ubuntu/torinvest-formation/deploy/vps/recover-formation-server.sh
#   bash recover-formation-server.sh /home/ubuntu/torinvest-formation

set -euo pipefail

APP_DIR="${1:-/home/ubuntu/torinvest-formation}"
SERVER="$APP_DIR/server.js"

if [[ ! -f "$SERVER" ]]; then
  echo "ERREUR : $SERVER introuvable"
  exit 1
fi

BACKUP="$(ls -t "$APP_DIR"/server.js.bak.* 2>/dev/null | head -1)"
if [[ -z "$BACKUP" ]]; then
  echo "ERREUR : aucune sauvegarde server.js.bak.* dans $APP_DIR"
  exit 1
fi

echo "==> Restauration $BACKUP → $SERVER"
cp "$BACKUP" "$SERVER"

if ! node --check "$SERVER"; then
  echo "ERREUR : server.js restauré mais syntaxe encore invalide."
  exit 1
fi

echo "==> Syntaxe OK"

if pm2 describe la-forge >/dev/null 2>&1; then
  pm2 restart la-forge
elif pm2 describe torinvest-formation >/dev/null 2>&1; then
  pm2 restart torinvest-formation
else
  echo "WARN — redémarrer PM2 manuellement"
  pm2 list || true
fi

sleep 2
CODE="$(curl -s -o /dev/null -w '%{http_code}' https://app.torinvest-trading.com/login.html || echo 000)"
echo "==> login.html → HTTP $CODE (attendu 200)"
if [[ "$CODE" == "200" ]]; then
  echo "OK — app répond."
else
  echo "WARN — encore un problème. Voir : pm2 logs la-forge --lines 40"
fi
