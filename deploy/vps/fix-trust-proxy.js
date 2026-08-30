#!/usr/bin/env node
/**
 * Fix PM2 crash loop : express-rate-limit + nginx (X-Forwarded-For).
 * Ajoute app.set("trust proxy", 1) après const app = express();
 *
 * Usage :
 *   node deploy/vps/fix-trust-proxy.js /home/ubuntu/torinvest-formation/server.js
 */
"use strict";

const fs = require("fs");
const path = require("path");

const serverPath =
  process.argv[2] || "/home/ubuntu/torinvest-formation/server.js";

if (!fs.existsSync(serverPath)) {
  console.error("ERREUR :", serverPath, "introuvable");
  process.exit(1);
}

let content = fs.readFileSync(serverPath, "utf8");

function hasTrustProxySet() {
  return /app\.set\s*\(\s*['"]trust proxy['"]/.test(content);
}

if (hasTrustProxySet()) {
  console.log("OK — app.set('trust proxy') déjà présent.");
  process.exit(0);
}

if (/trust proxy/i.test(content)) {
  console.log(
    "Note : 'trust proxy' trouvé (commentaire ?) mais pas app.set() — ajout de la ligne."
  );
}

const m = content.match(/const app = express\(\);?\s*\n/);
if (!m) {
  console.error("ERREUR : const app = express() introuvable dans", serverPath);
  process.exit(1);
}

const insert =
  "app.set(\"trust proxy\", 1); // nginx reverse proxy (rate-limit, sessions)\n";
const idx = content.indexOf(m[0]) + m[0].length;
const backup = serverPath + ".trust-proxy." + Date.now();
fs.writeFileSync(backup, content);
content = content.slice(0, idx) + insert + content.slice(idx);
fs.writeFileSync(serverPath, content);

const { execSync } = require("child_process");
execSync("node --check " + JSON.stringify(serverPath), { stdio: "inherit" });

console.log("Backup :", backup);
console.log("OK — trust proxy ajouté. → pm2 restart la-forge");
