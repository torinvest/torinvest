/**
 * La Forge ICT-SMC-PRICE ACTION — moteur leçons
 */

function markChartClutter(svg) {
  if (!svg || svg.dataset.clutterMarked === "1") return;
  svg.dataset.clutterMarked = "1";
  svg.querySelectorAll("text").forEach((t) => {
    if (t.closest(".fc-callout")) return;
    const txt = (t.textContent || "").trim();
    if (txt.length < 22) return;
    const g = t.closest("g");
    if (g) g.classList.add("chart-clutter-label");
  });
}

function mergeBBox(acc, bb) {
  if (!bb || bb.width <= 0 || bb.height <= 0) return acc;
  if (!acc) return { x: bb.x, y: bb.y, width: bb.width, height: bb.height };
  const x2 = Math.max(acc.x + acc.width, bb.x + bb.width);
  const y2 = Math.max(acc.y + acc.height, bb.y + bb.height);
  acc.x = Math.min(acc.x, bb.x);
  acc.y = Math.min(acc.y, bb.y);
  acc.width = x2 - acc.x;
  acc.height = y2 - acc.y;
  return acc;
}

function isHiddenChartEl(el) {
  if (!el) return true;
  if (el.classList.contains("anim-hidden")) return true;
  return Boolean(el.closest(".anim-hidden"));
}

function ensureChartZoomWrap(chartHost) {
  const svg = chartHost.querySelector("svg");
  if (!svg) return null;
  const parent = svg.parentElement;
  if (!parent.classList.contains("chart-zoom-wrap")) {
    const wrap = document.createElement("div");
    wrap.className = "chart-zoom-wrap";
    svg.parentNode.insertBefore(wrap, svg);
    wrap.appendChild(svg);
  }
  return svg;
}

function saveSvgFitState(svg) {
  if (svg.dataset.forgeFitSaved === "1") return;
  svg.dataset.forgeFitSaved = "1";
  svg.dataset.forgeOrigViewBox = svg.getAttribute("viewBox") || "";
  svg.dataset.forgeOrigPreserve = svg.getAttribute("preserveAspectRatio") || "";
  svg.dataset.forgeOrigWidth = svg.getAttribute("width") || "";
  svg.dataset.forgeOrigHeight = svg.getAttribute("height") || "";
}

function restoreChartViewBox(chartRoot) {
  const svg = chartRoot?.querySelector(".chart-zoom-wrap svg");
  if (!svg || svg.dataset.forgeFitSaved !== "1") return;
  if (svg.dataset.forgeOrigViewBox) {
    svg.setAttribute("viewBox", svg.dataset.forgeOrigViewBox);
  } else {
    svg.removeAttribute("viewBox");
  }
  if (svg.dataset.forgeOrigPreserve) {
    svg.setAttribute("preserveAspectRatio", svg.dataset.forgeOrigPreserve);
  } else {
    svg.removeAttribute("preserveAspectRatio");
  }
  if (svg.dataset.forgeOrigWidth) svg.setAttribute("width", svg.dataset.forgeOrigWidth);
  else svg.removeAttribute("width");
  if (svg.dataset.forgeOrigHeight) svg.setAttribute("height", svg.dataset.forgeOrigHeight);
  else svg.removeAttribute("height");
  svg.style.transform = "none";
  svg.style.width = "";
  svg.style.height = "";
  svg.style.maxHeight = "";
}

function isReplayBaseGroup(id) {
  return /^(base|base-|bg-|background|chart-base|candles|replay-base)/i.test(id || "");
}

