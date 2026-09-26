#!/usr/bin/env bash
# Déploie Analyses & scénarios swing.
#
#   REF=cursor/swing-gold-visible-691a curl -fsSL \
#     https://raw.githubusercontent.com/torinvest/torinvest/cursor/swing-gold-visible-691a/deploy/vps/DEPLOY-SWING-ANALYSES.sh \
#     -o /tmp/d-swa.sh && REF=cursor/swing-gold-visible-691a bash /tmp/d-swa.sh
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
REF="${REF:-cursor/swing-gold-visible-691a}"
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
t2, n = re.subn(
    r"express\.json\(\s*\{[^}]*\}\s*\)",
    'express.json({ limit: "12mb" })',
    t,
    count=1,
)
if n:
    p.write_text(t2, encoding="utf-8")
    print("express.json limit → 12mb (remplacé)")
elif "express.json()" in t:
    p.write_text(t.replace("express.json()", 'express.json({ limit: "12mb" })', 1), encoding="utf-8")
    print("express.json limit → 12mb")
else:
    print("WARN: express.json() introuvable — vérifie manuellement la limite body")
PY2

# Nginx : client_max_body_size trop bas (défaut 1m) → 413 sur les screens
python3 <<'PYN'
from pathlib import Path
import re, subprocess, os
sites = list(Path("/etc/nginx/sites-enabled").glob("*")) if Path("/etc/nginx/sites-enabled").is_dir() else []
sites += list(Path("/etc/nginx/conf.d").glob("*.conf")) if Path("/etc/nginx/conf.d").is_dir() else []
patched = 0
for conf in sites:
    try:
        t = conf.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        continue
    if "3001" not in t and "torinvest" not in t and "app.torinvest" not in t:
        continue
    if re.search(r"client_max_body_size\s+12m\s*;", t):
        print(f"nginx {conf.name}: déjà 12m")
        continue
    if re.search(r"client_max_body_size\s+\S+\s*;", t):
        t2 = re.sub(r"client_max_body_size\s+\S+\s*;", "client_max_body_size 12m;", t, count=1)
    else:
        t2 = re.sub(r"(server\s*\{)", r"\1\n    client_max_body_size 12m;", t, count=1)
    if t2 == t:
        print(f"nginx {conf.name}: patch impossible")
        continue
    bak = str(conf) + ".bak-swa"
    try:
        subprocess.check_call(["sudo", "cp", str(conf), bak])
        Path("/tmp/swa-nginx-patch.conf").write_text(t2, encoding="utf-8")
        subprocess.check_call(["sudo", "cp", "/tmp/swa-nginx-patch.conf", str(conf)])
        patched += 1
        print(f"nginx {conf.name}: client_max_body_size 12m")
    except Exception as e:
        print(f"nginx {conf.name}: skip ({e})")
if patched:
    try:
        subprocess.check_call(["sudo", "nginx", "-t"])
        subprocess.check_call(["sudo", "systemctl", "reload", "nginx"])
        print("nginx rechargé")
    except Exception as e:
        print(f"WARN nginx reload: {e}")
elif not sites:
    print("nginx: aucun site trouvé — ajoute manuellement client_max_body_size 12m;")
PYN

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
