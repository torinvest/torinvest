#!/usr/bin/env bash
# HOTFIX — Trading Journal Pro : détail trade LECTURE SEULE (pas le formulaire edit)
#
# Problème : clic trade → ?page=history&edit=N (« Modifier le trade #N »)
# Fix     : clic trade → ?page=history&view=N (détail lecture seule)
#           bouton « Modifier » → edit=N ; « Retour » → historique
#
# UNE commande VPS (radar) :
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/cursor/journal-readonly-harden-691a/deploy/vps/HOTFIX-JOURNAL-TRADE-READONLY.sh" | bash
# Après merge dans main :
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/HOTFIX-JOURNAL-TRADE-READONLY.sh" | bash
set -euo pipefail

unset REF SHA BRANCH JOURNAL_SCREENS_REF SCRIPT_REF 2>/dev/null || true
BRANCH="${JOURNAL_HOTFIX_BRANCH:-cursor/journal-readonly-harden-691a}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${BRANCH}"

echo ""
echo "############################################################"
echo "#  HOTFIX JOURNAL TRADE READ-ONLY DETAIL                  #"
echo "#  branch: $BRANCH                                        #"
echo "############################################################"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

curl -fsSL "$RAW/deploy/vps/patch-trading-journal-readonly-view.sh" -o "$TMP/patch.sh"
curl -fsSL "$RAW/api/trading-journal-readonly-view.php" -o "$TMP/ro.php"

grep -q 'torinvest_journal_readonly_boot' "$TMP/ro.php" || {
  echo "ÉCHEC: PHP readonly invalide"
  exit 1
}
grep -q 'lecture seule' "$TMP/ro.php" || {
  echo "ÉCHEC: labels FR manquants"
  exit 1
}
grep -q 'patch Trading Journal READ-ONLY' "$TMP/patch.sh" || {
  echo "ÉCHEC: patch script invalide"
  exit 1
}
php -l "$TMP/ro.php"

chmod +x "$TMP/patch.sh"
bash "$TMP/patch.sh" "$BRANCH"

ROOT="${TORINVEST_WWW:-/var/www/torinvest}"
JOURNAL="$ROOT/trading_journal.php"
RO="$ROOT/api/trading-journal-readonly-view.php"

# Resolve journal if default path missing
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
php -l "$RO"
php -l "$JOURNAL" 2>/dev/null || sudo php -l "$JOURNAL"

sudo systemctl reload php8.3-fpm 2>/dev/null \
  || sudo systemctl reload php8.2-fpm 2>/dev/null \
  || sudo systemctl reload php8.1-fpm 2>/dev/null \
  || sudo systemctl reload php-fpm 2>/dev/null \
  || sudo service php8.3-fpm reload 2>/dev/null \
  || true

echo ""
echo "OK — détail lecture seule déployé sur radar."
echo "→ Vérif :"
echo "  1. Ctrl+Shift+R sur https://radar.torinvest-trading.com/trading_journal.php"
echo "  2. Cliquer un trade → URL avec view=ID (PAS edit=) + « lecture seule »"
echo "  3. Bouton Modifier → edit=ID (formulaire)"
echo "  4. Bouton Retour → historique"
echo "======== DONE ========"
