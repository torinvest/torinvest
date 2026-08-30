#!/usr/bin/env node
/** Tests forge-unlock-server fail-closed */
"use strict";

const assert = require("assert");
const path = require("path");
const unlock = require(path.join(
  __dirname,
  "../deploy/vps/formation-server/forge-unlock-server.js"
));

assert.strictEqual(unlock.isModuleUnlocked("nonexistent", {}), false);
assert.strictEqual(unlock.getModuleIdFromCoursePath("/course/unknown-page.html"), null);
assert.strictEqual(unlock.isModuleUnlocked("intro", {}), true);
assert.strictEqual(unlock.isModuleUnlocked("f03", {}), false);

const allDone = {
  intro: { stepsDone: 12, totalSteps: 12 },
  f01: { stepsDone: 12, totalSteps: 12 },
  f02: { stepsDone: 12, totalSteps: 12 },
};
assert.strictEqual(unlock.isModuleUnlocked("f03", allDone), true);

console.log("ALL PASS — forge-unlock-server");
