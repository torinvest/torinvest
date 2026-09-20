/**
 * Atlas Styles — La Forge (ressource pédagogique complémentaire).
 * Chartisme, S/R, harmoniques, volume profile, footprint, carnet d’ordres…
 * Ne valide aucun module de formation.
 */
(function () {
  "use strict";

  var GOLD = "#ffd700";
  var AQUA = "#5eead4";
  var AMBER = "#f0b429";
  var BULL = "#3dcf8e";
  var BEAR = "#e07a6a";
  var MUTED = "#9aa3b5";
  var VIOLET = "#a78bfa";
  var GRID = "#2a3344";

  var lessons = [
    {
      slug: "supports",
      group: "Lecture classique",
      title: "Supports & résistances",
      subtitle: "Les niveaux que tout le monde voit",
      intro:
        "Un support est une zone où le prix a déjà réagi à la hausse ; une résistance, à la baisse. " +
        "Ce sont des repères de confluence, pas des murs magiques. La qualité d’un niveau dépend du contexte, du nombre de tests et de la clarté de la réaction.",
      chart: "Support cassé → résistance (changement de rôle)",
      type: "supports",
      caption:
        "Le prix rebondit deux fois sur un support, le casse, puis reteste la zone depuis l’autre côté : la zone devient résistance candidate.",
      term: "S/R · ZONES DE RÉACTION",
      heads: ["Zone, pas ligne pixel", "Tests & qualité", "Cassure ≠ signal"],
      texts: [
        "Trace une zone (corps + mèches pertinentes) plutôt qu’une ligne unique. Sur XAU, quelques pips / dizaines de cents peuvent être du bruit.",
        "Un niveau touché 2–3 fois avec rejets nets est souvent plus pertinent qu’un niveau « parfait » après coup. Note l’unité de temps du niveau (H4 ≠ M5).",
        "Une cassure peut être un faux breakout (prise de liquidité). Attends clôture, retest et confirmation avant d’agir — sinon tu trades le bruit.",
      ],
      tools: "TradingView (lignes / rectangles), MT5. Aucun indicateur obligatoire.",
      forgeLink:
        "Prépare la lecture ICT : liquidité autour des S/R (BSL/SSL). Modules F5 Price Action et Atlas ICT → Liquidité.",
      steps: [
        "Choisis l’UT de contexte (ex. H4) et marque 2–3 zones majeures.",
        "Note le nombre de tests et la qualité des rejets (corps vs mèches).",
        "Sur cassure : attends clôture + éventuel retest avant de parler de changement de rôle.",
      ],
    },
    {
      slug: "chartisme",
      group: "Lecture classique",
      title: "Chartisme classique",
      subtitle: "Figures de continuation et de retournement",
      intro:
        "Le chartisme décrit des formes répétées (triangles, doubles sommets, tête-épaules…). " +
        "Utile pour nommer une structure visuelle — dangereux si tu forces la figure pour justifier un trade.",
      chart: "Tête & épaules baissière (schéma)",
      type: "chartisme",
      caption:
        "Épaule gauche, tête, épaule droite, puis cassure de la ligne de cou. Objectif théorique ≈ hauteur tête → ligne de cou, projetée à la baisse.",
      term: "FIGURES · CONTINUATION / RETOURNEMENT",
      heads: ["Catalogue utile", "Mesure & invalidation", "Subjectivité"],
      texts: [
        "Figures courantes : double top/bottom, tête-épaules, triangles (asc/desc/sym), drapeaux, canaux. Apprends-les pour lire les livres / Discord, pas pour tout forcer.",
        "Chaque figure a une invalidation (ex. clôture au-dessus de l’épaule droite) et parfois une projection. Écris-les avant l’entrée.",
        "Deux traders ne voient pas toujours la même figure. Si tu dois « tordre » le graphique, ce n’est probablement pas une configuration claire.",
      ],
      tools: "TradingView (formes), livres classiques (Bulkowski = stats historiques, pas promesse).",
      forgeLink: "La Forge priorise structure ICT (BOS/MSS) ; le chartisme reste une culture de marché utile.",
      steps: [
        "Identifie la figure sans forcer les points d’ancrage.",
        "Trace la ligne de cou / bornes et note l’invalidation.",
        "Attends la cassure confirmée (clôture) avant de parler d’objectif.",
      ],
    },
    {
      slug: "chandeliers",
      group: "Lecture classique",
      title: "Chandeliers japonais",
      subtitle: "Le langage des bougies",
      intro:
        "Une bougie résume open / high / low / close. Les patterns (pin bar, engulfing, doji…) sont des indices de rejet ou d’hésitation — " +
        "jamais des ordres isolés « magiques ».",
      chart: "Pin bar de rejet sur support",
      type: "chandeliers",
      caption:
        "Longue mèche basse + petit corps près du haut : rejet des prix bas. Pertinent seulement contre un niveau / un contexte clair.",
      term: "PRICE ACTION · PATTERNS DE BOUGIES",
      heads: ["Anatomie", "Contexte d’abord", "1 bougie ≠ setup"],
      texts: [
        "Corps = distance open→close. Mèches = extrêmes. Couleur conventionnelle : vert/haussier si close > open.",
        "Une pin bar en milieu de nulle part vaut moins qu’une pin bar sur S/R H4 ou après un sweep.",
        "Les noms (hammer, shooting star, engulfing) aident la mémoire. Le edge vient du contexte + plan de risque, pas du nom.",
      ],
      tools: "Tout graphique OHLC. Module F5 La Forge approfondit le price action pur.",
      forgeLink: "Module F5 · Price Action pur — sans indicateur.",
      steps: [
        "Lis d’abord le contexte (tendance / range / niveau).",
        "Repère la bougie de réaction (mèche, engulfing).",
        "Définis invalidation sous/au-dessus de la mèche avant d’imaginer une entrée.",
      ],
    },
    {
      slug: "harmoniques",
      group: "Structures avancées",
      title: "Figures harmoniques",
      subtitle: "Gartley, Bat, Butterfly… ratios Fibonacci",
      intro:
        "Les harmoniques cherchent des structures XABCD dont les jambes respectent des ratios Fibonacci précis. " +
        "Élégant sur papier — exige discipline et tolérance : les ratios « exacts » sont rares en live.",
      chart: "Gartley haussier (XABCD) — zone D",
      type: "harmoniques",
      caption:
        "Structure X→A→B→C→D. La zone D (PRZ) est où les ratios convergent. Entrée = confirmation dans la PRZ, pas un ordre aveugle au pixel Fibonacci.",
      term: "HARMONIC · PRZ (POTENTIAL REVERSAL ZONE)",
      heads: ["Ratios, pas magie", "PRZ = zone", "Overfit visuel"],
      texts: [
        "Ex. Gartley : AB ≈ 61,8 % de XA ; BC entre 38,2–88,6 % de AB ; CD complète vers ~78,6 % de XA (variantes selon auteurs).",
        "La PRZ est une zone de confluence (plusieurs Fib). Observe réaction + structure, ne « fill » pas juste parce que le ratio est joli.",
        "On peut toujours trouver un Fib qui colle après coup. Fixe tes règles d’ancrage et d’invalidation à l’avance.",
      ],
      tools: "TradingView Harmonic Pattern tools / scripts. Autodesk-style scanners (attention aux faux positifs).",
      forgeLink:
        "Complémentaire à OTE ICT (62–79 %). Ne remplace pas MSS / liquidité. Voir Atlas ICT → OTE.",
      steps: [
        "Ancre X et A clairement (impulsion nette).",
        "Vérifie les ratios AB / BC / CD selon le modèle choisi.",
        "Dans la PRZ : attends confirmation (bougie / structure) et note l’invalidation hors zone.",
      ],
    },
    {
      slug: "wyckoff",
      group: "Structures avancées",
      title: "Wyckoff — accumulation",
      subtitle: "Phases et effort / résultat",
      intro:
        "Wyckoff lit le marché en phases (accumulation, markup, distribution, markdown) et en effort/résultat (volume vs prix). " +
        "C’est un récit de trading range — utile, mais reconstruisible après coup si tu n’as pas de critères écrits.",
      chart: "Schéma d’accumulation (range → sortie)",
      type: "wyckoff",
      caption:
        "Range d’accumulation, spring (faux breakout bas), puis sortie haussière. Les labels (PS, SC, Spring…) varient selon les écoles.",
      term: "WYCKOFF · PHASES & EFFORT/RÉSULTAT",
      heads: ["Phases", "Spring / UTAD", "Pas une loi"],
      texts: [
        "Accumulation = range après une baisse ; distribution = range après une hausse. Markup / markdown = tendances qui suivent.",
        "Spring : excursion sous le range puis reprise (prise de stops). UTAD : symétrique en distribution (faux breakout haut).",
        "Les phases se nomment facilement une fois le move terminé. Définis fenêtre et critères avant de raconter l’histoire.",
      ],
      tools: "Volume classique + lecture range. Livres Wyckoff / Composite Man (culture).",
      forgeLink: "Proche du Power of Three ICT (AMD). Atlas ICT → Power of Three.",
      steps: [
        "Délimite le range sans connaître la suite.",
        "Observe les excursions (spring / faux break) et le volume relatif.",
        "Valide une sortie seulement si le prix s’extrait et tient hors du range.",
      ],
    },
    {
      slug: "volume-profile",
      group: "Flux & profils",
      title: "Volume Profile",
      subtitle: "Où le volume s’est concentré",
      intro:
        "Le Volume Profile distribue le volume par niveau de prix (pas par temps). " +
        "POC (Point of Control), VAH/VAL (Value Area High/Low) : zones où le marché a le plus « accepté » le prix.",
      chart: "Profil de volume — POC, VAH, VAL",
      type: "vprofile",
      caption:
        "Barres horizontales = volume par prix. POC = niveau le plus négocié. Value Area ≈ 70 % du volume autour du POC.",
      term: "VP · POC / VAH / VAL / HVN / LVN",
      heads: ["Prix × volume", "HVN vs LVN", "Profil ≠ futur"],
      texts: [
        "Contrairement au volume sous les bougies (temps), le VP répond : à quels prix a-t-on le plus transigé ?",
        "HVN (high volume node) : prix accepté, souvent « collant ». LVN (low volume) : prix rapidement traversés, parfois accélération.",
        "Un POC historique n’oblige pas le prix à y revenir. C’est un contexte, pas un aimant garanti.",
      ],
      tools: "TradingView Fixed/Session Volume Profile, ATAS, Bookmap (selon feed).",
      forgeLink: "Enrichit premium/discount. Module tool-indicateurs (order flow) et exécution.",
      steps: [
        "Choisis la période du profil (session, semaine, swing).",
        "Repère POC, VAH, VAL, et d’éventuels LVN.",
        "Combine avec structure : réaction au POC ≠ entrée automatique.",
      ],
    },
    {
      slug: "footprint",
      group: "Flux & profils",
      title: "Footprint & order flow",
      subtitle: "Voir l’agression acheteur / vendeur",
      intro:
        "Le footprint affiche, dans chaque bougie, le volume (ou delta) par niveau de prix — souvent bid×ask. " +
        "Tu vois où l’agression a eu lieu, pas « qui » (banque vs retail) avec certitude.",
      chart: "Footprint simplifié — delta et absorption",
      type: "footprint",
      caption:
        "Chaque cellule = volume au prix. Vert dominant = plus d’agressions acheteuses (selon convention). Absorption : gros volume sans progression du prix.",
      term: "FOOTPRINT · DELTA / ABSORPTION / IMBALANCE",
      heads: ["Bid × Ask", "Delta & imbalance", "Feed dépendant"],
      texts: [
        "Ask agresse le bid (achat market) ; bid agresse l’ask (vente market). Les conventions de couleur varient selon le logiciel.",
        "Delta = acheteurs agressifs − vendeurs agressifs. Imbalance = asymétrie forte à un niveau. Absorption = volume élevé sans breakout.",
        "Sans tick/feed futures de qualité, le footprint CFD est souvent une approximation. Connais ton data.",
      ],
      tools: "ATAS, Bookmap, Quantower, Sierra Chart (futures). Moins fiable sur CFD retail purs.",
      forgeLink: "Module F1 microstructure + tool-indicateurs. Complète, ne remplace pas, la structure prix.",
      steps: [
        "Vérifie la qualité du feed (futures vs CFD).",
        "Repère imbalance / absorption aux niveaux clés (S/R, POC).",
        "Exige alignement avec structure avant d’agir sur un delta seul.",
      ],
    },
    {
      slug: "carnet",
      group: "Flux & profils",
      title: "Carnet d’ordres",
      subtitle: "Profondeur bid / ask",
      intro:
        "Le carnet (DOM) montre les ordres limit en attente : bid (achat) sous le prix, ask (vente) au-dessus. " +
        "Profondeur, spoofing et refresh rapide : ce que tu vois peut disparaître en une milliseconde.",
      chart: "DOM simplifié — liquidité visible",
      type: "carnet",
      caption:
        "Colonnes bid / ask avec tailles. Le spread est l’écart entre meilleur bid et meilleur ask. Une « muraille » peut être retirée avant d’être touchée.",
      term: "DOM · DEPTH OF MARKET / SPREAD",
      heads: ["Limites vs marchés", "Spoof & mirages", "XAU / CFD"],
      texts: [
        "Ordre limit = offre passive (maker). Ordre market = prend la liquidité (taker) et fait avancer le prix.",
        "Des gros blocs peuvent être affichés pour intimider puis annulés (spoofing). Ne traite pas une taille affichée comme un engagement.",
        "Sur CFD/or retail, le carnet n’est souvent pas le carnet institutionnel global. Utile en formation, fragile comme vérité unique.",
      ],
      tools: "DOM broker futures, ATAS, Bookmap. Module F1 La Forge (makers/takers).",
      forgeLink: "Module F1 — Participants & microstructure.",
      steps: [
        "Identifie spread et profondeur autour du mid.",
        "Observe si les gros blocs tiennent ou disparaissent au toucher.",
        "Relie au footprint / tape si disponible — le DOM seul ment facilement.",
      ],
    },
    {
      slug: "vwap",
      group: "Flux & profils",
      title: "VWAP & ancres session",
      subtitle: "Prix moyen pondéré par le volume",
      intro:
        "Le VWAP (Volume Weighted Average Price) est le prix moyen de la session pondéré par le volume. " +
        "Institutions l’utilisent comme référence d’exécution ; traders le lisent comme aimant / biais intraday.",
      chart: "Prix vs VWAP session + bandes",
      type: "vwap",
      caption:
        "Prix au-dessus du VWAP = session plutôt acheteuse (convention). Les bandes d’écart-type marquent les extensions statistiques, pas des cibles garanties.",
      term: "VWAP · ANCHOR / BANDES σ",
      heads: ["Référence session", "Extensions", "Reset"],
      texts: [
        "VWAP se recalcule depuis l’ouverture de session (ou ancre custom : week, swing).",
        "Éloignement en σ peut précéder un retour moyen — ou une tendance qui ignore le VWAP pendant des heures.",
        "Changer d’ancre change toute la lecture. Note toujours quelle ancre tu utilises.",
      ],
      tools: "TradingView VWAP, plateformes futures. Module tool-indicateurs.",
      forgeLink: "Utile en killzone London/NY avec structure. Module 06 Killzones.",
      steps: [
        "Fixe l’ancre (session NY / Londres).",
        "Observe prix vs VWAP et pente du VWAP.",
        "N’achète/vend pas « parce que loin du VWAP » sans structure.",
      ],
    },
    {
      slug: "elliot",
      group: "Structures avancées",
      title: "Elliott (aperçu critique)",
      subtitle: "Vagues, impulsions, corrections",
      intro:
        "La vague d’Elliott propose des impulsions (5) et corrections (3) fractales. " +
        "Culture importante — très sujette à la réécriture après coup. On l’aborde ici pour la reconnaître, pas pour en faire un dogme.",
      chart: "Impulsion 1-2-3-4-5 + correction A-B-C",
      type: "elliot",
      caption:
        "Schéma pédagogique d’une hausse en 5 vagues puis correction ABC. En live, le comptage diverge souvent entre analystes.",
      term: "ELLIOTT · IMPULSE / CORRECTIVE",
      heads: ["Fractalité", "Règles de base", "Subjectivité forte"],
      texts: [
        "Chaque vague se décompose en sous-vagues sur UT inférieure — d’où la tentation de « tout faire coller ».",
        "Règles classiques (simplifiées) : la vague 2 ne retrace pas 100 % de 1 ; la 3 n’est pas la plus courte ; la 4 ne chevauche pas 1 (sauf diagonales).",
        "Deux compteurs Elliott sérieux peuvent être en désaccord. Traite-le comme hypothèse, pas comme vérité.",
      ],
      tools: "Livres Prechter / Frost (culture). Outils Fib.",
      forgeLink: "La Forge privilégie structure empirique (HH/HL, MSS) plutôt que comptage Elliott obligatoire.",
      steps: [
        "Identifie une impulsion claire sans forcer 5 vagues.",
        "Note ton comptage et l’invalidation (ex. break sous début de vague 1).",
        "Compare avec une lecture structure simple : lequel est plus clair ?",
      ],
    },
    {
      slug: "comparer",
      group: "Mise en perspective",
      title: "Comparer les styles",
      subtitle: "Quand utiliser quoi",
      intro:
        "Chaque style répond à une question différente : où a-t-on réagi ? où s’est concentré le volume ? qui agresse ? " +
        "Le piège : mélanger 6 langages sans plan unique.",
      chart: "Carte mentale — styles & questions",
      type: "comparer",
      caption:
        "Une même bougie peut se lire en S/R, en footprint et en ICT. Choisis un framework principal ; les autres = contexte.",
      term: "FRAMEWORK · 1 LANGAGE PRINCIPAL",
      heads: ["Une question chacun", "Stacking raisonnable", "Paralysie"],
      texts: [
        "S/R & chartisme → formes. VP/VWAP → où le volume. Footprint/DOM → agression. ICT → liquidité + structure + temps.",
        "Stacking sain : biais H4 (structure) + zone VP + confirmation footprint — avec une seule invalidation écrite.",
        "Trop d’outils = excuses. Si tu ne peux pas expliquer ton trade en 3 phrases, simplifie.",
      ],
      tools: "Journal : colonne « style(s) utilisés » + « style principal ».",
      forgeLink: "La Forge = framework principal ICT/SMC + macro XAU. Cet atlas = culture satellite.",
      steps: [
        "Choisis ton framework principal (ex. ICT La Forge).",
        "Ajoute au plus 1–2 lectures satellites (ex. VP session).",
        "Refuse d’entrer si les lectures se contredisent sans règle de priorité.",
      ],
    },
    {
      slug: "limites",
      group: "Mise en perspective",
      title: "Limites & bonnes pratiques",
      subtitle: "Ce qu’aucun schéma ne te doit",
      intro:
        "Les schémas pédagogiques sont des cartes, pas le territoire. " +
        "Spread, news, gaps, erreurs de feed et biais de confirmation détruisent les « figures parfaites ».",
      chart: "Checklist anti-illusion",
      type: "limites",
      caption:
        "Avant d’agir : règle écrite, invalidation, risque monétaire, coût de transaction. Sinon ce n’est pas un plan — c’est une histoire.",
      term: "RISQUE · PROCESS · MESURE",
      heads: ["Après coup", "Coûts", "Mesurer"],
      texts: [
        "Le cerveau adore reconnaître des patterns une fois le move terminé. Capture tes analyses avant le résultat.",
        "Backtest sans spread/slippage/commission = fiction. Sur XAU, les coûts mangent les petits setups.",
        "Journalise succès, pertes et « pas de trade ». Un style sans stats personnelles reste du folklore.",
      ],
      tools: "Journal La Forge, spreadsheet, replay.",
      forgeLink: "Modules mindset, data-journal, pro-backtesting.",
      steps: [
        "Écris la règle avant la bougie suivante.",
        "Inclus coûts dans tout test.",
        "Revue hebdo : quels styles t’aident vraiment vs lesquels te distraient ?",
      ],
    },
  ];

  function el(id) {
    return document.getElementById(id);
  }

  function label(x, y, text, color, size) {
    return (
      '<text class="anim-fade d2" x="' +
      x +
      '" y="' +
      y +
      '" fill="' +
      (color || MUTED) +
      '" style="font-size:' +
      (size || 14) +
      'px">' +
      text +
      "</text>"
    );
  }

  function line(x1, y1, x2, y2, color, dash, cls) {
    return (
      '<line class="' +
      (cls || "anim-draw d1") +
      '" x1="' +
      x1 +
      '" y1="' +
      y1 +
      '" x2="' +
      x2 +
      '" y2="' +
      y2 +
      '" stroke="' +
      (color || GRID) +
      '" stroke-width="1.5"' +
      (dash ? ' stroke-dasharray="' + dash + '"' : "") +
      "/>"
    );
  }

  function zone(x, y, w, h, color, cls) {
    return (
      '<rect class="' +
      (cls || "anim-fade d1") +
      '" x="' +
      x +
      '" y="' +
      y +
      '" width="' +
      w +
      '" height="' +
      h +
      '" fill="' +
      (color || GOLD) +
      '" fill-opacity=".12" stroke="' +
      (color || GOLD) +
      '" stroke-opacity=".4" rx="3"/>'
    );
  }

  function candle(x, o, c, h, l, w) {
    w = w || 16;
    var col = c < o ? BULL : BEAR;
    return (
      '<g class="anim-fade d2">' +
      '<line x1="' +
      x +
      '" y1="' +
      h +
      '" x2="' +
      x +
      '" y2="' +
      l +
      '" stroke="' +
      col +
      '" stroke-width="1.5"/>' +
      '<rect x="' +
      (x - w / 2) +
      '" y="' +
      Math.min(o, c) +
      '" width="' +
      w +
      '" height="' +
      Math.max(3, Math.abs(o - c)) +
      '" fill="' +
      col +
      '" rx="1"/>' +
      "</g>"
    );
  }

  function grid() {
    var s = "";
    for (var y = 50; y <= 300; y += 50) s += line(40, y, 820, y, GRID, "2 6", "");
    for (var x = 80; x < 840; x += 100) s += line(x, 30, x, 320, GRID, "2 6", "");
    return s;
  }

  function chartFor(l) {
    var s = grid();
    var t = l.type;

    if (t === "supports") {
      s += zone(60, 200, 720, 28, AQUA, "anim-fade d1 anim-pulse");
      s += label(70, 190, "Support → puis résistance", AQUA, 15);
      var vals = [120, 135, 150, 168, 155, 198, 210, 205, 198, 205, 175, 160, 145, 155, 170, 195, 220, 235, 225];
      for (var i = 1; i < vals.length; i++) {
        s += candle(55 + i * 38, vals[i - 1], vals[i], Math.min(vals[i - 1], vals[i]) - 8, Math.max(vals[i - 1], vals[i]) + 10);
      }
      s += label(480, 95, "Retest depuis l’autre côté", GOLD, 14);
      s += line(500, 105, 520, 195, GOLD, "", "anim-draw d4");
    }

    if (t === "chartisme") {
      s +=
        '<path class="anim-draw d1" d="M80 180 L200 120 L320 200 L440 70 L560 195 L680 130 L780 210" fill="none" stroke="' +
        GOLD +
        '" stroke-width="2.5"/>';
      s += line(80, 200, 780, 200, AQUA, "4 4", "anim-draw d2");
      s += label(90, 55, "Épaule G", MUTED);
      s += label(410, 55, "Tête", GOLD);
      s += label(640, 55, "Épaule D", MUTED);
      s += label(700, 230, "Ligne de cou", AQUA);
      s += label(700, 280, "Objectif théorique ↓", BEAR, 13);
    }

    if (t === "chandeliers") {
      s += zone(60, 210, 500, 40, AQUA, "anim-fade d1");
      s += label(70, 200, "Zone support", AQUA);
      for (var j = 0; j < 8; j++) {
        var base = 160 + (j % 3) * 8;
        s += candle(90 + j * 42, base, base + 12, base - 10, base + 22);
      }
      // pin bar
      s += candle(450, 200, 185, 182, 255, 22);
      s += label(470, 275, "Pin bar (rejet)", GOLD, 14);
      s += line(450, 250, 450, 230, GOLD, "", "anim-draw d3");
    }

    if (t === "harmoniques") {
      s +=
        '<path class="anim-draw d1" d="M100 260 L260 80 L400 170 L520 120 L700 220" fill="none" stroke="' +
        GOLD +
        '" stroke-width="2.5"/>';
      s += zone(640, 190, 120, 50, AMBER, "anim-fade d3 anim-pulse");
      [["X", 100, 275], ["A", 260, 70], ["B", 400, 185], ["C", 520, 110], ["D", 700, 240]].forEach(function (p) {
        s +=
          '<circle class="anim-fade d2" cx="' +
          p[1] +
          '" cy="' +
          (p[2] - 10) +
          '" r="10" fill="' +
          GOLD +
          '"/>' +
          label(p[1] - 4, p[2] - 6, p[0], "#1a1608", 12);
      });
      s += label(650, 180, "PRZ (zone D)", AMBER);
      s += label(100, 310, "Ratios Fib sur XA / AB / BC / CD", MUTED, 13);
    }

    if (t === "wyckoff") {
      s += zone(80, 140, 320, 100, AQUA, "anim-fade d1");
      s += label(100, 130, "Accumulation (range)", AQUA);
      s +=
        '<path class="anim-draw d2" d="M80 120 L120 160 L160 150 L200 170 L240 155 L280 175 L320 160 L360 180 L400 250 L440 230 L480 200 L520 160 L560 120 L600 90 L640 70 L700 55" fill="none" stroke="' +
        BULL +
        '" stroke-width="2.5"/>';
      s += label(380, 270, "Spring", AMBER);
      s += label(620, 50, "Markup", BULL);
    }

    if (t === "vprofile") {
      var bars = [40, 70, 110, 160, 210, 170, 120, 80, 50, 35];
      for (var k = 0; k < bars.length; k++) {
        var y = 50 + k * 26;
        var w = bars[k];
        var col = k === 4 ? GOLD : AQUA;
        s +=
          '<rect class="anim-grow d' +
          Math.min(6, k + 1) +
          '" x="80" y="' +
          y +
          '" width="' +
          w +
          '" height="20" fill="' +
          col +
          '" fill-opacity=".75" rx="2"/>';
      }
      s += line(300, 50, 300, 300, GOLD, "4 3", "anim-draw d3");
      s += label(310, 160, "POC", GOLD);
      s += line(80, 80, 780, 80, MUTED, "3 4");
      s += line(80, 260, 780, 260, MUTED, "3 4");
      s += label(720, 75, "VAH", MUTED);
      s += label(720, 275, "VAL", MUTED);
      s +=
        '<path class="anim-draw d4" d="M340 250 L380 220 L420 200 L460 170 L500 140 L540 120 L580 100 L620 95" fill="none" stroke="' +
        BULL +
        '" stroke-width="2"/>';
      s += label(600, 85, "Prix", BULL);
    }

    if (t === "footprint") {
      var prices = [100, 110, 120, 130, 140, 150];
      for (var r = 0; r < prices.length; r++) {
        for (var c = 0; c < 5; c++) {
          var bx = 120 + c * 110;
          var by = 60 + r * 40;
          var bid = 20 + ((r + c) % 5) * 8;
          var ask = 15 + ((r * 2 + c) % 6) * 7;
          var dominant = ask > bid ? BULL : BEAR;
          s +=
            '<rect class="anim-fade d' +
            (c + 1) +
            '" x="' +
            bx +
            '" y="' +
            by +
            '" width="95" height="32" fill="' +
            dominant +
            '" fill-opacity=".18" stroke="' +
            dominant +
            '" stroke-opacity=".5" rx="3"/>';
          s += label(bx + 8, by + 20, bid + " × " + ask, MUTED, 12);
        }
      }
      s += label(120, 320, "Niveau prix → cellules volume bid × ask", MUTED, 13);
      s += label(560, 40, "Imbalance / absorption", AMBER, 14);
    }

    if (t === "carnet") {
      var depths = [120, 90, 70, 55, 40, 40, 55, 75, 95, 130];
      for (var d = 0; d < 5; d++) {
        s +=
          '<rect class="anim-grow d' +
          (d + 1) +
          '" x="' +
          (320 - depths[d]) +
          '" y="' +
          (60 + d * 36) +
          '" width="' +
          depths[d] +
          '" height="28" fill="' +
          BULL +
          '" fill-opacity=".7" rx="2"/>';
        s += label(60, 80 + d * 36, "Bid " + (5 - d), MUTED, 12);
      }
      for (var a = 0; a < 5; a++) {
        s +=
          '<rect class="anim-grow d' +
          (a + 1) +
          '" x="360" y="' +
          (60 + a * 36) +
          '" width="' +
          depths[a + 5] +
          '" height="28" fill="' +
          BEAR +
          '" fill-opacity=".7" rx="2"/>';
        s += label(520, 80 + a * 36, "Ask " + (a + 1), MUTED, 12);
      }
      s += line(340, 50, 340, 250, GOLD, "", "anim-draw d2");
      s += label(300, 280, "Spread", GOLD);
      s += label(600, 120, "« Muraille » peut disparaître", AMBER, 13);
    }

    if (t === "vwap") {
      s +=
        '<path class="anim-draw d1" d="M70 220 C150 210, 220 190, 300 170 S480 140, 580 130 S720 150, 800 160" fill="none" stroke="' +
        GOLD +
        '" stroke-width="2.5"/>';
      s +=
        '<path class="anim-draw d2" d="M70 180 C150 160, 220 130, 300 110 S480 80, 580 90 S720 130, 800 145" fill="none" stroke="' +
        AQUA +
        '" stroke-width="1.5" stroke-dasharray="4 4"/>';
      s +=
        '<path class="anim-draw d2" d="M70 260 C150 250, 220 240, 300 230 S480 210, 580 200 S720 190, 800 195" fill="none" stroke="' +
        AQUA +
        '" stroke-width="1.5" stroke-dasharray="4 4"/>';
      s +=
        '<path class="anim-draw d3" d="M70 240 L120 200 L180 210 L240 150 L300 160 L360 100 L420 120 L500 90 L580 70 L660 110 L740 95 L800 100" fill="none" stroke="' +
        BULL +
        '" stroke-width="2"/>';
      s += label(700, 55, "Prix", BULL);
      s += label(700, 155, "VWAP", GOLD);
      s += label(700, 200, "Bandes σ", AQUA);
    }

    if (t === "elliot") {
      s +=
        '<path class="anim-draw d1" d="M70 280 L160 180 L230 220 L340 80 L400 140 L520 40 L580 100 L660 70 L740 120" fill="none" stroke="' +
        GOLD +
        '" stroke-width="2.5"/>';
      var nums = [
        [160, 170, "1"],
        [230, 235, "2"],
        [340, 70, "3"],
        [400, 155, "4"],
        [520, 30, "5"],
        [580, 115, "A"],
        [660, 60, "B"],
        [740, 135, "C"],
      ];
      nums.forEach(function (n, idx) {
        s +=
          '<circle class="anim-fade d' +
          Math.min(6, idx + 1) +
          '" cx="' +
          n[0] +
          '" cy="' +
          n[1] +
          '" r="11" fill="' +
          (idx < 5 ? GOLD : VIOLET) +
          '"/>' +
          label(n[0] - 4, n[1] + 4, n[2], "#1a1608", 12);
      });
      s += label(100, 50, "Impulsion 1–5", GOLD);
      s += label(600, 50, "Correction ABC", VIOLET);
    }

    if (t === "comparer") {
      var cards = [
        [60, 50, "S/R & Chartisme", "Où le prix a réagi ?"],
        [320, 50, "Volume Profile", "Où le volume s’est posé ?"],
        [580, 50, "Footprint / DOM", "Qui agresse maintenant ?"],
        [60, 180, "Harmoniques", "Quelle géométrie Fib ?"],
        [320, 180, "Wyckoff / Elliott", "Quelle phase / vague ?"],
        [580, 180, "ICT / La Forge", "Liquidité + structure + temps"],
      ];
      cards.forEach(function (c, idx) {
        s += zone(c[0], c[1], 220, 100, idx === 5 ? GOLD : AQUA, "anim-fade d" + (idx + 1));
        s += label(c[0] + 14, c[1] + 40, c[2], idx === 5 ? GOLD : AQUA, 14);
        s += label(c[0] + 14, c[1] + 70, c[3], MUTED, 12);
      });
    }

    if (t === "limites") {
      var checks = [
        "Règle écrite avant le trade",
        "Invalidation claire (prix)",
        "Risque monétaire défini",
        "Coûts (spread / slip) inclus",
        "Capture d’écran avant résultat",
        "Revue stats hebdomadaire",
      ];
      checks.forEach(function (txt, idx) {
        var y = 55 + idx * 42;
        s +=
          '<rect class="anim-fade d' +
          Math.min(6, idx + 1) +
          '" x="80" y="' +
          y +
          '" width="700" height="34" fill="' +
          (idx % 2 ? "#1a2230" : "#151c28") +
          '" rx="4"/>';
        s +=
          '<circle class="anim-fade d' +
          Math.min(6, idx + 1) +
          '" cx="110" cy="' +
          (y + 17) +
          '" r="10" fill="none" stroke="' +
          GOLD +
          '" stroke-width="2"/>';
        s += label(140, y + 22, txt, MUTED, 15);
      });
    }

    return (
      '<svg viewBox="0 0 860 350" role="img" aria-label="' +
      l.chart +
      ". " +
      l.caption +
      '"><title>' +
      l.chart +
      "</title><desc>" +
      l.caption +
      "</desc>" +
      s +
      "</svg>"
    );
  }

  function shortTitle(t) {
    return t
      .replace("Supports & résistances", "Supports & R")
      .replace("Figures harmoniques", "Harmoniques")
      .replace("Footprint & order flow", "Footprint")
      .replace("Carnet d’ordres", "Carnet (DOM)")
      .replace("VWAP & ancres session", "VWAP")
      .replace("Elliott (aperçu critique)", "Elliott")
      .replace("Comparer les styles", "Comparer")
      .replace("Limites & bonnes pratiques", "Limites")
      .replace("Wyckoff — accumulation", "Wyckoff")
      .replace("Chandeliers japonais", "Chandeliers")
      .replace("Chartisme classique", "Chartisme")
      .replace("Volume Profile", "Volume Profile");
  }

  var active = 0;

  function render() {
    var slug = location.hash.slice(1);
    var i = lessons.findIndex(function (x) {
      return x.slug === slug;
    });
    active = i < 0 ? 0 : i;
    var l = lessons[active];
    var group = "";
    el("concept-nav").innerHTML = lessons
      .map(function (x, n) {
        var heading =
          x.group !== group ? '<div class="nav-group">' + x.group + "</div>" : "";
        group = x.group;
        return (
          heading +
          '<a class="nav-item ' +
          (active === n ? "active" : "") +
          '" href="#' +
          x.slug +
          '" ' +
          (active === n ? 'aria-current="page"' : "") +
          '><span class="nav-index">' +
          String(n + 1).padStart(2, "0") +
          "</span>" +
          shortTitle(x.title) +
          '<span class="nav-arrow" aria-hidden="true">' +
          (active === n ? "↗" : "") +
          "</span></a>"
        );
      })
      .join("");

    el("crumb").textContent = l.group;
    el("eyebrow").textContent = l.subtitle.toUpperCase();
    el("title").textContent = l.title;
    el("number").textContent = String(active + 1).padStart(2, "0");
    el("intro").textContent = l.intro;
    el("chart-title").textContent = l.chart;
    el("chart-caption").textContent = l.caption;
    el("chart").innerHTML = chartFor(l);
    el("chart").scrollLeft = 0;
    el("subtopic").textContent = l.term;
    ["definition", "observe", "mistake"].forEach(function (id, n) {
      el(id + "-title").textContent = l.heads[n];
      el(id).textContent = l.texts[n];
    });
    el("tools").textContent = l.tools;
    el("forge-link").textContent = l.forgeLink;
    el("steps").innerHTML = l.steps.map(function (t) {
      return "<li>" + t + "</li>";
    }).join("");
    el("page-count").textContent = String(active + 1).padStart(2, "0") + " / " + lessons.length;
    el("previous").disabled = active === 0;
    el("next").textContent =
      active === lessons.length - 1 ? "Revoir le parcours ↺" : "Style suivant →";
    document.title = l.title + " — Atlas Styles · La Forge";
  }

  function replay() {
    var box = el("chart");
    if (!box) return;
    var html = box.innerHTML;
    box.innerHTML = "";
    requestAnimationFrame(function () {
      box.innerHTML = html;
    });
  }

  function bootForgeStylesAtlas() {
    if (!document.getElementById("styles-atlas-root")) return;
    if (!location.hash || location.hash === "#") {
      location.replace("#supports");
    }
    el("previous").addEventListener("click", function () {
      if (active > 0) location.hash = lessons[active - 1].slug;
    });
    el("next").addEventListener("click", function () {
      location.hash = lessons[(active + 1) % lessons.length].slug;
    });
    el("replay-anim").addEventListener("click", replay);
    window.addEventListener("hashchange", function () {
      if (location.hash === "#sources" || location.hash === "#lesson") return;
      render();
      el("lesson").focus({ preventScroll: true });
      window.scrollTo({
        top: 0,
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      });
    });
    render();
  }

  window.bootForgeStylesAtlas = bootForgeStylesAtlas;
})();
