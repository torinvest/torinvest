#!/usr/bin/env node
/**
 * Monte (ou complète) les patches formation dans server.js sur le VPS.
 * - Paywall /course/*
 * - /api/progress
 * - /api/calendar
 *
 * Prérequis : requireAuth déjà défini dans server.js (session /api/me).
 *
 * Usage :
 *   node deploy/vps/wire-formation-server-patches.js /home/ubuntu/torinvest-formation
 */
"use strict";

const fs = require("fs");
const path = require("path");

const APP_DIR = process.argv[2] || "/home/ubuntu/torinvest-formation";
const candidates = ["server.js", "app.js", "index.js"];

let serverPath = null;
for (const name of candidates) {
  const p = path.join(APP_DIR, name);
  if (fs.existsSync(p)) {
    serverPath = p;
    break;
  }
}

if (!serverPath) {
  console.error("ERREUR : aucun server.js / app.js dans", APP_DIR);
  process.exit(1);
}

let content = fs.readFileSync(serverPath, "utf8");
const original = content;

const MARK_BEGIN = "/* TORINVEST_FORMATION_PATCHES_BEGIN */";
const MARK_END = "/* TORINVEST_FORMATION_PATCHES_END */";

function hasProgress() {
  return /createProgressRouter|routes-progress/.test(content);
}
function hasCalendar() {
  return /createCalendarRouter|routes-calendar/.test(content);
}
function hasPaywall() {
  return /requireSubscribedForCourse|middleware-require-subscribed/.test(content);
}

function extractDataDirFromProgressBlock(block) {
  if (!block) return "path.join(__dirname, \"data\")";
  const m = block.match(/dataDir:\s*([\s\S]*?),\s*requireAuth/m);
  if (m) return m[1].replace(/\s+/g, " ").trim();
  return "path.join(__dirname, \"data\")";
}

function extractDataDirFromProgress() {
  const progressUseRe =
    /app\.use\(\s*createProgressRouter\(\{[\s\S]*?\}\)\s*\);/m;
  const progressMatch = content.match(progressUseRe);
  return extractDataDirFromProgressBlock(progressMatch && progressMatch[0]);
}

function managedBlock(dataDirExpr) {
  return [
    MARK_BEGIN,
    "const createProgressRouter = require(\"./server-patches/routes-progress\");",
    "const createCalendarRouter = require(\"./server-patches/routes-calendar\");",
    "const requireSubscribedForCourse = require(\"./server-patches/middleware-require-subscribed\");",
    "",
    "// Paywall Premium — avant express.static(\"public\")",
    "app.use(requireSubscribedForCourse);",
    "",
    "app.use(",
    "  createProgressRouter({",
    "    dataDir: " + dataDirExpr + ",",
    "    requireAuth,",
    "  })",
    ");",
    "app.use(",
    "  createCalendarRouter({",
    "    dataDir: " + dataDirExpr + ",",
    "    requireAuth,",
    "  })",
    ");",
    MARK_END,
    "",
  ].join("\n");
}

if (!content.includes("requireAuth")) {
  console.error(
    "ERREUR : requireAuth introuvable dans " +
      serverPath +
      " — définir le middleware session avant ce script."
  );
  process.exit(1);
}

if (content.includes(MARK_BEGIN) && content.includes(MARK_END)) {
  const dataDirExpr = extractDataDirFromProgress();
  const block = managedBlock(dataDirExpr);
  content = content.replace(
    new RegExp(
      MARK_BEGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
        "[\\s\\S]*?" +
        MARK_END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    ),
    block.trimEnd()
  );
  console.log("Bloc TORINVEST_FORMATION_PATCHES mis à jour.");
} else if (hasProgress() && hasCalendar() && hasPaywall()) {
  console.log("OK — paywall + progress + calendar déjà présents dans " + serverPath);
  process.exit(0);
} else if (hasProgress() && !hasCalendar()) {
  const progressUseRe =
    /app\.use\(\s*createProgressRouter\(\{[\s\S]*?\}\)\s*\);/m;
  const progressMatch = content.match(progressUseRe);
  if (!progressMatch) {
    console.error("ERREUR : createProgressRouter trouvé mais app.use(...) introuvable.");
    process.exit(1);
  }
  const dataDirExpr = extractDataDirFromProgressBlock(progressMatch[0]);
  content = content.replace(
    /(const createProgressRouter = require\(["']\.\/server-patches\/routes-progress["']\);)/,
    "$1\nconst createCalendarRouter = require(\"./server-patches/routes-calendar\");"
  );
  const calendarUse = [
    "app.use(",
    "  createCalendarRouter({",
    "    dataDir: " + dataDirExpr + ",",
    "    requireAuth,",
    "  })",
    ");",
  ].join("\n");
  content = content.replace(progressUseRe, progressMatch[0] + "\n" + calendarUse);
  console.log("Calendar router ajouté après progress.");
} else if (!hasProgress() && !hasPaywall()) {
  const dataDirExpr = "path.join(__dirname, \"data\")";
  const needsPath = !/require\(["']path["']\)/.test(content);
  const pathRequire = needsPath
    ? "const path = require(\"path\");\n"
    : "";
  const insertPoint =
    content.search(/express\.static\s*\(\s*['"]public['"]/m) >= 0
      ? content.search(/express\.static\s*\(\s*['"]public['"]/m)
      : content.search(/app\.listen\s*\(/m);
  if (insertPoint < 0) {
    console.error("ERREUR : point d'insertion introuvable (static public ou listen).");
    process.exit(1);
  }
  const block = pathRequire + managedBlock(dataDirExpr);
  content = content.slice(0, insertPoint) + block + content.slice(insertPoint);
  console.log("Bloc complet patches formation inséré.");
} else {
  console.error(
    "Configuration partielle détectée — éditer " +
      serverPath +
      " manuellement ou utiliser les marqueurs TORINVEST_FORMATION_PATCHES."
  );
  console.error("progress:", hasProgress(), "calendar:", hasCalendar(), "paywall:", hasPaywall());
  process.exit(1);
}

if (content === original) {
  console.log("Aucun changement.");
  process.exit(0);
}

const backup = serverPath + ".bak." + Date.now();
fs.writeFileSync(backup, original);

function syntaxOk() {
  try {
    const { execSync } = require("child_process");
    execSync("node --check " + JSON.stringify(serverPath), { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

fs.writeFileSync(serverPath, content);
if (!syntaxOk()) {
  fs.writeFileSync(serverPath, original);
  console.error("ERREUR : server.js invalide après patch — restauré depuis sauvegarde.");
  console.error("Sauvegarde inchangée :", backup);
  process.exit(1);
}

console.log("Sauvegarde :", backup);
console.log("Modifié :", serverPath);
console.log("→ pm2 restart la-forge   # ou torinvest-formation");
