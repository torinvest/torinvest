/**
 * Journal de trading natif — liste → clic lecture → Modifier / Nouveau.
 * Isolation : chaque élève ne voit que ses trades ; admin peut ouvrir un élève.
 * Screens : multi-upload, suppression, édition de légende.
 */
(function (global) {
  "use strict";

  var state = {
    me: null,
    isAdmin: false,
    owner: "",
    viewingOther: false,
    students: [],
    trades: [],
    current: null,
    mode: "list", // list | view | edit | new
    error: "",
  };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function ownerQS() {
    if (state.isAdmin && state.owner && state.me && state.owner !== normalizeEmail(state.me.email)) {
      return "?owner=" + encodeURIComponent(state.owner);
    }
    return "";
  }

  function withOwner(url) {
    var q = ownerQS();
    if (!q) return url;
    return url.indexOf("?") >= 0 ? url + "&owner=" + encodeURIComponent(state.owner) : url + q;
  }

  function normalizeEmail(email) {
    return String(email || "")
      .trim()
      .toLowerCase();
  }

  function fmtNum(n) {
    if (n == null || n === "" || !Number.isFinite(Number(n))) return "—";
    return String(Number(n));
  }

  function fmtPnl(t) {
    if (t.pnl == null || !Number.isFinite(Number(t.pnl))) return "—";
    var u = t.pnlUnit || "usd";
    var sign = Number(t.pnl) > 0 ? "+" : "";
    return sign + Number(t.pnl) + (u === "usd" ? " $" : u === "r" ? " R" : u === "pips" ? " pips" : " %");
  }

  function pnlClass(t) {
    if (t.pnl == null || !Number.isFinite(Number(t.pnl))) return "";
    return Number(t.pnl) >= 0 ? "tj-pnl-pos" : "tj-pnl-neg";
  }

  function statusBadge(status) {
    var s = String(status || "open");
    return '<span class="tj-badge tj-badge-' + esc(s) + '">' + esc(s) + "</span>";
  }

  async function api(url, opts) {
    opts = opts || {};
    var res = await fetch(withOwner(url), {
      credentials: "include",
      headers: Object.assign(
        { Accept: "application/json" },
        opts.body ? { "Content-Type": "application/json" } : {},
        opts.headers || {}
      ),
      method: opts.method || "GET",
      body: opts.body || undefined,
    });
    var data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) {
      throw new Error(data.error || "Erreur " + res.status);
    }
    return data;
  }

  function rootEl() {
    return document.getElementById("journal-native-root");
  }

  function setMode(mode, trade) {
    state.mode = mode;
    state.current = trade || null;
    state.error = "";
    render();
  }

  async function loadStudents() {
    if (!state.isAdmin) return;
    try {
      var data = await fetch("/api/journal-trades-admin/students", {
        credentials: "include",
        headers: { Accept: "application/json" },
      }).then(function (r) {
        return r.json();
      });
      if (data && data.ok) state.students = data.students || [];
    } catch (_) {
      state.students = [];
    }
  }

  async function loadList() {
    var data = await api("/api/journal-trades");
    state.trades = data.trades || [];
    state.owner = data.owner || state.owner;
    state.viewingOther = !!data.viewingOther;
    state.isAdmin = !!data.isAdmin || state.isAdmin;
    setMode("list");
  }

  async function openTrade(id) {
    var data = await api("/api/journal-trades/" + encodeURIComponent(id));
    setMode("view", data.trade);
  }

  function adminBar() {
    if (!state.isAdmin) return "";
    var opts =
      '<option value="">Mon journal (' +
      esc(state.me && state.me.email ? state.me.email : "") +
      ")</option>";
    (state.students || []).forEach(function (s) {
      var selected = state.owner === s.email ? " selected" : "";
      opts +=
        '<option value="' +
        esc(s.email) +
        '"' +
        selected +
        ">" +
        esc(s.email) +
        " (" +
        esc(String(s.tradeCount || 0)) +
        ")</option>";
    });
    return (
      '<div class="tj-admin-bar">' +
      "<strong>Admin</strong> — journal d’un élève (privé pour les autres) : " +
      '<select id="tj-owner-select">' +
      opts +
      "</select>" +
      (state.viewingOther
        ? '<span class="tj-admin-pill">Vue élève : ' + esc(state.owner) + "</span>"
        : "") +
      "</div>"
    );
  }

  function privacyNote() {
    return (
      '<p class="tj-privacy">Tes trades et screens sont <strong>privés</strong> : visibles seulement par toi' +
      (state.isAdmin ? " et l’admin" : " et l’admin de la formation") +
      ", jamais par les autres élèves.</p>"
    );
  }

  function renderList() {
    var rows = state.trades || [];
    var body;
    if (!rows.length) {
      body =
        '<div class="tj-empty">Aucun trade pour l’instant.<br/>Clique <strong>Nouveau trade</strong> pour en créer un.</div>';
    } else {
      body =
        '<div class="tj-table-wrap"><table class="tj-table"><thead><tr>' +
        "<th>Date</th><th>Symbole</th><th>Sens</th><th>Entrée</th><th>PnL</th><th>Screens</th><th>Statut</th>" +
        "</tr></thead><tbody>" +
        rows
          .map(function (t) {
            return (
              '<tr data-trade-id="' +
              esc(t.id) +
              '" tabindex="0" role="button" aria-label="Voir le trade ' +
              esc(t.symbol) +
              '">' +
              "<td>" +
              esc(t.openedAt || "—") +
              "</td>" +
              "<td><strong>" +
              esc(t.symbol) +
              "</strong></td>" +
              '<td class="tj-side-' +
              esc(t.side) +
              '">' +
              esc(t.side) +
              "</td>" +
              "<td>" +
              esc(fmtNum(t.entry)) +
              "</td>" +
              '<td class="' +
              pnlClass(t) +
              '">' +
              esc(fmtPnl(t)) +
              "</td>" +
              "<td>" +
              esc(String(t.imageCount || 0)) +
              "</td>" +
              "<td>" +
              statusBadge(t.status) +
              "</td>" +
              "</tr>"
            );
          })
          .join("") +
        "</tbody></table></div>" +
        '<p class="tj-muted" style="margin-top:0.65rem">Clique une ligne pour <strong>lire</strong> le trade. Screens ajoutables en édition.</p>';
    }

    return (
      adminBar() +
      '<div class="tj-toolbar">' +
      "<div><h1>Trading Journal</h1>" +
      '<p class="tj-muted" style="margin:0.25rem 0 0">Clic = lecture · Modifier = édition · Screens privés.</p></div>' +
      '<div class="tj-toolbar-actions">' +
      '<button type="button" class="btn btn-primary" id="tj-new">Nouveau trade</button>' +
      "</div></div>" +
      privacyNote() +
      (state.error ? '<p class="tj-error">' + esc(state.error) + "</p>" : "") +
      body +
      '<p class="tj-legacy">Ancien Journal Pro (radar) : <a href="#" id="tj-legacy-link">ouvrir en secours</a></p>'
    );
  }

  function mediaUrl(tradeId, file) {
    return withOwner(
      "/api/journal-trades/" +
        encodeURIComponent(tradeId) +
        "/media/" +
        encodeURIComponent(file)
    );
  }

  function renderShots(trade, editable) {
    var images = (trade && trade.images) || [];
    var html = '<div class="tj-shots-block">';
    if (!images.length) {
      html += '<p class="tj-muted">Aucun screen pour ce trade.</p>';
    } else {
      html += '<div class="tj-shots">';
      images.forEach(function (img) {
        html +=
          '<figure class="tj-shot" data-image-id="' +
          esc(img.id) +
          '">' +
          '<a href="' +
          esc(mediaUrl(trade.id, img.file)) +
          '" target="_blank" rel="noopener">' +
          '<img src="' +
          esc(mediaUrl(trade.id, img.file)) +
          '" alt="" loading="lazy" />' +
          "</a>";
        if (editable) {
          html +=
            '<figcaption><input type="text" class="tj-caption-input" data-image-id="' +
            esc(img.id) +
            '" value="' +
            esc(img.caption || "") +
            '" placeholder="Légende…" maxlength="300" />' +
            '<div class="tj-shot-actions">' +
            '<button type="button" class="btn btn-secondary tj-caption-save" data-image-id="' +
            esc(img.id) +
            '">Sauver légende</button>' +
            '<button type="button" class="btn btn-secondary tj-shot-del" data-image-id="' +
            esc(img.id) +
            '">Supprimer</button>' +
            "</div></figcaption>";
        } else if (img.caption) {
          html += "<figcaption>" + esc(img.caption) + "</figcaption>";
        }
        html += "</figure>";
      });
      html += "</div>";
    }
    if (editable && trade && trade.id) {
      html +=
        '<div class="tj-upload-box">' +
        "<label>Ajouter un ou plusieurs screens</label>" +
        '<input type="file" id="tj-shot-file" accept="image/jpeg,image/png,image/webp,image/gif" multiple />' +
        '<p class="tj-muted" id="tj-shot-status" style="margin:0.35rem 0 0">JPEG / PNG / WebP — plusieurs fichiers OK.</p>' +
        "</div>";
    }
    html += "</div>";
    return html;
  }

  function renderView() {
    var t = state.current || {};
    return (
      adminBar() +
      '<div class="tj-detail">' +
      '<div class="tj-banner">Mode lecture — tu consultes le détail (sans modification).</div>' +
      '<div class="tj-detail-head"><div>' +
      "<h2>" +
      esc(t.symbol || "Trade") +
      " · " +
      esc(t.side || "") +
      "</h2>" +
      '<p class="tj-muted" style="margin:0.25rem 0 0">' +
      statusBadge(t.status) +
      " · " +
      esc(t.openedAt || "") +
      (t.setup ? " · " + esc(t.setup) : "") +
      "</p></div>" +
      '<div class="tj-toolbar-actions">' +
      '<button type="button" class="btn btn-secondary" id="tj-back">Retour</button>' +
      '<button type="button" class="btn btn-primary" id="tj-edit">Modifier</button>' +
      "</div></div>" +
      '<div class="tj-grid">' +
      field("Entrée", fmtNum(t.entry)) +
      field("SL", fmtNum(t.sl)) +
      field("TP", fmtNum(t.tp)) +
      field("Sortie", fmtNum(t.exit)) +
      field("PnL", fmtPnl(t)) +
      field("Timeframe", t.timeframe || "—") +
      field("Clôture", t.closedAt || "—") +
      field("Tags", (t.tags || []).join(", ") || "—") +
      "</div>" +
      (t.notes
        ? '<div class="tj-field"><label>Notes</label><div class="tj-notes">' + esc(t.notes) + "</div></div>"
        : "") +
      '<div class="tj-field" style="margin-top:1rem"><label>Screens</label>' +
      renderShots(t, false) +
      "</div>" +
      '<div class="tj-actions">' +
      '<button type="button" class="btn btn-secondary" id="tj-back-2">Retour liste</button>' +
      '<button type="button" class="btn btn-primary" id="tj-edit-2">Modifier / screens</button>' +
      '<button type="button" class="btn btn-secondary" id="tj-delete" style="margin-left:auto">Supprimer</button>' +
      "</div></div>"
    );
  }

  function field(label, val) {
    return (
      '<div class="tj-field"><label>' +
      esc(label) +
      '</label><div class="val">' +
      esc(val) +
      "</div></div>"
    );
  }

  function formVal(t, key, fallback) {
    var v = t && t[key] != null ? t[key] : fallback;
    return v == null ? "" : String(v);
  }

  function renderForm() {
    var t = state.current || {};
    var isNew = state.mode === "new";
    return (
      adminBar() +
      '<div class="tj-form-card">' +
      '<div class="tj-detail-head"><div><h2>' +
      (isNew ? "Nouveau trade" : "Modifier le trade") +
      "</h2>" +
      '<p class="tj-muted" style="margin:0.25rem 0 0">Enregistre, ajoute tes screens, puis relis en un clic.</p></div>' +
      '<button type="button" class="btn btn-secondary" id="tj-cancel">Annuler</button></div>' +
      (state.error ? '<p class="tj-error">' + esc(state.error) + "</p>" : "") +
      '<form id="tj-form" class="tj-form">' +
      input("symbol", "Symbole", formVal(t, "symbol", "XAUUSD")) +
      select("side", "Sens", formVal(t, "side", "long"), [
        ["long", "Long"],
        ["short", "Short"],
      ]) +
      select("status", "Statut", formVal(t, "status", "open"), [
        ["open", "Open"],
        ["closed", "Closed"],
        ["idea", "Idea"],
      ]) +
      input("openedAt", "Date", formVal(t, "openedAt", today()), "date") +
      input("entry", "Entrée", formVal(t, "entry", ""), "number") +
      input("sl", "SL", formVal(t, "sl", ""), "number") +
      input("tp", "TP", formVal(t, "tp", ""), "number") +
      input("exit", "Sortie", formVal(t, "exit", ""), "number") +
      input("pnl", "PnL", formVal(t, "pnl", ""), "number") +
      select("pnlUnit", "Unité PnL", formVal(t, "pnlUnit", "usd"), [
        ["usd", "USD"],
        ["r", "R"],
        ["pips", "Pips"],
        ["%", "%"],
      ]) +
      input("timeframe", "Timeframe", formVal(t, "timeframe", "M15")) +
      input("setup", "Setup", formVal(t, "setup", "")) +
      input("tags", "Tags (virgules)", (t.tags || []).join(", ")) +
      input("closedAt", "Clôture", formVal(t, "closedAt", ""), "date") +
      '<div class="tj-span-2"><label for="tj-notes">Notes</label>' +
      '<textarea id="tj-notes" name="notes">' +
      esc(formVal(t, "notes", "")) +
      "</textarea></div>" +
      '<div class="tj-span-2 tj-actions">' +
      '<button type="submit" class="btn btn-primary">Enregistrer</button>' +
      '<button type="button" class="btn btn-secondary" id="tj-cancel-2">Annuler</button>' +
      "</div></form>" +
      (!isNew
        ? '<div class="tj-span-2" style="margin-top:1rem"><label>Screens (privés)</label>' +
          renderShots(t, true) +
          "</div>"
        : '<p class="tj-muted">Enregistre d’abord le trade, puis tu pourras ajouter des screens.</p>') +
      "</div>"
    );
  }

  function input(name, label, value, type) {
    type = type || "text";
    var step = type === "number" ? ' step="any"' : "";
    return (
      "<div><label for=\"tj-" +
      esc(name) +
      '">' +
      esc(label) +
      '</label><input id="tj-' +
      esc(name) +
      '" name="' +
      esc(name) +
      '" type="' +
      esc(type) +
      '"' +
      step +
      ' value="' +
      esc(value) +
      '" /></div>'
    );
  }

  function select(name, label, value, options) {
    return (
      "<div><label for=\"tj-" +
      esc(name) +
      '">' +
      esc(label) +
      '</label><select id="tj-' +
      esc(name) +
      '" name="' +
      esc(name) +
      '">' +
      options
        .map(function (o) {
          return (
            '<option value="' +
            esc(o[0]) +
            '"' +
            (o[0] === value ? " selected" : "") +
            ">" +
            esc(o[1]) +
            "</option>"
          );
        })
        .join("") +
      "</select></div>"
    );
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function render() {
    var root = rootEl();
    if (!root) return;
    if (state.mode === "list") root.innerHTML = renderList();
    else if (state.mode === "view") root.innerHTML = renderView();
    else root.innerHTML = renderForm();
    bind();
  }

  function bind() {
    var root = rootEl();
    if (!root) return;

    var ownerSel = document.getElementById("tj-owner-select");
    if (ownerSel) {
      ownerSel.addEventListener("change", function () {
        var v = ownerSel.value;
        state.owner = v || normalizeEmail(state.me && state.me.email);
        loadList().catch(showErr);
      });
    }

    root.querySelectorAll("tr[data-trade-id]").forEach(function (tr) {
      tr.addEventListener("click", function () {
        openTrade(tr.getAttribute("data-trade-id")).catch(showErr);
      });
      tr.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openTrade(tr.getAttribute("data-trade-id")).catch(showErr);
        }
      });
    });

    var neu = document.getElementById("tj-new");
    if (neu)
      neu.addEventListener("click", function () {
        setMode("new", null);
      });

    ["tj-back", "tj-back-2", "tj-cancel", "tj-cancel-2"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("click", function () {
        if (state.mode === "edit" && state.current && state.current.id) {
          setMode("view", state.current);
        } else {
          loadList().catch(showErr);
        }
      });
    });

    ["tj-edit", "tj-edit-2"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("click", function () {
        setMode("edit", state.current);
      });
    });

    var del = document.getElementById("tj-delete");
    if (del) {
      del.addEventListener("click", function () {
        if (!state.current || !state.current.id) return;
        if (!confirm("Supprimer ce trade et ses screens ?")) return;
        api("/api/journal-trades/" + encodeURIComponent(state.current.id), {
          method: "DELETE",
        })
          .then(function () {
            return loadList();
          })
          .catch(showErr);
      });
    }

    var form = document.getElementById("tj-form");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        saveForm(form).catch(showErr);
      });
    }

    var file = document.getElementById("tj-shot-file");
    if (file) {
      file.addEventListener("change", function () {
        uploadShots(file).catch(showErr);
      });
    }

    root.querySelectorAll(".tj-shot-del").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var imageId = btn.getAttribute("data-image-id");
        if (!state.current || !imageId) return;
        if (!confirm("Supprimer ce screen ?")) return;
        api(
          "/api/journal-trades/" +
            encodeURIComponent(state.current.id) +
            "/images/" +
            encodeURIComponent(imageId),
          { method: "DELETE" }
        )
          .then(function (data) {
            state.current = data.trade;
            render();
          })
          .catch(showErr);
      });
    });

    root.querySelectorAll(".tj-caption-save").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var imageId = btn.getAttribute("data-image-id");
        var input = root.querySelector('.tj-caption-input[data-image-id="' + imageId + '"]');
        if (!state.current || !imageId || !input) return;
        api(
          "/api/journal-trades/" +
            encodeURIComponent(state.current.id) +
            "/images/" +
            encodeURIComponent(imageId),
          {
            method: "PATCH",
            body: JSON.stringify({ caption: input.value }),
          }
        )
          .then(function (data) {
            state.current = data.trade;
            var status = document.getElementById("tj-shot-status");
            if (status) status.textContent = "Légende enregistrée.";
          })
          .catch(showErr);
      });
    });

    var legacy = document.getElementById("tj-legacy-link");
    if (legacy) {
      legacy.addEventListener("click", function (e) {
        e.preventDefault();
        openLegacyRadar();
      });
    }
  }

  function readForm(form) {
    var fd = new FormData(form);
    return {
      symbol: fd.get("symbol"),
      side: fd.get("side"),
      status: fd.get("status"),
      openedAt: fd.get("openedAt"),
      closedAt: fd.get("closedAt") || null,
      entry: fd.get("entry"),
      sl: fd.get("sl"),
      tp: fd.get("tp"),
      exit: fd.get("exit"),
      pnl: fd.get("pnl"),
      pnlUnit: fd.get("pnlUnit"),
      timeframe: fd.get("timeframe"),
      setup: fd.get("setup"),
      tags: String(fd.get("tags") || ""),
      notes: fd.get("notes"),
    };
  }

  async function saveForm(form) {
    var payload = readForm(form);
    if (!String(payload.symbol || "").trim()) {
      throw new Error("Indique un symbole");
    }
    var data;
    if (state.mode === "edit" && state.current && state.current.id) {
      data = await api("/api/journal-trades/" + encodeURIComponent(state.current.id), {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    } else {
      data = await api("/api/journal-trades", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }
    setMode("edit", data.trade);
    var status = document.getElementById("tj-shot-status");
    if (status) status.textContent = "Trade enregistré — tu peux ajouter des screens.";
  }

  function compressImageFile(file, maxSide, quality) {
    maxSide = maxSide || 1400;
    quality = quality || 0.8;
    return new Promise(function (resolve, reject) {
      if (!file || !file.type || file.type.indexOf("image/") !== 0) {
        reject(new Error("Image requise (JPEG/PNG/WebP)"));
        return;
      }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        try {
          var w = img.naturalWidth || img.width;
          var h = img.naturalHeight || img.height;
          var scale = Math.min(1, maxSide / Math.max(w, h));
          var canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(w * scale));
          canvas.height = Math.max(1, Math.round(h * scale));
          var ctx = canvas.getContext("2d");
          ctx.fillStyle = "#0b0f14";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("Image illisible"));
      };
      img.src = url;
    });
  }

  async function uploadShots(input) {
    if (!state.current || !state.current.id) return;
    var files = input.files ? Array.prototype.slice.call(input.files, 0) : [];
    if (!files.length) return;
    var status = document.getElementById("tj-shot-status");
    if (status) status.textContent = "Upload de " + files.length + " screen(s)…";
    var dataUrls = [];
    for (var i = 0; i < files.length; i++) {
      dataUrls.push(await compressImageFile(files[i]));
    }
    var data = await api(
      "/api/journal-trades/" + encodeURIComponent(state.current.id) + "/images",
      { method: "POST", body: JSON.stringify({ dataUrls: dataUrls }) }
    );
    state.current = data.trade;
    if (status) status.textContent = (data.count || dataUrls.length) + " screen(s) ajouté(s).";
    input.value = "";
    render();
  }

  function showErr(err) {
    state.error = err && err.message ? err.message : String(err);
    render();
  }

  function openLegacyRadar() {
    fetch("/api/journal-bridge/radar-url", { credentials: "include" })
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        if (d && d.url) {
          window.location.href = d.url;
          return;
        }
        window.open("https://radar.torinvest-trading.com/trading_journal.php", "_blank");
      })
      .catch(function () {
        window.open("https://radar.torinvest-trading.com/trading_journal.php", "_blank");
      });
  }

  function detectAdmin(me) {
    if (!me) return false;
    if (me.isAdmin === true || me.admin === true || me.role === "admin") return true;
    var list = String(me.adminEmails || "")
      .split(/[,;\s]+/)
      .map(normalizeEmail)
      .filter(Boolean);
    if (list.length && list.indexOf(normalizeEmail(me.email)) >= 0) return true;
    return false;
  }

  async function initJournalNative(me) {
    state.me = me || null;
    state.owner = normalizeEmail(me && me.email);
    state.isAdmin = detectAdmin(me);
    var root = rootEl();
    if (!root) throw new Error("#journal-native-root manquant");
    root.innerHTML = '<p class="tj-muted">Chargement du journal…</p>';
    try {
      var ping = await api("/api/journal-trades/ping");
      if (ping && ping.version) {
        /* ok */
      }
    } catch (e) {
      root.innerHTML =
        '<div class="tj-empty">API journal pas encore déployée sur le VPS.<br/>Lance <code>DEPLOY-JOURNAL-NATIVE.sh</code> puis hard refresh.</div>';
      return;
    }
    // Confirme admin via une tentative soft (403 = non admin)
    try {
      var adm = await fetch("/api/journal-trades-admin/students", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (adm.ok) {
        state.isAdmin = true;
        var body = await adm.json();
        state.students = body.students || [];
      }
    } catch (_) {}
    await loadList();
  }

  global.initJournalNative = initJournalNative;
})(window);
