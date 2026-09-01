#!/usr/bin/env node
/**
 * Déplace TORINVEST_ACCOMPAGNEMENT_AUTH après app.use(session…).
 * Usage: node deploy/vps/relocate-accompagnement-auth.js /home/ubuntu/torinvest-formation
 */
"use strict";

const fs = require("fs");
const path = require("path");

const APP_DIR = process.argv[2] || "/home/ubuntu/torinvest-formation";
const serverPath = path.join(APP_DIR, "server.js");

if (!fs.existsSync(serverPath)) {
  console.error("ERREUR:", serverPath, "introuvable");
  process.exit(1);
}

let content = fs.readFileSync(serverPath, "utf8");
const blockRe =
  /\/\* TORINVEST_ACCOMPAGNEMENT_AUTH_BEGIN \*\/[\s\S]*?\/\* TORINVEST_ACCOMPAGNEMENT_AUTH_END \*\/\s*/;
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
  console.error("ERREUR: app.use(session…) introuvable dans server.js");
  process.exit(1);
}

const insertAt = sm.index + sm[0].length;
if (without.slice(insertAt, insertAt + 120).includes("ACCOMPAGNEMENT_AUTH_BEGIN")) {
  console.log("OK — bloc déjà après session");
  process.exit(0);
}

const backup = serverPath + ".bak." + Date.now();
fs.writeFileSync(backup, content);
fs.writeFileSync(serverPath, without.slice(0, insertAt) + "\n" + block + without.slice(insertAt));
console.log("OK — bloc déplacé après express-session");
console.log("Sauvegarde:", backup);
