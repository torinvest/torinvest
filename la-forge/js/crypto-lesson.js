/**
 * Affiche une leçon Crypto (steps + quiz + practice) depuis CRYPTO_LESSONS.
 */
(function () {
  "use strict";

  function qsId() {
    try {
      var p = new URLSearchParams(location.search || "");
      return p.get("id") || "";
    } catch (e) {
      return "";
    }
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function neighborHrefs(moduleId) {
    var ids = typeof getCryptoModuleIds === "function" ? getCryptoModuleIds() : [];
    var i = ids.indexOf(moduleId);
    var prev = i > 0 ? "/crypto/module.html?id=" + ids[i - 1] : null;
    var next = i >= 0 && i < ids.length - 1 ? "/crypto/module.html?id=" + ids[i + 1] : null;
    return { prev: prev, next: next };
  }

  function renderStepButtons(steps) {
    var nav = document.getElementById("step-buttons");
    if (!nav) return;
    nav.innerHTML = steps
      .map(function (s, i) {
        return (
          '<button type="button" class="step-btn" data-step="' +
          i +
          '">' +
          (i + 1) +
          ". " +
          escapeHtml(s.title) +
          "</button>"
        );
      })
      .join("");
  }

  function renderObjectives(list) {
    var el = document.getElementById("crypto-objectives");
    if (!el || !list || !list.length) return;
    el.innerHTML =
      "<ul>" +
      list
        .map(function (o) {
          return "<li>" + escapeHtml(o) + "</li>";
        })
        .join("") +
      "</ul>";
  }

  window.initCryptoLesson = async function initCryptoLesson() {
    var me =
      typeof initForgeGate === "function"
        ? await initForgeGate({ requirePremium: true })
        : typeof getMe === "function"
          ? await getMe()
          : null;
    if (!me) return;

    if (typeof initForgeProgress === "function") {
      await initForgeProgress(me.email);
    }

    var id = qsId();
    var mod = typeof getCryptoModuleById === "function" ? getCryptoModuleById(id) : null;
    var lesson = typeof getCryptoLesson === "function" ? getCryptoLesson(id) : null;
    var root = document.getElementById("crypto-lesson-root");

    if (!mod || !lesson) {
      if (root) {
        root.innerHTML =
          '<div class="alert alert-warn">Module introuvable. <a href="/crypto/index.html">Retour au parcours Crypto</a></div>';
      }
      return;
    }

    if (me.subscribed && typeof isCryptoModuleUnlocked === "function") {
      if (!isCryptoModuleUnlocked(id)) {
        window.location.replace("/crypto/index.html?locked_module=1");
        return;
      }
    }

    document.title = mod.num + " — " + mod.title + " — Crypto La Forge";
    var titleEl = document.getElementById("crypto-module-title");
    if (titleEl) titleEl.textContent = mod.num + " · " + mod.title;
    var descEl = document.getElementById("crypto-module-desc");
    if (descEl) descEl.textContent = mod.desc;
    var part = typeof getCryptoPartById === "function" ? getCryptoPartById(mod.part) : null;
    var partEl = document.getElementById("crypto-module-part");
    if (partEl && part) partEl.textContent = part.title;

    renderObjectives(lesson.objectives || []);
    renderStepButtons(lesson.steps || []);

    if (typeof initStepLesson === "function") {
      initStepLesson({
        moduleId: id,
        steps: lesson.steps,
        totalSteps: lesson.totalSteps || lesson.steps.length,
      });
    }

    if (typeof initPractice === "function" && lesson.practice) {
      initPractice(id, lesson.practice);
    }
    if (typeof initQuiz === "function" && lesson.quiz) {
      initQuiz(id, lesson.quiz, lesson.totalSteps || lesson.steps.length);
    }

    var nav = neighborHrefs(id);
    if (typeof renderModuleNav === "function") {
      renderModuleNav(nav.prev, nav.next);
    }

    if (root) root.hidden = false;
  };
})();

document.addEventListener("DOMContentLoaded", function () {
  if (typeof initCryptoLesson === "function") initCryptoLesson();
});
