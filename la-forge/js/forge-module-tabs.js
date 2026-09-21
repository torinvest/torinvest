/**
 * Onglets module : Contenu | Mode d'emploi | Mes questions
 * S'injecte automatiquement sur les pages /course/*.html
 */
(function () {
  "use strict";

  var state = {
    moduleId: null,
    me: null,
    isAdmin: false,
    threads: [],
    activeTab: "content",
  };

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function findLessonRoot() {
    return (
      document.querySelector("main.lesson-pro") ||
      document.querySelector(".lesson-layout") ||
      document.querySelector("main.container") ||
      document.querySelector("main")
    );
  }

  function wrapContent(root) {
    if (document.getElementById("forge-module-tabs")) return;

    var bar = document.createElement("div");
    bar.id = "forge-module-tabs";
    bar.className = "fmt-tabs";
    bar.innerHTML =
      '<nav class="fmt-tablist" role="tablist" aria-label="Navigation module">' +
      '<button type="button" class="fmt-tab is-active" data-fmt-tab="content" role="tab" aria-selected="true">Contenu</button>' +
      '<button type="button" class="fmt-tab" data-fmt-tab="guide" role="tab" aria-selected="false">Mode d\'emploi</button>' +
      '<button type="button" class="fmt-tab" data-fmt-tab="qa" role="tab" aria-selected="false">Mes questions</button>' +
      "</nav>" +
      '<div class="fmt-panels">' +
      '<div class="fmt-panel is-active" data-fmt-panel="content" role="tabpanel"></div>' +
      '<div class="fmt-panel" data-fmt-panel="guide" role="tabpanel" hidden></div>' +
      '<div class="fmt-panel" data-fmt-panel="qa" role="tabpanel" hidden></div>' +
      "</div>";

    var contentPanel = bar.querySelector('[data-fmt-panel="content"]');
    var kids = Array.prototype.slice.call(root.childNodes);
    kids.forEach(function (n) {
      contentPanel.appendChild(n);
    });
    root.appendChild(bar);

    bar.querySelectorAll("[data-fmt-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setTab(btn.getAttribute("data-fmt-tab"));
      });
    });
  }

  function setTab(name) {
    state.activeTab = name;
    document.querySelectorAll("[data-fmt-tab]").forEach(function (btn) {
      var on = btn.getAttribute("data-fmt-tab") === name;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    document.querySelectorAll("[data-fmt-panel]").forEach(function (panel) {
      var on = panel.getAttribute("data-fmt-panel") === name;
      panel.classList.toggle("is-active", on);
      panel.hidden = !on;
    });
    if (name === "guide") renderGuide();
    if (name === "qa") loadQa();
  }

  function renderGuide() {
    var panel = document.querySelector('[data-fmt-panel="guide"]');
    if (!panel) return;
    var guide =
      typeof getModuleGuide === "function"
        ? getModuleGuide(state.moduleId)
        : {
            title: state.moduleId,
            goal: "",
            order: [],
            tips: [],
            validation: [],
            minutes: 90,
          };

    panel.innerHTML =
      '<article class="fmt-guide">' +
      '<p class="fmt-kicker">Mode d\'emploi · Module ' +
      esc(guide.num || "") +
      "</p>" +
      "<h2>" +
      esc(guide.title) +
      "</h2>" +
      '<p class="fmt-lead">' +
      esc(guide.goal) +
      "</p>" +
      '<p class="fmt-meta">Durée indicative · ~' +
      esc(String(guide.minutes)) +
      " min</p>" +
      "<h3>Dans quel ordre</h3>" +
      "<ol class=\"fmt-list\">" +
      (guide.order || [])
        .map(function (x) {
          return "<li>" + esc(x) + "</li>";
        })
        .join("") +
      "</ol>" +
      "<h3>Comment valider</h3>" +
      "<ul class=\"fmt-list\">" +
      (guide.validation || [])
        .map(function (x) {
          return "<li>" + esc(x) + "</li>";
        })
        .join("") +
      "</ul>" +
      "<h3>Conseils</h3>" +
      "<ul class=\"fmt-list\">" +
      (guide.tips || [])
        .map(function (x) {
          return "<li>" + esc(x) + "</li>";
        })
        .join("") +
      "</ul>" +
      '<p class="fmt-hint">Une question ? Passe sur l\'onglet <strong>Mes questions</strong> — ta conversation est privée (toi + coach).</p>' +
      "</article>";
  }

  function statusLabel(s) {
    if (s === "answered") return "Répondu";
    if (s === "closed") return "Clôturé";
    return "En attente";
  }

  function renderQa() {
    var panel = document.querySelector('[data-fmt-panel="qa"]');
    if (!panel) return;

    var listHtml = "";
    if (!state.threads.length) {
      listHtml =
        '<p class="fmt-empty">Aucune question pour l\'instant. Pose la première ci-dessous.</p>';
    } else {
      listHtml = state.threads
        .map(function (t) {
          var msgs = (t.messages || [])
            .map(function (m) {
              var who = m.role === "admin" ? "Coach" : "Toi";
              return (
                '<div class="fmt-msg fmt-msg--' +
                esc(m.role || "student") +
                '"><span class="fmt-msg-who">' +
                who +
                "</span><p>" +
                esc(m.body) +
                "</p>" +
                '<time datetime="' +
                esc(m.at) +
                '">' +
                esc((m.at || "").slice(0, 16).replace("T", " ")) +
                "</time></div>"
              );
            })
            .join("");
          return (
            '<article class="fmt-thread" data-thread-id="' +
            esc(t.id) +
            '">' +
            '<header class="fmt-thread-head"><strong>' +
            esc(t.question.slice(0, 120)) +
            '</strong><span class="fmt-status fmt-status--' +
            esc(t.status) +
            '">' +
            statusLabel(t.status) +
            "</span></header>" +
            '<div class="fmt-msgs">' +
            msgs +
            "</div>" +
            (t.status === "closed"
              ? ""
              : '<form class="fmt-reply" data-reply="' +
                esc(t.id) +
                '"><textarea name="body" rows="2" maxlength="4000" placeholder="Préciser ou répondre…" required></textarea>' +
                '<button type="submit" class="btn btn-secondary">Envoyer</button></form>') +
            "</article>"
          );
        })
        .join("");
    }

    panel.innerHTML =
      '<section class="fmt-qa">' +
      "<h2>Mes questions — ce module</h2>" +
      '<p class="fmt-lead">Espace privé : seules <strong>toi</strong> et le <strong>coach</strong> voyez cette conversation. Tu peux poser n’importe quelle question liée (ou non) au module.</p>' +
      '<form class="fmt-ask" id="fmt-ask-form">' +
      '<label for="fmt-ask-input">Nouvelle question</label>' +
      '<textarea id="fmt-ask-input" name="question" rows="3" maxlength="4000" placeholder="Ex. : je ne comprends pas la différence BOS / MSS…" required></textarea>' +
      '<button type="submit" class="btn btn-primary">Envoyer au coach</button>' +
      "</form>" +
      '<div class="fmt-thread-list">' +
      listHtml +
      "</div>" +
      (state.isAdmin
        ? '<p class="fmt-admin-link"><a href="/module-qa.html">→ Boîte questions (admin)</a></p>'
        : "") +
      "</section>";

    var ask = document.getElementById("fmt-ask-form");
    if (ask) {
      ask.addEventListener("submit", function (e) {
        e.preventDefault();
        var ta = ask.querySelector("textarea");
        var q = (ta && ta.value) || "";
        postQuestion(q).then(function () {
          if (ta) ta.value = "";
        });
      });
    }

    panel.querySelectorAll("[data-reply]").forEach(function (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var id = form.getAttribute("data-reply");
        var ta = form.querySelector("textarea");
        var body = (ta && ta.value) || "";
        postReply(id, body).then(function () {
          if (ta) ta.value = "";
        });
      });
    });
  }

  async function loadQa() {
    var panel = document.querySelector('[data-fmt-panel="qa"]');
    if (panel) panel.innerHTML = '<p class="fmt-empty">Chargement…</p>';
    try {
      if (typeof api !== "function") throw new Error("api indisponible");
      var data = await api(
        "/api/module-qa?moduleId=" + encodeURIComponent(state.moduleId || "")
      );
      state.isAdmin = Boolean(data.isAdmin);
      state.threads = data.threads || [];
      renderQa();
    } catch (err) {
      if (panel) {
        panel.innerHTML =
          '<p class="fmt-empty">Impossible de charger les questions. ' +
          esc(err && err.message ? err.message : String(err)) +
          "</p>";
      }
    }
  }

  async function postQuestion(question) {
    await api("/api/module-qa", {
      method: "POST",
      body: JSON.stringify({
        moduleId: state.moduleId,
        question: question,
      }),
    });
    return loadQa();
  }

  async function postReply(id, body) {
    await api("/api/module-qa/" + encodeURIComponent(id) + "/reply", {
      method: "POST",
      body: JSON.stringify({ body: body }),
    });
    return loadQa();
  }

  async function boot() {
    if (!/\/course\//.test(location.pathname)) return;
    if (/\/course\/index\.html$/i.test(location.pathname) || /\/course\/?$/i.test(location.pathname))
      return;

    var tries = 0;
    function ready() {
      return typeof getModuleIdFromPath === "function" && typeof MODULES !== "undefined";
    }
    while (!ready() && tries < 40) {
      await new Promise(function (r) {
        setTimeout(r, 50);
      });
      tries += 1;
    }

    var moduleId =
      typeof getModuleIdFromPath === "function"
        ? getModuleIdFromPath(location.pathname)
        : null;
    if (!moduleId) return;

    state.moduleId = moduleId;
    var root = findLessonRoot();
    if (!root) return;

    wrapContent(root);

    try {
      if (typeof getMe === "function") {
        state.me = await getMe();
        state.isAdmin = Boolean(state.me && state.me.isAdmin);
      }
    } catch (_) {}
  }

  window.initForgeModuleTabs = boot;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      boot();
    });
  } else {
    boot();
  }
})();
