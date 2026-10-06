#!/usr/bin/env bash
# DEPRECATED (2026-10-06 audit) — DO NOT RUN.
# This script would OVERWRITE the nuclear v14 bridge (cspStrip + tradeRowObserver).
# Use ONLY: deploy/vps/HOTFIX-JOURNAL-CLICK-EVERYWHERE.sh (branch cursor/audit-journal-complet-691a).
# See: deploy/vps/AUDIT-JOURNAL-COMPLET.md
echo 'DEPRECATED: refuse to run. Use HOTFIX-JOURNAL-CLICK-EVERYWHERE.sh (v14).' >&2
exit 99

# HOTFIX — ROOT CAUSE: Helmet CSP script-src-attr 'none' bloque onclick TJ
#
# Preuve live (avant fix, 2026-10-06):
#   ping trade-screens = version:9 (SAFE MODE) — PR #183 JAMAIS déployé
#   bridge ping = sans injectDisabled/version 10
#   journal-embed CSP = ...;script-src-attr 'none';...
#   TJ Pro trade rows = onclick="openTrade(...)" (fixture + radar UI)
#   Radar upstream = PAS de CSP → clic OK hors proxy
#
# Donc #180–#182 (heuristiques screens) ne pouvaient PAS guérir le clic.
# Fix: CSP journal-embed avec script-src-attr 'unsafe-inline' + inject screens HARD OFF.
#
# Sur le VPS, UNE commande :
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/cursor/journal-click-rootcause-691a/deploy/vps/HOTFIX-JOURNAL-CLICK-CSP.sh" | bash
set -euo pipefail

unset REF SHA BRANCH JOURNAL_SCREENS_REF SCRIPT_REF 2>/dev/null || true
BRANCH="cursor/journal-click-rootcause-691a"
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
echo "#  HOTFIX CLICK ROOTCAUSE — CSP onclick + inject HARD OFF #"
echo "#  branch: $BRANCH                                        #"
echo "############################################################"
echo "APP=$APP_DIR"
mkdir -p "$APP_DIR/public/js" "$APP_DIR/server-patches"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "→ Téléchargement bridge + routes + helmet patch…"
curl -fsSL "$RAW/deploy/vps/formation-server/routes-journal-bridge.js" -o "$TMP/bridge.js"
curl -fsSL "$RAW/deploy/vps/formation-server/routes-journal-trade-screens.js" -o "$TMP/routes.js"
curl -fsSL "$RAW/deploy/vps/patch-helmet-journal-frames.js" -o "$TMP/patch-helmet.js"
curl -fsSL "$RAW/la-forge/js/forge-journal.js" -o "$TMP/forge-journal.js" 2>/dev/null || true

