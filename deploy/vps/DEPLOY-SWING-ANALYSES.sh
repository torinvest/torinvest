#!/usr/bin/env bash
# Déploie Analyses & scénarios swing.
#
#   curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/DEPLOY-SWING-ANALYSES.sh -o /tmp/d-swa.sh && bash /tmp/d-swa.sh
#   # ou branche :
#   REF=cursor/swing-gold-visible-691a curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/cursor/swing-gold-visible-691a/deploy/vps/DEPLOY-SWING-ANALYSES.sh -o /tmp/d-swa.sh && REF=cursor/swing-gold-visible-691a bash /tmp/d-swa.sh
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
REF="${REF:-main}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"

echo "======== DEPLOY SWING ANALYSES ($REF) ========"
mkdir -p "$APP_DIR/public/js" "$APP_DIR/public/css" "$APP_DIR/server-patches" "$APP_DIR/data/swing-analyses/media"

pull() { echo "← $(basename "$2")"; curl -fsSL "$1" -o "$2"; }

pull "$RAW/deploy/vps/app-shells/swing-analyses.html" "$APP_DIR/public/swing-analyses.html"
pull "$RAW/la-forge/js/forge-swing-analyses.js" "$APP_DIR/public/js/forge-swing-analyses.js"
pull "$RAW/la-forge/css/forge-swing-analyses.css" "$APP_DIR/public/css/forge-swing-analyses.css"
pull "$RAW/la-forge/js/forge-brand.js" "$APP_DIR/public/js/forge-brand.js"
pull "$RAW/deploy/vps/app-shells/dashboard.html" "$APP_DIR/public/dashboard.html"
pull "$RAW/deploy/vps/formation-server/routes-swing-analyses.js" "$APP_DIR/server-patches/routes-swing-analyses.js"
pull "$RAW/deploy/vps/wire-formation-server-patches.js" "$APP_DIR/wire-formation-server-patches.js"

node "$APP_DIR/wire-formation-server-patches.js" "$APP_DIR"

# Autoriser uploads screens (base64) — limite JSON Express
python3 - "$APP_DIR/server.js" <<'PY2'
from pathlib import Path
import re, sys
p=Path(sys.argv[1])
if not p.exists():
    print("server.js introuvable — skip json limit")
    raise SystemExit(0)
t=p.read_text(encoding="utf-8", errors="ignore")
if "express.json({ limit:" in t or 'express.json({limit:' in t:
    print("express.json limit déjà présent")
elif "express.json()" in t:
    t=t.replace("express.json()", "express.json({ limit: \"8mb\" })", 1)
    p.write_text(t, encoding="utf-8")
    print("express.json limit → 8mb")
else:
    print("WARN: express.json() introuvable — vérifie manuellement la limite body")
PY2


# Inject admin nav on dashboard if missing
python3 - "$APP_DIR/public/dashboard.html" <<'PY'
from pathlib import Path
import re, sys
p = Path(sys.argv[1])
t = p.read_text(encoding="utf-8", errors="ignore")
if "swing-analyses.html" in t:
    print("dashboard: lien analyses déjà présent")
else:
    link = (
        '<a class="btn btn-secondary" href="/swing-analyses.html" data-swa-admin-nav hidden>'
        "Analyses swing</a>"
    )
    t2 = re.sub(
        r'(<a[^>]+coaching-fiches\.html[^>]*>.*?</a>)',
        r"\1\n      " + link,
        t,
        count=1,
        flags=re.I | re.S,
    )
    if t2 == t:
        t2 = t.replace(
            'href="/psycho-atlas.html">Atlas Psycho</a>',
            'href="/psycho-atlas.html">Atlas Psycho</a>\n      <a class="btn btn-secondary" href="/swing-analyses.html">Analyses swing</a>',
            1,
        )
    p.write_text(t2, encoding="utf-8")
    print("dashboard: lien Analyses swing ajouté")
PY

if command -v pm2 >/dev/null 2>&1; then
  pm2 restart la-forge --update-env || true
fi

echo ""
curl -sS -o /dev/null -w "swing-analyses.html %{http_code}\n" "http://127.0.0.1:3001/swing-analyses.html" || true
grep -n "createSwingAnalysesRouter\|routes-swing-analyses" "$APP_DIR/server.js" 2>/dev/null | head -5 || true
echo "→ https://app.torinvest-trading.com/swing-analyses.html"
echo "======== DONE ========"
