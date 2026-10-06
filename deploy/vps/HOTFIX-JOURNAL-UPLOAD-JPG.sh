#!/usr/bin/env bash
# HOTFIX — Forcer l’API v5 + inject v=5 pour accepter les JPG dans TJ Pro
#
# Prod bloquée = encore ping version:2 (ancien code). Ce script ÉCHOUE
# tant que le ping ne renvoie pas version 5 + sniff.
#
# Sur le VPS :
#   unset REF SHA BRANCH JOURNAL_SCREENS_REF
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/cursor/journal-jpg-force-deploy-691a/deploy/vps/HOTFIX-JOURNAL-UPLOAD-JPG.sh" | bash
set -euo pipefail

unset REF SHA BRANCH JOURNAL_SCREENS_REF SCRIPT_REF 2>/dev/null || true
BRANCH="cursor/journal-jpg-force-deploy-691a"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${BRANCH}"
APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
EXPECTED_INJECT="forge-journal-trade-screens.js?v=5"

PM2_CWD="$(pm2 jlist 2>/dev/null | python3 -c '
import json,sys
try: apps=json.load(sys.stdin)
except Exception: apps=[]
for a in apps:
  if a.get("name")=="la-forge":
    print((a.get("pm2_env") or {}).get("pm_cwd") or ""); break
' 2>/dev/null || true)"
[[ -n "${PM2_CWD}" && -d "${PM2_CWD}" ]] && APP_DIR="$PM2_CWD"

echo "======== HOTFIX JOURNAL JPG FORCE DEPLOY ($BRANCH) ========"
echo "APP=$APP_DIR"
mkdir -p "$APP_DIR/public/js" "$APP_DIR/server-patches"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

curl -fsSL "$RAW/la-forge/js/forge-journal-trade-screens.js" -o "$TMP/forge-journal-trade-screens.js"
curl -fsSL "$RAW/deploy/vps/formation-server/routes-journal-trade-screens.js" -o "$TMP/routes-journal-trade-screens.js"
curl -fsSL "$RAW/deploy/vps/formation-server/routes-journal-bridge.js" -o "$TMP/routes-journal-bridge.js"
curl -fsSL "$RAW/deploy/vps/formation-server/routes-formation-auth.js" -o "$TMP/routes-formation-auth.js"

grep -q 'sniffImageMime' "$TMP/routes-journal-trade-screens.js"
grep -q 'version: 5' "$TMP/routes-journal-trade-screens.js"
grep -q "$EXPECTED_INJECT" "$TMP/routes-journal-bridge.js"
grep -q 'normalizeDataUrl\|base64' "$TMP/forge-journal-trade-screens.js"
grep -q 'createJournalTradeScreensRouter' "$TMP/routes-formation-auth.js"

cp -f "$TMP/forge-journal-trade-screens.js" "$APP_DIR/public/js/forge-journal-trade-screens.js"
cp -f "$TMP/routes-journal-trade-screens.js" "$APP_DIR/server-patches/routes-journal-trade-screens.js"
cp -f "$TMP/routes-journal-bridge.js" "$APP_DIR/server-patches/routes-journal-bridge.js"
cp -f "$TMP/routes-formation-auth.js" "$APP_DIR/server-patches/routes-formation-auth.js"
cp -f "$TMP/routes-journal-trade-screens.js" "$APP_DIR/routes-journal-trade-screens.js"
cp -f "$TMP/routes-formation-auth.js" "$APP_DIR/routes-formation-auth.js" 2>/dev/null || true

N=0
while IFS= read -r -d '' f; do
  dir="$(dirname "$f")"
  cp -f "$TMP/routes-journal-trade-screens.js" "$dir/routes-journal-trade-screens.js"
  cp -f "$TMP/routes-journal-bridge.js" "$dir/routes-journal-bridge.js"
  cp -f "$TMP/routes-formation-auth.js" "$dir/routes-formation-auth.js"
  echo "→ sync @ $dir/"
  N=$((N+1))
