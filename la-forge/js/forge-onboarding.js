/**
 * Parcours client La Forge — checklist, rangs, Semaine Forge (étudier / pratiquer / vivre).
 */
(function (global) {
  "use strict";

  var STORAGE_PREFIX = "forge_onboarding_v1:";

  var STEPS = [
    {
      id: "login",
      label: "Connexion OK (email Stripe + clé TOR)",
      href: null,
      auto: true,
    },
    {
      id: "discord",
      label: "Rejoindre le Discord accompagnement",
      href: "https://discord.gg/vwkPp2aeEM",
      external: true,
    },
    {
      id: "module0",
      label: "Ouvrir le Module 0 (socle)",
      href: "/course/index.html",
    },
    {
      id: "journal",
      label: "Ouvrir le Trading Journal une fois",
      href: "/journal.html",
    },
    {
      id: "fondamental",
      label: "Survoler Fondamental (macro)",
      href: "/fondamental.html",
    },
  ];

  var BADGES = [
    {
      id: "apprenti",
      label: "Apprenti",
      hint: "0–2 modules validés",
      minDone: 0,
    },
    {
      id: "forgeron",
      label: "Forgeron",
      hint: "≥ 3 modules (1er lot)",
      minDone: 3,
    },
    {
      id: "elite",
      label: "Élite",
      hint: "≥ 12 modules validés",
      minDone: 12,
    },
  ];

  var WEEK_DUTY_POOL = [
    "Annote 1 FVG + 1 BOS sur un chart H1/M15.",
    "Écris ton biais killzone (London ou NY) avant la séance.",
    "Relis 1 module du lot ouvert et note 3 points clés.",
    "Compare bullish vs bearish sur la même structure (screenshot).",
    "Prépare 1 question précise pour le live / Discord.",
  ];

  function storageKey(email) {
    return (
      STORAGE_PREFIX +
      String(email || "anon")
        .trim()
        .toLowerCase()
    );
  }

  function readState(email) {
    try {
      var raw = localStorage.getItem(storageKey(email));
      if (!raw) return { done: {} };
      var parsed = JSON.parse(raw);
      return {
        done: parsed.done && typeof parsed.done === "object" ? parsed.done : {},
      };
    } catch (_) {
      return { done: {} };
    }
  }

  function writeState(email, state) {
    try {
      localStorage.setItem(
        storageKey(email),
        JSON.stringify({
          done: state.done || {},
          updatedAt: new Date().toISOString(),
        })
      );
    } catch (_) {
      /* ignore quota */
    }
  }

  function markDone(email, stepId) {
    var state = readState(email);
    state.done[String(stepId)] = true;
    writeState(email, state);
    return state;
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getProgress(email) {
    var state = readState(email);
    if (email) state.done.login = true;
    var total = STEPS.length;
    var doneCount = 0;
    var next = null;
    for (var i = 0; i < STEPS.length; i++) {
      if (state.done[STEPS[i].id]) doneCount++;
      else if (!next) next = STEPS[i];
    }
    return {
      done: doneCount,
      total: total,
      pct: total ? Math.round((doneCount / total) * 100) : 0,
      next: next,
      complete: doneCount >= total,
      state: state,
    };
  }

  function isoWeekKey(d) {
    var date = d ? new Date(d) : new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
    var week1 = new Date(date.getFullYear(), 0, 4);
    var week =
      1 +
      Math.round(
        ((date.getTime() - week1.getTime()) / 86400000 -
          3 +
          ((week1.getDay() + 6) % 7)) /
          7
      );
    return date.getFullYear() + "-W" + String(week).padStart(2, "0");
  }

  function weekStorageKey(email) {
    return (
      "forge_week_v1:" +
      String(email || "anon")
        .trim()
        .toLowerCase() +
      ":" +
      isoWeekKey()
    );
  }

  function readWeekState(email) {
    try {
      var raw = localStorage.getItem(weekStorageKey(email));
      if (!raw) return { checks: {} };
      var parsed = JSON.parse(raw);
      return {
        checks: parsed.checks && typeof parsed.checks === "object" ? parsed.checks : {},
      };
    } catch (_) {
      return { checks: {} };
    }
  }

  function writeWeekState(email, state) {
    try {
      localStorage.setItem(
        weekStorageKey(email),
        JSON.stringify({
          checks: state.checks || {},
          week: isoWeekKey(),
          updatedAt: new Date().toISOString(),
        })
      );
    } catch (_) {
      /* ignore */
    }
  }

  function toggleWeekCheck(email, taskId, checked) {
    var state = readWeekState(email);
    if (checked) state.checks[taskId] = true;
    else delete state.checks[taskId];
    writeWeekState(email, state);
    return state;
  }

  function getBadgeRank(modulesDone) {
    var done = Number(modulesDone) || 0;
    var current = BADGES[0];
    for (var i = 0; i < BADGES.length; i++) {
      if (done >= BADGES[i].minDone) current = BADGES[i];
    }
    return {
      current: current,
      badges: BADGES,
      modulesDone: done,
      next:
        BADGES.find(function (b) {
          return b.minDone > done;
        }) || null,
    };
  }

  function getForgeWeek(email, modulesDone) {
    var progress = getProgress(email);
    var weekIdx = parseInt(String(isoWeekKey()).split("-W")[1], 10) || 1;
    var duty = WEEK_DUTY_POOL[(weekIdx - 1) % WEEK_DUTY_POOL.length];
    var checks = readWeekState(email).checks;
    var studyBody = progress.complete
      ? "Avance / valide au moins 1 module du lot ouvert."
      : progress.next
        ? progress.next.label
        : "Ouvre Premiers pas et suis la checklist.";
    var studyHref =
      progress.complete || !progress.next
        ? "/course/index.html"
        : progress.next.href || "/start.html";
    var tasks = [
      {
        id: "study",
        pillar: "Étudier",
        title: "Formation",
        body: studyBody,
        href: studyHref,
        cta: "Ouvrir",
        external: !!(progress.next && progress.next.external && !progress.complete),
        done: !!checks.study,
      },
      {
        id: "practice",
        pillar: "Pratiquer",
        title: "Devoir chart",
        body: duty,
        href: "/journal.html",
        cta: "Journaliser",
        done: !!checks.practice,
      },
      {
        id: "live",
        pillar: "Vivre",
        title: "Live / Discord",
        body: "Pose 1 question concrète sur ton setup (ou viens au live).",
        href: "https://discord.gg/vwkPp2aeEM",
        cta: "Discord",
        external: true,
        done: !!checks.live,
      },
    ];
    var doneCount = tasks.filter(function (t) {
      return t.done;
    }).length;
    return {
      week: isoWeekKey(),
      tasks: tasks,
      done: doneCount,
      total: tasks.length,
      complete: doneCount >= tasks.length,
      rank: getBadgeRank(modulesDone),
    };
  }

  function getWeeklyCards(email) {
    return getForgeWeek(email).tasks.map(function (t) {
      return {
        title: t.pillar + " · " + t.title,
        body: t.body,
        href: t.href,
        cta: t.cta,
        external: !!t.external,
      };
    });
  }

  function renderBadges(root, modulesDone) {
    if (!root) return;
    var rank = getBadgeRank(modulesDone);
    var nextHint = rank.next
      ? "Prochain rang <strong style=\"color:var(--gold)\">" +
        escapeHtml(rank.next.label) +
        "</strong> à " +
        rank.next.minDone +
        " modules."
      : "Rang max atteint — continue le rituel Semaine Forge.";
    root.innerHTML =
      '<div class="forge-rank-card">' +
      '<div class="forge-rank-head">' +
      '<span class="forge-hero-tag">Rangs La Forge</span>' +
      '<p style="margin:0.35rem 0 0;color:var(--muted);font-size:0.88rem;line-height:1.5">' +
      "Tu es <strong style=\"color:var(--gold)\">" +
      escapeHtml(rank.current.label) +
      "</strong> · " +
      rank.modulesDone +
      " modules validés. " +
      nextHint +
      "</p></div>" +
      '<div class="forge-rank-row">' +
      BADGES.map(function (b) {
        var unlocked = rank.modulesDone >= b.minDone;
        var active = rank.current.id === b.id;
        return (
          '<div class="forge-rank-badge' +
          (unlocked ? " is-unlocked" : "") +
          (active ? " is-active" : "") +
          '" title="' +
          escapeHtml(b.hint) +
          '">' +
          '<span class="forge-rank-name">' +
          escapeHtml(b.label) +
          "</span>" +
          '<span class="forge-rank-hint">' +
          escapeHtml(b.hint) +
          "</span></div>"
        );
      }).join("") +
      "</div></div>";
  }

  function renderForgeWeek(root, email, modulesDone) {
    if (!root) return;
    var week = getForgeWeek(email, modulesDone);
    root.innerHTML =
      '<div class="forge-week-card">' +
      '<div class="forge-week-head">' +
      '<span class="forge-hero-tag">Semaine Forge · ' +
      escapeHtml(week.week) +
      "</span>" +
      '<h3 style="margin:0.35rem 0 0;color:var(--gold)">Étudier · Pratiquer · Vivre</h3>' +
      '<p style="margin:0.35rem 0 0;color:var(--muted);font-size:0.88rem">Rituel hebdo — ' +
      week.done +
      " / " +
      week.total +
      " cochés" +
      (week.complete ? " · semaine validée ✓" : "") +
      "</p></div>" +
      '<div class="forge-week-grid">' +
      week.tasks
        .map(function (t) {
          return (
            '<div class="card forge-week-task' +
            (t.done ? " is-done" : "") +
            '" style="margin:0">' +
            '<label class="forge-week-check">' +
            '<input type="checkbox" data-week-task="' +
            escapeHtml(t.id) +
            '" ' +
            (t.done ? "checked " : "") +
            "/>" +
            "<span>" +
            escapeHtml(t.pillar) +
            "</span></label>" +
            '<h3 style="margin:0.45rem 0 0.35rem;font-size:1rem">' +
            escapeHtml(t.title) +
            "</h3>" +
            '<p style="color:var(--muted);font-size:0.88rem;line-height:1.5;margin:0 0 0.75rem">' +
            escapeHtml(t.body) +
            "</p>" +
            '<a class="btn btn-secondary" href="' +
            escapeHtml(t.href) +
            '"' +
            (t.external ? ' target="_blank" rel="noopener"' : "") +
            ' data-week-open="' +
            escapeHtml(t.id) +
            '">' +
            escapeHtml(t.cta) +
            "</a></div>"
          );
        })
        .join("") +
      "</div></div>";

    root.querySelectorAll("[data-week-task]").forEach(function (input) {
      input.addEventListener("change", function () {
        toggleWeekCheck(email, input.getAttribute("data-week-task"), input.checked);
        renderForgeWeek(root, email, modulesDone);
      });
    });
    root.querySelectorAll("[data-week-open]").forEach(function (a) {
      a.addEventListener("click", function () {
        toggleWeekCheck(email, a.getAttribute("data-week-open"), true);
      });
    });
  }

  function renderChecklist(root, email, options) {
    if (!root) return;
    var opts = options || {};
    var progress = getProgress(email);
    var state = progress.state;

    var html =
      '<div style="margin-bottom:0.75rem;color:var(--muted);font-size:0.9rem">' +
      '<strong style="color:var(--gold)">' +
      progress.done +
      " / " +
      progress.total +
      "</strong> étapes · " +
      progress.pct +
      "%</div><ul style=\"list-style:none;padding:0;margin:0\">";

    STEPS.forEach(function (step) {
      var checked = !!state.done[step.id];
      html +=
        '<li style="display:flex;gap:0.65rem;align-items:flex-start;padding:0.55rem 0;border-bottom:1px solid var(--border)">' +
        '<input type="checkbox" data-onboard-step="' +
        escapeHtml(step.id) +
        '" ' +
        (checked ? "checked " : "") +
        (step.auto ? "disabled " : "") +
        'style="margin-top:0.25rem" />' +
        '<div style="flex:1">' +
        '<div style="font-size:0.95rem">' +
        escapeHtml(step.label) +
        "</div>" +
        (step.href
          ? '<a href="' +
            escapeHtml(step.href) +
            '"' +
            (step.external ? ' target="_blank" rel="noopener"' : "") +
            ' data-onboard-open="' +
            escapeHtml(step.id) +
            '" style="font-size:0.85rem;color:var(--gold)">Ouvrir →</a>'
          : "") +
        "</div></li>";
    });
    html += "</ul>";
    root.innerHTML = html;

    root.querySelectorAll("[data-onboard-step]").forEach(function (input) {
      input.addEventListener("change", function () {
        var id = input.getAttribute("data-onboard-step");
        if (input.checked) {
          markDone(email, id);
        } else {
          var st = readState(email);
          delete st.done[id];
          writeState(email, st);
        }
        renderChecklist(root, email, opts);
        if (typeof opts.onChange === "function") opts.onChange(getProgress(email));
      });
    });

    root.querySelectorAll("[data-onboard-open]").forEach(function (a) {
      a.addEventListener("click", function () {
        markDone(email, a.getAttribute("data-onboard-open"));
      });
    });
  }

  function renderNextStep(root, email) {
    if (!root) return;
    var progress = getProgress(email);
    if (progress.complete) {
      root.innerHTML =
        '<div class="card" style="border-color:rgba(255,215,0,.35)">' +
        '<h3 style="margin:0 0 0.35rem;color:var(--gold)">Prochaine étape</h3>' +
        '<p style="margin:0 0 0.85rem;color:var(--muted);font-size:0.92rem;line-height:1.55">' +
        "Démarrage terminé. Enchaîne la Semaine Forge : étudier, journaliser, live." +
        "</p>" +
        '<a class="btn btn-primary" href="/course/index.html">Ouvrir la formation</a>' +
        ' <a class="btn btn-secondary" href="/start.html">Mode d’emploi</a>' +
        "</div>";
      return;
    }
    var next = progress.next;
    root.innerHTML =
      '<div class="card" style="border-color:rgba(255,215,0,.45);background:rgba(255,215,0,.05)">' +
      '<span class="forge-hero-tag">Chemin guidé</span>' +
      '<h3 style="margin:0.35rem 0;color:var(--gold)">Ta prochaine étape</h3>' +
      '<p style="margin:0 0 0.85rem;color:var(--muted);font-size:0.95rem;line-height:1.55">' +
      escapeHtml(next ? next.label : "Ouvre Premiers pas") +
      "</p>" +
      (next && next.href
        ? '<a class="btn btn-primary" id="onboard-next-cta" href="' +
          escapeHtml(next.href) +
          '"' +
          (next.external ? ' target="_blank" rel="noopener"' : "") +
          ">Continuer</a>"
        : '<a class="btn btn-primary" href="/start.html">Premiers pas</a>') +
      ' <a class="btn btn-secondary" href="/start.html">Mode d’emploi</a>' +
      "</div>";
    var cta = document.getElementById("onboard-next-cta");
    if (cta && next) {
      cta.addEventListener("click", function () {
        markDone(email, next.id);
      });
    }
  }

  function renderWeeklyCards(root, email) {
    if (!root) return;
    renderForgeWeek(root, email, 0);
  }

  global.ForgeOnboarding = {
    STEPS: STEPS,
    BADGES: BADGES,
    getProgress: getProgress,
    getWeeklyCards: getWeeklyCards,
    getBadgeRank: getBadgeRank,
    getForgeWeek: getForgeWeek,
    markDone: markDone,
    readState: readState,
    toggleWeekCheck: toggleWeekCheck,
    renderChecklist: renderChecklist,
    renderNextStep: renderNextStep,
    renderWeeklyCards: renderWeeklyCards,
    renderBadges: renderBadges,
    renderForgeWeek: renderForgeWeek,
  };
})(typeof window !== "undefined" ? window : global);
