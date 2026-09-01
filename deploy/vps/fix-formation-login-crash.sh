#!/usr/bin/env bash
# Corrige crash login : req.session undefined + déplace auth après express-session.
#
# Usage VPS formation :
#   curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/fix-formation-login-crash.sh" | bash -s -- ~/torinvest-formation

set -euo pipefail

APP_DIR="${1:-$HOME/torinvest-formation}"
SHA="${SHA:-main}"
BASE="https://raw.githubusercontent.com/torinvest/torinvest/${SHA}"
SERVER="$APP_DIR/server.js"
PATCHES="$APP_DIR/server-patches"

echo "==> fix-formation-login-crash → $APP_DIR"

mkdir -p "$PATCHES"
curl -fsSL "$BASE/deploy/vps/formation-server/routes-formation-auth.js" -o "$PATCHES/routes-formation-auth.js"

if ! grep -q 'if (!req.session)' "$PATCHES/routes-formation-auth.js"; then
  echo "ERREUR: routes-formation-auth.js sans garde session — ref GitHub invalide"
  exit 1
fi
echo "OK — routes-formation-auth.js (garde session présente)"

if [[ ! -f "$SERVER" ]]; then
  echo "ERREUR: $SERVER introuvable"
  exit 1
fi

python3 <<'PY' "$SERVER"
import re, sys, pathlib
path = pathlib.Path(sys.argv[1])
content = path.read_text()
original = content

block_re = re.compile(
    r"/\* TORINVEST_ACCOMPAGNEMENT_AUTH_BEGIN \*/.*?/\* TORINVEST_ACCOMPAGNEMENT_AUTH_END \*/\s*",
    re.DOTALL,
)
session_re = re.compile(r"app\.use\s*\(\s*session\s*\([\s\S]*?\)\s*;\s*", re.MULTILINE)

m = block_re.search(content)
if not m:
    print("WARN — bloc ACCOMPAGNEMENT_AUTH absent (déjà déplacé ou non installé)")
    sys.exit(0)

block = m.group(0)
content_wo = content[:m.start()] + content[m.end():]

sm = session_re.search(content_wo)
if not sm:
    print("ERREUR: app.use(session…) introuvable dans server.js")
    sys.exit(1)

insert_at = sm.end()
# déjà juste après session ?
after = content_wo[insert_at:insert_at + 80]
if "TORINVEST_ACCOMPAGNEMENT_AUTH_BEGIN" in after:
    print("OK — bloc accompagnement déjà après session")
    sys.exit(0)

new_content = content_wo[:insert_at] + "\n" + block + content_wo[insert_at:]
path.write_text(new_content)
print("OK — bloc accompagnement déplacé après express-session")
PY

node --check "$SERVER"

source ~/.profile 2>/dev/null || true
pm2 restart la-forge --update-env 2>/dev/null || pm2 restart la-forge

sleep 2
echo "==> test login (doit répondre JSON, pas 502)"
curl -s -X POST 'https://app.torinvest-trading.com/api/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"wrong@x.com","password":"x"}' | head -c 120
echo ""
pm2 logs la-forge --lines 5 --nostream 2>/dev/null | tail -8
echo "OK — fix appliqué"
