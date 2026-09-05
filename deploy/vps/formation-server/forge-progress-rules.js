"use strict";

/** Règles de validation module — alignées sur la-forge/js/progress.js */
const DEFAULT_TOTAL_STEPS = 12;
const QUIZ_PASS_RATIO = 0.7;
const PRACTICE_PASS_RATIO = 0.7;
/** Anti-forge : max d'augmentation stepsDone / scores par PUT */
const MAX_STEPS_DELTA = 3;
const MAX_SCORE_DELTA = 5;

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
  // Plancher anti-forge : totalSteps=1 côté client ne doit pas valider un module.
  const totalSteps = Math.max(DEFAULT_TOTAL_STEPS, Number(raw.totalSteps) || 0);
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

/**
 * Progression monotone plafonnée : on ne peut pas passer de 0 → module complet en un PUT.
 * completed est toujours recalculé serveur (jamais pris du client).
 */
function mergeModuleProgress(existingRaw, clientRaw) {
  const prev = sanitizeModuleProgress(existingRaw || { stepsDone: 0 }) || {
    stepsDone: 0,
    totalSteps: DEFAULT_TOTAL_STEPS,
    quizScore: 0,
    quizTotal: 0,
    practiceScore: 0,
    practiceTotal: 0,
    completed: false,
  };
  const incoming = sanitizeModuleProgress({ ...prev, ...(clientRaw || {}) });
  if (!incoming) return prev;

  // totalSteps : plancher serveur + jamais abaissé par le client (anti unlock instantané)
  let totalSteps = Math.max(
    DEFAULT_TOTAL_STEPS,
    prev.totalSteps || 0,
    incoming.totalSteps || 0
  );
  // Hausse seulement si le client annonce plus d'étapes (module long) — plafonné
  if ((incoming.totalSteps || 0) > totalSteps) {
    totalSteps = Math.min(100, incoming.totalSteps);
  }
  totalSteps = Math.max(totalSteps, prev.totalSteps || DEFAULT_TOTAL_STEPS, DEFAULT_TOTAL_STEPS);

  // Ne jamais diminuer (sauf reset admin — pas exposé ici)
  let stepsDone = Math.max(prev.stepsDone, incoming.stepsDone);
  stepsDone = Math.min(stepsDone, prev.stepsDone + MAX_STEPS_DELTA, totalSteps);

  let quizTotal = Math.max(prev.quizTotal, incoming.quizTotal);
  let quizScore = Math.max(prev.quizScore, incoming.quizScore);
  quizScore = Math.min(quizScore, prev.quizScore + MAX_SCORE_DELTA, quizTotal || quizScore);

  let practiceTotal = Math.max(prev.practiceTotal, incoming.practiceTotal);
  let practiceScore = Math.max(prev.practiceScore, incoming.practiceScore);
  practiceScore = Math.min(
    practiceScore,
    prev.practiceScore + MAX_SCORE_DELTA,
    practiceTotal || practiceScore
  );

  const out = {
    stepsDone,
    totalSteps,
    quizScore,
    quizTotal,
    practiceScore,
    practiceTotal,
    updated: new Date().toISOString(),
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
    // Nouveau module côté client uniquement : appliquer le plafond depuis zéro
    const clean = mergeModuleProgress(existing[id], client[id]);
    if (clean) out[id] = clean;
  });
  return out;
}

module.exports = {
  DEFAULT_TOTAL_STEPS,
  MAX_STEPS_DELTA,
  MAX_SCORE_DELTA,
  computeModuleCompleted,
  sanitizeModuleProgress,
  mergeModuleProgress,
  sanitizeModulesPayload,
};
