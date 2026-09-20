/**
 * Atlas Psychologie & Mindset — La Forge
 * Psychologie comportementale, psychologie de marché, émotions, protocoles.
 * Ne valide aucun module (complète P2 Mindset / P6 Tilt).
 */
(function () {
  "use strict";

  var GOLD = "#e8c36a";
  var PSY = "#c4b5fd";
  var PSYD = "#8b5cf6";
  var AQUA = "#7dd3c0";
  var AMBER = "#f0b429";
  var BULL = "#3dcf8e";
  var BEAR = "#e07a6a";
  var MUTED = "#9aa3b5";
  var GRID = "#2a3344";

  var lessons = [
    {
      slug: "mindset-pro",
      group: "Fondations",
      title: "Mindset pro vs motivation",
      subtitle: "Pas du motivational Instagram",
      intro:
        "Le mindset TORINVEST n’est pas « croire en soi ». C’est un système : règles écrites, mesure du respect des règles, revue. " +
        "La motivation fluctue ; le process reste.",
      chart: "Motivation (vague) vs Process (escalier)",
      type: "mindset",
      caption:
        "La motivation monte et chute. Le process avance par paliers mesurables (checklist respectée, trades journalisés).",
      term: "MINDSET · SYSTÈME MESURABLE",
      heads: ["Définition utile", "Ce qu’on mesure", "Ce qu’on refuse"],
      texts: [
        "Mindset pro = identité de décideur sous contrainte de risque, pas d’optimisme forcé.",
        "On mesure : % de respect checklist, taille de position réelle vs plan, nombre de violations / semaine.",
        "On refuse : citations motivationnelles sans protocole, « je sens que… » non documenté.",
      ],
      protocol: "Avant chaque session : 5 lignes max — biais, niveaux, risque max, conditions de flat.",
      forgeLink: "Module P2 Mindset · Module 0 (Process) · Journal.",
      steps: [
        "Écris ta définition perso de « journée réussie » (≠ PnL positif).",
        "Choisis 3 métriques mentales (ex. checklist %, revenge trades = 0, stop après 2 pertes).",
        "Revue dimanche : métriques avant d’ouvrir les charts de la semaine.",
      ],
    },
    {
      slug: "identite",
      group: "Fondations",
      title: "Identité & ego du trader",
      subtitle: "Qui décide : le plan ou l’ego ?",
      intro:
        "L’ego veut avoir raison. Le process veut survivre. " +
        "Beaucoup de pertes viennent d’un besoin de « récupérer » une image de soi, pas d’une mauvaise lecture de marché.",
      chart: "Ego (avoir raison) vs Process (survivre)",
      type: "identite",
      caption:
        "Quand l’ego pilote : on élargit le SL, on double, on refuse de flat. Quand le process pilote : on exécute la règle même si ça « fait mal ».",
      term: "EGO · IMAGE DE SOI · RÔLE",
      heads: ["Rôle vs résultat", "Menaces à l’ego", "Recadrage"],
      texts: [
        "Ton rôle = appliquer un plan. Le résultat journalier n’est pas ton identité.",
        "Menaces classiques : perte après un win streak, être « faux » devant Discord, rater un move.",
        "Recadrage : « Ai-je respecté la règle ? » avant « Ai-je gagné ? »",
      ],
      protocol: "Après chaque trade : cocher Respect plan O/N. PnL secondaire.",
      forgeLink: "Module 0 Synthèse · P2 · P6 Tilt.",
      steps: [
        "Note 3 situations où ton ego a déjà forcé un trade.",
        "Écris une phrase d’identité : « Je suis un exécutant de règles. »",
        "Ajoute au journal la colonne Ego (0–2) : 0 = calme, 2 = besoin de raison.",
      ],
    },
    {
      slug: "biais",
      group: "Psychologie comportementale",
      title: "Biais cognitifs du trader",
      subtitle: "Ce que ton cerveau fait tout seul",
      intro:
        "La psychologie comportementale décrit des biais systématiques : aversion à la perte, confirmation, ancrage, disponibilité… " +
        "Les connaître ne les efface pas — ça permet de poser des garde-fous.",
      chart: "Carte des biais fréquents en trading",
      type: "biais",
      caption:
        "Chaque biais tire vers une erreur typique. Le remède n’est pas « être plus intelligent » : c’est une règle externe (checklist, taille fixe).",
      term: "BIAIS · KAHNEMAN / TVERSKY",
      heads: ["Aversion à la perte", "Confirmation", "Ancrage & FOMO"],
      texts: [
        "On souffre plus d’une perte que d’un gain équivalent → on tient les losers, on coupe les winners trop tôt.",
        "On cherche les infos qui confirment le trade déjà ouvert → on ignore le signal d’invalidation.",
        "Ancrage sur un prix / un screenshot ; disponibilité = le dernier trade spectaculaire domine le jugement.",
      ],
      protocol: "Avant entrée : écrire invalidation. Pendant : interdit de « chercher une raison de rester ».",
      forgeLink: "Complète Module 0 Stats / Process. Journal : tag biais suspecté.",
      steps: [
        "Choisis tes 3 biais dominants (honnêtement).",
        "Pour chacun : 1 règle anti-biais écrite.",
        "Sur 20 prochains trades : tag le biais si tu le sens monter.",
      ],
    },
    {
      slug: "prospect",
      group: "Psychologie comportementale",
      title: "Théorie des perspectives",
      subtitle: "Gains, pertes, et décisions tordues",
      intro:
        "La prospect theory (Kahneman & Tversky) : on évalue les résultats par rapport à un point de référence, " +
        "et on pondère mal les probabilités. En trading : PnL flottant devient une référence émotionnelle toxique.",
      chart: "Courbe valeur : pertes > gains (asymétrie)",
      type: "prospect",
      caption:
        "Schéma pédagogique : la douleur d’une perte pèse plus que le plaisir d’un gain de même taille — d’où le « hold » des losers.",
      term: "PROSPECT THEORY · RÉFÉRENCE",
      heads: ["Point de référence", "Asymétrie", "Application"],
      texts: [
        "Référence = break-even du jour, high water mark, ou PnL du mois. Elle change ton comportement sans que tu le remarques.",
        "Asymétrie pertes/gains → revenge après rouge, complacency après vert.",
        "Application : décider la taille AVANT ; ne jamais ajuster pour « rattraper la référence ».",
      ],
      protocol: "Risque en € fixé à l’avance. Interdit d’augmenter la taille pour combler une perte du jour.",
      forgeLink: "P3 Drawdown · P6 Tilt · Module 0.",
      steps: [
        "Identifie ta référence émotionnelle actuelle (jour / semaine / mois).",
        "Écris : « Je ne trade pas pour rattraper [référence]. »",
        "Si rouge journalier atteint X : flat forcé (même règle prop).",
      ],
    },
    {
      slug: "heuristiques",
      group: "Psychologie comportementale",
      title: "Heuristiques & illusions",
      subtitle: "Raccourcis mentaux qui coûtent cher",
      intro:
        "Le cerveau utilise des raccourcis (heuristiques) pour décider vite. Utiles dans la vie — dangereux sur un graphique " +
        "où la variance est élevée et le feedback retardé / bruité.",
      chart: "Raccourci mental → erreur de trade",
      type: "heuristiques",
      caption:
        "« Ça ressemble au trade d’hier » (représentativité) ou « tout le monde en parle » (preuve sociale) → entrée hors plan.",
      term: "HEURISTIQUES · REPRÉSENTATIVITÉ / PREUVE SOCIALE",
      heads: ["Représentativité", "Preuve sociale", "Excès de confiance"],
      texts: [
        "Deux setups « se ressemblent » → tu ignores que le contexte macro / session a changé.",
        "Discord / Twitter hype un long → tu te joins sans checklist (FOMO social).",
        "Après 5 wins : tu élargis le risque. L’edge n’a pas changé ; ton humeur oui.",
      ],
      protocol: "Setup = checklist chiffrée. Interdit d’entrer sur « sentiment Discord ».",
      forgeLink: "Module 0 Telegram / Influenceurs · Process.",
      steps: [
        "Liste tes 2 raccourcis favoris (« ça marche toujours le mardi… »).",
        "Ajoute une case checklist « Contexte ≠ hier ».",
        "Après un win streak : taille reste identique 10 trades.",
      ],
    },
    {
      slug: "crowd",
      group: "Psychologie de marché",
      title: "Psychologie de foule",
      subtitle: "Peur, cupidité, cycles narratifs",
      intro:
        "La psychologie de marché décrit comment les foules oscillent entre peur et cupidité, " +
        "comment les narratifs se propagent, et pourquoi le retail arrive souvent tard. Ce n’est pas une boule de cristal — un cadre de lecture.",
      chart: "Cycle peur ↔ cupidité (schéma)",
      type: "crowd",
      caption:
        "Euphorie → déni → peur → capitulation → espoir… Les labels varient ; l’idée est de savoir OÙ tu te situes émotionnellement dans le cycle.",
      term: "MARKET PSYCHOLOGY · FEAR / GREED",
      heads: ["Narratif", "Timing retail", "Utilité"],
      texts: [
        "Un narratif (Fed pivote, war premium, risk-on) attire les flux. Le prix intègre souvent avant le titre « évident ».",
        "Le retail tend à acheter l’euphorie et vendre la capitulation — exact inverse du process patient.",
        "Utilité : calibrer ton risque / ta taille, pas prédire le top/bottom.",
      ],
      protocol: "En euphorie sociale extrême : réduire taille ou exiger Setup A+ uniquement.",
      forgeLink: "Macro La Forge · Module 0 · Atlas ICT liquidité (sweeps de foule).",
      steps: [
        "Note le narratif dominant de la semaine (1 phrase).",
        "Classe ton état : peur / neutre / cupide (échelle 1–5).",
        "Si cupide ≥ 4 : taille −50 % automatique.",
      ],
    },
    {
      slug: "liquidite-emotion",
      group: "Psychologie de marché",
      title: "Comportement retail & liquidité",
      subtitle: "Pourquoi les stops se regroupent",
      intro:
        "Les stops retail se concentrent aux mêmes endroits (évidents). " +
        "Comprendre la psychologie collective aide à ne pas être la liquidité — sans fantasmer « les banques me chassent ».",
      chart: "Stops évidents = aimant à liquidité",
      type: "liqemo",
      caption:
        "Sous un creux clair / au-dessus d’un sommet clair : zones où beaucoup placent des stops. Sweep possible — pas une garantie.",
      term: "RETAIL BEHAVIOR · STOP CLUSTERS",
      heads: ["Évidence", "FOMO collectif", "Nuance"],
      texts: [
        "Si tu as placé ton stop « où tout le monde le voit », tu fais partie du pool.",
        "Après un sweep, le FOMO pousse à rentrer dans le mauvais sens ou trop tard.",
        "Nuance : tout n’est pas manipulation. Beaucoup de sweeps sont justes le marché prenant de la liquidité disponible.",
      ],
      protocol: "Stops au-delà du bruit + invalidation structurelle, pas pile sous le plus bas de la bougie précédente.",
      forgeLink: "Atlas ICT Liquidité · Module 02 · Module 0.",
      steps: [
        "Sur ton dernier trade : ton SL était-il « évident » ?",
        "Redessine une invalidation structurelle.",
        "Attends confirmation post-sweep avant d’agir (règle écrite).",
      ],
    },
    {
      slug: "emotions",
      group: "Émotions & performance",
      title: "FOMO, peur, greed, revenge",
      subtitle: "Les 4 émotions qui cassent les comptes",
      intro:
        "FOMO, peur, cupidité, revenge : quatre états qui font sortir du plan. " +
        "Le but n’est pas de ne plus les sentir — c’est de les détecter assez tôt pour déclencher un protocole.",
      chart: "Boucle émotion → action hors plan → regret",
      type: "emotions",
      caption:
        "Trigger → émotion → action impulsive → résultat → récit → nouveau trigger. Briser la boucle = pause obligatoire + règle écrite.",
      term: "FOMO · FEAR · GREED · REVENGE",
      heads: ["Détecter", "Nommer", "Couper"],
      texts: [
        "Signes FOMO : cœur accéléré, scroll charts, « je rate le move ». Peur : hésitation sur Setup A+, réduction de taille chaotique.",
        "Greed : élargir cible sans règle, ajouter au winner hors plan. Revenge : « je dois récupérer ».",
        "Couper : timer 10 min hors chart, boire de l’eau, relire checklist — ou flat session.",
      ],
      protocol: "Carte émotion 1–5 avant chaque trade. Si ≥ 4 : pas d’entrée.",
      forgeLink: "P2 · P6 · Module 0 Gambling.",
      steps: [
        "Fiche tes 4 émotions : trigger typique + première sensation corporelle.",
        "Ajoute score émotion au journal.",
        "Définis seuil d’arrêt (ex. revenge = session terminée).",
      ],
    },
    {
      slug: "tilt",
      group: "Émotions & performance",
      title: "Tilt & protocole 2 pertes",
      subtitle: "Quand tu n’es plus en état de décider",
      intro:
        "Le tilt est un état où la qualité de décision s’effondre (comme au poker). " +
        "La Forge impose un protocole d’escalade : 2 pertes → stop, pas « encore un pour se refaire ».",
      chart: "Escalade tilt → protocole d’arrêt",
      type: "tilt",
      caption:
        "1 perte OK si process respecté. 2 pertes / violation règle → circuit breaker. 3+ hors protocole = compte en danger.",
      term: "TILT · CIRCUIT BREAKER",
      heads: ["Définition", "Protocole", "Escalade"],
      texts: [
        "Tilt ≠ être triste. Tilt = tu changes les règles en cours de route.",
        "Protocole minimal : 2 pertes consécutives OU 1 violation checklist → fin de session trading.",
        "Escalade : récidive même semaine → 24–48 h off + revue écrite obligatoire.",
      ],
      protocol: "Écrire et signer (même seul) : « 2 pertes = stop. » Coller à côté de l’écran.",
      forgeLink: "Module P6 Tilt protocol · P3 Drawdown.",
      steps: [
        "Rédige ton protocole 2 pertes (actions exactes : fermer MT5, marcher, journal).",
        "Ajoute alerte visuelle / alarme.",
        "Simule mentalement : après 2 pertes, qu’est-ce que tu fais minute par minute ?",
      ],
    },
    {
      slug: "stress",
      group: "Émotions & performance",
      title: "Stress, corps & attention",
      subtitle: "Le mental passe par le corps",
      intro:
        "Stress aigu (news, drawdown) réduit le cortex préfrontal : moins de planification, plus de réaction. " +
        "Sommeil, caféine, posture, respiration : leçons « soft » qui changent le PnL.",
      chart: "Charge stress → qualité de décision",
      type: "stress",
      caption:
        "Au-delà d’un seuil de charge (sommeil − / DD / news), la qualité de décision chute. La règle pro : moins trader, pas « forcer ».",
      term: "AROUSAL · CHARGE COGNITIVE",
      heads: ["Signes corporels", "Leviers", "Règle session"],
      texts: [
        "Mâchoire serrée, respiration haute, scroll compulsif, irritabilité Discord = charge haute.",
        "Leviers : sommeil, pause 5–10 min, hydratation, réduire écrans, pas de 5e café.",
        "Règle : score énergie < 6/10 → analyse only, pas d’exécution.",
      ],
      protocol: "Check pré-session : sommeil / énergie / humeur (1–10). Seuil écrit.",
      forgeLink: "Module pro-asie (fatigue) · P2 · calendrier lives.",
      steps: [
        "Ajoute 3 scores pré-session au journal.",
        "Définis seuil no-trade.",
        "Sur news rouge (NFP/FOMC) : flat ou taille minimale selon ton plan.",
      ],
    },
    {
      slug: "journal-psy",
      group: "Système mental",
      title: "Journal psychologique",
      subtitle: "Mesurer l’invisible",
      intro:
        "Sans journal émotionnel, tu n’as que des souvenirs biaisés. " +
        "Le journal psycho complète le journal technique : état, biais, respect process, leçon.",
      chart: "Colonnes d’un journal mental utile",
      type: "journal",
      caption:
        "Colonnes : Émotion 1–5 · Biais · Respect plan O/N · Trigger · Leçon 1 ligne. Moins de colonnes = plus de constance.",
      term: "JOURNAL · MÉTRIQUES MENTALES",
      heads: ["Colonnes utiles", "Revue", "Inutile"],
      texts: [
        "Utile : émotion, respect plan, tilt O/N, note d’énergie, 1 leçon.",
        "Revue hebdo : combien de trades hors émotion ≥ 4 ? Combien de violations ?",
        "Inutile : romans de 2 pages après chaque trade — tu arrêteras.",
      ],
      protocol: "Max 60 secondes post-trade pour les colonnes mentales.",
      forgeLink: "Module P1 Data & journal · Journal La Forge.",
      steps: [
        "Crée le template (ou colonnes Journal plateforme).",
        "Remplis 10 trades d’affilée sans exception.",
        "Dimanche : 3 stats mentales + 1 correctif pour la semaine.",
      ],
    },
    {
      slug: "systeme",
      group: "Système mental",
      title: "Système mindset La Forge",
      subtitle: "Assembler le protocole complet",
      intro:
        "Le mindset devient réel quand tout est assemblé : pré-session, pendant, post, revue, circuit breakers. " +
        "Cette fiche est ta checklist mentale permanente.",
      chart: "Boucle complète : Plan → Exécution → Revue",
      type: "systeme",
      caption:
        "Dimanche (biais) → pré-session → exécution A+ → journal → stop rules → revue. Chaque flèche = une règle écrite.",
      term: "SYSTÈME · CHECKLIST MENTALE FORGE",
      heads: ["Pré", "Pendant", "Post / Revue"],
      texts: [
        "Pré : scores énergie, biais, niveaux, risque max, conditions flat.",
        "Pendant : checklist setup, score émotion < 4, taille fixe, protocole 2 pertes actif.",
        "Post : journal technique + mental. Revue dimanche : métriques process avant PnL.",
      ],
      protocol: "Imprimer / épingler cette boucle. Aucun trade hors boucle.",
      forgeLink: "P2 + P6 + Module 0 Process + Journal. Atlas Psycho = référence permanente.",
      steps: [
        "Copie la boucle dans ton Notion / mur.",
        "Fais 5 sessions démo en respectant 100 % la boucle.",
        "Passe réel seulement si le respect process ≥ 90 % sur 20 sessions.",
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
      (color || PSY) +
      '" fill-opacity=".14" stroke="' +
      (color || PSY) +
      '" stroke-opacity=".45" rx="3"/>'
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

    if (t === "mindset") {
      s +=
        '<path class="anim-draw d1" d="M70 200 C120 80, 180 280, 240 120 S360 260, 420 100 S540 240, 600 140 S720 220, 800 160" fill="none" stroke="' +
        BEAR +
        '" stroke-width="2.5" stroke-dasharray="6 4"/>';
      s +=
        '<path class="anim-draw d2" d="M70 280 L160 260 L250 240 L340 210 L430 190 L520 160 L610 140 L700 110 L800 90" fill="none" stroke="' +
        BULL +
        '" stroke-width="3"/>';
      s += label(620, 55, "Process (mesurable)", BULL);
      s += label(620, 200, "Motivation (vague)", BEAR);
    }

    if (t === "identite") {
      s += zone(60, 60, 320, 220, BEAR, "anim-fade d1");
      s += zone(460, 60, 320, 220, BULL, "anim-fade d2");
      s += label(90, 100, "EGO", BEAR, 18);
      s += label(90, 140, "Avoir raison", MUTED);
      s += label(90, 170, "Élargir SL", MUTED);
      s += label(90, 200, "Revenge", MUTED);
      s += label(490, 100, "PROCESS", BULL, 18);
      s += label(490, 140, "Respect règle", MUTED);
      s += label(490, 170, "Flat OK", MUTED);
      s += label(490, 200, "Survivre", MUTED);
    }

    if (t === "biais") {
      var biases = [
        [60, 50, "Aversion perte", "Hold losers"],
        [300, 50, "Confirmation", "Ignore invalidation"],
        [540, 50, "Ancrage", "Prix « magique »"],
        [60, 180, "Disponibilité", "Dernier trade"],
        [300, 180, "Excès confiance", "Taille ↑"],
        [540, 180, "FOMO", "Chase"],
      ];
      biases.forEach(function (b, i) {
        s += zone(b[0], b[1], 210, 100, i % 2 ? AMBER : PSY, "anim-fade d" + (i + 1));
        s += label(b[0] + 14, b[1] + 40, b[2], GOLD, 14);
        s += label(b[0] + 14, b[1] + 70, b[3], MUTED, 12);
      });
    }

    if (t === "prospect") {
      s += line(80, 180, 780, 180, MUTED, "4 4");
      s += label(700, 170, "Référence", MUTED);
      s +=
        '<path class="anim-draw d1" d="M80 180 Q200 100, 400 60 T780 40" fill="none" stroke="' +
        BULL +
        '" stroke-width="2.5"/>';
      s +=
        '<path class="anim-draw d2" d="M80 180 Q200 280, 400 310 T780 330" fill="none" stroke="' +
        BEAR +
        '" stroke-width="2.5"/>';
      s += label(500, 55, "Gains (valeur perçue)", BULL);
      s += label(500, 300, "Pertes (douleur >)", BEAR);
    }

    if (t === "heuristiques") {
      s +=
        '<path class="anim-draw d1" d="M100 80 L100 280 L700 280" fill="none" stroke="' +
        MUTED +
        '" stroke-width="2"/>';
      s += label(120, 70, "Raccourci mental", AMBER);
      s +=
        '<path class="anim-draw d2" d="M100 120 C250 120, 300 200, 450 200 S600 260, 700 260" fill="none" stroke="' +
        BEAR +
        '" stroke-width="3"/>';
      s += label(520, 240, "Erreur de trade", BEAR);
      s += zone(200, 140, 180, 50, PSY, "anim-fade d3");
      s += label(220, 170, "« Comme hier »", PSY);
    }

    if (t === "crowd") {
      s +=
        '<path class="anim-draw d1" d="M70 200 C140 80, 220 80, 300 160 S420 300, 500 280 S620 100, 700 120 S780 200, 820 180" fill="none" stroke="' +
        PSYD +
        '" stroke-width="3"/>';
      var labs = [
        [120, 70, "Euphorie"],
        [280, 150, "Déni"],
        [420, 290, "Peur"],
        [560, 270, "Capitulation"],
        [700, 100, "Espoir"],
      ];
      labs.forEach(function (p, i) {
        s += label(p[0], p[1], p[2], i === 2 || i === 3 ? BEAR : GOLD, 13);
      });
    }

    if (t === "liqemo") {
      s += zone(200, 220, 400, 30, AMBER, "anim-fade d1 anim-pulse");
      s += label(220, 210, "Cluster de stops retail (évident)", AMBER);
      s +=
        '<path class="anim-draw d2" d="M80 120 L160 140 L240 130 L320 160 L400 150 L480 240 L520 200 L600 180 L700 100 L800 90" fill="none" stroke="' +
        AQUA +
        '" stroke-width="2.5"/>';
      s += label(480, 270, "Sweep possible", BEAR);
      s += label(650, 80, "Reprise", BULL);
    }

    if (t === "emotions") {
      var emos = [
        [70, 70, "FOMO", "Chase"],
        [250, 70, "Peur", "Hésitation"],
        [430, 70, "Greed", "Sur-cible"],
        [610, 70, "Revenge", "Double"],
      ];
      emos.forEach(function (e, i) {
        s += zone(e[0], e[1], 150, 90, BEAR, "anim-fade d" + (i + 1));
        s += label(e[0] + 20, e[1] + 40, e[2], GOLD, 15);
        s += label(e[0] + 20, e[1] + 70, e[3], MUTED, 12);
      });
      s +=
        '<path class="anim-draw d5" d="M140 200 L140 250 L700 250 L700 200" fill="none" stroke="' +
        PSY +
        '" stroke-width="2"/>';
      s += label(280, 280, "Boucle → pause + règle écrite", PSY);
    }

    if (t === "tilt") {
      s += zone(60, 80, 200, 160, AQUA, "anim-fade d1");
      s += label(90, 130, "1 perte", AQUA, 16);
      s += label(90, 170, "Process OK", MUTED);
      s += zone(300, 80, 200, 160, AMBER, "anim-fade d2");
      s += label(330, 130, "2 pertes", AMBER, 16);
      s += label(330, 170, "STOP session", MUTED);
      s += zone(540, 80, 240, 160, BEAR, "anim-fade d3");
      s += label(570, 130, "Violation / tilt", BEAR, 16);
      s += label(570, 170, "24–48 h off", MUTED);
      s += label(200, 290, "Circuit breaker La Forge", GOLD);
    }

    if (t === "stress") {
      s +=
        '<path class="anim-draw d1" d="M80 260 L200 240 L320 200 L420 120 L520 80 L650 50 L780 40" fill="none" stroke="' +
        BEAR +
        '" stroke-width="3"/>';
      s +=
        '<path class="anim-draw d2" d="M80 260 L200 250 L320 230 L450 210 L600 200 L780 190" fill="none" stroke="' +
        BULL +
        '" stroke-width="2.5"/>';
      s += label(600, 45, "Charge stress", BEAR);
      s += label(600, 185, "Qualité décision", BULL);
      s += line(420, 50, 420, 280, AMBER, "4 3", "anim-draw d3");
      s += label(430, 300, "Seuil → less trade", AMBER, 13);
    }

    if (t === "journal") {
      var cols = ["Émotion", "Biais", "Plan O/N", "Trigger", "Leçon"];
      cols.forEach(function (c, i) {
        var x = 70 + i * 145;
        s += zone(x, 80, 130, 180, PSY, "anim-fade d" + (i + 1));
        s += label(x + 16, 120, c, GOLD, 13);
        s += label(x + 16, 160, "…", MUTED, 18);
      });
      s += label(70, 300, "60 secondes max · constance > détail", MUTED);
    }

    if (t === "systeme") {
      var nodes = [
        [80, 140, "Dimanche"],
        [230, 80, "Pré-session"],
        [400, 80, "Exécution"],
        [570, 140, "Journal"],
        [700, 220, "Revue"],
        [400, 240, "Stop rules"],
      ];
      nodes.forEach(function (n, i) {
        s +=
          '<circle class="anim-fade d' +
          (i + 1) +
          '" cx="' +
          (n[0] + 40) +
          '" cy="' +
          (n[1] + 20) +
          '" r="36" fill="none" stroke="' +
          PSYD +
          '" stroke-width="2"/>';
        s += label(n[0] + 10, n[1] + 25, n[2], GOLD, 12);
      });
      s +=
        '<path class="anim-draw d4" d="M150 160 L240 110 M300 100 L400 100 M480 100 L580 150 M640 170 L720 220 M600 250 L480 250 M420 220 L420 140" fill="none" stroke="' +
        AQUA +
        '" stroke-width="2"/>';
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
      .replace("Mindset pro vs motivation", "Mindset pro")
      .replace("Identité & ego du trader", "Identité & ego")
      .replace("Biais cognitifs du trader", "Biais cognitifs")
      .replace("Théorie des perspectives", "Prospect theory")
      .replace("Heuristiques & illusions", "Heuristiques")
      .replace("Psychologie de foule", "Foule / cycles")
      .replace("Comportement retail & liquidité", "Retail & liquidité")
      .replace("FOMO, peur, greed, revenge", "4 émotions")
      .replace("Tilt & protocole 2 pertes", "Tilt / 2 pertes")
      .replace("Stress, corps & attention", "Stress & corps")
      .replace("Journal psychologique", "Journal psycho")
      .replace("Système mindset La Forge", "Système Forge");
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
    el("protocol").textContent = l.protocol;
    el("forge-link").textContent = l.forgeLink;
    el("steps").innerHTML = l.steps
      .map(function (step) {
        return "<li>" + step + "</li>";
      })
      .join("");
    el("page-count").textContent =
      String(active + 1).padStart(2, "0") + " / " + lessons.length;
    el("previous").disabled = active === 0;
    el("next").textContent =
      active === lessons.length - 1 ? "Revoir le parcours ↺" : "Fiche suivante →";
    document.title = l.title + " — Atlas Psycho · La Forge";
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

  function bootForgePsychoAtlas() {
    if (!document.getElementById("psycho-atlas-root")) return;
    if (!location.hash || location.hash === "#") {
      location.replace("#mindset-pro");
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
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    });
    render();
  }

  window.bootForgePsychoAtlas = bootForgePsychoAtlas;
})();
