/**
 * Déblocage progressif des modules — lots de 3.
 * Lot 1 (modules 1–3) ouvert à l'abonnement ; chaque lot validé ouvre le suivant.
 */
(function (global) {
  "use strict";
  if (typeof global.isModuleUnlocked === "function") return;

  var FORGE_UNLOCK_BATCH_SIZE = 3;

  function moduleIds() {
    if (typeof getAllModuleIds === "function") return getAllModuleIds();
    if (global.MODULES) return global.MODULES.map(function (m) { return m.id; });
    return [];
  }

  function moduleCompleted(moduleId) {
    if (typeof getModuleProgress === "function") {
      var p = getModuleProgress(moduleId);
      return !!(p && p.completed);
    }
    return false;
  }

  /**
   * Index max (inclus) dans l'ordre du parcours.
   */
  function getMaxUnlockedModuleIndex() {
    var ids = moduleIds();
    if (!ids.length) return -1;
    var maxIdx = Math.min(FORGE_UNLOCK_BATCH_SIZE - 1, ids.length - 1);
    var batchStart = 0;
    while (batchStart + FORGE_UNLOCK_BATCH_SIZE <= ids.length) {
      var batch = ids.slice(batchStart, batchStart + FORGE_UNLOCK_BATCH_SIZE);
      var allDone = batch.every(function (id) { return moduleCompleted(id); });
      if (!allDone) break;
      batchStart += FORGE_UNLOCK_BATCH_SIZE;
      maxIdx = Math.min(
        batchStart + FORGE_UNLOCK_BATCH_SIZE - 1,
        ids.length - 1
      );
    }
    return maxIdx;
  }

  function getModuleIndex(moduleId) {
    var ids = moduleIds();
    return ids.indexOf(moduleId);
  }

  function isModuleUnlocked(moduleId) {
    var idx = getModuleIndex(moduleId);
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
    if (!ids.length) return 0;
    return Math.ceil(ids.length / FORGE_UNLOCK_BATCH_SIZE);
  }

  function getCurrentUnlockedBatchNumber() {
    var maxIdx = getMaxUnlockedModuleIndex();
    if (maxIdx < 0) return 0;
    return Math.floor(maxIdx / FORGE_UNLOCK_BATCH_SIZE) + 1;
  }

  function getNextUnlockHint() {
    var ids = moduleIds();
    var maxIdx = getMaxUnlockedModuleIndex();
    if (maxIdx >= ids.length - 1) {
      return "Tous les modules sont ouverts.";
    }
    var batchStart =
      Math.floor(maxIdx / FORGE_UNLOCK_BATCH_SIZE) * FORGE_UNLOCK_BATCH_SIZE;
    var batch = ids.slice(batchStart, batchStart + FORGE_UNLOCK_BATCH_SIZE);
    var missing = batch.filter(function (id) { return !moduleCompleted(id); });
    if (!missing.length) {
      return "Le lot suivant est en cours d'ouverture…";
    }
    var labels = missing.map(function (id) {
      var m = typeof getModuleById === "function" ? getModuleById(id) : null;
      return m ? m.num : id;
    });
    return (
      "Validez les " +
      missing.length +
      " module(s) restant(s) de ce lot (" +
      labels.join(", ") +
      ") pour débloquer les 3 suivants."
    );
  }

  function getUnlockSummaryText() {
    var ids = moduleIds();
    var open = getUnlockedModuleIds().length;
    var batch = getCurrentUnlockedBatchNumber();
    var totalBatches = getUnlockBatchCount();
    return (
      "Parcours par lots : " +
      open +
      " / " +
      ids.length +
      " modules ouverts · lot " +
      batch +
      " / " +
      totalBatches
    );
  }

  function getModuleIdFromPath(path) {
    path = path || "";
    if (!global.MODULES) return null;
    for (var i = 0; i < global.MODULES.length; i++) {
      var m = global.MODULES[i];
      try {
        var u = new URL(m.href);
        if (path === u.pathname || path.endsWith(u.pathname)) return m.id;
      } catch (e) {
        if (m.href && path.indexOf(m.href) !== -1) return m.id;
      }
    }
    var file = path.split("/").pop().replace(/\.html$/i, "");
    if (!file) return null;
    for (var j = 0; j < global.MODULES.length; j++) {
      if (global.MODULES[j].href.indexOf(file) !== -1) return global.MODULES[j].id;
    }
    return null;
  }

  global.FORGE_UNLOCK_BATCH_SIZE = FORGE_UNLOCK_BATCH_SIZE;
  global.getMaxUnlockedModuleIndex = getMaxUnlockedModuleIndex;
  global.isModuleUnlocked = isModuleUnlocked;
  global.getUnlockedModuleIds = getUnlockedModuleIds;
  global.getUnlockSummaryText = getUnlockSummaryText;
  global.getNextUnlockHint = getNextUnlockHint;
  global.getModuleIdFromPath = getModuleIdFromPath;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this);
