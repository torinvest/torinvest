#!/usr/bin/env bash
# HOTFIX — RESTAURER LE CLIC TRADE → LECTURE / DÉTAIL
#
# Constat prod (2026-10-06): PR #182 SAFE MODE (ping v9, inject v11, tradeClickNuke)
# ÉTAIT déjà live, et le clic trade→détail restait CASSÉ.
# Donc le script injecté n'est PAS assez sûr : on COUPE l'inject screens
# entièrement (défaut JOURNAL_TRADE_SCREENS non défini / != 1).
#
# Ping attendu après: version 10 + injectDisabled:true + clickRestore:true
# Bridge n'injecte PLUS forge-journal-trade-screens.js tant que
# JOURNAL_TRADE_SCREENS=1 n'est pas posé dans l'env pm2.
#
# Sur le VPS, tape EXACTEMENT (une seule commande, ne pas sourcer / ne pas unset après) :
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/cursor/journal-click-restore-691a/deploy/vps/HOTFIX-JOURNAL-CLICK-RESTORE.sh" | bash
set -euo pipefail

unset REF SHA BRANCH JOURNAL_SCREENS_REF SCRIPT_REF 2>/dev/null || true
BRANCH="cursor/journal-click-restore-691a"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${BRANCH}"
APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
EXPECTED_PING_VERSION='"version":10'
EXPECTED_INJECT_DISABLED='"injectDisabled":true'
# Bridge must NOT inject the screens script by default
FORBIDDEN_INJECT_DEFAULT='forge-journal-trade-screens.js?v='

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
echo "#  HOTFIX CLICK RESTORE — inject screens DÉSACTIVÉ (v10)  #"
echo "#  branch: $BRANCH                                        #"
echo "############################################################"
echo "APP=$APP_DIR"
mkdir -p "$APP_DIR/public/js" "$APP_DIR/server-patches"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "→ Téléchargement bridge + routes (inject OFF)…"
curl -fsSL "$RAW/deploy/vps/formation-server/routes-journal-bridge.js" -o "$TMP/bridge.js"
curl -fsSL "$RAW/deploy/vps/formation-server/routes-journal-trade-screens.js" -o "$TMP/routes.js"
curl -fsSL "$RAW/la-forge/js/forge-journal.js" -o "$TMP/forge-journal.js" 2>/dev/null || true
# Keep a stub JS that does NOTHING (in case an old HTML still references it)
curl -fsSL "$RAW/la-forge/js/forge-journal-trade-screens.js" -o "$TMP/js-full.js" 2>/dev/null || true

grep -q 'injectDisabled' "$TMP/bridge.js" || {
  echo "ÉCHEC: bridge sans injectDisabled / click restore"
  exit 1
}
grep -q 'tradeScreensInjectEnabled\|JOURNAL_TRADE_SCREENS' "$TMP/bridge.js" || {
  echo "ÉCHEC: bridge sans feature flag JOURNAL_TRADE_SCREENS"
  exit 1
}
grep -q 'forge-jts:injectDisabled clickRestore v10\|JOURNAL_TRADE_SCREENS' "$TMP/bridge.js" || {
  echo "ÉCHEC: bridge sans marqueur inject disabled"
  exit 1
}
# Default path must NOT emit the script tag unconditionally
if grep -q "const screens =" "$TMP/bridge.js"; then
  :
fi
python3 - "$TMP/bridge.js" <<'PY'
import sys
src = open(sys.argv[1], encoding="utf-8").read()
# Must gate inject behind env helper
if "tradeScreensInjectEnabled" not in src and "JOURNAL_TRADE_SCREENS" not in src:
    print("ÉCHEC: pas de gate JOURNAL_TRADE_SCREENS")
    sys.exit(1)
# Unconditional old inject (v11 string alone as assignment) is forbidden
if "const screens =\n    '<script src=\"/js/forge-journal-trade-screens.js" in src:
    print("ÉCHEC: inject encore inconditionnel")
    sys.exit(1)
if "forge-jts:injectDisabled clickRestore v10" not in src:
    print("ÉCHEC: commentaire injectDisabled manquant")
    sys.exit(1)
