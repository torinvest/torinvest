#!/usr/bin/env bash
# Vérifie fichiers + server.js + endpoints HTTP (VPS ou depuis l'extérieur).
#
# Usage :
#   bash verify-formation-live.sh /home/ubuntu/torinvest-formation
#   APP_URL=https://app.torinvest-trading.com bash verify-formation-live.sh

set -euo pipefail

APP_DIR="${1:-/home/ubuntu/torinvest-formation}"
APP_URL="${APP_URL:-https://app.torinvest-trading.com}"
FAIL=0

warn() { echo "  WARN $*"; }
ok() { echo "  OK $*"; }
fail() { echo "  FAIL $*"; FAIL=$((FAIL + 1)); }

echo "==> Fichiers déployés"
if [[ -x "$APP_DIR/deploy/vps/verify-formation-deploy.sh" ]]; then
  bash "$APP_DIR/deploy/vps/verify-formation-deploy.sh" "$APP_DIR" || FAIL=$((FAIL + 1))
else
  warn "verify-formation-deploy.sh absent — exécuter pull-forge-all.sh"
fi

echo ""
echo "==> server.js (patches montés)"
SERVER=""
for f in server.js app.js index.js; do
  if [[ -f "$APP_DIR/$f" ]]; then SERVER="$APP_DIR/$f"; break; fi
done

if [[ -z "$SERVER" ]]; then
  fail "server.js introuvable dans $APP_DIR"
else
  ok "fichier $SERVER"
  grep -qE 'createProgressRouter|routes-progress' "$SERVER" && ok "progress router" || fail "progress router absent"
  grep -qE 'createCalendarRouter|routes-calendar' "$SERVER" && ok "calendar router" || fail "calendar router absent"
  grep -qE 'requireSubscribedForCourse|middleware-require-subscribed' "$SERVER" && ok "paywall course" || fail "paywall absent"
  grep -q 'requireAuth' "$SERVER" && ok "requireAuth présent" || fail "requireAuth absent"
fi

echo ""
echo "==> HTTP $APP_URL (sans session)"
check_http() {
  local path="$1"
  local expect="$2"
  local desc="$3"
  local code loc
  code="$(curl -s -o /dev/null -w '%{http_code}' "$APP_URL$path")"
  loc="$(curl -sI "$APP_URL$path" | awk -F': ' '/^Location:/ {print $2; exit}' | tr -d '\r')"
  if [[ "$expect" == "401" && "$code" == "401" ]]; then
    ok "$desc → $code"
  elif [[ "$expect" == "302" && "$code" == "302" && "$loc" == *"login"* ]]; then
    ok "$desc → $code → $loc"
  else
    fail "$desc → $code (attendu $expect) location=$loc"
  fi
}

check_http "/api/progress" "401" "/api/progress"
check_http "/api/calendar" "401" "/api/calendar"
check_http "/course/index.html" "302" "/course/index.html (paywall)"

echo ""
if [[ "$FAIL" -gt 0 ]]; then
  echo "ÉCHEC : $FAIL problème(s)."
  exit 1
fi
echo "OK — formation live (fichiers + server.js + HTTP)."
