#!/usr/bin/env bash
# Déploie les fiches de suivi coaching (API + UI) sur le VPS.
#
# Sur le VPS :
#   curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/DEPLOY-COACHING-FICHES.sh | bash
# Avant merge :
#   REF=cursor/coaching-fiches-691a curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/${REF}/deploy/vps/DEPLOY-COACHING-FICHES.sh" | bash
set -euo pipefail

if [[ -d /mnt/c/Windows ]] || [[ "$(hostname)" == DESKTOP* ]]; then
  echo "ERREUR: lance sur le VPS ubuntu@164.132.46.191, pas Windows/WSL."
  exit 1
fi

APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
REF="${REF:-main}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"

echo "======== DEPLOY COACHING FICHES ($REF) ========"
echo "APP=$APP_DIR"

mkdir -p "$APP_DIR/public/js" "$APP_DIR/public/css" "$APP_DIR/server-patches" "$APP_DIR/data/coaching-fiches"

pull() {
  local url="$1" dest="$2"
  echo "  → $dest"
  curl -fsSL "$url" -o "$dest"
}

pull "$RAW/deploy/vps/app-shells/coaching-fiches.html" "$APP_DIR/public/coaching-fiches.html"
pull "$RAW/deploy/vps/app-shells/coaching-fiche.html" "$APP_DIR/public/coaching-fiche.html"
pull "$RAW/deploy/vps/app-shells/dashboard.html" "$APP_DIR/public/dashboard.html"
pull "$RAW/la-forge/js/forge-coaching-fiches.js" "$APP_DIR/public/js/forge-coaching-fiches.js"
pull "$RAW/la-forge/js/forge-brand.js" "$APP_DIR/public/js/forge-brand.js"
pull "$RAW/la-forge/css/forge-coaching-fiches.css" "$APP_DIR/public/css/forge-coaching-fiches.css"
pull "$RAW/deploy/vps/formation-server/routes-coaching-fiches.js" "$APP_DIR/server-patches/routes-coaching-fiches.js"
pull "$RAW/deploy/vps/wire-formation-server-patches.js" "$APP_DIR/wire-formation-server-patches.js"

# Wire router into server.js (idempotent helper below)
APP_DIR="$APP_DIR" node <<'NODE'
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const APP_DIR = process.env.APP_DIR || process.env.HOME + "/torinvest-formation";
const candidates = ["server.js", "app.js", "index.js"];
let serverPath = null;
for (const name of candidates) {
  const p = path.join(APP_DIR, name);
  if (fs.existsSync(p)) { serverPath = p; break; }
}
if (!serverPath) {
  console.error("ERREUR: server.js introuvable");
  process.exit(1);
}

let content = fs.readFileSync(serverPath, "utf8");
const original = content;

