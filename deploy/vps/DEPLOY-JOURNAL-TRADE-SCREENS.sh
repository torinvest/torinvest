#!/usr/bin/env bash
# Journal — shell Forge = iframe TJ Pro UNIQUEMENT + screens JPG/PNG injectés DANS TJ
#
# Sur le VPS (UNE seule commande) :
#   unset REF SHA BRANCH JOURNAL_SCREENS_REF; curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/cursor/journal-tj-only-screens-691a/deploy/vps/DEPLOY-JOURNAL-TRADE-SCREENS.sh" | bash
#
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
# Toujours tirer depuis ce déploiement (ignore REF/SHA/BRANCH ambiants)
unset REF SHA BRANCH 2>/dev/null || true
# Pin commit (évite branches ambiantes / cache) — branche: cursor/journal-tj-only-screens-691a
SCRIPT_REF="${JOURNAL_SCREENS_REF:-e65449b07d549a0b8cc7bc51dbb840e12ff3224f"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${SCRIPT_REF}"
EXPECTED_JS_VER="v=12"

echo "======== DEPLOY JOURNAL TJ-ONLY + SCREENS INJECT ($SCRIPT_REF) ========"
echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Résoudre le vrai cwd PM2 (évite de déployer dans le mauvais dossier)
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

if [[ ! -d "$APP_DIR" ]]; then
  echo "ÉCHEC: APP_DIR introuvable: $APP_DIR"
  exit 1
fi

mkdir -p "$APP_DIR/public/js" "$APP_DIR/server-patches"
sudo mkdir -p /var/lib/torinvest/journal-trade-screens 2>/dev/null || mkdir -p /var/lib/torinvest/journal-trade-screens || true
sudo chown -R "${SUDO_USER:-$USER}:${SUDO_USER:-$USER}" /var/lib/torinvest/journal-trade-screens 2>/dev/null || true

pull() {
  local url="$1" dest="$2"
  echo "← $(basename "$dest")"
  curl -fsSL "$url" -o "$dest"
}

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pull "$RAW/deploy/vps/app-shells/journal.html" "$TMP/journal.html"
pull "$RAW/deploy/vps/app-shells/dashboard.html" "$TMP/dashboard.html"
pull "$RAW/la-forge/js/forge-journal.js" "$TMP/forge-journal.js"
pull "$RAW/la-forge/js/forge-journal-trade-screens.js" "$TMP/forge-journal-trade-screens.js"
pull "$RAW/deploy/vps/formation-server/routes-journal-trade-screens.js" "$TMP/routes-journal-trade-screens.js"
pull "$RAW/deploy/vps/formation-server/routes-journal-bridge.js" "$TMP/routes-journal-bridge.js"
pull "$RAW/deploy/vps/formation-server/routes-formation-auth.js" "$TMP/routes-formation-auth.js"

# Sanity des artefacts GitHub AVANT copie — shell TJ-only (PAS de barre bleue screens)
grep -q 'journal-frame' "$TMP/journal.html"
grep -q "forge-journal.js?${EXPECTED_JS_VER}" "$TMP/journal.html"
grep -q 'showFrame\|journal-embed' "$TMP/forge-journal.js"
grep -q 'journal-trade-screens/ping' "$TMP/routes-journal-trade-screens.js"
grep -q 'pruneEmptyTrades\|imageCount' "$TMP/routes-journal-trade-screens.js"
grep -q 'createJournalTradeScreensRouter' "$TMP/routes-formation-auth.js"
grep -q 'forge-journal-trade-screens.js' "$TMP/routes-journal-bridge.js"
grep -q 'Screens trades\|forge-jts-nav\|forge-jts-panel' "$TMP/forge-journal-trade-screens.js"
if grep -q 'journal-screens-bar\|Déposer des screens\|showJournalWithScreens\|jts-dropzone' "$TMP/journal.html"; then
  echo "ÉCHEC: artefact GitHub encore en UI shell screens (barre bleue) — mauvais SCRIPT_REF=$SCRIPT_REF ?"
  exit 1
fi
if grep -q 'journal-screens-bar\|showJournalWithScreens\|pendingFiles' "$TMP/forge-journal.js"; then
  echo "ÉCHEC: forge-journal.js encore en UI shell screens — mauvais SCRIPT_REF=$SCRIPT_REF ?"
  exit 1
fi
if grep -q 'journal-tabs\|Screenshots JPG/PNG' "$TMP/journal.html"; then
  echo "ÉCHEC: artefact GitHub encore en UI onglets — mauvais SCRIPT_REF=$SCRIPT_REF ?"
  exit 1
fi

