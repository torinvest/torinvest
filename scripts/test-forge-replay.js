#!/usr/bin/env node
/** Tests statiques — replay chart pédagogique. */
"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");

var root = path.join(__dirname, "..");
var replay = fs.readFileSync(path.join(root, "la-forge/js/forge-replay.js"), "utf8");
var annotations = fs.readFileSync(path.join(root, "la-forge/js/forge-annotations.js"), "utf8");
var lesson = fs.readFileSync(path.join(root, "la-forge/js/lesson-core.js"), "utf8");
var css = fs.readFileSync(path.join(root, "la-forge/css/forge-charts.css"), "utf8");

var results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name: name, result: "PASS" });
  } catch (e) {
    results.push({ name: name, result: "FAIL", error: e.message });
  }
}

test("replay mode cumulative par défaut", function () {
  assert.ok(replay.indexOf('"cumulative"') !== -1);
  assert.ok(replay.indexOf("getReplayMode") !== -1);
});

test("applyReplayFrames supporte cumulative et exclusive", function () {
  assert.ok(replay.indexOf("i <= current") !== -1);
  assert.ok(replay.indexOf("exclusive") !== -1);
});

test("resolveFrameGroupId auto", function () {
  assert.ok(replay.indexOf("resolveFrameGroupId") !== -1);
  assert.ok(replay.indexOf("replay-frame-") !== -1);
});

test("replay pedagogy mode", function () {
  assert.ok(replay.indexOf("replay-pedagogy-mode") !== -1);
  assert.ok(replay.indexOf("enrichFrames") !== -1);
  assert.ok(css.indexOf("replay-story-bar") !== -1);
});

test("toujours initEliteReplay (pas mode minimal)", function () {
  assert.ok(replay.indexOf("initEliteReplayForRoot") !== -1);
  var chunk = replay.slice(replay.indexOf("function initChartReplay"), replay.indexOf("function initChartReplay") + 500);
  assert.ok(chunk.indexOf("initEliteReplayForRoot") !== -1);
});

test("focus context future classes", function () {
  assert.ok(replay.indexOf("replay-focus") !== -1);
  assert.ok(replay.indexOf("replay-context") !== -1);
  assert.ok(css.indexOf("replay-focus-ring") !== -1);
});

test("chart replay full labels", function () {
  assert.ok(lesson.indexOf("chart-replay-full") !== -1);
});

test("animations calmes en replay", function () {
  assert.ok(css.indexOf("replay-pedagogy-mode .zone-pulse") !== -1);
});

test("annotations progressive en replay cumulative", function () {
  assert.ok(annotations.indexOf("progressive") !== -1);
  assert.ok(annotations.indexOf("replayMode") !== -1);
});

test("lesson-core fit bbox replay visible only", function () {
  assert.ok(lesson.indexOf("if (isReplay)") !== -1);
});

test("data-replay-step auto tag", function () {
  assert.ok(lesson.indexOf("data-replay-step") !== -1);
});

test("bootAllReplays auto", function () {
  assert.ok(replay.indexOf("bootAllReplays") !== -1);
});

test("version marker deploy", function () {
  assert.ok(replay.indexOf("FORGE_REPLAY_VERSION") !== -1);
  assert.ok(replay.indexOf("discoverFramesFromSvg") !== -1);
});

var failed = 0;
results.forEach(function (r) {
  console.log(r.result + " — " + r.name + (r.error ? " :: " + r.error : ""));
  if (r.result === "FAIL") failed++;
});
console.log(failed ? "FAILED " + failed : "ALL PASS (" + results.length + ")");
process.exit(failed ? 1 : 0);
