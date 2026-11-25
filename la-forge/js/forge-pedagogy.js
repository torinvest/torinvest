/**
 * Pédagogie transversale — mini-cas, checklist session, atlas quiz, swing exercise.
 */
(function (global) {
  "use strict";

  var SESSION_CHECKLIST = [
    { id: "bias", label: "Biais HTF écrit (long / short / flat)" },
    { id: "invalidation", label: "Invalidation claire (niveau ou événement)" },
    { id: "risk", label: "Risque défini (R ou % compte)" },
    { id: "session", label: "Fenêtre / killzone choisie" },
    { id: "journal", label: "Prêt à journaliser le trade ou la revue" },
  ];

  var MINI_CASES = {
    f01: {
      before: {
        title: "Avant",
        body: "Le retail voit une « cassurre » sous un creux et short agressivement sur la mèche.",
      },
      after: {
        title: "Après",
        body: "Lecture ICT : sweep SSL → attendre réintégration + confirmation. L’entrée n’est pas sur le sweep.",
      },
      tip: "Capture le même setup sur TradingView avant de valider le quiz.",
    },
    "module-01": {
      before: {
        title: "Avant",
        body: "Shorter dès que le prix casse un HL, sans contexte H4 ni sweep.",
      },
      after: {
        title: "Après",
        body: "Range H4 → premium → sweep → MSS → entrée OB/FVG avec SL au-delà du sweep.",
      },
      tip: "Reproduis le cas London du module sur M15.",
    },
    "module-09": {
      before: {
        title: "Avant",
        body: "Entrer sur un FVG isolé sans liquidité ni MSS.",
      },
      after: {
        title: "Après",
        body: "Séquence 2022 : sweep → MSS → overlap FVG/OB → R:R ≥ 1:2 écrit.",
      },
    },
    "c16-price-action": {
      before: {
        title: "Avant",
        body: "Trader BTC sur un RSI surachat sans structure ni liquidité.",
      },
      after: {
        title: "Après",
        body: "Structure + pool + confirmation — même grammaire que XAU, volatilité crypto adaptée.",
      },
    },
    "c24-capstone": {
      before: {
        title: "Avant",
        body: "Checklist floue, taille max, narrative FOMO.",
      },
      after: {
        title: "Après",
        body: "Bias → setup → risque → exécution → revue. Circuit breaker daily loss.",
      },
    },
  };

  var ATLAS_DEFAULT_QUIZ = {
    ict: [
      {
        q: "Un sweep de liquidité suffit-il à entrer ?",
        a: ["Oui, toujours", "Non — il faut confirmation / structure", "Seulement en M1"],
        correct: 1,
      },
      {
        q: "BSL se situe plutôt…",
        a: ["Sous les creux", "Au-dessus des sommets", "Au milieu du range"],
        correct: 1,
      },
      {
        q: "Un FVG est…",
        a: ["Une garantie de comblement", "Un déséquilibre 3 bougies à contextualiser", "Un indicateur RSI"],
        correct: 1,
      },
    ],
    styles: [
      {
        q: "Un pattern chartiste sans contexte…",
        a: ["Est un signal automatique", "Doit être lu avec structure / volume", "Remplace le risk management"],
        correct: 1,
      },
      {
        q: "Le volume profile sert surtout à…",
        a: ["Prédire les news", "Repérer zones de valeur / POC", "Remplacer le plan"],
        correct: 1,
      },
      {
        q: "Footprint / carnet…",
        a: ["Donnent le futur certain", "Aident à lire l’agressivité relative", "Sont inutiles"],
        correct: 1,
      },
    ],
    psycho: [
      {
        q: "Après 2 pertes d’affilée, le protocole sain est…",
        a: ["Doubler la taille", "Pause / revue process", "Changer de TF immédiatement"],
        correct: 1,
      },
      {
        q: "Le FOMO est…",
        a: ["Une edge", "Une émotion à détecter avant l’entrée", "Preuve que le setup est bon"],
        correct: 1,
      },
      {
        q: "Le journal mental sert à…",
        a: ["Justifier les pertes", "Mesurer discipline et triggers", "Remplacer le journal trades"],
        correct: 1,
      },
    ],
  };

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function checklistKey(moduleId) {
    return "forge_session_check:" + String(moduleId || "");
  }

  function readChecklist(moduleId) {
    try {
      var raw = localStorage.getItem(checklistKey(moduleId));
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  function writeChecklist(moduleId, map) {
    try {
      localStorage.setItem(checklistKey(moduleId), JSON.stringify(map || {}));
    } catch (_) {}
  }

  function initSessionChecklist(moduleId, rootId) {
    var root = document.getElementById(rootId || "session-checklist-root");
    if (!root || !moduleId) return;
    var state = readChecklist(moduleId);
    root.innerHTML =
      '<div class="ped-checklist">' +
      "<h3>Checklist de session</h3>" +
      '<p class="ped-muted">Coche avant de valider le quiz — ancre le process.</p>' +
      "<ul>" +
      SESSION_CHECKLIST.map(function (item) {
        return (
          '<li><label><input type="checkbox" data-check="' +
          esc(item.id) +
          '"' +
          (state[item.id] ? " checked" : "") +
          " /> " +
          esc(item.label) +
          "</label></li>"
        );
      }).join("") +
      "</ul>" +
      '<p class="ped-check-status" id="session-check-status"></p></div>';

    function refresh() {
      var done = SESSION_CHECKLIST.filter(function (i) {
        return !!state[i.id];
      }).length;
      var el = document.getElementById("session-check-status");
      if (el) {
        el.textContent =
          done +
          " / " +
          SESSION_CHECKLIST.length +
          " cochés" +
          (done >= SESSION_CHECKLIST.length ? " — prêt pour le quiz." : ".");
      }
    }

    root.querySelectorAll("[data-check]").forEach(function (inp) {
      inp.addEventListener("change", function () {
        state[inp.getAttribute("data-check")] = !!inp.checked;
        writeChecklist(moduleId, state);
        refresh();
      });
    });
    refresh();
  }

  function initMiniCase(moduleId, rootId) {
    var root = document.getElementById(rootId || "mini-case-root");
    if (!root || !moduleId) return;
    var cfg = MINI_CASES[moduleId];
    if (!cfg) {
      root.hidden = true;
      return;
    }
    root.hidden = false;
    root.innerHTML =
      '<div class="ped-minicase">' +
      "<h3>Mini-cas avant / après</h3>" +
      '<div class="ped-minicase-grid">' +
      '<article class="ped-before"><h4>' +
      esc(cfg.before.title) +
      "</h4><p>" +
      esc(cfg.before.body) +
      "</p></article>" +
      '<article class="ped-after"><h4>' +
      esc(cfg.after.title) +
      "</h4><p>" +
      esc(cfg.after.body) +
      "</p></article>" +
      "</div>" +
      (cfg.tip ? '<p class="ped-tip">' + esc(cfg.tip) + "</p>" : "") +
      "</div>";
  }

  function renderAtlasQuiz(root, questions, storageKey) {
    if (!root || !questions || !questions.length) return;
    var key = storageKey || "atlas-quiz";
    root.innerHTML =
      '<div class="ped-atlas-quiz">' +
      "<h3>Quiz express (3 Q)</h3>" +
      '<p class="ped-muted">Ancrage — ne valide aucun module Formation.</p>' +
      '<form id="' +
      esc(key) +
      '-form">' +
      questions
        .map(function (q, i) {
          return (
            '<fieldset class="quiz-q"><legend>' +
            (i + 1) +
            ". " +
            esc(q.q) +
            "</legend>" +
            (q.a || [])
              .map(function (opt, j) {
                return (
                  '<label class="quiz-opt"><input type="radio" name="aq' +
                  i +
                  '" value="' +
                  j +
                  '" required /> ' +
                  esc(opt) +
                  "</label>"
                );
              })
              .join("") +
            "</fieldset>"
          );
        })
        .join("") +
      '<button type="submit" class="btn btn-secondary btn-sm">Corriger</button>' +
      '</form><div id="' +
      esc(key) +
      '-result" class="alert" hidden style="margin-top:0.75rem"></div></div>';

    var form = document.getElementById(key + "-form");
    var result = document.getElementById(key + "-result");
    form?.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var score = 0;
      questions.forEach(function (q, i) {
        var picked = form.querySelector('input[name="aq' + i + '"]:checked');
        if (picked && Number(picked.value) === q.correct) score++;
      });
      var pct = Math.round((score / questions.length) * 100);
      if (result) {
        result.hidden = false;
        result.className = "alert " + (pct >= 70 ? "alert-success" : "alert-warn");
        result.textContent = score + "/" + questions.length + " (" + pct + "%)";
      }
      try {
        localStorage.setItem(
          "forge_atlas_quiz:" + key,
          JSON.stringify({ score: score, total: questions.length, at: new Date().toISOString() })
        );
      } catch (_) {}
    });
  }

  function initAtlasDefaultQuiz(kind, rootId) {
    var root = document.getElementById(rootId || "atlas-quiz-root");
    var qs = ATLAS_DEFAULT_QUIZ[kind];
    if (!root || !qs) return;
    renderAtlasQuiz(root, qs, "atlas-" + kind);
  }

  function chartGateMessage(moduleId) {
    return (
      "Exercice chart requis avant le quiz pour ce module (" +
      moduleId +
      "). Coche ≥ 70 % des tâches et enregistre."
    );
  }

  async function isChartExerciseSatisfied(moduleId) {
    if (!moduleId || !global.CHART_EXERCISE_REGISTRY || !global.CHART_EXERCISE_REGISTRY[moduleId]) {
      return { required: false, ok: true };
    }
    var cfg = global.CHART_EXERCISE_REGISTRY[moduleId];
    var tasks = (cfg && cfg.tasks) || [];
    var need = Math.max(1, Math.ceil(tasks.length * 0.7));
    try {
      var res = await fetch("/api/chart-exercises/" + encodeURIComponent(moduleId), {
        credentials: "same-origin",
      });
      if (res.status === 404) return { required: true, ok: false, need: need, done: 0 };
      var data = await res.json().catch(function () {
        return {};
      });
      var done = (data.exercise && Array.isArray(data.exercise.done) && data.exercise.done.length) || 0;
      return { required: true, ok: done >= need, need: need, done: done };
    } catch (_) {
      return { required: true, ok: false, need: need, done: 0 };
    }
  }

  global.ForgePedagogy = {
    SESSION_CHECKLIST: SESSION_CHECKLIST,
    MINI_CASES: MINI_CASES,
    ATLAS_DEFAULT_QUIZ: ATLAS_DEFAULT_QUIZ,
    initSessionChecklist: initSessionChecklist,
    initMiniCase: initMiniCase,
    renderAtlasQuiz: renderAtlasQuiz,
    initAtlasDefaultQuiz: initAtlasDefaultQuiz,
    isChartExerciseSatisfied: isChartExerciseSatisfied,
    chartGateMessage: chartGateMessage,
  };
})(typeof window !== "undefined" ? window : global);
