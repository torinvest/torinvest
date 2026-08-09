#!/bin/bash
# Déploie l’API Fondamental + les fichiers app HORS DocumentRoot.
# Usage (sur le VPS) :
#   bash pull-fondamental.sh
#   bash pull-fondamental.sh cursor/fondamental-secure-gate-691a

set -euo pipefail

BRANCH="${1:-main}"
API_DIR="/var/www/torinvest/api"
APP_DIR="/var/lib/torinvest/applifonda"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${BRANCH}/api"
TARBALL="https://github.com/torinvest/torinvest/archive/refs/heads/${BRANCH}.tar.gz"

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

echo "==> App files → ${APP_DIR} (hors webroot)"
TMP="$(mktemp -d)"
curl -fsSL "$TARBALL" -o "$TMP/repo.tar.gz"
tar -xzf "$TMP/repo.tar.gz" -C "$TMP"
# GitHub archive : torinvest-<branch avec / remplacé par ->
SRC="$(find "$TMP" -maxdepth 3 -type d -name applifonda | head -n1)"
if [[ -z "${SRC}" || ! -d "${SRC}" ]]; then
  echo "ERREUR: dossier applifonda introuvable dans l’archive ${BRANCH}"
  rm -rf "$TMP"
  exit 1
fi
sudo mkdir -p "$(dirname "$APP_DIR")"
sudo rsync -a --delete "${SRC}/" "${APP_DIR}/"
sudo chown -R www-data:www-data "$(dirname "$APP_DIR")"
rm -rf "$TMP"

# Bloquer tout accès HTTP direct s’il reste une copie sous DocumentRoot
if [[ -d /var/www/torinvest/applifonda ]]; then
  echo "==> Deny HTTP sur /var/www/torinvest/applifonda"
  printf '%s\n' 'Require all denied' | sudo tee /var/www/torinvest/applifonda/.htaccess >/dev/null
fi
if [[ -d /var/www/torinvest/private ]]; then
  printf '%s\n' 'Require all denied' | sudo tee /var/www/torinvest/private/.htaccess >/dev/null
fi

# config.local.php : chemin app si absent
CFG="${API_DIR}/config.local.php"
if [[ -f "$CFG" ]] && ! sudo grep -q "fondamental_app_dir" "$CFG"; then
  echo "==> Ajoute fondamental_app_dir dans config.local.php (à vérifier)"
  echo "    'fondamental_app_dir' => '${APP_DIR}',"
  echo "    'fondamental_min_krm' => 250,"
fi

echo "==> Syntaxe PHP"
php -l "${API_DIR}/fondamental-access.php"
php -l "${API_DIR}/fondamental-access-lib.php"
php -l "${API_DIR}/fondamental-serve.php"

echo "OK — Fondamental sécurisé déployé."
echo "Test sans cookie :"
echo "  curl -sI 'https://radar.torinvest-trading.com/api/fondamental-serve.php?path=assets/index.js' | head"
echo "Attendu: HTTP 401"
