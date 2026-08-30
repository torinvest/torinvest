#!/usr/bin/env node
/**
 * Insère course-data.js, progress.js et forge-unlock.js avant lesson-core.js
 * sur les pages leçon VPS (public/course/*.html, sauf index).
 */
"use strict";

const fs = require("fs");
const path = require("path");

const appDir = process.argv[2] || "/home/ubuntu/torinvest-formation";
const courseDir = path.join(appDir, "public/course");
const marker = "<script src=\"/js/lesson-core.js\"></script>";
const insert =
  "<script src=\"/js/course-data.js\"></script>\n" +
  "  <script src=\"/js/progress.js\"></script>\n" +
  "  <script src=\"/js/forge-unlock.js\"></script>\n" +
  "  ";

if (!fs.existsSync(courseDir)) {
  console.error("ERREUR: introuvable", courseDir);
  process.exit(1);
}

let patched = 0;
let skipped = 0;

for (const name of fs.readdirSync(courseDir)) {
  if (!name.endsWith(".html") || name === "index.html") continue;
  const file = path.join(courseDir, name);
  let html = fs.readFileSync(file, "utf8");
  if (html.includes("forge-unlock.js")) {
    skipped++;
    continue;
  }
  if (!html.includes(marker)) {
    console.warn("WARN — pas de lesson-core.js:", name);
    skipped++;
    continue;
  }
  html = html.replace(marker, insert + marker);
  fs.writeFileSync(file, html);
  patched++;
  console.log("  patched", name);
}

console.log(
  "OK — patch lesson unlock: " + patched + " fichier(s), " + skipped + " ignoré(s)"
);
