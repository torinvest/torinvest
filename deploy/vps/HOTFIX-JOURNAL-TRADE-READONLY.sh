#!/usr/bin/env bash
# HOTFIX — Trading Journal Pro : détail trade LECTURE SEULE v4.1
#
# Clic → edit=ID&readonly=1 ; Modifier → edit=ID
#
# VPS radar (anti-cache) :
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/cursor/journal-readonly-flag-691a/deploy/vps/HOTFIX-JOURNAL-TRADE-READONLY.sh?$(date +%s)" | bash
set -euo pipefail

unset REF SHA BRANCH JOURNAL_SCREENS_REF SCRIPT_REF 2>/dev/null || true
BRANCH="${JOURNAL_HOTFIX_BRANCH:-cursor/journal-readonly-flag-691a}"
# Pin commit si dispo (évite CDN stale) — sinon branche
PIN="${JOURNAL_HOTFIX_PIN:-}"
if [[ -n "$PIN" ]]; then
  RAW="https://raw.githubusercontent.com/torinvest/torinvest/${PIN}"
  LABEL="pin:$PIN"
else
  RAW="https://raw.githubusercontent.com/torinvest/torinvest/${BRANCH}"
  LABEL="branch:$BRANCH"
fi
TS="$(date +%s)"

echo ""
echo "############################################################"
echo "#  HOTFIX JOURNAL TRADE READ-ONLY DETAIL v4.1             #"
echo "#  edit=ID&readonly=1   $LABEL                            #"
echo "#  PATCH_ENGINE=stdout+sudo-tee                           #"
echo "############################################################"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

curl -fsSL "${RAW}/deploy/vps/patch-trading-journal-readonly-view.sh?ts=${TS}" -o "$TMP/patch.sh"
curl -fsSL "${RAW}/api/trading-journal-readonly-view.php?ts=${TS}" -o "$TMP/ro.php"

grep -q 'torinvest_journal_readonly_boot' "$TMP/ro.php" || {
  echo "ÉCHEC: PHP readonly invalide"
  exit 1
}
grep -q 'lecture seule' "$TMP/ro.php" || {
  echo "ÉCHEC: labels FR manquants"
  exit 1
}
grep -q 'torinvest-tj-readonly-v4' "$TMP/ro.php" || {
  echo "ÉCHEC: v4 manquant — refuse un vieux cache"
  exit 1
}
grep -q 'readonly=1' "$TMP/ro.php" || {
  echo "ÉCHEC: contrat readonly=1 manquant"
  exit 1
}
grep -q 'PATCH_ENGINE=stdout+sudo-tee\|stdout+sudo-tee' "$TMP/patch.sh" || {
  echo "ÉCHEC: vieux patch (sans stdout+sudo-tee) — cache GitHub ?"
  echo "  Relance avec : JOURNAL_HOTFIX_PIN=<sha> ou attends 1 min"
  exit 1
}
grep -qE 'path\.write_text|\.write_text\(' "$TMP/patch.sh" && {
  echo "ÉCHEC: patch contient encore path.write_text — mauvais artefact"
  exit 1
}
php -l "$TMP/ro.php"

chmod +x "$TMP/patch.sh"
bash "$TMP/patch.sh" "${PIN:-$BRANCH}"

ROOT="${TORINVEST_WWW:-/var/www/torinvest}"
JOURNAL="$ROOT/trading_journal.php"
RO="$ROOT/api/trading-journal-readonly-view.php"

if [[ ! -f "$JOURNAL" ]]; then
  FOUND="$(sudo find /var/www -name 'trading_journal.php' 2>/dev/null | head -1 || true)"
  if [[ -n "$FOUND" ]]; then
    JOURNAL="$FOUND"
    ROOT="$(dirname "$JOURNAL")"
    RO="$ROOT/api/trading-journal-readonly-view.php"
  fi
fi

[[ -f "$JOURNAL" ]] || { echo "ÉCHEC: trading_journal.php manquant après patch"; exit 1; }
[[ -f "$RO" ]] || { echo "ÉCHEC: $RO manquant après patch"; exit 1; }
grep -q 'torinvest-journal-readonly-view' "$JOURNAL" 2>/dev/null \
  || sudo grep -q 'torinvest-journal-readonly-view' "$JOURNAL" || {
  echo "ÉCHEC: marker absent de trading_journal.php"
  exit 1
}
sudo grep -q 'torinvest-tj-readonly-v4' "$RO" || {
  echo "ÉCHEC: RO déployé n'est pas v4"
  exit 1
}
php -l "$RO"
php -l "$JOURNAL" 2>/dev/null || sudo php -l "$JOURNAL"

sudo systemctl reload php8.3-fpm 2>/dev/null \
  || sudo systemctl reload php8.2-fpm 2>/dev/null \
  || sudo systemctl reload php8.1-fpm 2>/dev/null \
  || sudo systemctl reload php-fpm 2>/dev/null \
  || sudo service php8.3-fpm reload 2>/dev/null \
  || true

echo ""
echo "OK — détail lecture seule v4.1 déployé sur radar."
echo "→ Vérif : Ctrl+Shift+R → clic trade → URL edit=ID&readonly=1 + lecture seule"
echo "======== DONE ========"
