/**
 * La Forge ICT-SMC-PRICE ACTION — moteur leçons
 */
function initStepLesson(config) {
  const {
    moduleId,
    steps,
    onStep,
    containerId = "step-text",
    totalSteps = steps.length,
  } = config;
  const textEl = document.getElementById(containerId);
  const progressEl = document.getElementById("lesson-progress");
  const stepLabel = document.getElementById("step-counter");
  const readLabel = document.getElementById("step-reading");
  const buttons = document.querySelectorAll("[data-step]");
  let current = 0;

  function goTo(index) {
    current = Math.max(0, Math.min(steps.length - 1, index));
    buttons.forEach((btn) => {
      btn.classList.toggle("active", Number(btn.dataset.step) === current);
    });
    if (textEl) {
      const s = steps[current];
      let html =
        (s.sub ? '<div class="step-sub">' + s.sub + "</div>" : "") +
        "<h4>" + s.title + "</h4><p>" + s.body + "</p>";
      if (s.detail) html += '<p class="step-detail">' + s.detail + "</p>";
      if (s.institution)
        html += '<div class="inst-box"><strong>Logique institutionnelle</strong><p style="margin-top:0.4rem">' + s.institution + "</p></div>";
      if (s.error)
        html += '<div class="err-box"><strong>Erreur fréquente</strong><p style="margin-top:0.4rem">' + s.error + "</p></div>";
      if (s.xau)
        html += '<div class="xau-box"><strong>Application XAUUSD</strong><p style="margin-top:0.4rem">' + s.xau + "</p></div>";
      if (s.example)
        html += '<div class="example-box"><strong>Exemple concret</strong><p style="margin-top:0.4rem">' + s.example + "</p></div>";
      if (s.key)
        html += '<div class="key-box"><strong>À retenir</strong><p style="margin-top:0.4rem">' + s.key + "</p></div>";
      const mins = s.readMin || 6;
      html += '<p class="reading-time">⏱ Lecture estimée : ~' + mins + " min pour cette section</p>";
      textEl.innerHTML = html;
    }
    if (progressEl) {
      progressEl.style.width = ((current + 1) / steps.length) * 100 + "%";
    }
    if (stepLabel) {
      stepLabel.textContent = "Section " + (current + 1) + " / " + steps.length;
    }
    if (readLabel && steps[current].readMin) {
      readLabel.textContent = "~" + steps[current].readMin + " min";
    }
    if (moduleId && typeof setModuleSteps === "function") {
      setModuleSteps(moduleId, current + 1, totalSteps);
    }
    if (onStep) onStep(current);
    if (typeof ForgeAnnotations !== "undefined") {
      ForgeAnnotations.setLessonStep(current);
    }
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => goTo(Number(btn.dataset.step)));
  });
  document.getElementById("step-prev")?.addEventListener("click", () => goTo(current - 1));
  document.getElementById("step-next")?.addEventListener("click", () => goTo(current + 1));

  goTo(0);
}

function initQuiz(moduleId, questions, totalSteps) {
  const form = document.getElementById("module-quiz");
  const resultEl = document.getElementById("quiz-result");
  if (!form) return;
  const stepsTotal = totalSteps || 12;

  form.innerHTML = questions
    .map(
      (q, i) =>
        '<fieldset class="quiz-q"><legend>' + (i + 1) + ". " + q.q + "</legend>" +
        q.a.map((opt, j) =>
          '<label class="quiz-opt"><input type="radio" name="q' + i + '" value="' + j + '" required /> ' + opt + "</label>"
        ).join("") + "</fieldset>"
    )
    .join("");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    let score = 0;
    questions.forEach((q, i) => {
      const picked = form.querySelector('input[name="q' + i + '"]:checked');
      if (picked && Number(picked.value) === q.correct) score++;
    });
    const pct = Math.round((score / questions.length) * 100);
    const passed = score >= questions.length * 0.7;
    if (typeof setModuleQuiz === "function") {
      setModuleQuiz(moduleId, score, questions.length, stepsTotal);
    }
    resultEl.hidden = false;
    resultEl.className = "alert " + (passed ? "alert-success" : "alert-warn");
    resultEl.textContent = passed
      ? "Validé — " + score + "/" + questions.length + " (" + pct + "%). Module enregistré dans votre progression."
      : score + "/" + questions.length + " (" + pct + "%) — seuil 70% requis. Relisez les sections et le replay chart.";
  });

  const prev = typeof getModuleProgress === "function" ? getModuleProgress(moduleId) : null;
  if (prev && prev.quizScore > 0 && resultEl) {
    resultEl.hidden = false;
    resultEl.className = "alert alert-success";
    resultEl.textContent = "Dernier score : " + prev.quizScore + "/" + prev.quizTotal;
  }
}

