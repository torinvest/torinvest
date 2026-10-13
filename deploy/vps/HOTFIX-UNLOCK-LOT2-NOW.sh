#!/usr/bin/env bash
# HOTFIX — force le déblocage lot 2 sur le VPS (index + forge-unlock à jour)
#
# Symptôme : 0/F1/F2 Validé mais F3+ masqués, teaser « Validez le lot actuel… »
# Cause : public/course/index.html et/ou public/js/forge-unlock.js pas à jour sur le VPS
#         (main a le fix depuis PR #204, mais le live servait encore l'ancien JS).
#
# VPS :
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/HOTFIX-UNLOCK-LOT2-NOW.sh" -o /tmp/hul.sh
#   bash /tmp/hul.sh
#   pm2 restart la-forge
#
set -euo pipefail

APP_DIR="${1:-${APP_DIR:-$HOME/torinvest-formation}}"
REF="${REF:-main}"
BASE="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"

echo "======== HOTFIX UNLOCK LOT 2 ========"
echo "APP=$APP_DIR  REF=$REF"

if [[ ! -d "$APP_DIR/public/js" ]]; then
  echo "ERREUR: $APP_DIR/public/js introuvable — lance sur le VPS (ubuntu@…)."
  exit 1
fi

# 1) Appliquer le pack unlock officiel
curl -fsSL "$BASE/deploy/vps/apply-unlock-now.sh" -o /tmp/apply-unlock-now.sh
bash /tmp/apply-unlock-now.sh "$APP_DIR"

# 2) Re-forcer les 3 fichiers critiques (au cas où apply a un cache CDN)
mkdir -p "$APP_DIR/public/js" "$APP_DIR/public/course"
curl -fsSL "$BASE/la-forge/js/forge-unlock.js" -o "$APP_DIR/public/js/forge-unlock.js"
curl -fsSL "$BASE/la-forge/js/course-index.js" -o "$APP_DIR/public/js/course-index.js"
curl -fsSL "$BASE/deploy/vps/app-shells/course/index.html" -o "$APP_DIR/public/course/index.html"

STAMP=$(date +%s)
# Cache-bust fort sur l'index
sed -i "s|forge-unlock\\.js[^\"']*|forge-unlock.js?v=lot2-${STAMP}|g" "$APP_DIR/public/course/index.html"
sed -i "s|course-index\\.js[^\"']*|course-index.js?v=lot2-${STAMP}|g" "$APP_DIR/public/course/index.html"
sed -i "s|progress\\.js[^\"']*|progress.js?v=lot2-${STAMP}|g" "$APP_DIR/public/course/index.html"

echo ""
echo "=== VERIF fichiers ==="
FAIL=0

if grep -q 'if (typeof global.isModuleUnlocked === "function") return;' "$APP_DIR/public/js/forge-unlock.js"; then
  echo "FAIL forge-unlock.js — early-return encore present (ancien fichier)"
  FAIL=1
else
  echo "OK forge-unlock.js — API toujours exportée"
fi

if grep -q 'getNextUnlockHint' "$APP_DIR/public/js/forge-unlock.js"; then
  echo "OK getNextUnlockHint exporté"
else
  echo "FAIL getNextUnlockHint manquant"
  FAIL=1
fi

if grep -q 'forge-unlock.js' "$APP_DIR/public/course/index.html"; then
  echo "OK course/index.html charge forge-unlock.js"
else
  echo "FAIL course/index.html SANS forge-unlock.js"
  FAIL=1
fi

if grep -q 'hasUnlockHint\|BUG unlock' "$APP_DIR/public/js/course-index.js"; then
  echo "OK course-index.js (diag lot2)"
else
  echo "FAIL course-index.js ancien"
  FAIL=1
fi

wc -c "$APP_DIR/public/js/forge-unlock.js" \
  "$APP_DIR/public/js/course-index.js" \
  "$APP_DIR/public/course/index.html"

if [[ "$FAIL" -ne 0 ]]; then
  echo ""
  echo "ECHEC verif — fichiers pas a jour"
  exit 3
fi

# Restart si pm2 dispo
if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe la-forge >/dev/null 2>&1; then
    pm2 restart la-forge
    echo "OK pm2 restart la-forge"
  elif pm2 describe torinvest-formation >/dev/null 2>&1; then
    pm2 restart torinvest-formation
    echo "OK pm2 restart torinvest-formation"
  else
    echo "WARN: process pm2 la-forge introuvable — restart manuel"
  fi
fi

echo ""
echo "======== DONE ========"
echo "1) Ctrl+Shift+R sur https://app.torinvest-trading.com/course/index.html"
echo "2) Console F12 :"
echo "     typeof getNextUnlockHint     → doit etre \"function\""
echo "     getUnlockedModuleIds().length → ≥ 6 si lot 1 Validé"
echo "3) Tu dois voir F3 / F4 / F5"
echo ""
echo "Si toujours 3 modules : colle le resultat de :"
echo "  typeof isModuleUnlocked; typeof getNextUnlockHint; getUnlockedModuleIds && getUnlockedModuleIds();"
