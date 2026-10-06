#!/usr/bin/env bash
# Alias — même patch que patch-trading-journal-readonly-view.sh
# Conservé pour les liens HOTFIX / docs qui pointaient ici.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REF="${1:-cursor/journal-trade-readonly-691a}"
exec bash "$DIR/patch-trading-journal-readonly-view.sh" "$REF"
