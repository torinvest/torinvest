#!/usr/bin/env bash
# Screenshots de trades dans Journal TJ Pro (onglet + zone upload)
#
#   unset REF SHA BRANCH
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/cursor/journal-trade-screens-691a/deploy/vps/DEPLOY-JOURNAL-TRADE-SCREENS.sh" | bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
SCRIPT_REF="${JOURNAL_SCREENS_REF:-${SHA:-cursor/journal-trade-screens-691a}}"
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

echo "======== DEPLOY JOURNAL TRADE SCREENS ($SCRIPT_REF) ========"
echo "APP=$APP_DIR"

mkdir -p "$APP_DIR/public/js" "$APP_DIR/server-patches"
sudo mkdir -p /var/lib/torinvest/journal-trade-screens 2>/dev/null || mkdir -p /var/lib/torinvest/journal-trade-screens || true
sudo chown -R "${SUDO_USER:-$USER}:${SUDO_USER:-$USER}" /var/lib/torinvest/journal-trade-screens 2>/dev/null || true

pull() { echo "← $(basename "$2")"; curl -fsSL "$1" -o "$2"; }

pull "$RAW/deploy/vps/formation-server/routes-journal-trade-screens.js" \
  "$APP_DIR/server-patches/routes-journal-trade-screens.js"
pull "$RAW/deploy/vps/formation-server/routes-journal-bridge.js" \
  "$APP_DIR/server-patches/routes-journal-bridge.js"
pull "$RAW/deploy/vps/formation-server/routes-formation-auth.js" \
  "$APP_DIR/server-patches/routes-formation-auth.js"
pull "$RAW/la-forge/js/forge-journal-trade-screens.js" \
  "$APP_DIR/public/js/forge-journal-trade-screens.js"

# Propager routes à côté de formation-auth
while IFS= read -r -d '' f; do
  dir="$(dirname "$f")"
  cp -f "$APP_DIR/server-patches/routes-journal-trade-screens.js" "$dir/routes-journal-trade-screens.js"
  cp -f "$APP_DIR/server-patches/routes-journal-bridge.js" "$dir/routes-journal-bridge.js"
  cp -f "$APP_DIR/server-patches/routes-formation-auth.js" "$dir/routes-formation-auth.js"
  echo "→ sync @ $dir/"
done < <(find "$APP_DIR" -name 'routes-formation-auth.js' -print0 2>/dev/null || true)

# express.json 12mb+ pour dataUrl
python3 - "$APP_DIR" <<'PY'
from pathlib import Path
import re, sys
app = Path(sys.argv[1])
for p in [app / "server.js", *sorted(app.glob("**/server.js"))]:
    if not p.is_file():
        continue
    t = p.read_text(encoding="utf-8")
    if re.search(r'express\.json\(\s*\{\s*limit:\s*["\'](?:12|20)mb["\']', t):
        print(f"express.json OK: {p}")
        break
    if re.search(r'express\.json\(\s*\{\s*limit:\s*["\']\d+mb["\']\s*\}\s*\)', t):
        t2 = re.sub(
            r'express\.json\(\s*\{\s*limit:\s*["\']\d+mb["\']\s*\}\s*\)',
            'express.json({ limit: "12mb" })',
            t,
            count=1,
        )
        p.write_text(t2, encoding="utf-8")
        print(f"express.json → 12mb ({p})")
    elif "express.json()" in t:
        p.write_text(t.replace("express.json()", 'express.json({ limit: "12mb" })', 1), encoding="utf-8")
        print(f"express.json() → 12mb ({p})")
    break
PY

grep -q 'createJournalTradeScreensRouter' "$APP_DIR/server-patches/routes-formation-auth.js"
grep -q 'forge-journal-trade-screens.js' "$APP_DIR/server-patches/routes-journal-bridge.js"
grep -q 'journal-trade-screens' "$APP_DIR/public/js/forge-journal-trade-screens.js"

pm2 restart la-forge --update-env 2>/dev/null || pm2 restart la-forge || true
sleep 1
curl -sS "http://127.0.0.1:3001/api/journal-trade-screens/ping" || true
echo ""
echo "→ Journal : https://app.torinvest-trading.com/journal.html"
echo "→ Onglet sidebar « Screens trades » + zone upload sur Ajouter un trade"
echo "======== DONE ========"
