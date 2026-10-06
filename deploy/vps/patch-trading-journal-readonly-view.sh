#!/usr/bin/env bash
# Patch radar — vue lecture seule des trades (Trading Journal Pro)
#
# - Clic Historique/Calendrier → ?page=history&view=ID (lecture)
# - Bouton « Modifier » → ?page=history&edit=ID
# - Bouton « Retour » → historique
#
# Sur le VPS **radar** (où se trouve trading_journal.php) :
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/cursor/journal-trade-readonly-691a/deploy/vps/HOTFIX-JOURNAL-TRADE-READONLY.sh" | bash
#
# Toutes les écritures sur /var/www/torinvest/* passent par sudo.
set -euo pipefail

REF="${1:-cursor/journal-trade-readonly-691a}"
ROOT="${TORINVEST_WWW:-/var/www/torinvest}"
JOURNAL="$ROOT/trading_journal.php"
API_DIR="$ROOT/api"
DST="$API_DIR/trading-journal-readonly-view.php"
BASE="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"
MARKER="torinvest-journal-readonly-view"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

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
curl -fsSL "$BASE/api/trading-journal-readonly-view.php" -o "$WORKDIR/ro.php"
grep -q 'torinvest_journal_readonly_boot' "$WORKDIR/ro.php" || {
  echo "ÉCHEC: artefact PHP invalide"
  exit 1
}
grep -q 'lecture seule' "$WORKDIR/ro.php" || {
  echo "ÉCHEC: labels FR manquants"
  exit 1
}
php -l "$WORKDIR/ro.php"
sudo cp -f "$WORKDIR/ro.php" "$DST"
sudo chown www-data:www-data "$DST" 2>/dev/null || true
echo "→ API: $DST"

BAK="${JOURNAL}.bak.readonly.$(date +%Y%m%d%H%M%S)"
sudo cp -a "$JOURNAL" "$BAK"
echo "Backup: $BAK"

# Copie lisible pour Python (évite write direct sur fichier root)
sudo cp -a "$JOURNAL" "$WORKDIR/journal.php"
sudo chmod u+rw "$WORKDIR/journal.php" 2>/dev/null || chmod u+rw "$WORKDIR/journal.php"

# 1) Inject bootstrap si absent
if grep -q "$MARKER" "$WORKDIR/journal.php"; then
  echo "OK — bootstrap readonly déjà présent"
else
  python3 - "$WORKDIR/journal.php" "$MARKER" <<'PY'
import pathlib, sys, re
path = pathlib.Path(sys.argv[1])
marker = sys.argv[2]
src = path.read_text(encoding="utf-8", errors="replace")
rel = "api/trading-journal-readonly-view.php"
boot = (
    f"/* {marker} */\n"
    f"require_once __DIR__ . '/{rel}';\n"
    "torinvest_journal_readonly_boot();\n"
)
if re.search(r"torinvest_journal_forge_sso_boot\s*\(\s*\)\s*;", src):
    src2, n = re.subn(
        r"(torinvest_journal_forge_sso_boot\s*\(\s*\)\s*;)",
        r"\1\n" + boot,
        src,
        count=1,
    )
    if n:
        path.write_text(src2, encoding="utf-8")
        print("injected after SSO boot")
        raise SystemExit(0)
if src.lstrip().startswith("<?php"):
    rest = re.sub(r"^\s*<\?php\s*", "", src, count=1)
    path.write_text("<?php\n" + boot + rest, encoding="utf-8")
    print("prefixed after <?php")
else:
    path.write_text("<?php\n" + boot + src, encoding="utf-8")
    print("prefixed file")
PY
  echo "OK — bootstrap readonly préparé"
fi

# 2) Réécrire openTrade / liens edit= → view= dans la copie
python3 - "$WORKDIR/journal.php" <<'PY'
import re, sys
from pathlib import Path
path = Path(sys.argv[1])
src = path.read_text(encoding="utf-8", errors="replace")
orig = src

def rewrite_opentrade(m):
    return re.sub(r"([?&'\"`=])edit=", r"\1view=", m.group(0), flags=re.I)

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
path.write_text(src, encoding="utf-8")
print("OK — openTrade/liens edit→view" if src != orig else "INFO — pas de réécriture source (JS runtime OK)")
PY

php -l "$WORKDIR/journal.php"
php -l "$DST"

# Dépose finale avec sudo (évite PermissionError)
sudo cp -f "$WORKDIR/journal.php" "$JOURNAL"
sudo chown www-data:www-data "$JOURNAL" 2>/dev/null || true

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
