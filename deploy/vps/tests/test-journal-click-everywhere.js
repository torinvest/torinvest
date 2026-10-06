#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const bridge = fs.readFileSync(
  path.join(__dirname, "../formation-server/routes-journal-bridge.js"),
  "utf8"
);

assert.ok(bridge.includes("clickEverywhere"), "clickEverywhere flag");
assert.ok(bridge.includes("keepInFrame"), "top/parent keepInFrame");
assert.ok(bridge.includes("absolutizeRadarAssets"), "radar asset absolutize");
assert.ok(bridge.includes("version: 13"), "version 13");
assert.ok(
  bridge.includes("forge-jts:injectHardOff clickEverywhere v13"),
  "inject marker v13"
);

console.log("OK — clickEverywhere v13 guards");
