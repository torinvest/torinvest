/**
 * Journal de trading natif — liste → clic lecture → Modifier / Nouveau.
 * Remplace le flux TJ Pro radar pour l’élève Premium.
 */
(function (global) {
  "use strict";

  var state = {
    me: null,
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
    var res = await fetch(url, {
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

  async function loadList() {
    var data = await api("/api/journal-trades");
    state.trades = data.trades || [];
    setMode("list");
  }

  async function openTrade(id) {
    var data = await api("/api/journal-trades/" + encodeURIComponent(id));
    setMode("view", data.trade);
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
        "<th>Date</th><th>Symbole</th><th>Sens</th><th>Entrée</th><th>PnL</th><th>Statut</th>" +
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
              statusBadge(t.status) +
              "</td>" +
              "</tr>"
            );
          })
          .join("") +
        "</tbody></table></div>" +
        '<p class="tj-muted" style="margin-top:0.65rem">Clique une ligne pour <strong>lire</strong> le trade (sans édition).</p>';
    }

    return (
      '<div class="tj-toolbar">' +
      "<div><h1>Trading Journal</h1>" +
      '<p class="tj-muted" style="margin:0.25rem 0 0">Journal Forge natif — clic = lecture, bouton = édition.</p></div>' +
      '<div class="tj-toolbar-actions">' +
      '<button type="button" class="btn btn-primary" id="tj-new">Nouveau trade</button>' +
      "</div></div>" +
      (state.error ? '<p class="tj-error">' + esc(state.error) + "</p>" : "") +
      body +
      '<p class="tj-legacy">Ancien Journal Pro (radar) : <a href="#" id="tj-legacy-link">ouvrir en secours</a></p>'
    );
  }

  function mediaUrl(tradeId, file) {
    return (
      "/api/journal-trades/" +
      encodeURIComponent(tradeId) +
      "/media/" +
      encodeURIComponent(file)
    );
  }

  function renderShots(trade, editable) {
    var images = (trade && trade.images) || [];
    if (!images.length && !editable) return "";
    var html = '<div class="tj-shots">';
    images.forEach(function (img) {
      html +=
        "<figure class=\"tj-shot\"><img src=\"" +
        esc(mediaUrl(trade.id, img.file)) +
        '" alt="" loading="lazy" />' +
        (img.caption ? "<figcaption>" + esc(img.caption) + "</figcaption>" : "") +
        "</figure>";
    });
    html += "</div>";
    if (editable) {
      html +=
        '<div style="margin-top:0.75rem">' +
        '<input type="file" id="tj-shot-file" accept="image/jpeg,image/png,image/webp,image/gif" />' +
        '<p class="tj-muted" id="tj-shot-status" style="margin:0.35rem 0 0"></p></div>';
    }
    return html;
  }

  function renderView() {
    var t = state.current || {};
    return (
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
      (t.images && t.images.length
        ? '<div class="tj-field" style="margin-top:1rem"><label>Screens</label>' +
          renderShots(t, false) +
          "</div>"
        : "") +
      '<div class="tj-actions">' +
      '<button type="button" class="btn btn-secondary" id="tj-back-2">Retour liste</button>' +
      '<button type="button" class="btn btn-primary" id="tj-edit-2">Modifier</button>' +
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
      '<div class="tj-form-card">' +
      '<div class="tj-detail-head"><div><h2>' +
      (isNew ? "Nouveau trade" : "Modifier le trade") +
      "</h2>" +
      '<p class="tj-muted" style="margin:0.25rem 0 0">Enregistre puis tu pourras le relire en un clic.</p></div>' +
      '<button type="button" class="btn btn-secondary" id="tj-cancel">Annuler</button></div>' +
      (state.error ? '<p class="tj-error">' + esc(state.error) + "</p>" : "") +
      '<form id="tj-form" class="tj-form">' +
      input("symbol", "Symbole", formVal(t, "symbol", "XAUUSD")) +
      select(
        "side",
        "Sens",
        formVal(t, "side", "long"),
        [
          ["long", "Long"],
          ["short", "Short"],
        ]
      ) +
      select(
        "status",
        "Statut",
        formVal(t, "status", "open"),
        [
          ["open", "Open"],
          ["closed", "Closed"],
          ["idea", "Idea"],
        ]
      ) +
      input("openedAt", "Date", formVal(t, "openedAt", today()), "date") +
      input("entry", "Entrée", formVal(t, "entry", ""), "number") +
      input("sl", "SL", formVal(t, "sl", ""), "number") +
      input("tp", "TP", formVal(t, "tp", ""), "number") +
      input("exit", "Sortie", formVal(t, "exit", ""), "number") +
      input("pnl", "PnL", formVal(t, "pnl", ""), "number") +
      select(
        "pnlUnit",
        "Unité PnL",
        formVal(t, "pnlUnit", "usd"),
        [
          ["usd", "USD"],
          ["r", "R"],
          ["pips", "Pips"],
          ["%", "%"],
        ]
      ) +
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
        ? '<div class="tj-span-2" style="margin-top:1rem"><label>Screens</label>' +
          renderShots(t, true) +
          "</div>"
        : "") +
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
    if (neu) neu.addEventListener("click", function () {
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
        if (!confirm("Supprimer ce trade ?")) return;
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
        uploadShot(file).catch(showErr);
      });
    }

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
    setMode("view", data.trade);
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

  async function uploadShot(input) {
    if (!state.current || !state.current.id) return;
    var file = input.files && input.files[0];
    if (!file) return;
    var status = document.getElementById("tj-shot-status");
    if (status) status.textContent = "Upload…";
    var dataUrl = await compressImageFile(file);
    var data = await api(
      "/api/journal-trades/" + encodeURIComponent(state.current.id) + "/images",
      { method: "POST", body: JSON.stringify({ dataUrl: dataUrl }) }
    );
    state.current = data.trade;
    if (status) status.textContent = "Screen ajouté.";
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

  async function initJournalNative(me) {
    state.me = me || null;
    var root = rootEl();
    if (!root) throw new Error("#journal-native-root manquant");
    root.innerHTML = '<p class="tj-muted">Chargement du journal…</p>';
    try {
      await api("/api/journal-trades/ping");
    } catch (e) {
      root.innerHTML =
        '<div class="tj-empty">API journal pas encore déployée sur le VPS.<br/>Lance le script <code>DEPLOY-JOURNAL-NATIVE.sh</code> puis hard refresh.</div>';
      return;
    }
    await loadList();
  }

  global.initJournalNative = initJournalNative;
})(window);
