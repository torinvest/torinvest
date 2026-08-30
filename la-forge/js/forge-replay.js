/**
 * La Forge ÉLITE — Replay chart pédagogique
 * Mode exclusif : une frame visible à la fois (pas d’empilement sur le SVG).
 */
function isReplayKeepId(id) {
  return /^(base|base-|bg-|background|chart-base|candles|replay-base|price-axis|grid|axes?)$/i.test(id || "");
}

function isReplayOverlayId(id) {
  return /^(frame|step|layer|overlay|scene|seq|annos?|callouts?|fvg-|ob-|mss-|liq-|zone-step|replay-frame)/i.test(
    id || ""
  );
}

function applyReplayFrames(frames, current) {
  const f = frames[current] || {};
  const keepIds = new Set();
  if (f.groupId) keepIds.add(f.groupId);
  frames.forEach((fr) => {
    if (fr.baseId) keepIds.add(fr.baseId);
  });

  const keepEls = Array.from(keepIds)
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  const svg =
    keepEls[0]?.ownerSVGElement ||
    document.querySelector(".elite-replay svg, .chart-replay-section svg, .replay-chart-svg");
  const frameIds = new Set(frames.map((fr) => fr.groupId).filter(Boolean));

  function isKept(g) {
    if (keepIds.has(g.id) || isReplayKeepId(g.id)) return true;
    return keepEls.some((k) => k.contains(g) || g.contains(k));
  }

  if (svg) {
    svg.querySelectorAll("g[id]").forEach((g) => {
      if (g.closest("defs")) return;
      if (isKept(g)) {
        g.classList.remove("anim-hidden");
        return;
      }
      if (frameIds.has(g.id) || isReplayOverlayId(g.id)) {
        g.classList.add("anim-hidden");
      }
    });
  } else {
    frames.forEach((frame, i) => {
      const group = document.getElementById(frame.groupId);
      if (group) group.classList.toggle("anim-hidden", i !== current);
      if (frame.baseId) {
        const base = document.getElementById(frame.baseId);
        if (base) base.classList.remove("anim-hidden");
      }
    });
  }
}

function notifyReplayStep(index) {
  if (typeof ForgeAnnotations !== "undefined" && ForgeAnnotations.setReplayStep) {
    ForgeAnnotations.setReplayStep(index);
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
  } = config;

  const root = document.querySelector(rootSelector);
  if (!root || !frames || !frames.length) return;

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

    applyReplayFrames(frames, current);
    notifyReplayStep(current);

    const f = frames[current];
    if (titleEl) titleEl.textContent = f.title || f.label || "Étape " + (current + 1);
    if (stepNumEl) stepNumEl.textContent = String(current + 1);
    renderList(seeEl, f.see);
    if (meansEl) meansEl.textContent = f.means || "";
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

  const { frames, counterId = "replay-counter", captionId = "replay-caption", progressId = "replay-progress" } = config;
  if (!frames || !frames.length) return;

  const root =
    document.querySelector(config.rootSelector || ".chart-replay-section, .elite-replay") || document.body;
  const buttons = root.querySelectorAll("[data-replay]");
  const captionEl = document.getElementById(captionId);
  const counterEl = document.getElementById(counterId);
  const progressEl = document.getElementById(progressId);
  let current = 0;
  let navApi = null;

  function goTo(index) {
    current = Math.max(0, Math.min(frames.length - 1, index));
    buttons.forEach((btn) => btn.classList.toggle("active", Number(btn.dataset.replay) === current));
    applyReplayFrames(frames, current);
    notifyReplayStep(current);

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
  document.getElementById("replay-prev")?.addEventListener("click", () => goTo(current - 1));
  document.getElementById("replay-next")?.addEventListener("click", () => goTo(current + 1));
  goTo(0);
}

window.initEliteReplay = initEliteReplay;
window.initChartReplay = initChartReplay;
