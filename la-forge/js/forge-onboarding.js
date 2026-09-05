/**
 * Parcours client La Forge — checklist démarrage + prochaine étape + cartes semaine.
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

  function getWeeklyCards(email) {
    var progress = getProgress(email);
    if (!progress.complete) {
      return [
        {
          title: "À démarrer",
          body: progress.next
            ? progress.next.label
            : "Ouvre Premiers pas et suis la checklist.",
          href: progress.next && progress.next.href ? progress.next.href : "/start.html",
          cta: "Continuer",
          external: !!(progress.next && progress.next.external),
        },
        {
          title: "À pratiquer",
          body: "Note 3 lignes dans le Journal : ce que tu as compris aujourd’hui.",
          href: "/journal.html",
          cta: "Journal",
        },
        {
          title: "À vivre",
          body: "Rejoins le Discord / le prochain live chart.",
          href: "https://discord.gg/vwkPp2aeEM",
          cta: "Discord",
          external: true,
        },
      ];
    }
    return [
      {
        title: "À étudier",
        body: "Avance ton lot de modules en cours (formation guidée).",
        href: "/course/index.html",
        cta: "Formation",
      },
      {
        title: "À pratiquer",
        body: "Journalise 1 idée de trade ou 1 erreur de la semaine.",
        href: "/journal.html",
        cta: "Journal",
      },
      {
        title: "À vivre",
        body: "Live + Discord : pose 1 question concrète sur ton setup.",
        href: "https://www.torinvest-trading.com/la-forge/#live",
        cta: "Live",
        external: true,
      },
    ];
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
        "<div style=\"flex:1\">" +
        "<div style=\"font-size:0.95rem\">" +
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
        "Démarrage terminé. Continue ton lot de formation, journalise, et viens au live." +
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
    var cards = getWeeklyCards(email);
    root.innerHTML =
      '<h3 style="margin:0 0 0.75rem">Cette semaine</h3>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0.75rem">' +
      cards
        .map(function (c) {
          return (
            '<div class="card" style="margin:0">' +
            '<h3 style="margin:0 0 0.35rem;font-size:1rem">' +
            escapeHtml(c.title) +
            "</h3>" +
            '<p style="color:var(--muted);font-size:0.88rem;line-height:1.5;margin:0 0 0.75rem">' +
            escapeHtml(c.body) +
            "</p>" +
            '<a class="btn btn-secondary" href="' +
            escapeHtml(c.href) +
            '"' +
            (c.external ? ' target="_blank" rel="noopener"' : "") +
            ">" +
            escapeHtml(c.cta) +
            "</a></div>"
          );
        })
        .join("") +
      "</div>";
  }

  global.ForgeOnboarding = {
    STEPS: STEPS,
    getProgress: getProgress,
    getWeeklyCards: getWeeklyCards,
    markDone: markDone,
    readState: readState,
    renderChecklist: renderChecklist,
    renderNextStep: renderNextStep,
    renderWeeklyCards: renderWeeklyCards,
  };
})(typeof window !== "undefined" ? window : global);
