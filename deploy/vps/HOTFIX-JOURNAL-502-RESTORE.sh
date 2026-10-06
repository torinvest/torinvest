#!/usr/bin/env bash
# HOTFIX — RESTORE app.* after CSP click hotfix corrupted server.js (502)
#
# Root cause (HOTFIX-JOURNAL-CLICK-CSP.sh):
#   python replace typo wrote invalid JS:
#     "script-src-attr": ["'unsafe-inline']"   ← missing quote before ]
#   instead of:
#     "script-src-attr": ["'unsafe-inline'"]
#   → SyntaxError on Node boot → pm2 dead → nginx 502 Bad Gateway
#
# This script:
#   1) repairs / restores server.js (node --check before restart)
#   2) redeploys journal bridge CSP override (safe click fix, no server.js mutate)
#   3) keeps screens inject HARD OFF
#   4) restarts pm2 + verifies login.html HTTP 200
#
# Sur le VPS, UNE commande :
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/cursor/journal-502-restore-b86b/deploy/vps/HOTFIX-JOURNAL-502-RESTORE.sh" | bash
set -euo pipefail

unset REF SHA BRANCH 2>/dev/null || true
BRANCH="cursor/journal-502-restore-b86b"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${BRANCH}"
APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"

PM2_CWD="$(pm2 jlist 2>/dev/null | python3 -c '
import json,sys
try: apps=json.load(sys.stdin)
except Exception: apps=[]
for a in apps:
  name=str(a.get("name") or "")
  if name in ("la-forge","formation","torinvest-formation","forge"):
    print((a.get("pm2_env") or {}).get("pm_cwd") or ""); break
' 2>/dev/null || true)"
[[ -n "${PM2_CWD}" && -d "${PM2_CWD}" ]] && APP_DIR="$PM2_CWD"

echo ""
echo "############################################################"
echo "#  HOTFIX 502 RESTORE — fix server.js SyntaxError + boot  #"
echo "#  branch: $BRANCH                                        #"
echo "############################################################"
echo "APP=$APP_DIR"

if [[ ! -d "$APP_DIR" ]]; then
  echo "ERREUR: APP_DIR introuvable: $APP_DIR"
  exit 1
fi

SERVER="$APP_DIR/server.js"
mkdir -p "$APP_DIR/public/js" "$APP_DIR/server-patches"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

ts="$(date +%Y%m%d%H%M%S)"
if [[ -f "$SERVER" ]]; then
  cp -f "$SERVER" "$SERVER.bak.502-restore.$ts"
  echo "→ Backup: $SERVER.bak.502-restore.$ts"
fi

# --- 1) Repair corrupted script-src-attr in server.js ---
echo "→ Réparation SyntaxError script-src-attr (CSP hotfix typo)…"
python3 - "$SERVER" <<'PY'
import pathlib, re, sys

p = pathlib.Path(sys.argv[1])
if not p.exists():
    print("WARN: server.js missing — skip syntax repair")
    sys.exit(0)

src = p.read_text(encoding="utf-8")
orig = src

# Exact corrupt form produced by HOTFIX-JOURNAL-CLICK-CSP.sh typo:
#   "script-src-attr": ["'unsafe-inline']"
# Must become:
#   "script-src-attr": ["'unsafe-inline'"]
corrupt = '"script-src-attr": ["\'unsafe-inline\']"'
fixed = '"script-src-attr": ["\'unsafe-inline\'"]'
if corrupt in src:
    src = src.replace(corrupt, fixed)
    print("FIXED: corrupt script-src-attr array (missing quote)")

# Broader repairs for near-miss corruptions
src = re.sub(
    r'"script-src-attr"\s*:\s*\["\'unsafe-inline\]"\s*',
    '"script-src-attr": ["\'unsafe-inline\'"]',
    src,
)
src = re.sub(
    r'"script-src-attr"\s*:\s*\["\'none\'"\]',
    '"script-src-attr": ["\'unsafe-inline\'"]',
    src,
)
# Helmet default string form
src = src.replace("script-src-attr 'none'", "script-src-attr 'unsafe-inline'")

