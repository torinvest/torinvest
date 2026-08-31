/**
 * La Forge ÉLITE — Replay chart pédagogique
 * Modes :
 * - cumulative (défaut) : étapes 0…N visibles — calques additifs (schéma qui se construit)
 * - exclusive : une seule frame overlay + base (scènes indépendantes)
 */
function isReplayKeepId(id) {
  return /^(base|base-|bg-|background|chart-base|candles?|replay-base|price-axis|grid|axes?|volume|time-axis|wick)/i.test(
    id || ""
  );
}

function isReplayOverlayId(id) {
  return /^(frame|step|layer|overlay|scene|seq|annos?|callouts?|fvg|ob-|mss|bos|liq|zone|pool|arrow|label|highlight|dr-|replay-frame)/i.test(
    id || ""
  );
}

function resolveFrameGroupId(frame, index, root) {
  if (frame && frame.groupId) return frame.groupId;
  const candidates = [
    "replay-frame-" + index,
    "replay_frame_" + index,
    "frame-" + index,
    "frame_" + index,
    "step-" + index,
    "step_" + index,
    "layer-" + index,
    "layer_" + index,
    "seq-" + index,
    "scene-" + index,
  ];
  const scope = root || document;
  for (let i = 0; i < candidates.length; i++) {
    const id = candidates[i];
    if (scope.querySelector("#" + CSS.escape(id))) return id;
  }
  return null;
}

function getReplayMode(root, config) {
  const fromConfig = config && config.replayMode;
  const fromRoot = root && root.dataset ? root.dataset.replayMode : "";
  const mode = (fromConfig || fromRoot || "cumulative").toLowerCase();
  return mode === "exclusive" ? "exclusive" : "cumulative";
}

function applyReplayFrames(frames, current, options) {
  const opts = options || {};
  const mode = opts.mode === "exclusive" ? "exclusive" : "cumulative";
  const exclusive = mode === "exclusive";
  const root = opts.root || null;

  const resolved = frames.map((fr, i) => ({
    ...fr,
    groupId: resolveFrameGroupId(fr, i, root) || fr.groupId || null,
  }));

  const keepIds = new Set();
  resolved.forEach((fr, i) => {
    if (fr.baseId) keepIds.add(fr.baseId);
    const show = exclusive ? i === current : i <= current;
    if (show && fr.groupId) keepIds.add(fr.groupId);
  });

  const keepEls = Array.from(keepIds)
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  const svg =
    keepEls[0]?.ownerSVGElement ||
    (root && root.querySelector("svg")) ||
    document.querySelector(".elite-replay svg, .chart-replay-section svg, .replay-chart-svg");

  const visibleFrameIds = new Set();
  resolved.forEach((fr, i) => {
    if (!fr.groupId) return;
    const show = exclusive ? i === current : i <= current;
    const g = document.getElementById(fr.groupId);
    if (g) {
      g.classList.toggle("anim-hidden", !show);
      if (show) visibleFrameIds.add(fr.groupId);
    }
  });

  const allFrameIds = new Set(resolved.map((fr) => fr.groupId).filter(Boolean));

  function isInsideVisibleFrame(el) {
    for (const id of visibleFrameIds) {
      const fg = document.getElementById(id);
      if (fg && (fg === el || fg.contains(el))) return true;
    }
    return false;
  }

  function isKept(g) {
    if (keepIds.has(g.id) || isReplayKeepId(g.id)) return true;
    if (isInsideVisibleFrame(g)) return true;
    return keepEls.some((k) => k.contains(g));
  }

  if (svg) {
    svg.querySelectorAll("g[id]").forEach((g) => {
      if (g.closest("defs")) return;
      if (allFrameIds.has(g.id)) return;
      if (isKept(g)) {
        g.classList.remove("anim-hidden");
        return;
      }
      if (isReplayOverlayId(g.id)) {
        g.classList.add("anim-hidden");
      }
    });

    svg.querySelectorAll("[data-replay-step]").forEach((el) => {
      const step = Number(el.getAttribute("data-replay-step"));
      if (!Number.isFinite(step)) return;
      const show = exclusive ? step === current : step <= current;
      el.classList.toggle("anim-hidden", !show);
    });
  } else {
    resolved.forEach((fr, i) => {
      const show = exclusive ? i === current : i <= current;
      if (!fr.groupId) return;
      const group = document.getElementById(fr.groupId);
      if (group) group.classList.toggle("anim-hidden", !show);
      if (fr.baseId) {
        const base = document.getElementById(fr.baseId);
        if (base) base.classList.remove("anim-hidden");
      }
    });
  }
}

