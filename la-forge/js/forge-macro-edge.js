/**
 * TORINVEST Macro Edge — Gold Desk + FX Desk UI
 */
(function () {
  "use strict";

  var currentDesk = "gold";

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

  function driverCard(label, tip, score, env) {
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

  function renderGoldDrivers(snap) {
    const gold = snap.goldDriver || {};
    const usd = snap.usdDriver || {};
    const be = snap.rateDecomposition && snap.rateDecomposition.breakeven;
    let inflScore = null;
    let inflEnv = "INFLATION — n/a";
    if (be && be.change20 != null) {
      inflScore = Math.round(
        Math.max(-100, Math.min(100, (be.change20 / 0.02) * 100))
      );
      inflEnv =
        be.direction === "up"
          ? "INFLATION EXPECTATIONS RISING"
          : be.direction === "down"
            ? "INFLATION EXPECTATIONS FALLING"
            : "INFLATION EXPECTATIONS STABLE";
    }

    return (
      '<div class="me-grid-drivers">' +
      driverCard(
        "USD DRIVER",
        "Force relative du dollar via DXY et taux US. Score analytique, pas une prévision.",
        usd.score,
        usd.environment || usd.status || ""
      ) +
      driverCard(
        "GOLD DRIVER",
        snap.pedagogy && snap.pedagogy.realYield
          ? snap.pedagogy.realYield
          : "Score Gold −100…+100 selon real yield, DXY, breakeven.",
        gold.score,
        gold.environment || gold.status || ""
      ) +
      driverCard(
        "RISK DRIVER",
        "VIX / indices arrivent plus tard. Placeholder neutre en Gold Desk.",
        0,
        "NEUTRAL (V2)"
      ) +
      driverCard(
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

  function renderFxDrivers(snap) {
    const usd = snap.usdDriver || {};
    const eur = snap.eurDriver || {};
    const risk = snap.riskDriver || {};
    const policy = snap.policyDriver || {};
    return (
      '<div class="me-grid-drivers">' +
      driverCard(
        "USD DRIVER",
        "DXY Worker + taux US + biais FED (Central Bank Watch).",
        usd.score,
        usd.environment || usd.status || ""
      ) +
      driverCard(
        "EUR DRIVER",
        snap.pedagogy && snap.pedagogy.monetaryDiff
          ? snap.pedagogy.monetaryDiff
          : "Différentiel ECB/FED + momentum EURUSD.",
        eur.score,
        eur.environment || eur.status || ""
      ) +
      driverCard(
        "RISK DRIVER",
        risk.note || "Proxy pédagogique AUD/NZD — pas un VIX.",
        risk.score,
        risk.environment || risk.status || ""
      ) +
      driverCard(
        "POLICY SPREAD",
        "Comparaison biais FED vs moyenne des banques pairs (−3…+3).",
        policy.score,
        policy.environment || policy.status || ""
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

  function renderLevels(snap, order, titleTip) {
    const levels = snap.levels || {};
    const keys = order && order.length ? order : Object.keys(levels);
    let html = '<div class="me-levels">';
    for (let i = 0; i < keys.length; i++) {
      const sym = keys[i];
      const row = levels[sym] || {};
      const yieldLike =
        sym.indexOf("US") === 0 ||
        sym.indexOf("BE") === 0 ||
        sym.indexOf("REAL") === 0;
      const val =
        row.value == null
          ? "Data unavailable"
          : fmtNum(row.value, yieldLike ? 3 : sym.indexOf("JPY") >= 0 ? 2 : 4);
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
      body +=
        '<div style="margin-top:0.4rem;font-size:0.86rem">Gold : ' +
        esc(m.gold.event) +
        "</div>";
    }
    const drivers = m.drivers || [];
    if (drivers.length) {
      body +=
        "<ul>" +
        drivers
          .map(function (d) {
            return (
              "<li>" +
              esc(d.label) +
              " : " +
              esc(d.detail || d.status || "—") +
              "</li>"
            );
          })
          .join("") +
        "</ul>";
    } else if (m.status) {
      body += '<p class="me-empty">' + esc(m.status) + "</p>";
    } else if (!m.active) {
      body +=
        '<p class="me-empty">Pas de Macro SMT Gold active sur le scan actuel.</p>';
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
        const cell =
          (matrix[symbols[r]] && matrix[symbols[r]][symbols[c]]) || {};
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
          "</span><span>Data unavailable</span></div>";
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

  function biasTone(score) {
    if (score == null || !Number.isFinite(score)) return "neu";
    if (score >= 1) return "hawk";
    if (score <= -1) return "dove";
    return "neu";
  }

  function renderCentralBanks(snap) {
    const watch = snap.centralBankWatch || {};
    const banks = watch.banks || [];
    if (!banks.length) {
      return '<p class="me-empty">Data unavailable</p>';
    }
    let html = '<div class="me-cb-grid">';
    for (let i = 0; i < banks.length; i++) {
      const b = banks[i];
      html +=
        '<div class="me-cb-card">' +
        '<div class="me-cb-head">' +
        "<strong>" +
        esc(b.id) +
        "</strong>" +
        '<span class="me-cb-ccy">' +
        esc(b.currency || "") +
        "</span></div>" +
        '<div class="me-cb-name">' +
        esc(b.name || "") +
        "</div>" +
        '<div class="me-cb-bias ' +
        biasTone(b.biasScore) +
        '">' +
        esc(b.bias || "NEUTRE") +
        " · " +
        esc(String(b.biasScore != null ? b.biasScore : "n/a")) +
        "</div>" +
        '<div class="me-cb-meta">' +
        esc(b.governor || "") +
        (b.nextMeeting ? " · next " + esc(b.nextMeeting) : "") +
        "</div>" +
        (b.sourceNote
          ? '<div class="me-cb-note">' + esc(b.sourceNote) + "</div>"
          : "") +
        "</div>";
    }
    html += "</div>";
    if (watch.disclaimer) {
      html +=
        '<p class="me-score-note">' + esc(watch.disclaimer) + "</p>";
    }
    return html;
  }

  function renderPolicyDiffs(snap) {
    const block = snap.policyDifferentials || {};
    const items = block.items || [];
    if (!items.length) {
      return '<p class="me-empty">Data unavailable</p>';
    }
    let html = '<div class="me-diff-list">';
    for (let i = 0; i < items.length; i++) {
      const d = items[i];
      if (d.status === "Data unavailable") {
        html +=
          '<div class="me-diff-row"><span class="pair">' +
          esc(d.pair) +
          "</span><span>Data unavailable</span></div>";
        continue;
      }
      const advClass =
        d.differential >= 1 ? "pos" : d.differential <= -1 ? "neg" : "neu";
      html +=
        '<div class="me-diff-row">' +
        '<span class="pair">' +
        esc(d.pair) +
        "</span>" +
        '<span class="adv ' +
        advClass +
        '">' +
        esc(d.advantage) +
        "</span>" +
        "<span>Δ " +
        esc(String(d.differential)) +
        " (" +
        esc(d.baseBank) +
        " " +
        esc(String(d.baseScore)) +
        " vs " +
        esc(d.quoteBank) +
        " " +
        esc(String(d.quoteScore)) +
        ")</span>" +
        '<span class="reading">' +
        esc(d.reading || "") +
        "</span></div>";
    }
    html += "</div>";
    html +=
      '<p class="me-score-note">' +
      esc(
        (snap.pedagogy && snap.pedagogy.monetaryDiff) ||
          block.disclaimer ||
          "Avantage relatif ≠ prédiction de direction."
      ) +
      "</p>";
    return html;
  }

  function renderExplain(snap) {
    return (
      '<div class="me-explain-actions">' +
      '<button type="button" class="btn btn-primary" id="me-explain-btn">Explique-moi le marché</button>' +
      "</div>" +
      '<pre class="me-explain" id="me-explain-out" hidden></pre>' +
      '<p class="me-score-note" id="me-explain-disc" hidden>' +
      esc((snap.explain && snap.explain.disclaimer) || "") +
      "</p>"
    );
  }

  function hasDemo(snap) {
    const meta = snap.seriesMeta || {};
    return Object.keys(meta).some(function (k) {
      return (
        meta[k] &&
        (meta[k].source === "demo" || meta[k].status === "demo_fallback")
      );
    });
  }

  function toolbar(snap, desk) {
    return (
      '<div class="me-toolbar">' +
      '<button type="button" class="btn btn-secondary' +
      (desk === "gold" ? " active" : "") +
      '" data-me-mode="gold">GOLD DESK</button>' +
      '<button type="button" class="btn btn-secondary' +
      (desk === "fx" ? " active" : "") +
      '" data-me-mode="fx">FX DESK</button>' +
      '<span class="me-meta">MAJ : ' +
      esc(snap.updatedAt || "—") +
      " · TF " +
      esc(snap.timeframe || "D1") +
      " · " +
      esc(snap.mode || "") +
      "</span></div>"
    );
  }

  function bindDeskSwitch(root) {
    const buttons = root.querySelectorAll("[data-me-mode]");
    for (let i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener("click", function () {
        const mode = this.getAttribute("data-me-mode");
        if (!mode || mode === currentDesk) return;
        currentDesk = mode;
        loadDesk(root, mode);
      });
    }
  }

  function bindExplain(snap) {
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

  function renderGold(root, snap) {
    const demoBanner = hasDemo(snap)
      ? '<div class="me-banner me-banner--demo">Certaines séries sont en mode DEMO (provider indisponible ou FRED_API_KEY manquante). Les niveaux affichés ne sont pas des prix de marché live.</div>'
      : "";

    root.innerHTML =
      '<div class="me-wrap">' +
      '<div class="me-hero">' +
      '<span class="forge-hero-tag">Espace membre · macro</span>' +
      "<h1>TORINVEST MACRO EDGE</h1>" +
      '<p class="me-sub">Live Market Intelligence — Gold Desk (MVP)</p>' +
      '<p class="me-philosophy">« ' +
      esc(
        snap.philosophy ||
          "Le fondamental explique pourquoi ; la technique décide quand."
      ) +
      " »</p>" +
      "</div>" +
      toolbar(snap, "gold") +
      demoBanner +
      renderGoldDrivers(snap) +
      '<section class="me-section"><h2>Niveaux Gold Desk ' +
      helpIcon("Univers : XAU XAG DXY US02Y US10Y REAL10Y BE10Y") +
      "</h2>" +
      renderLevels(snap, [
        "XAUUSD",
        "XAGUSD",
        "DXY",
        "US02Y",
        "US10Y",
        "REAL10Y",
        "BE10Y",
      ]) +
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
      '<p class="me-section-lead">Paires prioritaires Gold Desk · timeframe D1.</p>' +
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
          "TORINVEST Macro Edge est un outil pédagogique et analytique."
      ) +
      "</div></div>";

    bindDeskSwitch(root);
    bindExplain(snap);
  }

  function renderFx(root, snap) {
    const demoBanner = hasDemo(snap)
      ? '<div class="me-banner me-banner--demo">Certaines séries FX sont en mode DEMO (worker / seed historique indisponible). Les niveaux affichés ne sont pas tous des prix live.</div>'
      : "";
    const dxyNote = snap.dxyNote
      ? '<div class="me-banner">' + esc(snap.dxyNote) + "</div>"
      : "";

    const fxOrder = [
      "EURUSD",
      "GBPUSD",
      "USDJPY",
      "USDCAD",
      "AUDUSD",
      "NZDUSD",
      "EURJPY",
      "EURGBP",
      "DXY",
      "US02Y",
      "US10Y",
    ];

    root.innerHTML =
      '<div class="me-wrap">' +
      '<div class="me-hero">' +
      '<span class="forge-hero-tag">Espace membre · macro</span>' +
      "<h1>TORINVEST MACRO EDGE</h1>" +
      '<p class="me-sub">Live Market Intelligence — FX Desk (V2)</p>' +
      '<p class="me-philosophy">« ' +
      esc(
        snap.philosophy ||
          "Le fondamental explique pourquoi ; la technique décide quand."
      ) +
      " »</p>" +
      "</div>" +
      toolbar(snap, "fx") +
      demoBanner +
      dxyNote +
      renderFxDrivers(snap) +
      '<section class="me-section"><h2>Niveaux FX Desk ' +
      helpIcon(
        "Paires Worker + DXY Worker + yields FRED. DXY FX ≠ proxy FRED Gold Desk."
      ) +
      "</h2>" +
      renderLevels(snap, fxOrder) +
      "</section>" +
      '<section class="me-section"><h2>Central Bank Watch ' +
      helpIcon(
        "Scores −3…+3 configurables (admin). Pas de news auto — sources obligatoires en V3."
      ) +
      "</h2>" +
      '<p class="me-section-lead">Biais monétaire pédagogique — jamais traité comme une vérité certaine.</p>' +
      renderCentralBanks(snap) +
      "</section>" +
      '<section class="me-section"><h2>Différentiel monétaire ' +
      helpIcon(snap.pedagogy && snap.pedagogy.monetaryDiff) +
      "</h2>" +
      '<p class="me-section-lead">Avantage relatif entre banques centrales — pas une prédiction de direction de paire.</p>' +
      renderPolicyDiffs(snap) +
      "</section>" +
      '<section class="me-section"><h2>Alertes de régime</h2>' +
      '<p class="me-section-lead">Dollar, corrélations FX, déconnexion policy/prix, SMT.</p>' +
      renderAlerts(snap) +
      "</section>" +
      '<section class="me-section"><h2>SMT Scanner FX ' +
      helpIcon(snap.pedagogy && snap.pedagogy.smt) +
      "</h2>" +
      '<p class="me-section-lead">EUR/GBP, AUD/NZD, EURJPY/USDJPY · timeframe D1.</p>' +
      renderSmt(snap) +
      "</section>" +
      '<section class="me-section"><h2>Correlation Matrix FX ' +
      helpIcon(snap.pedagogy && snap.pedagogy.correlation) +
      "</h2>" +
      '<p class="me-section-lead">Pearson sur returns · lookback ' +
      esc(String((snap.correlations && snap.correlations.lookback) || 50)) +
      "</p>" +
      renderCorr(snap) +
      "</section>" +
      '<section class="me-section"><h2>Explique-moi le marché</h2>' +
      renderExplain(snap) +
      "</section>" +
      '<div class="me-disclaimer">' +
      esc(
        snap.disclaimer ||
          "TORINVEST Macro Edge est un outil pédagogique et analytique."
      ) +
      "</div></div>";

    bindDeskSwitch(root);
    bindExplain(snap);
  }

  function render(root, snap, desk) {
    if (desk === "fx") renderFx(root, snap);
    else renderGold(root, snap);
  }

  async function loadDesk(root, desk) {
    root.innerHTML =
      '<p class="me-loading">Chargement ' +
      (desk === "fx" ? "FX Desk" : "Gold Desk") +
      "…</p>";
    try {
      const snap = await api(
        "/api/macro-edge/snapshot?desk=" + encodeURIComponent(desk)
      );
      render(root, snap, desk);
    } catch (err) {
      const msg =
        err && err.status === 403
          ? "Accès réservé aux membres Premium La Forge."
          : "Data unavailable — " +
            (err && err.message ? err.message : String(err));
      root.innerHTML = '<p class="me-loading">' + esc(msg) + "</p>";
    }
  }

  async function initMacroEdge() {
    const root = document.getElementById("macro-edge-root");
    if (!root) return;
    currentDesk = "gold";
    await loadDesk(root, currentDesk);
  }

  window.initMacroEdge = initMacroEdge;
})();
