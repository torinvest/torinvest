#!/usr/bin/env node
/**
 * Insère forge-annotations.js + forge-replay.js avant lesson-core.js
 * sur les pages leçon VPS (public/course/*.html, sauf index).
 */
"use strict";

const fs = require("fs");
const path = require("path");

const appDir = process.argv[2] || "/home/ubuntu/torinvest-formation";
const courseDir = path.join(appDir, "public/course");
const marker = "<script src=\"/js/lesson-core.js\"></script>";

const replayBlock =
  "<script src=\"/js/forge-annotations.js\"></script>\n" +
  "  <script src=\"/js/forge-replay.js\"></script>\n" +
  "  ";

if (!fs.existsSync(courseDir)) {
  console.error("ERREUR: introuvable", courseDir);
  process.exit(1);
}

let patchedReplay = 0;
let skipped = 0;

for (const name of fs.readdirSync(courseDir)) {
  if (!name.endsWith(".html") || name === "index.html") continue;
  const file = path.join(courseDir, name);
  let html = fs.readFileSync(file, "utf8");
  if (!html.includes(marker)) {
    console.warn("WARN — pas de lesson-core.js:", name);
    skipped++;
    continue;
  }
  if (html.includes("forge-replay.js")) {
    skipped++;
    continue;
  }
  html = html.replace(marker, replayBlock + marker);
  fs.writeFileSync(file, html);
  patchedReplay++;
  console.log("  + replay scripts", name);
}

console.log(
  "OK — patch lesson replay: " + patchedReplay + " fichier(s), " + skipped + " ignoré(s)"
);
