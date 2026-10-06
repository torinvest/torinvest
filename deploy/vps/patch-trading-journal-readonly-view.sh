#!/usr/bin/env bash
# Patch radar — vue lecture seule des trades (Trading Journal Pro)
#
# - Clic Historique/Calendrier → ?page=history&view=ID (lecture)
# - Bouton « Modifier » → ?page=history&edit=ID
#
# Sur le VPS **radar** (où se trouve trading_journal.php) :
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/cursor/journal-trade-readonly-691a/deploy/vps/patch-trading-journal-readonly-view.sh" | bash
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
sudo mv /tmp/trading-journal-readonly-view.php "$DST"
sudo chown www-data:www-data "$DST" 2>/dev/null || true
php -l "$DST"

if sudo grep -q "$MARKER" "$JOURNAL"; then
  echo "OK — bootstrap readonly déjà présent (fichier API mis à jour)"
else
  sudo cp -a "$JOURNAL" "${JOURNAL}.bak.readonly.$(date +%Y%m%d%H%M%S)"
  TMP=/tmp/tj-readonly-$$.php
  python3 - "$JOURNAL" "$MARKER" "$TMP" <<'PY'
import pathlib, sys, re
journal, marker, out = sys.argv[1:4]
src = pathlib.Path(journal).read_text(encoding="utf-8", errors="replace")
rel = "api/trading-journal-readonly-view.php"
boot = f"require_once __DIR__ . '/{rel}';\ntorinvest_journal_readonly_boot();\n"
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
    pathlib.Path(out).write_text("<?php\n" + f"/* {marker} */\n" + boot + rest, encoding="utf-8")
    print("prefixed after <?php")
else:
    pathlib.Path(out).write_text("<?php\n" + f"/* {marker} */\n" + boot + src, encoding="utf-8")
    print("prefixed file")
PY
  sudo mv "$TMP" "$JOURNAL"
  sudo chown www-data:www-data "$JOURNAL" 2>/dev/null || true
  echo "OK — bootstrap readonly injecté dans trading_journal.php"
fi

php -l "$JOURNAL"
php -l "$DST"

echo ""
echo "############################################################"
echo "#  OK — vue lecture seule                                  #"
echo "#  1) Ouvre le journal (radar)                             #"
echo "#  2) Historique → clic sur un trade                       #"
echo "#  3) URL doit contenir &view=ID (pas edit=)               #"
echo "#  4) Bannière Mode lecture + bouton Modifier              #"
echo "############################################################"
