#!/bin/bash
# Met à jour UNIQUEMENT l’API Fondamental sur le VPS.
# Les fichiers app (applifonda) ne sont PLUS tirés de GitHub (contenu payant).
# Pour pousser l’app : depuis ton PC → deploy/vps/push-applifonda.ps1
#
# Usage (sur le VPS) :
#   bash pull-fondamental.sh
#   bash pull-fondamental.sh main

set -euo pipefail

BRANCH="${1:-main}"
API_DIR="/var/www/torinvest/api"
APP_DIR="/var/lib/torinvest/applifonda"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${BRANCH}/api"

API_FILES=(
  http-session.php
  rate-limit.php
  ai-access-lib.php
  fondamental-access-lib.php
  fondamental-access.php
  fondamental-serve.php
)

echo "==> API Fondamental (branche ${BRANCH})"
for f in "${API_FILES[@]}"; do
  echo "→ $f"
  curl -fsSL -o "/tmp/$f" "${RAW}/$f"
  sudo mv "/tmp/$f" "${API_DIR}/$f"
  sudo chown www-data:www-data "${API_DIR}/$f"
done

# Bloquer tout accès HTTP direct s’il reste une copie sous DocumentRoot
if [[ -d /var/www/torinvest/applifonda ]]; then
  echo "==> Deny HTTP sur /var/www/torinvest/applifonda"
  printf '%s\n' 'Require all denied' | sudo tee /var/www/torinvest/applifonda/.htaccess >/dev/null
fi
if [[ -d /var/www/torinvest/private ]]; then
  printf '%s\n' 'Require all denied' | sudo tee /var/www/torinvest/private/.htaccess >/dev/null
fi

if [[ -d "$APP_DIR" ]]; then
  echo "==> App déjà présente : ${APP_DIR} (non modifiée — hors GitHub)"
else
  echo "ATTENTION: ${APP_DIR} absent."
  echo "Déploie l’app depuis ton PC avec deploy/vps/push-applifonda.ps1"
fi

CFG="${API_DIR}/config.local.php"
if [[ -f "$CFG" ]] && ! sudo grep -q "fondamental_app_dir" "$CFG"; then
  echo "==> Ajoute dans config.local.php :"
  echo "    'fondamental_app_dir' => '${APP_DIR}',"
  echo "    'fondamental_min_krm' => 250,"
fi

echo "==> Syntaxe PHP"
php -l "${API_DIR}/fondamental-access.php"
php -l "${API_DIR}/fondamental-access-lib.php"
php -l "${API_DIR}/fondamental-serve.php"

echo "OK — API Fondamental à jour (app non tirée de GitHub)."
echo "Test : curl -sI 'https://radar.torinvest-trading.com/api/fondamental-serve.php?path=assets/x.js' | head"
echo "Attendu: HTTP 401"
