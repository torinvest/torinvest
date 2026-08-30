#!/usr/bin/env bash
# Vérifie qu'un déploiement formation VPS est complet (local sur le VPS ou CI).
set -euo pipefail

APP_DIR="${1:-/home/ubuntu/torinvest-formation}"
FAIL=0

check_file() {
  if [[ -f "$APP_DIR/$1" ]]; then
    echo "  OK $1"
  else
    echo "  MISSING $1"
    FAIL=$((FAIL + 1))
  fi
}

echo "==> Fichiers public/"
for f in \
  public/js/progress.js \
  public/js/lesson-core.js \
  public/js/forge-gate.js \
  public/js/course-index.js \
  public/js/forge-unlock.js \
  public/js/forge-calendar.js \
  public/dashboard.html \
  public/login.html \
  public/calendar.html \
  public/calendar-day.html \
  public/course/index.html \
  public/img/forge-anvil.png
do
  check_file "$f"
done

echo "==> Patches serveur"
for f in \
  server-patches/routes-progress.js \
  server-patches/middleware-require-subscribed.js \
  server-patches/routes-calendar.js \
  server-patches/forge-unlock-server.js \
  server-patches/course-module-order.json
do
  check_file "$f"
done

echo "==> Syntaxe JS"
for js in "$APP_DIR/public/js"/*.js; do
  if node --check "$js" 2>/dev/null; then
    echo "  OK $(basename "$js")"
  else
    echo "  SYNTAX ERROR $(basename "$js")"
    FAIL=$((FAIL + 1))
  fi
done

echo "==> Signatures clés"
grep -q 'initForgeProgress' "$APP_DIR/public/js/progress.js" && echo "  OK initForgeProgress" || { echo "  MISSING initForgeProgress"; FAIL=$((FAIL + 1)); }
grep -q 'viewBox' "$APP_DIR/public/js/lesson-core.js" && echo "  OK lesson-core viewBox" || { echo "  MISSING viewBox fit"; FAIL=$((FAIL + 1)); }
grep -q 'bindReplayNav' "$APP_DIR/public/js/forge-replay.js" && echo "  OK replay nav" || { echo "  MISSING replay nav"; FAIL=$((FAIL + 1)); }
grep -q 'module-list' "$APP_DIR/public/course/index.html" && echo "  OK course index shell" || { echo "  MISSING course index"; FAIL=$((FAIL + 1)); }
grep -q 'forge-unlock.js' "$APP_DIR/public/course/index.html" && echo "  OK unlock scripts index" || { echo "  MISSING forge-unlock on index"; FAIL=$((FAIL + 1)); }
grep -q 'isModuleUnlocked' "$APP_DIR/public/js/forge-unlock.js" && echo "  OK forge-unlock" || { echo "  MISSING forge-unlock logic"; FAIL=$((FAIL + 1)); }
grep -q 'login-form' "$APP_DIR/public/login.html" && echo "  OK login form" || { echo "  MISSING login form"; FAIL=$((FAIL + 1)); }

if [[ "$FAIL" -gt 0 ]]; then
  echo ""
  echo "ÉCHEC : $FAIL problème(s)."
  exit 1
fi

echo ""
echo "OK — vérification formation passée."
