/**
 * Onglets module : Contenu | Mode d'emploi | Mes questions
 * Barre sticky non destructive (ne deplace pas le DOM de la lecon).
 */
(function () {
  "use strict";

  var state = {
    moduleId: null,
    me: null,
    isAdmin: false,
    threads: [],
    activeTab: "content",
    mounted: false,
  };

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function guessModuleId() {
    if (typeof getModuleIdFromPath === "function") {
      var id = getModuleIdFromPath(location.pathname);
      if (id) return id;
    }
    var file = (location.pathname.split("/").pop() || "").replace(/\.html$/i, "");
    if (!file || typeof MODULES === "undefined") return file || null;
    for (var i = 0; i < MODULES.length; i++) {
      if (String(MODULES[i].href || "").indexOf(file) !== -1) return MODULES[i].id;
    }
    return file || null;
  }

  function lessonNodesToToggle() {
    var main =
      document.querySelector("main.lesson-pro") ||
      document.querySelector(".lesson-layout") ||
      document.querySelector("main.container") ||
      document.querySelector("main");
    if (!main) return [];
    return Array.prototype.slice.call(main.children).filter(function (el) {
      return el.id !== "forge-module-tabs" && el.id !== "forge-module-extra";
    });
  }

  function setLessonVisible(show) {
    lessonNodesToToggle().forEach(function (el) {
      if (show) {
        if (el.dataset.fmtPrevDisplay != null) {
          el.style.display = el.dataset.fmtPrevDisplay;
          delete el.dataset.fmtPrevDisplay;
        } else {
          el.style.display = "";
        }
      } else {
        if (el.dataset.fmtPrevDisplay == null) {
          el.dataset.fmtPrevDisplay = el.style.display || "";
        }
        el.style.display = "none";
      }
    });
  }

  function mountShell() {
    if (document.getElementById("forge-module-tabs")) {
      state.mounted = true;
      return;
    }

    var shell = document.createElement("div");
    shell.id = "forge-module-tabs";
    shell.className = "fmt-tabs fmt-tabs--sticky";
    shell.innerHTML =
      '<div class="fmt-tabs-inner">' +
      '<p class="fmt-tabs-label">Ce module</p>' +
      '<nav class="fmt-tablist" role="tablist" aria-label="Navigation module">' +
      '<button type="button" class="fmt-tab is-active" data-fmt-tab="content" role="tab">Contenu</button>' +
      '<button type="button" class="fmt-tab" data-fmt-tab="guide" role="tab">Mode d\'emploi</button>' +
      '<button type="button" class="fmt-tab" data-fmt-tab="qa" role="tab">Mes questions</button>' +
      "</nav></div>";

    var extra = document.createElement("div");
    extra.id = "forge-module-extra";
    extra.className = "fmt-extra";
    extra.hidden = true;
    extra.innerHTML =
      '<div class="fmt-panel" data-fmt-panel="guide" hidden></div>' +
      '<div class="fmt-panel" data-fmt-panel="qa" hidden></div>';

    var header = document.querySelector("header.site-header, header, [data-forge-member-header]");
    var main =
      document.querySelector("main.lesson-pro") ||
      document.querySelector(".lesson-layout") ||
      document.querySelector("main.container") ||
      document.querySelector("main");

    if (main) {
      main.insertBefore(shell, main.firstChild);
      main.insertBefore(extra, shell.nextSibling);
    } else if (header && header.parentNode) {
      header.parentNode.insertBefore(shell, header.nextSibling);
      header.parentNode.insertBefore(extra, shell.nextSibling);
    } else {
      document.body.insertBefore(extra, document.body.firstChild);
      document.body.insertBefore(shell, document.body.firstChild);
    }

    shell.querySelectorAll("[data-fmt-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setTab(btn.getAttribute("data-fmt-tab"));
      });
    });

    state.mounted = true;
  }

  function setTab(name) {
    state.activeTab = name;
    document.querySelectorAll("#forge-module-tabs [data-fmt-tab]").forEach(function (btn) {
      var on = btn.getAttribute("data-fmt-tab") === name;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });

    var extra = document.getElementById("forge-module-extra");
    if (name === "content") {
      if (extra) extra.hidden = true;
      setLessonVisible(true);
      return;
    }

    setLessonVisible(false);
    if (extra) extra.hidden = false;
    document.querySelectorAll("#forge-module-extra [data-fmt-panel]").forEach(function (panel) {
      var on = panel.getAttribute("data-fmt-panel") === name;
      panel.hidden = !on;
    });
    if (name === "guide") renderGuide();
    if (name === "qa") loadQa();
  }

  function renderGuide() {
    var panel = document.querySelector('#forge-module-extra [data-fmt-panel="guide"]');
    if (!panel) return;
    var guide =
      typeof getModuleGuide === "function"
        ? getModuleGuide(state.moduleId)
        : {
            title: state.moduleId || "Module",
            goal: "Parcours le contenu, valide le quiz, pose tes questions ici.",
            order: [],
            tips: [],
            validation: [],
            minutes: 90,
            num: "",
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
      '<p class="fmt-meta">Duree indicative · ~' +
      esc(String(guide.minutes || 90)) +
      " min</p>" +
      "<h3>Dans quel ordre</h3><ol class=\"fmt-list\">" +
      (guide.order || [])
        .map(function (x) {
          return "<li>" + esc(x) + "</li>";
        })
        .join("") +
      "</ol>" +
      "<h3>Comment valider</h3><ul class=\"fmt-list\">" +
      (guide.validation || [])
        .map(function (x) {
          return "<li>" + esc(x) + "</li>";
        })
        .join("") +
      "</ul>" +
      "<h3>Conseils</h3><ul class=\"fmt-list\">" +
      (guide.tips || [])
        .map(function (x) {
          return "<li>" + esc(x) + "</li>";
        })
        .join("") +
      "</ul>" +
      '<p class="fmt-hint">Une question ? Onglet <strong>Mes questions</strong> — conversation privee avec le coach.</p>' +
      "</article>";
  }

  function statusLabel(s) {
    if (s === "answered") return "Repondu";
    if (s === "closed") return "Cloture";
    return "En attente";
  }

  function renderQa() {
    var panel = document.querySelector('#forge-module-extra [data-fmt-panel="qa"]');
    if (!panel) return;

    var listHtml = !state.threads.length
      ? '<p class="fmt-empty">Aucune question pour l\'instant. Pose la premiere ci-dessous.</p>'
      : state.threads
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
                  "</p></div>"
                );
              })
              .join("");
            return (
              '<article class="fmt-thread">' +
              '<header class="fmt-thread-head"><strong>' +
              esc((t.question || "").slice(0, 120)) +
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
                  '"><textarea name="body" rows="2" maxlength="4000" required placeholder="Preciser…"></textarea>' +
                  '<button type="submit" class="btn btn-secondary">Envoyer</button></form>') +
              "</article>"
            );
          })
          .join("");

    panel.innerHTML =
      '<section class="fmt-qa">' +
      "<h2>Mes questions — ce module</h2>" +
      '<p class="fmt-lead">Espace prive : toi + le coach uniquement.</p>' +
      '<form class="fmt-ask" id="fmt-ask-form">' +
      "<label for=\"fmt-ask-input\">Nouvelle question</label>" +
      '<textarea id="fmt-ask-input" rows="3" maxlength="4000" required placeholder="Ta question…"></textarea>' +
      '<button type="submit" class="btn btn-primary">Envoyer au coach</button></form>' +
      '<div class="fmt-thread-list">' +
      listHtml +
      "</div>" +
      (state.isAdmin
        ? '<p class="fmt-admin-link"><a href="/module-qa.html">Boite questions (admin)</a></p>'
        : "") +
      "</section>";

    var ask = document.getElementById("fmt-ask-form");
    if (ask) {
      ask.addEventListener("submit", function (e) {
        e.preventDefault();
        var ta = ask.querySelector("textarea");
        postQuestion((ta && ta.value) || "").then(function () {
          if (ta) ta.value = "";
        });
      });
    }
    panel.querySelectorAll("[data-reply]").forEach(function (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var id = form.getAttribute("data-reply");
        var ta = form.querySelector("textarea");
        postReply(id, (ta && ta.value) || "").then(function () {
          if (ta) ta.value = "";
        });
      });
    });
  }

  async function loadQa() {
    var panel = document.querySelector('#forge-module-extra [data-fmt-panel="qa"]');
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
          '<p class="fmt-empty">Impossible de charger les questions (' +
          esc(err && err.message ? err.message : String(err)) +
          ").</p>";
      }
    }
  }

  async function postQuestion(question) {
    await api("/api/module-qa", {
      method: "POST",
      body: JSON.stringify({ moduleId: state.moduleId, question: question }),
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
    var path = location.pathname || "";
    if (path.indexOf("/course/") === -1) return;
    if (/\/course\/index\.html$/i.test(path)) return;
    if (/\/course\/?$/i.test(path)) return;

    var tries = 0;
    while (typeof MODULES === "undefined" && tries < 60) {
      await new Promise(function (r) {
        setTimeout(r, 50);
      });
      tries += 1;
    }

    state.moduleId = guessModuleId();
    if (!state.moduleId) {
      console.warn("[forge-tabs] moduleId introuvable pour", path);
      state.moduleId = "unknown";
    }

    mountShell();

    try {
      if (typeof getMe === "function") {
        state.me = await getMe();
        state.isAdmin = Boolean(state.me && state.me.isAdmin);
      }
    } catch (_) {}

    console.info("[forge-tabs] OK", state.moduleId);
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