if src != orig:
    p.write_text(src, encoding="utf-8")
    print("OK — server.js rewritten")
else:
    print("OK — no known corrupt script-src-attr literal (may already be fixed)")
PY

# If still broken, restore newest good .bak
if [[ -f "$SERVER" ]] && ! node --check "$SERVER" 2>"$TMP/check-err.txt"; then
  echo "WARN: server.js encore invalide après repair — essai rollback .bak"
  cat "$TMP/check-err.txt" || true
  RESTORED=0
  # Prefer pre-csp backups; skip our own just-created backup of the bad file
  while IFS= read -r bak; do
    [[ -z "$bak" ]] && continue
    case "$bak" in
      *.bak.502-restore.*) continue ;;
    esac
    if node --check "$bak" 2>/dev/null; then
      cp -f "$bak" "$SERVER"
      echo "→ Restauré depuis $bak"
      RESTORED=1
      break
    fi
  done < <(ls -t "$APP_DIR"/server.js.bak.* 2>/dev/null || true)

  if [[ "$RESTORED" -ne 1 ]]; then
    # Last resort: strip broken torinvest CSP patch blocks entirely
    echo "→ Strip blocs patch CSP torinvest cassés…"
    python3 - "$SERVER" <<'PY'
import pathlib, re, sys
p = pathlib.Path(sys.argv[1])
src = p.read_text(encoding="utf-8")
orig = src
# Remove marked CSP patch blocks (v3/v4)
for marker in (
    "/* torinvest-journal-csp */",
    "/* torinvest-csp-v4-tj-onclick */",
    "/* torinvest-csp-v3-youtube */",
):
    while marker in src:
        start = src.index(marker)
        # Find following try { ... } catch (...) { ... }
        after = src[start:]
        m = re.search(r"try\s*\{[\s\S]*?\}\s*catch\s*\([^)]*\)\s*\{[\s\S]*?\}\s*", after)
        if m:
            end = start + m.end()
            # Include marker lines before try
            src = src[:start] + src[end:]
        else:
            # Remove marker + next ~70 lines
            lines = src.splitlines(True)
            # find line index
            pos = 0
            line_i = 0
            for i, line in enumerate(lines):
                if pos <= start < pos + len(line):
                    line_i = i
                    break
                pos += len(line)
            del lines[line_i : line_i + 70]
            src = "".join(lines)
            break
# Nuke any remaining corrupt attr lines
src = re.sub(
    r'[ \t]*"script-src-attr"\s*:\s*\["\'unsafe-inline\]"\s*,?\n?',
    '        "script-src-attr": ["\'unsafe-inline\'"],\n',
    src,
)
if src != orig:
    p.write_text(src, encoding="utf-8")
    print("stripped/repaired CSP blocks")
else:
    print("strip: no change")
PY
  fi
fi

if [[ -f "$SERVER" ]]; then
  if ! node --check "$SERVER"; then
    echo "ÉCHEC: server.js syntaxe encore invalide — abort avant pm2 restart"
    node --check "$SERVER" 2>&1 || true
    exit 1
  fi
  echo "OK — node --check server.js"
fi

# --- 2) Redeploy bridge + screens routes (click fix via embed CSP override ONLY) ---
echo "→ Téléchargement bridge + trade-screens (inject HARD OFF, CSP override safe)…"
curl -fsSL "$RAW/deploy/vps/formation-server/routes-journal-bridge.js" -o "$TMP/bridge.js"
curl -fsSL "$RAW/deploy/vps/formation-server/routes-journal-trade-screens.js" -o "$TMP/routes.js"

