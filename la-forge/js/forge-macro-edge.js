/**
 * TORINVEST Macro Edge — Gold Desk UI (MVP V1)
 */
(function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fmtNum(v, digits) {
    if (v == null || !Number.isFinite(Number(v))) return "Data unavailable";
    return Number(v).toLocaleString("fr-FR", {
      maximumFractionDigits: digits == null ? 2 : digits,
      minimumFractionDigits: 0,
    });
  }

  function scoreClass(score) {
    if (score == null || !Number.isFinite(score)) return "neu";
    if (score >= 15) return "pos";
    if (score <= -15) return "neg";
    return "neu";
  }

  function helpIcon(tip) {
    if (!tip) return "";
    return (
      '<button type="button" class="me-help" data-tip="' +
      esc(tip) +
      '" aria-label="Aide">?</button>'
    );
  }

  function heatClass(r) {
    if (r == null || !Number.isFinite(r)) return "heat-na";
    if (r >= 0.3) return "heat-pos";
    if (r <= -0.3) return "heat-neg";
    return "heat-mid";
  }

  async function api(path) {
    const res = await fetch(path, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    const data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) {
      const err = new Error(data.message || data.error || "HTTP " + res.status);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function renderDrivers(snap) {
    const gold = snap.goldDriver || {};
    const usd = snap.usdDriver || {};
    const be = snap.rateDecomposition && snap.rateDecomposition.breakeven;
    let inflScore = null;
    let inflEnv = "INFLATION — n/a";
    if (be && be.change20 != null) {
      inflScore = Math.round(Math.max(-100, Math.min(100, be.change20 / 0.02 * 100)));
      inflEnv =
        be.direction === "up"
          ? "INFLATION EXPECTATIONS RISING"
          : be.direction === "down"
            ? "INFLATION EXPECTATIONS FALLING"
            : "INFLATION EXPECTATIONS STABLE";
    }

    function card(label, tip, score, env) {
      const sc =
        score == null || !Number.isFinite(score)
          ? '<div class="me-na">Data unavailable</div>'
          : '<div class="me-score ' +
            scoreClass(score) +
            '">' +
            (score > 0 ? "+" : "") +
            score +
            "</div>";
      return (
        '<div class="me-driver">' +
        "<h3>" +
        esc(label) +
        " " +
        helpIcon(tip) +
        "</h3>" +
        sc +
        '<div class="me-env">' +
        esc(env || "") +
        "</div></div>"
      );
    }

    return (
      '<div class="me-grid-drivers">' +
      card(
        "USD DRIVER",
        "Force relative du dollar via DXY et taux US. Score analytique, pas une prévision.",
        usd.score,
        usd.environment || usd.status || ""
      ) +
      card(
        "GOLD DRIVER",
        snap.pedagogy && snap.pedagogy.realYield
          ? snap.pedagogy.realYield
          : "Score Gold −100…+100 selon real yield, DXY, breakeven.",
        gold.score,
        gold.environment || gold.status || ""
      ) +
      card(
        "RISK DRIVER",
        "VIX / indices arrivent en V2. Placeholder neutre en MVP Gold Desk.",
        0,
        "NEUTRAL (V2)"
      ) +
      card(
        "INFLATION DRIVER",
        snap.pedagogy && snap.pedagogy.breakeven
          ? snap.pedagogy.breakeven
          : "Basé sur le breakeven 10Y.",
        inflScore,
        inflEnv
      ) +
      "</div>" +
      '<p class="me-score-note">' +
      esc(
        snap.scoreNote ||
          "Score analytique TORINVEST — aide à l'interprétation, pas recommandation financière."
      ) +
      "</p>"
    );
  }

  function renderLevels(snap) {
    const levels = snap.levels || {};
    const order = ["XAUUSD", "XAGUSD", "DXY", "US02Y", "US10Y", "REAL10Y", "BE10Y"];
    let html = '<div class="me-levels">';
    for (let i = 0; i < order.length; i++) {
      const sym = order[i];
      const row = levels[sym] || {};
      const val =
        row.value == null ? "Data unavailable" : fmtNum(row.value, sym.indexOf("US") === 0 || sym.indexOf("BE") === 0 || sym.indexOf("REAL") === 0 ? 3 : 2);
      html +=
        '<div class="me-level"><div class="sym">' +
        esc(sym) +
        '</div><div class="val">' +
        esc(val) +
        '</div><div class="src">' +
        esc(row.source || "—") +
        (row.warning ? " · demo" : "") +
        "</div></div>";
    }
    html += "</div>";
    return html;
  }

  function renderAlerts(snap) {
    const items = (snap.alerts && snap.alerts.items) || [];
    if (!items.length) {
      return '<p class="me-empty">Aucune alerte de régime active pour le moment.</p>';
    }
    return (
      '<div class="me-alert-list">' +
      items
        .map(function (a) {
          return (
            '<div class="me-alert"><strong>⚠ ' +
            esc(a.title) +
            "</strong><p>" +
            esc(a.message) +
            "</p></div>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function renderSmt(snap) {
    const cards = [];
    const list = snap.smt || [];
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const signals = p.signals || [];
      if (!signals.length) {
        cards.push(
          '<div class="me-smt-card"><div class="side">SCAN</div><h4>' +
            esc(p.a + " / " + p.b) +
            '</h4><div class="str">Pas de SMT active · D1</div></div>'
        );
        continue;
      }
      for (let j = 0; j < signals.length; j++) {
        const s = signals[j];
        cards.push(
          '<div class="me-smt-card"><div class="side ' +
            esc(s.side) +
            '">' +
            esc(s.label) +
            "</div><h4>" +
            esc(s.pair) +
            '</h4><div class="str">Strength score : ' +
            esc(String(s.strength)) +
            "/100 · " +
            esc(s.timeframe) +
            "</div></div>"
        );
      }
    }
    return '<div class="me-smt-grid">' + cards.join("") + "</div>";
  }

  function renderMacroSmt(snap) {
    const m = snap.macroSmt || {};
    const cls = m.active ? "me-macro-smt" : "me-macro-smt inactive";
    let body =
      "<strong>" +
      esc(m.label || "MACRO SMT GOLD") +
      "</strong> · Score " +
      (m.score != null ? m.score + "/100" : "n/a");
    if (m.gold && m.gold.event) {
      body += "<div style=\"margin-top:0.4rem;font-size:0.86rem\">Gold : " + esc(m.gold.event) + "</div>";
    }
    const drivers = m.drivers || [];
    if (drivers.length) {
      body +=
        "<ul>" +
        drivers
          .map(function (d) {
            return "<li>" + esc(d.label) + " : " + esc(d.detail || d.status || "—") + "</li>";
          })
          .join("") +
        "</ul>";
    } else if (m.status) {
      body += '<p class="me-empty">' + esc(m.status) + "</p>";
    } else if (!m.active) {
      body += '<p class="me-empty">Pas de Macro SMT Gold active sur le scan actuel.</p>';
    }
    return '<div class="' + cls + '">' + body + "</div>";
  }

  function renderCorr(snap) {
    const corr = snap.correlations || {};
    const matrix = corr.matrix || {};
    const symbols = Object.keys(matrix);
    if (!symbols.length) {
      return '<p class="me-empty">Data unavailable</p>';
    }
    let table =
      '<div class="me-corr-scroll"><table class="me-corr-table"><thead><tr><th></th>';
    for (let i = 0; i < symbols.length; i++) {
      table += "<th>" + esc(symbols[i]) + "</th>";
    }
    table += "</tr></thead><tbody>";
    for (let r = 0; r < symbols.length; r++) {
      table += "<tr><th>" + esc(symbols[r]) + "</th>";
      for (let c = 0; c < symbols.length; c++) {
        const cell = (matrix[symbols[r]] && matrix[symbols[r]][symbols[c]]) || {};
        const coef = cell.coefficient;
        const txt =
          coef == null || !Number.isFinite(coef) ? "n/a" : coef.toFixed(2);
        table +=
          '<td class="' +
          heatClass(coef) +
          '" title="' +
          esc(cell.classification || "") +
          '">' +
          txt +
          "</td>";
      }
      table += "</tr>";
    }
    table += "</tbody></table></div>";

    const details = corr.details || {};
    let det = '<div class="me-corr-details">';
    const keys = Object.keys(details);
    for (let i = 0; i < keys.length; i++) {
      const d = details[keys[i]];
      if (!d || d.status === "Data unavailable") {
        det +=
          '<div class="me-corr-row"><span class="pair">' +
          esc(keys[i]) +
          '</span><span>Data unavailable</span></div>';
        continue;
      }
      const cur = d.current && d.current.coefficient;
      const nor = d.normal && d.normal.coefficient;
      det +=
        '<div class="me-corr-row"><span class="pair">' +
        esc(keys[i]) +
        "</span><span>CURRENT : " +
        (cur == null ? "n/a" : cur) +
        "</span><span>NORMAL : " +
        (nor == null ? "n/a" : nor) +
        "</span><span>SHIFT : " +
        (d.shift == null ? "n/a" : d.shift) +
        "</span>" +
        (d.breakdown
          ? '<span class="me-badge-break">⚠ CORRELATION BREAKDOWN</span>'
          : "") +
        "</div>";
    }
    det += "</div>";
    return (
      table +
      det +
      '<p class="me-score-note">' +
      esc(corr.note || "Corrélation ≠ causalité.") +
      "</p>"
    );
  }

  function renderRates(snap) {
    const r = snap.rateDecomposition || {};
    if (r.status === "Data unavailable") {
      return '<p class="me-empty">Data unavailable</p>';
    }
    function box(title, tip, row) {
      row = row || {};
      const chg = row.change20;
      const dir = row.direction || "flat";
      const chgTxt =
        chg == null
          ? "Data unavailable"
          : (chg > 0 ? "+" : "") + (chg * 100).toFixed(2) + "% / 20s";
      return (
        '<div class="me-rate-box"><div class="lbl">' +
        esc(title) +
        " " +
        helpIcon(tip) +
        '</div><div class="num">' +
        esc(row.last == null ? "Data unavailable" : fmtNum(row.last, 3)) +
        '</div><div class="chg ' +
        esc(dir) +
        '">' +
        esc(chgTxt) +
        " · " +
        esc(dir === "up" ? "↑" : dir === "down" ? "↓" : "→") +
        "</div></div>"
      );
    }
    return (
      '<div class="me-rates">' +
      box("US10Y nominal", null, r.nominal) +
      box(
        "Real Yield",
        snap.pedagogy && snap.pedagogy.realYield,
        r.realYield
      ) +
      box(
        "Breakeven",
        snap.pedagogy && snap.pedagogy.breakeven,
        r.breakeven
      ) +
      "</div>" +
      (r.reading ? '<p class="me-reading">' + esc(r.reading) + "</p>" : "")
    );
  }

  function renderExplain(snap) {
    const ex = snap.explain || {};
    return (
      '<div class="me-explain-actions">' +
      '<button type="button" class="btn btn-primary" id="me-explain-btn">Explique-moi le marché</button>' +
      "</div>" +
      '<pre class="me-explain" id="me-explain-out" hidden></pre>' +
      '<p class="me-score-note" id="me-explain-disc" hidden>' +
      esc(ex.disclaimer || "") +
      "</p>"
    );
  }

  function hasDemo(snap) {
    const meta = snap.seriesMeta || {};
    return Object.keys(meta).some(function (k) {
      return meta[k] && (meta[k].source === "demo" || meta[k].status === "demo_fallback");
    });
  }

  function render(root, snap) {
    const demoBanner = hasDemo(snap)
      ? '<div class="me-banner me-banner--demo">Certaines séries sont en mode DEMO (provider indisponible ou FRED_API_KEY manquante). Les niveaux affichés ne sont pas des prix de marché live.</div>'
      : "";

    root.innerHTML =
      '<div class="me-wrap">' +
      '<div class="me-hero">' +
      '<span class="forge-hero-tag">Espace membre · macro</span>' +
      "<h1>TORINVEST MACRO EDGE</h1>" +
      '<p class="me-sub">Live Market Intelligence — Gold Desk (MVP V1)</p>' +
      '<p class="me-philosophy">« ' +
      esc(snap.philosophy || "Le fondamental explique pourquoi ; la technique décide quand.") +
      " »</p>" +
      "</div>" +
      '<div class="me-toolbar">' +
      '<button type="button" class="btn btn-secondary active" data-me-mode="gold">GOLD DESK</button>' +
      '<button type="button" class="btn btn-secondary" disabled title="V2">FX DESK</button>' +
      '<span class="me-meta">MAJ : ' +
      esc(snap.updatedAt || "—") +
      " · TF " +
      esc(snap.timeframe || "D1") +
      "</span></div>" +
      demoBanner +
      renderDrivers(snap) +
      '<section class="me-section"><h2>Niveaux Gold Desk ' +
      helpIcon("Univers MVP : XAU XAG DXY US02Y US10Y REAL10Y BE10Y") +
      "</h2>" +
      renderLevels(snap) +
      "</section>" +
      '<section class="me-section"><h2>Alertes de régime</h2>' +
      '<p class="me-section-lead">Configurations détectées automatiquement — lecture pédagogique, pas des ordres.</p>' +
      renderAlerts(snap) +
      "</section>" +
      '<section class="me-section"><h2>Macro SMT ' +
      helpIcon(snap.pedagogy && snap.pedagogy.smt) +
      "</h2>" +
      renderMacroSmt(snap) +
      "</section>" +
      '<section class="me-section"><h2>SMT Scanner ' +
      helpIcon(snap.pedagogy && snap.pedagogy.smt) +
      "</h2>" +
      '<p class="me-section-lead">Paires prioritaires Gold Desk · timeframe D1 (M15/H1/H4 en V2 avec OHLC intraday).</p>' +
      renderSmt(snap) +
      "</section>" +
      '<section class="me-section"><h2>Correlation Matrix ' +
      helpIcon(snap.pedagogy && snap.pedagogy.correlation) +
      "</h2>" +
      '<p class="me-section-lead">Pearson sur returns · lookback ' +
      esc(String((snap.correlations && snap.correlations.lookback) || 50)) +
      "</p>" +
      renderCorr(snap) +
      "</section>" +
      '<section class="me-section"><h2>US Rate Decomposition</h2>' +
      '<p class="me-section-lead">Nominal vs réel vs breakeven — distinction pédagogique clé.</p>' +
      renderRates(snap) +
      "</section>" +
      '<section class="me-section"><h2>Explique-moi le marché</h2>' +
      renderExplain(snap) +
      "</section>" +
      '<div class="me-disclaimer">' +
      esc(
        snap.disclaimer ||
          "TORINVEST Macro Edge est un outil pédagogique et analytique. Les informations, scores, corrélations et signaux affichés ne constituent pas des conseils en investissement ni des recommandations d'achat ou de vente."
      ) +
      "</div></div>";

    const btn = document.getElementById("me-explain-btn");
    const out = document.getElementById("me-explain-out");
    const disc = document.getElementById("me-explain-disc");
    if (btn && out) {
      btn.addEventListener("click", function () {
        const ex = snap.explain || {};
        out.hidden = false;
        if (disc) disc.hidden = false;
        out.textContent = ex.text || "Data unavailable";
      });
    }
  }

  async function initMacroEdge() {
    const root = document.getElementById("macro-edge-root");
    if (!root) return;
    root.innerHTML = '<p class="me-loading">Chargement Macro Edge…</p>';
    try {
      const snap = await api("/api/macro-edge/snapshot");
      render(root, snap);
    } catch (err) {
      const msg =
        err && err.status === 403
          ? "Accès réservé aux membres Premium La Forge."
          : "Data unavailable — " + (err && err.message ? err.message : String(err));
      root.innerHTML =
        '<p class="me-loading">' + esc(msg) + "</p>";
    }
  }

  window.initMacroEdge = initMacroEdge;
})();
