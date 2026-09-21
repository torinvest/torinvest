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

# Ensure admin env hint
if ! grep -q 'FORGE_ADMIN_EMAILS' "$APP_DIR/ecosystem.config.js" 2>/dev/null && \
   ! grep -q 'FORGE_ADMIN_EMAILS' "$APP_DIR/.env" 2>/dev/null; then
  echo "NOTE: vérifie que FORGE_ADMIN_EMAILS contient ton email dans l'env PM2."
fi

pm2 restart la-forge --update-env || pm2 restart all --update-env || true
sleep 1

echo ""
echo "Vérif locale :"
curl -sS -o /dev/null -w "coaching-fiches.html %{http_code}\n" "http://127.0.0.1:3001/coaching-fiches.html" || true
curl -sS -o /dev/null -w "coaching-fiche.html %{http_code}\n" "http://127.0.0.1:3001/coaching-fiche.html" || true
curl -sS -o /dev/null -w "forge-coaching-fiches.js %{http_code}\n" "http://127.0.0.1:3001/js/forge-coaching-fiches.js" || true

echo ""
echo "Public :"
echo "  https://app.torinvest-trading.com/coaching-fiches.html  (toi = admin)"
echo "  https://app.torinvest-trading.com/coaching-fiche.html?t=TOKEN  (élève)"
echo "======== DONE ========"
