#!/usr/bin/env node
/**
 * Désactive la validation strict trust-proxy de express-rate-limit
 * (secours si app.set trust proxy ne suffit pas ou est après le limiter).
 *
 * Usage :
 *   node deploy/vps/fix-rate-limit-validate.js /home/ubuntu/torinvest-formation/server.js
 */
"use strict";

const fs = require("fs");
const { execSync } = require("child_process");

const serverPath =
  process.argv[2] || "/home/ubuntu/torinvest-formation/server.js";

if (!fs.existsSync(serverPath)) {
  console.error("ERREUR :", serverPath, "introuvable");
  process.exit(1);
}

let content = fs.readFileSync(serverPath, "utf8");
const original = content;

if (content.includes("xForwardedForHeader: false")) {
  console.log("OK — validation rate-limit déjà assouplie.");
  process.exit(0);
}

const re = /rateLimit\s*\(\s*\{/;
if (!re.test(content)) {
  console.error("ERREUR : rateLimit({ introuvable dans server.js");
  process.exit(1);
}

content = content.replace(
  re,
  "rateLimit({\n  validate: { xForwardedForHeader: false },"
);

if (content === original) {
  console.log("Aucun changement.");
  process.exit(0);
}

const backup = serverPath + ".ratelimit." + Date.now();
fs.writeFileSync(backup, original);
fs.writeFileSync(serverPath, content);
execSync("node --check " + JSON.stringify(serverPath), { stdio: "inherit" });
console.log("Backup :", backup);
console.log("OK — rate-limit validate assoupli. → pm2 restart la-forge");
