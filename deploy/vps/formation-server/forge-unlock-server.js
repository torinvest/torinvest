"use strict";

const BATCH_SIZE = 3;
const moduleOrder = require("./course-module-order.json");
const rules = require("./forge-progress-rules");

function moduleIds() {
  return moduleOrder.map((m) => m.id);
}

function moduleCompleted(progress, moduleId) {
  const p = progress && progress[moduleId];
  return rules.computeModuleCompleted(p);
}

function getMaxUnlockedModuleIndex(progress) {
  const ids = moduleIds();
  if (!ids.length) return -1;
  let maxIdx = Math.min(BATCH_SIZE - 1, ids.length - 1);
  let batchStart = 0;
  while (batchStart + BATCH_SIZE <= ids.length) {
    const batch = ids.slice(batchStart, batchStart + BATCH_SIZE);
    const allDone = batch.every((id) => moduleCompleted(progress, id));
    if (!allDone) break;
    batchStart += BATCH_SIZE;
    maxIdx = Math.min(batchStart + BATCH_SIZE - 1, ids.length - 1);
  }
  return maxIdx;
}

function isModuleUnlocked(moduleId, progress) {
  const idx = moduleOrder.findIndex((m) => m.id === moduleId);
  if (idx < 0) return false;
  return idx <= getMaxUnlockedModuleIndex(progress || {});
}

function getModuleIdFromCoursePath(coursePath) {
  const file = String(coursePath || "")
    .split("/")
    .pop();
  const m = moduleOrder.find((x) => x.file === file);
  return m ? m.id : null;
}

module.exports = {
  BATCH_SIZE,
  moduleOrder,
  getMaxUnlockedModuleIndex,
  isModuleUnlocked,
  getModuleIdFromCoursePath,
};
