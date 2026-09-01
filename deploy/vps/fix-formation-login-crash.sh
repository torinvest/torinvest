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
  echo "ERREUR: routes-formation-auth.js sans garde session"
  exit 1
fi
echo "OK — routes-formation-auth.js (garde session)"

if [[ ! -f "$SERVER" ]]; then
  echo "ERREUR: $SERVER introuvable"
  exit 1
fi

node - "$SERVER" <<'NODE'
const fs = require("fs");
const serverPath = process.argv[2];
let content = fs.readFileSync(serverPath, "utf8");

const blockRe = /\/\* TORINVEST_ACCOMPAGNEMENT_AUTH_BEGIN \*\/[\s\S]*?\/\* TORINVEST_ACCOMPAGNEMENT_AUTH_END \*\/\s*/;
const sessionRe = /app\.use\s*\(\s*session\s*\([\s\S]*?\)\s*;\s*/m;

const m = content.match(blockRe);
if (!m) {
  console.log("WARN — bloc ACCOMPAGNEMENT_AUTH absent");
  process.exit(0);
}

const block = m[0];
const without = content.slice(0, m.index) + content.slice(m.index + block.length);
const sm = without.match(sessionRe);
if (!sm) {
  console.error("ERREUR: app.use(session…) introuvable");
  process.exit(1);
}

const insertAt = sm.index + sm[0].length;
if (without.slice(insertAt, insertAt + 120).includes("ACCOMPAGNEMENT_AUTH_BEGIN")) {
  console.log("OK — bloc déjà après session");
  process.exit(0);
}

const backup = serverPath + ".bak." + Date.now();
fs.writeFileSync(backup, content);
const newContent = without.slice(0, insertAt) + "\n" + block + without.slice(insertAt);
fs.writeFileSync(serverPath, newContent);
console.log("OK — bloc accompagnement déplacé après express-session");
console.log("Sauvegarde:", backup);
NODE

node --check "$SERVER"

source ~/.profile 2>/dev/null || true
pm2 restart la-forge --update-env 2>/dev/null || pm2 restart la-forge

sleep 2
echo "==> test login"
curl -s -X POST 'https://app.torinvest-trading.com/api/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"abonne@torinvest-trading.com","password":"AdminFonda2026!"}' | head -c 200
echo ""
echo "==> logs"
pm2 logs la-forge --lines 6 --nostream 2>/dev/null | tail -10 || true
echo "OK — fix terminé"
