/**
 * Injection UI — Screenshots JPG/PNG dans Trading Journal Pro (iframe /journal-embed/).
 * Sidebar « Screens trades » + zone upload sur « Ajouter un trade ».
 */
(function () {
  "use strict";
  if (window.__forgeJournalTradeScreens) return;
  window.__forgeJournalTradeScreens = 1;

  var STYLE_ID = "forge-jts-style";
  var PANEL_ID = "forge-jts-panel";
  var NAV_ID = "forge-jts-nav";
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
      "#forge-jts-panel .jts-shot button{position:absolute;top:6px;right:6px;font-size:.7rem;padding:.2rem .4rem;border-radius:6px;border:0;background:rgba(0,0,0,.7);color:#fff;cursor:pointer}" +
      "#forge-jts-panel .jts-status{font-size:.8rem;color:var(--text2,#718096);min-height:1.2em}" +
      "#forge-jts-panel .jts-status.is-error{color:#c53030}" +
      "#forge-jts-panel .jts-status.is-ok{color:#276749}" +
      "#forge-jts-drawer{position:fixed;inset:0;z-index:2147483000;display:none;background:rgba(0,0,0,.45)}" +
      "#forge-jts-drawer.open{display:block}" +
      "#forge-jts-drawer .jts-drawer-card{position:absolute;top:0;right:0;width:min(420px,100%);height:100%;background:var(--bg2,#fff);color:var(--text,#1a202c);padding:1rem 1.1rem;overflow:auto;box-shadow:-8px 0 32px rgba(0,0,0,.25)}" +
      "#forge-jts-drawer .jts-drawer-card h2{margin:0 0 .75rem;font-size:1.1rem;color:#6366f1}" +
      "#forge-jts-drawer .jts-trade{border:1px solid var(--border,#e2e8f0);border-radius:10px;padding:.7rem;margin-bottom:.65rem}" +
      "#forge-jts-drawer .jts-trade strong{display:block;margin-bottom:.25rem}" +
      "#forge-jts-overlay{position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.92);display:none;flex-direction:column}" +
      "#forge-jts-overlay.open{display:flex}" +
      "#forge-jts-overlay .bar{display:flex;justify-content:space-between;gap:8px;padding:10px 14px;background:#111;color:#ffd700}" +
      "#forge-jts-overlay .stage{flex:1;overflow:auto;text-align:center;padding:12px}" +
      "#forge-jts-overlay img{max-width:none!important;width:auto!important;height:auto!important}";
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

  function pageText() {
    return document.body ? String(document.body.innerText || "") : "";
  }

  function isAddTradePage() {
    var qs = String(location.search || "") + String(location.hash || "");
    if (/add[_-]?trade|action=add|page=add|nouveau.?trade/i.test(qs)) return true;
    var h = document.querySelector("h1,h2,.card-title,.page-title,.content h1,.content h2");
    if (h && /ajouter\s*un\s*trade/i.test(h.textContent || "")) return true;
    var t = pageText();
    if (/ajouter\s*un\s*trade/i.test(t) && /prix\s*d['’]?entr/i.test(t)) return true;
    if (/ajouter\s*un\s*trade/i.test(t) && /direction|actif|paire/i.test(t)) return true;
    return false;
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
    var m = raw.match(/^data:([^;,]+)?(?:;[^,]*)*;base64,(.+)$/i);
    if (!m || !m[2]) return "";
    var mime = String(m[1] || preferMime || "image/jpeg")
      .toLowerCase()
      .trim();
    if (mime === "image/jpg" || mime === "image/pjpeg" || mime === "image/x-jpeg" || mime === "image/jfif") {
      mime = "image/jpeg";
    }
    if (mime === "image/x-png") mime = "image/png";
    if (mime === "application/octet-stream" || mime === "binary/octet-stream" || !mime) {
      mime = preferMime === "image/png" ? "image/png" : "image/jpeg";
    }
    if (mime !== "image/jpeg" && mime !== "image/png" && mime !== "image/webp" && mime !== "image/gif") {
      mime = preferMime === "image/png" ? "image/png" : "image/jpeg";
    }
    var b64 = m[2].replace(/[^A-Za-z0-9+/=]/g, "");
    if (b64.length < 16) return "";
    return "data:" + mime + ";base64," + b64;
  }

  function readFileAsDataUrl(file, mime) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var normalized = normalizeDataUrl(reader.result, mime || "image/jpeg");
        if (!normalized) {
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

  function openOverlay(src) {
    var ov = document.getElementById("forge-jts-overlay");
    if (!ov) {
      ov = document.createElement("div");
      ov.id = "forge-jts-overlay";
      ov.innerHTML =
        '<div class="bar"><span>Screen trade — taille réelle</span><span><a id="forge-jts-ov-open" target="_blank" rel="noopener" style="color:#ffd700;margin-right:12px">Onglet</a><button type="button" id="forge-jts-ov-close" style="cursor:pointer">Fermer</button></span></div><div class="stage"><img id="forge-jts-ov-img" alt="" /></div>';
      document.documentElement.appendChild(ov);
      ov.querySelector("#forge-jts-ov-close").onclick = function () {
        ov.classList.remove("open");
      };
    }
    ov.querySelector("#forge-jts-ov-img").src = src;
    ov.querySelector("#forge-jts-ov-open").href = src;
    ov.classList.add("open");
  }

  function renderGallery(root, tradeKey, images) {
    if (!images || !images.length) {
      root.innerHTML = '<p class="jts-hint">Aucun screen pour ce trade.</p>';
      return;
    }
    root.innerHTML = images
      .map(function (img) {
        var src = mediaUrl(tradeKey, img.file);
        return (
          '<figure class="jts-shot" data-src="' +
          esc(src) +
          '"><img src="' +
          esc(src) +
          '" alt="" loading="lazy" /><button type="button" data-del="' +
          esc(img.id) +
          '">Retirer</button></figure>'
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
      var dataUrl;
      try {
        dataUrl = await compressImageFile(file);
      } catch (compErr) {
        dataUrl = await readFileAsDataUrl(file, prefer === "image/png" ? "image/png" : "image/jpeg");
      }
      dataUrl = normalizeDataUrl(dataUrl, prefer === "image/png" ? "image/png" : "image/jpeg");
      if (!dataUrl || !/^data:image\/(jpeg|png|webp|gif);base64,/i.test(dataUrl)) {
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
    var form = document.querySelector("form");
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

  function mountAddTradePanel() {
    if (!isAddTradePage()) {
      var existing = document.getElementById(PANEL_ID);
      if (existing && !isAddTradePage()) existing.remove();
      return;
    }
    if (document.getElementById(PANEL_ID)) return;

    var anchor = findInsertAnchor();
    if (!anchor.parent) return;

    var panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.innerHTML =
      "<h3>Screenshots du trade (JPG / PNG)</h3>" +
      '<p class="jts-hint">Dépose tes screens TradingView / exécution ici. Ils restent liés à ce trade sur ton compte Premium.</p>' +
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

    if (anchor.before && anchor.before.parentElement) {
      anchor.before.parentElement.insertBefore(panel, anchor.before);
    } else if (anchor.after) {
      anchor.after.insertAdjacentElement("afterend", panel);
    } else {
      anchor.parent.appendChild(panel);
    }

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
      var tradeKey = panel.dataset.tradeKey;
      if (!tradeKey) return;
      if (!confirm("Retirer ce screen ?")) return;
      try {
        await api(
          "/api/journal-trade-screens/" +
            encodeURIComponent(tradeKey) +
            "/images/" +
            encodeURIComponent(btn.getAttribute("data-del")),
          { method: "DELETE" }
        );
        await refreshPanel(panel);
      } catch (err) {
        alert(err.message || String(err));
      }
    });

    document.addEventListener(
      "change",
      function () {
        if (document.getElementById(PANEL_ID)) refreshPanel(panel);
      },
      true
    );

    refreshPanel(panel);
  }

  async function openDrawer() {
    var drawer = document.getElementById("forge-jts-drawer");
    if (!drawer) {
      drawer = document.createElement("div");
      drawer.id = "forge-jts-drawer";
      drawer.innerHTML =
        '<div class="jts-drawer-card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem"><h2>Screens des trades</h2><button type="button" id="forge-jts-drawer-close" class="jts-btn secondary">Fermer</button></div><div id="forge-jts-drawer-list"><p class="jts-hint">Chargement…</p></div></div>';
      document.documentElement.appendChild(drawer);
      drawer.addEventListener("click", function (ev) {
        if (ev.target === drawer) drawer.classList.remove("open");
      });
      drawer.querySelector("#forge-jts-drawer-close").onclick = function () {
        drawer.classList.remove("open");
      };
    }
    drawer.classList.add("open");
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
            .slice(0, 4)
            .map(function (img) {
              var src = mediaUrl(t.tradeKey, img.file);
              return (
                '<a href="' +
                esc(src) +
                '" target="_blank" rel="noopener" style="display:inline-block;width:64px;margin:2px"><img src="' +
                esc(src) +
                '" alt="" style="width:100%;border-radius:6px" /></a>'
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
    } catch (err) {
      list.innerHTML = '<p class="jts-hint">' + esc(err.message || err) + "</p>";
    }
  }

  function mountNav() {
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

  function boot() {
    try {
      ensureStyles();
      mountNav();
      mountAddTradePanel();
    } catch (e) {
      console.warn("[forge-jts]", e);
    }
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
  if (typeof MutationObserver !== "undefined" && document.documentElement) {
    var obsTimer = null;
    var obs = new MutationObserver(function () {
      if (obsTimer) clearTimeout(obsTimer);
      obsTimer = setTimeout(boot, 120);
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }
  window.addEventListener("hashchange", boot);
  window.addEventListener("popstate", boot);
})();
