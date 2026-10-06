/**
 * Injection UI — Screenshots JPG/PNG dans Trading Journal Pro (iframe /journal-embed/).
 *
 * tradeClickNuke / SAFE MODE (v11):
 * - Liste + détail/lecture : ZERO UI, ZERO styles inset:0, ZERO listeners utiles.
 * - « Ajouter un trade » : bouton opt-in « Joindre un screen » uniquement.
 * - Panel / drawer / overlay uniquement APRÈS ce clic explicite.
 * Priorité absolue : clics trade → détail lecture ne doivent jamais être bloqués.
 */
(function () {
  "use strict";
  if (window.__forgeJournalTradeScreens) return;
  window.__forgeJournalTradeScreens = 1;

  var STYLE_ID = "forge-jts-style";
  var PANEL_ID = "forge-jts-panel";
  var NAV_ID = "forge-jts-nav";
  var OPTIN_ID = "forge-jts-optin";
  var ENABLE_KEY = "forge_jts_screens_on";
  var ACCEPT =
    "image/jpeg,image/png,image/jpg,.jpg,.jpeg,.png,image/webp,image/gif,image/*";

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement("style");
    st.id = STYLE_ID;
    st.textContent =
      "#forge-jts-nav{display:flex;align-items:center;gap:.5rem;padding:.65rem .9rem;margin:.25rem .5rem;border-radius:8px;cursor:pointer;color:inherit;text-decoration:none;font-weight:600;border:1px solid transparent}" +
      "#forge-jts-nav:hover,#forge-jts-nav.active{background:rgba(99,102,241,.12);border-color:rgba(99,102,241,.35);color:#6366f1}" +
      "#forge-jts-panel{margin:1rem 0;padding:1rem;border:1px solid rgba(99,102,241,.35);border-radius:12px;background:rgba(99,102,241,.06)}" +
      "#forge-jts-panel h3{margin:0 0 .35rem;font-size:1rem;color:#6366f1}" +
      "#forge-jts-panel .jts-hint{font-size:.82rem;color:var(--text2,#718096);margin:0 0 .75rem;line-height:1.45}" +
      "#forge-jts-panel .jts-drop{margin:.5rem 0;padding:1rem;border:2px dashed rgba(99,102,241,.45);border-radius:12px;background:rgba(99,102,241,.05);text-align:center;cursor:pointer}" +
      "#forge-jts-panel .jts-drop.is-drag{border-color:#6366f1;background:rgba(99,102,241,.14)}" +
      "#forge-jts-panel .jts-drop strong{display:block;color:#6366f1;margin-bottom:.25rem}" +
      "#forge-jts-panel .jts-drop span{font-size:.82rem;color:var(--text2,#718096)}" +
      "#forge-jts-panel .jts-actions{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;margin:.5rem 0}" +
      "#forge-jts-panel .jts-btn{display:inline-flex;align-items:center;gap:.35rem;padding:.45rem .8rem;border-radius:8px;border:1px solid #6366f1;background:#6366f1;color:#fff;font-weight:600;font-size:.85rem;cursor:pointer}" +
      "#forge-jts-panel .jts-btn.secondary{background:transparent;color:#6366f1}" +
      "#forge-jts-panel .jts-gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:.65rem;margin-top:.75rem}" +
      "#forge-jts-panel .jts-shot{margin:0;border:1px solid var(--border,#e2e8f0);border-radius:10px;overflow:hidden;background:#000;position:relative}" +
      "#forge-jts-panel .jts-shot img{display:block;width:100%;height:auto;cursor:zoom-in}" +
      "#forge-jts-panel .jts-shot button,#forge-jts-drawer .jts-del{position:absolute;top:6px;right:6px;font-size:.75rem;padding:.35rem .55rem;border-radius:6px;border:0;background:#c53030;color:#fff;font-weight:700;cursor:pointer;z-index:2}" +
      "#forge-jts-drawer .jts-shot{position:relative;display:inline-block;width:72px;margin:2px}" +
      "#forge-jts-drawer .jts-shot img{width:100%;border-radius:6px;display:block}" +
      "#forge-jts-drawer .jts-del{position:absolute}" +
      "#forge-jts-panel .jts-status{font-size:.8rem;color:var(--text2,#718096);min-height:1.2em}" +
      "#forge-jts-panel .jts-status.is-error{color:#c53030}" +
      "#forge-jts-panel .jts-status.is-ok{color:#276749}" +
      "#forge-jts-drawer{position:fixed;inset:0;z-index:2147483000;display:none!important;pointer-events:none!important;visibility:hidden;background:rgba(0,0,0,.45)}" +
      "#forge-jts-drawer.open{display:block!important;pointer-events:auto!important;visibility:visible}" +
      "#forge-jts-drawer .jts-drawer-card{position:absolute;top:0;right:0;width:min(420px,100%);height:100%;background:var(--bg2,#fff);color:var(--text,#1a202c);padding:1rem 1.1rem;overflow:auto;box-shadow:-8px 0 32px rgba(0,0,0,.25);pointer-events:auto}" +
      "#forge-jts-drawer .jts-drawer-card h2{margin:0 0 .75rem;font-size:1.1rem;color:#6366f1}" +
      "#forge-jts-drawer .jts-trade{border:1px solid var(--border,#e2e8f0);border-radius:10px;padding:.7rem;margin-bottom:.65rem}" +
      "#forge-jts-drawer .jts-trade strong{display:block;margin-bottom:.25rem}" +
      "#forge-jts-overlay{position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.92);display:none!important;pointer-events:none!important;visibility:hidden;flex-direction:column}" +
      "#forge-jts-overlay.open{display:flex!important;pointer-events:auto!important;visibility:visible}" +
      "#forge-jts-overlay .bar{display:flex;justify-content:space-between;gap:8px;padding:10px 14px;background:#111;color:#ffd700}" +
      "#forge-jts-overlay .stage{flex:1;overflow:auto;text-align:center;padding:12px}" +
      "#forge-jts-overlay img{max-width:none!important;width:auto!important;height:auto!important}" +
      /* Panel stays in document flow — never cover the trade list */
      "#forge-jts-panel{position:relative;z-index:1;pointer-events:auto}" +
      "#forge-jts-nav{position:relative;z-index:1}";
    document.head.appendChild(st);
  }

  function findSidebar() {
    var links = Array.prototype.slice.call(
      document.querySelectorAll("a, button, [role='link'], .nav-link, .menu-item, li")
    );
    var addLink = links.find(function (el) {
      return /ajouter\s*un\s*trade/i.test(el.textContent || "");
    });
    if (addLink) {
      var parent =
        addLink.closest("ul, nav, aside, .sidebar, #sidebar, .menu, .nav") ||
        addLink.parentElement;
      if (parent) return parent;
    }
    var dash = links.find(function (el) {
      return /^dashboard$/i.test(String(el.textContent || "").trim());
    });
    if (dash) {
      return (
        dash.closest("ul, nav, aside, .sidebar, #sidebar, .menu, .nav") ||
        dash.parentElement
      );
    }
    return document.querySelector("aside, nav.sidebar, .sidebar, #sidebar, .side-nav");
  }

  function mainContentRoot() {
    // Prefer real content roots — NEVER bare .card/.container (too common in sidebars/widgets)
    return (
      document.querySelector(
        "main, #content, .main-content, .page-content, #main, .content-area, .tj-content"
      ) ||
      document.querySelector(".content") ||
      document.body
    );
  }

  function isVisibleField(el) {
    if (!el) return false;
    var tag = String(el.tagName || "").toLowerCase();
    if (tag !== "input" && tag !== "select" && tag !== "textarea") return false;
    var type = String(el.type || "text").toLowerCase();
    if (
      type === "hidden" ||
      type === "submit" ||
      type === "button" ||
      type === "reset" ||
      type === "file" ||
      type === "image" ||
      type === "checkbox" ||
      type === "radio"
    ) {
      return false;
    }
    if (el.disabled) return false;
    return true;
  }

  function nearFieldLabel(el) {
    if (!el) return "";
    var id = el.id ? String(el.id) : "";
    var bits = [];
    if (id) {
      try {
        var labEl = document.querySelector(
          'label[for="' + id.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"]'
        );
        if (labEl) bits.push(String(labEl.textContent || ""));
      } catch (_) {}
    }
    var parentLab = el.closest && el.closest("label");
    if (parentLab) bits.push(String(parentLab.textContent || "").slice(0, 80));
    var group = el.closest && el.closest(".form-group, .field, .mb-3, .form-floating, td, tr, div");
    if (group) {
      var gl = group.querySelector("label, .form-label, .label, legend");
      if (gl) bits.push(String(gl.textContent || "").slice(0, 80));
    }
    bits.push(el.getAttribute && el.getAttribute("aria-label"));
    bits.push(el.placeholder);
    bits.push(el.name);
    bits.push(id);
    return bits
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  /** True if form has a real editable entry-price control (not a table header). */
  function formHasEntryField(form) {
    if (!form) return false;
    var nodes = form.querySelectorAll("input, select, textarea");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!isVisibleField(el)) continue;
      var hint = nearFieldLabel(el);
      if (!hint || hint.length > 100) continue;
      if (/prix\s*d['’]?entr|entry\s*price|entr[ée]e|entry.?price|open.?price|prix.?entr/i.test(hint)) {
        return true;
      }
      var name = String(el.name || el.id || "").toLowerCase();
      if (/^(entr[eyi]|entry|open.?price|prix.?entr)/i.test(name)) return true;
    }
    return false;
  }

  function formHasDirectionOrAssetField(form) {
    if (!form) return false;
    var nodes = form.querySelectorAll("input, select, textarea");
    var hasDir = false;
    var hasAsset = false;
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!isVisibleField(el)) continue;
      var hint = nearFieldLabel(el);
      var name = String(el.name || el.id || "").toLowerCase();
      if (
        /^(direction|sens|side|long.?short)/i.test(name) ||
        /^\s*(direction|sens|side|long\s*\/\s*short)\b/i.test(hint)
      ) {
        hasDir = true;
      }
      if (
        /^(pair|symbol|asset|instrument|ticker|actif|paire)/i.test(name) ||
        /^\s*(actif|paire|symbol|instrument|ticker)\b/i.test(hint)
      ) {
        hasAsset = true;
      }
    }
    return hasDir || hasAsset;
  }

  /** Submit control that creates/saves a trade — not "Ajouter un screen". */
  function formHasAddSubmit(form) {
    if (!form) return false;
    var btns = form.querySelectorAll("button, input[type='submit'], input[type='button']");
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      var t = String(b.textContent || b.value || b.getAttribute("aria-label") || "")
        .replace(/\s+/g, " ")
        .trim();
      if (!t || t.length > 60) continue;
      if (/screen|screenshot|image|photo|upload|fichier/i.test(t)) continue;
      if (
        /^(ajouter|enregistr|sauvegard|créer|create|save)\b/i.test(t) ||
        /ajouter\s*(un\s*|le\s*)?trade/i.test(t) ||
        /enregistr(er)?\s*(le\s*)?trade/i.test(t) ||
        /^submit$/i.test(t)
      ) {
        return true;
      }
    }
    return false;
  }

  function hasAddTradeHeading(root) {
    var main = root || mainContentRoot();
    if (!main) return false;
    var headings = main.querySelectorAll("h1, h2, h3, .card-title, .page-title, legend");
    for (var hi = 0; hi < headings.length; hi++) {
      var ht = String(headings[hi].textContent || "").replace(/\s+/g, " ").trim();
      if (/^ajouter\s*un\s*trade$/i.test(ht) || /^nouveau\s*trade$/i.test(ht)) return true;
      if (/^créer\s*un\s*trade$/i.test(ht)) return true;
    }
    return false;
  }

  function tradeRowCount(root) {
    var el = root || document.body;
    if (!el) return 0;
    return el.querySelectorAll(
      "table tbody tr, .trade-row, [data-trade-id], .trades-list .trade, tr[data-id], tr[onclick]"
    ).length;
  }

  function hasTradeTableHeaders(root) {
    var el = root || document.body;
    if (!el) return false;
    var ths = el.querySelectorAll("table th, table thead td, .list-header, .trades-header");
    var blob = "";
    for (var i = 0; i < ths.length; i++) {
      blob += " " + String(ths[i].textContent || "");
    }
    blob = blob.replace(/\s+/g, " ").toLowerCase();
    var hits = 0;
    if (/\b(actif|paire|symbol|instrument)\b/.test(blob)) hits++;
    if (/\b(direction|sens|side|long|short)\b/.test(blob)) hits++;
    if (/\b(pnl|p\s*&\s*l|résultat|resultat|profit|perte)\b/.test(blob)) hits++;
    if (/\b(date|heure|ouvert)\b/.test(blob)) hits++;
    if (/\b(prix|entr)/.test(blob)) hits++;
    return hits >= 2;
  }

  function looksLikeTradeListPage(root) {
    var el = root || document.body;
    if (!el) return false;
    var rows = tradeRowCount(el);
    // ANY trade table with list-like headers and no create-entry inputs → list
    if (hasTradeTableHeaders(el) && rows >= 1 && !formHasEntryField(el)) return true;
    // Even a single row / empty tbody placeholder with trade headers
    if (hasTradeTableHeaders(el) && !formHasEntryField(el) && !hasAddTradeHeading(el)) return true;
    // 1+ clickable rows without entry inputs (user may have only 1–2 trades)
    if (rows >= 1 && !formHasEntryField(el) && !hasAddTradeHeading(el)) {
      if (el.querySelector("table")) return true;
    }
    var h = el.querySelector("h1, h2, .card-title, .page-title");
    var ht = h ? String(h.textContent || "").replace(/\s+/g, " ").trim() : "";
    if (/^(trades|journal|historique|mes\s*trades|dashboard|liste(\s*des)?\s*trades?)$/i.test(ht)) {
      return true;
    }
    return false;
  }

  function looksLikeTradeDetailPage(root) {
    var el = root || document.body;
    if (!el) return false;
    var qs = String((typeof location !== "undefined" && location.search) || "") +
      String((typeof location !== "undefined" && location.hash) || "");
    if (/add[_-]?trade|nouveau.?trade|action=add/i.test(qs)) return false;
    if (
      /action=(view|detail|show|read|edit)|view=(trade|detail)|trade_id=|id=\d+/i.test(qs)
    ) {
      return true;
    }
    var h = el.querySelector("h1, h2, .card-title, .page-title");
    var ht = h ? String(h.textContent || "").replace(/\s+/g, " ").trim() : "";
    if (/détail|detail|voir\s*(le\s*)?trade|lecture|trade\s*#\d+/i.test(ht)) return true;
    // Detail/read: few fields, often "Retour" / "Modifier" / "supprimer", no create submit
    var form = el.querySelector("form");
    if (form && formHasEntryField(form) && !formHasAddSubmit(form) && !hasAddTradeHeading(el)) {
      var pageTxt = String(el.innerText || el.textContent || "").slice(0, 2000);
      if (/retour|back to|modifier|supprimer|delete|edit/i.test(pageTxt) && tradeRowCount(el) < 2) {
        return true;
      }
    }
    return false;
  }

  /** Submit that clearly creates (Ajouter…) — stronger than generic Enregistrer/Save. */
  function formHasAjouterSubmit(form) {
    if (!form) return false;
    var btns = form.querySelectorAll("button, input[type='submit'], input[type='button']");
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      var t = String(b.textContent || b.value || b.getAttribute("aria-label") || "")
        .replace(/\s+/g, " ")
        .trim();
      if (!t || t.length > 60) continue;
      if (/screen|screenshot|image|photo|upload|fichier/i.test(t)) continue;
      if (/ajouter/i.test(t)) return true;
    }
    return false;
  }

  /**
   * DEFAULT OFF. True ONLY when the real create-trade FORM is present:
   * editable entry + direction/asset controls + submit Ajouter/Enregistrer.
   * NEVER true on list or detail/read from sidebar text or column headers alone.
   * URL hints alone are NOT enough (#180 gap).
   */
  function isAddTradePage() {
    try {
      if (looksLikeTradeListPage(document.body)) return false;
      if (looksLikeTradeDetailPage(document.body)) return false;

      var form = findAddTradeForm();
      if (!form) return false;

      // Hard requirements — real controls, not label/table text
      if (!formHasEntryField(form)) return false;
      if (!formHasDirectionOrAssetField(form)) return false;
      if (!formHasAddSubmit(form)) return false;

      // Form must not be a page-wide wrapper that also contains the trade list
      if (tradeRowCount(form) >= 2) return false;
      if (hasTradeTableHeaders(form) && tradeRowCount(form) >= 1) return false;

      // Positive identity: heading, Ajouter button, or add_trade URL — not Enregistrer alone
      // (edit/detail pages often share Enregistrer + same fields)
      var qs =
        String((typeof location !== "undefined" && location.search) || "") +
        String((typeof location !== "undefined" && location.hash) || "");
      var urlHint = /add[_-]?trade|nouveau.?trade|(?:[?&#])action=add\b/i.test(qs);
      if (hasAddTradeHeading() || formHasAjouterSubmit(form) || urlHint) return true;
      return false;
    } catch (_) {
      return false;
    }
  }

  function findAddTradeForm() {
    var forms = document.querySelectorAll("form");
    var best = null;
    var bestScore = Infinity;
    for (var i = 0; i < forms.length; i++) {
      var f = forms[i];
      if (!formHasEntryField(f)) continue;
      if (!formHasDirectionOrAssetField(f)) continue;
      // Skip giant wrappers that include the trades table
      if (tradeRowCount(f) >= 2) continue;
      var score = String(f.innerHTML || "").length;
      if (score < bestScore) {
        bestScore = score;
        best = f;
      }
    }
    if (best) return best;
    // Last resort: titled page + any form with entry field (still need controls)
    if (hasAddTradeHeading()) {
      for (var j = 0; j < forms.length; j++) {
        if (formHasEntryField(forms[j])) return forms[j];
      }
    }
    return null;
  }

  /** URL hard-kill: list / detail / dashboard — never mount screens chrome. */
  function urlLooksLikeListOrDetail() {
    try {
      var qs =
        String((typeof location !== "undefined" && location.search) || "") +
        String((typeof location !== "undefined" && location.hash) || "");
      if (/add[_-]?trade|nouveau.?trade|(?:[?&#])action=add\b/i.test(qs)) {
        return false;
      }
      if (
        /(?:[?&#])action=(view|detail|show|read|edit|list|dashboard|home|trades)\b/i.test(
          qs
        ) ||
        /(?:[?&#])view=(trade|detail|list|dashboard)\b/i.test(qs) ||
        /(?:[?&#])(?:trade_id|id)=\d+/i.test(qs) ||
        /(?:[?&#])page=(list|trades|dashboard|home|detail|view)\b/i.test(qs)
      ) {
        return true;
      }
      // Empty / bare embed URL is almost always the trade list / dashboard
      if (!qs || qs === "?" || qs === "#" || qs === "?#" ) {
        return true;
      }
      return false;
    } catch (_) {
      return true;
    }
  }

  /**
   * Absolute off-switch: anything that is not unambiguously the create form.
   * Used by SAFE MODE boot — prefer false negatives (missed screens) over
   * blocking trade-row clicks.
   */
  function shouldStayCompletelyOff() {
    try {
      if (urlLooksLikeListOrDetail() && !isAddTradePage()) return true;
      if (looksLikeTradeListPage(document.body)) return true;
      if (looksLikeTradeDetailPage(document.body)) return true;
      if (!isAddTradePage()) return true;
      return false;
    } catch (_) {
      return true;
    }
  }

  function isScreensEnabled() {
    try {
      return sessionStorage.getItem(ENABLE_KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  function setScreensEnabled(on) {
    try {
      if (on) sessionStorage.setItem(ENABLE_KEY, "1");
      else sessionStorage.removeItem(ENABLE_KEY);
    } catch (_) {}
  }

  /** Strip every forge-jts node (and optional styles) so TJ clicks stay free. */
  function nukeForgeArtifacts(keepStyle, keepOptin) {
    var ids = [PANEL_ID, NAV_ID, "forge-jts-drawer", "forge-jts-overlay"];
    if (!keepOptin) ids.push(OPTIN_ID);
    if (!keepStyle) ids.push(STYLE_ID);
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }
  }

  /** Expose detectors for node/jsdom fixtures (tradeClickNuke). */
  function getDetectors() {
    return {
      isAddTradePage: isAddTradePage,
      looksLikeTradeListPage: looksLikeTradeListPage,
      looksLikeTradeDetailPage: looksLikeTradeDetailPage,
      shouldStayCompletelyOff: shouldStayCompletelyOff,
      urlLooksLikeListOrDetail: urlLooksLikeListOrDetail,
      findAddTradeForm: findAddTradeForm,
      formHasEntryField: formHasEntryField,
      formHasAddSubmit: formHasAddSubmit,
      tradeClickFix2: true,
      tradeClickNuke: true,
      safeMode: true,
    };
  }

  function readFormMeta() {
    function isFieldEl(el) {
      if (!el) return false;
      var tag = String(el.tagName || "").toLowerCase();
      if (tag !== "input" && tag !== "select" && tag !== "textarea") return false;
      var type = String(el.type || "text").toLowerCase();
      // CRITICAL: skip hidden — TJ often has action=add_trade / page=add_trade
      if (
        type === "hidden" ||
        type === "submit" ||
        type === "button" ||
        type === "reset" ||
        type === "file" ||
        type === "checkbox" ||
        type === "radio" ||
        type === "image"
      ) {
        return false;
      }
      if (el.disabled) return false;
      // readOnly OK (certains date pickers)
      return true;
    }

    function fieldValue(el) {
      if (!el) return "";
      var v = String(el.value || "").trim();
      if (v) return v;
      if (String(el.tagName || "").toLowerCase() === "select" && el.selectedIndex >= 0) {
        var opt = el.options[el.selectedIndex];
        if (opt) return String(opt.text || opt.value || "").trim();
      }
      return "";
    }

    function fieldHint(el) {
      var id = el.id ? String(el.id) : "";
      var lab = "";
      if (id) {
        try {
          var labEl = document.querySelector(
            'label[for="' + id.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"]'
          );
          if (labEl) lab = String(labEl.textContent || "");
        } catch (_) {}
      }
      var parentLab = el.closest("label");
      var group = el.closest(
        ".form-group, .field, .mb-3, .form-floating, .input-group, .row > div, .col, td, tr"
      );
      var groupLab = "";
      if (group) {
        var gl = null;
        var kids = group.children || [];
        for (var ci = 0; ci < kids.length; ci++) {
          var tag = String(kids[ci].tagName || "").toLowerCase();
          var cls = String(kids[ci].className || "");
          if (tag === "label" || tag === "legend" || /\bform-label\b|\blabel\b/.test(cls)) {
            gl = kids[ci];
            break;
          }
        }
        if (!gl) gl = group.querySelector("label, .form-label, .label, legend");
        if (gl && String(gl.textContent || "").trim().length < 60) {
          groupLab = String(gl.textContent || "");
        }
      }
      return (
        lab ||
        (parentLab ? String(parentLab.textContent || "").slice(0, 60) : "") ||
        groupLab ||
        el.getAttribute("aria-label") ||
        el.placeholder ||
        el.name ||
        id ||
        ""
      )
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
    }

    /** French TJ labels first — walk <label> then associated control. */
    function byFrenchLabel(re) {
      var labs = document.querySelectorAll("label, .form-label, .label, legend, th");
      for (var i = 0; i < labs.length; i++) {
        var lab = labs[i];
        var txt = String(lab.textContent || "")
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim();
        if (!txt || txt.length > 48) continue;
        if (!re.test(txt)) continue;
        var el = null;
        var forId = lab.getAttribute("for");
        if (forId) {
          try {
            el = document.getElementById(forId);
          } catch (_) {}
        }
        if (!el) {
          el = lab.querySelector("input, select, textarea");
        }
        if (!el) {
          var wrap = lab.closest(".form-group, .field, .mb-3, .form-floating, td, tr, div");
          if (wrap) el = wrap.querySelector("input, select, textarea");
        }
        if (!el) {
          var next = lab.nextElementSibling;
          while (next && !el) {
            if (/^(INPUT|SELECT|TEXTAREA)$/i.test(next.tagName)) el = next;
            else el = next.querySelector && next.querySelector("input, select, textarea");
            if (!el) next = next.nextElementSibling;
          }
        }
        if (el && isFieldEl(el)) {
          var v = fieldValue(el);
          if (v && !/^add[_-\s]?trade$/i.test(v)) return v;
        }
      }
      return "";
    }

    function byName(res) {
      var nodes = document.querySelectorAll("input, select, textarea");
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        if (!isFieldEl(el)) continue;
        var name = String(el.name || el.id || "").toLowerCase();
        if (/add[_-]?trade|action|page|view|tab|nav/i.test(name)) continue;
        for (var j = 0; j < res.length; j++) {
          if (res[j].test(name)) {
            var v = fieldValue(el);
            if (v && !/^add[_-\s]?trade$/i.test(v)) return v;
          }
        }
      }
      return "";
    }

    function byLabel(re) {
      var nodes = document.querySelectorAll("input, select, textarea");
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        if (!isFieldEl(el)) continue;
        var hint = fieldHint(el);
        // Ignore huge wraps that would match every field on the page
        if (!hint || hint.length > 80) continue;
        if (/ajouter\s*un\s*trade|screenshots?\s*du\s*trade/i.test(hint)) continue;
        if (re.test(hint)) {
          var v = fieldValue(el);
          if (v && !/^add[_-\s]?trade$/i.test(v)) return v;
        }
      }
      return "";
    }

    function byType(types) {
      for (var t = 0; t < types.length; t++) {
        var nodes = document.querySelectorAll('input[type="' + types[t] + '"]');
        for (var i = 0; i < nodes.length; i++) {
          var el = nodes[i];
          if (el && isFieldEl(el)) {
            var v = fieldValue(el);
            if (v) return v;
          }
        }
      }
      return "";
    }

    var pair =
      byFrenchLabel(/^(actif|paire|symbol|instrument|ticker)\b/) ||
      byName([/^(pair|symbol|asset|instrument|ticker|actif|paire)/]) ||
      byLabel(/^(?!.*entr).*(\bactif\b|\bpaire\b|\bsymbol|\binstrument|\bticker\b)/);
    var direction =
      byFrenchLabel(/^(direction|sens|side|long\s*\/\s*short)\b/) ||
      byName([/^(direction|side|sens|buy.?sell|long.?short)/]) ||
      byLabel(/^\s*(direction|sens|side|long|short)\b/);
    var entry =
      byFrenchLabel(/prix\s*d['’]?entr|entry\s*price|^(entr[ée]e)\b/) ||
      byName([/^(entr[eyi]|open.?price|prix.?entr|entry)/]) ||
      byLabel(/prix\s*d['’]?entr|entry\s*price|^\s*entr[ée]e\b/);
    var date =
      byFrenchLabel(/^(date|heure|date\s*\/\s*heure|date\s*et\s*heure)\b/) ||
      byType(["datetime-local", "date", "time"]) ||
      byName([/^(date|time|heure|datetime|opened|open_date)/]) ||
      byLabel(/^\s*(date|heure|date\s*\/\s*heure)\b/);
    var setup =
      byFrenchLabel(/^(setup|strat)/) ||
      byName([/^(setup|strat|strategy)/]) ||
      byLabel(/^\s*(setup|strat)/);
    return { pair: pair, direction: direction, entry: entry, date: date, setup: setup };
  }

  function cleanField(s) {
    var v = String(s || "").trim();
    if (!v) return "";
    if (/add[_-\s]?trade/i.test(v)) return "";
    if (/ajouter\s*un\s*trade/i.test(v)) return "";
    if (/^screens?/i.test(v) && v.length < 12) return "";
    if (/^(na|n\/a|null|undefined|none|—|-|\.|choisir|select|sélection)/i.test(v)) return "";
    return v;
  }

  function tradeKeyFromMeta(meta) {
    var pair = cleanField(meta.pair);
    var direction = cleanField(meta.direction);
    var date = cleanField(meta.date).slice(0, 16).replace(/\s+/g, "T");
    var entry = cleanField(meta.entry);
    // Need at least pair or date from the real TJ form — otherwise draft key
    if (!pair && !date) {
      var draft = sessionStorage.getItem("forge_jts_draft");
      if (!draft) {
        draft = "draft-" + Date.now().toString(36);
        sessionStorage.setItem("forge_jts_draft", draft);
      }
      return draft;
    }
    var parts = [
      date || "nodate",
      (pair || "trade").toLowerCase(),
      (direction || "na").toLowerCase(),
      entry || "0",
    ];
    var key = parts
      .join("_")
      .replace(/[^a-z0-9._+-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
    if (
      !key ||
      /add[_-]?trade/i.test(key) ||
      key === "nodate_trade_na_0" ||
      key === "trade_na_0"
    ) {
      var d2 = sessionStorage.getItem("forge_jts_draft");
      if (!d2) {
        d2 = "draft-" + Date.now().toString(36);
        sessionStorage.setItem("forge_jts_draft", d2);
      }
      return d2;
    }
    return key;
  }

  async function api(url, options) {
    var opts = Object.assign({ credentials: "same-origin" }, options || {});
    if (opts.body && typeof opts.body === "string") {
      opts.headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    }
    var res = await fetch(url, opts);
    var data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) throw new Error(data.error || "Erreur " + res.status);
    return data;
  }

  function guessImageMime(file) {
    var type = String((file && file.type) || "").toLowerCase().trim();
    if (
      type === "image/jpg" ||
      type === "image/pjpeg" ||
      type === "image/x-jpeg" ||
      type === "image/jfif"
    ) {
      return "image/jpeg";
    }
    if (type === "image/x-png") return "image/png";
    if (
      type === "image/jpeg" ||
      type === "image/png" ||
      type === "image/webp" ||
      type === "image/gif"
    ) {
      return type;
    }
    var name = String((file && file.name) || "").toLowerCase();
    if (/\.jpe?g$/i.test(name) || /\.jfif$/i.test(name)) return "image/jpeg";
    if (/\.png$/i.test(name)) return "image/png";
    if (/\.webp$/i.test(name)) return "image/webp";
    if (/\.gif$/i.test(name)) return "image/gif";
    return "";
  }

  function isAllowedImageFile(file) {
    var mime = guessImageMime(file);
    if (mime === "image/jpeg" || mime === "image/png" || mime === "image/webp" || mime === "image/gif") {
      return true;
    }
    var name = String((file && file.name) || "").toLowerCase();
    if (/\.(jpe?g|png|webp|gif|jfif)$/i.test(name)) return true;
    // Empty MIME (common on Windows / some Android) but image/* picker
    if (file && !file.type && name && /\.(jpe?g|png)$/i.test(name)) return true;
    if (file && file.type && String(file.type).indexOf("image/") === 0 && !/heic|heif|avif|svg|tiff/i.test(file.type)) {
      return true;
    }
    return false;
  }

  /** Force a clean data:image/jpeg|png;base64,… payload for the API. */
  function normalizeDataUrl(dataUrl, preferMime) {
    var raw = String(dataUrl || "").replace(/\s+/g, "");
    var idx = raw.toLowerCase().indexOf("base64,");
    if (idx < 0) return "";
    var header = raw.slice(0, idx);
    var b64 = raw.slice(idx + 7).replace(/[^A-Za-z0-9+/=]/g, "");
    if (b64.length < 16) return "";
    var mime = preferMime === "image/png" ? "image/png" : "image/jpeg";
    var hm = header.match(/^data:([^;,]+)/i);
    if (hm && hm[1]) {
      var declared = String(hm[1]).toLowerCase().trim();
      if (declared === "image/jpg" || declared === "image/pjpeg" || declared === "image/x-jpeg" || declared === "image/jfif") {
        mime = "image/jpeg";
      } else if (declared === "image/png" || declared === "image/x-png") {
        mime = "image/png";
      } else if (declared === "image/webp") mime = "image/webp";
      else if (declared === "image/gif") mime = "image/gif";
      else if (declared === "image/jpeg") mime = "image/jpeg";
      // octet-stream / vide / autre → preferMime (jpeg par défaut)
    }
    return "data:" + mime + ";base64," + b64;
  }

  function readFileAsDataUrl(file, mime) {
    return new Promise(function (resolve, reject) {
      if (!file) {
        reject(new Error("Aucun fichier"));
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        var normalized = normalizeDataUrl(reader.result, mime || guessImageMime(file) || "image/jpeg");
        if (!normalized) {
          // Dernier recours : ArrayBuffer → base64 manuel
          try {
            var ab = reader.result;
            if (ab && typeof ab === "string" && ab.indexOf(",") >= 0) {
              var only = ab.split(",")[1] || "";
              only = only.replace(/[^A-Za-z0-9+/=]/g, "");
              if (only.length >= 16) {
                resolve(
                  "data:" +
                    (mime || guessImageMime(file) || "image/jpeg") +
                    ";base64," +
                    only
                );
                return;
              }
            }
          } catch (_) {}
          reject(new Error("Lecture image impossible"));
          return;
        }
        resolve(normalized);
      };
      reader.onerror = function () {
        reject(new Error("Lecture fichier impossible"));
      };
      reader.readAsDataURL(file);
    });
  }

  function canvasToCleanDataUrl(canvas, keepPng) {
    var dataUrl = keepPng
      ? canvas.toDataURL("image/png")
      : canvas.toDataURL("image/jpeg", 0.82);
    if (!dataUrl || dataUrl.length < 32 || dataUrl.indexOf("base64,") < 0) {
      throw new Error("Conversion canvas échouée");
    }
    if (dataUrl.length > 700000) {
      dataUrl = canvas.toDataURL("image/jpeg", 0.62);
    }
    if (dataUrl.length > 900000) {
      dataUrl = canvas.toDataURL("image/jpeg", 0.48);
    }
    var out = normalizeDataUrl(dataUrl, keepPng ? "image/png" : "image/jpeg");
    if (!out) throw new Error("Normalisation dataUrl échouée");
    return out;
  }

  function compressImageFile(file) {
    return new Promise(function (resolve, reject) {
      var mime = guessImageMime(file) || "image/jpeg";
      if (!isAllowedImageFile(file)) {
        reject(new Error("Fichier JPG ou PNG requis (.jpg / .jpeg / .png)"));
        return;
      }
      // Always re-encode via canvas → guaranteed data:image/jpeg|png;base64,…
      // (FileReader alone can emit charset= / empty type / octet-stream that the API rejects.)
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        try {
          var maxSide = 1600;
          var w = img.naturalWidth || img.width;
          var h = img.naturalHeight || img.height;
          if (!w || !h) throw new Error("Image illisible");
          var scale = Math.min(1, maxSide / Math.max(w, h));
          w = Math.max(1, Math.round(w * scale));
          h = Math.max(1, Math.round(h * scale));
          var canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext("2d");
          var keepPng = mime === "image/png";
          if (!keepPng) {
            ctx.fillStyle = "#0b0f14";
            ctx.fillRect(0, 0, w, h);
          }
          ctx.drawImage(img, 0, 0, w, h);
          var dataUrl = canvasToCleanDataUrl(canvas, keepPng);
          URL.revokeObjectURL(url);
          resolve(dataUrl);
        } catch (e) {
          URL.revokeObjectURL(url);
          // Fallback: raw FileReader + normalize
          readFileAsDataUrl(file, mime === "image/png" ? "image/png" : "image/jpeg")
            .then(resolve)
            .catch(function () {
              reject(e && e.message ? e : new Error("Conversion image impossible"));
            });
        }
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        readFileAsDataUrl(file, mime === "image/png" ? "image/png" : "image/jpeg")
          .then(resolve)
          .catch(function () {
            reject(
              new Error(
                "Lecture image impossible (HEIC/Web non supporté — exporte en JPG ou PNG)"
              )
            );
          });
      };
      img.src = url;
    });
  }

  function mediaUrl(tradeKey, file) {
    return (
      "/api/journal-trade-screens/" +
      encodeURIComponent(tradeKey) +
      "/media/" +
      encodeURIComponent(file)
    );
  }

  function closeOverlay() {
    var ov = document.getElementById("forge-jts-overlay");
    // REMOVE from DOM — closed full-bleed layers must never sit above TJ rows
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
  }

  function openOverlay(src) {
    closeOverlay();
    var ov = document.createElement("div");
    ov.id = "forge-jts-overlay";
    ov.className = "open";
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-modal", "true");
    ov.setAttribute("aria-hidden", "false");
    ov.innerHTML =
      '<div class="bar"><span>Screen trade — taille réelle</span><span><a id="forge-jts-ov-open" target="_blank" rel="noopener" style="color:#ffd700;margin-right:12px">Onglet</a><button type="button" id="forge-jts-ov-close" style="cursor:pointer">Fermer</button></span></div><div class="stage"><img id="forge-jts-ov-img" alt="" /></div>';
    document.documentElement.appendChild(ov);
    ov.querySelector("#forge-jts-ov-close").onclick = function (ev) {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      closeOverlay();
    };
    // Click on dark backdrop (not the image) closes — never trap TJ forever
    ov.addEventListener("click", function (ev) {
      if (ev.target === ov || (ev.target && ev.target.classList && ev.target.classList.contains("stage"))) {
        closeOverlay();
      }
    });
    ov.querySelector("#forge-jts-ov-img").src = src;
    ov.querySelector("#forge-jts-ov-open").href = src;
  }

  async function deleteScreen(tradeKey, imageId) {
    var tk = String(tradeKey || "").trim();
    var id = String(imageId || "").trim();
    if (!tk || !id) throw new Error("tradeKey / imageId manquant");
    var path =
      "/api/journal-trade-screens/" +
      encodeURIComponent(tk) +
      "/images/" +
      encodeURIComponent(id);
    try {
      return await api(path, { method: "DELETE" });
    } catch (err) {
      // Fallback POST si DELETE refusé (proxy / CDN / method override)
      try {
        return await api(path + "/delete", { method: "POST", body: "{}" });
      } catch (err2) {
        throw new Error(
          (err2 && err2.message) || (err && err.message) || "Suppression impossible"
        );
      }
    }
  }

  function renderGallery(root, tradeKey, images) {
    if (!images || !images.length) {
      root.innerHTML = '<p class="jts-hint">Aucun screen pour ce trade.</p>';
      return;
    }
    root.innerHTML = images
      .map(function (img) {
        var src = mediaUrl(tradeKey, img.file);
        var id = img.id || img.file || "";
        return (
          '<figure class="jts-shot" data-src="' +
          esc(src) +
          '"><img src="' +
          esc(src) +
          '" alt="" loading="lazy" /><button type="button" class="jts-del" data-del="' +
          esc(id) +
          '" data-trade="' +
          esc(tradeKey) +
          '" title="Supprimer ce screen">✕ Effacer</button></figure>'
        );
      })
      .join("");
    root.querySelectorAll(".jts-shot img").forEach(function (im) {
      im.addEventListener("click", function () {
        openOverlay(im.parentElement.getAttribute("data-src"));
      });
    });
  }

  async function refreshPanel(panel) {
    var meta = readFormMeta();
    meta.pair = cleanField(meta.pair);
    meta.direction = cleanField(meta.direction);
    meta.date = cleanField(meta.date);
    meta.entry = cleanField(meta.entry);
    var tradeKey = tradeKeyFromMeta(meta);
    panel.dataset.tradeKey = tradeKey;
    var status = panel.querySelector(".jts-status");
    var gal = panel.querySelector(".jts-gallery");
    try {
      var data = await api("/api/journal-trade-screens/" + encodeURIComponent(tradeKey));
      renderGallery(gal, tradeKey, (data.trade && data.trade.images) || []);
      if (status) {
        status.className = "jts-status";
        var bits = ["Clé trade : " + tradeKey];
        if (meta.pair) bits.push(meta.pair);
        if (meta.direction) bits.push(meta.direction);
        if (meta.date) bits.push(meta.date.slice(0, 16));
        if (!meta.pair && !meta.date) bits.push("(remplis Actif / Date pour lier)");
        status.textContent = bits.join(" · ");
      }
    } catch (err) {
      if (status) {
        status.className = "jts-status is-error";
        status.textContent = err.message || String(err);
      }
    }
  }

  function dataUrlParts(dataUrl) {
    var m = String(dataUrl || "").match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/i);
    if (!m) return null;
    return { mime: m[1].toLowerCase(), base64: m[2] };
  }

  async function uploadFiles(panel, files) {
    var list = Array.prototype.slice.call(files || []).filter(isAllowedImageFile);
    if (!list.length) {
      // Last chance: accept by extension even if MIME filter missed
      list = Array.prototype.slice.call(files || []).filter(function (f) {
        return /\.(jpe?g|png|jfif)$/i.test(String((f && f.name) || ""));
      });
    }
    if (!list.length) {
      throw new Error("Choisis un fichier JPG ou PNG");
    }
    var status = panel.querySelector(".jts-status");
    var meta = readFormMeta();
    meta.pair = cleanField(meta.pair);
    meta.direction = cleanField(meta.direction);
    meta.date = cleanField(meta.date);
    meta.entry = cleanField(meta.entry);
    var tradeKey = tradeKeyFromMeta(meta);
    panel.dataset.tradeKey = tradeKey;
    for (var i = 0; i < list.length; i++) {
      if (status) {
        status.className = "jts-status";
        status.textContent = "Envoi screen " + (i + 1) + "/" + list.length + "…";
      }
      var file = list[i];
      var prefer = guessImageMime(file) || "image/jpeg";
      if (prefer !== "image/png") prefer = "image/jpeg";
      var dataUrl;
      // 1) FileReader d’abord (évite CSP blob: / Image() cassé dans l’iframe TJ)
      try {
        dataUrl = await readFileAsDataUrl(file, prefer);
      } catch (readErr) {
        try {
          dataUrl = await compressImageFile(file);
        } catch (compErr) {
          throw new Error(
            "Lecture image impossible — réessaie en JPG/PNG classique (pas HEIC/Live Photo)"
          );
        }
      }
      // 2) Si trop gros, tenter compression canvas (optionnel)
      if (dataUrl && dataUrl.length > 900000) {
        try {
          dataUrl = await compressImageFile(file);
        } catch (_) {}
      }
      dataUrl = normalizeDataUrl(dataUrl, prefer);
      if (!dataUrl || dataUrl.indexOf("base64,") < 0) {
        throw new Error("Image invalide après conversion (JPG/PNG requis)");
      }
      var parts = dataUrlParts(dataUrl);
      var mimeOut = (parts && parts.mime) || (prefer === "image/png" ? "image/png" : "image/jpeg");
      var b64Out = parts ? parts.base64 : "";
      if (!b64Out) {
        var cut = dataUrl.indexOf("base64,");
        if (cut >= 0) b64Out = dataUrl.slice(cut + 7);
      }
      if (!b64Out || b64Out.length < 32) {
        throw new Error("Image invalide après conversion (JPG/PNG requis)");
      }
      // Envoi mime+base64 EN PRIORITÉ (évite dataUrl tronqué / proxy)
      await api("/api/journal-trade-screens/" + encodeURIComponent(tradeKey) + "/images", {
        method: "POST",
        body: JSON.stringify({
          mime: mimeOut,
          base64: b64Out,
          dataUrl: "data:" + mimeOut + ";base64," + b64Out,
          caption: "",
          pair: meta.pair,
          direction: meta.direction,
          tradeDate: meta.date,
          label: (meta.pair || "Trade") + (meta.direction ? " " + meta.direction : ""),
        }),
      });
    }
    if (status) {
      status.className = "jts-status is-ok";
      status.textContent = list.length + " screen(s) enregistré(s).";
    }
    await refreshPanel(panel);
  }

  function findInsertAnchor() {
    var form = findAddTradeForm() || document.querySelector("form");
    if (!form) {
      var main =
        document.querySelector("main, .content, .card, .container, #content") || document.body;
      return { parent: main, after: null, form: null };
    }
    var labels = Array.prototype.slice.call(form.querySelectorAll("label, h3, h4, legend"));
    var notesLab = labels.find(function (l) {
      return /notes|commentaire|commentaire/i.test(l.textContent || "");
    });
    if (notesLab) {
      var block = notesLab.closest(".form-group, .field, .mb-3, div") || notesLab;
      return { parent: block.parentElement || form, after: block, form: form };
    }
    var ta = form.querySelector("textarea");
    if (ta) {
      var wrap = ta.closest(".form-group, .field, .mb-3, div") || ta;
      return { parent: wrap.parentElement || form, after: wrap, form: form };
    }
    var submit = form.querySelector("button[type='submit'], .btn-primary, input[type='submit']");
    if (submit && submit.parentElement) {
      return { parent: submit.parentElement.parentElement || form, after: null, before: submit.parentElement, form: form };
    }
    return { parent: form, after: null, form: form };
  }

  function guardTradeFormSubmit(form) {
    if (!form || form.dataset.jtsSubmitGuard === "1") return;
    form.dataset.jtsSubmitGuard = "1";
    form.addEventListener(
      "submit",
      function (ev) {
        // Anti double/triple clic → 3 trades identiques
        var now = Date.now();
        var last = Number(form.dataset.jtsLastSubmit || 0);
        if (form.dataset.jtsSubmitting === "1" || now - last < 2500) {
          ev.preventDefault();
          ev.stopPropagation();
          return false;
        }
        form.dataset.jtsSubmitting = "1";
        form.dataset.jtsLastSubmit = String(now);
        setTimeout(function () {
          form.dataset.jtsSubmitting = "";
        }, 4000);
      },
      true
    );
  }

  /** Strip every full-bleed / panel artifact so list+detail clicks stay free. */
  function neutralizeNonAddPage() {
    nukeForgeArtifacts(false);
    setScreensEnabled(false);
  }

  /** SAFE MODE: tiny opt-in on add form only — no inset:0 CSS until clicked. */
  function mountOptInButton() {
    if (document.getElementById(OPTIN_ID)) return;
    if (document.getElementById(PANEL_ID)) return;
    if (!isAddTradePage()) return;
    var form = findAddTradeForm();
    if (!form || !form.parentElement) return;

    var wrap = document.createElement("div");
    wrap.id = OPTIN_ID;
    wrap.setAttribute("data-forge-jts", "optin");
    wrap.style.cssText =
      "margin:0.75rem 0;padding:0;position:relative;z-index:1;pointer-events:auto";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Joindre un screen";
    btn.setAttribute("aria-label", "Activer l'upload de screenshots JPG/PNG");
    btn.style.cssText =
      "display:inline-flex;align-items:center;gap:0.35rem;padding:0.45rem 0.85rem;" +
      "border-radius:8px;border:1px solid #6366f1;background:transparent;color:#6366f1;" +
      "font-weight:600;font-size:0.85rem;cursor:pointer";
    var hint = document.createElement("span");
    hint.style.cssText =
      "display:block;margin-top:0.35rem;font-size:0.78rem;color:#718096;line-height:1.4";
    hint.textContent =
      "Optionnel — n'active les screens qu'ici. La liste des trades reste cliquable.";
    btn.addEventListener("click", function (ev) {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      setScreensEnabled(true);
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      ensureStyles();
      mountNav();
      mountAddTradePanel();
    });
    wrap.appendChild(btn);
    wrap.appendChild(hint);
    form.insertAdjacentElement("afterend", wrap);
  }

  function mountAddTradePanel() {
    // SAFE MODE: never mount panel unless user opted in on this add form
    if (!isScreensEnabled() || !isAddTradePage()) {
      if (!isAddTradePage()) neutralizeNonAddPage();
      else {
        var existing = document.getElementById(PANEL_ID);
        if (existing) existing.remove();
        closeOverlay();
        closeDrawer();
      }
      return;
    }
    if (document.getElementById(PANEL_ID)) return;

    // Never bind to a random filter/list form — wait until the add-trade form exists
    var form = findAddTradeForm();
    if (!form) return;
    guardTradeFormSubmit(form);

    var panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.innerHTML =
      "<h3>Screenshots du trade (JPG / PNG)</h3>" +
      '<p class="jts-hint">Dépose tes screens ici <strong>après</strong> avoir enregistré le trade — ou juste avant, sans cliquer plusieurs fois sur Enregistrer.</p>' +
      '<div class="jts-drop" id="forge-jts-drop" role="button" tabindex="0" aria-label="Zone de dépôt JPG ou PNG">' +
      "<strong>Glisse tes JPG / PNG ici</strong>" +
      "<span>ou clique — plusieurs fichiers OK</span>" +
      "</div>" +
      '<div class="jts-actions">' +
      '<label class="jts-btn">+ Ajouter un screen<input type="file" id="forge-jts-file" accept="' +
      ACCEPT +
      '" multiple hidden /></label>' +
      '<button type="button" class="jts-btn secondary" id="forge-jts-refresh">Rafraîchir</button>' +
      "</div>" +
      '<p class="jts-status"></p>' +
      '<div class="jts-gallery"></div>';

    // IMPORTANT: hors du <form> TJ — sinon clics/Enter renvoyaient le trade (x3)
    if (form && form.parentElement) {
      form.insertAdjacentElement("afterend", panel);
    } else {
      var anchor = findInsertAnchor();
      if (!anchor.parent) return;
      if (anchor.before && anchor.before.parentElement) {
        anchor.before.parentElement.insertBefore(panel, anchor.before);
      } else if (anchor.after) {
        anchor.after.insertAdjacentElement("afterend", panel);
      } else {
        anchor.parent.appendChild(panel);
      }
    }

    // Enter dans le panel ne doit pas submit le form TJ.
    // CRITICAL: ne JAMAIS stopPropagation sur click (capture OU bubble) —
    // ça cassait Effacer et pouvait gêner la délégation TJ hors du panel.
    panel.addEventListener(
      "keydown",
      function (ev) {
        if (ev.key === "Enter" && ev.target && ev.target.id !== "forge-jts-drop") {
          // Allow Enter on dropzone (opens file picker); block other Enter→submit
          if (ev.target.tagName === "TEXTAREA") return;
          if (ev.target.closest && ev.target.closest("button, a, [data-del]")) return;
          ev.preventDefault();
        }
      },
      true
    );

    var fileInput = panel.querySelector("#forge-jts-file");
    var drop = panel.querySelector("#forge-jts-drop");

    panel.querySelector("#forge-jts-refresh").onclick = function () {
      refreshPanel(panel);
    };

    function pickFiles() {
      fileInput.click();
    }
    drop.addEventListener("click", pickFiles);
    drop.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        pickFiles();
      }
    });
    ["dragenter", "dragover"].forEach(function (evt) {
      drop.addEventListener(evt, function (ev) {
        ev.preventDefault();
        drop.classList.add("is-drag");
      });
    });
    ["dragleave", "drop"].forEach(function (evt) {
      drop.addEventListener(evt, function (ev) {
        ev.preventDefault();
        drop.classList.remove("is-drag");
      });
    });
    drop.addEventListener("drop", async function (ev) {
      var files = ev.dataTransfer && ev.dataTransfer.files;
      if (!files || !files.length) return;
      try {
        await uploadFiles(panel, files);
      } catch (err) {
        var status = panel.querySelector(".jts-status");
        if (status) {
          status.className = "jts-status is-error";
          status.textContent = err.message || String(err);
        }
        alert("Upload screen : " + (err.message || err));
      }
    });

    fileInput.addEventListener("change", async function (ev) {
      var files = ev.target.files;
      if (!files || !files.length) return;
      try {
        await uploadFiles(panel, files);
      } catch (err) {
        var status = panel.querySelector(".jts-status");
        if (status) {
          status.className = "jts-status is-error";
          status.textContent = err.message || String(err);
        }
        alert("Upload screen : " + (err.message || err));
      } finally {
        ev.target.value = "";
      }
    });

    panel.querySelector(".jts-gallery").addEventListener("click", async function (ev) {
      var btn = ev.target.closest("[data-del]");
      if (!btn) return;
      ev.preventDefault();
      ev.stopPropagation();
      var tradeKey = btn.getAttribute("data-trade") || panel.dataset.tradeKey;
      var imageId = btn.getAttribute("data-del");
      if (!tradeKey || !imageId) return;
      if (!confirm("Effacer ce screen définitivement ?")) return;
      btn.disabled = true;
      try {
        await deleteScreen(tradeKey, imageId);
        await refreshPanel(panel);
        var status = panel.querySelector(".jts-status");
        if (status) {
          status.className = "jts-status is-ok";
          status.textContent = "Screen effacé.";
        }
      } catch (err) {
        btn.disabled = false;
        alert("Effacer screen : " + (err.message || err));
      }
    });

    // Scope to the add-trade form only — never document capture (breaks TJ list/detail)
    if (form && form.dataset.jtsChangeBound !== "1") {
      form.dataset.jtsChangeBound = "1";
      form.addEventListener("change", function () {
        var p = document.getElementById(PANEL_ID);
        if (p) refreshPanel(p);
      });
    }

    refreshPanel(panel);
  }

  function closeDrawer() {
    var drawer = document.getElementById("forge-jts-drawer");
    // REMOVE from DOM when closed — zero full-bleed risk on trade list/detail
    if (drawer && drawer.parentNode) drawer.parentNode.removeChild(drawer);
  }

  async function openDrawer() {
    closeDrawer();
    var drawer = document.createElement("div");
    drawer.id = "forge-jts-drawer";
    drawer.className = "open";
    drawer.setAttribute("aria-hidden", "false");
    drawer.innerHTML =
      '<div class="jts-drawer-card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem"><h2>Screens des trades</h2><button type="button" id="forge-jts-drawer-close" class="jts-btn secondary">Fermer</button></div><div id="forge-jts-drawer-list"><p class="jts-hint">Chargement…</p></div></div>';
    document.documentElement.appendChild(drawer);
    drawer.addEventListener("click", function (ev) {
      if (ev.target === drawer) closeDrawer();
    });
    drawer.querySelector("#forge-jts-drawer-close").onclick = function (ev) {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      closeDrawer();
    };
    var list = drawer.querySelector("#forge-jts-drawer-list");
    try {
      var data = await api("/api/journal-trade-screens");
      var trades = (data.trades || []).filter(function (t) {
        return (t.imageCount || (t.images && t.images.length) || 0) > 0;
      });
      if (!trades.length) {
        list.innerHTML =
          '<p class="jts-hint">Aucun screen encore. Va dans <strong>Ajouter un trade</strong> et utilise la zone Screenshots JPG/PNG.</p>';
        return;
      }
      list.innerHTML = trades
        .map(function (t) {
          var thumbs = (t.images || [])
            .map(function (img) {
              var src = mediaUrl(t.tradeKey, img.file);
              var id = img.id || img.file || "";
              return (
                '<figure class="jts-shot" data-src="' +
                esc(src) +
                '"><a href="' +
                esc(src) +
                '" target="_blank" rel="noopener"><img src="' +
                esc(src) +
                '" alt="" /></a><button type="button" class="jts-del" data-del="' +
                esc(id) +
                '" data-trade="' +
                esc(t.tradeKey) +
                '" title="Supprimer ce screen">✕ Effacer</button></figure>'
              );
            })
            .join("");
          return (
            '<div class="jts-trade"><strong>' +
            esc(t.label || t.pair || t.tradeKey) +
            "</strong>" +
            '<span style="font-size:.8rem;color:#718096">' +
            esc(t.tradeDate || "") +
            (t.direction ? " · " + esc(t.direction) : "") +
            " · " +
            (t.imageCount || 0) +
            " screen(s)</span><div style=\"margin-top:.4rem\">" +
            thumbs +
            "</div></div>"
          );
        })
        .join("");
      if (!drawer.dataset.jtsDelBound) {
        drawer.dataset.jtsDelBound = "1";
        list.addEventListener("click", async function (ev) {
          var btn = ev.target.closest("[data-del]");
          if (!btn) return;
          ev.preventDefault();
          ev.stopPropagation();
          var tradeKey = btn.getAttribute("data-trade");
          var imageId = btn.getAttribute("data-del");
          if (!tradeKey || !imageId) return;
          if (!confirm("Effacer ce screen définitivement ?")) return;
          btn.disabled = true;
          try {
            await deleteScreen(tradeKey, imageId);
            openDrawer();
          } catch (err) {
            btn.disabled = false;
            alert("Effacer screen : " + (err.message || err));
          }
        });
      }
    } catch (err) {
      list.innerHTML = '<p class="jts-hint">' + esc(err.message || err) + "</p>";
    }
  }

  function mountNav() {
    // Nav only after SAFE MODE opt-in — never on list/detail
    if (!isScreensEnabled() || shouldStayCompletelyOff()) return;
    if (document.getElementById(NAV_ID)) return;
    var side = findSidebar();
    if (!side) return;
    var a = document.createElement("a");
    a.id = NAV_ID;
    a.href = "#screens-trades";
    a.textContent = "Screens trades";
    a.addEventListener("click", function (ev) {
      ev.preventDefault();
      openDrawer();
    });
    var kids = Array.prototype.slice.call(side.children);
    var after = kids.find(function (el) {
      return /ajouter\s*un\s*trade/i.test(el.textContent || "");
    });
    if (after && after.nextSibling) side.insertBefore(a, after.nextSibling);
    else if (after) after.insertAdjacentElement("afterend", a);
    else side.appendChild(a);
  }

  var bootScheduled = null;
  var bootQuietUntil = 0;
  var moInstance = null;

  function boot() {
    try {
      // Flags for deploy verification
      window.__forgeJtsTradeClickNuke = true;
      window.__forgeJtsClickFix2 = true;
      window.__forgeJtsSafeMode = true;
      window.__forgeJtsDetectors = getDetectors();

      // Nuclear: closed overlays must never sit in DOM
      var ov = document.getElementById("forge-jts-overlay");
      if (ov && !ov.classList.contains("open")) {
        if (ov.parentNode) ov.parentNode.removeChild(ov);
      }
      var dr = document.getElementById("forge-jts-drawer");
      if (dr && !dr.classList.contains("open")) {
        if (dr.parentNode) dr.parentNode.removeChild(dr);
      }

      // HARD KILL on list / detail / anything that isn't the create form
      if (shouldStayCompletelyOff()) {
        neutralizeNonAddPage();
        return;
      }

      // Add form present — SAFE MODE opt-in unless already enabled this session
      if (!isScreensEnabled()) {
        // Strip aggressive chrome but keep opt-in if already mounted (avoid MO flicker)
        nukeForgeArtifacts(false, true);
        mountOptInButton();
        return;
      }

      ensureStyles();
      mountNav();
      mountAddTradePanel();
    } catch (e) {
      console.warn("[forge-jts]", e);
      // On any error: strip everything so TJ stays usable
      try {
        neutralizeNonAddPage();
      } catch (_) {}
    }
  }

  function scheduleBoot(delay) {
    if (bootScheduled) clearTimeout(bootScheduled);
    bootScheduled = setTimeout(function () {
      bootScheduled = null;
      boot();
    }, delay || 150);
  }

  function isOurNode(node) {
    if (!node || node.nodeType !== 1) return false;
    if (
      node.id === PANEL_ID ||
      node.id === NAV_ID ||
      node.id === OPTIN_ID ||
      node.id === "forge-jts-drawer" ||
      node.id === "forge-jts-overlay" ||
      node.id === STYLE_ID
    ) {
      return true;
    }
    if (node.closest) {
      return !!(
        node.closest("#" + PANEL_ID) ||
        node.closest("#" + OPTIN_ID) ||
        node.closest("#forge-jts-drawer") ||
        node.closest("#forge-jts-overlay")
      );
    }
    return false;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // TJ Pro peut re-rendre / naviguer sans reload complet
  setTimeout(boot, 400);
  setTimeout(boot, 1200);
  setTimeout(boot, 3000);

  // Escape ferme overlay/drawer sans toucher aux clics TJ (bubble only, no capture)
  document.addEventListener(
    "keydown",
    function (ev) {
      if (ev.key !== "Escape") return;
      var ov = document.getElementById("forge-jts-overlay");
      if (ov && ov.classList.contains("open")) {
        closeOverlay();
        return;
      }
      var dr = document.getElementById("forge-jts-drawer");
      if (dr && dr.classList.contains("open")) closeDrawer();
    },
    false
  );

  if (typeof MutationObserver !== "undefined" && document.documentElement) {
    moInstance = new MutationObserver(function (mutations) {
      if (Date.now() < bootQuietUntil) return;
      var relevant = false;
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        var nodes = [];
        if (m.addedNodes && m.addedNodes.length) {
          for (var a = 0; a < m.addedNodes.length; a++) nodes.push(m.addedNodes[a]);
        }
        if (m.removedNodes && m.removedNodes.length) {
          for (var r = 0; r < m.removedNodes.length; r++) nodes.push(m.removedNodes[r]);
        }
        if (!nodes.length && m.target && !isOurNode(m.target)) {
          relevant = true;
          break;
        }
        for (var n = 0; n < nodes.length; n++) {
          if (!isOurNode(nodes[n])) {
            relevant = true;
            break;
          }
        }
        if (relevant) break;
      }
      if (!relevant) return;
      // Quiet window after our own mounts to avoid observer feedback loops
      bootQuietUntil = Date.now() + 80;
      scheduleBoot(180);
    });
    moInstance.observe(document.documentElement, { childList: true, subtree: true });
  }
  window.addEventListener("hashchange", function () {
    scheduleBoot(50);
  });
  window.addEventListener("popstate", function () {
    scheduleBoot(50);
  });
})();