# Copie principale
cp -f "$TMP/journal.html" "$APP_DIR/public/journal.html"
cp -f "$TMP/dashboard.html" "$APP_DIR/public/dashboard.html"
cp -f "$TMP/forge-journal.js" "$APP_DIR/public/js/forge-journal.js"
cp -f "$TMP/forge-journal-trade-screens.js" "$APP_DIR/public/js/forge-journal-trade-screens.js"
cp -f "$TMP/routes-journal-trade-screens.js" "$APP_DIR/server-patches/routes-journal-trade-screens.js"
cp -f "$TMP/routes-journal-bridge.js" "$APP_DIR/server-patches/routes-journal-bridge.js"
cp -f "$TMP/routes-formation-auth.js" "$APP_DIR/server-patches/routes-formation-auth.js"
# require("./routes-journal-trade-screens") depuis racine app
cp -f "$TMP/routes-journal-trade-screens.js" "$APP_DIR/routes-journal-trade-screens.js"
cp -f "$TMP/routes-formation-auth.js" "$APP_DIR/routes-formation-auth.js" 2>/dev/null || true

# Écraser TOUTES les copies journal.html / forge-journal.js sous l’app
UPDATED=0
while IFS= read -r -d '' f; do
  cp -f "$TMP/journal.html" "$f"
  echo "→ journal.html @ $f"
  UPDATED=$((UPDATED + 1))
done < <(find "$APP_DIR" -name 'journal.html' -print0 2>/dev/null || true)

while IFS= read -r -d '' f; do
  case "$f" in
    */public/js/forge-journal.js|*/js/forge-journal.js) cp -f "$TMP/forge-journal.js" "$f"; echo "→ forge-journal.js @ $f"; UPDATED=$((UPDATED + 1)) ;;
  esac
done < <(find "$APP_DIR" -name 'forge-journal.js' -print0 2>/dev/null || true)

while IFS= read -r -d '' f; do
  case "$f" in
    */public/js/forge-journal-trade-screens.js|*/js/forge-journal-trade-screens.js)
      cp -f "$TMP/forge-journal-trade-screens.js" "$f"
      echo "→ forge-journal-trade-screens.js @ $f"
      UPDATED=$((UPDATED + 1))
      ;;
  esac
done < <(find "$APP_DIR" -name 'forge-journal-trade-screens.js' -print0 2>/dev/null || true)

while IFS= read -r -d '' f; do
  dir="$(dirname "$f")"
  cp -f "$TMP/routes-journal-trade-screens.js" "$dir/routes-journal-trade-screens.js"
  cp -f "$TMP/routes-journal-bridge.js" "$dir/routes-journal-bridge.js"
  cp -f "$TMP/routes-formation-auth.js" "$dir/routes-formation-auth.js"
  echo "→ sync routes @ $dir/"
  UPDATED=$((UPDATED + 1))
done < <(find "$APP_DIR" -name 'routes-formation-auth.js' -print0 2>/dev/null || true)

while IFS= read -r -d '' f; do
  cp -f "$TMP/routes-journal-trade-screens.js" "$f"
  echo "→ overwrite $f"
  UPDATED=$((UPDATED + 1))
done < <(find "$APP_DIR" -name 'routes-journal-trade-screens.js' -print0 2>/dev/null || true)

echo "Copies mises à jour: $UPDATED"

# Stamp version pour debug
echo "ref=${SCRIPT_REF} js=${EXPECTED_JS_VER} mode=tj-only-inject at=$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$APP_DIR/public/journal-screens.deploy.txt"

BAD=0
while IFS= read -r -d '' f; do
  if ! grep -q 'journal-trade-screens/ping' "$f"; then
    echo "ERREUR: $f sans /ping"
    BAD=$((BAD + 1))
  fi
done < <(find "$APP_DIR" -name 'routes-journal-trade-screens.js' -print0 2>/dev/null || true)
if [[ "$BAD" -gt 0 ]]; then
  echo "Abort: $BAD fichier(s) routes encore anciens"
  exit 1
fi

# express.json 12mb+ pour dataUrl
python3 - "$APP_DIR" <<'PY'
from pathlib import Path
import re, sys
app = Path(sys.argv[1])
for p in [app / "server.js", *sorted(app.glob("**/server.js"))]:
    if not p.is_file():
        continue
    t = p.read_text(encoding="utf-8")
    if re.search(r'express\.json\(\s*\{\s*limit:\s*["\'](?:12|20)mb["\']', t):
        print(f"express.json OK: {p}")
        break
    if re.search(r'express\.json\(\s*\{\s*limit:\s*["\']\d+mb["\']\s*\}\s*\)', t):
        t2 = re.sub(
            r'express\.json\(\s*\{\s*limit:\s*["\']\d+mb["\']\s*\}\s*\)',
            'express.json({ limit: "12mb" })',
            t,
            count=1,
        )
        p.write_text(t2, encoding="utf-8")
        print(f"express.json → 12mb ({p})")
    elif "express.json()" in t:
        p.write_text(t.replace("express.json()", 'express.json({ limit: "12mb" })', 1), encoding="utf-8")
        print(f"express.json() → 12mb ({p})")
    break
PY

# Soft-delete Node require cache: delete + restart
pm2 stop la-forge 2>/dev/null || true
sleep 1
pm2 restart la-forge --update-env 2>/dev/null || pm2 start la-forge 2>/dev/null || pm2 restart la-forge || pm2 restart all || true
sleep 2

# Nginx: recharger si présent (cache / config)
sudo nginx -t 2>/dev/null && sudo systemctl reload nginx 2>/dev/null || true

