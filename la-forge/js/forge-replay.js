/**
 * La Forge ÉLITE — Replay chart pédagogique
 * Objectif : séquences lisibles, texte explicatif toujours présent, focus sur l'étape courante.
 * Modes :
 * - cumulative (défaut) : étapes 0…N visibles — schéma qui se construit
 * - exclusive : une seule frame overlay + base
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
    try {
      if (scope.querySelector("#" + CSS.escape(id))) return id;
    } catch (_) {
      if (scope.querySelector("#" + id)) return id;
    }
  }
  return null;
}

function getReplayMode(root, config) {
  const fromConfig = config && config.replayMode;
  const fromRoot = root && root.dataset ? root.dataset.replayMode : "";
  const mode = (fromConfig || fromRoot || "cumulative").toLowerCase();
  return mode === "exclusive" ? "exclusive" : "cumulative";
}

function extractCalloutTexts(container) {
  if (!container) return [];
  const texts = [];
  container.querySelectorAll(".fc-callout").forEach((g) => {
    const t = g.querySelector(".co-t");
    const n = g.querySelector(".co-n");
    const label = (t && t.textContent.trim()) || (n && "Point " + n.textContent.trim()) || "";
    if (label) texts.push(label);
  });
  container.querySelectorAll(".replay-label-big, text.replay-label-big").forEach((el) => {
    const t = (el.textContent || "").trim();
    if (t) texts.push(t);
  });
  return texts;
}

function defaultMeansForStep(index, total, title) {
  const t = title || "cette étape";
  if (index === 0) {
    return "On pose le contexte du chart : repérez la structure et les niveaux avant toute décision.";
  }
  if (index === total - 1) {
    return "Synthèse : reliez " + t + " au plan de trade (entrée, invalidation, objectif).";
  }
  return (
    "Étape " +
    (index + 1) +
    " : intégrez " +
    t +
    " au fil de la lecture — les étapes précédentes restent visibles en grisé."
  );
}

function enrichFrames(frames, root) {
  const svg = root.querySelector("svg");
  const total = frames.length;
  return frames.map((fr, i) => {
    const out = { ...fr };
    const gid = resolveFrameGroupId(out, i, root) || out.groupId;
    if (gid) out.groupId = gid;
    const group = gid ? document.getElementById(gid) : null;
    const label =
      out.title ||
      out.label ||
      (root.querySelector("[data-replay=\"" + i + "\"]")?.textContent || "").trim().replace(/^\d+\.\s*/, "") ||
      "Étape " + (i + 1);
    out.title = label;
    if (!out.label) out.label = label;
    if (!out.see || !out.see.length) {
      const fromGroup = group ? extractCalloutTexts(group) : [];
      const fromSvg = svg ? extractCalloutTexts(svg) : [];
      out.see = fromGroup.length ? fromGroup : fromSvg.slice(0, 4);
    }
    if (!out.means && !out.meaning) {
      out.means = defaultMeansForStep(i, total, label);
    }
    if (!out.warn && !out.attention) {
      out.warn =
        i === 0
          ? "Ne cherchez pas un signal tout seul sur cette première vue — construisez la lecture."
          : "Le surlignage doré attire l'œil sur la nouveauté de l'étape — ce n'est pas un signal d'achat.";
    }
    if (!out.caption) {
      out.caption = out.means;
    }
    return out;
  });
}

