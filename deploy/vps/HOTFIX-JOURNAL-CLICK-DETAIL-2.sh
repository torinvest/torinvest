#!/usr/bin/env bash
# DEPRECATED — DO NOT RUN.
# Use ONLY: HOTFIX-JOURNAL-CLICK-EVERYWHERE.sh on branch cursor/journal-nav-fix-691a (v15 navFix).
# Old v13/v14 hotfixes break menu nav (Calendrier/Historique → site principal).
echo 'DEPRECATED: refuse to run. Use HOTFIX-JOURNAL-CLICK-EVERYWHERE.sh (v15 navFix, branch cursor/journal-nav-fix-691a).' >&2
exit 99

# HOTFIX — « TOUJOURS PAS CLIQUER UN TRADE → DÉTAIL » (fix2 après PR #180)
#
# Cause résiduelle: isAddTradePage() pouvait encore matcher liste/détail
# (URL seule, form.innerText + headers, <3 lignes, Enregistrer d’édition).
# Overlays fermés restaient en DOM (inset:0). Fix2: DEFAULT OFF, contrôles
# éditables obligatoires + heading/Ajouter/url, overlays retirés du DOM,
# inject v=10, ping v8 + tradeClickFix2.
#
# Sur le VPS, tape exactement :
#   unset REF SHA BRANCH JOURNAL_SCREENS_REF
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/cursor/journal-click-detail-fix2-691a/deploy/vps/HOTFIX-JOURNAL-CLICK-DETAIL-2.sh" | bash
set -euo pipefail

unset REF SHA BRANCH JOURNAL_SCREENS_REF SCRIPT_REF 2>/dev/null || true
BRANCH="cursor/journal-click-detail-fix2-691a"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${BRANCH}"
APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
EXPECTED_INJECT="forge-journal-trade-screens.js?v=10"
EXPECTED_PING_VERSION='"version":8'

PM2_CWD="$(pm2 jlist 2>/dev/null | python3 -c '
import json,sys
try: apps=json.load(sys.stdin)
except Exception: apps=[]
for a in apps:
  if a.get("name")=="la-forge":
    print((a.get("pm2_env") or {}).get("pm_cwd") or ""); break
' 2>/dev/null || true)"
[[ -n "${PM2_CWD}" && -d "${PM2_CWD}" ]] && APP_DIR="$PM2_CWD"

echo "======== HOTFIX CLICK DETAIL FIX2 ($BRANCH) ========"
echo "APP=$APP_DIR"
mkdir -p "$APP_DIR/public/js" "$APP_DIR/server-patches"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

curl -fsSL "$RAW/la-forge/js/forge-journal-trade-screens.js" -o "$TMP/js.js"
curl -fsSL "$RAW/deploy/vps/formation-server/routes-journal-bridge.js" -o "$TMP/bridge.js"
curl -fsSL "$RAW/deploy/vps/formation-server/routes-journal-trade-screens.js" -o "$TMP/routes.js"
curl -fsSL "$RAW/la-forge/js/forge-journal.js" -o "$TMP/forge-journal.js" 2>/dev/null || true

grep -q 'Effacer' "$TMP/js.js" || { echo "ÉCHEC: JS sans bouton Effacer"; exit 1; }
grep -q 'deleteScreen' "$TMP/js.js" || { echo "ÉCHEC: deleteScreen manquant"; exit 1; }
grep -q 'tradeClickFix2' "$TMP/js.js" || {
  echo "ÉCHEC: tradeClickFix2 manquant dans le client"
  exit 1
}
grep -q 'neutralizeNonAddPage\|formHasEntryField\|looksLikeTradeDetailPage' "$TMP/js.js" || {
  echo "ÉCHEC: détection stricte fix2 manquante"
  exit 1
}
grep -q 'pointer-events:none' "$TMP/js.js" || {
  echo "ÉCHEC: pointer-events:none overlays manquant"
  exit 1
}
python3 - "$TMP/js.js" <<'PY'
import re, sys
src = open(sys.argv[1], encoding="utf-8").read()
bad = re.search(
    r'addEventListener\(\s*["\']click["\']\s*,\s*function\s*\([^)]*\)\s*\{[^}]*stopPropagation\(\)[^}]*\}\s*,\s*true\s*\)',
    src,
)
if bad:
    print("ÉCHEC: capture-phase click stopPropagation détecté")
    sys.exit(1)
if re.search(
    r'panel\.addEventListener\(\s*["\']click["\']\s*,\s*function\s*\([^)]*\)\s*\{\s*[^}]*stopPropagation',
    src,
):
    print("ÉCHEC: panel click stopPropagation blanket encore présent")
    sys.exit(1)
