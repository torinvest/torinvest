#!/usr/bin/env bash
# Patch radar — vue lecture seule des trades (Trading Journal Pro)
#
# - Clic Historique/Calendrier → ?page=history&view=ID (lecture)
# - Bouton « Modifier » → ?page=history&edit=ID
# - Bouton « Retour » → historique
#
# Sur le VPS **radar** (où se trouve trading_journal.php) :
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/cursor/journal-trade-readonly-691a/deploy/vps/HOTFIX-JOURNAL-TRADE-READONLY.sh" | bash
set -euo pipefail

REF="${1:-cursor/journal-trade-readonly-691a}"
ROOT="${TORINVEST_WWW:-/var/www/torinvest}"
JOURNAL="$ROOT/trading_journal.php"
API_DIR="$ROOT/api"
DST="$API_DIR/trading-journal-readonly-view.php"
BASE="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"
MARKER="torinvest-journal-readonly-view"

echo "==> patch Trading Journal READ-ONLY view ($REF)"

if [[ ! -f "$JOURNAL" ]]; then
  echo "ERREUR: $JOURNAL introuvable — cherche…"
  FOUND="$(sudo find /var/www -name 'trading_journal.php' 2>/dev/null | head -1 || true)"
  if [[ -n "$FOUND" ]]; then
    JOURNAL="$FOUND"
    ROOT="$(dirname "$JOURNAL")"
    API_DIR="$ROOT/api"
    DST="$API_DIR/trading-journal-readonly-view.php"
    echo "→ trouvé: $JOURNAL"
  else
    echo "ÉCHEC: trading_journal.php absent"
    echo "Ce script doit tourner sur le VPS **radar** (pas seulement formation/app)."
    exit 1
  fi
fi

sudo mkdir -p "$API_DIR"
curl -fsSL "$BASE/api/trading-journal-readonly-view.php" -o /tmp/trading-journal-readonly-view.php
grep -q 'torinvest_journal_readonly_boot' /tmp/trading-journal-readonly-view.php || {
  echo "ÉCHEC: artefact PHP invalide"
  exit 1
}
grep -q 'lecture seule' /tmp/trading-journal-readonly-view.php || {
  echo "ÉCHEC: labels FR manquants"
  exit 1
}
php -l /tmp/trading-journal-readonly-view.php
sudo mv /tmp/trading-journal-readonly-view.php "$DST"
sudo chown www-data:www-data "$DST" 2>/dev/null || true

BAK="${JOURNAL}.bak.readonly.$(date +%Y%m%d%H%M%S)"
sudo cp -a "$JOURNAL" "$BAK"
echo "Backup: $BAK"

# 1) Inject bootstrap (toujours avec MARKER)
if sudo grep -q "$MARKER" "$JOURNAL"; then
  echo "OK — bootstrap readonly déjà présent (API mise à jour)"
else
  TMP=/tmp/tj-readonly-$$.php
  python3 - "$JOURNAL" "$MARKER" "$TMP" <<'PY'
import pathlib, sys, re
journal, marker, out = sys.argv[1:4]
src = pathlib.Path(journal).read_text(encoding="utf-8", errors="replace")
rel = "api/trading-journal-readonly-view.php"
boot = (
    f"/* {marker} */\n"
    f"require_once __DIR__ . '/{rel}';\n"
    "torinvest_journal_readonly_boot();\n"
)
if marker in src:
    pathlib.Path(out).write_text(src, encoding="utf-8")
    print("already marked")
    raise SystemExit(0)
if re.search(r"torinvest_journal_forge_sso_boot\s*\(\s*\)\s*;", src):
    src2, n = re.subn(
        r"(torinvest_journal_forge_sso_boot\s*\(\s*\)\s*;)",
        r"\1\n" + boot,
        src,
        count=1,
    )
    if n:
        pathlib.Path(out).write_text(src2, encoding="utf-8")
        print("injected after SSO boot")
        raise SystemExit(0)
if src.lstrip().startswith("<?php"):
    rest = re.sub(r"^\s*<\?php\s*", "", src, count=1)
    pathlib.Path(out).write_text("<?php\n" + boot + rest, encoding="utf-8")
    print("prefixed after <?php")
else:
    pathlib.Path(out).write_text("<?php\n" + boot + src, encoding="utf-8")
    print("prefixed file")
PY
  sudo mv "$TMP" "$JOURNAL"
  sudo chown www-data:www-data "$JOURNAL" 2>/dev/null || true
  echo "OK — bootstrap readonly injecté dans trading_journal.php"
fi

# 2) Réécrire openTrade / liens history&edit= → view= dans le source (défense en profondeur)
python3 - "$JOURNAL" <<'PY'
import re, sys
from pathlib import Path
path = Path(sys.argv[1])
src = path.read_text(encoding="utf-8", errors="replace")
orig = src

def rewrite_opentrade(m):
    body = m.group(0)
    return re.sub(r"([?&'\"`=])edit=", r"\1view=", body, flags=re.I)

src = re.sub(
    r"function\s+openTrade\s*\([^)]*\)\s*\{.*?\}",
    rewrite_opentrade,
    src,
    flags=re.S | re.I,
)
src = re.sub(
    r"(openTrade\s*=\s*function\s*\([^)]*\)\s*\{)(.*?)(\})",
    lambda m: m.group(1)
    + re.sub(r"([?&'\"`])edit=", r"\1view=", m.group(2), flags=re.I)
    + m.group(3),
    src,
    flags=re.S | re.I,
)
src = re.sub(
    r"(['\"])([^'\"]*page=(?:history|calendar|calendrier)[^'\"]*?)edit=",
    r"\1\2view=",
    src,
    flags=re.I,
)

if src != orig:
    path.write_text(src, encoding="utf-8")
    print("OK — openTrade / liens history edit= → view= réécrits")
else:
    print("INFO — pas de réécriture source (wrapper JS runtime couvre)")
PY

sudo chown www-data:www-data "$JOURNAL" 2>/dev/null || true
php -l "$DST"
php -l "$JOURNAL"

sudo grep -q "$MARKER" "$JOURNAL" || {
  echo "ÉCHEC: marker absent de trading_journal.php"
  exit 1
}
sudo grep -q "trading-journal-readonly-view.php" "$JOURNAL" || {
  echo "ÉCHEC: require readonly absent"
  exit 1
}

echo ""
echo "############################################################"
echo "#  OK — vue lecture seule                                  #"
echo "#  1) Ctrl+Shift+R sur le journal radar                    #"
echo "#  2) Historique / Calendrier → clic trade                 #"
echo "#  3) URL = &view=ID (PAS edit=) + « lecture seule »       #"
echo "#  4) Bouton Modifier → edit=ID ; Retour → historique      #"
echo "############################################################"