function getFitBBox(svg, chartRoot) {
  let merged = null;
  const isReplay = chartRoot._forgeChartMode === "replay";
  const stepLayers = svg.querySelectorAll("[data-lesson-step]");

  if (stepLayers.length && !isReplay) {
    stepLayers.forEach((el) => {
      if (isHiddenChartEl(el)) return;
      try {
        merged = mergeBBox(merged, el.getBBox());
      } catch (_) {}
    });
    svg.querySelectorAll(".fc-callout:not(.anno-step-hidden):not(.anno-off)").forEach((el) => {
      if (isHiddenChartEl(el)) return;
      try {
        merged = mergeBBox(merged, el.getBBox());
      } catch (_) {}
    });
    if (merged) return merged;
  }

  if (isReplay) {
    const visibleGroups = [];
    svg.querySelectorAll("g[id]").forEach((g) => {
      if (g.closest("defs")) return;
      if (isHiddenChartEl(g)) return;
      visibleGroups.push(g);
    });
    const frameGroups = visibleGroups.filter((g) => !isReplayBaseGroup(g.id));
    const targets = frameGroups.length ? frameGroups : visibleGroups;
    targets.forEach((g) => {
      try {
        const bb = g.getBBox();
        if (bb.width > 2 && bb.height > 2) merged = mergeBBox(merged, bb);
      } catch (_) {}
    });
  } else if (!stepLayers.length) {
    svg.querySelectorAll("g[id]").forEach((g) => {
      if (g.closest("defs")) return;
      if (isHiddenChartEl(g)) return;
      try {
        const bb = g.getBBox();
        if (bb.width > 2 && bb.height > 2) merged = mergeBBox(merged, bb);
      } catch (_) {}
    });
  }

  svg.querySelectorAll(".fc-callout:not(.anno-step-hidden):not(.anno-off)").forEach((el) => {
    if (isHiddenChartEl(el)) return;
    try {
      merged = mergeBBox(merged, el.getBBox());
    } catch (_) {}
  });

  if (!merged) {
    svg.querySelectorAll("g, path, line, rect, circle, polyline, text").forEach((el) => {
      if (el.closest("defs")) return;
      if (isHiddenChartEl(el)) return;
      try {
        const bb = el.getBBox();
        if (bb.width > 4 && bb.height > 4) merged = mergeBBox(merged, bb);
      } catch (_) {}
    });
  }

  if (merged) return merged;
  try {
    return svg.getBBox();
  } catch (_) {
    return { x: 0, y: 0, width: svg.clientWidth || 800, height: svg.clientHeight || 400 };
  }
}

function fitChartToWrap(chartRoot) {
  const wrap = chartRoot.querySelector(".chart-zoom-wrap");
  const svg = wrap?.querySelector("svg");
  if (!wrap || !svg) return;

  saveSvgFitState(svg);
  svg.style.transform = "none";
  svg.style.width = "100%";
  svg.style.height = "100%";
  svg.style.maxWidth = "100%";
  svg.style.maxHeight = "100%";
  svg.removeAttribute("width");
  svg.removeAttribute("height");

  const applyFit = () => {
    let ch = wrap.clientHeight;
    if (ch < 40) {
      wrap.style.minHeight = chartRoot.classList.contains("chart-in-viewer") ? "50vh" : "280px";
      ch = wrap.clientHeight;
    }
    if (wrap.clientWidth < 20 || ch < 20) return;

    try {
      const bb = getFitBBox(svg, chartRoot);
      const padRatio = chartRoot.classList.contains("chart-in-viewer") ? 0.08 : 0.06;
      const pad = Math.max(16, Math.min(bb.width, bb.height) * padRatio);
      const x = bb.x - pad;
      const y = bb.y - pad;
      const w = Math.max(bb.width + pad * 2, 1);
      const h = Math.max(bb.height + pad * 2, 1);
      svg.setAttribute("viewBox", x + " " + y + " " + w + " " + h);
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    } catch (_) {
      restoreChartViewBox(chartRoot);
    }
  };

  applyFit();
  requestAnimationFrame(() => requestAnimationFrame(applyFit));
}

