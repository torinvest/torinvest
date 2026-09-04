#!/usr/bin/env bash
# Assouplit Helmet CSP frame-src pour permettre radar (secours).
# Le hub Journal utilise surtout le proxy same-origin /journal-embed/ (recommandé).
#
# Usage (VPS) :
#   node deploy/vps/patch-helmet-journal-frames.js /home/ubuntu/torinvest-formation
set -euo pipefail
APP_DIR="${1:-/home/ubuntu/torinvest-formation}"
node "$(dirname "$0")/patch-helmet-journal-frames.js" "$APP_DIR"
