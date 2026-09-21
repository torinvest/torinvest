/**
 * Inbox admin — questions modules (toutes / filtrées).
 */
(function () {
  "use strict";

  var state = { threads: [], filter: "open", moduleId: "" };

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function moduleTitle(id) {
    if (typeof MODULES === "undefined") return id;
    for (var i = 0; i < MODULES.length; i++) {
      if (MODULES[i].id === id) return MODULES[i].num + " · " + MODULES[i].title;
    }
    return id;
  }

  function statusLabel(s) {
    if (s === "answered") return "Répondu";
    if (s === "closed") return "Clôturé";
    return "En attente";
  }

  async function load() {
    var q = "/api/module-qa?";
    if (state.filter) q += "status=" + encodeURIComponent(state.filter) + "&";
    if (state.moduleId) q += "moduleId=" + encodeURIComponent(state.moduleId) + "&";
    var data = await api(q);
    if (!data.isAdmin) {
      document.getElementById("module-qa-root").innerHTML =
        '<p class="fmt-empty card">Accès admin uniquement.</p>';
      return;
    }
    state.threads = data.threads || [];
    render();
  }

  function render() {
    var root = document.getElementById("module-qa-root");
    if (!root) return;

    var options =
      '<option value="">Tous les modules</option>' +
      (typeof MODULES !== "undefined"
        ? MODULES.map(function (m) {
            return (
              '<option value="' +
              esc(m.id) +
              '"' +
              (state.moduleId === m.id ? " selected" : "") +
              ">" +
              esc(m.num + " — " + m.title) +
              "</option>"
            );
          }).join("")
        : "");

    var list = state.threads.length
      ? state.threads
          .map(function (t) {
            var msgs = (t.messages || [])
              .map(function (m) {
                return (
                  '<div class="fmt-msg fmt-msg--' +
                  esc(m.role) +
                  '"><span class="fmt-msg-who">' +
                  (m.role === "admin" ? "Coach" : esc(t.studentName || t.studentEmail)) +
                  "</span><p>" +
                  esc(m.body) +
                  "</p></div>"
                );
              })
              .join("");
            return (
              '<article class="fmt-thread" data-id="' +
              esc(t.id) +
              '">' +
              '<header class="fmt-thread-head">' +
              "<div><strong>" +
              esc(t.studentName || t.studentEmail) +
              "</strong> · <span class=\"fmt-meta\">" +
              esc(moduleTitle(t.moduleId)) +
              '</span><br/><span class="fmt-meta">' +
              esc(t.studentEmail) +
              "</span></div>" +
              '<span class="fmt-status fmt-status--' +
              esc(t.status) +
              '">' +
              statusLabel(t.status) +
              "</span></header>" +
              '<div class="fmt-msgs">' +
              msgs +
              "</div>" +
              '<form class="fmt-reply" data-reply="' +
              esc(t.id) +
              '"><textarea rows="2" maxlength="4000" placeholder="Ta réponse…" required></textarea>' +
              '<div class="fmt-admin-actions">' +
              '<button type="submit" class="btn btn-primary">Répondre</button>' +
              '<button type="button" class="btn btn-secondary" data-close="' +
              esc(t.id) +
              '">Clôturer</button>' +
              "</div></form></article>"
            );
          })
          .join("")
      : '<p class="fmt-empty">Aucune question pour ce filtre.</p>';

    root.innerHTML =
      '<div class="fmt-admin-filters">' +
      '<label>Statut <select id="mqa-status">' +
      '<option value="open"' +
      (state.filter === "open" ? " selected" : "") +
      ">En attente</option>" +
      '<option value="answered"' +
      (state.filter === "answered" ? " selected" : "") +
      ">Répondu</option>" +
      '<option value="closed"' +
      (state.filter === "closed" ? " selected" : "") +
      ">Clôturé</option>" +
      '<option value=""' +
      (state.filter === "" ? " selected" : "") +
      ">Tous</option>" +
      "</select></label>" +
      '<label>Module <select id="mqa-module">' +
      options +
      "</select></label>" +
      "</div>" +
      '<div class="fmt-thread-list">' +
      list +
      "</div>";

    document.getElementById("mqa-status").addEventListener("change", function (e) {
      state.filter = e.target.value;
      load();
    });
    document.getElementById("mqa-module").addEventListener("change", function (e) {
      state.moduleId = e.target.value;
      load();
    });

    root.querySelectorAll("[data-reply]").forEach(function (form) {
      form.addEventListener("submit", async function (e) {
        e.preventDefault();
        var id = form.getAttribute("data-reply");
        var body = form.querySelector("textarea").value;
        await api("/api/module-qa/" + encodeURIComponent(id) + "/reply", {
          method: "POST",
          body: JSON.stringify({ body: body }),
        });
        load();
      });
    });

    root.querySelectorAll("[data-close]").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        var id = btn.getAttribute("data-close");
        await api("/api/module-qa/" + encodeURIComponent(id), {
          method: "PATCH",
          body: JSON.stringify({ status: "closed" }),
        });
        load();
      });
    });
  }

  window.initModuleQaAdmin = async function (me) {
    if (!me || !me.isAdmin) {
      var root = document.getElementById("module-qa-root");
      if (root) root.innerHTML = '<p class="fmt-empty card">Accès admin uniquement.</p>';
      return;
    }

    document.querySelectorAll("[data-mqa-admin-nav]").forEach(function (el) {
      el.hidden = false;
      el.style.display = "";
    });

    // Inject nav link in header if absent
    var header = document.querySelector(".site-header nav, header.site-header, [data-forge-member-header]");
    if (header && !document.querySelector('a[href*="module-qa.html"]')) {
      var a = document.createElement("a");
      a.href = "/module-qa.html";
      a.textContent = "Questions modules";
      a.setAttribute("data-mqa-admin-nav", "");
      if (/module-qa/.test(location.pathname)) a.className = "active";
      header.appendChild(a);
    }

    await load();
  };
})();