function renderModuleNav(prev, next) {
  const nav = document.getElementById("module-nav");
  if (!nav) return;
  nav.innerHTML =
    (prev ? '<a class="btn btn-secondary" href="' + prev + '">← Module précédent</a>' : "<span></span>") +
    (next ? '<a class="btn btn-primary" href="' + next + '">Module suivant →</a>' : "");
}

/**
 * Replay chart annoté (frames SVG ou images TradingView-style)
 */
function initChartReplay(config) {
  const {
    frames,
    svgRootId = "replay-svg",
    counterId = "replay-counter",
    captionId = "replay-caption",
    progressId = "replay-progress",
  } = config;
  if (!frames || !frames.length) return;

  const buttons = document.querySelectorAll("[data-replay]");
  const captionEl = document.getElementById(captionId);
  const counterEl = document.getElementById(counterId);
  const progressEl = document.getElementById(progressId);
  let current = 0;

  function goTo(index) {
    current = Math.max(0, Math.min(frames.length - 1, index));
    buttons.forEach((btn) => {
      btn.classList.toggle("active", Number(btn.dataset.replay) === current);
    });
    frames.forEach((frame, i) => {
      const group = document.getElementById(frame.groupId);
      if (group) group.classList.toggle("anim-hidden", i !== current);
    });
    const f = frames[current];
    if (captionEl) captionEl.textContent = f.caption || "";
    if (counterEl) counterEl.textContent = "Frame " + (current + 1) + " / " + frames.length + (f.label ? " · " + f.label : "");
    if (progressEl) progressEl.style.width = ((current + 1) / frames.length) * 100 + "%";
    if (typeof ForgeAnnotations !== "undefined") {
      ForgeAnnotations.setLessonStep(current);
    }
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => goTo(Number(btn.dataset.replay)));
  });
  document.getElementById("replay-prev")?.addEventListener("click", () => goTo(current - 1));
  document.getElementById("replay-next")?.addEventListener("click", () => goTo(current + 1));

  goTo(0);
}

/**
 * Exercices pratiques corrigés (MCQ + multi-select)
 */
function initPractice(moduleId, exercises) {
  const root = document.getElementById("practice-root");
  const resultEl = document.getElementById("practice-result");
  if (!root || !exercises.length) return;

  root.innerHTML = exercises
    .map((ex, i) => {
      const inputType = ex.type === "multi" ? "checkbox" : "radio";
      const name = ex.type === "multi" ? "pex" + i : "pex" + i;
      const opts = ex.options
        .map(
          (opt, j) =>
            '<label class="practice-opt"><input type="' +
            inputType +
            '" name="' +
            name +
            '" value="' +
            j +
            '" /> ' +
            opt +
            "</label>"
        )
        .join("");
      return (
        '<div class="practice-item" data-ex="' +
        i +
        '"><div class="practice-num">Exercice ' +
        (i + 1) +
        "</div><p class=\"practice-q\">" +
        ex.q +
        '</p><div class="practice-options">' +
        opts +
        '</div><div class="practice-feedback" hidden></div></div>'
      );
    })
    .join("");

  document.getElementById("practice-check")?.addEventListener("click", () => {
    let correct = 0;
    exercises.forEach((ex, i) => {
      const item = root.querySelector('[data-ex="' + i + '"]');
      const fb = item?.querySelector(".practice-feedback");
      const picked = Array.from(item.querySelectorAll("input:checked")).map((el) => Number(el.value));
      let ok = false;
      if (ex.type === "multi") {
        const want = (ex.correct || []).slice().sort().join(",");
        ok = picked.slice().sort().join(",") === want;
      } else {
        ok = picked.length === 1 && picked[0] === ex.correct;
      }
      if (ok) correct++;
      if (fb) {
        fb.hidden = false;
        fb.className = "practice-feedback " + (ok ? "ok" : "ko");
        fb.innerHTML = (ok ? "✓ Correct. " : "✗ Incorrect. ") + (ex.explain || "");
      }
    });
    const pct = Math.round((correct / exercises.length) * 100);
    if (resultEl) {
      resultEl.hidden = false;
      resultEl.className = "alert " + (pct >= 70 ? "alert-success" : "alert-warn");
      resultEl.textContent =
        correct +
        "/" +
        exercises.length +
        " exercices corrects (" +
        pct +
        "%)" +
        (pct >= 70 ? " — prêt pour le quiz." : " — relisez les frames replay et réessayez.");
    }
    if (typeof setModulePractice === "function") {
      setModulePractice(moduleId, correct, exercises.length);
    }
  });
}