grep -q 'applyJournalEmbedCsp' "$TMP/bridge.js" || {
  echo "ÉCHEC: bridge sans applyJournalEmbedCsp"
  exit 1
}
grep -q "script-src-attr 'unsafe-inline'" "$TMP/bridge.js" || {
  echo "ÉCHEC: bridge sans script-src-attr unsafe-inline"
  exit 1
}
grep -q 'injectHardOff\|forge-jts:injectHardOff' "$TMP/bridge.js" || {
  echo "ÉCHEC: bridge sans injectHardOff"
  exit 1
}
if grep -q '<script src="/js/forge-journal-trade-screens.js' "$TMP/bridge.js"; then
  echo "ÉCHEC: bridge contient encore un script tag trade-screens"
  exit 1
fi
node --check "$TMP/bridge.js"
node --check "$TMP/routes.js"

# Stub screens JS (hard off)
cat > "$TMP/js-stub.js" <<'STUB'
/**
 * STUB — forge-journal-trade-screens HARD OFF (502-restore keeps click via CSP override).
 */
(function () {
  "use strict";
  if (window.__forgeJournalTradeScreens) return;
  window.__forgeJournalTradeScreens = 1;
  window.__forgeJtsInjectDisabled = true;
  window.__forgeJtsInjectHardOff = true;
  window.__forgeJtsCspClickFix = true;
  window.__forgeJts502Restore = true;
})();
STUB

cp -f "$TMP/bridge.js" "$APP_DIR/server-patches/routes-journal-bridge.js"
cp -f "$TMP/routes.js" "$APP_DIR/server-patches/routes-journal-trade-screens.js"
cp -f "$TMP/routes.js" "$APP_DIR/routes-journal-trade-screens.js" 2>/dev/null || true
cp -f "$TMP/js-stub.js" "$APP_DIR/public/js/forge-journal-trade-screens.js"

while IFS= read -r -d '' f; do
  dir="$(dirname "$f")"
  cp -f "$TMP/routes.js" "$dir/routes-journal-trade-screens.js"
  cp -f "$TMP/bridge.js" "$dir/routes-journal-bridge.js"
  echo "  → bridge+routes @ $dir"
done < <(find "$APP_DIR" -name 'routes-formation-auth.js' -print0 2>/dev/null || true)

while IFS= read -r -d '' f; do
  cp -f "$TMP/js-stub.js" "$f"
done < <(find "$APP_DIR" -name 'forge-journal-trade-screens.js' -print0 2>/dev/null || true)

while IFS= read -r -d '' f; do
  cp -f "$TMP/bridge.js" "$f"
done < <(find "$APP_DIR" -name 'routes-journal-bridge.js' -print0 2>/dev/null || true)

while IFS= read -r -d '' f; do
  cp -f "$TMP/routes.js" "$f"
done < <(find "$APP_DIR" -name 'routes-journal-trade-screens.js' -print0 2>/dev/null || true)

# --- 3) Do NOT re-run the broken python force-replace. Optional safe helmet patch. ---
echo "→ Patch Helmet CSP v4 (safe) + node --check…"
if [[ -f "$SERVER" ]]; then
  curl -fsSL "$RAW/deploy/vps/patch-helmet-journal-frames.js" -o "$TMP/patch-helmet.js"
  # Ensure patcher source itself is valid
  node --check "$TMP/patch-helmet.js"
  # Backup before patch
  cp -f "$SERVER" "$SERVER.bak.pre-helmet.$ts"
  if node "$TMP/patch-helmet.js" "$APP_DIR"; then
    if ! node --check "$SERVER"; then
      echo "WARN: helmet patch a cassé server.js — rollback"
      cp -f "$SERVER.bak.pre-helmet.$ts" "$SERVER"
      node --check "$SERVER"
    else
      echo "OK — helmet patch + syntaxe"
    fi
  else
    echo "WARN: patch-helmet a échoué — bridge applyJournalEmbedCsp suffit pour le clic"
  fi
  # Final guard: never leave the corrupt literal that SyntaxError'd Node
  python3 - "$SERVER" <<'PY'
