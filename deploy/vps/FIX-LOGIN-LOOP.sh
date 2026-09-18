#!/usr/bin/env bash
# Délègue au fix dashboard (session forge + anti-boucle).
# curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/cursor/fix-dashboard-access-691a/deploy/vps/FIX-LOGIN-LOOP.sh | bash
set -euo pipefail
REF="${TORINVEST_DEPLOY_REF:-cursor/fix-dashboard-access-691a}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"
echo "→ redirection vers FIX-DASHBOARD-ACCESS.sh (REF=$REF)"
curl -fsSL "$RAW/deploy/vps/FIX-DASHBOARD-ACCESS.sh" | bash
