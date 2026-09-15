#!/usr/bin/env node
/**
 * Place TORINVEST_ACCOMPAGNEMENT_AUTH APRÈS le middleware de session.
 * Détecte plusieurs formes : session(, cookieSession(, require('express-session'),
 * ou const sess = session(...); app.use(sess).
 *
 * Usage : node ensure-accompagnement-after-session.js /home/ubuntu/torinvest-formation
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const APP_DIR = process.argv[2] || "/home/ubuntu/torinvest-formation";
const serverPath = path.join(APP_DIR, "server.js");

if (!fs.existsSync(serverPath)) {
  console.error("ERREUR:", serverPath, "introuvable");
  process.exit(1);
}

let content = fs.readFileSync(serverPath, "utf8");
const original = content;

const standaloneBlock = [
  "/* TORINVEST_ACCOMPAGNEMENT_AUTH_BEGIN */",
  "const createFormationAuthRouter = require(\"./server-patches/routes-formation-auth\");",
  "app.use(",
  "  createFormationAuthRouter({",
  "    dataDir: path.join(__dirname, \"data\"),",
  "    workerUrl: process.env.FORGE_WORKER_URL || process.env.WORKER_URL || \"https://morning-hall-d8f6.onzerimes.workers.dev\",",
  "    provisionSecret: process.env.FORGE_FORMATION_PROVISION_SECRET,",
  "  })",
  ");",
  "/* TORINVEST_ACCOMPAGNEMENT_AUTH_END */",
  "",
].join("\n");

function endOfCall(text, openParenIndex) {
  let depth = 0;
  let started = false;
  for (let i = openParenIndex; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(") {
      depth += 1;
      started = true;
    } else if (ch === ")") {
      depth -= 1;
      if (started && depth === 0) {
        let end = i + 1;
        while (end < text.length && /[\s;]/.test(text[end])) end += 1;
        return end;
      }
    }
  }
  return -1;
}

function findInsertAfterSession(text) {
  const candidates = [];

  const directPatterns = [
    /app\.use\s*\(\s*session\s*\(/g,
    /app\.use\s*\(\s*cookieSession\s*\(/g,
    /app\.use\s*\(\s*require\s*\(\s*["']express-session["']\s*\)\s*\(/g,
  ];
  for (const re of directPatterns) {
    let m;
    while ((m = re.exec(text))) {
      const open = text.indexOf("(", m.index);
      const end = endOfCall(text, open);
      if (end > 0) candidates.push({ end, via: m[0].slice(0, 40) });
    }
  }

  // const foo = session({ ... }); app.use(foo)
  const assignRe = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*session\s*\(/g;
  let am;
  while ((am = assignRe.exec(text))) {
    const name = am[1];
    const useRe = new RegExp(
      "app\\.use\\s*\\(\\s*" + name.replace(/\$/g, "\\$") + "\\s*\\)",
      "g"
    );
    let um;
    while ((um = useRe.exec(text))) {
      let end = um.index + um[0].length;
      while (end < text.length && /[\s;]/.test(text[end])) end += 1;
      candidates.push({ end, via: "app.use(" + name + ")" });
    }
  }

  // cookie-session assign
  const assignCookie = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*cookieSession\s*\(/g;
  while ((am = assignCookie.exec(text))) {
    const name = am[1];
    const useRe = new RegExp(
      "app\\.use\\s*\\(\\s*" + name.replace(/\$/g, "\\$") + "\\s*\\)",
      "g"
    );
    let um;
    while ((um = useRe.exec(text))) {
      let end = um.index + um[0].length;
      while (end < text.length && /[\s;]/.test(text[end])) end += 1;
      candidates.push({ end, via: "app.use(" + name + ") cookie" });
    }
  }

  if (!candidates.length) return { at: -1, via: null };
  candidates.sort((a, b) => a.end - b.end);
  // Prendre le DERNIER montage session (parfois cookie-parser puis session)
  const last = candidates[candidates.length - 1];
  return { at: last.end, via: last.via };
}

function stripAll(text) {
  let out = text;
  const markedRe =
    /\/\* TORINVEST_ACCOMPAGNEMENT_AUTH_BEGIN \*\/[\s\S]*?\/\* TORINVEST_ACCOMPAGNEMENT_AUTH_END \*\/\s*/g;
  const marked = (out.match(markedRe) || []).length;
  if (marked) {
    out = out.replace(markedRe, "");
    console.log("OK — " + marked + " bloc(s) ACCOMPAGNEMENT_AUTH retiré(s)");
  }
  out = out.replace(
    /\n?const createFormationAuthRouter = require\(["']\.\/server-patches\/routes-formation-auth["']\);\s*/g,
    "\n"
  );
  out = out.replace(/\n?app\.use\(\s*createFormationAuthRouter\(\{[\s\S]*?\}\)\s*\);\s*/g, "\n");
  return out;
}

console.log("==> Diagnostic session dans server.js");
const sessionLines = content
  .split("\n")
  .map((line, i) => ({ i: i + 1, line }))
  .filter(({ line }) => /session/i.test(line) && !/^\s*\/\//.test(line))
  .slice(0, 30);
for (const { i, line } of sessionLines) {
  console.log("  L" + i + ": " + line.trim().slice(0, 120));
}
if (!sessionLines.length) {
  console.warn("WARN — aucun 'session' trouvé dans server.js");
}

content = stripAll(content);

let insert = findInsertAfterSession(content);
if (insert.at < 0) {
  const loginRe = /app\.post\s*\(\s*["']\/api\/login["']/m;
  const m = content.match(loginRe);
  if (m && m.index >= 0) {
    insert = { at: m.index, via: "fallback-before-/api/login" };
    console.warn("WARN — session non détectée ; insertion avant /api/login (" + insert.via + ")");
  }
}

if (insert.at < 0) {
  console.error("ERREUR: impossible de trouver session ni /api/login");
  process.exit(1);
}

console.log("OK — insertion via:", insert.via, "at", insert.at);
content = content.slice(0, insert.at) + standaloneBlock + content.slice(insert.at);

if (!/require\(["']path["']\)/.test(content)) {
  content = 'const path = require("path");\n' + content;
}

const mounts = (content.match(/app\.use\(\s*createFormationAuthRouter/g) || []).length;
if (mounts !== 1) {
  console.error("ERREUR: " + mounts + " montages — attendu 1");
  process.exit(1);
}

if (content === original) {
  console.log("Aucun changement");
  process.exit(0);
}

const backup = serverPath + ".bak." + Date.now();
fs.writeFileSync(backup, original);
fs.writeFileSync(serverPath, content);

try {
  execSync("node --check " + JSON.stringify(serverPath), { stdio: "pipe" });
} catch (e) {
  fs.writeFileSync(serverPath, original);
  console.error("ERREUR: server.js invalide — restauré");
  process.exit(1);
}

console.log("Sauvegarde:", backup);
console.log("→ pm2 restart la-forge --update-env");
