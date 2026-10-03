#!/usr/bin/env bash
# Hotfix rapide — agrandissement screens admin chart
#   unset REF SHA BRANCH
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/cursor/chart-screens-admin-ux-691a/deploy/vps/HOTFIX-CHART-ADMIN-ZOOM.sh" | bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
SCRIPT_REF="${CHART_EX_REF:-${SHA:-cursor/chart-screens-admin-ux-691a}}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${SCRIPT_REF}"

PM2_CWD="$(pm2 jlist 2>/dev/null | python3 -c '
import json,sys
try: apps=json.load(sys.stdin)
except Exception: apps=[]
for a in apps:
  if a.get("name")=="la-forge":
    print((a.get("pm2_env") or {}).get("pm_cwd") or ""); break
' 2>/dev/null || true)"
[[ -n "${PM2_CWD}" && -d "${PM2_CWD}" ]] && APP_DIR="$PM2_CWD"

echo "======== HOTFIX CHART ADMIN ZOOM ($SCRIPT_REF) ========"
echo "APP=$APP_DIR"
mkdir -p "$APP_DIR/public/js"

curl -fsSL "$RAW/deploy/vps/app-shells/chart-exercises-admin.html" -o "$APP_DIR/public/chart-exercises-admin.html"
curl -fsSL "$RAW/la-forge/js/forge-chart-exercises-admin.js" -o "$APP_DIR/public/js/forge-chart-exercises-admin.js"
curl -fsSL "$RAW/la-forge/js/course-data.js" -o "$APP_DIR/public/js/course-data.js" || true

grep -q 'data-cex-zoom\|cex-lightbox--open' "$APP_DIR/public/js/forge-chart-exercises-admin.js"
grep -q 'forge-chart-exercises-admin.js?v=4\|Agrandir' "$APP_DIR/public/chart-exercises-admin.html"

echo "OK — hard refresh Ctrl+Shift+R sur /chart-exercises-admin.html"
echo "======== DONE ========"
