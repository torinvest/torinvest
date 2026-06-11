/**
 * La Forge ÉLITE — Replay chart pédagogique
 * Chart minimal + panneau explicatif (ce que vous voyez / signification / attention)
 */
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

  function renderList(el, items) {
    if (!el) return;
    if (!items || !items.length) {
      el.innerHTML = "<li>Aucun élément sur cette frame — lisez le chart.</li>";
      return;
    }
    el.innerHTML = items.map((t) => "<li>" + t + "</li>").join("");
  }

  function goTo(index) {
    current = Math.max(0, Math.min(frames.length - 1, index));
    buttons.forEach((btn) => {
      btn.classList.toggle("active", Number(btn.dataset.replay) === current);
    });

    frames.forEach((frame, i) => {
      const group = document.getElementById(frame.groupId);
      if (group) group.classList.toggle("anim-hidden", i > current);
      if (frame.baseId) {
        const base = document.getElementById(frame.baseId);
        if (base) base.classList.remove("anim-hidden");
      }
    });

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
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => goTo(Number(btn.dataset.replay)));
  });
  root.querySelector("#replay-prev")?.addEventListener("click", () => goTo(current - 1));
  root.querySelector("#replay-next")?.addEventListener("click", () => goTo(current + 1));

  goTo(0);
}

/** @deprecated — utilise initEliteReplay si config enrichie */
function initChartReplay(config) {
  if (config.frames && config.frames[0] && (config.frames[0].see || config.frames[0].means)) {
    return initEliteReplay({ ...config, rootSelector: config.rootSelector || ".chart-replay-section.elite-replay, .elite-replay" });
  }
  const { frames, counterId = "replay-counter", captionId = "replay-caption", progressId = "replay-progress" } = config;
  if (!frames || !frames.length) return;
  const buttons = document.querySelectorAll("[data-replay]");
  const captionEl = document.getElementById(captionId);
  const counterEl = document.getElementById(counterId);
  const progressEl = document.getElementById(progressId);
  let current = 0;
  function goTo(index) {
    current = Math.max(0, Math.min(frames.length - 1, index));
    buttons.forEach((btn) => btn.classList.toggle("active", Number(btn.dataset.replay) === current));
    frames.forEach((frame, i) => {
      const group = document.getElementById(frame.groupId);
      if (group) group.classList.toggle("anim-hidden", i > current);
    });
    const f = frames[current];
    if (captionEl) captionEl.textContent = f.caption || "";
    if (counterEl) counterEl.textContent = "Frame " + (current + 1) + " / " + frames.length;
    if (progressEl) progressEl.style.width = ((current + 1) / frames.length) * 100 + "%";
  }
  buttons.forEach((btn) => btn.addEventListener("click", () => goTo(Number(btn.dataset.replay))));
  document.getElementById("replay-prev")?.addEventListener("click", () => goTo(current - 1));
  document.getElementById("replay-next")?.addEventListener("click", () => goTo(current + 1));
  goTo(0);
}

window.initEliteReplay = initEliteReplay;
window.initChartReplay = initChartReplay;
