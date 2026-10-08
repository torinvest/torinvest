/**
 * Stratégies — La Forge / TORINVEST
 * Hub de cartes + fiche LP Reversal (hash routing).
 * Extensible : ajouter une entrée dans STRATEGIES (+ sections si disponible).
 */
(function () {
  "use strict";

  var CHECK_KEY = "forge-strat-checklist-lp-reversal";

  var COMING = [
    {
      slug: "power-of-three",
      name: "Power of Three",
      shortDescription: "Accumulation → Manipulation → Distribution. Modèle de session à venir.",
      level: "Intermédiaire",
      timeframes: "Daily · H1 · M15",
      markets: "Gold · Forex · Indices",
      status: "coming",
      badges: ["AMD", "SESSION"],
    },
    {
      slug: "amd",
      name: "AMD",
      shortDescription: "Cadre Accumulation / Manipulation / Distribution — fiche à venir.",
      level: "Intermédiaire",
      timeframes: "H4 · H1 · M15",
      markets: "Multi-marchés",
      status: "coming",
      badges: ["AMD"],
    },
    {
      slug: "smt",
      name: "SMT",
      shortDescription: "Smart Money Technique — divergences de corrélation. Fiche dédiée à venir.",
      level: "Avancé",
      timeframes: "H1 · M15 · M5",
      markets: "Gold · DXY · Indices · Forex",
      status: "coming",
      badges: ["SMT"],
    },
    {
      slug: "breaker-model",
      name: "Breaker Model",
      shortDescription: "Modèle Breaker autonome — complémentaire au LP Reversal. À venir.",
      level: "Intermédiaire",
      timeframes: "H1 · M15 · M5",
      markets: "Gold · Forex",
      status: "coming",
      badges: ["BREAKER"],
    },
    {
      slug: "seek-destroy",
      name: "Seek & Destroy",
      shortDescription: "Recherche et destruction de liquidité — fiche à venir.",
      level: "Avancé",
      timeframes: "M15 · M5",
      markets: "Gold · Indices",
      status: "coming",
      badges: ["LIQUIDITÉ"],
    },
    {
      slug: "asian-range",
      name: "Asian Range",
      shortDescription: "Range asiatique et manipulations de session — à venir.",
      level: "Débutant → Intermédiaire",
      timeframes: "H1 · M15",
      markets: "Forex · Gold",
      status: "coming",
      badges: ["ASIA"],
    },
    {
      slug: "judas-swing",
      name: "Judas Swing",
      shortDescription: "Fausse manipulation d’ouverture — fiche à venir.",
      level: "Intermédiaire",
      timeframes: "M15 · M5",
      markets: "Indices · Forex · Gold",
      status: "coming",
      badges: ["JUDAS"],
    },
  ];

  var LP_SECTIONS = [
    {
      id: "presentation",
      title: "Présentation de la stratégie",
      badges: ["BREAKER", "LP", "TARGET"],
      html: function () {
        return (
          "<p>Le <strong>LP Reversal</strong> est un modèle de retournement basé sur une séquence structurelle précise.</p>" +
          "<p>Il ne suffit pas d’avoir un Breaker ou un sweep isolé.</p>" +
          "<p>La stratégie repose sur l’enchaînement logique suivant :</p>" +
          flowChain([
            "Breaker",
            "Swing créateur",
            "Target Candle",
            "Target verrouillée",
            "Liquidity Pool",
            "Sweep",
            "Reclaim",
            "Displacement",
            "MSS",
            "Validation",
            "Retour vers la target",
          ]) +
          callout("key", "POINT CLÉ", "La stratégie doit toujours être analysée comme une <strong>séquence complète</strong>.")
        );
      },
    },
    {
      id: "logique",
      title: "Logique générale",
      badges: ["BREAKER", "LP", "MSS"],
      html: function () {
        return (
          "<p>Le marché crée d’abord une structure (Breaker), verrouille une cible issue du swing créateur, " +
          "puis étend souvent vers une liquidité (LP). Le retournement n’est valide qu’après sweep, reclaim, displacement et MSS.</p>" +
          callout("rule", "RÈGLE", "Aucun élément isolé (Breaker seul, sweep seul, MSS seul) ne constitue un LP Reversal.") +
          "<p>Le modèle peut servir :</p><ul>" +
          "<li><strong>Trend-following</strong> — aligné avec le biais HTF</li>" +
          "<li><strong>Counter-trend</strong> — contre le biais HTF (à préciser clairement dans le plan)</li>" +
          "</ul>"
        );
      },
    },
    {
      id: "breaker",
      title: "Construction du Breaker",
      badges: ["BREAKER"],
      html: function () {
        return (
          "<p>Le Breaker correspond à un ancien Order Block qui a été invalidé puis transformé en zone structurelle opposée.</p>" +
          '<div class="two-col">' +
          '<div class="mini-card bear"><h4>Exemple bearish</h4><p>Un ancien Bullish Order Block est cassé vers le bas. Cette cassure crée un <strong>Bearish Breaker</strong>.</p></div>' +
          '<div class="mini-card bull"><h4>Exemple bullish</h4><p>Un ancien Bearish Order Block est cassé vers le haut. Cette cassure crée un <strong>Bullish Breaker</strong>.</p></div>' +
          "</div>" +
          callout("attention", "ATTENTION", "Tous les Breakers ne sont pas valides.") +
          "<p>Le Breaker doit appartenir à une vraie structure avec :</p><ul>" +
          "<li>déplacement</li><li>rupture de structure</li><li>swing identifiable</li><li>contexte cohérent</li></ul>" +
          accordion(
            "Pourquoi un faux Breaker est dangereux",
            "<p>Un simple croisement d’un ancien OB sans displacement ni rupture claire n’est pas un Breaker utilisable. " +
              "Sans structure réelle, la Target Candle et le LP perdraient leur ancrage.</p>"
          )
        );
      },
    },
    {
      id: "swing-createur",
      title: "Identification du swing créateur",
      badges: ["BREAKER", "TARGET"],
      html: function () {
        return (
          "<p>Après identification du Breaker, il faut reconstruire le swing qui a créé ce Breaker.</p>" +
          callout("rule", "RÈGLE", "C’est une règle essentielle. On ne recherche pas la target au hasard sur le graphique.") +
          callout("key", "POINT CLÉ", "La target doit provenir du <strong>swing responsable de la création du Breaker</strong>.")
        );
      },
    },
    {
      id: "target-candle",
      title: "Target Candle",
      badges: ["TARGET"],
      html: function () {
        return (
          "<p>Règle principale du modèle :</p>" +
          '<div class="two-col">' +
          '<div class="mini-card bear"><h4>Cas Bearish Breaker</h4>' +
          "<p>Dans le swing baissier qui crée le Breaker, identifier la <strong>bougie acheteuse pertinente</strong>. " +
          "Si cette bougie participe à la cassure / inversion de l’ancien Bullish Order Block : " +
          "le <strong>HIGH</strong> de cette bougie devient la target du futur reversal LONG.</p></div>" +
          '<div class="mini-card bull"><h4>Cas Bullish Breaker</h4>' +
          "<p>Dans le swing haussier qui crée le Breaker, identifier la <strong>bougie vendeuse pertinente</strong>. " +
          "Le <strong>LOW</strong> de cette bougie devient la target du futur reversal SHORT.</p></div>" +
          "</div>" +
          callout("rule", "RÈGLE", "Cette Target Candle doit être <strong>verrouillée</strong> une fois identifiée.")
        );
      },
    },
    {
      id: "liquidity-pool",
      title: "Liquidity Pool",
      badges: ["LP"],
      html: function () {
        return (
          "<p>Après la création du Breaker, le marché peut continuer son delivery.</p>" +
          "<p>Le Liquidity Pool correspond à une zone de liquidité significative créée pendant cette extension.</p>" +
          callout("error", "ERREUR FRÉQUENTE", "Ne pas considérer chaque petit swing comme un LP.") +
          "<p>Privilégier :</p><ul>" +
          "<li>swing high / swing low significatif</li>" +
          "<li>equal highs / equal lows</li>" +
          "<li>session high / session low</li>" +
          "<li>liquidity externe</li>" +
          "<li>liquidity propre et non encore touchée</li></ul>" +
          callout("key", "POINT CLÉ", "Le LP doit rester identifié comme <strong>« frais »</strong> tant qu’il n’a pas été touché.")
        );
      },
    },
    {
      id: "sweep",
      title: "Sweep du LP",
      badges: ["LP", "SWEEP"],
      html: function () {
        return (
          "<p>Le Sweep correspond à la prise du Liquidity Pool.</p>" +
          '<div class="two-col">' +
          '<div class="mini-card bull"><h4>Futur LONG</h4><p>Le prix passe <strong>sous</strong> le LP.</p></div>' +
          '<div class="mini-card bear"><h4>Futur SHORT</h4><p>Le prix passe <strong>au-dessus</strong> du LP.</p></div>' +
          "</div>" +
          callout("attention", "ATTENTION", "Le sweep seul ne valide <strong>jamais</strong> une entrée.")
        );
      },
    },
    {
      id: "reclaim",
      title: "Reclaim",
      badges: ["SWEEP", "LP"],
      html: function () {
        return (
          "<p>Après le sweep, le prix doit reprendre le niveau.</p>" +
          '<div class="two-col">' +
          '<div class="mini-card bull"><h4>LONG</h4><p>Sweep sous le LP puis clôture / reprise <strong>au-dessus</strong>.</p></div>' +
          '<div class="mini-card bear"><h4>SHORT</h4><p>Sweep au-dessus du LP puis clôture / reprise <strong>en dessous</strong>.</p></div>' +
          "</div>" +
          callout("key", "POINT CLÉ", "Le reclaim constitue une première confirmation mais <strong>pas encore</strong> un signal final.")
        );
      },
    },
    {
      id: "displacement",
      title: "Displacement",
      badges: ["MSS"],
      html: function () {
        return (
          "<p>Après le reclaim, rechercher un déplacement clair dans le sens du retournement.</p>" +
          "<p>Le displacement doit montrer :</p><ul>" +
          "<li>expansion réelle</li><li>impulsion</li><li>déséquilibre</li>" +
          "<li>rejet de la zone sweepée</li><li>idéalement création d’un FVG</li>" +
          "<li>changement dans le delivery</li></ul>" +
          callout("error", "ERREUR FRÉQUENTE", "Ne pas réduire le displacement à une simple grosse bougie.")
        );
      },
    },
    {
      id: "mss",
      title: "MSS",
      badges: ["MSS"],
      html: function () {
        return (
          "<p>Le MSS valide le changement structurel.</p>" +
          '<div class="two-col">' +
          '<div class="mini-card bull"><h4>LONG</h4><p>Cassure d’un <strong>structural high</strong> pertinent.</p></div>' +
          '<div class="mini-card bear"><h4>SHORT</h4><p>Cassure d’un <strong>structural low</strong> pertinent.</p></div>' +
          "</div>" +
          callout(
            "rule",
            "RÈGLE",
            "Le niveau MSS doit être identifié et verrouillé à partir de la structure <strong>précédant le sweep</strong>."
          ) +
          callout("attention", "ATTENTION", "Ne pas déplacer en permanence le niveau MSS au fur et à mesure que de nouveaux pivots apparaissent.")
        );
      },
    },
    {
      id: "validation",
      title: "Validation finale",
      badges: ["BREAKER", "LP", "SWEEP", "MSS", "TARGET"],
      html: function () {
        return (
          "<p>Le setup n’est considéré valide que lorsque la séquence suivante est complète :</p>" +
          flowChain([
            "Breaker validé",
            "Target Candle",
            "Target verrouillée",
            "LP valide",
            "Sweep",
            "Reclaim",
            "Displacement",
            "MSS",
          ]) +
          callout("rule", "RÈGLE", "Seulement après cette séquence : <strong>LP REVERSAL VALID</strong>.")
        );
      },
    },
    {
      id: "invalidation",
      title: "Invalidation",
      badges: ["BREAKER", "LP"],
      html: function () {
        return (
          "<p>Principales invalidations du modèle :</p><ul>" +
          "<li>Breaker invalidé</li>" +
          "<li>LP non pertinent</li>" +
          "<li>Absence de reclaim</li>" +
          "<li>Absence de displacement</li>" +
          "<li>Pas de MSS</li>" +
          "<li>Structure HTF contraire sans justification</li>" +
          "<li>Target déjà atteinte avant validation</li>" +
          "<li>Setup trop ancien</li>" +
          "<li>Setup structurellement dépassé</li></ul>" +
          callout("attention", "ATTENTION", "Dès qu’une invalidation est claire, le setup est abandonné — pas de « forçage ».")
        );
      },
    },
    {
      id: "target",
      title: "Target",
      badges: ["TARGET"],
      html: function () {
        return (
          "<p>La target est celle issue de la Target Candle du swing créateur :</p><ul>" +
          "<li><strong>Futur LONG</strong> après Bearish Breaker → high de la bougie acheteuse pertinente</li>" +
          "<li><strong>Futur SHORT</strong> après Bullish Breaker → low de la bougie vendeuse pertinente</li></ul>" +
          callout("rule", "RÈGLE", "La target est verrouillée. On ne la remplace pas par un autre swing « plus joli ».") +
          callout("key", "POINT CLÉ", "Après validation complète, le scénario attend le retour vers cette target (souvent via pullback d’entrée).")
        );
      },
    },
    {
      id: "tda",
      title: "Top Down Analysis",
      badges: ["BREAKER"],
      html: function () {
        return (
          "<p>Le LP Reversal ne doit pas être analysé uniquement sur le timeframe d’exécution.</p>" +
          "<p>Inclure dans l’analyse :</p><ul>" +
          "<li>contexte HTF</li><li>biais Daily</li><li>biais H4</li>" +
          "<li>structure intermédiaire</li><li>timeframe d’exécution</li>" +
          "<li>liquidité HTF</li><li>dealing range</li></ul>" +
          "<p>Le LP Reversal peut être <strong>trend-following</strong> ou <strong>counter-trend</strong>.</p>" +
          callout(
            "rule",
            "RÈGLE",
            "Si counter-trend, le préciser clairement. Exemple : <em>HTF Bias : Bearish — Setup : Counter-Trend LONG</em>."
          )
        );
      },
    },
    {
      id: "premium-discount",
      title: "Premium / Discount",
      badges: ["TARGET"],
      html: function () {
        return (
          "<p>Le Premium / Discount sert de filtre contextuel dans le dealing range.</p>" +
          '<div class="two-col">' +
          '<div class="mini-card bull"><h4>LONG préféré</h4><p>Zone de <strong>Discount</strong>.</p></div>' +
          '<div class="mini-card bear"><h4>SHORT préféré</h4><p>Zone de <strong>Premium</strong>.</p></div>' +
          "</div>" +
          callout(
            "attention",
            "ATTENTION",
            "Cette règle n’est <strong>pas absolue</strong>. Elle filtre le contexte ; elle n’invalide pas seule une séquence structurelle complète."
          )
        );
      },
    },
    {
      id: "smt",
      title: "SMT",
      badges: ["SMT"],
      html: function () {
        return (
          "<p>Le SMT (Smart Money Technique) est une <strong>confluence optionnelle</strong>, jamais une obligation du modèle.</p>" +
          "<p>Présentation adaptée aux marchés corrélés :</p><ul>" +
          "<li><strong>Gold</strong> vs DXY / Silver</li>" +
          "<li><strong>DXY</strong> vs paires majeures / indices</li>" +
          "<li><strong>Silver</strong> vs Gold</li>" +
          "<li><strong>Indices</strong> entre eux (ex. ES / NQ)</li>" +
          "<li><strong>Forex corrélés</strong> (ex. EURUSD / GBPUSD)</li></ul>" +
          callout("key", "POINT CLÉ", "Un SMT peut renforcer la conviction après sweep/reclaim ; son absence ne casse pas un LP Reversal sinon valide.")
        );
      },
    },
    {
      id: "sessions",
      title: "Sessions et timing",
      badges: ["LP", "SWEEP"],
      html: function () {
        return (
          "<p>Timing à surveiller :</p><ul>" +
          "<li>Asia</li><li>London</li><li>New York</li>" +
          "<li>Kill Zones</li><li>Session High / Low</li>" +
          "<li>High / Low de la veille</li><li>Weekly High / Low</li></ul>" +
          callout(
            "key",
            "POINT CLÉ",
            "Un LP Reversal devient plus intéressant lorsqu’il intervient autour de liquidités temporelles importantes."
          )
        );
      },
    },
    {
      id: "checklist",
      title: "Checklist opérationnelle",
      badges: ["BREAKER", "LP", "SWEEP", "MSS", "TARGET"],
      html: function () {
        return '<div id="lp-checklist-root"></div>';
      },
    },
    {
      id: "exemple-long",
      title: "Exemple LONG",
      badges: ["BREAKER", "LP", "SWEEP", "MSS", "TARGET"],
      html: function () {
        return (
          "<p>Séquence pédagogique d’un LP Reversal LONG :</p>" +
          flowChain([
            "Bearish Breaker",
            "Target Candle (high)",
            "Extension baissière",
            "LP en dessous",
            "Sweep",
            "Reclaim",
            "Displacement haussier",
            "MSS",
            "Retour Target",
          ]) +
          longDiagram()
        );
      },
    },
    {
      id: "exemple-short",
      title: "Exemple SHORT",
      badges: ["BREAKER", "LP", "SWEEP", "MSS", "TARGET"],
      html: function () {
        return (
          "<p>Séquence miroir d’un LP Reversal SHORT :</p>" +
          flowChain([
            "Bullish Breaker",
            "Target Candle (low)",
            "Extension haussière",
            "LP au-dessus",
            "Sweep",
            "Reclaim",
            "Displacement baissier",
            "MSS",
            "Retour Target",
          ]) +
          shortDiagram()
        );
      },
    },
    {
      id: "erreurs",
      title: "Erreurs fréquentes",
      badges: ["LP", "SWEEP", "TARGET"],
      html: function () {
        var errs = [
          "Considérer tous les pivots comme des LP",
          "Considérer toutes les bougies opposées comme Target Candle",
          "Entrer uniquement sur sweep",
          "Entrer sans MSS",
          "Mélanger Breaker d’un setup et LP d’un autre",
          "Prendre une target appartenant à un autre swing",
          "Ignorer le contexte HTF",
          "Confondre retracement et véritable reversal",
          "Chaser le mouvement",
          "Entrer sans pullback",
        ];
        return (
          '<div class="error-grid">' +
          errs.map(function (e) {
            return '<div class="error-card">' + e + "</div>";
          }).join("") +
          "</div>"
        );
      },
    },
    {
      id: "resume",
      title: "Résumé du modèle",
      badges: ["BREAKER", "LP", "SWEEP", "MSS", "TARGET"],
      html: function () {
        var steps = [
          "BREAKER",
          "SWING CRÉATEUR",
          "TARGET CANDLE",
          "TARGET LOCK",
          "LP",
          "SWEEP",
          "RECLAIM",
          "DISPLACEMENT",
          "MSS",
          "ENTRY / PULLBACK",
          "TARGET",
        ];
        return (
          '<div class="summary-block">' +
          "<h3>LP REVERSAL</h3>" +
          '<ol class="summary-steps">' +
          steps
            .map(function (s, i) {
              return "<li><span class=\"n\">" + String(i + 1).padStart(2, "0") + "</span><span>" + s + "</span></li>";
            })
            .join("") +
          "</ol>" +
          '<p class="summary-quote">« Le modèle n’est pas un signal isolé. C’est une séquence structurelle. »</p>' +
          "</div>"
        );
      },
    },
  ];

  var CHECKLIST = [
    {
      group: "CONTEXTE",
      items: [
        "HTF analysé",
        "Bias identifié",
        "Premium / Discount vérifié",
        "Liquidité HTF identifiée",
        "Session connue",
      ],
    },
    {
      group: "STRUCTURE",
      items: [
        "Breaker valide",
        "Swing créateur identifié",
        "Target Candle identifiée",
        "Target verrouillée",
      ],
    },
    {
      group: "LIQUIDITÉ",
      items: ["LP valide", "LP frais", "Sweep confirmé"],
    },
    {
      group: "CONFIRMATION",
      items: ["Reclaim", "Displacement", "FVG si applicable", "MSS"],
    },
    {
      group: "RISQUE",
      items: [
        "Invalidation définie",
        "Target définie",
        "RR acceptable",
        "Pas d’entrée impulsive",
        "Pullback attendu si nécessaire",
      ],
    },
  ];

  var LP_STRATEGY = {
    slug: "lp-reversal",
    name: "LP REVERSAL",
    subtitle:
      "Modèle de retournement basé sur Breaker, Liquidity Pool, Sweep, Reclaim, Displacement et MSS",
    shortDescription:
      "Retournement structurel : Breaker → Target Candle → LP → Sweep → Reclaim → Displacement → MSS → Target.",
    level: "Intermédiaire → Avancé",
    timeframes: "Daily / H4 (contexte) · H1 / M15 / M5 (exécution)",
    markets: "Gold · Forex · Indices",
    status: "available",
    badges: ["BREAKER", "LP", "SWEEP", "MSS", "TARGET"],
    sections: LP_SECTIONS,
  };

  var STRATEGIES = [LP_STRATEGY].concat(COMING);

  /* ——— Helpers markup ——— */
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function flowChain(items) {
    return (
      '<div class="flow-chain" role="list">' +
      items
        .map(function (it, i) {
          return (
            (i ? '<span class="arr" aria-hidden="true">→</span>' : "") +
            "<span role=\"listitem\">" +
            escapeHtml(it) +
            "</span>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function callout(type, label, body) {
    return (
      '<div class="callout ' +
      type +
      '"><span class="ck">' +
      escapeHtml(label) +
      "</span><p>" +
      body +
      "</p></div>"
    );
  }

  function accordion(title, body) {
    return (
      '<details class="accordion"><summary>' +
      escapeHtml(title) +
      '</summary><div class="acc-body">' +
      body +
      "</div></details>"
    );
  }

  function longDiagram() {
    return (
      '<div class="diagram" aria-label="Schéma LP Reversal LONG">' +
      '<div class="diagram-head"><strong>SCHÉMA LONG</strong><span>PÉDAGOGIQUE</span></div>' +
      '<svg viewBox="0 0 640 220" xmlns="http://www.w3.org/2000/svg" role="img">' +
      '<rect width="640" height="220" fill="#121722"/>' +
      '<text x="24" y="28" fill="#e8c36a" font-size="11" font-family="monospace">BEARISH BREAKER</text>' +
      '<rect x="40" y="40" width="70" height="36" rx="3" fill="none" stroke="#e07a6a" stroke-width="2"/>' +
      '<text x="48" y="62" fill="#e07a6a" font-size="10" font-family="monospace">BREAKER</text>' +
      '<text x="130" y="28" fill="#7dd3c0" font-size="11" font-family="monospace">TARGET CANDLE</text>' +
      '<line x1="150" y1="50" x2="220" y2="50" stroke="#7dd3c0" stroke-width="2" stroke-dasharray="4 3"/>' +
      '<text x="224" y="54" fill="#7dd3c0" font-size="10" font-family="monospace">TARGET ↑</text>' +
      '<path d="M80 90 L140 120 L200 150 L280 175 L340 185" fill="none" stroke="#9aa3b5" stroke-width="2"/>' +
      '<text x="300" y="208" fill="#e8c36a" font-size="11" font-family="monospace">LP</text>' +
      '<line x1="280" y1="185" x2="400" y2="185" stroke="#e8c36a" stroke-width="1.5" stroke-dasharray="3 3"/>' +
      '<path d="M340 185 L360 200 L390 170 L430 145 L480 120 L540 95" fill="none" stroke="#3dcf8e" stroke-width="2.5"/>' +
      '<circle cx="360" cy="200" r="4" fill="#e07a6a"/>' +
      '<text x="368" y="212" fill="#e07a6a" font-size="9" font-family="monospace">SWEEP</text>' +
      '<text x="400" y="160" fill="#7dd3c0" font-size="9" font-family="monospace">RECLAIM</text>' +
      '<text x="460" y="110" fill="#3dcf8e" font-size="9" font-family="monospace">DISP. + MSS</text>' +
      '<text x="520" y="80" fill="#7dd3c0" font-size="9" font-family="monospace">→ TARGET</text>' +
      "</svg>" +
      '<p class="diagram-caption">Bearish Breaker → Target Candle au-dessus → extension → LP → sweep → reclaim → displacement → MSS → retour Target.</p>' +
      "</div>"
    );
  }

  function shortDiagram() {
    return (
      '<div class="diagram" aria-label="Schéma LP Reversal SHORT">' +
      '<div class="diagram-head"><strong>SCHÉMA SHORT</strong><span>PÉDAGOGIQUE</span></div>' +
      '<svg viewBox="0 0 640 220" xmlns="http://www.w3.org/2000/svg" role="img">' +
      '<rect width="640" height="220" fill="#121722"/>' +
      '<text x="24" y="28" fill="#e8c36a" font-size="11" font-family="monospace">BULLISH BREAKER</text>' +
      '<rect x="40" y="140" width="70" height="36" rx="3" fill="none" stroke="#3dcf8e" stroke-width="2"/>' +
      '<text x="48" y="162" fill="#3dcf8e" font-size="10" font-family="monospace">BREAKER</text>' +
      '<text x="130" y="200" fill="#7dd3c0" font-size="11" font-family="monospace">TARGET CANDLE ↓</text>' +
      '<line x1="150" y1="175" x2="220" y2="175" stroke="#7dd3c0" stroke-width="2" stroke-dasharray="4 3"/>' +
      '<path d="M80 130 L140 100 L200 70 L280 45 L340 35" fill="none" stroke="#9aa3b5" stroke-width="2"/>' +
      '<text x="300" y="24" fill="#e8c36a" font-size="11" font-family="monospace">LP</text>' +
      '<line x1="280" y1="35" x2="400" y2="35" stroke="#e8c36a" stroke-width="1.5" stroke-dasharray="3 3"/>' +
      '<path d="M340 35 L360 20 L390 50 L430 75 L480 100 L540 125" fill="none" stroke="#e07a6a" stroke-width="2.5"/>' +
      '<circle cx="360" cy="20" r="4" fill="#e07a6a"/>' +
      '<text x="368" y="18" fill="#e07a6a" font-size="9" font-family="monospace">SWEEP</text>' +
      '<text x="400" y="60" fill="#7dd3c0" font-size="9" font-family="monospace">RECLAIM</text>' +
      '<text x="460" y="110" fill="#e07a6a" font-size="9" font-family="monospace">DISP. + MSS</text>' +
      '<text x="500" y="145" fill="#7dd3c0" font-size="9" font-family="monospace">→ TARGET</text>' +
      "</svg>" +
      '<p class="diagram-caption">Bullish Breaker → Target Candle en dessous → extension → LP → sweep → reclaim → displacement → MSS → retour Target.</p>' +
      "</div>"
    );
  }

  /* ——— Routing ——— */
  function currentSlug() {
    var h = (location.hash || "").replace(/^#/, "");
    if (!h || h === "hub") return null;
    return h;
  }

  function findStrategy(slug) {
    for (var i = 0; i < STRATEGIES.length; i++) {
      if (STRATEGIES[i].slug === slug) return STRATEGIES[i];
    }
    return null;
  }

  /* ——— Hub ——— */
  function renderHub() {
    var cards = STRATEGIES.map(function (s) {
      var available = s.status === "available";
      return (
        '<article class="strat-card' +
        (available ? "" : " is-coming") +
        '">' +
        '<div class="strat-card-top">' +
        "<h3>" +
        escapeHtml(s.name) +
        "</h3>" +
        '<span class="status-pill ' +
        (available ? "available" : "coming") +
        '">' +
        (available ? "Disponible" : "À venir") +
        "</span></div>" +
        '<p class="desc">' +
        escapeHtml(s.shortDescription) +
        "</p>" +
        '<ul class="meta-list">' +
        "<li><span class=\"k\">Niveau</span><span>" +
        escapeHtml(s.level) +
        "</span></li>" +
        "<li><span class=\"k\">Timeframes</span><span>" +
        escapeHtml(s.timeframes) +
        "</span></li>" +
        "<li><span class=\"k\">Marchés</span><span>" +
        escapeHtml(s.markets) +
        "</span></li>" +
        "</ul>" +
        '<div class="badge-row">' +
        (s.badges || [])
          .map(function (b) {
            return '<span class="tag-badge">' + escapeHtml(b) + "</span>";
          })
          .join("") +
        "</div>" +
        (available
          ? '<a class="btn-strat primary" href="#' +
            encodeURIComponent(s.slug) +
            '">Voir la stratégie</a>'
          : '<span class="btn-strat disabled">Bientôt disponible</span>') +
        "</article>"
      );
    }).join("");

    return (
      '<div class="hub">' +
      '<div class="hub-intro">' +
      '<span class="eyebrow">CATALOGUE</span>' +
      "<h2>Choisis une stratégie</h2>" +
      "<p>Chaque fiche détaille la séquence, les règles, les invalidations et une checklist opérationnelle. " +
      "Les cartes « À venir » réservent la place pour les prochains modèles TORINVEST.</p>" +
      "</div>" +
      '<div class="strat-grid">' +
      cards +
      "</div></div>"
    );
  }

  /* ——— Detail ——— */
  function renderDetail(strat) {
    var sections = strat.sections || [];
    var toc = sections
      .map(function (sec, i) {
        return (
          '<a href="#' +
          encodeURIComponent(strat.slug) +
          "/" +
          encodeURIComponent(sec.id) +
          '" data-sec="' +
          escapeHtml(sec.id) +
          '">' +
          String(i + 1).padStart(2, "0") +
          " · " +
          escapeHtml(sec.title) +
          "</a>"
        );
      })
      .join("");

    var body = sections
      .map(function (sec, i) {
        var badges = (sec.badges || [])
          .map(function (b) {
            return '<span class="tag-badge">' + escapeHtml(b) + "</span>";
          })
          .join("");
        return (
          '<section class="section" id="sec-' +
          escapeHtml(sec.id) +
          '" data-section-index="' +
          i +
          '">' +
          '<span class="section-num">SECTION ' +
          String(i + 1).padStart(2, "0") +
          "</span>" +
          "<h2>" +
          escapeHtml(sec.title) +
          "</h2>" +
          (badges ? '<div class="badge-row" style="margin-bottom:12px">' + badges + "</div>" : "") +
          sec.html() +
          "</section>"
        );
      })
      .join("");

    var heroBadges = (strat.badges || [])
      .map(function (b) {
        return '<span class="tag-badge">' + escapeHtml(b) + "</span>";
      })
      .join("");

    return (
      '<div class="detail-shell">' +
      '<aside class="toc" aria-label="Sommaire">' +
      '<div class="toc-heading">Sommaire <span>' +
      sections.length +
      "</span></div>" +
      '<nav class="toc-nav" id="str-toc">' +
      toc +
      "</nav>" +
      '<div class="toc-progress">' +
      "<span>Progression</span>" +
      '<div class="bar"><i id="str-prog-bar"></i></div>' +
      '<span id="str-prog-label">0 / ' +
      sections.length +
      "</span></div>" +
      "</aside>" +
      '<main id="str-main" tabindex="-1">' +
      '<header class="strat-hero">' +
      '<span class="eyebrow">STRATÉGIE · TORINVEST</span>' +
      "<h1>" +
      escapeHtml(strat.name) +
      "</h1>" +
      '<p class="lead">' +
      escapeHtml(strat.subtitle || strat.shortDescription) +
      "</p>" +
      '<div class="hero-badges">' +
      heroBadges +
      "</div>" +
      "</header>" +
      body +
      '<div class="section-nav">' +
      '<button type="button" id="str-prev">← Section précédente</button>' +
      '<span class="page-count" id="str-page-count">1 / ' +
      sections.length +
      "</span>" +
      '<button type="button" id="str-next">Section suivante →</button>' +
      "</div>" +
      '<p class="risk-foot">Ressource pédagogique La Forge. Les schémas sont illustratifs. ' +
      "Aucune stratégie ne garantit un résultat. Process, invalidation et gestion du risque restent obligatoires.</p>" +
      "</main></div>"
    );
  }

  /* ——— Checklist ——— */
  function loadChecks() {
    try {
      return JSON.parse(localStorage.getItem(CHECK_KEY) || "{}") || {};
    } catch (e) {
      return {};
    }
  }

  function saveChecks(map) {
    try {
      localStorage.setItem(CHECK_KEY, JSON.stringify(map));
    } catch (e) {}
  }

  function totalCheckItems() {
    var n = 0;
    CHECKLIST.forEach(function (g) {
      n += g.items.length;
    });
    return n;
  }

  function statusLabel(done, total) {
    if (done <= 0) return { cls: "incomplete", text: "SETUP INCOMPLET" };
    if (done < total) return { cls: "building", text: "SETUP EN CONSTRUCTION" };
    return { cls: "valid", text: "SETUP VALIDÉ" };
  }

  function mountChecklist() {
    var root = document.getElementById("lp-checklist-root");
    if (!root) return;
    var state = loadChecks();
    var total = totalCheckItems();

    function paint() {
      var done = 0;
      var html = "";
      CHECKLIST.forEach(function (g, gi) {
        html += '<div class="check-group"><h4>' + escapeHtml(g.group) + "</h4>";
        g.items.forEach(function (label, ii) {
          var key = gi + "-" + ii;
          var on = !!state[key];
          if (on) done++;
          html +=
            '<label class="check-item' +
            (on ? " is-done" : "") +
            '"><input type="checkbox" data-ck="' +
            key +
            '"' +
            (on ? " checked" : "") +
            " /> <span>" +
            escapeHtml(label) +
            "</span></label>";
        });
        html += "</div>";
      });
      var st = statusLabel(done, total);
      root.innerHTML =
        '<div class="checklist-panel">' +
        '<div class="check-status ' +
        st.cls +
        '" id="check-status-pill">' +
        st.text +
        " · " +
        done +
        "/" +
        total +
        "</div>" +
        html +
        "</div>";

      root.querySelectorAll("input[data-ck]").forEach(function (inp) {
        inp.addEventListener("change", function () {
          state[inp.getAttribute("data-ck")] = inp.checked;
          saveChecks(state);
          paint();
        });
      });
    }
    paint();
  }

  /* ——— Detail interactions ——— */
  function bindDetail(strat) {
    var sections = strat.sections || [];
    var toc = document.getElementById("str-toc");
    var progBar = document.getElementById("str-prog-bar");
    var progLabel = document.getElementById("str-prog-label");
    var pageCount = document.getElementById("str-page-count");
    var prevBtn = document.getElementById("str-prev");
    var nextBtn = document.getElementById("str-next");
    var activeIndex = 0;
    var seen = {};

    function parseSectionHash() {
      var h = (location.hash || "").replace(/^#/, "");
      var parts = h.split("/");
      if (parts.length >= 2 && parts[0] === strat.slug) return parts[1];
      return null;
    }

    function setActive(idx, scroll) {
      if (idx < 0 || idx >= sections.length) return;
      activeIndex = idx;
      var sec = sections[idx];
      seen[sec.id] = true;
      if (toc) {
        toc.querySelectorAll("a").forEach(function (a, i) {
          a.classList.toggle("active", i === idx);
        });
      }
      if (pageCount) pageCount.textContent = idx + 1 + " / " + sections.length;
      if (prevBtn) prevBtn.disabled = idx === 0;
      if (nextBtn) nextBtn.disabled = idx === sections.length - 1;
      var seenCount = Object.keys(seen).length;
      if (progBar) progBar.style.width = Math.round((seenCount / sections.length) * 100) + "%";
      if (progLabel) progLabel.textContent = seenCount + " / " + sections.length;
      if (scroll) {
        var el = document.getElementById("sec-" + sec.id);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      var desired = "#" + strat.slug + "/" + sec.id;
      if (location.hash !== desired) {
        history.replaceState(null, "", desired);
      }
    }

    if (toc) {
      toc.querySelectorAll("a").forEach(function (a, i) {
        a.addEventListener("click", function (e) {
          e.preventDefault();
          setActive(i, true);
        });
      });
    }
    if (prevBtn) {
      prevBtn.addEventListener("click", function () {
        setActive(activeIndex - 1, true);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        setActive(activeIndex + 1, true);
      });
    }

    var initial = parseSectionHash();
    var startIdx = 0;
    if (initial) {
      for (var i = 0; i < sections.length; i++) {
        if (sections[i].id === initial) {
          startIdx = i;
          break;
        }
      }
    }
    setActive(startIdx, !!initial);

    var obsReady = false;
    var observer = new IntersectionObserver(
      function (entries) {
        if (!obsReady) return;
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          var id = (en.target.id || "").replace(/^sec-/, "");
          for (var i = 0; i < sections.length; i++) {
            if (sections[i].id === id) {
              setActive(i, false);
              break;
            }
          }
        });
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: 0.01 }
    );
    sections.forEach(function (sec) {
      var el = document.getElementById("sec-" + sec.id);
      if (el) observer.observe(el);
    });
    // Évite que l’observer écrase un deep-link (#…/checklist) au premier paint
    setTimeout(function () {
      obsReady = true;
    }, 500);

    mountChecklist();
  }

  /* ——— Boot ——— */
  function render() {
    var root = document.getElementById("strategies-root");
    var view = document.getElementById("str-view");
    var back = document.getElementById("str-back-hub");
    if (!root || !view) return;

    var slug = currentSlug();
    // hash like #lp-reversal/presentation → strategy slug first segment
    if (slug && slug.indexOf("/") !== -1) slug = slug.split("/")[0];

    if (!slug) {
      if (back) back.hidden = true;
      view.innerHTML = renderHub();
      return;
    }

    var strat = findStrategy(slug);
    if (!strat || strat.status !== "available" || !strat.sections) {
      location.hash = "hub";
      return;
    }
    if (back) back.hidden = false;
    view.innerHTML = renderDetail(strat);
    bindDetail(strat);
  }

  function bootForgeStrategies() {
    if (!document.getElementById("strategies-root")) return;
    if (!location.hash || location.hash === "#") {
      history.replaceState(null, "", "#hub");
    }
    render();
    window.addEventListener("hashchange", function () {
      // Avoid full remount when only section changes inside same strategy
      var slug = currentSlug();
      var base = slug && slug.indexOf("/") !== -1 ? slug.split("/")[0] : slug;
      var view = document.getElementById("str-view");
      var onDetail = view && view.querySelector(".detail-shell");
      var currentDetail = onDetail && view.querySelector(".strat-hero h1");
      var strat = base ? findStrategy(base) : null;
      if (onDetail && strat && currentDetail && currentDetail.textContent === strat.name && slug && slug.indexOf("/") !== -1) {
        return; // section nav already handled
      }
      render();
    });
  }

  window.bootForgeStrategies = bootForgeStrategies;
  window.FORGE_STRATEGIES = STRATEGIES;
})();