window.initStepLesson = initStepLesson;
window.initQuiz = initQuiz;
window.renderModuleNav = renderModuleNav;
window.initChartReplay = initChartReplay;
window.initPractice = initPractice;

/**
 * Exercice chart — travail guidé sur graphique (TradingView / replay)
 */
function initChartExercise(moduleId, config) {
  const root = document.getElementById("chart-exercise-root");
  if (!root || !config) return;

  const tasks = config.tasks || [];
  root.innerHTML =
    '<div class="chart-exercise-box">' +
    '<p class="chart-exercise-intro">' + (config.intro || "Exercice pratique sur chart — ouvrez TradingView ou le replay du module.") + "</p>" +
    (config.chartHint ? '<div class="chart-exercise-hint">' + config.chartHint + "</div>" : "") +
    '<ol class="chart-exercise-tasks">' +
    tasks.map((t, i) =>
      '<li><label><input type="checkbox" data-task="' + i + '" /> <strong>' + t.title + "</strong><br/><span>" + t.desc + "</span></label></li>"
    ).join("") +
    "</ol>" +
    '<div class="form-group"><label>Vos annotations / conclusions (sauvegardé localement)</label>' +
    '<textarea id="chart-exercise-notes" rows="5" placeholder="Ex : RH à 2420, sweep SSL bougie 7, MSS confirmé bougie 8…"></textarea></div>' +
    '<button type="button" class="btn btn-primary" id="chart-exercise-save">Enregistrer mon exercice</button>' +
    '<div id="chart-exercise-msg" class="alert" hidden style="margin-top:0.75rem"></div></div>';

  const storageKey = "forge_chart_ex_" + moduleId;
  const notesEl = document.getElementById("chart-exercise-notes");
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
    if (notesEl && saved.notes) notesEl.value = saved.notes;
    (saved.done || []).forEach((i) => {
      const cb = root.querySelector('[data-task="' + i + '"]');
      if (cb) cb.checked = true;
    });
  } catch (_) {}

  document.getElementById("chart-exercise-save")?.addEventListener("click", () => {
    const done = Array.from(root.querySelectorAll("input[data-task]:checked")).map((el) => Number(el.dataset.task));
    const notes = notesEl?.value || "";
    localStorage.setItem(storageKey, JSON.stringify({ notes, done, savedAt: new Date().toISOString() }));
    const msg = document.getElementById("chart-exercise-msg");
    if (msg) {
      msg.hidden = false;
      msg.className = "alert alert-success";
      msg.textContent = "Exercice chart enregistré (" + done.length + "/" + tasks.length + " tâches cochées).";
    }
    if (typeof setModulePractice === "function" && done.length >= Math.ceil(tasks.length * 0.7)) {
      setModulePractice(moduleId + "-chart", done.length, tasks.length);
    }
  });
}

window.initChartExercise = initChartExercise;