done < <(find "$APP_DIR" -name 'routes-formation-auth.js' -print0 2>/dev/null || true)

while IFS= read -r -d '' f; do
  cp -f "$TMP/routes-journal-trade-screens.js" "$f"
  echo "→ overwrite $f"
done < <(find "$APP_DIR" -name 'routes-journal-trade-screens.js' -print0 2>/dev/null || true)

while IFS= read -r -d '' f; do
  cp -f "$TMP/forge-journal-trade-screens.js" "$f"
  echo "→ js $f"
done < <(find "$APP_DIR" -name 'forge-journal-trade-screens.js' -print0 2>/dev/null || true)

echo "Copies formation-auth sync: $N"

# express.json 12mb
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
            t, count=1,
        )
        p.write_text(t2, encoding="utf-8")
        print(f"express.json → 12mb ({p})")
    elif "express.json()" in t:
        p.write_text(t.replace("express.json()", 'express.json({ limit: "12mb" })', 1), encoding="utf-8")
        print(f"express.json() → 12mb ({p})")
    break
PY

# Restart DUR — vider le cache require Node
pm2 stop la-forge 2>/dev/null || true
sleep 1
pm2 delete la-forge 2>/dev/null || true
sleep 1
# Relancer depuis le cwd connu
if [[ -f "$APP_DIR/server.js" ]]; then
  (cd "$APP_DIR" && pm2 start server.js --name la-forge --update-env) || \
  (cd "$APP_DIR" && pm2 start ecosystem.config.js --only la-forge --update-env) || \
  pm2 restart all || true
else
  pm2 restart la-forge --update-env 2>/dev/null || pm2 restart all || true
fi
pm2 save 2>/dev/null || true
sleep 3

echo ""
echo "=== Resolve module ==="
(
  cd "$APP_DIR"
  node -e '
    const fs=require("fs");
    for (const p of ["./server-patches/routes-journal-trade-screens","./routes-journal-trade-screens"]) {
      try {
        const r=require.resolve(p);
        const t=fs.readFileSync(r,"utf8");
        console.log(p,"→",r,"v5=",t.includes("version: 5"),"sniff=",t.includes("sniffImageMime"));
      } catch(e) { console.log(p,"MISSING"); }
    }
  ' || true
)

echo ""
echo "=== ping API (doit être version 5) ==="
PING="$(curl -sS "http://127.0.0.1:3001/api/journal-trade-screens/ping" || true)"
echo "$PING"
if ! echo "$PING" | grep -qE '"version"[[:space:]]*:[[:space:]]*5'; then
  echo ""
  echo "ÉCHEC: ping n’est PAS version 5 — l’ancien module Node est encore chargé."
  echo "Fichiers routes-journal-trade-screens.js :"
  find "$APP_DIR" -name 'routes-journal-trade-screens.js' -print 2>/dev/null || true
  echo "pm2 describe:"
  pm2 describe la-forge 2>/dev/null | head -30 || pm2 list || true
  exit 1
fi
echo "$PING" | grep -q 'sniff' || echo "(warn: pas de sniff dans ping)"

grep -q "$EXPECTED_INJECT" "$APP_DIR/server-patches/routes-journal-bridge.js"
grep -q 'sniffImageMime' "$APP_DIR/server-patches/routes-journal-trade-screens.js"
grep -q 'normalizeDataUrl\|base64' "$APP_DIR/public/js/forge-journal-trade-screens.js"

echo "ok branch=$BRANCH inject=$EXPECTED_INJECT" > "$APP_DIR/public/journal-upload-jpg.deploy.txt"

echo ""
echo "OK — API v5 + inject v=5 déployés."
echo "→ Ctrl+Shift+R : https://app.torinvest-trading.com/journal.html"
echo "→ Ajouter un trade → glisser un JPG"
echo "→ Vérif ping public doit contenir version:5 :"
echo "  curl -sS https://app.torinvest-trading.com/api/journal-trade-screens/ping"
echo "======== DONE ========"
