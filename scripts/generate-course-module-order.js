#!/usr/bin/env node
/** Génère course-module-order.json depuis course-data.js (ordre parcours). */
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const courseDataPath = path.join(root, "la-forge/js/course-data.js");
const outPath = path.join(
  root,
  "deploy/vps/formation-server/course-module-order.json"
);

const raw = fs.readFileSync(courseDataPath, "utf8");
const order = [];
for (const line of raw.split("\n")) {
  const idM = line.match(/id: "([^"]+)"/);
  const hrefM = line.match(/href: "https:\/\/[^"]+\/([^"]+)"/);
  if (idM && hrefM) {
    order.push({ id: idM[1], file: hrefM[1] });
  }
}

if (order.length < 30) {
  console.error("ERREUR: seulement", order.length, "modules parsés");
  process.exit(1);
}

fs.writeFileSync(outPath, JSON.stringify(order, null, 2) + "\n");
console.log("OK —", order.length, "modules →", outPath);
