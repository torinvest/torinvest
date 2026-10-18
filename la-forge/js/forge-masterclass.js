/**
 * TORINVEST Masterclass Macro — hub + viewer (admin / grant only).
 */
(function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function api(path, options) {
    const res = await fetch(path, {
      credentials: "same-origin",
      headers: { Accept: "application/json", ...(options && options.headers) },
      ...options,
    });
    const data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) {
      const err = new Error(data.message || data.error || "HTTP " + res.status);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function renderTable(table) {
    if (!table || !table.headers) return "";
    let html = '<div class="mc-table-wrap"><table class="mc-table"><thead><tr>';
    table.headers.forEach(function (h) {
      html += "<th>" + esc(h) + "</th>";
    });
    html += "</tr></thead><tbody>";
    (table.rows || []).forEach(function (row) {
      html += "<tr>";
      row.forEach(function (c) {
        html += "<td>" + esc(c) + "</td>";
      });
      html += "</tr>";
    });
    html += "</tbody></table></div>";
    return html;
  }

  function renderChapterBody(chapter) {
    const tablesById = {};
    (chapter.tables || []).forEach(function (t) {
      tablesById[t.id] = t;
    });
    let html = "";
    (chapter.sections || []).forEach(function (sec) {
      html +=
        '<section class="mc-section" id="' +
        esc(sec.id) +
        '"><h2>' +
        esc(sec.title) +
        "</h2>";
      (sec.blocks || []).forEach(function (b) {
        if (b.type === "table" && tablesById[b.tableId]) {
          html += renderTable(tablesById[b.tableId]);
        } else if (b.type === "p" && b.text) {
          html += "<p>" + esc(b.text) + "</p>";
        }
      });
      html += "</section>";
    });
    return html;
  }

  function bindAdmin(catalogAccess) {
    const panel = document.getElementById("mc-admin-panel");
    if (!panel || !catalogAccess || !catalogAccess.isAdmin) return;
    panel.hidden = false;
    api("/api/masterclass/admin/config")
      .then(function (data) {
        const cfg = data.config || {};
        const el = document.getElementById("mc-admin-summary");
        if (el) {
          el.innerHTML =
            "<p><strong>Statut</strong> : " +
            esc(cfg.publication_status) +
            " · <strong>Visibilité</strong> : " +
            esc(cfg.visibility) +
            " · <strong>Ventes</strong> : " +
            (cfg.sales_enabled ? "ON" : "OFF") +
            "</p><p>Chapitres sur disque : " +
            esc(String((data.chapterNumbers || []).length)) +
            " · Grants : " +
            esc(String((data.grants || []).length)) +
            "</p><p class=\"mc-muted\">Prix / paiement : non actifs tant que sales_enabled=false.</p>";
        }
        const grantForm = document.getElementById("mc-grant-form");
        if (grantForm) {
          grantForm.onsubmit = async function (e) {
            e.preventDefault();
            const email = String(new FormData(grantForm).get("email") || "").trim();
            if (!email) return;
            try {
              await api("/api/masterclass/admin/grants", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email, source: "admin_ui" }),
              });
              alert("Accès accordé à " + email);
              grantForm.reset();
            } catch (err) {
              alert(err.message || String(err));
            }
          };
        }
      })
      .catch(function (err) {
        panel.innerHTML =
          '<p class="mc-muted">Admin indisponible : ' + esc(err.message) + "</p>";
      });
  }

  async function initMasterclassHub() {
    const root = document.getElementById("mc-root");
    if (!root) return;
    root.innerHTML = '<p class="mc-loading">Chargement Masterclass…</p>';
    try {
      const cat = await api("/api/masterclass/catalog");
      const access = cat.access || {};
      if (!access.canRead) {
        root.innerHTML =
          '<div class="mc-locked"><h2>Accès restreint</h2><p>Cette Masterclass est en préparation (admin uniquement). ' +
          "Raison : <code>" +
          esc(access.reason || "forbidden") +
          "</code></p>" +
          (access.isAdmin
            ? "<p>Compte admin détecté mais contenu inaccessible — vérifie l’import des chapitres sur le VPS.</p>"
            : "<p>Les élèves n’y ont pas accès pour le moment.</p>") +
          "</div>";
        if (access.isAdmin) bindAdmin(access);
        return;
      }

      const data = await api("/api/masterclass/index");
      const chapters = (data.index && data.index.chapters) || [];
      const progress = data.progress || {};
      let list = '<div class="mc-toc">';
      chapters.forEach(function (ch) {
        const p = progress[String(ch.number)] || {};
        list +=
          '<a class="mc-toc-item' +
          (p.completed ? " done" : "") +
          '" href="/masterclass-chapter.html?n=' +
          esc(String(ch.number)) +
          '"><span class="num">' +
          esc(String(ch.number).padStart(2, "0")) +
          '</span><span class="title">' +
          esc(ch.title) +
          "</span></a>";
      });
      list += "</div>";

      root.innerHTML =
        '<div class="mc-hero"><span class="forge-hero-tag">La Forge · optionnel</span>' +
        "<h1>" +
        esc((cat.catalog && cat.catalog.title) || "Masterclass") +
        "</h1>" +
        '<p class="mc-sub">' +
        chapters.length +
        " chapitres · accès " +
        esc((data.access && data.access.role) || "autorisé") +
        " · ventes désactivées</p>" +
        '<p class="mc-philosophy">« Le fondamental explique pourquoi ; la technique décide quand. »</p></div>' +
        list;

      bindAdmin(access);
    } catch (err) {
      root.innerHTML =
        '<p class="mc-loading">' +
        esc(
          err.status === 403
            ? "Accès refusé — Masterclass réservée à l’admin / accès payant."
            : err.message || String(err)
        ) +
        "</p>";
    }
  }

  async function initMasterclassChapter() {
    const root = document.getElementById("mc-chapter-root");
    if (!root) return;
    const params = new URLSearchParams(window.location.search);
    const n = Number(params.get("n") || params.get("chapter") || "0");
    if (!n) {
      root.innerHTML = '<p class="mc-loading">Numéro de chapitre manquant.</p>';
      return;
    }
    root.innerHTML = '<p class="mc-loading">Chargement chapitre ' + n + "…</p>";
    try {
      const data = await api("/api/masterclass/chapters/" + n);
      const ch = data.chapter;
      document.title = ch.title + " — Masterclass — La Forge";
      const prev = n > 1 ? n - 1 : null;
      const next = n + 1;
      root.innerHTML =
        '<nav class="mc-chapter-nav"><a href="/masterclass.html">← Sommaire</a>' +
        (prev
          ? ' · <a href="/masterclass-chapter.html?n=' + prev + '">Chapitre ' + prev + "</a>"
          : "") +
        ' · <a href="/masterclass-chapter.html?n=' +
        next +
        '">Chapitre ' +
        next +
        " →</a></nav>" +
        '<article class="mc-article"><header class="mc-article-head"><p class="mc-kicker">Chapitre ' +
        esc(String(ch.number)) +
        "</p><h1>" +
        esc(ch.title) +
        "</h1></header>" +
        renderChapterBody(ch) +
        "</article>" +
        '<div class="mc-chapter-actions"><button type="button" class="btn btn-primary" id="mc-mark-done">Marquer comme lu</button></div>';

      const btn = document.getElementById("mc-mark-done");
      if (btn) {
        btn.addEventListener("click", async function () {
          try {
            await api("/api/masterclass/progress", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chapter: n, completed: true }),
            });
            btn.textContent = "Enregistré ✓";
            btn.disabled = true;
          } catch (e) {
            alert(e.message || String(e));
          }
        });
      }
    } catch (err) {
      root.innerHTML =
        '<p class="mc-loading">' +
        esc(err.message || String(err)) +
        ' · <a href="/masterclass.html">Retour</a></p>';
    }
  }

  window.initMasterclassHub = initMasterclassHub;
  window.initMasterclassChapter = initMasterclassChapter;
})();
