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
  public/fondamental.html \
  public/login.html \
  public/calendar.html \
  public/calendar-day.html \
  public/course/index.html \
  public/crypto/index.html \
  public/crypto/module.html \
  public/img/forge-anvil.png \
  public/img/dash-crypto.svg \
  public/js/crypto-course-data.js \
  public/js/crypto-course-index.js \
  public/js/crypto-schemas.js \
  public/js/crypto-lesson.js \
  public/css/forge-crypto.css
do
  check_file "$f"
done

echo "==> Patches serveur"
for f in \
  server-patches/routes-progress.js \
  server-patches/middleware-require-subscribed.js \
  server-patches/routes-calendar.js \
  server-patches/forge-unlock-server.js \
  server-patches/forge-progress-rules.js \
  server-patches/course-module-order.json \
  server-patches/routes-macro-edge.js \
  server-patches/macro-edge/engine.js \
  server-patches/macro-edge/workerAdapter.js \
  server-patches/macro-edge/centralBanks.js \
  server-patches/macro-edge/policyDifferentials.js \
  public/macro-edge.html \
  public/js/forge-macro-edge.js \
  public/css/forge-macro-edge.css
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
grep -q 'enrichFrames' "$APP_DIR/public/js/forge-replay.js" && echo "  OK replay enrichFrames" || { echo "  MISSING enrichFrames — replay pas à jour"; FAIL=$((FAIL + 1)); }
grep -q 'FORGE_REPLAY_VERSION' "$APP_DIR/public/js/forge-replay.js" && echo "  OK FORGE_REPLAY_VERSION" || { echo "  MISSING replay version"; FAIL=$((FAIL + 1)); }
grep -q 'module-list' "$APP_DIR/public/course/index.html" && echo "  OK course index shell" || { echo "  MISSING course index"; FAIL=$((FAIL + 1)); }
grep -q 'forge-unlock.js' "$APP_DIR/public/course/index.html" && echo "  OK unlock scripts index" || { echo "  MISSING forge-unlock on index"; FAIL=$((FAIL + 1)); }
grep -q 'module-list' "$APP_DIR/public/crypto/index.html" && echo "  OK crypto index shell" || { echo "  MISSING crypto index"; FAIL=$((FAIL + 1)); }
grep -q 'CRYPTO_MODULES' "$APP_DIR/public/js/crypto-course-data.js" && echo "  OK crypto curriculum" || { echo "  MISSING CRYPTO_MODULES"; FAIL=$((FAIL + 1)); }
grep -q 'crypto-chip' "$APP_DIR/public/css/forge-crypto.css" && echo "  OK crypto CSS futuriste" || { echo "  MISSING crypto-chip CSS (assets stale?)"; FAIL=$((FAIL + 1)); }
grep -q 'crypto-ticker' "$APP_DIR/public/crypto/index.html" && echo "  OK crypto ticker HTML" || { echo "  MISSING crypto-ticker"; FAIL=$((FAIL + 1)); }
grep -q 'crypto/index.html' "$APP_DIR/public/js/forge-brand.js" && echo "  OK crypto nav" || { echo "  MISSING crypto nav"; FAIL=$((FAIL + 1)); }
grep -q 'crypto/index.html' "$APP_DIR/public/dashboard.html" && echo "  OK crypto dashboard tab" || { echo "  MISSING crypto dashboard"; FAIL=$((FAIL + 1)); }
grep -q 'isModuleUnlocked' "$APP_DIR/public/js/forge-unlock.js" && echo "  OK forge-unlock" || { echo "  MISSING forge-unlock logic"; FAIL=$((FAIL + 1)); }
grep -q 'login-form' "$APP_DIR/public/login.html" && echo "  OK login form" || { echo "  MISSING login form"; FAIL=$((FAIL + 1)); }

if [[ "$FAIL" -gt 0 ]]; then
  echo ""
  echo "ÉCHEC : $FAIL problème(s)."
  exit 1
fi

echo ""
echo "OK — vérification formation passée."
