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
      ? "Progression sauvegardée"
      : _progressSyncStatus === "syncing"
        ? "Sauvegarde…"
        : _progressSyncStatus === "offline"
          ? "Progression locale (navigateur)"
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
  forgeScheduleUnlockUI();
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

/** Déblocage par lots de 3 + masquage index (compatible ancien course-index.js VPS). */
(function (global) {
  "use strict";
  if (typeof global.isModuleUnlocked === "function") return;

  var BATCH = 3;
  var FALLBACK_IDS = [
    "intro", "f01", "f02", "f03", "f04", "f05", "mac01", "mac02", "mac03", "mac04",
    "module-01", "module-02", "module-03", "module-04", "module-05", "module-06",
    "module-07", "module-08", "module-09", "module-10", "module-11",
    "tool-courtiers", "tool-indicateurs", "divers-bourse", "divers-crypto",
    "data-journal", "mindset", "pro-fiscalite", "pro-regulation", "pro-instruments",
    "pro-options", "pro-news", "pro-drawdown", "pro-backtesting", "pro-scaling",
    "pro-asie", "pro-tilt",
  ];

  function moduleIds() {
    if (typeof getAllModuleIds === "function") return getAllModuleIds();
    if (global.MODULES) return global.MODULES.map(function (m) { return m.id; });
    return FALLBACK_IDS;
  }

  function moduleCompleted(moduleId) {
    var p = getModuleProgress(moduleId);
    return !!(p && p.completed);
  }

  function getMaxUnlockedModuleIndex() {
    var ids = moduleIds();
    if (!ids.length) return -1;
    var maxIdx = Math.min(BATCH - 1, ids.length - 1);
    var batchStart = 0;
    while (batchStart + BATCH <= ids.length) {
      var batch = ids.slice(batchStart, batchStart + BATCH);
      if (!batch.every(moduleCompleted)) break;
      batchStart += BATCH;
      maxIdx = Math.min(batchStart + BATCH - 1, ids.length - 1);
    }
    return maxIdx;
  }

  function isModuleUnlocked(moduleId) {
    var idx = moduleIds().indexOf(moduleId);
    if (idx < 0) return false;
    return idx <= getMaxUnlockedModuleIndex();
  }

  function getUnlockedModuleIds() {
    var ids = moduleIds();
    var maxIdx = getMaxUnlockedModuleIndex();
    return ids.slice(0, maxIdx + 1);
  }

  function getUnlockBatchCount() {
    var ids = moduleIds();
    return ids.length ? Math.ceil(ids.length / BATCH) : 0;
  }

  function getCurrentUnlockedBatchNumber() {
    var maxIdx = getMaxUnlockedModuleIndex();
    if (maxIdx < 0) return 0;
    return Math.floor(maxIdx / BATCH) + 1;
  }

  function getNextUnlockHint() {
    var ids = moduleIds();
    var maxIdx = getMaxUnlockedModuleIndex();
    if (maxIdx >= ids.length - 1) return "Tous les modules sont ouverts.";
    var batchStart = Math.floor(maxIdx / BATCH) * BATCH;
    var batch = ids.slice(batchStart, batchStart + BATCH);
    var missing = batch.filter(function (id) { return !moduleCompleted(id); });
    if (!missing.length) return "Le lot suivant est en cours d'ouverture…";
    var labels = missing.map(function (id) {
      var m = typeof getModuleById === "function" ? getModuleById(id) : null;
      return m ? m.num : id;
    });
    return "Validez les " + missing.length + " module(s) restant(s) de ce lot (" + labels.join(", ") + ") pour débloquer les 3 suivants.";
  }

  function getUnlockSummaryText() {
    var ids = moduleIds();
    return "Parcours par lots : " + getUnlockedModuleIds().length + " / " + ids.length + " modules ouverts · lot " + getCurrentUnlockedBatchNumber() + " / " + getUnlockBatchCount();
  }

  function getModuleIdFromPath(path) {
    path = path || "";
    if (global.MODULES) {
      for (var i = 0; i < global.MODULES.length; i++) {
        var m = global.MODULES[i];
        try {
          var u = new URL(m.href);
          if (path === u.pathname || path.endsWith(u.pathname)) return m.id;
        } catch (e) {
          if (m.href && path.indexOf(m.href) !== -1) return m.id;
        }
      }
    }
    var file = path.split("/").pop().replace(/\.html$/i, "");
    if (!file) return null;
    if (global.MODULES) {
      for (var j = 0; j < global.MODULES.length; j++) {
        if (global.MODULES[j].href.indexOf(file) !== -1) return global.MODULES[j].id;
      }
    }
    return null;
  }

  function findModuleByNum(num) {
    if (global.MODULES) {
      var m = global.MODULES.find(function (x) { return x.num === num; });
      if (m) return m;
    }
    var idx = -1;
    for (var i = 0; i < FALLBACK_IDS.length; i++) {
      var id = FALLBACK_IDS[i];
      var label = id;
      if (typeof getModuleById === "function") {
        var mod = getModuleById(id);
        if (mod) label = mod.num;
      }
      if (label === num) {
        idx = i;
        break;
      }
    }
    return idx >= 0 ? { id: FALLBACK_IDS[idx], num: num } : null;
  }

  function forgeApplyModuleLockUI() {
    if (!/\/course\/index\.html/i.test(global.location.pathname || "")) return;
    if (!global.MODULES && typeof getAllModuleIds !== "function") return;

    var list = document.getElementById("module-list");
    if (!list) return;

    list.querySelectorAll("li").forEach(function (li) {
      if (li.classList.contains("course-part-header")) return;
      var numEl = li.querySelector(".mod-num");
      if (!numEl) return;
      var mod = findModuleByNum(numEl.textContent.trim());
      if (!mod) return;
      if (!isModuleUnlocked(mod.id)) {
        li.style.display = "none";
        li.dataset.forgeHidden = "1";
      } else {
        li.style.display = "";
        delete li.dataset.forgeHidden;
      }
    });

    list.querySelectorAll("li.course-part-header").forEach(function (header) {
      var next = header.nextElementSibling;
      var anyVisible = false;
      while (next && !next.classList.contains("course-part-header")) {
        if (next.style.display !== "none" && !next.dataset.forgeHidden) anyVisible = true;
        next = next.nextElementSibling;
      }
      header.style.display = anyVisible ? "" : "none";
    });

    var banner = document.getElementById("unlock-banner");
    if (!banner) {
      var host = document.querySelector(".overall-progress");
      if (host) {
        banner = document.createElement("p");
        banner.id = "unlock-banner";
        banner.className = "alert";
        banner.style.cssText = "margin-top:0.75rem;font-size:0.88rem;border-color:rgba(255,180,0,.35)";
        var anchor = host.querySelector("#overall-text");
        if (anchor) anchor.after(banner);
        else host.appendChild(banner);
      }
    }
    if (banner) {
      banner.hidden = false;
      banner.innerHTML =
        "<strong>Parcours guidé</strong> — " + getUnlockSummaryText() +
        ".<br /><span style='color:var(--muted)'>" + getNextUnlockHint() + "</span>";
    }

    var hidden = moduleIds().filter(function (id) { return !isModuleUnlocked(id); }).length;
    var teaserId = "forge-unlock-teaser";
    var teaser = document.getElementById(teaserId);
    if (hidden > 0) {
      if (!teaser) {
        teaser = document.createElement("li");
        teaser.id = teaserId;
        teaser.style.cssText = "display:block;border:none;background:transparent;padding:1rem 0 0";
        list.appendChild(teaser);
      }
      teaser.innerHTML =
        '<div class="alert" style="font-size:0.88rem;border-color:rgba(255,180,0,.25)">' +
        "<strong>" + hidden + " module(s) à venir</strong> — masqués jusqu’au déblocage du lot. " +
        "<span style='color:var(--muted)'>" + getNextUnlockHint() + "</span></div>";
      teaser.style.display = "block";
    } else if (teaser) {
      teaser.style.display = "none";
    }
  }

  function forgeScheduleUnlockUI() {
    forgeApplyModuleLockUI();
    setTimeout(forgeApplyModuleLockUI, 250);
    setTimeout(forgeApplyModuleLockUI, 800);
    setTimeout(forgeApplyModuleLockUI, 2000);
  }

  global.FORGE_UNLOCK_BATCH_SIZE = BATCH;
  global.isModuleUnlocked = isModuleUnlocked;
  global.getUnlockedModuleIds = getUnlockedModuleIds;
  global.getUnlockSummaryText = getUnlockSummaryText;
  global.getNextUnlockHint = getNextUnlockHint;
  global.getModuleIdFromPath = getModuleIdFromPath;
  global.forgeApplyModuleLockUI = forgeApplyModuleLockUI;
  global.forgeScheduleUnlockUI = forgeScheduleUnlockUI;

  document.addEventListener("DOMContentLoaded", function () {
    if (/\/course\/index\.html/i.test(global.location.pathname || "")) {
      forgeScheduleUnlockUI();
    }
  });
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this);

window.loadProgress = loadProgress;
window.getModuleProgress = getModuleProgress;
window.setModuleSteps = setModuleSteps;
window.setModuleQuiz = setModuleQuiz;
window.setModulePractice = setModulePractice;
window.getOverallProgress = getOverallProgress;
window.getModuleCompletionHint = getModuleCompletionHint;
window.initForgeProgress = initForgeProgress;
window.syncProgressFromServer = syncProgressFromServer;
