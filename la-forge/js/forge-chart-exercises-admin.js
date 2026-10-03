/**
 * Admin — notes & screens exercices chart des élèves.
 * Affiche le libellé module (ex. F1 — …) + lightbox taille réelle.
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

  /** Libellé humain à partir de course-data.js (MODULES) ou fallback. */
  function moduleLabel(moduleId) {
    const id = String(moduleId || "");
    if (typeof MODULES !== "undefined" && Array.isArray(MODULES)) {
      for (let i = 0; i < MODULES.length; i++) {
        if (MODULES[i] && MODULES[i].id === id) {
          const num = MODULES[i].num ? String(MODULES[i].num) + " — " : "";
          return num + (MODULES[i].title || id);
        }
      }
    }
    const FALLBACK = {
      intro: "0 — Le métier de trader & la vérité du marché",
      f01: "F1 — Participants & microstructure",
      f02: "F2 — XAUUSD — anatomie de l'or",
      f03: "F3 — Multi-timeframe & narrative",
      f04: "F4 — Classes d'actifs & corrélations",
      f05: "F5 — Price Action pur",
      mac01: "M1 — Drivers macro de l'or",
      mac02: "M2 — Intermarket DXY & taux",
      mac03: "M3 — Calendrier & plan macro",
      mac04: "M4 — Banques centrales",
      "module-01": "1 — Market Structure & MSS",
      "module-02": "2 — Liquidité institutionnelle",
      "module-03": "3 — FVG & inefficience",
      "module-04": "4 — Order Blocks avancés",
      "module-05": "5 — Dealing Range & OTE",
      "module-06": "6 — Killzones & plan journalier",
      "module-07": "7 — SMT & intermarket",
      "module-08": "8 — NWOG, NDOG & profils weekly",
      "module-09": "9 — Modèles d'entrée avancés",
      "module-10": "10 — ICT ÉLITE",
      "module-11": "11 — Maîtrise — puzzle complet XAU",
      "tool-courtiers": "T1 — Courtiers, spreads & plateformes",
      "tool-indicateurs": "T2 — Indicateurs & order flow",
      "divers-bourse": "B1 — Bourse & diversification",
      "divers-crypto": "B2 — Marchés crypto",
      "data-journal": "P1 — Data & journal de trading",
      mindset: "P2 — Mindset & discipline pro",
    };
    return FALLBACK[id] || id;
  }

  function moduleHref(moduleId) {
    if (typeof MODULES !== "undefined" && Array.isArray(MODULES)) {
      for (let i = 0; i < MODULES.length; i++) {
        if (MODULES[i] && MODULES[i].id === moduleId && MODULES[i].href) {
          return MODULES[i].href;
        }
      }
    }
    return "/course/";
  }

  async function api(url) {
    const res = await fetch(url, { credentials: "same-origin" });
    const data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) throw new Error(data.error || "Erreur " + res.status);
    return data;
  }

  function ensureLightbox() {
    let box = document.getElementById("cex-lightbox");
    if (box) return box;
    box = document.createElement("div");
    box.id = "cex-lightbox";
    box.className = "cex-lightbox";
    box.hidden = true;
    box.innerHTML =
      '<div class="cex-lightbox-backdrop" data-cex-close="1"></div>' +
      '<div class="cex-lightbox-panel" role="dialog" aria-modal="true">' +
      '<div class="cex-lightbox-bar">' +
      '<span class="cex-lightbox-caption" id="cex-lightbox-caption"></span>' +
      '<div class="cex-lightbox-actions">' +
      '<a class="btn btn-secondary" id="cex-lightbox-open" target="_blank" rel="noopener">Ouvrir onglet</a>' +
      '<button type="button" class="btn btn-secondary" data-cex-close="1">Fermer</button>' +
      "</div></div>" +
      '<div class="cex-lightbox-stage">' +
      '<img id="cex-lightbox-img" alt="Screen élève — taille réelle" />' +
      "</div></div>";
    document.body.appendChild(box);
    box.addEventListener("click", function (ev) {
      if (ev.target.closest("[data-cex-close]")) closeLightbox();
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && !box.hidden) closeLightbox();
    });
    return box;
  }

  function openLightbox(src, caption) {
    const box = ensureLightbox();
    const img = document.getElementById("cex-lightbox-img");
    const cap = document.getElementById("cex-lightbox-caption");
    const link = document.getElementById("cex-lightbox-open");
    img.src = src;
    img.removeAttribute("width");
    img.removeAttribute("height");
    if (cap) cap.textContent = caption || "Screen — cliquez-glissez pour parcourir · molette pour zoomer le navigateur";
    if (link) link.href = src;
    box.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    const box = document.getElementById("cex-lightbox");
    if (!box) return;
    box.hidden = true;
    const img = document.getElementById("cex-lightbox-img");
    if (img) img.removeAttribute("src");
    document.body.style.overflow = "";
  }

  async function renderList(root) {
    const data = await api("/api/chart-exercises-admin");
    const items = data.items || [];
    if (!items.length) {
      root.innerHTML =
        '<div class="cex-admin-empty">' +
        '<p class="fmt-empty">Aucune note / screen synchronisé pour le moment.</p>' +
        "<p class=\"cex-admin-hint\">Les annotations enregistrées uniquement dans le navigateur de l’élève " +
        "remontent dès qu’il se reconnecte (dashboard ou module). " +
        "Demande-lui d’ouvrir La Forge une fois — elles apparaîtront ici automatiquement.</p>" +
        '<button type="button" class="btn btn-secondary" id="cex-refresh">Rafraîchir</button>' +
        "</div>";
      const btn = document.getElementById("cex-refresh");
      if (btn) {
        btn.onclick = function () {
          renderList(root).catch(function (e) {
            root.innerHTML = '<p class="fmt-empty">' + esc(e.message) + "</p>";
          });
        };
      }
      return;
    }
    root.innerHTML =
      '<div class="cex-admin-toolbar"><button type="button" class="btn btn-secondary" id="cex-refresh">Rafraîchir</button> ' +
      '<span class="cex-admin-stats">' +
      items.length +
      " entrée(s)</span></div>" +
      '<div class="cex-admin-list">' +
      items
        .map(function (it) {
          const label = moduleLabel(it.moduleId);
          return (
            '<article class="cex-admin-card" data-slug="' +
            esc(it.emailSlug) +
            '" data-mod="' +
            esc(it.moduleId) +
            '">' +
            '<div class="cex-admin-meta"><strong>' +
            esc(it.email || it.emailSlug) +
            "</strong></div>" +
            '<p class="cex-admin-module"><span class="cex-module-badge">Module</span> ' +
            esc(label) +
            ' <code class="cex-module-id">' +
            esc(it.moduleId) +
            "</code></p>" +
            '<p class="cex-admin-preview">' +
            esc(it.notesPreview || "(pas de texte — tâches / screens seulement)") +
            "</p>" +
            '<p class="cex-admin-stats">' +
            (it.notesLen || 0) +
            " car. · " +
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

    const refresh = document.getElementById("cex-refresh");
    if (refresh) {
      refresh.onclick = function () {
        renderList(root).catch(function (e) {
          root.innerHTML = '<p class="fmt-empty">' + esc(e.message) + "</p>";
        });
      };
    }

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
    const label = moduleLabel(moduleId);
    const href = moduleHref(moduleId);
    const imgs = (ex.images || [])
      .map(function (img, idx) {
        const src =
          "/api/chart-exercises/" +
          encodeURIComponent(moduleId) +
          "/media/" +
          encodeURIComponent(img.file) +
          "?email=" +
          encodeURIComponent(ex.email || "");
        return (
          '<figure class="cex-admin-shot" data-cex-src="' +
          esc(src) +
          '" data-cex-cap="' +
          esc(label + " · screen " + (idx + 1)) +
          '">' +
          '<img src="' +
          esc(src) +
          '" alt="Screen ' +
          (idx + 1) +
          '" loading="lazy" />' +
          "<figcaption>" +
          esc(img.caption || "Cliquer pour agrandir (taille réelle)") +
          "</figcaption>" +
          "</figure>"
        );
      })
      .join("");

    root.innerHTML =
      '<button type="button" class="btn btn-secondary" id="cex-back">← Liste</button>' +
      '<article class="cex-admin-detail">' +
      "<h2>" +
      esc(ex.email || slug) +
      "</h2>" +
      '<p class="cex-admin-module cex-admin-module--detail">' +
      '<span class="cex-module-badge">Module</span> ' +
      esc(label) +
      ' <code class="cex-module-id">' +
      esc(moduleId) +
      "</code>" +
      (href
        ? ' · <a href="' + esc(href) + '" target="_blank" rel="noopener">Ouvrir le module</a>'
        : "") +
      "</p>" +
      '<p class="cex-admin-stats">Tâches cochées : ' +
      esc(JSON.stringify(ex.done || [])) +
      " · MAJ " +
      esc((ex.updatedAt || "").slice(0, 19).replace("T", " ")) +
      "</p>" +
      "<h3>Notes</h3>" +
      '<pre class="cex-admin-notes">' +
      esc(ex.notes || "—") +
      "</pre>" +
      "<h3>Screens <span class=\"cex-admin-stats\">(cliquer pour taille réelle)</span></h3>" +
      (imgs
        ? '<div class="cex-admin-gallery">' + imgs + "</div>"
        : '<p class="fmt-empty">Aucun screen.</p>') +
      "</article>";

    document.getElementById("cex-back").onclick = function () {
      renderList(root).catch(function (e) {
        root.innerHTML = '<p class="fmt-empty">' + esc(e.message) + "</p>";
      });
    };

    root.querySelectorAll(".cex-admin-shot").forEach(function (fig) {
      fig.addEventListener("click", function () {
        openLightbox(fig.getAttribute("data-cex-src"), fig.getAttribute("data-cex-cap"));
      });
    });
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
