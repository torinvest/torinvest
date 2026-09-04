/**
 * Bibliothèque La Forge — liste + ouverture PDF (Premium).
 */
(function () {
  "use strict";

  function isPremium(me) {
    if (!me) return false;
    if (me.subscribed === true || me.subscribed === 1 || me.subscribed === "true") return true;
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

  function renderBooks(list, premium) {
    var root = document.getElementById("books-list");
    if (!root) return;
    if (!list || !list.length) {
      root.innerHTML = '<p class="books-empty">Aucun ouvrage dans le catalogue.</p>';
      return;
    }

    root.innerHTML = list
      .map(function (b) {
        var url = typeof forgeBookFileUrl === "function" ? forgeBookFileUrl(b) : "#";
        var openBtn = premium
          ? '<a class="btn btn-primary" href="' +
            escapeHtml(url) +
            '" target="_blank" rel="noopener">Ouvrir le PDF</a>'
          : '<button type="button" class="btn btn-secondary" disabled>Premium requis</button>';
        return (
          '<article class="book-card" data-book-id="' +
          escapeHtml(b.id) +
          '">' +
          '<div class="book-card-body">' +
          "<h3>" +
          escapeHtml(b.title) +
          "</h3>" +
          '<p class="book-author">' +
          escapeHtml(b.author || "—") +
          "</p>" +
          '<div class="book-tags">' +
          topicPills(b.topics) +
          "</div>" +
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
    var books = typeof getForgeBooks === "function" ? getForgeBooks() : [];
    var needle = String(q || "")
      .trim()
      .toLowerCase();
    if (!needle) return books;
    return books.filter(function (b) {
      var hay = [b.title, b.author, (b.topics || []).join(" "), b.file]
        .join(" ")
        .toLowerCase();
      return hay.indexOf(needle) !== -1;
    });
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

    if (locked) locked.hidden = !!premium;
    if (countEl && typeof getForgeBooks === "function") {
      countEl.textContent = String(getForgeBooks().length);
    }

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
