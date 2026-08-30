#!/usr/bin/env node
/**
 * Place app.set("trust proxy", 1) immédiatement après const app = express()
 * et applique fix rate-limit validate si besoin.
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

const trustLine =
  "app.set(\"trust proxy\", 1); // nginx — avant rate-limit\n";

content = content.replace(
  /^\s*app\.set\s*\(\s*["']trust proxy["'][^)]*\);?\s*\n/gm,
  ""
);

const appRe = /(const app = express\(\);?\s*\n)/;
if (!appRe.test(content)) {
  console.error("ERREUR : const app = express() introuvable");
  process.exit(1);
}

if (!/app\.set\s*\(\s*["']trust proxy["']/.test(content)) {
  content = content.replace(appRe, "$1" + trustLine);
  console.log("trust proxy placé juste après express()");
}

if (!content.includes("xForwardedForHeader: false")) {
  content = content.replace(
    /rateLimit\s*\(\s*\{/g,
    "rateLimit({\n  validate: { xForwardedForHeader: false },"
  );
  console.log("rate-limit validate assoupli");
}

if (content === original) {
  console.log("OK — déjà configuré.");
  process.exit(0);
}

const backup = serverPath + ".proxyfix." + Date.now();
fs.writeFileSync(backup, original);
fs.writeFileSync(serverPath, content);
execSync("node --check " + JSON.stringify(serverPath), { stdio: "inherit" });
console.log("Backup :", backup);
console.log("OK → pm2 delete la-forge; pm2 start server.js --name la-forge");
