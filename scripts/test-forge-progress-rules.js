#!/usr/bin/env node
/** Tests forge-progress-rules.js (validation serveur) */
"use strict";

const assert = require("assert");
const path = require("path");
const rules = require(path.join(
  __dirname,
  "../deploy/vps/formation-server/forge-progress-rules.js"
));

assert.strictEqual(rules.computeModuleCompleted({ stepsDone: 12, totalSteps: 12 }), true);
assert.strictEqual(
  rules.computeModuleCompleted({ stepsDone: 12, totalSteps: 12, completed: true }),
  true
);
assert.strictEqual(
  rules.computeModuleCompleted({ stepsDone: 12, totalSteps: 12, completed: true, quizTotal: 10, quizScore: 3 }),
  false
);
assert.strictEqual(
  rules.computeModuleCompleted({
    stepsDone: 12,
    totalSteps: 12,
    quizTotal: 10,
    quizScore: 8,
    practiceTotal: 5,
    practiceScore: 4,
  }),
  true
);

const forged = rules.sanitizeModulesPayload(
  { intro: { stepsDone: 12, totalSteps: 12, completed: true, quizTotal: 10, quizScore: 0 } },
  {},
  ["intro"]
);
assert.strictEqual(forged.intro.completed, false);

const ok = rules.sanitizeModulesPayload(
  { f01: { stepsDone: 12, totalSteps: 12, quizTotal: 10, quizScore: 9 } },
  {},
  ["f01", "intro"]
);
assert.strictEqual(ok.f01.completed, true);
assert.strictEqual(Object.keys(ok).length, 1);

console.log("ALL PASS — forge-progress-rules");
