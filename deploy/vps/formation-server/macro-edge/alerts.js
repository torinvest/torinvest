/**
 * Alertes de régime MVP V1 (Gold Desk).
 */
"use strict";

const { pctChange, lastClose } = require("./drivers");
const { atr } = require("./swingSmt");
const { correlationShift } = require("./correlation");

function buildAlerts(seriesMap, config, macroSmt) {
  const alerts = [];
  const thr = (config && config.alerts) || {};
  const corrCfg = (config && config.correlation) || {};

  const real = seriesMap.REAL10Y;
  const dxy = seriesMap.DXY;
  const gold = seriesMap.XAUUSD;
  const be = seriesMap.BE10Y;

  const dReal = real ? pctChange(real, 10) : null;
  if (dReal != null && Math.abs(dReal) >= (thr.realYieldShockPct || 0.08)) {
    alerts.push({
      id: "real_yield_shock",
      severity: "high",
      title: "REAL YIELD SHOCK",
      message:
        "US10Y real yield a bougé fortement sur ~10 séances (" +
        (Math.round(dReal * 1000) / 10) +
        "%). Contexte souvent important pour l'or.",
      color: "orange",
    });
  }

  if (dxy && dxy.bars && dxy.bars.length > 30) {
    const a = atr(dxy.bars, 14);
    const last = dxy.bars[dxy.bars.length - 1].c;
    const recent = dxy.bars.slice(-20).map((b) => b.h);
    const recentLow = dxy.bars.slice(-20).map((b) => b.l);
    const maxH = Math.max.apply(null, recent.slice(0, -1));
    const minL = Math.min.apply(null, recentLow.slice(0, -1));
    if (a && last > maxH + a * (thr.dollarBreakoutAtr || 1.5) * 0.15) {
      alerts.push({
        id: "dollar_breakout",
        severity: "medium",
        title: "DOLLAR BREAKOUT",
        message:
          "DXY (proxy) casse un plus haut récent — pression potentielle sur les actifs en USD.",
        color: "orange",
      });
    } else if (a && last < minL - a * (thr.dollarBreakoutAtr || 1.5) * 0.15) {
      alerts.push({
        id: "dollar_breakdown",
        severity: "medium",
        title: "DOLLAR BREAKDOWN",
        message: "DXY (proxy) casse un plus bas récent — contexte souvent plus favorable aux métaux.",
        color: "orange",
      });
    }
  }

  const dBe = be ? pctChange(be, 10) : null;
  if (dBe != null && Math.abs(dBe) >= (thr.inflationRepricingPct || 0.06)) {
    alerts.push({
      id: "inflation_repricing",
      severity: "medium",
      title: "INFLATION REPRICING",
      message:
        "Breakeven 10Y bouge fortement (" +
        (Math.round(dBe * 1000) / 10) +
        "%). Anticipations d'inflation en repricing.",
      color: "orange",
    });
  }

  // GOLD MACRO DISCONNECT : gold monte malgré DXY↑ et Real↑
  if (gold && dxy && real) {
    const g = pctChange(gold, 15);
    const d = pctChange(dxy, 15);
    const r = pctChange(real, 15);
    if (g != null && d != null && r != null && g > 0.01 && d > 0.005 && r > 0.01) {
      alerts.push({
        id: "gold_macro_disconnect",
        severity: "high",
        title: "GOLD MACRO DISCONNECT",
        message:
          "Gold monte malgré DXY↑ et Real Yield↑ — décorrélation macro à surveiller (pas un signal d'achat).",
        color: "orange",
      });
    }
  }

  if (gold && real && gold.bars && real.bars) {
    const shift = correlationShift(
      gold.bars,
      real.bars,
      20,
      100,
      corrCfg.breakdownThreshold || 0.35
    );
    if (shift.breakdown) {
      alerts.push({
        id: "corr_breakdown_xau_real",
        severity: "medium",
        title: "CORRELATION BREAKDOWN",
        message:
          "XAUUSD / REAL10Y : corrélation courte " +
          (shift.current.coefficient != null ? shift.current.coefficient : "n/a") +
          " vs historique " +
          (shift.normal.coefficient != null ? shift.normal.coefficient : "n/a") +
          ". Corrélation ≠ causalité.",
        color: "orange",
      });
    }
  }

  if (macroSmt && macroSmt.active) {
    alerts.push({
      id: "macro_smt_gold",
      severity: "high",
      title: "MACRO SMT GOLD",
      message:
        "Divergence prix Gold vs moteurs macro habituels (score " +
        macroSmt.score +
        "/100). Outil pédagogique — pas une recommandation.",
      color: "orange",
    });
  }

  return {
    items: alerts,
    updatedAt: new Date().toISOString(),
    levels: {
      XAUUSD: lastClose(gold),
      XAGUSD: lastClose(seriesMap.XAGUSD),
      DXY: lastClose(dxy),
      US02Y: lastClose(seriesMap.US02Y),
      US10Y: lastClose(seriesMap.US10Y),
      REAL10Y: lastClose(real),
      BE10Y: lastClose(be),
    },
  };
}

