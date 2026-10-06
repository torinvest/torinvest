/**
 * La Forge — Trading Journal Pro + dépôt screens JPG/PNG SUR la même page.
 */
(function () {
  "use strict";

  var JOURNAL_APP = "/journal-embed/";
  var pendingFiles = [];
  var screensExpanded = true;

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setStatus(text, kind) {
    var el = document.getElementById("journal-status");
    if (!el) return;
    el.textContent = text || "";
    el.className =
      "alert " + (kind === "ok" ? "alert-success" : kind === "warn" ? "alert-warn" : "alert-error");
    el.hidden = !text;
  }

  function setUploadStatus(text, kind) {
    var status = document.getElementById("jts-status");
    if (!status) return;
    status.textContent = text || "";
    status.className =
      "jts-shell-status" + (kind === "error" ? " is-error" : kind === "ok" ? " is-ok" : "");
  }

  function showGate() {
    document.body.classList.remove("journal-app-open", "jts-panel-open");
    var g = document.getElementById("journal-gate");
    if (g) g.hidden = false;
    var bar = document.getElementById("journal-screens-bar");
    if (bar) bar.hidden = true;
    var wrap = document.getElementById("journal-frame-wrap");
    if (wrap) wrap.hidden = true;
  }

  function hideGate() {
    var g = document.getElementById("journal-gate");
    if (g) g.hidden = true;
  }

  function setScreensExpanded(open) {
    screensExpanded = !!open;
    var body = document.getElementById("journal-screens-body");
    var toggle = document.getElementById("jts-bar-toggle");
    if (body) body.hidden = !screensExpanded;
    if (toggle) toggle.setAttribute("aria-expanded", screensExpanded ? "true" : "false");
    document.body.classList.toggle("jts-panel-open", screensExpanded);
  }

  function showJournalWithScreens() {
    hideGate();
    document.body.classList.add("journal-app-open");
    var bar = document.getElementById("journal-screens-bar");
    if (bar) bar.hidden = false;
    setScreensExpanded(true);
    var wrap = document.getElementById("journal-frame-wrap");
    if (wrap) wrap.hidden = false;
    var frame = document.getElementById("journal-frame");
    if (frame && !frame.getAttribute("src")) frame.src = JOURNAL_APP;
    loadScreensList();
    loadAdminList();
  }

  function isPremiumMe(me) {
    if (!me) return false;
    if (me.isAdmin === true || me.role === "admin") return true;
    if (me.subscribed === true || me.subscribed === 1 || me.subscribed === "true") return true;
    var plan = String(me.plan || "").toLowerCase();
    return plan === "premium" || plan === "subscribed";
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

  function tradeKeyFromForm() {
    var pair = String(document.getElementById("jts-pair").value || "trade")
      .trim()
      .toLowerCase();
    var direction = String(document.getElementById("jts-direction").value || "na")
      .trim()
      .toLowerCase();
    var date = String(document.getElementById("jts-date").value || "")
      .trim()
      .replace(/[^0-9T:-]/g, "")
      .slice(0, 16);
    var label = String(document.getElementById("jts-label").value || "").trim();
    var base = [date || "nodate", pair || "trade", direction || "na"].join("_");
    if (label) base += "_" + label.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24);
    return base.replace(/[^a-z0-9._+-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  }

  function guessImageMime(file) {
    var type = String((file && file.type) || "").toLowerCase().trim();
    if (type === "image/jpg" || type === "image/pjpeg") return "image/jpeg";
    if (type === "image/x-png") return "image/png";
    if (type === "image/jpeg" || type === "image/png" || type === "image/webp" || type === "image/gif") {
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
    if (!name && file && file.type && file.type.indexOf("image/") === 0) return true;
    return false;
  }

  function readFileAsDataUrl(file, mime) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var result = String(reader.result || "");
        if (!/^data:image\//i.test(result) && !/^data:application\/octet-stream;base64,/i.test(result)) {
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
      if (!isAllowedImageFile(file) && !mime) {
        reject(new Error("Fichier JPG ou PNG requis (.jpg / .jpeg / .png)"));
        return;
      }
      if (file.size && file.size <= 2.8 * 1024 * 1024 && (mime === "image/jpeg" || mime === "image/png")) {
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
          if (dataUrl.length > 700000) dataUrl = canvas.toDataURL("image/jpeg", 0.62);
          URL.revokeObjectURL(url);
          resolve(dataUrl);
        } catch (e) {
          URL.revokeObjectURL(url);
          reject(e);
        }
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("Lecture image impossible (JPG/PNG)"));
      };
      img.src = url;
    });
  }

  function mediaUrl(tradeKey, file, memberEmail) {
    var u =
      "/api/journal-trade-screens/" +
      encodeURIComponent(tradeKey) +
      "/media/" +
      encodeURIComponent(file);
    if (memberEmail) u += "?member=" + encodeURIComponent(memberEmail);
    return u;
  }

  function openLightbox(src, caption) {
    var box = document.getElementById("jts-lightbox");
    var img = document.getElementById("jts-lightbox-img");
    var cap = document.getElementById("jts-lightbox-caption");
    var open = document.getElementById("jts-lightbox-open");
    if (!box || !img) {
      window.open(src, "_blank", "noopener");
      return;
    }
    img.src = src;
    if (cap) cap.textContent = caption || "Screen";
    if (open) open.href = src;
    box.hidden = false;
    box.classList.add("is-open");
  }

  function closeLightbox() {
    var box = document.getElementById("jts-lightbox");
    var img = document.getElementById("jts-lightbox-img");
    if (box) {
      box.classList.remove("is-open");
      box.hidden = true;
    }
    if (img) img.removeAttribute("src");
  }

  function renderTradeCards(trades, opts) {
    opts = opts || {};
    return trades
      .map(function (t) {
        var thumbs = (t.images || [])
          .map(function (img) {
            var src = mediaUrl(t.tradeKey, img.file, opts.member || t.email || "");
            return (
              '<button type="button" data-jts-zoom="' +
              esc(src) +
              '" data-jts-caption="' +
              esc(t.label || t.pair || t.tradeKey) +
              '" title="Agrandir"><img src="' +
              esc(src) +
              '" alt="" loading="lazy" /></button>'
            );
          })
          .join("");
        return (
          '<article class="jts-shell-card"><strong>' +
          esc(opts.showEmail && t.email ? t.email + " · " : "") +
          esc(t.label || t.pair || t.tradeKey) +
          '</strong><div class="jts-shell-meta">' +
          esc(t.tradeDate || "") +
          (t.direction ? " · " + esc(t.direction) : "") +
          " · " +
          (t.imageCount || 0) +
          " screen(s)</div><div class=\"jts-shell-thumbs\">" +
          thumbs +
          "</div></article>"
        );
      })
      .join("");
  }

  async function loadScreensList() {
    var list = document.getElementById("jts-list");
    if (!list) return;
    try {
      var ping = await fetch("/api/journal-trade-screens/ping", { credentials: "same-origin" });
      if (!ping.ok) {
        list.innerHTML =
          '<p class="jts-shell-meta">API screens absente (ping ' +
          ping.status +
          "). Relance le déploiement VPS.</p>";
        return;
      }
      var data = await api("/api/journal-trade-screens");
      var trades = (data.trades || []).filter(function (t) {
        return (t.imageCount || (t.images && t.images.length) || 0) > 0;
      });
      if (!trades.length) {
        list.innerHTML =
          '<p class="jts-shell-meta">Aucun screen — glisse un JPG/PNG au-dessus du journal.</p>';
        return;
      }
      list.innerHTML = renderTradeCards(trades);
      setUploadStatus(trades.length + " trade(s) avec screens.", "ok");
    } catch (err) {
      list.innerHTML = '<p class="jts-shell-meta">Erreur : ' + esc(err.message || err) + "</p>";
      setUploadStatus(err.message || String(err), "error");
    }
  }

  async function loadAdminList() {
    var block = document.getElementById("jts-admin-block");
    var list = document.getElementById("jts-admin-list");
    if (!block || !list) return;
    try {
      var res = await fetch("/api/journal-trade-screens-admin", { credentials: "same-origin" });
      if (res.status === 403 || res.status === 401) {
        block.hidden = true;
        return;
      }
      var data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        block.hidden = true;
        return;
      }
      block.hidden = false;
      var trades = data.trades || [];
      if (!trades.length) {
        list.innerHTML = '<p class="jts-shell-meta">Aucun screen membre pour l’instant.</p>';
        return;
      }
      list.innerHTML = renderTradeCards(trades, { showEmail: true });
    } catch (_) {
      block.hidden = true;
    }
  }

  function syncFileNames() {
    var el = document.getElementById("jts-file-names");
    if (!el) return;
    if (!pendingFiles.length) {
      el.textContent = "";
      return;
    }
    el.textContent =
      pendingFiles.length +
      " fichier(s) : " +
      pendingFiles
        .map(function (f) {
          return f.name || "image";
        })
        .join(", ");
  }

  function addFiles(fileList) {
    var arr = Array.prototype.slice.call(fileList || []);
    var rejected = [];
    arr.forEach(function (f) {
      if (isAllowedImageFile(f)) pendingFiles.push(f);
      else rejected.push(f.name || "?");
    });
    var input = document.getElementById("jts-files");
    if (input) {
      try {
        var dt = new DataTransfer();
        pendingFiles.forEach(function (f) {
          dt.items.add(f);
        });
        input.files = dt.files;
      } catch (_) {}
    }
    syncFileNames();
    if (rejected.length) {
      setUploadStatus("Ignorés (pas JPG/PNG) : " + rejected.join(", "), "error");
    } else if (pendingFiles.length) {
      setUploadStatus(pendingFiles.length + " image(s) prête(s) — Enregistrer.", "ok");
      setScreensExpanded(true);
    }
  }

  async function doUpload() {
    var upload = document.getElementById("jts-upload");
    var files = pendingFiles.slice();
    if (!files.length) {
      var fileInput = document.getElementById("jts-files");
      files = fileInput && fileInput.files ? Array.prototype.slice.call(fileInput.files) : [];
    }
    if (!files.length) {
      alert("Choisis au moins un screenshot JPG ou PNG.");
      return;
    }
    for (var fi = 0; fi < files.length; fi++) {
      if (!isAllowedImageFile(files[fi])) {
        alert("Fichier non supporté : " + (files[fi].name || "?") + " — JPG ou PNG uniquement.");
        return;
      }
    }
    var pair = String(document.getElementById("jts-pair").value || "").trim();
    if (!pair) {
      alert("Indique la paire (ex. XAUUSD).");
      document.getElementById("jts-pair").focus();
      setScreensExpanded(true);
      return;
    }
    var tradeKey = tradeKeyFromForm();
    var direction = document.getElementById("jts-direction").value;
    var date = document.getElementById("jts-date").value;
    var label = document.getElementById("jts-label").value;
    try {
      if (upload) upload.disabled = true;
      setUploadStatus("Préparation…", "");
      await api("/api/journal-trade-screens/" + encodeURIComponent(tradeKey), {
        method: "PUT",
        body: JSON.stringify({
          label: label || pair + " " + direction,
          pair: pair,
          direction: direction,
          tradeDate: date,
        }),
      });
      for (var i = 0; i < files.length; i++) {
        setUploadStatus("Envoi " + (i + 1) + "/" + files.length + "…", "");
        var dataUrl = await compressImageFile(files[i]);
        await api("/api/journal-trade-screens/" + encodeURIComponent(tradeKey) + "/images", {
          method: "POST",
          body: JSON.stringify({
            dataUrl: dataUrl,
            caption: "",
            label: label || pair + " " + direction,
            pair: pair,
            direction: direction,
            tradeDate: date,
          }),
        });
      }
      setUploadStatus(files.length + " screen(s) enregistré(s).", "ok");
      pendingFiles = [];
      var fileInput2 = document.getElementById("jts-files");
      if (fileInput2) fileInput2.value = "";
      syncFileNames();
      await loadScreensList();
      await loadAdminList();
    } catch (err) {
      setUploadStatus(err.message || String(err), "error");
      alert("Upload : " + (err.message || err));
    } finally {
      if (upload) upload.disabled = false;
    }
  }

  function bindScreensUi() {
    var toggle = document.getElementById("jts-bar-toggle");
    if (toggle && toggle.dataset.bound !== "1") {
      toggle.dataset.bound = "1";
      toggle.addEventListener("click", function () {
        setScreensExpanded(!screensExpanded);
      });
    }

    var refresh = document.getElementById("jts-refresh");
    if (refresh && refresh.dataset.bound !== "1") {
      refresh.dataset.bound = "1";
      refresh.onclick = function () {
        loadScreensList();
        loadAdminList();
      };
    }

    var upload = document.getElementById("jts-upload");
    if (upload && upload.dataset.bound !== "1") {
      upload.dataset.bound = "1";
      upload.onclick = function () {
        doUpload();
      };
    }

    var drop = document.getElementById("jts-dropzone");
    var fileInput = document.getElementById("jts-files");
    if (drop && drop.dataset.bound !== "1") {
      drop.dataset.bound = "1";
      drop.addEventListener("click", function (ev) {
        if (ev.target === fileInput) return;
        if (fileInput) fileInput.click();
      });
      drop.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          if (fileInput) fileInput.click();
        }
      });
      ["dragenter", "dragover"].forEach(function (evt) {
        drop.addEventListener(evt, function (e) {
          e.preventDefault();
          e.stopPropagation();
          drop.classList.add("is-drag");
        });
      });
      ["dragleave", "drop"].forEach(function (evt) {
        drop.addEventListener(evt, function (e) {
          e.preventDefault();
          e.stopPropagation();
          drop.classList.remove("is-drag");
        });
      });
      drop.addEventListener("drop", function (e) {
        var files = e.dataTransfer && e.dataTransfer.files;
        if (files && files.length) addFiles(files);
      });
    }
    if (fileInput && fileInput.dataset.bound !== "1") {
      fileInput.dataset.bound = "1";
      fileInput.addEventListener("change", function () {
        pendingFiles = [];
        addFiles(fileInput.files);
      });
    }

    document.addEventListener("click", function (ev) {
      var zoom = ev.target.closest("[data-jts-zoom]");
      if (zoom) {
        ev.preventDefault();
        openLightbox(zoom.getAttribute("data-jts-zoom"), zoom.getAttribute("data-jts-caption"));
        return;
      }
      if (ev.target.closest("[data-jts-close]")) closeLightbox();
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") closeLightbox();
    });

    document.addEventListener("paste", function (ev) {
      var bar = document.getElementById("journal-screens-bar");
      if (!bar || bar.hidden) return;
      var items = ev.clipboardData && ev.clipboardData.items;
      if (!items) return;
      var files = [];
      for (var i = 0; i < items.length; i++) {
        if (items[i].type && items[i].type.indexOf("image/") === 0) {
          var f = items[i].getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length) {
        ev.preventDefault();
        addFiles(files);
      }
    });

    var dateEl = document.getElementById("jts-date");
    if (dateEl && !dateEl.value) {
      var d = new Date();
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      dateEl.value = d.toISOString().slice(0, 16);
    }
  }

  async function boot() {
    bindScreensUi();

    var openBtn = document.getElementById("journal-open-premium");
    var loginHint = document.getElementById("journal-login-hint");

    if (openBtn) {
      openBtn.addEventListener("click", function () {
        setStatus("Ouverture du Journal…", "ok");
        showJournalWithScreens();
      });
    }

    var me = null;
    try {
      if (typeof getMe === "function") me = await getMe();
    } catch (_) {
      me = null;
    }

    var premium = isPremiumMe(me);
    if (loginHint) loginHint.hidden = !!me;
    if (openBtn) openBtn.hidden = !premium;

    if (!me) {
      showGate();
      setStatus("Connecte-toi à La Forge (email Premium) pour ouvrir le Trading Journal.", "warn");
      return;
    }

    if (!premium) {
      showGate();
      setStatus("Le Trading Journal est réservé aux abonnés La Forge Premium.", "warn");
      return;
    }

    if (window.ForgeOnboarding && me.email) {
      ForgeOnboarding.markDone(me.email, "journal");
    }

    setStatus("", "ok");
    showJournalWithScreens();

    // ?screens=0 → panneau plié ; ?screens=1 (défaut) ouvert
    if (/[?&]screens=0\b/i.test(window.location.search)) {
      setScreensExpanded(false);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
