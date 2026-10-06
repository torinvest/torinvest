/**
 * La Forge — hub Trading Journal Pro + onglet Screenshots trades (natif).
 */
(function () {
  "use strict";

  var JOURNAL_APP = "/journal-embed/";

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

  function showGate() {
    document.body.classList.remove("journal-app-open");
    var g = document.getElementById("journal-gate");
    if (g) g.hidden = false;
    var tabs = document.getElementById("journal-tabs");
    if (tabs) tabs.hidden = true;
  }

  function hideGate() {
    var g = document.getElementById("journal-gate");
    if (g) g.hidden = true;
  }

  function showTabs() {
    var tabs = document.getElementById("journal-tabs");
    if (tabs) tabs.hidden = false;
  }

  function setTab(tab) {
    var appWrap = document.getElementById("journal-frame-wrap");
    var screens = document.getElementById("journal-screens-panel");
    var buttons = document.querySelectorAll("[data-journal-tab]");
    buttons.forEach(function (b) {
      b.classList.toggle("is-active", b.getAttribute("data-journal-tab") === tab);
    });
    if (tab === "screens") {
      if (appWrap) appWrap.hidden = true;
      if (screens) screens.hidden = false;
      document.body.classList.add("journal-app-open");
      loadScreensList();
    } else {
      if (screens) screens.hidden = true;
      if (appWrap) appWrap.hidden = false;
      document.body.classList.add("journal-app-open");
      var frame = document.getElementById("journal-frame");
      if (frame && !frame.getAttribute("src")) frame.src = JOURNAL_APP;
    }
  }

  function showApp() {
    hideGate();
    showTabs();
    setTab("app");
  }

  function isPremiumMe(me) {
    if (!me) return false;
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

  function compressImageFile(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !file.type || file.type.indexOf("image/") !== 0) {
        reject(new Error("Image JPEG/PNG/WebP requise"));
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
          ctx.fillStyle = "#0b0f14";
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          var dataUrl = canvas.toDataURL("image/jpeg", 0.82);
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
        reject(new Error("Lecture image impossible"));
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

  async function loadScreensList() {
    var list = document.getElementById("jts-list");
    var status = document.getElementById("jts-status");
    if (!list) return;
    try {
      var ping = await fetch("/api/journal-trade-screens/ping", { credentials: "same-origin" });
      if (!ping.ok) {
        list.innerHTML =
          '<p class="jts-shell-meta">API screens absente sur le serveur (ping ' +
          ping.status +
          "). Relance le script de déploiement VPS.</p>";
        return;
      }
      var data = await api("/api/journal-trade-screens");
      var trades = data.trades || [];
      if (!trades.length) {
        list.innerHTML =
          '<p class="jts-shell-meta">Aucun screen pour l’instant — utilise le formulaire à gauche.</p>';
        return;
      }
      list.innerHTML = trades
        .map(function (t) {
          var thumbs = (t.images || [])
            .map(function (img) {
              var src = mediaUrl(t.tradeKey, img.file);
              return (
                '<a href="' +
                esc(src) +
                '" target="_blank" rel="noopener" title="Ouvrir taille réelle"><img src="' +
                esc(src) +
                '" alt="" loading="lazy" /></a>'
              );
            })
            .join("");
          return (
            '<article class="jts-shell-card"><strong>' +
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
      if (status && !status.dataset.keep) status.textContent = trades.length + " trade(s) avec screens.";
    } catch (err) {
      list.innerHTML = '<p class="jts-shell-meta">Erreur : ' + esc(err.message || err) + "</p>";
    }
  }

  function bindScreensUi() {
    var tabs = document.getElementById("journal-tabs");
    if (tabs && tabs.dataset.bound !== "1") {
      tabs.dataset.bound = "1";
      tabs.addEventListener("click", function (ev) {
        var btn = ev.target.closest("[data-journal-tab]");
        if (!btn) return;
        setTab(btn.getAttribute("data-journal-tab"));
      });
    }

    var refresh = document.getElementById("jts-refresh");
    if (refresh && refresh.dataset.bound !== "1") {
      refresh.dataset.bound = "1";
      refresh.onclick = function () {
        loadScreensList();
      };
    }

    var upload = document.getElementById("jts-upload");
    if (upload && upload.dataset.bound !== "1") {
      upload.dataset.bound = "1";
      upload.onclick = async function () {
        var status = document.getElementById("jts-status");
        var fileInput = document.getElementById("jts-files");
        var files = fileInput && fileInput.files ? Array.prototype.slice.call(fileInput.files) : [];
        if (!files.length) {
          alert("Choisis au moins un screenshot.");
          return;
        }
        var pair = String(document.getElementById("jts-pair").value || "").trim();
        if (!pair) {
          alert("Indique la paire (ex. XAUUSD).");
          return;
        }
        var tradeKey = tradeKeyFromForm();
        var direction = document.getElementById("jts-direction").value;
        var date = document.getElementById("jts-date").value;
        var label = document.getElementById("jts-label").value;
        try {
          upload.disabled = true;
          if (status) {
            status.dataset.keep = "1";
            status.textContent = "Préparation…";
          }
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
            if (status) status.textContent = "Envoi " + (i + 1) + "/" + files.length + "…";
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
          if (status) status.textContent = files.length + " screen(s) enregistré(s).";
          fileInput.value = "";
          await loadScreensList();
        } catch (err) {
          if (status) status.textContent = err.message || String(err);
          alert("Upload : " + (err.message || err));
        } finally {
          upload.disabled = false;
          if (status) delete status.dataset.keep;
        }
      };
    }

    // Date par défaut = maintenant
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
        showApp();
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
    showApp();

    // Deep-link ?tab=screens
    if (/[?&]tab=screens\b/i.test(window.location.search)) {
      setTab("screens");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
