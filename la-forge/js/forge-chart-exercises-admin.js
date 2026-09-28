/**
 * Admin — notes & screens exercices chart des élèves.
 */
(function () {
  "use strict";

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function api(url) {
    const res = await fetch(url, { credentials: "same-origin" });
    const data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) throw new Error(data.error || "Erreur " + res.status);
    return data;
  }

  async function renderList(root) {
    const data = await api("/api/chart-exercises-admin");
    const items = data.items || [];
    if (!items.length) {
      root.innerHTML =
        '<p class="fmt-empty">Aucune note / screen élève pour le moment.</p>';
      return;
    }
    root.innerHTML =
      '<div class="cex-admin-list">' +
      items
        .map(function (it) {
          return (
            '<article class="cex-admin-card" data-slug="' +
            esc(it.emailSlug) +
            '" data-mod="' +
            esc(it.moduleId) +
            '">' +
            '<div class="cex-admin-meta"><strong>' +
            esc(it.email || it.emailSlug) +
            "</strong> · module <code>" +
            esc(it.moduleId) +
            "</code></div>" +
            '<p class="cex-admin-preview">' +
            esc(it.notesPreview || "(pas de texte)") +
            "</p>" +
            '<p class="cex-admin-stats">' +
            (it.doneCount || 0) +
            " tâche(s) · " +
            (it.imageCount || 0) +
            " screen(s) · " +
            esc((it.updatedAt || "").slice(0, 16).replace("T", " ")) +
            "</p>" +
            '<button type="button" class="btn btn-secondary cex-open">Ouvrir</button>' +
            "</article>"
          );
        })
        .join("") +
      "</div>";

    root.querySelectorAll(".cex-open").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const card = btn.closest("[data-slug]");
        openOne(root, card.getAttribute("data-slug"), card.getAttribute("data-mod"));
      });
    });
  }

  async function openOne(root, slug, moduleId) {
    const data = await api(
      "/api/chart-exercises-admin/" +
        encodeURIComponent(slug) +
        "/" +
        encodeURIComponent(moduleId)
    );
    const ex = data.exercise || {};
    const imgs = (ex.images || [])
      .map(function (img) {
        const src =
          "/api/chart-exercises/" +
          encodeURIComponent(moduleId) +
          "/media/" +
          encodeURIComponent(img.file) +
          "?email=" +
          encodeURIComponent(ex.email || "");
        return (
          '<figure class="cex-admin-shot"><img src="' +
          esc(src) +
          '" alt="" loading="lazy" />' +
          (img.caption ? "<figcaption>" + esc(img.caption) + "</figcaption>" : "") +
          "</figure>"
        );
      })
      .join("");

    root.innerHTML =
      '<button type="button" class="btn btn-secondary" id="cex-back">← Liste</button>' +
      '<article class="cex-admin-detail">' +
      "<h2>" +
      esc(ex.email || slug) +
      " · <code>" +
      esc(moduleId) +
      "</code></h2>" +
      '<p class="cex-admin-stats">Tâches cochées : ' +
      esc(JSON.stringify(ex.done || [])) +
      " · MAJ " +
      esc((ex.updatedAt || "").slice(0, 19).replace("T", " ")) +
      "</p>" +
      "<h3>Notes</h3>" +
      '<pre class="cex-admin-notes">' +
      esc(ex.notes || "—") +
      "</pre>" +
      "<h3>Screens</h3>" +
      (imgs
        ? '<div class="cex-admin-gallery">' + imgs + "</div>"
        : '<p class="fmt-empty">Aucun screen.</p>') +
      "</article>";

    document.getElementById("cex-back").onclick = function () {
      renderList(root).catch(function (e) {
        root.innerHTML = '<p class="fmt-empty">' + esc(e.message) + "</p>";
      });
    };
  }

  window.initChartExercisesAdmin = async function () {
    const root = document.getElementById("chart-exercises-admin-root");
    if (!root) return;
    try {
      await renderList(root);
    } catch (err) {
      root.innerHTML =
        '<p class="fmt-empty">Erreur : ' + esc(err && err.message ? err.message : err) + "</p>";
    }
  };
})();
