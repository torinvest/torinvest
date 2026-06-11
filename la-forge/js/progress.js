const PROGRESS_KEY = "torinvest_course_progress";

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveProgress(data) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(data));
}

function getModuleProgress(moduleId) {
  const all = loadProgress();
  return all[moduleId] || { stepsDone: 0, quizScore: 0, quizTotal: 0, completed: false };
}

function setModuleSteps(moduleId, stepsDone, totalSteps) {
  const all = loadProgress();
  const prev = all[moduleId] || {};
  const quizOk = (prev.quizScore || 0) >= (prev.quizTotal || 10) * 0.7;
  const practiceOk = (prev.practiceScore || 0) >= (prev.practiceTotal || 4) * 0.7;
  all[moduleId] = {
    ...prev,
    stepsDone,
    totalSteps,
    completed: stepsDone >= totalSteps && quizOk && practiceOk,
  };
  saveProgress(all);
}

function setModuleQuiz(moduleId, score, total, totalSteps) {
  const all = loadProgress();
  const prev = all[moduleId] || {};
  const practiceOk = (prev.practiceScore || 0) >= (prev.practiceTotal || 4) * 0.7;
  all[moduleId] = {
    ...prev,
    quizScore: score,
    quizTotal: total,
    totalSteps: totalSteps || prev.totalSteps || 12,
    completed:
      (prev.stepsDone || 0) >= (totalSteps || prev.totalSteps || 12) &&
      score >= total * 0.7 &&
      practiceOk,
  };
  saveProgress(all);
}

function setModulePractice(moduleId, score, total) {
  const all = loadProgress();
  const prev = all[moduleId] || {};
  const quizOk = (prev.quizScore || 0) >= (prev.quizTotal || 10) * 0.7;
  all[moduleId] = {
    ...prev,
    practiceScore: score,
    practiceTotal: total,
    completed:
      (prev.stepsDone || 0) >= (prev.totalSteps || 12) &&
      quizOk &&
      score >= total * 0.7,
  };
  saveProgress(all);
}

function getOverallProgress(moduleIds) {
  let done = 0;
  moduleIds.forEach((id) => {
    if (getModuleProgress(id).completed) done++;
  });
  return { done, total: moduleIds.length, pct: Math.round((done / moduleIds.length) * 100) };
}

window.loadProgress = loadProgress;
window.getModuleProgress = getModuleProgress;
window.setModuleSteps = setModuleSteps;
window.setModuleQuiz = setModuleQuiz;
window.setModulePractice = setModulePractice;
window.getOverallProgress = getOverallProgress;