function notifyReplayStep(index, mode) {
  if (typeof ForgeAnnotations !== "undefined" && ForgeAnnotations.setReplayStep) {
    ForgeAnnotations.setReplayStep(index, mode);
  }
}

function fitReplayCharts(root) {
  if (typeof window.ForgeChartFit !== "function") return;
  root.querySelectorAll(".forge-chart, .tv-frame").forEach((host) => window.ForgeChartFit(host));
}

function bindReplayNav(root, frames, goTo) {
  const navApi = {
    getIndex: () => navApi._index,
    getTotal: () => frames.length,
    getTitle: (i) => frames[i]?.title || frames[i]?.label || "Étape " + (i + 1),
    getStepButtons: () => navApi._buttons.map((btn) => ({
      index: Number(btn.dataset.replay),
      label: (btn.textContent || "").trim().replace(/^\d+\.\s*/, ""),
    })),
    goTo: (index) => goTo(index),
    _index: 0,
    _buttons: [],
  };

  root._forgeReplayNav = navApi;
  const chartHost = root.querySelector(".forge-chart, .tv-frame");
  if (chartHost) {
    chartHost._forgeChartNav = navApi;
    chartHost._forgeChartMode = "replay";
    if (typeof window.initChartHostUI === "function") {
      window.initChartHostUI(chartHost);
    }
  }
  return navApi;
}

function initEliteReplay(config) {
  const {
    frames,
    rootSelector = ".elite-replay",
    counterId = "replay-counter",
    captionId = "replay-caption",
    progressId = "replay-progress",
    guideTitleId = "replay-guide-title",
    guideSeeId = "replay-see-list",
    guideMeansId = "replay-guide-means",
    guideWarnId = "replay-guide-warn",
    replayMode,
  } = config;

  const root = document.querySelector(rootSelector);
  if (!root || !frames || !frames.length) return;

  const mode = getReplayMode(root, { replayMode });
  root.dataset.replayMode = mode;

  let narrative = root.querySelector(".elite-replay-guide");
  if (!narrative) {
    const layout = root.querySelector(".elite-replay-layout");
    if (layout) {
      narrative = document.createElement("aside");
      narrative.className = "elite-replay-guide";
      narrative.innerHTML =
        '<div class="erg-step">Étape <span id="erg-step-num">1</span> / ' + frames.length + "</div>" +
        '<h3 id="' + guideTitleId + '"></h3>' +
        '<div class="erg-block erg-see"><h4>Ce que vous voyez</h4><ul id="' + guideSeeId + '"></ul></div>' +
        '<div class="erg-block erg-means"><h4>Ce que ça signifie</h4><p id="' + guideMeansId + '"></p></div>' +
        '<div class="erg-block erg-warn"><h4>Attention</h4><p id="' + guideWarnId + '"></p></div>';
      layout.appendChild(narrative);
    }
  }

  const buttons = root.querySelectorAll("[data-replay]");
  const captionEl = document.getElementById(captionId) || root.querySelector(".replay-caption-inline");
  const counterEl = document.getElementById(counterId);
  const progressEl = document.getElementById(progressId);
  const titleEl = document.getElementById(guideTitleId);
  const seeEl = document.getElementById(guideSeeId);
  const meansEl = document.getElementById(guideMeansId);
  const warnEl = document.getElementById(guideWarnId);
  const stepNumEl = root.querySelector("#erg-step-num");
  let current = 0;
  let navApi = null;

  function renderList(el, items) {
    if (!el) return;
    if (!items || !items.length) {
      el.innerHTML = "<li>Une seule couche visible — lisez le chart et le panneau à droite.</li>";
      return;
    }
    el.innerHTML = items.map((t) => "<li>" + t + "</li>").join("");
  }

  function goTo(index) {
    current = Math.max(0, Math.min(frames.length - 1, index));
    buttons.forEach((btn) => {
      btn.classList.toggle("active", Number(btn.dataset.replay) === current);
    });

    applyReplayFrames(frames, current, { mode, root });
    notifyReplayStep(current, mode);

    const f = frames[current];
    if (titleEl) titleEl.textContent = f.title || f.label || "Étape " + (current + 1);
    if (stepNumEl) stepNumEl.textContent = String(current + 1);
    renderList(seeEl, f.see);
    if (meansEl) meansEl.textContent = f.means || f.meaning || "";
    if (warnEl) warnEl.textContent = f.warn || f.attention || "—";
    if (captionEl) captionEl.textContent = f.caption || "";
    if (counterEl) {
      counterEl.textContent = "Étape " + (current + 1) + " / " + frames.length + (f.label ? " · " + f.label : "");
    }
    if (progressEl) progressEl.style.width = ((current + 1) / frames.length) * 100 + "%";

    root.querySelectorAll(".elite-frame-tag").forEach((tag, i) => {
      tag.classList.toggle("active", i === current);
    });

    if (navApi) navApi._index = current;
    if (typeof window._chartViewerSync === "function") {
      window._chartViewerSync(current);
    }
    fitReplayCharts(root);
  }

  navApi = bindReplayNav(root, frames, goTo);
  navApi._buttons = Array.from(buttons);

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => goTo(Number(btn.dataset.replay)));
  });
  root.querySelector("#replay-prev")?.addEventListener("click", () => goTo(current - 1));
  root.querySelector("#replay-next")?.addEventListener("click", () => goTo(current + 1));

  goTo(0);
}