echo ""
echo "=== Resolve module Node ==="
(
  cd "$APP_DIR"
  node -e '
    const fs=require("fs");
    const paths=[
      "./server-patches/routes-journal-trade-screens",
      "./routes-journal-trade-screens",
      "./server-patches/routes-formation-auth",
      "./server-patches/routes-journal-bridge",
    ];
    for (const p of paths) {
      try {
        const r=require.resolve(p);
        const txt=fs.readFileSync(r,"utf8");
        const ok=txt.includes("journal-trade-screens/ping") || txt.includes("createJournalTradeScreensRouter") || txt.includes("forge-journal-trade-screens");
        console.log(p, "→", r, "ok=", ok);
      } catch (e) {
        console.log(p, "→ MISSING");
      }
    }
  ' || true
)

echo ""
echo "=== Vérification API locale ==="
PING="$(curl -sS "http://127.0.0.1:3001/api/journal-trade-screens/ping" || true)"
echo "ping: $PING"
CODE="$(curl -sS -o /tmp/jts-ping.body -w "%{http_code}" "http://127.0.0.1:3001/api/journal-trade-screens/ping" || true)"
echo "GET /api/journal-trade-screens/ping → HTTP $CODE"
head -c 200 /tmp/jts-ping.body 2>/dev/null; echo

if [[ "$CODE" == "404" ]] || ! echo "$PING" | grep -q '"ok"\s*:\s*true\|"ok":true'; then
  echo ""
  echo "ÉCHEC: API journal-trade-screens absente (HTTP $CODE)."
  echo "Fichiers routes présents :"
  find "$APP_DIR" -name 'routes-journal-trade-screens.js' -print 2>/dev/null || true
  echo "Contenu require formation-auth :"
  grep -n "journal-trade-screens\|createJournalTradeScreens" \
    "$APP_DIR/server-patches/routes-formation-auth.js" "$APP_DIR/server.js" 2>/dev/null | head -30 || true
  echo "PM2 status:"
  pm2 describe la-forge 2>/dev/null | head -40 || pm2 list || true
  exit 1
fi

echo "OK — ping API monté."

# Sanity shell public — TJ Pro only, PAS de barre bleue
echo ""
echo "=== Sanity fichiers locaux ==="
grep -q 'journal-frame' "$APP_DIR/public/journal.html"
grep -q "forge-journal.js?${EXPECTED_JS_VER}" "$APP_DIR/public/journal.html"
grep -q 'showFrame\|journal-embed' "$APP_DIR/public/js/forge-journal.js"
grep -q 'Screens trades\|forge-jts-nav' "$APP_DIR/public/js/forge-journal-trade-screens.js"
grep -q 'forge-journal-trade-screens.js' "$APP_DIR/server-patches/routes-journal-bridge.js"
if grep -q 'journal-screens-bar\|Déposer des screens\|showJournalWithScreens' "$APP_DIR/public/journal.html" \
  || grep -q 'journal-screens-bar\|showJournalWithScreens' "$APP_DIR/public/js/forge-journal.js"; then
  echo "ÉCHEC: barre bleue / shell screens encore présente"
  exit 1
fi
if grep -q 'journal-tabs\|Screenshots JPG/PNG' "$APP_DIR/public/journal.html"; then
  echo "ÉCHEC: ancienne UI à onglets encore présente dans journal.html"
  exit 1
fi
echo "local journal.html: TJ-only + ${EXPECTED_JS_VER} OK"

# Vérif HTTP public
echo ""
echo "=== Sanity HTTP public ==="
PUB_HTML="$(curl -fsSL -H 'Cache-Control: no-cache' "https://app.torinvest-trading.com/journal.html?_=$(date +%s)" 2>/dev/null || true)"
if [[ -n "$PUB_HTML" ]]; then
  if echo "$PUB_HTML" | grep -q 'journal-screens-bar\|Déposer des screens'; then
    echo "ATTENTION: le site public sert ENCORE la barre bleue screens."
    echo "→ Vérifie qu’nginx pointe bien vers $APP_DIR/public + hard refresh"
  fi
  if echo "$PUB_HTML" | grep -q "forge-journal.js?${EXPECTED_JS_VER}" && ! echo "$PUB_HTML" | grep -q 'journal-screens-bar'; then
    echo "public journal.html: TJ-only + ${EXPECTED_JS_VER} OK"
  else
    echo "public journal.html: pas encore ${EXPECTED_JS_VER} / TJ-only (cache ou mauvais root nginx)"
    echo "Fichier local sha1: $(sha1sum "$APP_DIR/public/journal.html" | awk '{print $1}')"
  fi
else
  echo "(skip check public — curl externe indisponible)"
fi

echo ""
echo "→ Hard refresh Ctrl+Shift+R sur :"
echo "  https://app.torinvest-trading.com/journal.html"
echo "→ Attendu :"
echo "  • UNIQUEMENT le journal blanc TJ Pro (iframe) — PAS de barre bleue au-dessus"
echo "  • forge-journal.js?${EXPECTED_JS_VER}"
echo "  • Dans TJ : sidebar « Screens trades » + upload JPG/PNG sur Ajouter un trade"
echo "======== DONE ========"
