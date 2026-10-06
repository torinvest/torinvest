#!/usr/bin/env bash
# APPLY — vue lecture seule trades (Trading Journal Pro) — 100% sudo
#
# Sur le VPS radar, UNE commande :
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/cursor/journal-trade-readonly-691a/deploy/vps/APPLY-JOURNAL-READONLY-SUDO.sh" | sudo bash
#
# Ne pas lancer sans sudo — ce script exige root.
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "ÉCHEC: lance avec sudo :"
  echo "  curl -fsSL \"https://raw.githubusercontent.com/torinvest/torinvest/cursor/journal-trade-readonly-691a/deploy/vps/APPLY-JOURNAL-READONLY-SUDO.sh\" | sudo bash"
  exit 1
fi

REF="${1:-cursor/journal-trade-readonly-691a}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"
BUST="$(date +%s)"
ROOT="${TORINVEST_WWW:-/var/www/torinvest}"
JOURNAL="$ROOT/trading_journal.php"
API_DIR="$ROOT/api"
DST="$API_DIR/trading-journal-readonly-view.php"
MARKER="torinvest-journal-readonly-view"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

echo ""
echo "############################################################"
echo "#  APPLY JOURNAL READONLY — root/sudo                     #"
echo "#  ref: $REF                                              #"
echo "############################################################"

if [[ ! -f "$JOURNAL" ]]; then
  FOUND="$(find /var/www -name 'trading_journal.php' 2>/dev/null | head -1 || true)"
  if [[ -n "$FOUND" ]]; then
    JOURNAL="$FOUND"
    ROOT="$(dirname "$JOURNAL")"
    API_DIR="$ROOT/api"
    DST="$API_DIR/trading-journal-readonly-view.php"
    echo "→ trouvé: $JOURNAL"
  else
    echo "ÉCHEC: trading_journal.php introuvable"
    exit 1
  fi
fi

mkdir -p "$API_DIR"
curl -fsSL "$RAW/api/trading-journal-readonly-view.php?t=$BUST" -o "$WORKDIR/ro.php"
php -l "$WORKDIR/ro.php"
cp -f "$WORKDIR/ro.php" "$DST"
chown www-data:www-data "$DST" 2>/dev/null || true
echo "→ API OK: $DST"

cp -a "$JOURNAL" "${JOURNAL}.bak.readonly.$(date +%Y%m%d%H%M%S)"
cp -a "$JOURNAL" "$WORKDIR/journal.php"
chmod u+rw "$WORKDIR/journal.php"

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
if marker not in src:
    if re.search(r"torinvest_journal_forge_sso_boot\s*\(\s*\)\s*;", src):
        src2, n = re.subn(
            r"(torinvest_journal_forge_sso_boot\s*\(\s*\)\s*;)",
            r"\1\n" + boot,
            src,
            count=1,
        )
        if n:
            src = src2
            print("injected after SSO")
        else:
            rest = re.sub(r"^\s*<\?php\s*", "", src, count=1) if src.lstrip().startswith("<?php") else src
            src = "<?php\n" + boot + rest
            print("prefixed")
    else:
        rest = re.sub(r"^\s*<\?php\s*", "", src, count=1) if src.lstrip().startswith("<?php") else src
        src = "<?php\n" + boot + rest
        print("prefixed")
else:
    print("bootstrap already present")

# edit= → view= in openTrade / history links
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
if src != orig:
    print("rewrote edit→view in source")
else:
    print("no source rewrite (runtime JS still handles)")

path.write_text(src, encoding="utf-8")
PY

php -l "$WORKDIR/journal.php"
cp -f "$WORKDIR/journal.php" "$JOURNAL"
chown www-data:www-data "$JOURNAL" 2>/dev/null || true

grep -q "$MARKER" "$JOURNAL" || { echo "ÉCHEC: marker absent"; exit 1; }
grep -q "trading-journal-readonly-view.php" "$JOURNAL" || { echo "ÉCHEC: require absent"; exit 1; }
php -l "$JOURNAL"
php -l "$DST"

systemctl reload php8.3-fpm 2>/dev/null \
  || systemctl reload php8.2-fpm 2>/dev/null \
  || systemctl reload php8.1-fpm 2>/dev/null \
  || systemctl reload php-fpm 2>/dev/null \
  || true

echo ""
echo "############################################################"
echo "#  OK — lecture seule installée (sudo)                     #"
echo "#  Ctrl+Shift+R → Historique → clic trade                  #"
echo "#  URL doit contenir &view=ID + « lecture seule »          #"
echo "############################################################"