function bindChartFit(chartRoot) {
  fitChartToWrap(chartRoot);
  if (chartRoot.dataset.fitBound === "1") return;
  chartRoot.dataset.fitBound = "1";
  const wrap = chartRoot.querySelector(".chart-zoom-wrap");
  if (wrap && typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(() => fitChartToWrap(chartRoot));
    ro.observe(wrap);
  }
}

function applyChartStep(stepIndex) {
  syncLessonChartLayers(stepIndex);
  if (typeof ForgeAnnotations !== "undefined" && ForgeAnnotations.setTextStep) {
    ForgeAnnotations.setTextStep(stepIndex);
  }
  document.querySelectorAll(".lesson-layout .forge-chart, .lesson-layout .chart-stage, .chart-in-viewer, .tv-frame.chart-in-viewer").forEach((root) => {
    fitChartToWrap(root);
  });
}

function injectChartToolbar(chartHost) {
  if (!chartHost || chartHost.querySelector(".chart-focus-toolbar")) return;

  ensureChartZoomWrap(chartHost);

  const bar = document.createElement("div");
  bar.className = "chart-focus-toolbar";
  bar.innerHTML =
    '<button type="button" class="chart-focus-btn chart-focus-primary" data-chart-open-viewer>Ouvrir le visualiseur</button>' +
    '<span class="chart-focus-hint">Plein écran · navigation par étape · sans scroll</span>';

  chartHost.classList.add("chart-readable", "chart-simplified");
  const anchor = chartHost.querySelector(".tv-toolbar");
  if (anchor) anchor.insertAdjacentElement("afterend", bar);
  else chartHost.insertBefore(bar, chartHost.firstChild);

  bar.querySelector("[data-chart-open-viewer]").addEventListener("click", () => {
    openChartViewer(chartHost);
  });

  bindChartFit(chartHost);
}

function initChartHostUI(chartHost) {
  if (!chartHost) return;
  const svg = chartHost.querySelector("svg");
  if (svg) markChartClutter(svg);
  injectChartToolbar(chartHost);
}

