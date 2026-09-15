#!/usr/bin/env node
/**
 * Place le pont auth APRÈS le middleware session custom (COOKIE_NAME / torinvest_session).
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

let text = fs.readFileSync(serverPath, "utf8");
const original = text;

const block = [
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

function endOfCall(s, openIdx) {
  let depth = 0;
  let started = false;
  for (let i = openIdx; i < s.length; i++) {
    if (s[i] === "(") {
      depth++;
      started = true;
    } else if (s[i] === ")") {
      depth--;
      if (started && depth === 0) {
        let end = i + 1;
        while (end < s.length && /[\s;]/.test(s[end])) end++;
        return end;
      }
    }
  }
  return -1;
}

function stripAuth(s) {
  let out = s.replace(
    /\/\* TORINVEST_ACCOMPAGNEMENT_AUTH_BEGIN \*\/[\s\S]*?\/\* TORINVEST_ACCOMPAGNEMENT_AUTH_END \*\/\s*/g,
    ""
  );
  out = out.replace(
    /\n?const createFormationAuthRouter = require\(["']\.\/server-patches\/routes-formation-auth["']\);\s*/g,
    "\n"
  );
  out = out.replace(/\n?app\.use\(\s*createFormationAuthRouter\(\{[\s\S]*?\}\)\s*\);\s*/g, "\n");
  return out;
}

function findSessionInsert(s) {
  const candidates = [];

  // 1) app.use(session(...)) / expressSession / cookieSession
  const direct = [
    /app\.use\s*\(\s*session\s*\(/g,
    /app\.use\s*\(\s*expressSession\s*\(/g,
    /app\.use\s*\(\s*cookieSession\s*\(/g,
    /app\.use\s*\(\s*require\s*\(\s*["']express-session["']\s*\)\s*\(/g,
  ];
  for (const re of direct) {
    let m;
    while ((m = re.exec(s))) {
      const open = s.indexOf("(", m.index);
      const end = endOfCall(s, open);
      if (end > 0) candidates.push({ end, why: "direct:" + m[0].slice(0, 30) });
    }
  }

  // 2) const x = session(...); app.use(x)
  const assignRe =
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:session|expressSession|cookieSession)\s*\(/g;
  let am;
  while ((am = assignRe.exec(s))) {
    const name = am[1];
    const useRe = new RegExp("app\\.use\\s*\\(\\s*" + name.replace(/\$/g, "\\$") + "\\s*\\)", "g");
    let um;
    while ((um = useRe.exec(s))) {
      let end = um.index + um[0].length;
      while (end < s.length && /[\s;]/.test(s[end])) end++;
      candidates.push({ end, why: "assign-use:" + name });
    }
  }

  // 3) Heuristique COOKIE_NAME / torinvest_session dans un app.use(...)
  const useRe = /app\.use\s*\(/g;
  let um;
  while ((um = useRe.exec(s))) {
    const open = um.index + um[0].length - 1;
    const end = endOfCall(s, open);
    if (end < 0) continue;
    const body = s.slice(um.index, end);
    if (
      /COOKIE_NAME|torinvest_session|express-session|saveUninitialized|resave/.test(body) ||
      /\bsession\s*\(/.test(body)
    ) {
      candidates.push({
        end,
        why: "heuristic:" + body.replace(/\s+/g, " ").slice(0, 60),
      });
    }
  }

  // 4) Ancre name: COOKIE_NAME → remonter au app.use(
  const anchors = [];
  const anchorRe = /name:\s*COOKIE_NAME|name:\s*["']torinvest_session["']|COOKIE_NAME\s*,/g;
  let a;
  while ((a = anchorRe.exec(s))) anchors.push(a.index);
  for (const idx of anchors) {
    const before = s.lastIndexOf("app.use", idx);
    if (before < 0) continue;
    const open = s.indexOf("(", before);
    const end = endOfCall(s, open);
    if (end > idx) candidates.push({ end, why: "anchor-COOKIE_NAME" });
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => a.end - b.end);
  return candidates[candidates.length - 1];
}

console.log("==> Lignes session / cookie");
text
  .split("\n")
  .forEach((line, i) => {
    if (/COOKIE_NAME|express-session|session\(|torinvest_session|app\.use\(\s*session/i.test(line)) {
      console.log("  L" + (i + 1) + ": " + line.trim().slice(0, 140));
    }
  });

text = stripAuth(text);
const found = findSessionInsert(text);
if (!found) {
  console.error("ERREUR: middleware session introuvable");
  console.error("Envoie: grep -nE 'COOKIE_NAME|session|app.use' server.js | head -80");
  process.exit(1);
}

console.log("OK insert after session:", found.why, "at", found.end);

let insertAt = found.end;
if (!/require\(["']path["']\)/.test(text)) {
  const add = 'const path = require("path");\n';
  text = add + text;
  insertAt += add.length;
}

text = text.slice(0, insertAt) + block + text.slice(insertAt);

const mounts = (text.match(/app\.use\(\s*createFormationAuthRouter/g) || []).length;
if (mounts !== 1) {
  console.error("ERREUR mounts=", mounts);
  process.exit(1);
}

const backup = serverPath + ".bak." + Date.now();
fs.writeFileSync(backup, original);
fs.writeFileSync(serverPath, text);
try {
  execSync("node --check " + JSON.stringify(serverPath), { stdio: "pipe" });
} catch (e) {
  fs.writeFileSync(serverPath, original);
  console.error("ERREUR syntaxe — restauré");
  process.exit(1);
}
console.log("Sauvegarde:", backup);
console.log("OK server.js patché");
