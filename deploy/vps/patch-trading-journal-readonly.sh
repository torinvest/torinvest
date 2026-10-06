#!/usr/bin/env bash
# Installe la vue détail trade lecture seule sur Trading Journal Pro (radar).
#
# Effet :
#   - clic ligne / calendrier → ?page=history&view=ID (lecture seule)
#   - bouton « Modifier » → ?page=history&edit=ID (édition inchangée)
#   - bouton « Retour » → historique
#
# Usage (ubuntu VPS) :
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/cursor/journal-trade-readonly-691a/deploy/vps/patch-trading-journal-readonly.sh" | bash
#   bash patch-trading-journal-readonly.sh cursor/journal-trade-readonly-691a
set -euo pipefail

REF="${1:-cursor/journal-trade-readonly-691a}"
ROOT="${TORINVEST_WWW:-/var/www/torinvest}"
API_DIR="$ROOT/api"
JOURNAL="$ROOT/trading_journal.php"
RO_DST="$API_DIR/trading-journal-readonly-view.php"
BASE="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"
MARKER="torinvest-journal-readonly-view"

echo "==> patch Trading Journal READ-ONLY detail ($REF)"

if [ ! -f "$JOURNAL" ]; then
  echo "ERREUR: $JOURNAL introuvable"
  echo "Cherche :"
  sudo find /var/www -name 'trading_journal.php' 2>/dev/null | head
  exit 1
fi

sudo mkdir -p "$API_DIR"
curl -fsSL "$BASE/api/trading-journal-readonly-view.php" -o /tmp/trading-journal-readonly-view.php
# Sanity artefact
grep -q 'torinvest_journal_readonly_boot' /tmp/trading-journal-readonly-view.php || {
  echo "ÉCHEC: artefact PHP invalide (boot manquant)"
  exit 1
}
grep -q 'lecture seule' /tmp/trading-journal-readonly-view.php || {
  echo "ÉCHEC: artefact PHP invalide (labels FR manquants)"
  exit 1
}
php -l /tmp/trading-journal-readonly-view.php
sudo mv /tmp/trading-journal-readonly-view.php "$RO_DST"
sudo chown www-data:www-data "$RO_DST" 2>/dev/null || sudo chown ubuntu:ubuntu "$RO_DST" || true

# Backup une fois par run
BAK="${JOURNAL}.bak.readonly.$(date +%Y%m%d%H%M%S)"
sudo cp -a "$JOURNAL" "$BAK"
echo "Backup: $BAK"

# 1) Inject bootstrap PHP (après SSO si présent, sinon après <?php)
if sudo grep -q "$MARKER" "$JOURNAL"; then
  echo "OK — bootstrap readonly déjà présent"
else
  python3 - "$JOURNAL" "$MARKER" <<'PY'
import sys
from pathlib import Path
path = Path(sys.argv[1])
marker = sys.argv[2]
text = path.read_text(encoding="utf-8", errors="replace")
boot = (
    f"/* {marker} */\n"
    "require_once __DIR__ . '/api/trading-journal-readonly-view.php';\n"
    "torinvest_journal_readonly_boot();\n"
)
# Prefer after SSO boot block
sso = "torinvest_journal_forge_sso_boot();"
if sso in text and marker not in text:
    text = text.replace(sso, sso + "\n" + boot, 1)
elif text.lstrip().startswith("<?php") and marker not in text:
    # Insert right after opening tag line
    lines = text.splitlines(keepends=True)
    out = []
    inserted = False
    for i, line in enumerate(lines):
        out.append(line)
        if not inserted and "<?php" in line:
            out.append(boot if boot.endswith("\n") else boot + "\n")
            inserted = True
    text = "".join(out)
else:
    if marker not in text:
        text = "<?php\n" + boot + "?>\n" + text
path.write_text(text, encoding="utf-8")
print("OK — bootstrap readonly injecté")
PY
fi

# 2) Réécrire openTrade / liens edit= → view= dans le JS embarqué (source)
python3 - "$JOURNAL" <<'PY'
import re, sys
from pathlib import Path
path = Path(sys.argv[1])
src = path.read_text(encoding="utf-8", errors="replace")
orig = src

# openTrade function bodies: edit= → view=
def rewrite_opentrade(m):
    body = m.group(0)
    body2 = re.sub(r"([?&'\"`=])edit=", r"\1view=", body, flags=re.I)
    # also location patterns inside
    body2 = re.sub(r"([&?])edit=", r"\1view=", body2)
    return body2

src = re.sub(
    r"function\s+openTrade\s*\([^)]*\)\s*\{.*?\}",
    rewrite_opentrade,
    src,
    flags=re.S | re.I,
)

# Common one-liners: openTrade = function(...) { ... edit= ... }
src = re.sub(
    r"(openTrade\s*=\s*function\s*\([^)]*\)\s*\{)(.*?)(\})",
    lambda m: m.group(1) + re.sub(r"([?&'\"`])edit=", r"\1view=", m.group(2), flags=re.I) + m.group(3),
    src,
    flags=re.S | re.I,
)

# onclick / href helpers that navigate with edit= for trades (page=history|calendar)
src = re.sub(
    r"((?:page=(?:history|calendar|calendrier)[^\"'\s]*)[&?])edit=",
    r"\1view=",
    src,
    flags=re.I,
)
# '?page=history&edit=' + id  → view=
src = re.sub(
    r"(['\"])([^'\"]*page=(?:history|calendar|calendrier)[^'\"]*?)edit=",
    r"\1\2view=",
    src,
    flags=re.I,
)

if src != orig:
    path.write_text(src, encoding="utf-8")
    print("OK — openTrade / liens history edit= → view= réécrits dans trading_journal.php")
else:
    print("INFO — aucun pattern openTrade/edit= réécrit (le wrapper JS runtime couvre quand même)")
PY

sudo chown www-data:www-data "$JOURNAL" 2>/dev/null || true
php -l "$RO_DST"
php -l "$JOURNAL"

# Sanity
sudo grep -q "$MARKER" "$JOURNAL" || { echo "ÉCHEC: marker absent de trading_journal.php"; exit 1; }
sudo grep -q "trading-journal-readonly-view.php" "$JOURNAL" || {
  echo "ÉCHEC: require readonly absent"
  exit 1
}

echo ""
echo "OK — Vue lecture seule TJ Pro installée."
echo "→ Clic trade : ?page=history&view=ID"
echo "→ Modifier   : ?page=history&edit=ID"
echo "→ Vérif :"
echo "   grep -n torinvest-journal-readonly-view $JOURNAL"
echo "   Puis Ctrl+Shift+R sur radar → cliquer un trade"
echo "======== DONE ========"
