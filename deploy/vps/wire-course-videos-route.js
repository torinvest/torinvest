#!/usr/bin/env node
/**
 * Ajoute une route Express fiable pour /course/videos/*
 *
 * Usage VPS :
 *   node deploy/vps/wire-course-videos-route.js /home/ubuntu/torinvest-formation
 *   pm2 restart la-forge
 */
"use strict";

const fs = require("fs");
const path = require("path");

const APP_DIR = process.argv[2] || "/home/ubuntu/torinvest-formation";
const serverPath = ["server.js", "app.js", "index.js"]
  .map((n) => path.join(APP_DIR, n))
  .find((p) => fs.existsSync(p));

if (!serverPath) {
  console.error("ERREUR: server.js introuvable dans", APP_DIR);
  process.exit(1);
}

const MARK_BEGIN = "/* TORINVEST_COURSE_VIDEOS_ROUTE_BEGIN */";
const MARK_END = "/* TORINVEST_COURSE_VIDEOS_ROUTE_END */";

const routeBlock = [
  MARK_BEGIN,
  "// Sert /course/videos/* depuis private/ puis public/ (MP4 formation)",
  'app.get("/course/videos/:file", function torinvestCourseVideo(req, res, next) {',
  "  try {",
  '    const pathMod = require("path");',
  '    const fsMod = require("fs");',
  '    const name = pathMod.basename(String(req.params.file || ""));',
  '    if (!name || !/\\.(mp4|webm|ogg)$/i.test(name)) return next();',
  "    const candidates = [",
  '      pathMod.join(__dirname, "private", "course", "videos", name),',
  '      pathMod.join(__dirname, "public", "course", "videos", name),',
  "    ];",
  "    const file = candidates.find(function (p) { return fsMod.existsSync(p); });",
  '    if (!file) return res.status(404).send("video_not_found");',
  '    res.setHeader("Cache-Control", "private, max-age=3600");',
  "    return res.sendFile(file);",
  "  } catch (e) {",
  "    return next(e);",
  "  }",
  "});",
  MARK_END,
  "",
].join("\n");

let src = fs.readFileSync(serverPath, "utf8");
const beginIdx = src.indexOf(MARK_BEGIN);
const endIdx = src.indexOf(MARK_END);

if (beginIdx !== -1 && endIdx !== -1 && endIdx > beginIdx) {
  src =
    src.slice(0, beginIdx) +
    routeBlock +
    src.slice(endIdx + MARK_END.length);
  fs.writeFileSync(serverPath, src);
  console.log("OK — route /course/videos mise à jour dans", serverPath);
} else {
  const staticRe = /app\.use\(\s*express\.static\(\s*["']public["']/;
  if (staticRe.test(src)) {
    src = src.replace(staticRe, routeBlock + "\n$&");
  } else if (/app\.listen\s*\(/.test(src)) {
    src = src.replace(/app\.listen\s*\(/, routeBlock + "\napp.listen(");
  } else {
    console.error("ERREUR: point d'insertion introuvable (static/listen)");
    process.exit(2);
  }
  fs.writeFileSync(serverPath, src);
  console.log("OK — route /course/videos ajoutée dans", serverPath);
}

// sanity check syntax of server.js
try {
  require("child_process").execFileSync(process.execPath, ["--check", serverPath], {
    stdio: "pipe",
  });
  console.log("OK — syntaxe server.js valide");
} catch (e) {
  console.error("ERREUR — server.js syntaxe invalide après patch:");
  console.error(String(e.stderr || e.message));
  process.exit(3);
}

console.log("Ensuite: pm2 restart la-forge");
console.log("Test: curl -sI http://127.0.0.1:3000/course/videos/module-0-socle.mp4");
