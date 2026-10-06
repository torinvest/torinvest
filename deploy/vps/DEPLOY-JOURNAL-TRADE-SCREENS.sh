#!/usr/bin/env bash
# Journal — onglet Screenshots trades (shell Forge) + API journal-trade-screens
#
# Cause typique du « toujours rien » :
#   - HTML/JS encore anciens (pas d’onglets)
#   - OU routes-journal-trade-screens.js jamais copié à côté du require Node
#
# Sur le VPS (copier-coller tel quel) :
#   unset REF SHA BRANCH JOURNAL_SCREENS_REF
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/DEPLOY-JOURNAL-TRADE-SCREENS.sh" | bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
# Toujours tirer depuis main (ignore REF/SHA ambiants)
SCRIPT_REF="${JOURNAL_SCREENS_REF:-main}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${SCRIPT_REF}"

echo "======== DEPLOY JOURNAL TRADE SCREENS ($SCRIPT_REF) ========"

PM2_CWD="$(pm2 jlist 2>/dev/null | python3 -c '
import json,sys
try:
  apps=json.load(sys.stdin)
except Exception:
  apps=[]
for a in apps:
  if a.get("name")=="la-forge":
    print((a.get("pm2_env") or {}).get("pm_cwd") or "")
    break
' 2>/dev/null || true)"
if [[ -n "${PM2_CWD}" && -d "${PM2_CWD}" ]]; then
  echo "PM2 cwd la-forge: $PM2_CWD"
  APP_DIR="$PM2_CWD"
fi
echo "APP=$APP_DIR"

mkdir -p "$APP_DIR/public/js" "$APP_DIR/server-patches"
sudo mkdir -p /var/lib/torinvest/journal-trade-screens 2>/dev/null || mkdir -p /var/lib/torinvest/journal-trade-screens || true
sudo chown -R "${SUDO_USER:-$USER}:${SUDO_USER:-$USER}" /var/lib/torinvest/journal-trade-screens 2>/dev/null || true

pull() {
  local url="$1" dest="$2"
  echo "← $(basename "$dest")"
  curl -fsSL "$url" -o "$dest"
}

TMP="$(mktemp -d)"
pull "$RAW/deploy/vps/app-shells/journal.html" "$TMP/journal.html"
pull "$RAW/deploy/vps/app-shells/dashboard.html" "$TMP/dashboard.html"
pull "$RAW/la-forge/js/forge-journal.js" "$TMP/forge-journal.js"
pull "$RAW/la-forge/js/forge-journal-trade-screens.js" "$TMP/forge-journal-trade-screens.js"
pull "$RAW/deploy/vps/formation-server/routes-journal-trade-screens.js" "$TMP/routes-journal-trade-screens.js"
pull "$RAW/deploy/vps/formation-server/routes-journal-bridge.js" "$TMP/routes-journal-bridge.js"
pull "$RAW/deploy/vps/formation-server/routes-formation-auth.js" "$TMP/routes-formation-auth.js"

# Sanity des artefacts
grep -q 'journal-screens-bar' "$TMP/journal.html"
grep -q 'forge-journal.js?v=10' "$TMP/journal.html"
grep -q 'journal-screens-bar\|jts-dropzone' "$TMP/journal.html"
grep -q 'loadScreensList\|journal-trade-screens/ping' "$TMP/forge-journal.js"
grep -q 'showJournalWithScreens\|journal-screens-bar\|pendingFiles' "$TMP/forge-journal.js"
grep -q 'journal-trade-screens/ping' "$TMP/routes-journal-trade-screens.js"
grep -q 'createJournalTradeScreensRouter' "$TMP/routes-formation-auth.js"
grep -q 'forge-journal-trade-screens.js' "$TMP/routes-journal-bridge.js"

cp -f "$TMP/journal.html" "$APP_DIR/public/journal.html"
cp -f "$TMP/dashboard.html" "$APP_DIR/public/dashboard.html"
cp -f "$TMP/forge-journal.js" "$APP_DIR/public/js/forge-journal.js"
cp -f "$TMP/forge-journal-trade-screens.js" "$APP_DIR/public/js/forge-journal-trade-screens.js"
cp -f "$TMP/routes-journal-trade-screens.js" "$APP_DIR/server-patches/routes-journal-trade-screens.js"
cp -f "$TMP/routes-journal-bridge.js" "$APP_DIR/server-patches/routes-journal-bridge.js"
cp -f "$TMP/routes-formation-auth.js" "$APP_DIR/server-patches/routes-formation-auth.js"
# require("./routes-journal-trade-screens") depuis racine app
cp -f "$TMP/routes-journal-trade-screens.js" "$APP_DIR/routes-journal-trade-screens.js"
cp -f "$TMP/routes-formation-auth.js" "$APP_DIR/routes-formation-auth.js" 2>/dev/null || true

