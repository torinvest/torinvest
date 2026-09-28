#!/usr/bin/env bash
# HOTFIX — upload navigateur PDF/screens sur resources.html → VPS live-resources
#
# Sur le VPS :
#   curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/cursor/live-resources-upload-691a/deploy/vps/HOTFIX-LIVE-RESOURCES-UPLOAD.sh | bash
#
# Ou avec un SHA figé :
#   SHA=<commit> curl -fsSL ... | bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
REF="${SHA:-${REF:-cursor/live-resources-upload-691a}}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"

echo "======== HOTFIX LIVE-RESOURCES UPLOAD ($REF) ========"
echo "APP=$APP_DIR"

mkdir -p "$APP_DIR/public/js" "$APP_DIR/server-patches" /var/lib/torinvest/live-resources
sudo chown -R "${SUDO_USER:-$USER}:${SUDO_USER:-$USER}" /var/lib/torinvest/live-resources 2>/dev/null || true

curl -fsSL "$RAW/deploy/vps/app-shells/resources.html" -o "$APP_DIR/public/resources.html"
curl -fsSL "$RAW/la-forge/js/forge-live-resources.js" -o "$APP_DIR/public/js/forge-live-resources.js"
curl -fsSL "$RAW/deploy/vps/formation-server/routes-live-resources.js" \
  -o "$APP_DIR/server-patches/routes-live-resources.js"

# Aussi à côté de routes-formation-auth si le wire charge depuis ce dossier
if [[ -f "$APP_DIR/server-patches/routes-formation-auth.js" ]]; then
  cp -f "$APP_DIR/server-patches/routes-live-resources.js" \
    "$(dirname "$(readlink -f "$APP_DIR/server-patches/routes-formation-auth.js" 2>/dev/null || echo "$APP_DIR/server-patches/routes-formation-auth.js")")/routes-live-resources.js" 2>/dev/null || true
fi

# Copie dans le cwd Node si routes-live-resources y est déjà
for cand in \
  "$APP_DIR/routes-live-resources.js" \
  "$APP_DIR/server-patches/routes-live-resources.js"
do
  if [[ -f "$cand" ]] || [[ "$cand" == "$APP_DIR/server-patches/routes-live-resources.js" ]]; then
    curl -fsSL "$RAW/deploy/vps/formation-server/routes-live-resources.js" -o "$cand"
  fi
done

# express.json limit (base64 PDF ~10 Mo → body ~14 Mo) — aligné swing 12mb+
python3 - <<'PY'
from pathlib import Path
import re
app = Path.home() / "torinvest-formation"
for p in [app / "server.js", *app.glob("**/server.js")]:
    if not p.is_file():
        continue
    t = p.read_text(encoding="utf-8")
    if 'express.json({ limit: "20mb" })' in t or "express.json({ limit: '20mb' })" in t:
        print(f"express.json déjà 20mb: {p}")
        continue
    if re.search(r'express\.json\(\s*\{\s*limit:\s*["\']\d+mb["\']\s*\}\s*\)', t):
        t2 = re.sub(
            r'express\.json\(\s*\{\s*limit:\s*["\']\d+mb["\']\s*\}\s*\)',
            'express.json({ limit: "20mb" })',
            t,
            count=1,
        )
        p.write_text(t2, encoding="utf-8")
        print(f"express.json limit → 20mb ({p})")
    elif "express.json()" in t:
        p.write_text(t.replace("express.json()", 'express.json({ limit: "20mb" })', 1), encoding="utf-8")
        print(f"express.json() → 20mb ({p})")
    else:
        print(f"WARN: express.json introuvable dans {p}")
    break
PY

# Nginx client_max_body_size
python3 - <<'PY'
from pathlib import Path
import re
changed = False
for conf in Path("/etc/nginx").rglob("*.conf"):
    try:
        t = conf.read_text(encoding="utf-8")
    except Exception:
        continue
    if "torinvest" not in t and "la-forge" not in t and "app.torinvest" not in t:
        continue
    if re.search(r"client_max_body_size\s+20m\s*;", t):
        print(f"nginx OK 20m: {conf}")
        continue
    if re.search(r"client_max_body_size\s+\S+\s*;", t):
        t2 = re.sub(r"client_max_body_size\s+\S+\s*;", "client_max_body_size 20m;", t, count=1)
    else:
        t2 = re.sub(r"(server\s*\{)", r"\1\n    client_max_body_size 20m;", t, count=1)
    if t2 != t:
        conf.write_text(t2, encoding="utf-8")
        print(f"nginx {conf}: client_max_body_size 20m")
        changed = True
if changed:
    print("→ sudo nginx -t && sudo systemctl reload nginx")
PY

if command -v nginx >/dev/null 2>&1; then
  sudo nginx -t && sudo systemctl reload nginx || true
fi

pm2 restart la-forge 2>/dev/null || pm2 restart all || true

echo ""
echo "OK — vérifie :"
echo "  https://app.torinvest-trading.com/resources.html"
echo "  curl -s https://app.torinvest-trading.com/api/live-resources/ping"
echo "======== FIN HOTFIX LIVE-RESOURCES UPLOAD ========"