import pathlib, sys
src = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
corrupt = '"script-src-attr": ["\'unsafe-inline\']"'
if corrupt in src:
    print("ÉCHEC: corrupt literal encore présent:", corrupt)
    sys.exit(1)
print("OK — pas de literal script-src-attr corrompu")
PY
fi

# --- 4) Restart PM2 (targeted first; avoid blind restart-all until syntax OK) ---
echo "→ Restart PM2…"
restarted=0
for name in la-forge formation torinvest-formation forge; do
  if pm2 describe "$name" >/dev/null 2>&1; then
    pm2 restart "$name" --update-env || pm2 restart "$name" || true
    echo "  → restarted $name"
    restarted=1
  fi
done
if [[ "$restarted" -eq 0 ]]; then
  # Fallback: restart apps matching forge/formation
  pm2 jlist 2>/dev/null | python3 -c '
import json,sys,subprocess
try: apps=json.load(sys.stdin)
except Exception: apps=[]
for a in apps:
  n=str(a.get("name") or "")
  if any(k in n.lower() for k in ("forge","formation","torinvest")):
    print("restart", n)
    subprocess.call(["pm2","restart",n,"--update-env"])
' 2>/dev/null || pm2 restart all --update-env 2>/dev/null || pm2 restart all || true
fi

sleep 4
pm2 list || true

# --- 5) Verify ---
echo "→ Vérification locale…"
CODE_LOCAL="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 8 http://127.0.0.1:3001/login.html || echo 000)"
PING_LOCAL="$(curl -sS --connect-timeout 8 http://127.0.0.1:3001/api/journal-bridge/ping || true)"
SCREENS_PING="$(curl -sS --connect-timeout 8 http://127.0.0.1:3001/api/journal-trade-screens/ping || true)"
CODE_PUB="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 12 https://app.torinvest-trading.com/login.html || echo 000)"

echo "local login.html → HTTP $CODE_LOCAL"
echo "public login.html → HTTP $CODE_PUB"
echo "bridge ping → $PING_LOCAL"
echo "screens ping → $SCREENS_PING"

if [[ "$CODE_LOCAL" != "200" && "$CODE_LOCAL" != "304" ]]; then
  # Sometimes login is static via nginx only; try root API
  API_LOCAL="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 8 http://127.0.0.1:3001/api/me || echo 000)"
  echo "local /api/me → HTTP $API_LOCAL"
  if [[ "$API_LOCAL" == "000" || "$API_LOCAL" == "502" ]]; then
    echo "ÉCHEC: Node ne répond pas — pm2 logs:"
    pm2 logs --lines 40 --nostream 2>/dev/null | tail -50 || true
    exit 1
  fi
fi

if [[ "$CODE_PUB" != "200" && "$CODE_PUB" != "304" ]]; then
  echo "WARN: public login encore $CODE_PUB (nginx cache / DNS). Local Node OK si ping ci-dessus."
  # Still fail hard if local is also dead
  if [[ "$CODE_LOCAL" == "502" || "$CODE_LOCAL" == "000" ]]; then
    exit 1
  fi
fi

echo ""
echo "############################################################"
echo "#  ✅ SUCCESS — SITE RESTAURÉ (502 → up)                  #"
echo "#  click fix: applyJournalEmbedCsp (script-src-attr OK)   #"
echo "#  screens inject: HARD OFF                               #"
echo "############################################################"
echo ""
echo "Sur ton PC :"
echo "  1) Ouvre https://app.torinvest-trading.com/login.html → DOIT charger (plus de 502)"
echo "  2) Ctrl+Shift+R sur /journal.html → clic trade → détail OK"
echo "  3) curl -sS https://app.torinvest-trading.com/api/journal-bridge/ping"
echo "======== DONE ========"
