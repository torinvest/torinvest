/**
 * Admin — notes & screens exercices chart.
 * Agrandir = lien direct (nouvel onglet) + overlay optionnel — sans dépendre du cache JS.
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
      intro: "0 — Le métier de trader",
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

  /** Overlay plein écran — styles inline pour battre le CSS ambient / cache. */
  function showOverlay(src, caption) {
    var old = document.getElementById("cex-screen-overlay");
    if (old) old.remove();

    var wrap = document.createElement("div");
    wrap.id = "cex-screen-overlay";
    wrap.setAttribute(
      "style",
      "position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.94);" +
        "display:flex;flex-direction:column;padding:0;margin:0;"
    );

    var bar = document.createElement("div");
    bar.setAttribute(
      "style",
      "flex:0 0 auto;display:flex;gap:12px;align-items:center;justify-content:space-between;" +
        "padding:12px 16px;background:#111;border-bottom:1px solid rgba(255,215,0,.35);color:#ffd700;font:14px/1.4 sans-serif;"
    );
    bar.innerHTML =
      "<span></span><span style='display:flex;gap:8px;flex-wrap:wrap'></span>";
    bar.querySelector("span").textContent = caption || "Screen — taille réelle";
    var actions = bar.querySelectorAll("span")[1];

    var openTab = document.createElement("a");
    openTab.href = src;
    openTab.target = "_blank";
    openTab.rel = "noopener";
    openTab.textContent = "Ouvrir dans un onglet";
    openTab.setAttribute(
      "style",
      "display:inline-block;padding:8px 12px;background:#ffd700;color:#111;text-decoration:none;border-radius:6px;font-weight:700;"
    );

    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.textContent = "Fermer";
    closeBtn.setAttribute(
      "style",
      "padding:8px 12px;background:#333;color:#fff;border:1px solid #666;border-radius:6px;cursor:pointer;"
    );
    closeBtn.onclick = function () {
      wrap.remove();
      document.body.style.overflow = "";
    };

    actions.appendChild(openTab);
    actions.appendChild(closeBtn);

    var stage = document.createElement("div");
    stage.setAttribute(
      "style",
      "flex:1;overflow:auto;padding:16px;text-align:center;-webkit-overflow-scrolling:touch;"
    );

    var img = document.createElement("img");
    img.alt = "Screen taille réelle";
    img.setAttribute(
      "style",
      "max-width:none!important;width:auto!important;height:auto!important;display:inline-block;box-shadow:0 8px 40px #000;"
    );

    var hint = document.createElement("p");
    hint.setAttribute("style", "color:#aaa;font:13px sans-serif;margin:12px 0 0;");
    hint.textContent = "Chargement…";

    img.onload = function () {
      hint.textContent =
        "Taille réelle : " + img.naturalWidth + " × " + img.naturalHeight + " px — scroll pour parcourir";
    };
    img.onerror = function () {
      hint.textContent = "Chargement image échoué — utilise « Ouvrir dans un onglet ».";
    };
    img.src = src;

    stage.appendChild(img);
    stage.appendChild(hint);
    wrap.appendChild(bar);
    wrap.appendChild(stage);

    wrap.addEventListener("click", function (ev) {
      if (ev.target === wrap) {
        wrap.remove();
        document.body.style.overflow = "";
      }
    });
    document.addEventListener(
      "keydown",
      function onEsc(ev) {
        if (ev.key === "Escape") {
          wrap.remove();
          document.body.style.overflow = "";
          document.removeEventListener("keydown", onEsc);
        }
      }
    );

    // Hors de body.forge-ambient > * si possible
    (document.documentElement || document.body).appendChild(wrap);
    document.body.style.overflow = "hidden";
  }

  if (!window.__cexOpenBound) {
    window.__cexOpenBound = true;
    document.addEventListener(
      "click",
      function (ev) {
        var el = ev.target.closest("[data-cex-open]");
        if (!el) return;
        // Si c’est un lien avec modifier (ctrl/cmd) → laisser le navigateur
        if (el.tagName === "A" && (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button === 1)) {
          return;
        }
        var src = el.getAttribute("data-cex-open") || el.getAttribute("href");
        if (!src) return;
        ev.preventDefault();
        showOverlay(src, el.getAttribute("data-cex-cap") || "");
      },
      true
    );
  }

  async function renderList(root) {
    var data = await api("/api/chart-exercises-admin");
    var items = data.items || [];
    if (!items.length) {
      root.innerHTML =
        '<p class="fmt-empty">Aucune note / screen pour le moment.</p>' +
        '<button type="button" class="btn btn-secondary" id="cex-refresh">Rafraîchir</button>';
      var b = document.getElementById("cex-refresh");
      if (b)
        b.onclick = function () {
          renderList(root).catch(function (e) {
            root.innerHTML = '<p class="fmt-empty">' + esc(e.message) + "</p>";
          });
        };
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
            esc(it.notesPreview || "(pas de texte)") +
            "</p>" +
            '<p class="cex-admin-stats">' +
            (it.imageCount || 0) +
            " screen(s) · " +
            (it.doneCount || 0) +
            " tâche(s) · " +
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
    root.querySelectorAll(".cex-open").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var card = btn.closest("[data-slug]");
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
          '<a class="cex-admin-shot-hit" href="' +
          esc(src) +
          '" target="_blank" rel="noopener" data-cex-open="' +
          esc(src) +
          '" data-cex-cap="' +
          esc(cap) +
          '" title="Agrandir">' +
          '<img src="' +
          esc(src) +
          '" alt="Screen ' +
          (idx + 1) +
          '" loading="lazy" />' +
          "</a>" +
          "<figcaption>" +
          '<a class="btn btn-primary" href="' +
          esc(src) +
          '" target="_blank" rel="noopener" data-cex-open="' +
          esc(src) +
          '" data-cex-cap="' +
          esc(cap) +
          '">Agrandir (taille réelle)</a>' +
          "</figcaption></figure>"
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
      '<p class="cex-admin-stats">Tâches : ' +
      esc(JSON.stringify(ex.done || [])) +
      " · MAJ " +
      esc((ex.updatedAt || "").slice(0, 19).replace("T", " ")) +
      "</p>" +
      "<h3>Notes</h3>" +
      '<pre class="cex-admin-notes">' +
      esc(ex.notes || "—") +
      "</pre>" +
      "<h3>Screens</h3>" +
      '<p class="cex-admin-stats">Clique <strong>Agrandir (taille réelle)</strong> — overlay ou nouvel onglet.</p>' +
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
    try {
      await renderList(root);
    } catch (err) {
      root.innerHTML =
        '<p class="fmt-empty">Erreur : ' + esc(err && err.message ? err.message : err) + "</p>";
    }
  };
})();