function framesFromReplayButtons(root) {
  const buttons = root.querySelectorAll("[data-replay]");
  if (!buttons.length) return null;
  const frames = [];
  buttons.forEach((btn) => {
    const idx = Number(btn.dataset.replay);
    if (!Number.isFinite(idx)) return;
    frames[idx] = frames[idx] || {
      label: (btn.textContent || "").trim(),
      title: (btn.textContent || "").trim().replace(/^\d+\.\s*/, ""),
    };
  });
  return frames.filter(Boolean);
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

  const allFrameIds = new Set(resolved.map((fr) => fr.groupId).filter(Boolean));

  resolved.forEach((fr, i) => {
    if (!fr.groupId) return;
    const g = document.getElementById(fr.groupId);
    if (!g) return;
    g.classList.remove("replay-focus", "replay-context", "replay-future");
    const show = exclusive ? i === current : i <= current;
    g.classList.toggle("anim-hidden", !show);
    if (!show) {
      g.classList.add("replay-future");
      return;
    }
    if (exclusive || i === current) g.classList.add("replay-focus");
    else g.classList.add("replay-context");
  });

  function isInsideVisibleFrame(el) {
    for (let i = 0; i < resolved.length; i++) {
      const fr = resolved[i];
      const show = exclusive ? i === current : i <= current;
      if (!show || !fr.groupId) continue;
      const fg = document.getElementById(fr.groupId);
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
      el.classList.toggle("replay-focus", show && step === current);
      el.classList.toggle("replay-context", show && step < current);
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

  if (root) {
    root.querySelectorAll(".replay-focus-ring").forEach((el) => el.remove());
    const focusGroup =
      resolved[current] && resolved[current].groupId ? document.getElementById(resolved[current].groupId) : null;
    if (focusGroup && svg && !focusGroup.classList.contains("anim-hidden")) {
      try {
        const bb = focusGroup.getBBox();
        if (bb.width > 4 && bb.height > 4) {
          const pad = Math.max(8, Math.min(bb.width, bb.height) * 0.08);
          const ring = document.createElementNS("http://www.w3.org/2000/svg", "rect");
          ring.setAttribute("class", "replay-focus-ring");
          ring.setAttribute("x", String(bb.x - pad));
          ring.setAttribute("y", String(bb.y - pad));
          ring.setAttribute("width", String(bb.width + pad * 2));
          ring.setAttribute("height", String(bb.height + pad * 2));
          ring.setAttribute("rx", "6");
          svg.appendChild(ring);
        }
      } catch (_) {}
    }
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

function ensurePedagogyChrome(root, frames) {
  root.classList.add("replay-pedagogy-mode");

  if (!root.querySelector(".replay-story-bar")) {
    const bar = document.createElement("div");
    bar.className = "replay-story-bar";
    bar.innerHTML =
      '<div class="replay-story-badge">Lecture guidée</div>' +
      '<p class="replay-story-text" id="replay-story-text"></p>' +
      '<p class="replay-story-hint">Utilisez ← → ou les pastilles · surlignage doré = nouveauté de l\'étape</p>';
    const layout = root.querySelector(".elite-replay-layout");
    if (layout) {
      layout.insertBefore(bar, layout.firstChild);
    } else {
      root.insertBefore(bar, root.firstChild);
    }
  }

  if (!root.querySelector(".replay-progress-track")) {
    const track = document.createElement("div");
    track.className = "replay-progress-track";
    track.innerHTML = '<div class="replay-progress-fill" id="replay-progress-pedagogy"></div>';
    const story = root.querySelector(".replay-story-bar");
    if (story) story.appendChild(track);
  }

  if (!root.querySelector("#replay-prev") && !root.querySelector(".replay-controls")) {
    const nav = document.createElement("div");
    nav.className = "replay-controls replay-controls-pedagogy";
    nav.innerHTML =
      '<button type="button" id="replay-prev" class="replay-nav-btn">← Étape précédente</button>' +
      '<span id="replay-counter" class="replay-counter-pedagogy"></span>' +
      '<button type="button" id="replay-next" class="replay-nav-btn replay-nav-btn-primary">Étape suivante →</button>';
    const layout = root.querySelector(".elite-replay-layout");
    if (layout) layout.appendChild(nav);
    else root.appendChild(nav);
  }
}

function bindReplayNav(root, frames, goTo) {
  const navApi = {
    getIndex: () => navApi._index,
    getTotal: () => frames.length,
    getTitle: (i) => frames[i]?.title || frames[i]?.label || "Étape " + (i + 1),
    getStepButtons: () =>
      navApi._buttons.map((btn) => ({
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
    chartHost.classList.add("chart-replay-full");
    chartHost.classList.remove("chart-simplified");
    if (typeof window.initChartHostUI === "function") {
      window.initChartHostUI(chartHost);
    }
  }
  return navApi;
}

function initEliteReplay(config) {
  const {
    frames: configFrames,
    rootSelector = ".elite-replay",
    counterId = "replay-counter",
    captionId = "replay-caption",
    progressId = "replay-progress",
    guideTitleId = "replay-guide-title",
    guideSeeId = "replay-see-list",
    guideMeansId = "replay-guide-means",
    guideWarnId = "replay-guide-warn",
    replayMode,
  } = config || {};

  const root = document.querySelector(rootSelector);
  if (!root) return;

  let frames = configFrames && configFrames.length ? configFrames.slice() : framesFromReplayButtons(root);
  if (!frames || !frames.length) return;

  const mode = getReplayMode(root, { replayMode });
  root.dataset.replayMode = mode;
  frames = enrichFrames(frames, root);
  ensurePedagogyChrome(root, frames);

  let narrative = root.querySelector(".elite-replay-guide");
  if (!narrative) {
    const layout = root.querySelector(".elite-replay-layout");
    if (layout) {
      narrative = document.createElement("aside");
      narrative.className = "elite-replay-guide";
      narrative.innerHTML =
        '<div class="erg-step">Étape <span id="erg-step-num">1</span> / ' +
        frames.length +
        "</div>" +
        '<h3 id="' +
        guideTitleId +
        '"></h3>' +
        '<div class="erg-block erg-see"><h4>Sur le chart (lisible)</h4><ul id="' +
        guideSeeId +
        '"></ul></div>' +
        '<div class="erg-block erg-means"><h4>En langage clair</h4><p id="' +
        guideMeansId +
        '"></p></div>' +
        '<div class="erg-block erg-warn"><h4>Erreur fréquente</h4><p id="' +
        guideWarnId +
        '"></p></div>';
      layout.appendChild(narrative);
    }
  }

  const buttons = root.querySelectorAll("[data-replay]");
  const captionEl = document.getElementById(captionId) || root.querySelector(".replay-caption-inline");
  const counterEl = document.getElementById(counterId);
  const progressEl = document.getElementById(progressId) || document.getElementById("replay-progress-pedagogy");
  const titleEl = document.getElementById(guideTitleId);
  const seeEl = document.getElementById(guideSeeId);
  const meansEl = document.getElementById(guideMeansId);
  const warnEl = document.getElementById(guideWarnId);
  const storyEl = root.querySelector("#replay-story-text") || document.getElementById("replay-story-text");
  const stepNumEl = root.querySelector("#erg-step-num");
  let current = 0;
  let navApi = null;

  function renderList(el, items) {
    if (!el) return;
    if (!items || !items.length) {
      el.innerHTML =
        "<li>Regardez les éléments <strong>surlignés en doré</strong> sur le chart — c'est la nouveauté de cette étape.</li>";
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
    const storyText = (f.means || f.meaning || f.caption || f.title || "").trim();
    if (titleEl) titleEl.textContent = f.title || f.label || "Étape " + (current + 1);
    if (storyEl) storyEl.textContent = storyText;
    if (stepNumEl) stepNumEl.textContent = String(current + 1);
    renderList(seeEl, f.see);
    if (meansEl) meansEl.textContent = f.means || f.meaning || storyText;
    if (warnEl) warnEl.textContent = f.warn || f.attention || "—";
    if (captionEl) captionEl.textContent = f.caption || storyText;
    if (counterEl) {
      counterEl.textContent = "Étape " + (current + 1) + " / " + frames.length;
    }
    if (progressEl) progressEl.style.width = ((current + 1) / frames.length) * 100 + "%";

    root.querySelectorAll(".elite-frame-tag").forEach((tag, i) => {
      tag.classList.toggle("active", i === current);
    });

    const prevBtn = root.querySelector("#replay-prev");
    const nextBtn = root.querySelector("#replay-next");
    if (prevBtn) prevBtn.disabled = current <= 0;
    if (nextBtn) nextBtn.disabled = current >= frames.length - 1;

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

  root.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") goTo(current - 1);
    if (e.key === "ArrowRight") goTo(current + 1);
  });

  goTo(0);
}

function initEliteReplayForRoot(root, config) {
  if (!root) return;
  if (!root.id) {
    root.id = "forge-replay-" + Math.random().toString(36).slice(2, 9);
  }
  return initEliteReplay({ ...(config || {}), rootSelector: "#" + root.id });
}

function initChartReplay(config) {
  const cfg = config || {};
  let root = null;
  if (cfg.rootSelector) {
    root = document.querySelector(cfg.rootSelector);
  }
  if (!root) {
    root = document.querySelector(".chart-replay-section.elite-replay, .elite-replay, .chart-replay-section");
  }
  if (!root) return;
  return initEliteReplayForRoot(root, cfg);
}

function bootAllReplays() {
  document.querySelectorAll(".elite-replay, .chart-replay-section.elite-replay").forEach((root) => {
    if (root.dataset.replayBooted === "1" || root._forgeReplayNav) return;
    const frames = framesFromReplayButtons(root);
    if (!frames || !frames.length) return;
    root.dataset.replayBooted = "1";
    initEliteReplayForRoot(root, { frames });
  });
}

window.initEliteReplay = initEliteReplay;
window.initChartReplay = initChartReplay;
window.applyReplayFrames = applyReplayFrames;
window.bootAllReplays = bootAllReplays;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => setTimeout(bootAllReplays, 50));
} else {
  setTimeout(bootAllReplays, 50);
}
