#!/usr/bin/env bash
# Notes + screens exercices chart (élève) + admin + récupération notes locales.
#
#   unset REF SHA BRANCH
#   curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/DEPLOY-CHART-EXERCISES.sh | bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
# Ignore REF ambiant (souvent resté sur une vieille branche → 404)
SCRIPT_REF="${CHART_EX_REF:-${SHA:-cursor/chart-screens-admin-ux-691a}}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${SCRIPT_REF}"

echo "======== DEPLOY CHART EXERCISES ($SCRIPT_REF) ========"
echo "(variable REF ambiant ignorée)"
mkdir -p "$APP_DIR/public/js" "$APP_DIR/public/css" "$APP_DIR/server-patches" "$APP_DIR/data/chart-exercises"

pull() { echo "← $(basename "$2")"; curl -fsSL "$1" -o "$2"; }

pull "$RAW/deploy/vps/formation-server/routes-chart-exercises.js" "$APP_DIR/server-patches/routes-chart-exercises.js"
pull "$RAW/deploy/vps/formation-server/forge-progress-rules.js" "$APP_DIR/server-patches/forge-progress-rules.js"
pull "$RAW/deploy/vps/wire-formation-server-patches.js" "$APP_DIR/wire-formation-server-patches.js"
pull "$RAW/la-forge/js/lesson-core.js" "$APP_DIR/public/js/lesson-core.js"
pull "$RAW/la-forge/js/progress.js" "$APP_DIR/public/js/progress.js"
pull "$RAW/la-forge/js/forge-gate.js" "$APP_DIR/public/js/forge-gate.js"
pull "$RAW/la-forge/js/course-data.js" "$APP_DIR/public/js/course-data.js"
pull "$RAW/la-forge/js/forge-chart-exercises-admin.js" "$APP_DIR/public/js/forge-chart-exercises-admin.js"
pull "$RAW/la-forge/css/main.css" "$APP_DIR/public/css/main.css"
pull "$RAW/deploy/vps/app-shells/chart-exercises-admin.html" "$APP_DIR/public/chart-exercises-admin.html"
pull "$RAW/deploy/vps/app-shells/dashboard.html" "$APP_DIR/public/dashboard.html"

node "$APP_DIR/wire-formation-server-patches.js" "$APP_DIR"

# Express JSON body pour screens base64
python3 - "$APP_DIR/server.js" <<'PY'
from pathlib import Path
import re, sys
p = Path(sys.argv[1])
if not p.exists():
    raise SystemExit(0)
t = p.read_text(encoding="utf-8", errors="ignore")
t2, n = re.subn(r"express\.json\(\s*\{[^}]*\}\s*\)", 'express.json({ limit: "12mb" })', t, count=1)
if n:
    p.write_text(t2, encoding="utf-8")
    print("express.json → 12mb")
elif "express.json()" in t:
    p.write_text(t.replace("express.json()", 'express.json({ limit: "12mb" })', 1), encoding="utf-8")
    print("express.json → 12mb")
PY

if command -v pm2 >/dev/null 2>&1; then
  pm2 restart la-forge --update-env || true
fi

echo ""
grep -n "createChartExercisesRouter\|routes-chart-exercises\|migrate-local" "$APP_DIR/server-patches/routes-chart-exercises.js" 2>/dev/null | head -8 || true
curl -sS -o /dev/null -w "chart-exercises-admin %{http_code}\n" "http://127.0.0.1:3001/chart-exercises-admin.html" || true
echo "→ Admin : https://app.torinvest-trading.com/chart-exercises-admin.html"
echo "→ Élève : se reconnecter une fois → notes locales remontent automatiquement"
echo "======== DONE ========"
