/**
 * Admin — notes & screens exercices chart des élèves.
 * Libellé module clair + agrandissement taille réelle (lightbox robuste).
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

  function moduleLabel(moduleId) {
    var id = String(moduleId || "");
    if (typeof MODULES !== "undefined" && Array.isArray(MODULES)) {
      for (var i = 0; i < MODULES.length; i++) {
        if (MODULES[i] && MODULES[i].id === id) {
          var num = MODULES[i].num ? String(MODULES[i].num) + " — " : "";
          return num + (MODULES[i].title || id);
        }
      }
    }
    var FALLBACK = {
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
      for (var i = 0; i < MODULES.length; i++) {
        if (MODULES[i] && MODULES[i].id === moduleId && MODULES[i].href) {
          return MODULES[i].href;
        }
      }
    }
    return "/course/";
  }

  async function api(url) {
    var res = await fetch(url, { credentials: "same-origin" });
    var data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) throw new Error(data.error || "Erreur " + res.status);
    return data;
  }

  function ensureLightbox() {
    var box = document.getElementById("cex-lightbox");
    if (box) return box;
    box = document.createElement("div");
    box.id = "cex-lightbox";
    box.className = "cex-lightbox";
    box.setAttribute("aria-hidden", "true");
    box.innerHTML =
      '<div class="cex-lightbox-backdrop" data-cex-close="1"></div>' +
      '<div class="cex-lightbox-panel" role="dialog" aria-modal="true">' +
      '<div class="cex-lightbox-bar">' +
      '<span class="cex-lightbox-caption" id="cex-lightbox-caption"></span>' +
      '<div class="cex-lightbox-actions">' +
      '<a class="btn btn-secondary" id="cex-lightbox-open" target="_blank" rel="noopener">Ouvrir onglet</a>' +
      '<button type="button" class="btn btn-primary" data-cex-close="1">Fermer</button>' +
      "</div></div>" +
      '<div class="cex-lightbox-stage" id="cex-lightbox-stage">' +
      '<img id="cex-lightbox-img" alt="Screen élève — taille réelle" />' +
      '<p class="cex-lightbox-hint" id="cex-lightbox-hint">Chargement…</p>' +
      "</div></div>";
    document.body.appendChild(box);

    box.addEventListener("click", function (ev) {
      if (ev.target && ev.target.getAttribute && ev.target.getAttribute("data-cex-close") === "1") {
        closeLightbox();
        return;
      }
      if (ev.target && ev.target.classList && ev.target.classList.contains("cex-lightbox-backdrop")) {
        closeLightbox();
      }
    });

    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && box.classList.contains("cex-lightbox--open")) {
        closeLightbox();
      }
    });
    return box;
  }

  function openLightbox(src, caption) {
    if (!src) {
      alert("URL du screen manquante.");
      return;
    }
    var box = ensureLightbox();
    var img = document.getElementById("cex-lightbox-img");
    var cap = document.getElementById("cex-lightbox-caption");
    var link = document.getElementById("cex-lightbox-open");
    var hint = document.getElementById("cex-lightbox-hint");

    if (cap) cap.textContent = caption || "Screen — taille réelle";
    if (link) {
      link.href = src;
      link.style.display = "";
    }
    if (hint) {
      hint.hidden = false;
      hint.textContent = "Chargement du screen…";
    }

    img.onload = function () {
      if (hint) {
        hint.textContent =
          "Taille réelle : " +
          (img.naturalWidth || "?") +
          " × " +
          (img.naturalHeight || "?") +
          " px — scroll pour parcourir";
      }
    };
    img.onerror = function () {
      if (hint) {
        hint.textContent = "Impossible de charger l’image. Utilise « Ouvrir onglet ».";
      }
      // Fallback automatique
      try {
        window.open(src, "_blank", "noopener");
      } catch (_) {}
    };

    img.removeAttribute("width");
    img.removeAttribute("height");
    img.style.maxWidth = "none";
    img.style.width = "auto";
    img.style.height = "auto";
    img.src = src;

    box.classList.add("cex-lightbox--open");
    box.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    var box = document.getElementById("cex-lightbox");
    if (!box) return;
    box.classList.remove("cex-lightbox--open");
    box.setAttribute("aria-hidden", "true");
    var img = document.getElementById("cex-lightbox-img");
    if (img) {
      img.onload = null;
      img.onerror = null;
      img.removeAttribute("src");
    }
    document.body.style.overflow = "";
  }

  // Délégation globale — marche même après re-render
  if (!window.__cexZoomBound) {
    window.__cexZoomBound = true;
    document.addEventListener(
      "click",
      function (ev) {
        var btn = ev.target.closest("[data-cex-zoom]");
        if (!btn) return;
        ev.preventDefault();
        ev.stopPropagation();
        var src = btn.getAttribute("data-cex-zoom") || btn.getAttribute("href");
        var cap = btn.getAttribute("data-cex-cap") || "";
        openLightbox(src, cap);
      },
      true
    );
  }

  async function renderList(root) {
    var data = await api("/api/chart-exercises-admin");
    var items = data.items || [];
    if (!items.length) {
      root.innerHTML =
        '<div class="cex-admin-empty">' +
        '<p class="fmt-empty">Aucune note / screen synchronisé pour le moment.</p>' +
        '<button type="button" class="btn btn-secondary" id="cex-refresh">Rafraîchir</button>' +
        "</div>";
      var btn = document.getElementById("cex-refresh");
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
          var label = moduleLabel(it.moduleId);
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

    var refresh = document.getElementById("cex-refresh");
    if (refresh) {
      refresh.onclick = function () {
        renderList(root).catch(function (e) {
          root.innerHTML = '<p class="fmt-empty">' + esc(e.message) + "</p>";
        });
      };
    }

    root.querySelectorAll(".cex-open").forEach(function (openBtn) {
      openBtn.addEventListener("click", function () {
        var card = openBtn.closest("[data-slug]");
        openOne(root, card.getAttribute("data-slug"), card.getAttribute("data-mod"));
      });
    });
  }

  async function openOne(root, slug, moduleId) {
    var data = await api(
      "/api/chart-exercises-admin/" +
        encodeURIComponent(slug) +
        "/" +
        encodeURIComponent(moduleId)
    );
    var ex = data.exercise || {};
    var label = moduleLabel(moduleId);
    var href = moduleHref(moduleId);
    var imgs = (ex.images || [])
      .map(function (img, idx) {
        var src =
          "/api/chart-exercises/" +
          encodeURIComponent(moduleId) +
          "/media/" +
          encodeURIComponent(img.file) +
          "?email=" +
          encodeURIComponent(ex.email || "");
        var cap = label + " · screen " + (idx + 1);
        return (
          '<figure class="cex-admin-shot">' +
          '<button type="button" class="cex-admin-shot-hit" data-cex-zoom="' +
          esc(src) +
          '" data-cex-cap="' +
          esc(cap) +
          '" title="Agrandir en taille réelle">' +
          '<img src="' +
          esc(src) +
          '" alt="Screen ' +
          (idx + 1) +
          '" loading="lazy" />' +
          "</button>" +
          "<figcaption>" +
          esc(img.caption || "") +
          ' <button type="button" class="btn btn-primary cex-zoom-btn" data-cex-zoom="' +
          esc(src) +
          '" data-cex-cap="' +
          esc(cap) +
          '">🔍 Agrandir</button></figcaption>' +
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
      "<h3>Screens</h3>" +
      '<p class="cex-admin-stats">Clique le screen ou le bouton « Agrandir » pour la taille réelle.</p>' +
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
    var root = document.getElementById("chart-exercises-admin-root");
    if (!root) return;
    ensureLightbox();
    try {
      await renderList(root);
    } catch (err) {
      root.innerHTML =
        '<p class="fmt-empty">Erreur : ' + esc(err && err.message ? err.message : err) + "</p>";
    }
  };
})();