if "document.addEventListener" in src and re.search(
    r'document\.addEventListener\(\s*["\']change["\']', src
):
    print("ÉCHEC: document-level change listener encore présent")
    sys.exit(1)
if "document.addEventListener" in src and re.search(
    r'document\.addEventListener\(\s*["\']click["\']', src
):
    print("ÉCHEC: document-level click listener encore présent")
    sys.exit(1)
# URL alone must NOT return true — look for early return on qs without form checks nearby
if re.search(
    r'if\s*\(\s*/add\[_-\]\?trade[^/]*/i\.test\(qs\)\s*\)\s*\{[^}]*return true',
    src,
):
    print("ÉCHEC: URL-only early return true encore présent (#180 gap)")
    sys.exit(1)
if "tradeClickFix2" not in src:
    print("ÉCHEC: tradeClickFix2 flag manquant")
    sys.exit(1)
if "removeChild" not in src and ".remove()" not in src:
    print("ÉCHEC: overlay/drawer DOM removal manquant")
    sys.exit(1)
print("OK client: click-detail fix2 hardening")
PY

grep -q "$EXPECTED_INJECT" "$TMP/bridge.js" || {
  echo "ÉCHEC: bridge sans $EXPECTED_INJECT"
  exit 1
}
grep -q 'tradeClickFix2: true' "$TMP/routes.js" || {
  echo "ÉCHEC: ping tradeClickFix2 manquant"
  exit 1
}
grep -q 'version: 8' "$TMP/routes.js" || {
  echo "ÉCHEC: ping version 8 manquant"
  exit 1
}
grep -q 'clickDetailFix: true' "$TMP/routes.js" || {
  echo "ÉCHEC: ping clickDetailFix manquant"
  exit 1
}
grep -q 'deleteFix: true' "$TMP/routes.js" || {
  echo "ÉCHEC: ping deleteFix manquant"
  exit 1
}
grep -q 'images/:imageId/delete' "$TMP/routes.js" || {
  echo "ÉCHEC: route POST .../delete manquante"
  exit 1
}

cp -f "$TMP/js.js" "$APP_DIR/public/js/forge-journal-trade-screens.js"
cp -f "$TMP/bridge.js" "$APP_DIR/server-patches/routes-journal-bridge.js"
cp -f "$TMP/routes.js" "$APP_DIR/server-patches/routes-journal-trade-screens.js"
cp -f "$TMP/routes.js" "$APP_DIR/routes-journal-trade-screens.js" 2>/dev/null || true
if [[ -f "$TMP/forge-journal.js" ]]; then
  cp -f "$TMP/forge-journal.js" "$APP_DIR/public/js/forge-journal.js" 2>/dev/null || true
fi

while IFS= read -r -d '' f; do
  dir="$(dirname "$f")"
  cp -f "$TMP/routes.js" "$dir/routes-journal-trade-screens.js"
  cp -f "$TMP/bridge.js" "$dir/routes-journal-bridge.js"
done < <(find "$APP_DIR" -name 'routes-formation-auth.js' -print0 2>/dev/null || true)

while IFS= read -r -d '' f; do
  cp -f "$TMP/js.js" "$f"
done < <(find "$APP_DIR" -name 'forge-journal-trade-screens.js' -print0 2>/dev/null || true)

# Bust any nginx/proxy file caches if present
find /var/cache/nginx -type f -name '*forge-journal*' -delete 2>/dev/null || true

pm2 restart la-forge --update-env 2>/dev/null || pm2 restart la-forge || true
sleep 2
PING="$(curl -sS http://127.0.0.1:3001/api/journal-trade-screens/ping || true)"
echo "ping: $PING"
echo "$PING" | grep -q '"ok"' || { echo "ÉCHEC ping"; exit 1; }
echo "$PING" | grep -q 'tradeClickFix2' || {
  echo "ÉCHEC: ping sans tradeClickFix2 — mauvais routes déployés?"
  exit 1
}
echo "$PING" | grep -q '"version":8\|"version": 8' || {
  echo "ÉCHEC: ping version != 8 ($PING)"
  exit 1
}

# Verify public JS got the new flag (best-effort local)
if [[ -f "$APP_DIR/public/js/forge-journal-trade-screens.js" ]]; then
  grep -q 'tradeClickFix2' "$APP_DIR/public/js/forge-journal-trade-screens.js" || {
    echo "ÉCHEC: public JS sans tradeClickFix2"
    exit 1
  }
fi

echo ""
echo "OK — Click→détail FIX2 déployé (inject v=10, ping v8, tradeClickFix2)."
echo "→ Sur ton PC : Ctrl+Shift+R sur le journal, puis clique un trade → détail lecture"
echo "→ Console iframe: window.__forgeJtsClickFix2 === true"
echo "======== DONE ========"
