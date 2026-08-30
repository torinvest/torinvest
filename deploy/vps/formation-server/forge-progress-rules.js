"use strict";

/** Règles de validation module — alignées sur la-forge/js/progress.js */
const DEFAULT_TOTAL_STEPS = 12;
const QUIZ_PASS_RATIO = 0.7;
const PRACTICE_PASS_RATIO = 0.7;

function practiceSatisfied(p) {
  const total = Number(p.practiceTotal) || 0;
  if (total <= 0) return true;
  return (Number(p.practiceScore) || 0) >= total * PRACTICE_PASS_RATIO;
}

function computeModuleCompleted(raw) {
  if (!raw || typeof raw !== "object") return false;
  const totalSteps = Number(raw.totalSteps) || DEFAULT_TOTAL_STEPS;
  const stepsDone = Number(raw.stepsDone) || 0;
  const quizTotal = Number(raw.quizTotal) || 0;
  const quizScore = Number(raw.quizScore) || 0;
  const quizOk = quizTotal <= 0 || quizScore >= quizTotal * QUIZ_PASS_RATIO;
  return stepsDone >= totalSteps && quizOk && practiceSatisfied(raw);
}

function sanitizeModuleProgress(raw) {
  if (!raw || typeof raw !== "object") return null;
  const totalSteps = Number(raw.totalSteps) || DEFAULT_TOTAL_STEPS;
  const stepsDone = Math.max(0, Math.min(Number(raw.stepsDone) || 0, totalSteps));
  const quizTotal = Math.max(0, Number(raw.quizTotal) || 0);
  const quizScore =
    quizTotal > 0 ? Math.max(0, Math.min(Number(raw.quizScore) || 0, quizTotal)) : 0;
  const practiceTotal = Math.max(0, Number(raw.practiceTotal) || 0);
  const practiceScore =
    practiceTotal > 0
      ? Math.max(0, Math.min(Number(raw.practiceScore) || 0, practiceTotal))
      : 0;
  const out = {
    stepsDone,
    totalSteps,
    quizScore,
    quizTotal,
    practiceScore,
    practiceTotal,
    updated:
      typeof raw.updated === "string" && raw.updated
        ? raw.updated
        : new Date().toISOString(),
  };
  out.completed = computeModuleCompleted(out);
  return out;
}

function isValidModuleId(id) {
  return typeof id === "string" && /^[a-z0-9][a-z0-9._-]*$/i.test(id);
}

/**
 * Fusionne client + existant, recalcule completed côté serveur.
 * Ignore les IDs hors liste allowlist si fournie.
 */
function sanitizeModulesPayload(clientModules, existingModules, allowedIds) {
  const existing = existingModules || {};
  const client = clientModules || {};
  const allow =
    allowedIds && allowedIds.length
      ? new Set(allowedIds)
      : null;
  const ids = new Set([...Object.keys(existing), ...Object.keys(client)]);
  const out = {};
  ids.forEach((id) => {
    if (!isValidModuleId(id)) return;
    if (allow && !allow.has(id)) return;
    const merged = { ...(existing[id] || {}), ...(client[id] || {}) };
    const clean = sanitizeModuleProgress(merged);
    if (clean) out[id] = clean;
  });
  return out;
}

module.exports = {
  DEFAULT_TOTAL_STEPS,
  computeModuleCompleted,
  sanitizeModuleProgress,
  sanitizeModulesPayload,
};