function openChartViewer(chartRoot) {
  if (document.getElementById("chart-viewer-overlay")) return;

  const nav = chartRoot._forgeChartNav || window.ForgeLessonNav;
  const isReplay = chartRoot._forgeChartMode === "replay";
  const stepWord = isReplay ? "Étape" : "Section";
  const startStep = nav ? nav.getIndex() : Number(chartRoot.dataset.activeStep || 0);

  const overlay = document.createElement("div");
  overlay.id = "chart-viewer-overlay";
  overlay.className = "chart-viewer-overlay";
  overlay.innerHTML =
    '<div class="chart-viewer-panel" role="dialog" aria-label="Visualiseur schéma">' +
    '<header class="chart-viewer-header">' +
    '<div class="chart-viewer-meta">' +
    '<span class="chart-viewer-step-num"></span>' +
    '<strong class="chart-viewer-step-title"></strong>' +
    "</div>" +
    '<div class="chart-viewer-header-actions">' +
    '<button type="button" class="chart-viewer-btn ghost" data-viewer-toggle="labels">Labels</button>' +
    '<button type="button" class="chart-viewer-btn" data-viewer-close>Fermer</button>' +
    "</div></header>" +
    '<div class="chart-viewer-body"></div>' +
    '<footer class="chart-viewer-footer">' +
    '<button type="button" class="chart-viewer-nav" data-viewer-nav="prev">← ' + stepWord + '</button>' +
    '<div class="chart-viewer-pills"></div>' +
    '<button type="button" class="chart-viewer-nav" data-viewer-nav="next">' + stepWord + ' →</button>' +
    "</footer></div>";

  const body = overlay.querySelector(".chart-viewer-body");
  const placeholder = document.createElement("div");
  placeholder.className = "chart-viewer-placeholder";
  placeholder.hidden = true;
  chartRoot.parentNode.insertBefore(placeholder, chartRoot);

  chartRoot.classList.add("chart-in-viewer", "chart-show-all");
  chartRoot.classList.remove("chart-enlarged");
  const inlineBar = chartRoot.querySelector(".chart-focus-toolbar");
  if (inlineBar) inlineBar.hidden = true;

  body.appendChild(chartRoot);
  document.body.appendChild(overlay);
  document.body.classList.add("chart-viewer-open");

  const stepNumEl = overlay.querySelector(".chart-viewer-step-num");
  const stepTitleEl = overlay.querySelector(".chart-viewer-step-title");
  const pillsWrap = overlay.querySelector(".chart-viewer-pills");
  let viewerStep = startStep;
  let labelsOn = true;

  function getStepsMeta() {
    if (nav && nav.getStepButtons) return nav.getStepButtons();
    if (isReplay) {
      return Array.from(document.querySelectorAll("[data-replay]")).map((b) => ({
        index: Number(b.dataset.replay),
        label: (b.textContent || "").trim().replace(/^\d+\.\s*/, ""),
      }));
    }
    return Array.from(document.querySelectorAll("[data-step]")).map((b) => ({
      index: Number(b.dataset.step),
      label: (b.textContent || "").trim().replace(/^\d+\.\s*/, ""),
    }));
  }

  function renderPills() {
    const meta = getStepsMeta();
    pillsWrap.innerHTML = meta
      .map((m) => {
        const short = m.label.length > 14 ? m.label.slice(0, 12) + "…" : m.label;
        return (
          '<button type="button" class="chart-viewer-pill' +
          (m.index === viewerStep ? " active" : "") +
          '" data-viewer-step="' +
          m.index +
          '" title="' +
          m.label.replace(/"/g, "") +
          '">' +
          (m.index + 1) +
          ". " +
          short +
          "</button>"
        );
      })
      .join("");
    pillsWrap.querySelectorAll("[data-viewer-step]").forEach((btn) => {
      btn.addEventListener("click", () => goViewerStep(Number(btn.dataset.viewerStep)));
    });
  }

  function updateHeader() {
    const meta = getStepsMeta();
    const total = nav ? nav.getTotal() : meta.length;
    const title = nav ? nav.getTitle(viewerStep) : meta.find((m) => m.index === viewerStep)?.label || "";
    stepNumEl.textContent = stepWord + " " + (viewerStep + 1) + " / " + total;
    stepTitleEl.textContent = title;
    pillsWrap.querySelectorAll(".chart-viewer-pill").forEach((p) => {
      p.classList.toggle("active", Number(p.dataset.viewerStep) === viewerStep);
    });
    const activePill = pillsWrap.querySelector(".chart-viewer-pill.active");
    if (activePill) activePill.scrollIntoView({ block: "nearest", inline: "center" });
  }

  function goViewerStep(index) {
    const total = nav ? nav.getTotal() : getStepsMeta().length;
    viewerStep = Math.max(0, Math.min(total - 1, index));
    if (nav) nav.goTo(viewerStep);
    else applyChartStep(viewerStep);
    chartRoot.classList.toggle("chart-simplified", !labelsOn);
    updateHeader();
    overlay.querySelector("[data-viewer-nav='prev']").disabled = viewerStep <= 0;
    overlay.querySelector("[data-viewer-nav='next']").disabled = viewerStep >= total - 1;
    fitChartToWrap(chartRoot);
  }

  overlay.querySelector("[data-viewer-nav='prev']").addEventListener("click", () => goViewerStep(viewerStep - 1));
  overlay.querySelector("[data-viewer-nav='next']").addEventListener("click", () => goViewerStep(viewerStep + 1));
  overlay.querySelector("[data-viewer-toggle='labels']").addEventListener("click", () => {
    labelsOn = !labelsOn;
    chartRoot.classList.toggle("chart-simplified", !labelsOn);
    overlay.querySelector("[data-viewer-toggle='labels']").textContent = labelsOn ? "Labels" : "Labels off";
    fitChartToWrap(chartRoot);
  });

  const onKey = (e) => {
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") goViewerStep(viewerStep - 1);
    if (e.key === "ArrowRight") goViewerStep(viewerStep + 1);
  };

  window._chartViewerSync = (index) => {
    if (viewerStep !== index) goViewerStep(index);
  };

  function close() {
    document.removeEventListener("keydown", onKey);
    delete window._chartViewerSync;
    placeholder.replaceWith(chartRoot);
    placeholder.remove();
    chartRoot.classList.remove("chart-in-viewer", "chart-show-all");
    if (inlineBar) inlineBar.hidden = false;
    overlay.remove();
    document.body.classList.remove("chart-viewer-open");
    restoreChartViewBox(chartRoot);
    fitChartToWrap(chartRoot);
  }

  overlay.querySelector("[data-viewer-close]").addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener("keydown", onKey);

  renderPills();
  goViewerStep(startStep);
  bindChartFit(chartRoot);
}

function initAllChartHosts() {
  const hosts = new Set();

  document.querySelectorAll(".lesson-layout .forge-chart, .lesson-layout .chart-stage").forEach((root) => {
    hosts.add(root);
    if (!root.classList.contains("forge-chart") && root.querySelector(".forge-chart")) {
      hosts.add(root.querySelector(".forge-chart"));
    }
  });

  document
    .querySelectorAll(
      ".elite-replay .forge-chart, .elite-replay .tv-frame, .chart-replay-section .forge-chart, .chart-replay-section .tv-frame"
    )
    .forEach((host) => hosts.add(host));

  hosts.forEach((host) => {
    if (!host) return;
    const replayRoot = host.closest(".elite-replay, .chart-replay-section");
    if (replayRoot && replayRoot._forgeReplayNav && !host._forgeChartNav) {
      host._forgeChartNav = replayRoot._forgeReplayNav;
      host._forgeChartMode = "replay";
    }
    initChartHostUI(host);
  });
}

function initLessonCharts() {
  initAllChartHosts();
}

function syncLessonChartLayers(stepIndex) {
  document.querySelectorAll(".lesson-layout [data-lesson-step]").forEach((el) => {
    const s = Number(el.getAttribute("data-lesson-step"));
    el.classList.toggle("anim-hidden", s !== stepIndex);
  });
  document.querySelectorAll(".lesson-layout .forge-chart, .lesson-layout .chart-stage").forEach((root) => {
    root.dataset.activeStep = String(stepIndex);
  });
}

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
    syncLessonChartLayers(current);
    if (typeof ForgeAnnotations !== "undefined" && ForgeAnnotations.setTextStep) {
      ForgeAnnotations.setTextStep(current);
    }
    document.querySelectorAll(".lesson-layout .forge-chart, .lesson-layout .chart-stage, .chart-in-viewer").forEach((root) => {
      fitChartToWrap(root);
    });
    if (typeof window._chartViewerSync === "function") {
      window._chartViewerSync(current);
    }
  }

  window.ForgeLessonNav = {
    getIndex: () => current,
    getTotal: () => steps.length,
    getTitle: (i) => steps[i]?.title || "",
    getStepButtons: () =>
      Array.from(buttons).map((btn) => ({
        index: Number(btn.dataset.step),
        label: (btn.textContent || "").trim().replace(/^\d+\.\s*/, ""),
      })),
    goTo: (index) => goTo(index),
  };

  initLessonCharts();
  if (typeof ForgeAnnotations !== "undefined" && ForgeAnnotations.refresh) {
    ForgeAnnotations.refresh();
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
window.initPractice = initPractice;
window.initChartHostUI = initChartHostUI;
window.initAllChartHosts = initAllChartHosts;
window.initLessonCharts = initLessonCharts;
window.ForgeChartFit = fitChartToWrap;
window.openChartViewer = openChartViewer;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAllChartHosts);
} else {
  initAllChartHosts();
}

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
      setModulePractice(moduleId, done.length, tasks.length);
    }
  });
}

window.initChartExercise = initChartExercise;
