#!/usr/bin/env bash
# HOTFIX — API upload live-resources (corrige 404 Envoi 1/N)
#
# Cause typique : le HTML/JS est à jour mais Node charge encore
# l'ancien routes-live-resources.js (sans POST /upload).
#
# Sur le VPS (copier-coller tel quel) :
#   unset REF SHA BRANCH
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/cursor/resources-upload-api-404-691a/deploy/vps/HOTFIX-LIVE-RESOURCES-UPLOAD.sh" | bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
# Ignore REF ambiant
SCRIPT_REF="${LIVE_RES_REF:-${SHA:-cursor/resources-upload-api-404-691a}}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${SCRIPT_REF}"

echo "======== HOTFIX LIVE-RESOURCES UPLOAD API ($SCRIPT_REF) ========"

# Détecter le vrai cwd PM2 (parfois ≠ APP_DIR)
PM2_CWD="$(pm2 jlist 2>/dev/null | python3 -c '
import json,sys
try:
  apps=json.load(sys.stdin)
except Exception:
  apps=[]
for a in apps:
  if a.get("name")=="la-forge":
    print((a.get("pm2_env") or {}).get("pm_cwd") or "")
    break
' 2>/dev/null || true)"
if [[ -n "${PM2_CWD}" && -d "${PM2_CWD}" ]]; then
  echo "PM2 cwd la-forge: $PM2_CWD"
  APP_DIR="$PM2_CWD"
fi
echo "APP=$APP_DIR"

mkdir -p "$APP_DIR/public/js" "$APP_DIR/server-patches"
sudo mkdir -p /var/lib/torinvest/live-resources 2>/dev/null || mkdir -p /var/lib/torinvest/live-resources || true
sudo chown -R "${SUDO_USER:-$USER}:${SUDO_USER:-$USER}" /var/lib/torinvest/live-resources 2>/dev/null || true

pull() {
  local url="$1" dest="$2"
  echo "← $(basename "$dest")"
  curl -fsSL "$url" -o "$dest"
}

TMP="$(mktemp -d)"
pull "$RAW/deploy/vps/app-shells/resources.html" "$TMP/resources.html"
pull "$RAW/la-forge/js/forge-live-resources.js" "$TMP/forge-live-resources.js"
pull "$RAW/deploy/vps/formation-server/routes-live-resources.js" "$TMP/routes-live-resources.js"
pull "$RAW/deploy/vps/formation-server/routes-formation-auth.js" "$TMP/routes-formation-auth.js"

# Sanity des artefacts téléchargés
grep -q 'live-resources/upload' "$TMP/routes-live-resources.js"
grep -q '"upload": true\|upload: true' "$TMP/routes-live-resources.js" || grep -q 'version: 3' "$TMP/routes-live-resources.js"
grep -q 'pendingFiles\|uploadMany' "$TMP/forge-live-resources.js"
grep -q 'lr-upload-queue' "$TMP/resources.html"

cp -f "$TMP/resources.html" "$APP_DIR/public/resources.html"
cp -f "$TMP/forge-live-resources.js" "$APP_DIR/public/js/forge-live-resources.js"
cp -f "$TMP/routes-live-resources.js" "$APP_DIR/server-patches/routes-live-resources.js"
cp -f "$TMP/routes-formation-auth.js" "$APP_DIR/server-patches/routes-formation-auth.js"

# Propager routes-live-resources.js à côté de CHAQUE require possible
UPDATED=0
while IFS= read -r -d '' f; do
  dir="$(dirname "$f")"
  cp -f "$TMP/routes-live-resources.js" "$dir/routes-live-resources.js"
  echo "→ routes-live-resources.js @ $dir/"
  UPDATED=$((UPDATED + 1))
done < <(find "$APP_DIR" -name 'routes-formation-auth.js' -print0 2>/dev/null || true)

while IFS= read -r -d '' f; do
  cp -f "$TMP/routes-live-resources.js" "$f"
  echo "→ overwrite $f"
  UPDATED=$((UPDATED + 1))
done < <(find "$APP_DIR" -name 'routes-live-resources.js' -print0 2>/dev/null || true)

