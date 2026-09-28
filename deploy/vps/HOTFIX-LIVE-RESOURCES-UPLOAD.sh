#!/usr/bin/env bash
# HOTFIX — upload navigateur PDF/screens sur resources.html → VPS
#
# IMPORTANT : n'utilise PAS la variable d'environnement REF (souvent restée
# sur une ancienne branche → 404 / vieux fichiers). Forcer main (ou SHA).
#
# Sur le VPS (copier-coller tel quel) :
#   unset REF SHA BRANCH
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/HOTFIX-LIVE-RESOURCES-UPLOAD.sh" | bash
#
# Ou branche de ce PR :
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/cursor/resources-upload-deploy-691a/deploy/vps/HOTFIX-LIVE-RESOURCES-UPLOAD.sh" | bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
# Ignore REF ambiant volontairement — seul LIVE_RES_REF ou SHA force une autre ref
SCRIPT_REF="${LIVE_RES_REF:-${SHA:-cursor/resources-upload-deploy-691a}}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${SCRIPT_REF}"

echo "======== HOTFIX LIVE-RESOURCES UPLOAD ($SCRIPT_REF) ========"
echo "APP=$APP_DIR"
echo "(REF ambiant ignoré : ${REF:-∅})"

mkdir -p "$APP_DIR/public/js" "$APP_DIR/server-patches"
sudo mkdir -p /var/lib/torinvest/live-resources 2>/dev/null || mkdir -p /var/lib/torinvest/live-resources
sudo chown -R "${SUDO_USER:-$USER}:${SUDO_USER:-$USER}" /var/lib/torinvest/live-resources 2>/dev/null || true

pull() {
  local url="$1" dest="$2"
  echo "← $(basename "$dest")"
  curl -fsSL "$url" -o "$dest"
}

pull "$RAW/deploy/vps/app-shells/resources.html" "$APP_DIR/public/resources.html"
pull "$RAW/la-forge/js/forge-live-resources.js" "$APP_DIR/public/js/forge-live-resources.js"
pull "$RAW/deploy/vps/formation-server/routes-live-resources.js" \
  "$APP_DIR/server-patches/routes-live-resources.js"

# Propager routes-live-resources partout où Node peut le require
ROUTES_SRC="$APP_DIR/server-patches/routes-live-resources.js"
while IFS= read -r -d '' f; do
  dir="$(dirname "$f")"
  echo "→ sync routes-live-resources.js → $dir/"
  cp -f "$ROUTES_SRC" "$dir/routes-live-resources.js"
done < <(find "$APP_DIR" -name 'routes-formation-auth.js' -print0 2>/dev/null || true)

# Aussi copies déjà nommées routes-live-resources.js
while IFS= read -r -d '' f; do
  if [[ "$f" != "$ROUTES_SRC" ]]; then
    echo "→ update $f"
    cp -f "$ROUTES_SRC" "$f"
  fi
done < <(find "$APP_DIR" -name 'routes-live-resources.js' -print0 2>/dev/null || true)

# Vérifs anti-mauvaise-branche
if ! grep -q 'id="lr-upload"' "$APP_DIR/public/resources.html"; then
  echo "ERREUR: resources.html sans sélecteur de fichiers (mauvaise ref $SCRIPT_REF ?)"
  exit 1
fi
if ! grep -q '/api/live-resources/upload' "$APP_DIR/public/js/forge-live-resources.js"; then
  echo "ERREUR: forge-live-resources.js sans upload (mauvaise ref $SCRIPT_REF ?)"
  exit 1
fi
if ! grep -q 'live-resources/upload' "$ROUTES_SRC"; then
  echo "ERREUR: routes-live-resources.js sans POST upload"
  exit 1
fi
echo "OK fichiers : lr-upload + API upload présents"

# express.json limit (base64 PDF ~10 Mo)
python3 - <<'PY'
from pathlib import Path
import re
app = Path.home() / "torinvest-formation"
for p in [app / "server.js", *sorted(app.glob("**/server.js"))]:
    if not p.is_file():
        continue
    t = p.read_text(encoding="utf-8")
    if re.search(r'express\.json\(\s*\{\s*limit:\s*["\']20mb["\']', t):
        print(f"express.json déjà 20mb: {p}")
        break
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

# Nginx body size
python3 - <<'PY'
from pathlib import Path
import re
changed = False
root = Path("/etc/nginx")
if not root.exists():
    raise SystemExit(0)
for conf in root.rglob("*.conf"):
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
        try:
            conf.write_text(t2, encoding="utf-8")
            print(f"nginx {conf}: client_max_body_size 20m")
            changed = True
        except PermissionError:
            print(f"WARN nginx non writable: {conf} (sudo)")
if changed:
    print("→ sudo nginx -t && sudo systemctl reload nginx")
PY

if command -v nginx >/dev/null 2>&1; then
  sudo nginx -t && sudo systemctl reload nginx || true
fi

pm2 restart la-forge --update-env 2>/dev/null || pm2 restart la-forge 2>/dev/null || pm2 restart all || true
sleep 1

echo ""
echo "Vérif locale :"
grep -n 'lr-upload\|forge-live-resources.js' "$APP_DIR/public/resources.html" | head -5 || true
grep -c 'live-resources/upload' "$APP_DIR/public/js/forge-live-resources.js" || true
curl -sS -o /dev/null -w "resources.html HTTP %{http_code}\n" "http://127.0.0.1:3001/resources.html" || true
curl -sS "http://127.0.0.1:3001/api/live-resources/ping" || true
echo ""
echo "→ Hard refresh navigateur (Ctrl+Shift+R) sur https://app.torinvest-trading.com/resources.html"
echo "→ Tu dois voir « Déposer PDF / screens » (pas le message scp)"
echo "======== FIN HOTFIX LIVE-RESOURCES UPLOAD ========"
