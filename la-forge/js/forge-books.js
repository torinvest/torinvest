/**
 * Bibliothèque La Forge — liste TOUS les PDF du VPS + ouverture Premium.
 * Source : GET /api/books/list (dossier /var/lib/torinvest/books).
 * books-data.js enrichit titre / auteur / thèmes si le fichier est connu.
 */
(function () {
  "use strict";

  var allBooks = [];

  function isPremium(me) {
    if (!me) return false;
    if (me.subscribed === true || me.subscribed === 1 || me.subscribed === "true") {
      return true;
    }
    var plan = String(me.plan || "").toLowerCase();
    return plan === "premium" || plan === "subscribed";
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function topicPills(topics) {
    return (topics || [])
      .map(function (t) {
        return '<span class="book-tag">' + escapeHtml(t) + "</span>";
      })
      .join("");
  }

  function metaByFile() {
    var map = {};
    var known = typeof getForgeBooks === "function" ? getForgeBooks() : [];
    for (var i = 0; i < known.length; i++) {
      var b = known[i];
      if (b && b.file) map[String(b.file).toLowerCase()] = b;
    }
    return map;
  }

  function titleFromFile(name) {
    var base = String(name || "").replace(/\.pdf$/i, "");
    base = base.replace(/^\d+-/, "");
    base = base.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
    base = base.replace(/\s*\(\s*1\s*\)\s*$/i, "");
    base = base.replace(/LibA-ralisme/gi, "Libéralisme");
    base = base.replace(/Sou-Vera-Ins/gi, "Souverains");
    return base || name;
  }

  function dedupeFiles(files) {
    var set = {};
    (files || []).forEach(function (f) {
      set[String(f)] = true;
    });
    return (files || []).filter(function (f) {
      var name = String(f);
      var m = name.match(/^(.*) \((\d+)\)(\.pdf)$/i);
      if (!m) return true;
      return !set[m[1] + m[3]];
    });
  }

  function booksFromFiles(files) {
    var meta = metaByFile();
    return dedupeFiles(files)
      .map(function (file) {
        var hit = meta[String(file).toLowerCase()];
        if (hit) {
          return {
            id: hit.id || file,
            file: file,
            title: hit.title || titleFromFile(file),
            author: hit.author || "—",
            topics: hit.topics || [],
          };
        }
        return {
          id: file,
          file: file,
          title: titleFromFile(file),
          author: "—",
          topics: [],
        };
      })
      .sort(function (a, b) {
        return String(a.title).localeCompare(String(b.title), "fr", {
          sensitivity: "base",
        });
      });
  }

  function renderBooks(list, premium) {
    var root = document.getElementById("books-list");
    if (!root) return;
    if (!list || !list.length) {
      root.innerHTML =
        '<p class="books-empty">Aucun PDF trouvé. Dépose les fichiers dans /var/lib/torinvest/books sur le VPS.</p>';
      return;
    }

    root.innerHTML = list
      .map(function (b) {
        var url =
          typeof forgeBookFileUrl === "function"
            ? forgeBookFileUrl(b)
            : "/api/books/file?name=" + encodeURIComponent(b.file);
        var openBtn = premium
          ? '<a class="btn btn-primary" href="' +
            escapeHtml(url) +
            '" target="_blank" rel="noopener">Ouvrir le PDF</a>'
          : '<button type="button" class="btn btn-secondary" disabled>Premium requis</button>';
        return (
          '<article class="book-card" data-book-file="' +
          escapeHtml(b.file) +
          '">' +
          '<div class="book-card-body">' +
          "<h3>" +
          escapeHtml(b.title) +
          "</h3>" +
          '<p class="book-author">' +
          escapeHtml(b.author || "—") +
          "</p>" +
          (b.topics && b.topics.length
            ? '<div class="book-tags">' + topicPills(b.topics) + "</div>"
            : "") +
          "</div>" +
          '<div class="book-card-actions">' +
          openBtn +
          "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  function applyFilter(q) {
    var needle = String(q || "")
      .trim()
      .toLowerCase();
    if (!needle) return allBooks.slice();
    return allBooks.filter(function (b) {
      var hay = [b.title, b.author, (b.topics || []).join(" "), b.file]
        .join(" ")
        .toLowerCase();
      return hay.indexOf(needle) !== -1;
    });
  }

  async function loadCatalog() {
    try {
      var r = await fetch("/api/books/list", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      var data = await r.json().catch(function () {
        return {};
      });
      if (r.ok && data && Array.isArray(data.files)) {
        return booksFromFiles(data.files);
      }
    } catch (_) {
      /* fallback */
    }
    if (typeof getForgeBooks === "function") return getForgeBooks();
    return [];
  }

  async function boot() {
    var me = null;
    if (typeof initForgeGate === "function") {
      me = await initForgeGate({ requireLogin: true, requirePremium: false });
    } else if (typeof getMe === "function") {
      me = await getMe();
    }

    var premium = isPremium(me);
    var locked = document.getElementById("books-locked");
    var countEl = document.getElementById("books-count");
    var search = document.getElementById("books-search");
    var root = document.getElementById("books-list");

    if (locked) locked.hidden = !!premium;
    if (root) {
      root.innerHTML = '<p class="books-empty">Chargement de la bibliothèque…</p>';
    }

    allBooks = await loadCatalog();
    if (countEl) countEl.textContent = String(allBooks.length);

    function refresh() {
      renderBooks(applyFilter(search ? search.value : ""), premium);
    }

    if (search) search.addEventListener("input", refresh);
    refresh();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