print("OK bridge: inject gated OFF by default")
PY

grep -q 'version: 10' "$TMP/routes.js" || {
  echo "ÉCHEC: ping version 10 manquant dans routes"
  exit 1
}
grep -q 'injectDisabled' "$TMP/routes.js" || {
  echo "ÉCHEC: ping injectDisabled manquant"
  exit 1
}
grep -q 'clickRestore: true' "$TMP/routes.js" || {
  echo "ÉCHEC: ping clickRestore manquant"
  exit 1
}

# Neutral stub: if any stale HTML still loads the script, it must no-op hard
cat > "$TMP/js-stub.js" <<'STUB'
/**
 * STUB — forge-journal-trade-screens DISABLED (click restore v10).
 * Re-enable only by deploying full JS + JOURNAL_TRADE_SCREENS=1.
 */
(function () {
  "use strict";
  if (window.__forgeJournalTradeScreens) return;
  window.__forgeJournalTradeScreens = 1;
  window.__forgeJtsInjectDisabled = true;
  window.__forgeJtsClickRestore = true;
  try {
    var kill = [
      "forge-jts-style",
      "forge-jts-panel",
      "forge-jts-nav",
      "forge-jts-optin",
      "forge-jts-drawer",
      "forge-jts-overlay",
    ];
    for (var i = 0; i < kill.length; i++) {
      var el = document.getElementById(kill[i]);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }
  } catch (_) {}
})();
STUB

echo "→ Écriture fichiers (tous les chemins connus)…"
cp -f "$TMP/bridge.js" "$APP_DIR/server-patches/routes-journal-bridge.js"
cp -f "$TMP/routes.js" "$APP_DIR/server-patches/routes-journal-trade-screens.js"
cp -f "$TMP/routes.js" "$APP_DIR/routes-journal-trade-screens.js" 2>/dev/null || true
cp -f "$TMP/js-stub.js" "$APP_DIR/public/js/forge-journal-trade-screens.js"
if [[ -f "$TMP/forge-journal.js" ]]; then
  cp -f "$TMP/forge-journal.js" "$APP_DIR/public/js/forge-journal.js" 2>/dev/null || true
fi

# Mirror next to every routes-formation-auth.js (historical deploy paths)
while IFS= read -r -d '' f; do
  dir="$(dirname "$f")"
  cp -f "$TMP/routes.js" "$dir/routes-journal-trade-screens.js"
  cp -f "$TMP/bridge.js" "$dir/routes-journal-bridge.js"
  echo "  → bridge+routes @ $dir"
done < <(find "$APP_DIR" -name 'routes-formation-auth.js' -print0 2>/dev/null || true)

# Overwrite EVERY copy of the client JS (including nested public/)
while IFS= read -r -d '' f; do
  cp -f "$TMP/js-stub.js" "$f"
  echo "  → stub JS @ $f"
done < <(find "$APP_DIR" -name 'forge-journal-trade-screens.js' -print0 2>/dev/null || true)

# Also copy bridge into any server-patches duplicates
while IFS= read -r -d '' f; do
  cp -f "$TMP/bridge.js" "$f"
  echo "  → bridge overwrite @ $f"
done < <(find "$APP_DIR" -name 'routes-journal-bridge.js' -print0 2>/dev/null || true)

while IFS= read -r -d '' f; do
  cp -f "$TMP/routes.js" "$f"
  echo "  → routes overwrite @ $f"
done < <(find "$APP_DIR" -name 'routes-journal-trade-screens.js' -print0 2>/dev/null || true)

# Ensure JOURNAL_TRADE_SCREENS is NOT forcing inject ON
echo "→ Nettoyage env JOURNAL_TRADE_SCREENS (doit rester OFF)…"
if command -v pm2 >/dev/null 2>&1; then
  # Do not set JOURNAL_TRADE_SCREENS=1 — delete if present in ecosystem if editable
  for eco in "$APP_DIR/ecosystem.config.js" "$APP_DIR/ecosystem.config.cjs" "$HOME/ecosystem.config.js"; do
    if [[ -f "$eco" ]] && grep -q 'JOURNAL_TRADE_SCREENS' "$eco" 2>/dev/null; then
      echo "  WARN: $eco contient JOURNAL_TRADE_SCREENS — vérifie qu'il n'est pas à 1"
    fi
  done
