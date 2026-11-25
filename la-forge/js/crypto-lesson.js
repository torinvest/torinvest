/**
 * Affiche une leçon Crypto enrichie : schémas SVG + steps + quiz + practice.
 */
(function () {
  "use strict";

  function qsId() {
    try {
      return new URLSearchParams(location.search || "").get("id") || "";
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
    return {
      prev: i > 0 ? "/crypto/module.html?id=" + ids[i - 1] : null,
      next: i >= 0 && i < ids.length - 1 ? "/crypto/module.html?id=" + ids[i + 1] : null,
    };
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

  function schemaHtml(schemaId, moduleId) {
    var sch = null;
    if (schemaId && typeof getCryptoSchema === "function") sch = getCryptoSchema(schemaId);
    if (!sch && moduleId && typeof getCryptoSchemaForModule === "function") {
      sch = getCryptoSchemaForModule(moduleId);
    }
    if (!sch) return "";
    return (
      '<figure class="crypto-schema">' +
      '<div class="crypto-schema-frame">' +
      sch.svg +
      "</div>" +
      "<figcaption><strong>" +
      escapeHtml(sch.title) +
      "</strong> — " +
      escapeHtml(sch.caption) +
      "</figcaption></figure>"
    );
  }

  function bulletsHtml(bullets) {
    if (!bullets || !bullets.length) return "";
    return (
      '<ul class="crypto-bullets">' +
      bullets
        .map(function (b) {
          return "<li>" + escapeHtml(b) + "</li>";
        })
        .join("") +
      "</ul>"
    );
  }

  function box(cls, title, text) {
    if (!text) return "";
    return (
      '<div class="' +
      cls +
      '"><strong>' +
      title +
      '</strong><p style="margin-top:0.4rem">' +
      escapeHtml(text) +
      "</p></div>"
    );
  }

  function renderStepContent(step, moduleId) {
    var html = "";
    if (step.sub) html += '<div class="step-sub">' + escapeHtml(step.sub) + "</div>";
    html += "<h4>" + escapeHtml(step.title) + "</h4>";
    if (step.schema) html += schemaHtml(step.schema, null);
    html += "<p>" + escapeHtml(step.body || "") + "</p>";
    html += bulletsHtml(step.bullets);
    if (step.detail) html += '<p class="step-detail">' + escapeHtml(step.detail) + "</p>";
    html += box("inst-box", "Logique marché / institutions", step.institution);
    html += box("err-box", "Erreur fréquente", step.error);
    html += box("example-box", "Exemple concret", step.example);
    html += box("key-box", "À retenir", step.key);
    if (step.checklist && step.checklist.length) {
      html +=
        '<div class="crypto-checklist"><strong>Checklist</strong><ol>' +
        step.checklist
          .map(function (c) {
            return "<li>" + escapeHtml(c) + "</li>";
          })
          .join("") +
        "</ol></div>";
    }
    var mins = step.readMin || 6;
    html +=
      '<p class="reading-time">⏱ Lecture estimée : ~' + mins + " min pour cette section</p>";
    return html;
  }

  function initCryptoSteps(moduleId, steps, totalSteps) {
    var textEl = document.getElementById("step-text");
    var progressEl = document.getElementById("lesson-progress");
    var stepLabel = document.getElementById("step-counter");
    var readLabel = document.getElementById("step-reading");
    var nav = document.getElementById("step-buttons");
    if (!textEl || !nav || !steps.length) return;

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

    var buttons = nav.querySelectorAll("[data-step]");
    var current = 0;
    var total = totalSteps || steps.length;

    function goTo(index) {
      current = Math.max(0, Math.min(steps.length - 1, index));
      buttons.forEach(function (btn) {
        btn.classList.toggle("active", Number(btn.dataset.step) === current);
      });
      var s = steps[current];
      textEl.innerHTML = renderStepContent(s, moduleId);
      if (progressEl) progressEl.style.width = ((current + 1) / steps.length) * 100 + "%";
      if (stepLabel) stepLabel.textContent = "Section " + (current + 1) + " / " + steps.length;
      if (readLabel && s.readMin) readLabel.textContent = "~" + s.readMin + " min";
      if (moduleId && typeof setModuleSteps === "function") {
        setModuleSteps(moduleId, current + 1, total);
      }
    }

    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        goTo(Number(btn.dataset.step));
      });
    });
    document.getElementById("step-prev")?.addEventListener("click", function () {
      goTo(current - 1);
    });
    document.getElementById("step-next")?.addEventListener("click", function () {
      goTo(current + 1);
    });
    goTo(0);
  }

  function renderModuleSchemaRail(moduleId) {
    var rail = document.getElementById("crypto-schema-rail");
    if (!rail || typeof getCryptoSchemaForModule !== "function") return;
    var sch = getCryptoSchemaForModule(moduleId);
    if (!sch) {
      rail.hidden = true;
      return;
    }
    rail.hidden = false;
    rail.innerHTML =
      '<div class="crypto-schema-rail-inner"><h3>Schéma du module</h3>' +
      '<div class="crypto-schema-frame">' +
      sch.svg +
      '</div><p class="crypto-schema-cap">' +
      escapeHtml(sch.title) +
      " — " +
      escapeHtml(sch.caption) +
      "</p></div>";
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
    renderModuleSchemaRail(id);
    initCryptoSteps(id, lesson.steps || [], lesson.totalSteps || (lesson.steps || []).length);

    if (typeof ForgePedagogy !== "undefined") {
      ForgePedagogy.initMiniCase(id);
      ForgePedagogy.initSessionChecklist(id);
    }

    var chartWrap = document.getElementById("crypto-chart-wrap");
    var chartCfg =
      typeof CHART_EXERCISE_REGISTRY !== "undefined" ? CHART_EXERCISE_REGISTRY[id] : null;
    if (chartCfg && chartWrap && typeof initChartExercise === "function") {
      chartWrap.hidden = false;
      initChartExercise(id, chartCfg);
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
