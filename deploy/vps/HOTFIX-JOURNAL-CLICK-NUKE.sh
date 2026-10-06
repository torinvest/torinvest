#!/usr/bin/env bash
# DEPRECATED (2026-10-06 audit) — DO NOT RUN.
# This script would OVERWRITE the nuclear v14 bridge (cspStrip + tradeRowObserver).
# Use ONLY: deploy/vps/HOTFIX-JOURNAL-CLICK-EVERYWHERE.sh (branch cursor/audit-journal-complet-691a).
# See: deploy/vps/AUDIT-JOURNAL-COMPLET.md
echo 'DEPRECATED: refuse to run. Use HOTFIX-JOURNAL-CLICK-EVERYWHERE.sh (v14).' >&2
exit 99

# HOTFIX — « TOUJOURS PAS CLIQUER UN TRADE → DÉTAIL » (NUKE / SAFE MODE)
#
# Constat prod: PR #180/#181 (fix2, ping v8, inject v10) ÉTAIENT déjà live
# et le clic trade→détail restait cassé. Donc détection isAddTradePage seule
# ne suffit pas / UI inject agressive encore trop présente.
#
# Nuke: SAFE MODE — sur liste/détail ZERO UI + ZERO styles inset:0.
# Sur « Ajouter un trade » : bouton explicite « Joindre un screen » avant
# tout panel/drawer/overlay. inject v=11, ping v9 + tradeClickNuke.
#
# Sur le VPS, tape exactement :
#   unset REF SHA BRANCH JOURNAL_SCREENS_REF SCRIPT_REF
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/cursor/journal-trade-click-nuke-691a/deploy/vps/HOTFIX-JOURNAL-CLICK-NUKE.sh" | bash
set -euo pipefail

unset REF SHA BRANCH JOURNAL_SCREENS_REF SCRIPT_REF 2>/dev/null || true
BRANCH="cursor/journal-trade-click-nuke-691a"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${BRANCH}"
APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
EXPECTED_INJECT="forge-journal-trade-screens.js?v=11"
EXPECTED_PING_VERSION='"version":9'

PM2_CWD="$(pm2 jlist 2>/dev/null | python3 -c '
import json,sys
try: apps=json.load(sys.stdin)
except Exception: apps=[]
for a in apps:
  if a.get("name")=="la-forge":
    print((a.get("pm2_env") or {}).get("pm_cwd") or ""); break
' 2>/dev/null || true)"
[[ -n "${PM2_CWD}" && -d "${PM2_CWD}" ]] && APP_DIR="$PM2_CWD"

echo "======== HOTFIX CLICK NUKE / SAFE MODE ($BRANCH) ========"
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
grep -q 'tradeClickNuke' "$TMP/js.js" || {
  echo "ÉCHEC: tradeClickNuke manquant dans le client"
  exit 1
}
grep -q 'Joindre un screen' "$TMP/js.js" || {
  echo "ÉCHEC: bouton SAFE MODE « Joindre un screen » manquant"
  exit 1
}
grep -q 'shouldStayCompletelyOff\|nukeForgeArtifacts\|mountOptInButton' "$TMP/js.js" || {
  echo "ÉCHEC: SAFE MODE helpers manquants"
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
if "tradeClickNuke" not in src:
    print("ÉCHEC: tradeClickNuke flag manquant")
    sys.exit(1)
if "shouldStayCompletelyOff" not in src:
    print("ÉCHEC: shouldStayCompletelyOff manquant")
    sys.exit(1)
if "Joindre un screen" not in src:
    print("ÉCHEC: opt-in SAFE MODE manquant")
    sys.exit(1)
# boot must NOT call mountNav/ensureStyles before the off-switch
if not re.search(r'if\s*\(\s*shouldStayCompletelyOff\s*\(\s*\)\s*\)', src):
    print("ÉCHEC: boot sans hard-kill shouldStayCompletelyOff")
    sys.exit(1)
print("OK client: click-nuke SAFE MODE hardening")
PY

grep -q "$EXPECTED_INJECT" "$TMP/bridge.js" || {
  echo "ÉCHEC: bridge sans $EXPECTED_INJECT"
  exit 1
}
grep -q 'tradeClickNuke: true' "$TMP/routes.js" || {
  echo "ÉCHEC: ping tradeClickNuke manquant"
  exit 1
}
grep -q 'version: 9' "$TMP/routes.js" || {
  echo "ÉCHEC: ping version 9 manquant"
  exit 1
}
grep -q 'safeMode: true' "$TMP/routes.js" || {
  echo "ÉCHEC: ping safeMode manquant"
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
echo "$PING" | grep -q 'tradeClickNuke' || {
  echo "ÉCHEC: ping sans tradeClickNuke — mauvais routes déployés?"
  exit 1
}
echo "$PING" | grep -q '"version":9\|"version": 9' || {
  echo "ÉCHEC: ping version != 9 ($PING)"
  exit 1
}
echo "$PING" | grep -q 'safeMode' || {
  echo "ÉCHEC: ping sans safeMode"
  exit 1
}

# Verify public JS got the new flag (best-effort local)
if [[ -f "$APP_DIR/public/js/forge-journal-trade-screens.js" ]]; then
  grep -q 'tradeClickNuke' "$APP_DIR/public/js/forge-journal-trade-screens.js" || {
    echo "ÉCHEC: public JS sans tradeClickNuke"
    exit 1
  }
  grep -q 'Joindre un screen' "$APP_DIR/public/js/forge-journal-trade-screens.js" || {
    echo "ÉCHEC: public JS sans opt-in SAFE MODE"
    exit 1
  }
fi

echo ""
echo "OK — Click→détail NUKE déployé (inject v=11, ping v9, tradeClickNuke, SAFE MODE)."
echo "→ Sur ton PC : Ctrl+Shift+R sur le journal, puis clique un trade → détail lecture"
echo "→ Screens: seulement sur « Ajouter un trade » → bouton « Joindre un screen »"
echo "→ Console iframe: window.__forgeJtsTradeClickNuke === true"
echo "======== DONE ========"
