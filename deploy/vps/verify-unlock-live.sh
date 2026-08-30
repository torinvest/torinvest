#!/usr/bin/env bash
# Vérifie depuis l'extérieur que le déblocage modules est déployé sur app.*
set -euo pipefail

APP_URL="${APP_URL:-https://app.torinvest-trading.com}"
FAIL=0

check_min_size() {
  local path="$1"
  local min="$2"
  local label="$3"
  local size
  size=$(curl -fsSL "$APP_URL$path" | wc -c)
  if [[ "$size" -ge "$min" ]]; then
    echo "  OK $label ($size bytes)"
  else
    echo "  FAIL $label — $size bytes (min $min) — VPS pas à jour"
    FAIL=$((FAIL + 1))
  fi
}

check_grep() {
  local path="$1"
  local pattern="$2"
  local label="$3"
  if curl -fsSL "$APP_URL$path" | grep -q "$pattern"; then
    echo "  OK $label"
  else
    echo "  FAIL $label — pattern absent"
    FAIL=$((FAIL + 1))
  fi
}

echo "==> Vérif unlock live ($APP_URL)"

check_min_size "/js/progress.js" 6000 "progress.js"
check_min_size "/js/course-index.js" 6000 "course-index.js (masquage)"
check_grep "/js/forge-unlock.js" "isModuleUnlocked" "unlock dans forge-unlock.js"
check_grep "/js/course-data.js" "getAllModuleIds" "course-data.js"

if curl -fsSL "$APP_URL/js/progress.js" | grep -q "isModuleUnlocked"; then
  echo "  WARN progress.js contient encore unlock (ancienne version)"
  FAIL=$((FAIL + 1))
fi

if [[ "$FAIL" -gt 0 ]]; then
  echo ""
  echo "ÉCHEC — déployez sur le VPS :"
  echo "  curl -fsSL \"https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/apply-unlock-now.sh\" | bash"
  exit 1
fi

echo ""
echo "OK — fichiers unlock déployés."