UPDATED=0
while IFS= read -r -d '' f; do
  dir="$(dirname "$f")"
  cp -f "$TMP/routes-journal-trade-screens.js" "$dir/routes-journal-trade-screens.js"
  cp -f "$TMP/routes-journal-bridge.js" "$dir/routes-journal-bridge.js"
  cp -f "$TMP/routes-formation-auth.js" "$dir/routes-formation-auth.js"
  echo "→ sync routes @ $dir/"
  UPDATED=$((UPDATED + 1))
done < <(find "$APP_DIR" -name 'routes-formation-auth.js' -print0 2>/dev/null || true)

while IFS= read -r -d '' f; do
  cp -f "$TMP/routes-journal-trade-screens.js" "$f"
  echo "→ overwrite $f"
  UPDATED=$((UPDATED + 1))
done < <(find "$APP_DIR" -name 'routes-journal-trade-screens.js' -print0 2>/dev/null || true)

echo "Copies mises à jour: $UPDATED"

BAD=0
while IFS= read -r -d '' f; do
  if ! grep -q 'journal-trade-screens/ping' "$f"; then
    echo "ERREUR: $f sans /ping"
    BAD=$((BAD + 1))
  fi
done < <(find "$APP_DIR" -name 'routes-journal-trade-screens.js' -print0 2>/dev/null || true)
if [[ "$BAD" -gt 0 ]]; then
  echo "Abort: $BAD fichier(s) routes encore anciens"
  exit 1
fi

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

# Soft-delete Node require cache: delete + restart
pm2 stop la-forge 2>/dev/null || true
sleep 1
pm2 restart la-forge --update-env 2>/dev/null || pm2 start la-forge 2>/dev/null || pm2 restart la-forge || pm2 restart all || true
sleep 2

echo ""
echo "=== Resolve module Node ==="
(
  cd "$APP_DIR"
  node -e '
    const fs=require("fs");
    const paths=[
      "./server-patches/routes-journal-trade-screens",
      "./routes-journal-trade-screens",
      "./server-patches/routes-formation-auth",
    ];
    for (const p of paths) {
      try {
        const r=require.resolve(p);
        const txt=fs.readFileSync(r,"utf8");
        const ok=txt.includes("journal-trade-screens/ping") || txt.includes("createJournalTradeScreensRouter");
        console.log(p, "→", r, "ok=", ok);
      } catch (e) {
        console.log(p, "→ MISSING");
      }
    }
  ' || true
)

echo ""
echo "=== Vérification API ==="
PING="$(curl -sS "http://127.0.0.1:3001/api/journal-trade-screens/ping" || true)"
echo "ping: $PING"
CODE="$(curl -sS -o /tmp/jts-ping.body -w "%{http_code}" "http://127.0.0.1:3001/api/journal-trade-screens/ping" || true)"
echo "GET /api/journal-trade-screens/ping → HTTP $CODE"
head -c 200 /tmp/jts-ping.body 2>/dev/null; echo

if [[ "$CODE" == "404" ]] || ! echo "$PING" | grep -q '"ok"\s*:\s*true\|"ok":true'; then
  echo ""
  echo "ÉCHEC: API journal-trade-screens absente (HTTP $CODE)."
  echo "Fichiers routes présents :"
  find "$APP_DIR" -name 'routes-journal-trade-screens.js' -print 2>/dev/null || true
  echo "Contenu require formation-auth :"
  grep -n "journal-trade-screens\|createJournalTradeScreens" \
    "$APP_DIR/server-patches/routes-formation-auth.js" "$APP_DIR/server.js" 2>/dev/null | head -30 || true
  echo "PM2 status:"
  pm2 describe la-forge 2>/dev/null | head -40 || pm2 list || true
  exit 1
fi

echo "OK — ping API monté."

# Sanity shell public — doit être la version SANS onglets séparés
grep -q 'journal-screens-bar' "$APP_DIR/public/journal.html"
grep -q 'forge-journal.js?v=10' "$APP_DIR/public/journal.html"
grep -q 'showJournalWithScreens\|journal-screens-bar' "$APP_DIR/public/js/forge-journal.js"
if grep -q 'journal-tabs\|Screenshots JPG/PNG' "$APP_DIR/public/journal.html"; then
  echo "ÉCHEC: ancienne UI à onglets encore présente dans journal.html"
  exit 1
fi

rm -rf "$TMP"
echo ""
echo "→ Hard refresh Ctrl+Shift+R (pas ?tab=screens) :"
echo "  https://app.torinvest-trading.com/journal.html"
echo "→ Attendu : panneau screens AU-DESSUS du Journal Pro (même page)"
echo "→ Si tu vois encore « Screenshots JPG/PNG » + « Journal Pro » = mauvais fichier / cache"
echo "======== DONE ========"
