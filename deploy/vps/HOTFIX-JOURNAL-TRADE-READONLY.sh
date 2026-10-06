#!/usr/bin/env bash
# HOTFIX — Trading Journal Pro : détail trade LECTURE SEULE
#
# v2 — anti PermissionError + anti-cache raw.githubusercontent
# Pin commit (pas seulement la branche) pour éviter un vieux script en cache.
#
# UNE commande VPS radar :
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/3c9cf6ef0448ff0be20fb82db254f8459dfa5288/deploy/vps/HOTFIX-JOURNAL-TRADE-READONLY.sh" | bash
set -euo pipefail

unset REF SHA BRANCH JOURNAL_SCREENS_REF SCRIPT_REF 2>/dev/null || true

# Commit connu avec écriture via /tmp + sudo cp (PAS write_text sur /var/www)
PIN_COMMIT="${JOURNAL_HOTFIX_COMMIT:-3c9cf6ef0448ff0be20fb82db254f8459dfa5288}"
BRANCH="${JOURNAL_HOTFIX_BRANCH:-cursor/journal-trade-readonly-691a}"
# Préférer le commit piné pour tous les downloads
REF="${JOURNAL_HOTFIX_REF:-$PIN_COMMIT}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"
BUST="$(date +%s)"

echo ""
echo "############################################################"
echo "#  HOTFIX JOURNAL TRADE READ-ONLY DETAIL v2               #"
echo "#  ref: $REF                                              #"
echo "############################################################"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

curl -fsSL "$RAW/deploy/vps/patch-trading-journal-readonly-view.sh?t=$BUST" -o "$TMP/patch.sh"
curl -fsSL "$RAW/api/trading-journal-readonly-view.php?t=$BUST" -o "$TMP/ro.php"

grep -q 'torinvest_journal_readonly_boot' "$TMP/ro.php" || {
  echo "ÉCHEC: PHP readonly invalide"
  exit 1
}
grep -q 'lecture seule' "$TMP/ro.php" || {
  echo "ÉCHEC: labels FR manquants"
  exit 1
}
# Refuse explicitement l'ancien script qui write_text sur /var/www
if grep -q 'API mise à jour' "$TMP/patch.sh"; then
  echo "ÉCHEC: ancien patch en cache (API mise à jour). Relance avec le commit piné."
  exit 1
fi
grep -q 'WORKDIR=' "$TMP/patch.sh" || {
  echo "ÉCHEC: patch sans WORKDIR (trop vieux)"
  exit 1
}
grep -q 'sudo cp -f .*journal.php' "$TMP/patch.sh" || grep -q 'sudo cp -f "$WORKDIR/journal.php"' "$TMP/patch.sh" || {
  echo "ÉCHEC: patch sans sudo cp final"
  exit 1
}
php -l "$TMP/ro.php"

chmod +x "$TMP/patch.sh"
# Passer le même REF piné au patch (évite re-download branch cache)
bash "$TMP/patch.sh" "$REF"

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
sudo grep -q 'torinvest-journal-readonly-view' "$JOURNAL" || {
  echo "ÉCHEC: marker absent de trading_journal.php"
  exit 1
}
php -l "$RO"
sudo php -l "$JOURNAL"

sudo systemctl reload php8.3-fpm 2>/dev/null \
  || sudo systemctl reload php8.2-fpm 2>/dev/null \
  || sudo systemctl reload php8.1-fpm 2>/dev/null \
  || sudo systemctl reload php-fpm 2>/dev/null \
  || true

echo ""
echo "OK — détail lecture seule déployé sur radar (v2)."
echo "→ Vérif :"
echo "  1. Ctrl+Shift+R sur https://radar.torinvest-trading.com/trading_journal.php"
echo "  2. Cliquer un trade → URL avec view=ID (PAS edit=) + « lecture seule »"
echo "  3. Bouton Modifier → edit=ID"
echo "======== DONE ========"