if (/createCoachingFichesRouter|routes-coaching-fiches/.test(content)) {
  console.log("OK — coaching fiches déjà monté.");
} else {
  if (!/createCoachingFichesRouter/.test(content)) {
    const anchor =
      /(const createCoachingLivesRouter = require\(["']\.\/server-patches\/routes-coaching-lives["']\);)/;
    if (anchor.test(content)) {
      content = content.replace(
        anchor,
        '$1\nconst createCoachingFichesRouter = require("./server-patches/routes-coaching-fiches");'
      );
    } else {
      const anyPatch = /(const createCalendarRouter = require\([^)]+\);)/;
      content = content.replace(
        anyPatch,
        '$1\nconst createCoachingFichesRouter = require("./server-patches/routes-coaching-fiches");'
      );
    }
  }

  const livesUse = /app\.use\(\s*createCoachingLivesRouter\(\{[\s\S]*?\}\)\s*\);/m;
  const calUse = /app\.use\(\s*createCalendarRouter\(\{[\s\S]*?\}\)\s*\);/m;
  let dataDirExpr = 'path.join(__dirname, "data")';
  let insertAfter = null;

  if (livesUse.test(content)) {
    const m = content.match(livesUse);
    insertAfter = m[0];
    const dm = m[0].match(/dataDir:\s*([\s\S]*?),\s*requireAuth/);
    if (dm) dataDirExpr = dm[1].trim();
  } else if (calUse.test(content)) {
    const m = content.match(calUse);
    insertAfter = m[0];
    const dm = m[0].match(/dataDir:\s*([\s\S]*?),\s*requireAuth/);
    if (dm) dataDirExpr = dm[1].trim();
  }

  if (!insertAfter) {
    console.error("ERREUR: point d'insertion app.use introuvable");
    process.exit(1);
  }

  const block = [
    "app.use(",
    "  createCoachingFichesRouter({",
    "    dataDir: " + dataDirExpr + ",",
    "    requireAuth,",
    "  })",
    ");",
  ].join("\n");

  content = content.replace(insertAfter, insertAfter + "\n" + block);
  console.log("Coaching fiches router ajouté.");
}

if (content !== original) {
  const backup = serverPath + ".bak.fiches." + Date.now();
  fs.writeFileSync(backup, original);
  fs.writeFileSync(serverPath, content);
  try {
    execSync("node --check " + JSON.stringify(serverPath), { stdio: "pipe" });
  } catch (e) {
    fs.writeFileSync(serverPath, original);
    console.error("ERREUR syntaxe — restauré");
    process.exit(1);
  }
  console.log("Sauvegarde:", backup);
}

if (!String(process.env.FORGE_ADMIN_EMAILS || "").trim()) {
  console.warn("WARN: FORGE_ADMIN_EMAILS vide — définis ton email admin puis pm2 restart --update-env");
}
NODE

# Ensure admin email (lien dashboard + édition)
ADMIN_EMAIL="${ADMIN_EMAIL:-abonne@torinvest-trading.com}"
ENV_FILE="$APP_DIR/.env"
touch "$ENV_FILE"
if grep -q '^FORGE_ADMIN_EMAILS=' "$ENV_FILE" 2>/dev/null; then
  # Ne pas écraser s'il y a déjà une valeur non vide, sauf si ADMIN_EMAIL est passé explicitement
  if [[ -n "${ADMIN_EMAIL_FORCE:-}" ]] || ! grep -q '^FORGE_ADMIN_EMAILS=.\+' "$ENV_FILE"; then
    sed -i "s|^FORGE_ADMIN_EMAILS=.*|FORGE_ADMIN_EMAILS=${ADMIN_EMAIL}|" "$ENV_FILE"
  fi
else
  echo "FORGE_ADMIN_EMAILS=${ADMIN_EMAIL}" >> "$ENV_FILE"
fi
# Merge ADMIN_EMAIL into list if missing
if ! grep -qi "^FORGE_ADMIN_EMAILS=.*${ADMIN_EMAIL}" "$ENV_FILE"; then
  cur=$(grep '^FORGE_ADMIN_EMAILS=' "$ENV_FILE" | head -1 | cut -d= -f2-)
  if [[ -z "$cur" ]]; then
    sed -i "s|^FORGE_ADMIN_EMAILS=.*|FORGE_ADMIN_EMAILS=${ADMIN_EMAIL}|" "$ENV_FILE"
  else
    sed -i "s|^FORGE_ADMIN_EMAILS=.*|FORGE_ADMIN_EMAILS=${cur},${ADMIN_EMAIL}|" "$ENV_FILE"
  fi
fi
echo "FORGE_ADMIN_EMAILS=$(grep '^FORGE_ADMIN_EMAILS=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
export FORGE_ADMIN_EMAILS="$(grep '^FORGE_ADMIN_EMAILS=' "$ENV_FILE" | head -1 | cut -d= -f2-)"

# PM2: inject env if ecosystem used
if [[ -f "$APP_DIR/ecosystem.config.js" ]] || [[ -f "$APP_DIR/ecosystem.config.cjs" ]]; then
  echo "NOTE: si PM2 n'utilise pas .env, lance : pm2 restart la-forge --update-env"
fi

pm2 restart la-forge --update-env || pm2 restart all --update-env || true
sleep 1

echo ""
echo "Vérif locale :"
curl -sS -o /dev/null -w "coaching-fiches.html %{http_code}\n" "http://127.0.0.1:3001/coaching-fiches.html" || true
curl -sS -o /dev/null -w "dashboard.html %{http_code}\n" "http://127.0.0.1:3001/dashboard.html" || true
curl -sS -o /dev/null -w "forge-coaching-fiches.js %{http_code}\n" "http://127.0.0.1:3001/js/forge-coaching-fiches.js" || true
grep -n "data-cf-admin-nav\|Fiches coaching\|auth.js" "$APP_DIR/public/coaching-fiches.html" "$APP_DIR/public/dashboard.html" | head -20 || true

echo ""
echo "Public :"
echo "  https://app.torinvest-trading.com/coaching-fiches.html  (toi = admin)"
echo "  https://app.torinvest-trading.com/dashboard.html  → lien Fiches coaching si isAdmin"
echo "  Connecte-toi avec l'email admin : $ADMIN_EMAIL"
echo "======== DONE ========"
