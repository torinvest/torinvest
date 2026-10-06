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
    function val(sel) {
      try {
        var el = document.querySelector(sel);
        return el ? String(el.value || "").trim() : "";
      } catch (_) {
        return "";
      }
    }
    var inputs = Array.prototype.slice.call(document.querySelectorAll("input, select, textarea"));
    function byLabel(re) {
      for (var i = 0; i < inputs.length; i++) {
        var el = inputs[i];
        var id = el.id;
        var lab = id
          ? document.querySelector('label[for="' + String(id).replace(/"/g, '\\"') + '"]')
          : null;
        var wrap = el.closest("label, .form-group, .field, .mb-3, .row, div");
        var txt = (
          (lab && lab.textContent) ||
          (wrap && wrap.textContent) ||
          el.name ||
          el.placeholder ||
          ""
        ).toLowerCase();
        if (re.test(txt)) return String(el.value || "").trim();
      }
      return "";
    }
    var pair =
      byLabel(/actif|paire|symbol|instrument/) ||
      val('[name*="pair" i], [name*="symbol" i], [name*="asset" i]');
    var direction =
      byLabel(/direction|sens|side/) || val('[name*="direction" i], [name*="side" i]');
    var entry = byLabel(/entr|entry/) || val('[name*="entry" i], [name*="open" i]');
    var date =
      byLabel(/date|heure/) ||
      val('input[type="datetime-local"], input[type="date"], [name*="date" i]');
    var setup = byLabel(/setup|strat/) || val('[name*="setup" i], [name*="strategy" i]');
    return { pair: pair, direction: direction, entry: entry, date: date, setup: setup };
  }

  function cleanField(s) {
    var v = String(s || "").trim();
    if (!v) return "";
    if (/^add[_-\s]?trade$/i.test(v)) return "";
    if (/ajouter\s*un\s*trade/i.test(v)) return "";
    if (/^screens?/i.test(v) && v.length < 12) return "";
    return v;
  }

  function tradeKeyFromMeta(meta) {
    var pair = cleanField(meta.pair) || "trade";
    var direction = cleanField(meta.direction) || "na";
    var parts = [
      (meta.date || "").slice(0, 16).replace(/\s+/g, "T"),
      pair.toLowerCase(),
      direction.toLowerCase(),
      meta.entry || "0",
    ];
    var key = parts
      .join("_")
      .replace(/[^a-z0-9._+-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
    if (!key || key === "trade_na_0" || /^_*trade_na_0/.test(key)) {
      var draft = sessionStorage.getItem("forge_jts_draft");
      if (!draft) {
        draft = "draft-" + Date.now().toString(36);
        sessionStorage.setItem("forge_jts_draft", draft);
      }
      return draft;
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
    if (type === "image/jpg" || type === "image/pjpeg") return "image/jpeg";
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
    if (/\.jpe?g$/i.test(name)) return "image/jpeg";
    if (/\.png$/i.test(name)) return "image/png";
    if (/\.webp$/i.test(name)) return "image/webp";
    if (/\.gif$/i.test(name)) return "image/gif";
    if (type.indexOf("image/") === 0) return type;
    return "";
  }

  function isAllowedImageFile(file) {
    var mime = guessImageMime(file);
    if (mime === "image/jpeg" || mime === "image/png" || mime === "image/webp" || mime === "image/gif") {
      return true;
    }
    var name = String((file && file.name) || "").toLowerCase();
    if (/\.(jpe?g|png|webp|gif)$/i.test(name)) return true;
    if (!name && file && file.type && String(file.type).indexOf("image/") === 0) return true;
    return false;
  }

  function readFileAsDataUrl(file, mime) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var result = String(reader.result || "");
        if (
          !/^data:image\//i.test(result) &&
          !/^data:application\/octet-stream;base64,/i.test(result)
        ) {
          reject(new Error("Lecture image impossible"));
          return;
        }
        if (mime) {
          result = result.replace(/^data:[^;]+;base64,/i, "data:" + mime + ";base64,");
        }
        resolve(result);
      };
      reader.onerror = function () {
        reject(new Error("Lecture fichier impossible"));
      };
      reader.readAsDataURL(file);
    });
  }

  function compressImageFile(file) {
    return new Promise(function (resolve, reject) {
      var mime = guessImageMime(file) || "image/jpeg";
      if (!isAllowedImageFile(file)) {
        reject(new Error("Fichier JPG ou PNG requis (.jpg / .jpeg / .png)"));
        return;
      }
      if (file.size && file.size <= 2.8 * 1024 * 1024) {
        readFileAsDataUrl(file, mime).then(resolve).catch(reject);
        return;
      }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        try {
          var maxSide = 1600;
          var w = img.naturalWidth || img.width;
          var h = img.naturalHeight || img.height;
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
          var dataUrl = keepPng
            ? canvas.toDataURL("image/png")
            : canvas.toDataURL("image/jpeg", 0.82);
          if (dataUrl.length > 700000) {
            dataUrl = keepPng
              ? canvas.toDataURL("image/jpeg", 0.7)
              : canvas.toDataURL("image/jpeg", 0.62);
          }
          URL.revokeObjectURL(url);
          resolve(dataUrl);
        } catch (e) {
          URL.revokeObjectURL(url);
          reject(e);
        }
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        readFileAsDataUrl(file, mime).then(resolve).catch(function () {
          reject(new Error("Lecture image impossible (JPG/PNG)"));
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
    var tradeKey = tradeKeyFromMeta(meta);
    panel.dataset.tradeKey = tradeKey;
    var status = panel.querySelector(".jts-status");
    var gal = panel.querySelector(".jts-gallery");
    try {
      var data = await api("/api/journal-trade-screens/" + encodeURIComponent(tradeKey));
      renderGallery(gal, tradeKey, (data.trade && data.trade.images) || []);
      if (status) {
        status.className = "jts-status";
        status.textContent =
          "Clé trade : " +
          tradeKey +
          (meta.pair ? " · " + meta.pair : "") +
          (meta.direction ? " · " + meta.direction : "");
      }
    } catch (err) {
      if (status) {
        status.className = "jts-status is-error";
        status.textContent = err.message || String(err);
      }
    }
  }

  async function uploadFiles(panel, files) {
    var list = Array.prototype.slice.call(files || []).filter(isAllowedImageFile);
    if (!list.length) {
      throw new Error("Choisis un fichier JPG ou PNG");
    }
    var status = panel.querySelector(".jts-status");
    var meta = readFormMeta();
    meta.pair = cleanField(meta.pair);
    meta.direction = cleanField(meta.direction);
    var tradeKey = tradeKeyFromMeta(meta);
    panel.dataset.tradeKey = tradeKey;
    for (var i = 0; i < list.length; i++) {
      if (status) {
        status.className = "jts-status";
        status.textContent = "Envoi screen " + (i + 1) + "/" + list.length + "…";
      }
      var dataUrl = await compressImageFile(list[i]);
      await api("/api/journal-trade-screens/" + encodeURIComponent(tradeKey) + "/images", {
        method: "POST",
        body: JSON.stringify({
          dataUrl: dataUrl,
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