function initChartReplay(config) {
  if (config.frames && config.frames[0] && (config.frames[0].see || config.frames[0].means)) {
    return initEliteReplay({
      ...config,
      rootSelector: config.rootSelector || ".chart-replay-section.elite-replay, .elite-replay",
    });
  }

  const {
    frames,
    counterId = "replay-counter",
    captionId = "replay-caption",
    progressId = "replay-progress",
    replayMode,
  } = config;
  if (!frames || !frames.length) return;

  const root =
    document.querySelector(config.rootSelector || ".chart-replay-section, .elite-replay") || document.body;
  const mode = getReplayMode(root, { replayMode });
  root.dataset.replayMode = mode;

  const buttons = root.querySelectorAll("[data-replay]");
  const captionEl = document.getElementById(captionId);
  const counterEl = document.getElementById(counterId);
  const progressEl = document.getElementById(progressId);
  let current = 0;
  let navApi = null;

  function goTo(index) {
    current = Math.max(0, Math.min(frames.length - 1, index));
    buttons.forEach((btn) => btn.classList.toggle("active", Number(btn.dataset.replay) === current));
    applyReplayFrames(frames, current, { mode, root });
    notifyReplayStep(current, mode);

    const f = frames[current];
    if (captionEl) captionEl.textContent = f.caption || "";
    if (counterEl) counterEl.textContent = "Frame " + (current + 1) + " / " + frames.length;
    if (progressEl) progressEl.style.width = ((current + 1) / frames.length) * 100 + "%";

    if (navApi) navApi._index = current;
    if (typeof window._chartViewerSync === "function") {
      window._chartViewerSync(current);
    }
    fitReplayCharts(root);
  }

  navApi = bindReplayNav(root, frames, goTo);
  navApi._buttons = Array.from(buttons);

  buttons.forEach((btn) => btn.addEventListener("click", () => goTo(Number(btn.dataset.replay))));
  root.querySelector("#replay-prev")?.addEventListener("click", () => goTo(current - 1));
  root.querySelector("#replay-next")?.addEventListener("click", () => goTo(current + 1));
  goTo(0);
}

window.initEliteReplay = initEliteReplay;
window.initChartReplay = initChartReplay;
window.applyReplayFrames = applyReplayFrames;
