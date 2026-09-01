#!/usr/bin/env bash
# Diagnostic Fondamental — lance sur le VPS en une commande.
set -euo pipefail

FORM_DIR="${FORM_DIR:-$HOME/torinvest-formation}"
RADAR_API="/var/www/torinvest/api"
APPLI="/var/lib/torinvest/applifonda"

echo "========== DIAGNOSTIC FONDAMENTAL =========="

echo ""
echo "1) Fichiers applifonda (modules) sur le VPS ?"
if [ -f "$APPLI/index.html" ]; then
  echo "   OK — $APPLI/index.html existe"
  ls "$APPLI" | head -8
else
  echo "   ERREUR — pas de applifonda sur $APPLI"
  echo "   → Les modules Fondamental ne sont PAS sur le serveur."
  echo "   → Depuis ton PC : deploy/vps/push-applifonda.ps1"
fi

echo ""
echo "2) Secrets formation (PM2)"
source ~/.profile 2>/dev/null || true
if [ -n "${FORGE_FONDAMENTAL_BRIDGE_SECRET:-}" ]; then
  echo "   OK — FORGE_FONDAMENTAL_BRIDGE_SECRET défini (${#FORGE_FONDAMENTAL_BRIDGE_SECRET} car.)"
else
  echo "   ERREUR — FORGE_FONDAMENTAL_BRIDGE_SECRET vide (source ~/.profile)"
fi

echo ""
echo "3) Code pont embed installé ?"
if grep -q 'fondamental-embed' "$FORM_DIR/server-patches/routes-fondamental-bridge.js" 2>/dev/null; then
  echo "   OK — routes-fondamental-bridge.js (embed)"
else
  echo "   ERREUR — routes-fondamental-bridge.js absent ou vieux"
fi
if grep -q 'fondamental-bridge' "$FORM_DIR/server.js" 2>/dev/null; then
  echo "   OK — bloc fondamental dans server.js"
else
  echo "   ERREUR — bloc fondamental absent dans server.js"
fi

echo ""
echo "4) Test login + activation pont (API)"
COOKIE=/tmp/fonda-diag.cookie
rm -f "$COOKIE"
LOGIN=$(curl -s -c "$COOKIE" -X POST 'https://app.torinvest-trading.com/api/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"abonne@torinvest-trading.com","password":"Forge2026!"}')
echo "   login: $LOGIN"
if echo "$LOGIN" | grep -q '"ok"'; then
  echo "   OK — login La Forge"
else
  echo "   ERREUR — login La Forge"
fi

ACTIVATE=$(curl -s -b "$COOKIE" -c "$COOKIE" -X POST 'https://app.torinvest-trading.com/api/fondamental-bridge/activate')
echo "   activate: $ACTIVATE"
if echo "$ACTIVATE" | grep -q '"ok"'; then
  echo "   OK — pont Fondamental activé"
  EMBED=$(curl -s -o /tmp/fonda-embed.html -w "%{http_code}" -b "$COOKIE" \
    'https://app.torinvest-trading.com/applifonda/index.html')
  echo "   embed HTTP: $EMBED"
  if [ "$EMBED" = "200" ]; then
    echo "   OK — modules accessibles via embed"
    head -c 120 /tmp/fonda-embed.html; echo "..."
  else
    echo "   ERREUR — embed retourne $EMBED (applifonda ou radar)"
    head -c 200 /tmp/fonda-embed.html 2>/dev/null; echo
  fi
else
  echo "   ERREUR — pont non activé = Fondamental ne peut pas s'ouvrir"
  echo "   Causes : secret FORGE_FONDAMENTAL_BRIDGE_SECRET ≠ ai_access_hmac_secret radar"
  echo "            ou API radar pas à jour (pull-fondamental.sh)"
fi

echo ""
echo "========== FIN =========="
echo "Si ERREUR sur applifonda → pousser l'app depuis ton PC (push-applifonda.ps1)"
echo "Si ERREUR sur activate → vérifier secrets + pm2 restart la-forge --update-env"
echo "Sur le site : Ctrl+Shift+R puis bouton « Ouvrir Fondamental (Premium) »"
