#!/usr/bin/env bash
# Génère deploy/vps/app-shells/ depuis la-forge/ (chemins /js /css pour l'app VPS).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../" && pwd)"
SRC="$ROOT/la-forge"
OUT="$ROOT/deploy/vps/app-shells"

mkdir -p "$OUT/course"

transform() {
  sed -e 's|/la-forge/js/|/js/|g' \
      -e 's|/la-forge/css/|/css/|g' \
      -e 's|https://www\.torinvest-trading\.com/la-forge/img/|/img/|g' \
      -e 's|/la-forge/img/|/img/|g' \
      -e 's|https://app\.torinvest-trading\.com/course/index\.html|/course/index.html|g' \
      -e 's|https://app\.torinvest-trading\.com/calendar\.html|/calendar.html|g' \
      -e 's|https://app\.torinvest-trading\.com/calendar-day\.html|/calendar-day.html|g' \
      -e 's|https://app\.torinvest-trading\.com/dashboard\.html|/dashboard.html|g' \
      -e 's|https://app\.torinvest-trading\.com/start\.html|/start.html|g' \
      -e 's|https://app\.torinvest-trading\.com/fondamental\.html|/fondamental.html|g' \
      -e 's|https://app\.torinvest-trading\.com/journal\.html|/journal.html|g' \
      -e 's|https://app\.torinvest-trading\.com/books\.html|/books.html|g' \
      -e 's|https://app\.torinvest-trading\.com/login\.html|/login.html|g' \
      -e 's|/la-forge/login\.html|/login.html|g' \
      -e 's|href="/la-forge/pricing\.html"|href="https://www.torinvest-trading.com/la-forge/pricing.html"|g'
}

for page in dashboard.html calendar.html calendar-day.html; do
  transform < "$SRC/$page" > "$OUT/$page"
  echo "  $page"
done

# login.html, start.html, fondamental.html, course/index.html : maintenus à la main dans app-shells/
# (formulaire TorPass KRM, unlock modules, bridge Phantom — pas générés depuis la-forge/)
echo "  (login.html, start.html, fondamental.html, course/index.html — non régénérés)"

echo "OK — shells → $OUT"
