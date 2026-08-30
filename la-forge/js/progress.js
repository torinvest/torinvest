/**
 * Progression formation — localStorage par email + sync serveur /api/progress
 */
const PROGRESS_LEGACY_KEY = "torinvest_course_progress";
const PROGRESS_META_SUFFIX = "_meta";

let _progressEmail = null;
let _progressSyncStatus = "idle";

function progressEmailSlug() {
  const email = _progressEmail || window.__forgeUserEmail || "guest";
  return email.replace(/[^a-z0-9@._-]/gi, "_");
}

function progressStorageKey() {
  return "torinvest_course_progress_" + progressEmailSlug();
}

function progressMetaKey() {
  return "torinvest_course_progress_meta_" + progressEmailSlug();
}

function loadProgress() {
  try {
    const key = progressStorageKey();
    let data = JSON.parse(localStorage.getItem(key) || "{}");
    if (!Object.keys(data).length) {
      const legacy = JSON.parse(localStorage.getItem(PROGRESS_LEGACY_KEY) || "{}");
      if (Object.keys(legacy).length) {
        data = legacy;
        saveProgress(data);
      }
    }
    return data;
  } catch {
    return {};
  }
}

function saveProgress(data) {
  localStorage.setItem(progressStorageKey(), JSON.stringify(data));
}

function loadProgressMeta() {
  try {
    return JSON.parse(localStorage.getItem(progressMetaKey()) || "{}");
  } catch {
    return {};
  }
}

function saveProgressMeta(meta) {
  localStorage.setItem(progressMetaKey(), JSON.stringify(meta));
}

function updateProgressSyncBadge() {
  const el = document.getElementById("progress-sync-badge");
  if (!el) return;
  el.className = "cal-sync-badge " + _progressSyncStatus;
  el.textContent =
    _progressSyncStatus === "ok"
      ? "Progression sync"
      : _progressSyncStatus === "syncing"
        ? "Sync…"
        : _progressSyncStatus === "offline"
          ? "Progression locale"
          : "—";
}

async function syncProgressFromServer() {
  _progressSyncStatus = "syncing";
  updateProgressSyncBadge();
  try {
    const res = await fetch("/api/progress", { credentials: "same-origin" });
    if (!res.ok) throw new Error("sync failed");
    const data = await res.json();
    const remote = data.modules || {};
    const local = loadProgress();
    const merged = { ...local };
    Object.keys(remote).forEach((id) => {
      const r = remote[id];
      const l = local[id];
      if (!l) {
        merged[id] = r;
        return;
      }
      const rTime = r.updated ? new Date(r.updated).getTime() : 0;
      const lTime = l.updated ? new Date(l.updated).getTime() : 0;
      merged[id] = rTime >= lTime ? r : l;
    });
    saveProgress(merged);
    saveProgressMeta({ ...loadProgressMeta(), lastSync: new Date().toISOString() });
    _progressSyncStatus = "ok";
  } catch {
    _progressSyncStatus = "offline";
  }
  updateProgressSyncBadge();
  return loadProgress();
}

async function pushProgressToServer() {
  _progressSyncStatus = "syncing";
  updateProgressSyncBadge();
  try {
    const res = await fetch("/api/progress", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modules: loadProgress() }),
    });
    if (!res.ok) throw new Error("push failed");
    saveProgressMeta({ ...loadProgressMeta(), lastSync: new Date().toISOString() });
    _progressSyncStatus = "ok";
  } catch {
    _progressSyncStatus = "offline";
  }
  updateProgressSyncBadge();
}

async function initForgeProgress(email) {
  _progressEmail = email || "guest";
  window.__forgeProgressEmail = _progressEmail;
  await syncProgressFromServer();
}

function practiceSatisfied(prev) {
  const total = prev.practiceTotal || 0;
  if (total <= 0) return true;
  return (prev.practiceScore || 0) >= total * 0.7;
}

function getModuleProgress(moduleId) {
  const all = loadProgress();
  return all[moduleId] || { stepsDone: 0, quizScore: 0, quizTotal: 0, completed: false };
}

async function setModuleSteps(moduleId, stepsDone, totalSteps) {
  const all = loadProgress();
  const prev = all[moduleId] || {};
  const quizOk = (prev.quizScore || 0) >= (prev.quizTotal || 10) * 0.7;
  all[moduleId] = {
    ...prev,
    stepsDone,
    totalSteps,
    updated: new Date().toISOString(),
    completed: stepsDone >= totalSteps && quizOk && practiceSatisfied(prev),
  };
  saveProgress(all);
  await pushProgressToServer();
}

async function setModuleQuiz(moduleId, score, total, totalSteps) {
  const all = loadProgress();
  const prev = all[moduleId] || {};
  all[moduleId] = {
    ...prev,
    quizScore: score,
    quizTotal: total,
    totalSteps: totalSteps || prev.totalSteps || 12,
    updated: new Date().toISOString(),
    completed:
      (prev.stepsDone || 0) >= (totalSteps || prev.totalSteps || 12) &&
      score >= total * 0.7 &&
      practiceSatisfied(prev),
  };
  saveProgress(all);
  await pushProgressToServer();
}

async function setModulePractice(moduleId, score, total) {
  const all = loadProgress();
  const prev = all[moduleId] || {};
  const quizOk = (prev.quizScore || 0) >= (prev.quizTotal || 10) * 0.7;
  all[moduleId] = {
    ...prev,
    practiceScore: score,
    practiceTotal: total,
    updated: new Date().toISOString(),
    completed:
      (prev.stepsDone || 0) >= (prev.totalSteps || 12) &&
      quizOk &&
      practiceSatisfied({ ...prev, practiceScore: score, practiceTotal: total }),
  };
  saveProgress(all);
  await pushProgressToServer();
}

function getOverallProgress(moduleIds) {
  let done = 0;
  moduleIds.forEach((id) => {
    if (getModuleProgress(id).completed) done++;
  });
  return { done, total: moduleIds.length, pct: Math.round((done / moduleIds.length) * 100) };
}

function getModuleCompletionHint(moduleId) {
  const p = getModuleProgress(moduleId);
  const totalSteps = p.totalSteps || 12;
  const missing = [];
  if ((p.stepsDone || 0) < totalSteps) {
    missing.push("sections " + (p.stepsDone || 0) + "/" + totalSteps);
  }
  const quizTotal = p.quizTotal || 0;
  if (quizTotal > 0 && (p.quizScore || 0) < quizTotal * 0.7) {
    missing.push("quiz " + (p.quizScore || 0) + "/" + quizTotal + " (70 %)");
  }
  const practiceTotal = p.practiceTotal || 0;
  if (practiceTotal > 0 && !practiceSatisfied(p)) {
    missing.push("exercices " + (p.practiceScore || 0) + "/" + practiceTotal + " (70 %)");
  }
  return missing;
}

window.loadProgress = loadProgress;
window.getModuleProgress = getModuleProgress;
window.setModuleSteps = setModuleSteps;
window.setModuleQuiz = setModuleQuiz;
window.setModulePractice = setModulePractice;
window.getOverallProgress = getOverallProgress;
window.getModuleCompletionHint = getModuleCompletionHint;
window.initForgeProgress = initForgeProgress;
window.syncProgressFromServer = syncProgressFromServer;
