/**
 * La Forge — annotations chart (replay : une étape = annotations liées, pas cumul).
 */
(function () {
  const charts = [];

  function calloutLabel(g, idx) {
    const t = g.querySelector(".co-t");
    const n = g.querySelector(".co-n");
    return (t && t.textContent.trim()) || (n && n.textContent.trim()) || "Note " + (idx + 1);
  }

  function setCalloutVisible(g, pill, visible, userToggle) {
    if (userToggle) g.dataset.annoUser = visible ? "on" : "off";
    g.classList.toggle("anno-off", !visible);
    g.setAttribute("aria-pressed", visible ? "true" : "false");
    if (pill) pill.classList.toggle("active", visible);
  }

  function applyStepFilter(chart, stepIndex) {
    const exclusive = chart.filterMode === "exclusive";
    chart.callouts.forEach((entry) => {
      const fromRaw = entry.g.dataset.annoFrom;
      const userOff = entry.g.dataset.annoUser === "off";
      let stepOk = false;

      if (fromRaw !== undefined && fromRaw !== "") {
        const from = Number(fromRaw);
        stepOk = exclusive ? from === stepIndex : stepIndex >= from;
      }

      entry.g.classList.toggle("anno-step-hidden", !stepOk);
      if (!stepOk) return;
      if (userOff) {
        entry.g.classList.add("anno-off");
        if (entry.pill) entry.pill.classList.remove("active");
      } else {
        entry.g.classList.remove("anno-off");
        if (entry.pill) entry.pill.classList.add("active");
      }
    });
  }

  function initForgeChartAnnotations(chartEl) {
    if (!chartEl || chartEl.dataset.annoInit === "1") return null;
    const svg = chartEl.querySelector("svg");
    if (!svg) return null;
    const calloutNodes = svg.querySelectorAll(".fc-callout");
    if (!calloutNodes.length) return null;

    chartEl.dataset.annoInit = "1";
    const inReplay = chartEl.closest(".elite-replay, .chart-replay-section");

    const toolbar = document.createElement("div");
    toolbar.className = "anno-toolbar";
    toolbar.innerHTML =
      '<div class="anno-toolbar-top">' +
      '<span class="anno-hint">Pastilles <strong>①</strong> : une étape du replay = une couche lisible. Cliquez pour masquer / réafficher.</span>' +
      '<div class="anno-actions">' +
      '<button type="button" class="anno-btn" data-act="show">Tout afficher (étape)</button>' +
      '<button type="button" class="anno-btn" data-act="hide">Tout masquer</button>' +
      "</div></div>" +
      '<div class="anno-pills"></div>';

    const pillsWrap = toolbar.querySelector(".anno-pills");
    const entries = [];

    calloutNodes.forEach((g, idx) => {
      if (!g.dataset.annoFrom) {
        g.dataset.annoFrom = String(idx);
      }
      const label = calloutLabel(g, idx);
      g.classList.add("anno-interactive");
      g.setAttribute("role", "button");
      g.setAttribute("tabindex", "0");
      g.setAttribute("aria-label", "Annotation : " + label + " — cliquer pour masquer ou afficher");
      g.setAttribute("aria-pressed", "true");

      const pill = document.createElement("button");
      pill.type = "button";
      pill.className = "anno-pill active";
      pill.textContent = label;
      pill.title = "Masquer / afficher : " + label;

      function toggle(forceVisible) {
        const next = forceVisible !== undefined ? forceVisible : g.classList.contains("anno-off");
        setCalloutVisible(g, pill, next, true);
      }

      g.addEventListener("click", (e) => {
        e.stopPropagation();
        toggle();
      });
      g.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      });
      pill.addEventListener("click", () => toggle());

      pillsWrap.appendChild(pill);
      entries.push({ g, pill, toggle });
    });

    toolbar.querySelector('[data-act="show"]').addEventListener("click", () => {
      entries.forEach((e) => {
        if (e.g.classList.contains("anno-step-hidden")) return;
        e.g.dataset.annoUser = "on";
        setCalloutVisible(e.g, e.pill, true, false);
      });
    });
    toolbar.querySelector('[data-act="hide"]').addEventListener("click", () => {
      entries.forEach((e) => {
        e.g.dataset.annoUser = "off";
        setCalloutVisible(e.g, e.pill, false, true);
      });
    });

    const anchor = chartEl.querySelector(".chart-legend-panel") || chartEl.querySelector(".chart-caption");
    if (anchor) anchor.insertAdjacentElement("afterend", toolbar);
    else svg.insertAdjacentElement("afterend", toolbar);

    const chart = {
      el: chartEl,
      callouts: entries,
      stepIndex: 0,
      filterMode: inReplay ? "exclusive" : "exclusive",
    };
    charts.push(chart);
    applyStepFilter(chart, 0);
    return chart;
  }

  function initAllForgeCharts() {
    document.querySelectorAll(".forge-chart, .chart-replay-section .tv-frame, .chart-replay-section .forge-chart").forEach(initForgeChartAnnotations);
  }

  function setReplayStep(stepIndex) {
    charts.forEach((chart) => {
      if (!chart.el.closest(".elite-replay, .chart-replay-section")) return;
      chart.stepIndex = stepIndex;
      applyStepFilter(chart, stepIndex);
    });
  }

  function setTextStep(stepIndex) {
    charts.forEach((chart) => {
      if (chart.el.closest(".elite-replay, .chart-replay-section")) return;
      if (!chart.el.closest(".lesson-layout, .lesson-pro")) return;
      chart.stepIndex = stepIndex;
      applyStepFilter(chart, stepIndex);
    });
  }

  function boot() {
    initAllForgeCharts();
  }

  window.initForgeChartAnnotations = initForgeChartAnnotations;
  window.ForgeAnnotations = {
    setReplayStep,
    setTextStep,
    setLessonStep: setTextStep,
    initAll: boot,
    refresh: boot,
  };

  boot();
  document.addEventListener("DOMContentLoaded", boot);
})();