fi

# Bust caches
find /var/cache/nginx -type f \( -name '*forge-journal*' -o -name '*journal-trade*' \) -delete 2>/dev/null || true
rm -rf /tmp/nginx*cache* 2>/dev/null || true

echo "→ Restart PM2 (tous les process formation / la-forge)…"
pm2 restart la-forge --update-env 2>/dev/null || true
pm2 restart formation --update-env 2>/dev/null || true
pm2 restart torinvest-formation --update-env 2>/dev/null || true
# Hard restart names matching forge/formation
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
pm2 restart all --update-env 2>/dev/null || pm2 restart all 2>/dev/null || true

sleep 3

PING="$(curl -sS http://127.0.0.1:3001/api/journal-trade-screens/ping || true)"
echo ""
echo "======== PING ========"
echo "$PING"
echo "======================"

echo "$PING" | grep -q '"ok"' || {
  echo "ÉCHEC ping (pas de ok) — le serveur n'a pas chargé les nouveaux routes"
  exit 1
}
echo "$PING" | grep -q '"version":10\|"version": 10' || {
  echo "ÉCHEC: ping version != 10 ($PING)"
  echo "→ Les fichiers routes ne sont peut-être pas ceux que Node charge."
  exit 1
}
echo "$PING" | grep -q 'injectDisabled' || {
  echo "ÉCHEC: ping sans injectDisabled"
  exit 1
}
# Must be true (inject off). Fail if false.
echo "$PING" | grep -q '"injectDisabled":true\|"injectDisabled": true' || {
  echo "ÉCHEC: injectDisabled n'est pas true — JOURNAL_TRADE_SCREENS=1 encore actif?"
  echo "   unset JOURNAL_TRADE_SCREENS puis relance ce script."
  exit 1
}
echo "$PING" | grep -q 'clickRestore' || {
  echo "ÉCHEC: ping sans clickRestore"
  exit 1
}

BRIDGE_PING="$(curl -sS http://127.0.0.1:3001/api/journal-bridge/ping || true)"
echo "bridge ping: $BRIDGE_PING"
if echo "$BRIDGE_PING" | grep -q 'injectDisabled'; then
  echo "$BRIDGE_PING" | grep -q '"injectDisabled":true\|"injectDisabled": true' || {
    echo "ÉCHEC: bridge ping injectDisabled != true"
    exit 1
  }
fi

# Public stub must be the no-op
if [[ -f "$APP_DIR/public/js/forge-journal-trade-screens.js" ]]; then
  grep -q '__forgeJtsInjectDisabled\|STUB' "$APP_DIR/public/js/forge-journal-trade-screens.js" || {
    echo "ÉCHEC: public JS n'est pas le stub no-op"
    exit 1
  }
fi

echo ""
echo "############################################################"
echo "#  ✅ SUCCESS — CLICK RESTORE v10 DÉPLOYÉ                 #"
echo "#  injectDisabled:true  |  version:10  |  screens OFF     #"
echo "############################################################"
echo ""
echo "Sur ton PC :"
echo "  1) Ctrl+Shift+R sur https://app.torinvest-trading.com/journal.html"
echo "  2) Clique un trade → la lecture / détail DOIT s'ouvrir (TJ stock)"
echo "  3) Vérif ping: curl -sS https://app.torinvest-trading.com/api/journal-trade-screens/ping"
echo "     → doit contenir \"version\":10 et \"injectDisabled\":true"
echo ""
echo "Pour RÉACTIVER les screens plus tard (après validation clics) :"
echo "  pm2 set / env JOURNAL_TRADE_SCREENS=1 + redéployer le JS complet"
echo "  (ne pas faire maintenant — priorité = lecture des trades)"
echo "======== DONE ========"