# Copie aussi à la racine app (au cas où require("./routes-live-resources"))
cp -f "$TMP/routes-live-resources.js" "$APP_DIR/routes-live-resources.js"
echo "Copies mises à jour: $UPDATED (+ root)"

# Vérifier que TOUS les fichiers routes-live-resources contiennent upload
BAD=0
while IFS= read -r -d '' f; do
  if ! grep -q 'live-resources/upload' "$f"; then
    echo "ERREUR: $f sans /upload"
    BAD=$((BAD + 1))
  fi
done < <(find "$APP_DIR" -name 'routes-live-resources.js' -print0 2>/dev/null || true)
if [[ "$BAD" -gt 0 ]]; then
  echo "Abort: $BAD fichier(s) routes encore anciens"
  exit 1
fi

# express.json 20mb
python3 - "$APP_DIR" <<'PY'
from pathlib import Path
import re, sys
app = Path(sys.argv[1])
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
        print(f"express.json → 20mb ({p})")
    elif "express.json()" in t:
        p.write_text(t.replace("express.json()", 'express.json({ limit: "20mb" })', 1), encoding="utf-8")
        print(f"express.json() → 20mb ({p})")
    else:
        print(f"WARN: express.json introuvable dans {p}")
    break
PY

# nginx body
python3 - <<'PY'
from pathlib import Path
import re
root = Path("/etc/nginx")
if not root.exists():
    raise SystemExit(0)
changed = False
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
            print(f"nginx {conf}: 20m")
            changed = True
        except PermissionError:
            print(f"WARN nginx non writable: {conf}")
if changed:
    print("→ reload nginx")
PY

if command -v nginx >/dev/null 2>&1; then
  sudo nginx -t && sudo systemctl reload nginx || true
fi

# Restart dur pour vider le require cache Node
pm2 restart la-forge --update-env 2>/dev/null || pm2 restart la-forge || pm2 restart all || true
sleep 2

echo ""
echo "=== Resolve module Node ==="
(
  cd "$APP_DIR"
  node -e '
    const fs=require("fs");
    const paths=[
      "./server-patches/routes-live-resources",
      "./routes-live-resources",
    ];
    for (const p of paths) {
      try {
        const r=require.resolve(p);
        const ok=fs.readFileSync(r,"utf8").includes("live-resources/upload");
        console.log(p, "→", r, "upload=", ok);
      } catch (e) {
        console.log(p, "→ MISSING");
      }
    }
  ' || true
)

echo ""
echo "=== Vérification API ==="
PING="$(curl -sS "http://127.0.0.1:3001/api/live-resources/ping" || true)"
echo "ping: $PING"
echo "$PING" | grep -q '"upload":true\|"upload": true' || echo "WARN: ping sans upload:true — mauvais module encore chargé ?"

CODE="$(curl -sS -o /tmp/lr-upload-test.body -w "%{http_code}" -X POST "http://127.0.0.1:3001/api/live-resources/upload" \
  -H "Content-Type: application/json" \
  -d '{"dataUrl":"data:image/png;base64,AAAA"}' || true)"
echo "POST /api/live-resources/upload → HTTP $CODE"
head -c 200 /tmp/lr-upload-test.body 2>/dev/null; echo

if [[ "$CODE" == "404" ]]; then
  echo ""
  echo "ÉCHEC: upload encore en 404. Fichiers routes présents :"
  find "$APP_DIR" -name 'routes-live-resources.js' -print 2>/dev/null || true
  echo "Contenu require formation-auth :"
  rg -n "routes-live-resources|createLiveResources" "$APP_DIR/server-patches/routes-formation-auth.js" "$APP_DIR/server.js" 2>/dev/null | head -20 || true
  exit 1
fi

if [[ "$CODE" == "401" || "$CODE" == "400" || "$CODE" == "403" ]]; then
  echo "OK — route upload montée (HTTP $CODE = auth/validation, pas 404)."
else
  echo "WARN — HTTP inattendu $CODE (mais ≠ 404)."
fi

rm -rf "$TMP"
echo ""
echo "→ Hard refresh Ctrl+Shift+R sur https://app.torinvest-trading.com/resources.html"
echo "→ Puis republier les 10 screens"
echo "======== FIN HOTFIX ========"