grep -q "script-src-attr 'unsafe-inline'" "$TMP/bridge.js" || {
  echo "ÉCHEC: bridge sans script-src-attr unsafe-inline"
  exit 1
}
grep -q 'applyJournalEmbedCsp' "$TMP/bridge.js" || {
  echo "ÉCHEC: bridge sans applyJournalEmbedCsp"
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
grep -q 'version: 11' "$TMP/bridge.js" || {
  echo "ÉCHEC: bridge ping version != 11"
  exit 1
}
grep -q 'cspClickFix: true' "$TMP/bridge.js" || {
  echo "ÉCHEC: bridge sans cspClickFix"
  exit 1
}
grep -q 'version: 11' "$TMP/routes.js" || {
  echo "ÉCHEC: routes ping version != 11"
  exit 1
}
grep -q "script-src-attr.*unsafe-inline\|'unsafe-inline'" "$TMP/patch-helmet.js" || {
  echo "ÉCHEC: helmet patch sans script-src-attr unsafe-inline"
  exit 1
}
if grep -q "\"script-src-attr\": \[\"'none'\"\]" "$TMP/patch-helmet.js"; then
  echo "ÉCHEC: helmet patch a encore script-src-attr none"
  exit 1
fi

# Stub no-op if anything still loads the screens JS
cat > "$TMP/js-stub.js" <<'STUB'
/**
 * STUB — forge-journal-trade-screens HARD OFF (cspClickFix v11).
 */
(function () {
  "use strict";
  if (window.__forgeJournalTradeScreens) return;
  window.__forgeJournalTradeScreens = 1;
  window.__forgeJtsInjectDisabled = true;
  window.__forgeJtsInjectHardOff = true;
  window.__forgeJtsCspClickFix = true;
})();
STUB

echo "→ Écriture fichiers…"
cp -f "$TMP/bridge.js" "$APP_DIR/server-patches/routes-journal-bridge.js"
cp -f "$TMP/routes.js" "$APP_DIR/server-patches/routes-journal-trade-screens.js"
cp -f "$TMP/routes.js" "$APP_DIR/routes-journal-trade-screens.js" 2>/dev/null || true
cp -f "$TMP/js-stub.js" "$APP_DIR/public/js/forge-journal-trade-screens.js"
if [[ -f "$TMP/forge-journal.js" ]]; then
  cp -f "$TMP/forge-journal.js" "$APP_DIR/public/js/forge-journal.js" 2>/dev/null || true
fi

while IFS= read -r -d '' f; do
  dir="$(dirname "$f")"
  cp -f "$TMP/routes.js" "$dir/routes-journal-trade-screens.js"
  cp -f "$TMP/bridge.js" "$dir/routes-journal-bridge.js"
  echo "  → bridge+routes @ $dir"
done < <(find "$APP_DIR" -name 'routes-formation-auth.js' -print0 2>/dev/null || true)

while IFS= read -r -d '' f; do
  cp -f "$TMP/js-stub.js" "$f"
  echo "  → stub JS @ $f"
done < <(find "$APP_DIR" -name 'forge-journal-trade-screens.js' -print0 2>/dev/null || true)

while IFS= read -r -d '' f; do
  cp -f "$TMP/bridge.js" "$f"
  echo "  → bridge overwrite @ $f"
done < <(find "$APP_DIR" -name 'routes-journal-bridge.js' -print0 2>/dev/null || true)

while IFS= read -r -d '' f; do
  cp -f "$TMP/routes.js" "$f"
  echo "  → routes overwrite @ $f"
done < <(find "$APP_DIR" -name 'routes-journal-trade-screens.js' -print0 2>/dev/null || true)

echo "→ Patch Helmet CSP v4 (script-src-attr unsafe-inline)…"
if [[ -f "$APP_DIR/server.js" ]]; then
  # Force re-apply: strip old version markers so patcher upgrades v3→v4
  python3 - "$APP_DIR/server.js" <<'PY'
import pathlib, re, sys
p = pathlib.Path(sys.argv[1])
src = p.read_text(encoding="utf-8")
# Allow patcher to run by removing v3/v4 markers only if we will re-inject via node
# Leave file as-is; node patcher handles upgrade.
print("server.js bytes", len(src))
PY
  node "$TMP/patch-helmet.js" "$APP_DIR" || {
    echo "WARN: patch-helmet a échoué — le bridge applyJournalEmbedCsp reste la protection principale"
  }
  # Verify server.js no longer hardcodes script-src-attr none in torinvest patch
  if grep -n "script-src-attr" "$APP_DIR/server.js" 2>/dev/null | head -5; then
    if grep -q "script-src-attr\": \[\"'none'\"\]\|script-src-attr.*'none'" "$APP_DIR/server.js"; then
      echo "→ Remplacement forcé script-src-attr none → unsafe-inline dans server.js"
      python3 - "$APP_DIR/server.js" <<'PY'
import pathlib, sys, re
p = pathlib.Path(sys.argv[1])
src = p.read_text(encoding="utf-8")
# CRITICAL: closing quote MUST be before ]  →  ["'unsafe-inline'"]
# (a prior typo wrote ["'unsafe-inline']" and SyntaxError'd server.js → 502)
fixed = '"script-src-attr": ["\'unsafe-inline\'"]'
src2 = src.replace('"script-src-attr": ["\'none\'"]', fixed)
src2 = src2.replace("\"script-src-attr\": [\"'none'\"]", fixed)
# Also heal the corrupt form if re-running after a bad deploy
src2 = src2.replace('"script-src-attr": ["\'unsafe-inline\']"', fixed)
src2 = re.sub(r"script-src-attr 'none'", "script-src-attr 'unsafe-inline'", src2)
if src2 != src:
    p.write_text(src2, encoding="utf-8")
    print("patched server.js script-src-attr")
else:
    print("no literal none left or already fixed")
PY
      # Never leave a SyntaxError behind
      if ! node --check "$APP_DIR/server.js"; then
        echo "ÉCHEC: server.js syntaxe invalide après replace — abort"
        exit 1
      fi
    fi
  fi
else
  echo "WARN: $APP_DIR/server.js introuvable — skip helmet patch fichier"
fi

find /var/cache/nginx -type f \( -name '*forge-journal*' -o -name '*journal*' \) -delete 2>/dev/null || true

# Guard: never restart Node on a SyntaxError (would prolong 502)
if [[ -f "$APP_DIR/server.js" ]] && ! node --check "$APP_DIR/server.js"; then
  echo "ÉCHEC: server.js SyntaxError — abort pm2 restart (évite 502)"
  node --check "$APP_DIR/server.js" 2>&1 || true
  exit 1
fi

echo "→ Restart PM2…"
pm2 restart la-forge --update-env 2>/dev/null || true
pm2 restart formation --update-env 2>/dev/null || true
pm2 restart torinvest-formation --update-env 2>/dev/null || true
pm2 jlist 2>/dev/null | python3 -c '
import json,sys,subprocess
try: apps=json.load(sys.stdin)
except Exception: apps=[]
for a in apps:
  n=str(a.get("name") or "")
  if any(k in n.lower() for k in ("forge","formation","journal","torinvest")):
    print(n)
    subprocess.call(["pm2","restart",n,"--update-env"])
' 2>/dev/null || true
# NOTE: do NOT pm2 restart all — that can flap unrelated apps during a hotfix

sleep 3

PING="$(curl -sS http://127.0.0.1:3001/api/journal-trade-screens/ping || true)"
BRIDGE_PING="$(curl -sS http://127.0.0.1:3001/api/journal-bridge/ping || true)"
EMBED_HDR="$(curl -sS -D- -o /tmp/jts-embed-body.html http://127.0.0.1:3001/journal-embed/ 2>/dev/null || true)"

echo ""
echo "======== PING trade-screens ========"
echo "$PING"
echo "======== PING bridge ========"
echo "$BRIDGE_PING"
echo "======== journal-embed CSP (headers) ========"
echo "$EMBED_HDR" | tr -d '\r' | grep -i 'content-security-policy\|^HTTP' || true
echo "======== embed body inject check ========"
if grep -q 'forge-journal-trade-screens\.js' /tmp/jts-embed-body.html 2>/dev/null; then
  echo "ÉCHEC: embed HTML contient encore forge-journal-trade-screens.js"
  exit 1
fi
echo "OK: pas de script trade-screens dans la réponse embed"
if grep -q 'forge-jts:injectHardOff\|injectHardOff\|Session La Forge' /tmp/jts-embed-body.html 2>/dev/null; then
  echo "OK: corps embed (403 gate ou commentaire hard-off) présent"
fi

echo "$PING" | grep -q '"ok"' || { echo "ÉCHEC ping"; exit 1; }
echo "$PING" | grep -q '"version":11\|"version": 11' || {
  echo "ÉCHEC: ping version != 11 ($PING)"
  exit 1
}
echo "$PING" | grep -q 'cspClickFix' || {
  echo "ÉCHEC: ping sans cspClickFix"
  exit 1
}
echo "$PING" | grep -q 'injectHardOff\|injectDisabled' || {
  echo "ÉCHEC: ping sans injectHardOff/injectDisabled"
  exit 1
}

echo "$BRIDGE_PING" | grep -q '"version":11\|"version": 11' || {
  echo "ÉCHEC: bridge ping version != 11"
  exit 1
}
echo "$BRIDGE_PING" | grep -q 'cspClickFix' || {
  echo "ÉCHEC: bridge ping sans cspClickFix"
  exit 1
}

CSP_LINE="$(echo "$EMBED_HDR" | tr -d '\r' | grep -i '^content-security-policy:' || true)"
if [[ -z "$CSP_LINE" ]]; then
  echo "WARN: pas de CSP sur journal-embed (peut être OK si complètement retiré)"
else
  echo "$CSP_LINE" | grep -qi "script-src-attr 'none'" && {
    echo "ÉCHEC: journal-embed CSP a encore script-src-attr 'none'"
    echo "$CSP_LINE"
    exit 1
  }
  echo "$CSP_LINE" | grep -qi "script-src-attr 'unsafe-inline'" || {
    echo "ÉCHEC: journal-embed CSP sans script-src-attr 'unsafe-inline'"
    echo "$CSP_LINE"
    exit 1
  }
  echo "OK CSP: script-src-attr unsafe-inline (onclick TJ autorisé)"
fi

echo ""
echo "############################################################"
echo "#  ✅ SUCCESS — CLICK ROOTCAUSE v11 (CSP) DÉPLOYÉ         #"
echo "#  cspClickFix + injectHardOff + version:11               #"
echo "############################################################"
echo ""
echo "Sur ton PC :"
echo "  1) Ctrl+Shift+R sur https://app.torinvest-trading.com/journal.html"
echo "  2) Clique un trade → détail / lecture DOIT s'ouvrir (onclick TJ natif)"
echo "  3) curl -sS https://app.torinvest-trading.com/api/journal-trade-screens/ping"
echo "     → version:11, cspClickFix:true, injectHardOff:true"
echo "  4) curl -sSI https://app.torinvest-trading.com/journal-embed/ | grep -i content-security"
echo "     → script-src-attr 'unsafe-inline' (PAS 'none')"
echo "======== DONE ========"
