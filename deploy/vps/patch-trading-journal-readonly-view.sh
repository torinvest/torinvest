#!/usr/bin/env bash
# Patch radar — vue lecture seule des trades (Trading Journal Pro) v4.1
#
# - Clic → ?page=history&edit=ID&readonly=1
# - Modifier → ?page=history&edit=ID
# - Python n’écrit JAMAIS dans /tmp (stdout → sudo tee) — évite PermissionError
#
# Sur le VPS **radar** :
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/HOTFIX-JOURNAL-TRADE-READONLY.sh?$(date +%s)" | bash
set -euo pipefail

REF="${1:-cursor/journal-readonly-flag-691a}"
ROOT="${TORINVEST_WWW:-/var/www/torinvest}"
JOURNAL="$ROOT/trading_journal.php"
API_DIR="$ROOT/api"
DST="$API_DIR/trading-journal-readonly-view.php"
BASE="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"
MARKER="torinvest-journal-readonly-view"
# Workdir dans $HOME (pas /tmp sticky/root) — owned par l'utilisateur
WORKDIR="${HOME}/.torinvest-patch-$$"
mkdir -p "$WORKDIR"
trap 'rm -rf "$WORKDIR"' EXIT

echo "==> patch Trading Journal READ-ONLY view v4.1 ($REF)"
echo "    PATCH_ENGINE=stdout+sudo-tee (no python write_text)"

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
curl -fsSL "${BASE}/api/trading-journal-readonly-view.php?ts=$(date +%s)" -o "$WORKDIR/ro.php"
grep -q 'torinvest_journal_readonly_boot' "$WORKDIR/ro.php" || {
  echo "ÉCHEC: artefact PHP invalide"
  exit 1
}
grep -q 'lecture seule' "$WORKDIR/ro.php" || {
  echo "ÉCHEC: labels FR manquants"
  exit 1
}
grep -q 'torinvest-tj-readonly-v4' "$WORKDIR/ro.php" || {
  echo "ÉCHEC: marker v4 absent — mauvais artefact"
  exit 1
}
grep -q 'readonly=1' "$WORKDIR/ro.php" || {
  echo "ÉCHEC: contrat readonly=1 manquant"
  exit 1
}
php -l "$WORKDIR/ro.php"
sudo cp -f "$WORKDIR/ro.php" "$DST"
sudo chown www-data:www-data "$DST" 2>/dev/null || true
echo "→ API: $DST"

BAK="${JOURNAL}.bak.readonly.$(date +%Y%m%d%H%M%S)"
sudo cp -a "$JOURNAL" "$BAK"
echo "Backup: $BAK"

# Copie lisible (owned user) — jamais sudo cp -a
sudo cat "$JOURNAL" > "$WORKDIR/journal.php"
chmod u+rw "$WORKDIR/journal.php" || true

# 1) Inject bootstrap si absent — Python print → tee (pas write_text)
if grep -q "$MARKER" "$WORKDIR/journal.php"; then
  echo "OK — bootstrap readonly déjà présent"
else
  python3 - "$WORKDIR/journal.php" "$MARKER" > "$WORKDIR/journal.out" <<'PY'
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
        sys.stdout.write(src2)
        print("injected after SSO boot", file=sys.stderr)
        raise SystemExit(0)
if src.lstrip().startswith("<?php"):
    rest = re.sub(r"^\s*<\?php\s*", "", src, count=1)
    sys.stdout.write("<?php\n" + boot + rest)
    print("prefixed after <?php", file=sys.stderr)
else:
    sys.stdout.write("<?php\n" + boot + src)
    print("prefixed file", file=sys.stderr)
PY
  mv -f "$WORKDIR/journal.out" "$WORKDIR/journal.php"
  echo "OK — bootstrap readonly préparé"
fi

# 2) openTrade → edit=+readonly=1 — stdout only
python3 - "$WORKDIR/journal.php" > "$WORKDIR/journal.out" <<'PY'
import re, sys
from pathlib import Path
path = Path(sys.argv[1])
src = path.read_text(encoding="utf-8", errors="replace")
orig = src

def fix_opentrade(m):
    body = m.group(0)
    body = re.sub(r"([?&'\"`=])read=", r"\1edit=", body, flags=re.I)
    body = re.sub(
        r"([?&'\"`=])view=(?=['\"]?\s*\+?\s*id|\d)",
        r"\1edit=",
        body,
        flags=re.I,
    )
    if "readonly=1" in body:
        return body
    body2 = re.sub(
        r"(['\"`][^'\"`]*[?&]edit=)(['\"`]\s*\+\s*id)",
        r"\1&readonly=1\2",
        body,
        flags=re.I,
    )
    if body2 != body:
        return body2
    body2 = re.sub(
        r"(edit=['\"`]?\s*\+\s*id)",
        r"\1 + '&readonly=1'",
        body,
        flags=re.I,
    )
    if body2 != body:
        return body2
    body2 = re.sub(
        r"([?&]edit=\d+)(?![&]readonly=1)",
        r"\1&readonly=1",
        body,
        flags=re.I,
    )
    return body2

src = re.sub(
    r"function\s+openTrade\s*\([^)]*\)\s*\{.*?\}",
    fix_opentrade,
    src,
    flags=re.S | re.I,
)
src = re.sub(
    r"openTrade\s*=\s*function\s*\([^)]*\)\s*\{.*?\}",
    fix_opentrade,
    src,
    flags=re.S | re.I,
)
sys.stdout.write(src)
print(
    "OK — openTrade → edit=+readonly=1" if src != orig else "INFO — pas de réécriture source (JS runtime OK)",
    file=sys.stderr,
)
PY
mv -f "$WORKDIR/journal.out" "$WORKDIR/journal.php"

php -l "$WORKDIR/journal.php"
php -l "$DST"

# Dépose finale via sudo tee (jamais besoin d'écrire en root dans workdir)
sudo tee "$JOURNAL" < "$WORKDIR/journal.php" >/dev/null
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
echo "#  OK — vue lecture seule v4.1 (edit=+readonly=1)          #"
echo "#  1) Ctrl+Shift+R sur le journal radar                    #"
echo "#  2) Clic trade → URL &edit=ID&readonly=1 + lecture seule #"
echo "#  3) Bouton Modifier → edit=ID ; Retour → historique      #"
echo "############################################################"