/**
 * Synthèse « Explique-moi le marché » — règles, pas LLM (V1).
 * Jamais ACHETER / VENDRE.
 */
function explainMarket(snapshot) {
  const lines = [];
  const usd = snapshot.usdDriver;
  const gold = snapshot.goldDriver;
  const rates = snapshot.rateDecomposition;
  const smt = snapshot.smt || [];
  const macro = snapshot.macroSmt;

  lines.push(
    "1. Politique monétaire — Central Bank Watch détaillé arrive en V2. Pour l'instant, le focus Gold Desk repose sur taux / dollar / breakeven."
  );

  if (usd && usd.score != null) {
    lines.push(
      "2. USD — score driver " +
        usd.score +
        " (" +
        usd.environment +
        "). Lecture relative du dollar via DXY et taux US, pas une prévision de change."
    );
  } else {
    lines.push("2. USD — données driver indisponibles pour le moment.");
  }

  if (rates && rates.reading) {
    lines.push("3. Taux — " + rates.reading);
  } else {
    lines.push("3. Taux — décomposition nominal / réel / breakeven indisponible.");
  }

  if (rates && rates.breakeven && rates.breakeven.direction) {
    const dir =
      rates.breakeven.direction === "up"
        ? "en hausse"
        : rates.breakeven.direction === "down"
          ? "en baisse"
          : "stable";
    lines.push(
      "4. Inflation — breakeven 10Y " +
        dir +
        ". Les anticipations d'inflation du marché évoluent ; ce n'est pas l'inflation réalisée."
    );
  } else {
    lines.push("4. Inflation — données breakeven indisponibles.");
  }

  lines.push(
    "5. Risk sentiment — VIX / indices non inclus dans le MVP V1 ; rester prudent sur toute lecture risk-on/off."
  );

  if (gold && gold.score != null) {
    lines.push(
      "6. Gold — driver " +
        gold.score +
        " (" +
        gold.environment +
        "). Le fondamental explique pourquoi ; la technique décide quand."
    );
  } else {
    lines.push("6. Gold — score driver indisponible.");
  }

  const smtLines = [];
  for (const p of smt) {
    for (const sig of p.signals || []) {
      smtLines.push(sig.label + " " + sig.pair + " (force " + sig.strength + "/100)");
    }
  }
  if (macro && macro.active) {
    smtLines.push("MACRO SMT GOLD active (score " + macro.score + "/100)");
  }
  if (smtLines.length) {
    lines.push("7. SMT — " + smtLines.slice(0, 3).join(" ; ") + ".");
  } else {
    lines.push("7. SMT — aucune divergence majeure détectée sur le scan Gold Desk actuel.");
  }

  lines.push(
    "8. Conclusion — contexte analytique uniquement. Aucun ordre automatique ; gardez la décision finale. Corrélation ≠ causalité."
  );

  return {
    text: lines.join("\n\n"),
    lines,
    language: "fr",
    disclaimer:
      "Synthèse pédagogique TORINVEST — pas un conseil en investissement ni une recommandation d'achat ou de vente.",
  };
}

module.exports = { buildAlerts, explainMarket };
