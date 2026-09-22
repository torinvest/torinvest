/**
 * Atlas Indicateurs — La Forge (ressource pédagogique complémentaire).
 * Oscillateurs, moyennes mobiles, volume, profils de volume, Fibonacci, VWAP...
 * Process > indicateur magique. Ne valide aucun module de formation.
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
      slug: "philosophie",
      group: "Fondations",
      title: "Pourquoi des indicateurs (et pourquoi pas tous)",
      subtitle: "Un outil, pas une religion",
      intro:
        "Un indicateur est une transformation mathématique du prix (et parfois du volume) : il lisse, mesure une vitesse ou distribue un volume. " +
        "Il ne prédit rien seul — il résume le passé. La Forge lit d'abord la structure et la liquidité (ICT) ; les indicateurs de cet atlas sont des filtres ou des confirmations, jamais un système autonome.",
      chart: "Prix brut vs indicateur dérivé (retard structurel)",
      type: "philosophie",
      caption:
        "Le prix (ligne pleine) mène ; l'indicateur dérivé (ligne pointillée décalée) suit avec un retard inhérent à son calcul.",
      term: "PHILOSOPHIE · DÉRIVÉ, PAS ORACLE",
      heads: ["Un indicateur = une fonction du prix", "Retard structurel", "Overload = paralysie"],
      texts: [
        "Tout indicateur (SMA, RSI, MACD…) est calculé à partir de closes/highs/lows passés. Il ne « voit » pas l'avenir ; il résume le passé sous une forme différente.",
        "Moyenner ou dériver introduit mécaniquement un retard (lag). Plus la période est longue, plus le signal est lissé… et tardif.",
        "Empiler 6 indicateurs redondants (ex. 3 oscillateurs de momentum) ne donne pas 6 fois plus d'info — souvent la même info répétée, avec plus de bruit visuel et d'indécision.",
      ],
      tools: "Aucun logiciel spécifique ; principe de méthode, applicable sur TradingView / MT5 / tout charting.",
      forgeLink:
        "La Forge structure d'abord via ICT (BOS/MSS, liquidité) — voir Atlas ICT. Les indicateurs de cet atlas sont des compléments, jamais le socle.",
      steps: [
        "Demande-toi quelle question précise cet indicateur répond.",
        "Vérifie qu'il n'est pas redondant avec un indicateur déjà affiché.",
        "Priorise la structure prix ; ajoute l'indicateur seulement s'il apporte une info non redondante.",
      ],
      combine:
        "Ne combine un indicateur qu'avec ta lecture structure (HH/HL, BOS, liquidité) — jamais deux indicateurs qui répondent à la même question (ex. RSI + Stochastique en simultané) sans raison précise.",
      caseStudy: {
        title: "Le graphique à 9 indicateurs",
        setup:
          "Un trader débutant empile SMA20/50/200, RSI, MACD, Stochastique, Bollinger et VWAP sur son XAU/USD M15, plus 2 indicateurs de volume.",
        action:
          "Face à un signal RSI haussier contredit par un MACD baissier et un Stochastique neutre, il hésite, entre tard, sort tôt sur un simple retracement — perd le trade alors que la structure H4 était clairement haussière.",
        lesson:
          "Le problème n'était pas le manque d'info, mais l'excès : aucun indicateur seul n'aurait suffi, et leur addition a créé de la confusion. Une lecture structure claire + 1 indicateur de confirmation aurait suffi.",
      },
      quiz: [
        {
          q: "Un indicateur technique est fondamentalement…",
          options: [
            "Un outil prédictif indépendant du prix",
            "Une transformation mathématique dérivée du prix passé",
            "Une donnée fournie par la banque centrale",
            "Un signal garanti si bien paramétré",
          ],
          correct: 1,
        },
        {
          q: "Pourquoi tout indicateur dérivé du prix comporte-t-il un retard structurel ?",
          options: [
            "Parce qu'il est calculé à partir de données déjà passées",
            "Parce que les brokers retardent volontairement l'affichage",
            "Parce que les indicateurs sont mis à jour une fois par jour",
            "Ce n'est pas vrai, les indicateurs sont toujours instantanés",
          ],
          correct: 0,
        },
        {
          q: "Empiler 6 indicateurs redondants sur un graphique…",
          options: [
            "Multiplie la fiabilité du signal par 6",
            "Ajoute surtout du bruit et de l'indécision sans info nouvelle",
            "Est recommandé par La Forge pour confirmer chaque trade",
            "Élimine le besoin de lire la structure de marché",
          ],
          correct: 1,
        },
      ],
    },
    {
      slug: "checklist",
      group: "Fondations",
      title: "Avant d'ajouter un indicateur",
      subtitle: "5 questions avant de cliquer « Ajouter »",
      intro:
        "Chaque indicateur ajouté sur ton graphique a un coût cognitif. Avant d'en ajouter un, pose-toi une checklist simple : " +
        "quelle question il répond, s'il est redondant, quel est son lag, comment il se comporte en range vs tendance sur XAU, et si tu peux l'expliquer en une phrase.",
      chart: "Checklist visuelle — 5 filtres avant ajout",
      type: "checklist",
      caption: "Cinq cases à cocher mentalement avant d'ajouter un indicateur à ton chart de trading.",
      term: "CHECKLIST · FILTRE AVANT AJOUT",
      heads: ["Question précise", "Redondance", "Comportement XAU"],
      texts: [
        "Quelle question précise cet indicateur répond-il (momentum, volatilité, niveau de prix, volume…) ? Si tu ne peux pas répondre en une phrase, ne l'ajoute pas.",
        "Compare avec ce qui est déjà affiché. RSI et Stochastique répondent presque à la même question (momentum borné) — les deux ensemble ajoutent rarement de la valeur.",
        "Sur XAU/USD, la volatilité est irrégulière (news USD, sessions asiatiques calmes vs Londres/NY agressives). Teste comment ton indicateur réagit en range serré ET en forte tendance avant de le garder.",
      ],
      tools: "Ta grille d'évaluation (papier ou note TradingView), journal de trading pour noter l'utilité réelle sur 20-30 trades.",
      forgeLink:
        "Complète le module data-journal de La Forge : note « indicateur utilisé » et « a-t-il changé ma décision ? » pour chaque trade.",
      steps: [
        "Écris la question à laquelle l'indicateur doit répondre avant de l'ajouter.",
        "Vérifie l'absence de redondance avec les indicateurs déjà présents.",
        "Observe-le 1-2 semaines en watch-only sur XAU avant de l'intégrer à ton plan.",
      ],
      combine:
        "Un indicateur qui passe la checklist se combine avec la structure ICT comme filtre de confirmation — pas comme déclencheur seul. S'il échoue à une question, retire-le plutôt que de le garder « par habitude ».",
      caseStudy: {
        title: "Le nettoyage de graphique",
        setup: "Une trader a 7 indicateurs sur son graphique XAU depuis 6 mois sans jamais les questionner.",
        action:
          "Elle applique la checklist un par un : 4 indicateurs répondent à la même question (momentum), 1 n'a jamais influencé une décision en 3 mois de journal.",
        lesson:
          "Elle retire 5 indicateurs sur 7, garde une moyenne mobile de tendance et un indicateur de volume. Ses décisions deviennent plus rapides et son taux d'exécution du plan s'améliore — pas parce que les indicateurs retirés étaient mauvais, mais parce qu'ils ne servaient à rien pour elle.",
      },
      quiz: [
        {
          q: "Avant d'ajouter un indicateur, la première question à se poser est :",
          options: [
            "Est-ce que mes amis traders l'utilisent ?",
            "Quelle question précise cet indicateur répond-il ?",
            "Est-ce qu'il a une belle couleur par défaut ?",
            "Combien coûte l'abonnement TradingView premium ?",
          ],
          correct: 1,
        },
        {
          q: "RSI et Stochastique posés ensemble sur un graphique constituent souvent :",
          options: [
            "Deux confirmations totalement indépendantes",
            "Une redondance, car ils répondent à une question très proche",
            "Un signal obligatoire de retournement",
            "Une exigence réglementaire des brokers",
          ],
          correct: 1,
        },
        {
          q: "Le meilleur moyen de juger si un indicateur t'est vraiment utile est :",
          options: [
            "De le garder par habitude",
            "De consulter son cours de formation une seule fois",
            "De le suivre en journal sur plusieurs trades pour voir s'il influence réellement tes décisions",
            "De changer d'indicateur après chaque perte",
          ],
          correct: 2,
        },
      ],
    },
    {
      slug: "ema",
      group: "Oscillateurs & tendance",
      title: "Moyennes mobiles (SMA / EMA)",
      subtitle: "Lisser le prix pour lire la tendance",
      intro:
        "SMA (moyenne simple) et EMA (exponentielle, plus réactive) résument une série de prix en une ligne. " +
        "Elles servent à visualiser une tendance ou un niveau dynamique de support/résistance — pas à prédire un renversement au pixel près.",
      chart: "EMA20 (rapide) et EMA50 (lente) sur tendance",
      type: "ema",
      caption:
        "L'EMA20 réagit plus vite que l'EMA50. Leur croisement (golden/death cross) est un signal de retard, mieux utilisé comme filtre de biais que comme déclencheur.",
      term: "MM · SMA / EMA · CROISEMENT",
      heads: ["SMA vs EMA", "Pente = biais", "Croisement = retard"],
      texts: [
        "SMA = moyenne arithmétique simple des N dernières clôtures. EMA = pondère davantage les prix récents, donc réagit plus vite aux changements — au prix d'un peu plus de bruit.",
        "La pente de la moyenne (montante, plate, descendante) donne un biais de tendance simple. Une EMA plate = marché indécis, souvent en range.",
        "Un croisement EMA20/EMA50 confirme un mouvement déjà bien engagé. Utilisé seul comme signal d'entrée, il te fait souvent entrer tard et sortir tard.",
      ],
      tools: "TradingView / MT5 (indicateur natif « Moving Average »). Périodes courantes XAU : EMA20/50/200 en H1-H4.",
      forgeLink: "Utile comme filtre de biais de tendance, complémentaire au BOS/MSS ICT. Voir module structure La Forge.",
      steps: [
        "Place une EMA rapide (20) et une lente (50) sur ton UT de contexte.",
        "Lis la pente et l'écartement des deux lignes comme biais, pas comme signal.",
        "N'entre jamais sur le simple croisement sans confirmation de structure.",
      ],
      combine:
        "Combine l'EMA avec la structure de marché (HH/HL) comme filtre directionnel — trade uniquement dans le sens où prix et EMA sont alignés. Éviter de multiplier les EMA (20/50/100/200 en même temps) : deux suffisent pour un biais clair.",
      caseStudy: {
        title: "Le croisement en retard",
        setup: "Sur XAU H1, un trader attend un croisement EMA20/50 haussier pour entrer long.",
        action:
          "Le croisement se produit après un mouvement de 80 points déjà réalisé ; il entre, le prix retrace immédiatement vers l'EMA20 qui n'a pas encore rattrapé le prix.",
        lesson:
          "Le croisement a confirmé une tendance déjà visible sur la structure prix (série de HH/HL) plusieurs bougies avant. La structure aurait donné une entrée plus précoce et un stop plus serré.",
      },
      quiz: [
        {
          q: "Quelle est la différence principale entre SMA et EMA ?",
          options: [
            "La SMA est plus réactive que l'EMA",
            "L'EMA pondère davantage les prix récents et réagit plus vite",
            "Elles utilisent des données différentes (volume vs prix)",
            "La SMA nécessite un abonnement premium",
          ],
          correct: 1,
        },
        {
          q: "Un croisement EMA20/EMA50 comme seul signal d'entrée présente quel risque principal ?",
          options: [
            "Il est toujours parfaitement au sommet du mouvement",
            "Il confirme un mouvement souvent déjà bien engagé (retard)",
            "Il ne fonctionne que sur les actions, pas sur le forex",
            "Il nécessite un delta pour être valide",
          ],
          correct: 1,
        },
        {
          q: "Sur quoi doit reposer la validation d'une entrée après un croisement EMA, selon La Forge ?",
          options: [
            "Le croisement seul suffit toujours",
            "La couleur des bougies uniquement",
            "La confirmation par la structure de marché (BOS/MSS)",
            "Le nombre de likes sur un post Discord",
          ],
          correct: 2,
        },
      ],
    },
    {
      slug: "rsi",
      group: "Oscillateurs & tendance",
      title: "RSI",
      subtitle: "Mesurer la vitesse du mouvement, pas prédire un retournement",
      intro:
        "Le RSI (Relative Strength Index) compare l'ampleur des hausses récentes à celle des baisses sur une période donnée (14 par défaut), borné entre 0 et 100. " +
        "Il indique une vitesse relative de mouvement — « surachat/survente » ne signifie pas « retournement imminent », surtout en tendance forte.",
      chart: "RSI oscillant avec zones 30/70 et divergence",
      type: "rsi",
      caption:
        "Le RSI touche la zone de surachat (>70) pendant une tendance haussière soutenue sans jamais retourner — le « surachat » peut durer. La divergence baissière (prix monte, RSI baisse) est le signal le plus utilisé.",
      term: "RSI · MOMENTUM BORNÉ 0-100",
      heads: ["Calcul & zones", "Piège tendance forte", "Divergence"],
      texts: [
        "RSI = 100 − [100/(1+RS)], RS = moyenne des hausses / moyenne des baisses sur N périodes. Zones classiques : >70 surachat, <30 survente — arbitraires, à adapter au marché.",
        "En tendance forte (ex. XAU sur macro haussière), le RSI peut rester au-dessus de 60-70 pendant des semaines. Vendre « parce que surachat » contre une tendance forte est une des erreurs les plus courantes.",
        "La divergence (prix fait un nouveau plus haut, RSI un plus bas ou l'inverse) signale un essoufflement du momentum — c'est une alerte, pas un ordre : elle demande confirmation structure avant action.",
      ],
      tools: "TradingView / MT5 (RSI natif). Période 14 par défaut ; certains traders testent 9 ou 21 selon l'UT.",
      forgeLink:
        "Combine avec la liquidité ICT — une divergence RSI près d'un niveau de liquidité (BSL/SSL) est plus significative qu'isolée. Voir Atlas ICT → Liquidité.",
      steps: [
        "Lis le RSI comme mesure de vitesse, pas comme signal binaire achat/vente.",
        "En tendance forte, ignore les surachats/surventes simples ; cherche les divergences.",
        "Confirme toute divergence par une réaction de structure avant d'agir.",
      ],
      combine:
        "Le RSI se combine bien avec un niveau de structure (S/R, OTE ICT) : une divergence RSI SUR un niveau clé vaut plus qu'une divergence en plein milieu de nulle part. Éviter de l'empiler avec le Stochastique (redondant, même question : momentum borné).",
      caseStudy: {
        title: "Vendre l'or parce que « surachat »",
        setup: "XAU/USD entame une tendance haussière macro forte ; le RSI H4 dépasse 70 et y reste plusieurs jours.",
        action:
          "Un trader vend systématiquement chaque passage au-dessus de 70, empilant 4 pertes consécutives alors que la tendance structure (HH/HL nets) reste intacte.",
        lesson:
          "Le RSI mesurait une vitesse réelle (momentum fort), pas une fatigue du marché. Sans divergence ni cassure de structure, « surachat » en tendance forte n'est pas un signal de vente — c'est la définition d'une tendance saine.",
      },
      quiz: [
        {
          q: "Un RSI supérieur à 70 pendant une tendance haussière forte signifie :",
          options: [
            "Un retournement est imminent et garanti",
            "Le momentum est fort ; le surachat peut durer longtemps en tendance",
            "L'indicateur est cassé et doit être recalibré",
            "Il faut vendre immédiatement toute position",
          ],
          correct: 1,
        },
        {
          q: "Une divergence RSI (prix monte, RSI baisse) doit être traitée comme :",
          options: [
            "Un ordre de vente immédiat sans autre analyse",
            "Une alerte qui nécessite confirmation de structure avant action",
            "Un bug de l'indicateur à ignorer",
            "Une preuve certaine de retournement",
          ],
          correct: 1,
        },
        {
          q: "La divergence RSI a le plus de valeur lorsqu'elle se produit :",
          options: [
            "N'importe où sur le graphique",
            "Uniquement sur timeframe M1",
            "Près d'un niveau de liquidité ou de structure clé",
            "Uniquement le vendredi",
          ],
          correct: 2,
        },
      ],
    },
    {
      slug: "macd",
      group: "Oscillateurs & tendance",
      title: "MACD",
      subtitle: "Convergence/divergence de deux moyennes exponentielles",
      intro:
        "Le MACD trace la différence entre deux EMA (typiquement 12 et 26), plus une ligne de signal (EMA9 du MACD) et un histogramme. " +
        "Il mesure l'accélération/décélération du momentum — utile pour lire un essoufflement, fragile comme signal d'entrée seul.",
      chart: "Ligne MACD, ligne signal, histogramme et croisement",
      type: "macd",
      caption:
        "Le croisement MACD/signal sous la ligne zéro suivi d'un histogramme qui se contracte annonce souvent un ralentissement — mais arrive après une partie du mouvement.",
      term: "MACD · EMA12-EMA26 · SIGNAL · HISTOGRAMME",
      heads: ["Trois composants", "Ligne zéro = biais", "Retard cumulé"],
      texts: [
        "MACD = EMA12 − EMA26. Ligne signal = EMA9 du MACD. Histogramme = MACD − signal, visualise l'écart entre les deux et l'accélération/décélération.",
        "Passage au-dessus/en dessous de zéro donne un biais simple (EMA12 > EMA26 = momentum haussier). Le croisement MACD/signal est souvent utilisé comme timing — mais il combine déjà deux couches de lissage, donc deux couches de retard.",
        "Parce qu'il dérive de deux EMA, le MACD est structurellement en retard sur le prix. Sur XAU en range serré, il génère de nombreux faux signaux (whipsaw).",
      ],
      tools: "TradingView / MT5 (MACD natif, paramètres 12/26/9 standards).",
      forgeLink:
        "Utile comme filtre de momentum sur UT de contexte (H4/D1) avant une entrée basée sur structure/liquidité ICT en UT inférieure.",
      steps: [
        "Utilise la position par rapport à zéro comme biais de fond, pas comme signal d'entrée.",
        "Regarde l'histogramme pour l'accélération/décélération plutôt que le simple croisement.",
        "Sur range, réduis ta confiance dans les croisements MACD — ils multiplient les faux signaux.",
      ],
      combine:
        "Combine le MACD avec une lecture de range vs tendance (structure prix) : en range, ignore-le largement ; en tendance, utilise-le pour repérer un essoufflement avant une prise de profit partielle. Éviter de le combiner avec RSI ET Stochastique simultanément — trois mesures de momentum redondantes.",
      caseStudy: {
        title: "Whipsaw en range asiatique",
        setup: "Sur XAU M15 pendant la session asiatique calme, le prix oscille dans un range serré de 15 dollars.",
        action:
          "Le MACD croise sa ligne de signal 6 fois en 4 heures, générant 6 signaux contradictoires ; un trader qui suit chaque croisement accumule des pertes de spread.",
        lesson:
          "Le MACD n'est pas fait pour un marché sans directionnalité. Reconnaître d'abord le range (structure : plus hauts et plus bas plats) aurait évité d'utiliser un outil de momentum de tendance dans un contexte où il ne s'applique pas.",
      },
      quiz: [
        {
          q: "Le MACD est calculé à partir de :",
          options: [
            "Le volume échangé uniquement",
            "La différence entre deux EMA (souvent 12 et 26)",
            "Le carnet d'ordres en temps réel",
            "Le RSI lissé sur 9 périodes",
          ],
          correct: 1,
        },
        {
          q: "Pourquoi le MACD génère-t-il souvent des faux signaux en range serré ?",
          options: [
            "Parce qu'il n'est pas fait pour les marchés sans directionnalité claire (whipsaw)",
            "Parce qu'il ne fonctionne que sur les cryptomonnaies",
            "Parce que TradingView le calcule mal",
            "Parce qu'il faut toujours utiliser des paramètres non standards",
          ],
          correct: 0,
        },
        {
          q: "L'histogramme du MACD sert principalement à visualiser :",
          options: [
            "Le volume échangé",
            "L'écart entre la ligne MACD et la ligne signal (accélération/décélération)",
            "Le spread du broker",
            "Le niveau de Fibonacci le plus proche",
          ],
          correct: 1,
        },
      ],
    },
    {
      slug: "stoch",
      group: "Oscillateurs & tendance",
      title: "Stochastique",
      subtitle: "Position du close dans son range récent",
      intro:
        "L'oscillateur stochastique compare le cours de clôture à l'amplitude (haut-bas) des N dernières périodes. " +
        "Il répond à la question : « où se situe le close dans son range récent ? » — une mesure de position, proche cousine du RSI.",
      chart: "%K et %D avec croisement en zone extrême",
      type: "stoch",
      caption:
        "%K (rapide) croise %D (lissée) en zone haute (>80) : signal de retournement potentiel, à confirmer par la structure, surtout en tendance établie.",
      term: "STOCH · %K / %D · 0-100",
      heads: ["Position dans le range", "%K vs %D", "Redondance avec RSI"],
      texts: [
        "%K = (close − plus bas N périodes) / (plus haut N périodes − plus bas N périodes) × 100. %D = moyenne mobile de %K (lissage). Zones classiques 80/20.",
        "%K réagit vite, %D plus lentement — leur croisement en zone extrême est le signal le plus regardé, mais reste basé sur un retard de lissage comme tout indicateur dérivé.",
        "Stochastique et RSI répondent à une question très voisine (momentum/position bornée). Les utiliser ensemble apporte rarement une information nouvelle — choisis-en un, pas les deux systématiquement.",
      ],
      tools: "TradingView / MT5 (Stochastic natif, %K 14, %D 3 par défaut).",
      forgeLink:
        "Comme le RSI, plus utile en confirmation d'un niveau de liquidité ou d'un retracement OTE ICT qu'en signal isolé.",
      steps: [
        "Choisis Stochastique OU RSI pour ta lecture de momentum, pas les deux en parallèle.",
        "Cherche le croisement %K/%D en zone extrême PRÈS d'un niveau structurel, pas n'importe où.",
        "En tendance forte, traite les zones extrêmes comme force du mouvement, pas fatigue automatique.",
      ],
      combine:
        "Se combine avec un niveau de S/R ou une zone de liquidité ICT pour confirmer un retournement local — jamais comme système autonome. Ne pas l'empiler avec le RSI (redondance quasi totale).",
      caseStudy: {
        title: "Deux oscillateurs, un seul message",
        setup: "Un trader affiche RSI et Stochastique en même temps sur son graphique XAU, pensant obtenir « deux confirmations ».",
        action:
          "Les deux indicateurs bougent presque en synchronisation parfaite sur 20 trades analysés en journal — ils ne se contredisent presque jamais et n'ajoutent aucune information l'un par rapport à l'autre.",
        lesson:
          "Deux indicateurs qui mesurent la même chose sous des formules différentes ne sont pas deux confirmations indépendantes. Garder un seul oscillateur de momentum libère de l'espace mental pour la structure et le risque.",
      },
      quiz: [
        {
          q: "L'oscillateur stochastique mesure :",
          options: [
            "Le volume échangé par bougie",
            "La position du close dans son range récent (haut-bas)",
            "La distance au VWAP",
            "Le nombre de traders actifs",
          ],
          correct: 1,
        },
        {
          q: "%K et %D dans le Stochastique correspondent à :",
          options: [
            "Deux devises différentes",
            "%K rapide, %D = moyenne lissée de %K",
            "Deux périodes de temps totalement indépendantes",
            "Un indicateur de volume",
          ],
          correct: 1,
        },
        {
          q: "Pourquoi est-il rarement utile d'utiliser Stochastique ET RSI simultanément ?",
          options: [
            "Parce qu'ils sont incompatibles techniquement",
            "Parce qu'ils répondent à une question de momentum très similaire (redondance)",
            "Parce que MT5 ne permet pas les deux en même temps",
            "Parce que c'est interdit par les régulateurs",
          ],
          correct: 1,
        },
      ],
    },
    {
      slug: "bollinger",
      group: "Oscillateurs & tendance",
      title: "Bandes de Bollinger",
      subtitle: "Volatilité relative autour d'une moyenne",
      intro:
        "Les Bandes de Bollinger tracent une moyenne mobile (souvent SMA20) entourée de bandes à ±2 écarts-types. " +
        "Elles mesurent la volatilité relative — un « squeeze » (bandes resserrées) précède souvent une expansion, sans dire dans quel sens.",
      chart: "Squeeze puis expansion des bandes avec breakout",
      type: "bollinger",
      caption:
        "Les bandes se resserrent (faible volatilité, souvent en range), puis s'écartent brutalement lors d'un breakout — le squeeze prévient d'un mouvement à venir, pas de sa direction.",
      term: "BOLLINGER · SMA20 ± 2σ · SQUEEZE",
      heads: ["Écart-type, pas niveau fixe", "Squeeze = compression", "Toucher la bande ≠ signal"],
      texts: [
        "Les bandes s'élargissent et se resserrent automatiquement selon la volatilité récente — contrairement à une zone S/R fixe, elles suivent le marché.",
        "Un squeeze (bandes proches) signale une phase de faible volatilité qui précède souvent (pas toujours) une expansion. Utile pour anticiper qu'un mouvement arrive, sans connaître sa direction.",
        "« Le prix touche la bande haute » n'est PAS automatiquement un signal de vente : en tendance forte, le prix peut « surfer » la bande pendant longtemps (walking the band).",
      ],
      tools: "TradingView / MT5 (Bollinger Bands natif, 20 périodes, 2 écarts-types par défaut).",
      forgeLink:
        "Le squeeze peut annoncer une sortie de range avant un BOS ICT — utile en filtre de « quelque chose va se passer », à combiner avec la lecture de liquidité pour la direction.",
      steps: [
        "Repère les phases de squeeze comme signal d'attente de volatilité, pas de direction.",
        "Ne vends/n'achète jamais uniquement parce que le prix touche une bande.",
        "Cherche la direction via la structure (BOS/liquidité), pas via les bandes seules.",
      ],
      combine:
        "Combine le squeeze Bollinger avec un range structurel identifié (S/R) pour anticiper une sortie de range, puis utilise la liquidité ICT pour choisir la direction du breakout attendu. Éviter de traiter le toucher de bande comme un signal de retournement autonome.",
      caseStudy: {
        title: "Walking the band sur XAU en tendance",
        setup:
          "XAU/USD entre en forte tendance haussière après une annonce macro ; le prix colle à la bande supérieure de Bollinger pendant plusieurs jours.",
        action:
          "Un trader vend à chaque toucher de bande haute en pensant « trop haut », empilant les pertes contre une tendance qui continue.",
        lesson:
          "Le « walking the band » est un comportement bien documenté en tendance forte. La bande mesure la volatilité relative, pas un plafond — sans confirmation de retournement structurel (BOS baissier), toucher la bande ne justifie rien seul.",
      },
      quiz: [
        {
          q: "Les Bandes de Bollinger sont construites autour de :",
          options: [
            "Une moyenne mobile ± un multiple de l'écart-type",
            "Le POC de la session",
            "Le VWAP de la journée",
            "Le plus haut et le plus bas de l'année",
          ],
          correct: 0,
        },
        {
          q: "Un « squeeze » (bandes resserrées) annonce généralement :",
          options: [
            "Une baisse garantie du prix",
            "Une phase de faible volatilité qui précède souvent une expansion (direction inconnue)",
            "La fermeture définitive du marché",
            "Un signal d'achat immédiat",
          ],
          correct: 1,
        },
        {
          q: "Le phénomène « walking the band » (le prix colle à une bande) se produit surtout :",
          options: [
            "En range serré uniquement",
            "En tendance forte et soutenue",
            "Uniquement sur les cryptomonnaies",
            "Jamais sur XAU/USD",
          ],
          correct: 1,
        },
      ],
    },
    {
      slug: "fibonacci",
      group: "Niveaux & exécution",
      title: "Fibonacci (retracements / extensions)",
      subtitle: "Ratios de retracement/extension, pas des aimants garantis",
      intro:
        "Les niveaux de Fibonacci (38,2 %, 50 %, 61,8 %, 78,6 % pour les retracements ; 127 %, 161,8 % pour les extensions) mesurent des proportions d'un mouvement. " +
        "Ils sont utiles comme zones de confluence — l'erreur classique est de les tracer « après coup » pour justifier une entrée déjà décidée.",
      chart: "Retracement d'une impulsion avec zone OTE 61,8-79%",
      type: "fibonacci",
      caption:
        "Après une impulsion haussière, le prix retrace dans la zone 61,8-79 % (OTE, Optimal Trade Entry en langage ICT) avant de reprendre la tendance.",
      term: "FIBO · RETRACEMENT / EXTENSION · OTE",
      heads: ["Ancrage swing-to-swing", "Zone, pas ligne", "Subjectivité de l'ancre"],
      texts: [
        "Trace toujours d'un point bas significatif à un point haut significatif (ou l'inverse) de l'impulsion que tu analyses — jamais entre deux points arbitraires choisis après coup.",
        "Traite 61,8 % et 78,6 % comme une zone de confluence (OTE), pas comme une ligne exacte au pixel. Combine avec un niveau S/R ou une zone de liquidité pour renforcer la zone.",
        "Deux traders peuvent ancrer différemment le même mouvement et obtenir des niveaux Fib différents. Fixe ta règle d'ancrage (ex. dernier swing net) avant d'entrer, pas en cherchant le ratio qui « colle » au trade que tu veux faire.",
      ],
      tools: "TradingView / MT5 (outil Fibonacci Retracement/Extension natif).",
      forgeLink:
        "L'OTE (62-79 %) est un concept central ICT enseigné dans les modules structure de La Forge — Fibonacci en est l'outil de mesure, la liquidité/structure en est le contexte de validation.",
      steps: [
        "Identifie une impulsion nette (swing bas → swing haut clair).",
        "Trace le Fibonacci et repère la zone OTE 61,8-79 % en confluence avec structure/liquidité.",
        "Attends une réaction (bougie, MSS local) dans la zone avant d'entrer — ne préempte pas.",
      ],
      combine:
        "Le Fibonacci se combine naturellement avec la liquidité et la structure ICT (BOS avant retracement, OTE comme zone d'entrée). Évite de tracer un Fib sur chaque petit mouvement — réserve-le aux impulsions structurelles claires.",
      caseStudy: {
        title: "Le Fib qui colle toujours après coup",
        setup:
          "Un trader trace un Fibonacci sur XAU, ne trouve pas de réaction au niveau attendu, puis redéplace l'ancre jusqu'à ce qu'un ratio « colle » avec le trade qu'il voulait faire.",
        action:
          "Il entre sur ce niveau retracé après coup ; le trade échoue car le niveau n'avait aucune base objective — juste un ajustement rétroactif.",
        lesson:
          "Fixer la règle d'ancrage (swing net, sur quelle UT) AVANT de tracer élimine ce biais. Un Fib qu'on peut réajuster à volonté n'a plus aucune valeur prédictive.",
      },
      quiz: [
        {
          q: "Pour tracer un retracement Fibonacci correctement, il faut ancrer les points sur :",
          options: [
            "N'importe quels deux points du graphique",
            "Un swing bas et un swing haut significatifs de l'impulsion étudiée",
            "Toujours le début de l'année en cours",
            "Le plus haut historique du marché",
          ],
          correct: 1,
        },
        {
          q: "La zone OTE (Optimal Trade Entry) en langage ICT correspond approximativement à :",
          options: [
            "0-10 % de retracement",
            "61,8 % à 78,6 % de retracement",
            "100 % à 150 % d'extension",
            "Le niveau 50 % exactement, jamais plus",
          ],
          correct: 1,
        },
        {
          q: "Redéplacer l'ancre d'un Fibonacci jusqu'à ce qu'un ratio « colle » avec le trade voulu est :",
          options: [
            "Une bonne pratique recommandée",
            "Un biais rétroactif qui invalide la valeur prédictive de l'outil",
            "Obligatoire pour un trading professionnel",
            "Sans importance si le trade gagne",
          ],
          correct: 1,
        },
      ],
    },
    {
      slug: "vwap",
      group: "Niveaux & exécution",
      title: "VWAP",
      subtitle: "Le prix moyen pondéré par le volume, référence intraday",
      intro:
        "Le VWAP calcule le prix moyen d'une session pondéré par le volume échangé à chaque niveau. " +
        "Les institutions l'utilisent comme référentiel d'exécution — les traders retail le lisent comme biais intraday et zone d'attraction/rejet.",
      chart: "Prix vs VWAP avec bandes d'écart-type",
      type: "vwap",
      caption:
        "Le prix évolue au-dessus du VWAP (biais acheteur de session), avec des bandes ±1σ/±2σ qui marquent des zones d'extension statistique.",
      term: "VWAP · ANCRE SESSION · BANDES σ",
      heads: ["Pondéré par volume", "Ancre = tout", "Extension ≠ cible garantie"],
      texts: [
        "Contrairement à une moyenne mobile classique (pondérée par le temps), le VWAP pondère par le volume échangé à chaque prix — plus représentatif de « où l'argent a vraiment transigé ».",
        "Le VWAP se recalcule depuis l'ouverture de l'ancre choisie (session, semaine, ou ancre custom depuis un point d'intérêt). Changer d'ancre change complètement la lecture — note toujours laquelle tu utilises.",
        "Un écart en ±2σ peut précéder un retour à la moyenne — ou au contraire une tendance forte qui ignore le VWAP pendant des heures. Ce n'est pas une cible automatique.",
      ],
      tools: "TradingView (VWAP natif, ancre session/semaine/custom). Plateformes futures pros.",
      forgeLink: "Particulièrement utile en killzone Londres/NY (module 06 Killzones de La Forge) combiné à la structure et à la liquidité.",
      steps: [
        "Fixe l'ancre (session NY/Londres, ou point structurel).",
        "Observe la position et la pente du prix par rapport au VWAP comme biais.",
        "N'entre pas seulement « parce que loin du VWAP » — exige une confirmation de structure.",
      ],
      combine:
        "Combine le VWAP avec la killzone de session et la structure ICT pour un biais intraday cohérent. Évite de multiplier les ancres (session + semaine + custom en même temps) — choisis l'ancre pertinente pour ton horizon de trade.",
      caseStudy: {
        title: "Fade du VWAP en tendance forte",
        setup: "XAU s'éloigne à +2,5σ du VWAP pendant la session NY suite à des données macro fortes.",
        action:
          "Un trader vend en pensant « trop loin, retour à la moyenne obligatoire » ; le prix continue à s'étendre encore 1,5σ supplémentaire avant toute pause.",
        lesson:
          "L'extension statistique décrit une probabilité historique de retour, pas une garantie. Sans signe de structure (MSS baissier, épuisement de liquidité), fader une tendance macro forte juste sur la distance au VWAP est un pari, pas un plan.",
      },
      quiz: [
        {
          q: "Le VWAP se différencie d'une moyenne mobile classique car il est pondéré par :",
          options: [
            "Le temps uniquement",
            "Le volume échangé à chaque niveau de prix",
            "Le nombre de traders connectés",
            "La volatilité implicite des options",
          ],
          correct: 1,
        },
        {
          q: "Changer l'ancre du VWAP (session vs semaine vs custom) :",
          options: [
            "N'a aucun effet sur la lecture",
            "Change complètement la lecture — il faut toujours noter quelle ancre est utilisée",
            "Est interdit par TradingView",
            "Ne concerne que les actions, pas le forex",
          ],
          correct: 1,
        },
        {
          q: "Un prix à +2 écarts-types du VWAP signifie :",
          options: [
            "Un retour à la moyenne est garanti immédiatement",
            "Une extension statistique qui peut se poursuivre en tendance forte, sans garantie de retour",
            "Que le marché va fermer",
            "Que le VWAP est mal calculé",
          ],
          correct: 1,
        },
      ],
    },
    {
      slug: "volume",
      group: "Volume & profils",
      title: "Volume classique",
      subtitle: "Combien a été échangé, sous chaque bougie",
      intro:
        "Le volume classique affiche la quantité échangée par période (bougie). Sur les CFD/forex retail, c'est souvent un volume « tick » " +
        "(nombre de changements de prix) plutôt qu'un volume réel de contrats — une nuance essentielle à connaître avant d'en tirer des conclusions fortes.",
      chart: "Histogramme de volume sous les bougies avec pic de breakout",
      type: "volume",
      caption:
        "Un pic de volume accompagne la cassure d'un niveau — plus de participation, donc plus de « conviction » apparente, mais toujours à lire en contexte.",
      term: "VOLUME · BARRES · TICK vs RÉEL",
      heads: ["Tick vs contrats réels", "Volume + structure", "Faible volume = prudence"],
      texts: [
        "Sur XAU CFD retail, le « volume » affiché est très souvent un proxy tick (nombre de mises à jour de prix), pas le volume réel du marché sous-jacent (futures COMEX). Ne le traite pas comme une donnée absolue.",
        "Un mouvement de prix avec un volume élevé a plus de « poids » qu'un mouvement équivalent à faible volume — utile pour juger la qualité d'une cassure de structure.",
        "Une cassure de niveau sur volume faible est plus susceptible d'être un faux breakout (manque de participation réelle) — reste prudent, attends confirmation.",
      ],
      tools: "Volume natif TradingView/MT5 (tick volume sur forex/CFD), volume réel disponible sur futures/actions.",
      forgeLink:
        "Le volume enrichit la lecture de BOS/MSS ICT : une cassure de structure avec volume soutenu est une confirmation supplémentaire, pas un signal indépendant.",
      steps: [
        "Vérifie si ton volume affiché est tick ou réel selon l'instrument.",
        "Compare le volume d'une cassure à sa moyenne récente — pic net ou faible participation ?",
        "Traite un breakout à faible volume avec plus de prudence (retest probable).",
      ],
      combine:
        "Le volume classique se combine bien comme filtre de confirmation d'un BOS/MSS ICT — pas comme signal autonome. Sur XAU CFD, ne le sur-interprète pas seul : privilégie-le en complément du Volume Profile ou du Delta si disponible sur ton broker.",
      caseStudy: {
        title: "Cassure sur volume creux un vendredi soir",
        setup:
          "XAU casse un niveau de résistance H1 vendredi 21h, en très faible liquidité de marché (weekend approche).",
        action:
          "Le volume tick affiché est nettement inférieur à la moyenne des sessions Londres/NY ; un trader entre quand même sur la cassure.",
        lesson:
          "Le prix retrace intégralement dès la réouverture lundi lors de la session asiatique normale. Une cassure en dehors des heures de forte participation (hors killzones) mérite une prudence accrue, volume ou pas.",
      },
      quiz: [
        {
          q: "Sur les CFD/forex retail (dont souvent XAU), le volume affiché est généralement :",
          options: [
            "Le volume réel exact du marché mondial",
            "Un proxy tick (nombre de changements de prix), pas le volume réel des contrats",
            "Toujours zéro",
            "Fourni directement par la banque centrale",
          ],
          correct: 1,
        },
        {
          q: "Une cassure de niveau accompagnée d'un volume élevé est généralement interprétée comme :",
          options: [
            "Un signal à ignorer totalement",
            "Une confirmation de plus de conviction dans le mouvement",
            "La preuve que le broker manipule le prix",
            "Sans lien avec la qualité de la cassure",
          ],
          correct: 1,
        },
        {
          q: "Une cassure sur volume faible mérite :",
          options: [
            "Une confiance absolue et une entrée immédiate",
            "Plus de prudence (risque de faux breakout / retest)",
            "D'être ignorée systématiquement, sans exception",
            "Rien de particulier, le volume ne compte jamais",
          ],
          correct: 1,
        },
      ],
    },
    {
      slug: "delta",
      group: "Volume & profils",
      title: "Delta / CVD / volume delta",
      subtitle: "Qui agresse : acheteurs ou vendeurs au marché",
      intro:
        "Le delta mesure la différence entre volume acheteur agressif (market buy, frappe l'ask) et volume vendeur agressif (market sell, frappe le bid) sur une période. " +
        "Le CVD (Cumulative Volume Delta) l'accumule dans le temps. Utile pour lire l'agression réelle — dépend fortement de la qualité du feed.",
      chart: "CVD divergent du prix (absorption)",
      type: "delta",
      caption:
        "Le prix fait un nouveau plus haut alors que le CVD cumulé stagne ou baisse — signe d'absorption possible (achats moins agressifs que le prix ne le suggère).",
      term: "DELTA · CVD · AGRESSION ACHETEUR/VENDEUR",
      heads: ["Delta = agression, pas volume total", "CVD cumulatif", "Feed-dépendant"],
      texts: [
        "Delta = volume exécuté au marché côté acheteur (ask) moins côté vendeur (bid) sur la période. Un delta positif ne veut pas dire « le prix monte », mais « les acheteurs ont été plus agressifs ».",
        "Le CVD cumule le delta dans le temps pour lire une tendance de pression d'achat/vente sur plusieurs bougies — les divergences prix/CVD (absorption) sont le signal le plus recherché.",
        "Sans un feed de qualité (idéalement futures/tick réel), le delta CFD retail est une approximation reconstruite, pas la vérité du carnet institutionnel global. Connais les limites de ta donnée avant d'y accorder trop de poids.",
      ],
      tools: "ATAS, Bookmap, Sierra Chart (futures, feed de qualité). Approximations disponibles sur certains CFD mais moins fiables.",
      forgeLink: "Complète la lecture de liquidité ICT (sweep + absorption au niveau) — module F1 microstructure de La Forge.",
      steps: [
        "Vérifie la qualité de ton feed avant de faire confiance au delta.",
        "Cherche les divergences prix/CVD aux niveaux clés (liquidité, S/R), pas partout.",
        "Exige un alignement avec la structure prix avant d'agir sur un delta seul.",
      ],
      combine:
        "Le delta/CVD se combine avec les niveaux de liquidité ICT (BSL/SSL) pour repérer une absorption au bon endroit — jamais isolément, et jamais sans un feed dont tu connais la qualité.",
      caseStudy: {
        title: "Absorption sur un sweep de liquidité",
        setup: "XAU balaie un plus bas de liquidité (SSL) intraday sur faible timeframe.",
        action:
          "Le CVD montre une forte poussée vendeuse absorbée sans nouvelle baisse de prix (delta négatif fort, prix stable) — signe d'acheteurs qui absorbent l'agression vendeuse.",
        lesson:
          "Le sweep de liquidité (structure ICT) donnait déjà le contexte ; le CVD a confirmé que l'agression vendeuse était en train d'être absorbée, renforçant la thèse de retournement local. Le delta seul, sans le sweep, n'aurait été qu'un signal ambigu parmi d'autres.",
      },
      quiz: [
        {
          q: "Le delta mesure :",
          options: [
            "Le volume total échangé, sans distinction",
            "La différence entre volume acheteur agressif et volume vendeur agressif",
            "La distance entre deux moyennes mobiles",
            "Le nombre de bougies vertes contre rouges",
          ],
          correct: 1,
        },
        {
          q: "Une divergence entre le prix (nouveau plus haut) et le CVD (stagnant/baissier) peut indiquer :",
          options: [
            "Une confirmation de la hausse à 100 %",
            "Une possible absorption (achats moins agressifs que le prix ne le suggère)",
            "Une erreur systématique du logiciel",
            "Que le marché est fermé",
          ],
          correct: 1,
        },
        {
          q: "Pourquoi faut-il être prudent avec le delta sur CFD retail ?",
          options: [
            "Parce que c'est souvent une approximation reconstruite, pas la vérité du carnet institutionnel global",
            "Parce que le delta n'existe pas sur CFD",
            "Parce qu'il est toujours à zéro",
            "Parce qu'il change de définition chaque jour",
          ],
          correct: 0,
        },
      ],
    },
    {
      slug: "vprofile",
      group: "Volume & profils",
      title: "Volume Profile (session)",
      subtitle: "Où le volume s'est concentré, par prix",
      intro:
        "Le Volume Profile distribue le volume échangé par niveau de prix sur une session donnée. " +
        "POC (Point of Control), VAH/VAL (Value Area High/Low) marquent où le marché a le plus « accepté » le prix.",
      chart: "Profil de session avec POC, VAH, VAL et HVN/LVN",
      type: "vprofile",
      caption:
        "Le POC (barre la plus longue) marque le prix le plus négocié de la session ; la Value Area (~70 % du volume) est bornée par VAH et VAL.",
      term: "VP SESSION · POC / VAH / VAL / HVN / LVN",
      heads: ["Prix × volume, pas temps × prix", "HVN colle, LVN accélère", "Un profil par session, pas figé"],
      texts: [
        "Contrairement au volume classique (sous chaque bougie, donc dans le temps), le Volume Profile répond : « à quels niveaux de PRIX a-t-on le plus transigé pendant cette session ? »",
        "Un HVN (High Volume Node) est une zone où le prix a « collé » — souvent une zone d'équilibre/rotation. Un LVN (Low Volume Node) est traversé rapidement — souvent une zone d'accélération si le prix y revient.",
        "Le profil se recalcule chaque session (ou selon la fenêtre choisie). Le POC d'hier n'est qu'une référence — le marché n'est pas obligé d'y revenir aujourd'hui.",
      ],
      tools: "TradingView Session Volume Profile, ATAS, Bookmap (feed de qualité recommandé).",
      forgeLink:
        "Enrichit la lecture premium/discount ICT — un POC dans une zone discount renforce une thèse d'achat. Module tool-indicateurs de La Forge.",
      steps: [
        "Choisis la fenêtre du profil (session Asie/Londres/NY ou range précis).",
        "Repère POC, VAH, VAL et d'éventuels LVN pertinents.",
        "Combine avec la structure : une réaction au POC n'est une confirmation que si le contexte structurel s'aligne.",
      ],
      combine:
        "Le Volume Profile session se combine avec premium/discount ICT et les killzones : un POC en zone discount pendant la killzone Londres est un contexte plus riche qu'un POC isolé. Évite de superposer plusieurs profils de fenêtres différentes en même temps — ça devient illisible.",
      caseStudy: {
        title: "Retour au POC de la veille en zone discount",
        setup:
          "XAU ouvre la session Londres en zone discount (sous l'équilibre du range daily), proche du POC de la session NY précédente.",
        action:
          "Le prix réagit exactement à ce POC avec un rejet net (mèche + volume), aligné avec un contexte discount ICT.",
        lesson:
          "La confluence POC + discount + timing killzone donne un setup plus solide qu'aucun des trois éléments seul. Le VP n'a pas « prédit » le rejet — il a fourni un niveau objectif à surveiller, confirmé par la réaction réelle du prix.",
      },
      quiz: [
        {
          q: "Le Volume Profile de session répond principalement à la question :",
          options: [
            "Quand le volume a-t-il eu lieu ?",
            "À quels niveaux de PRIX le volume s'est-il concentré ?",
            "Qui a acheté et qui a vendu ?",
            "Quelle est la volatilité implicite ?",
          ],
          correct: 1,
        },
        {
          q: "Un LVN (Low Volume Node) est généralement une zone :",
          options: [
            "Où le prix « colle » longtemps",
            "Traversée rapidement, souvent zone d'accélération si retestée",
            "Impossible à atteindre par le prix",
            "Réservée aux actions uniquement",
          ],
          correct: 1,
        },
        {
          q: "Le POC d'une session précédente :",
          options: [
            "Oblige mathématiquement le prix à y revenir",
            "Est un niveau de référence, sans obligation pour le prix d'y retourner",
            "N'a aucune utilité en trading",
            "Change de définition selon le broker",
          ],
          correct: 1,
        },
      ],
    },
    {
      slug: "frvp",
      group: "Volume & profils",
      title: "Fixed Range Volume Profile",
      subtitle: "Profil de volume sur une plage que TU choisis",
      intro:
        "Le Fixed Range Volume Profile (FRVP) applique la même logique que le Volume Profile, mais sur une plage de bougies que tu sélectionnes manuellement " +
        "(un swing, une consolidation, une semaine spécifique) plutôt qu'une session automatique.",
      chart: "FRVP sur un swing spécifique avec POC de la range",
      type: "frvp",
      caption:
        "En sélectionnant manuellement le début et la fin d'un swing ou d'une consolidation, le FRVP révèle où le volume s'est concentré DANS ce mouvement précis.",
      term: "FRVP · SÉLECTION MANUELLE · POC LOCAL",
      heads: ["Toi qui choisis la fenêtre", "Utile sur consolidations", "Biais de sélection"],
      texts: [
        "Contrairement au profil de session (automatique), le FRVP demande de sélectionner manuellement une plage — utile pour analyser un swing précis, une consolidation avant breakout, ou une range spécifique identifiée par ta lecture structure.",
        "Particulièrement pertinent sur une zone de consolidation (accumulation/distribution) : le POC de cette range peut devenir un niveau de référence pour le retest après la cassure.",
        "Comme tu choisis la fenêtre, tu peux inconsciemment sélectionner la plage qui « confirme » ce que tu veux voir. Fixe ta règle de sélection (ex. toujours le dernier swing structurel complet) avant de regarder le résultat.",
      ],
      tools: "TradingView Fixed Range Volume Profile (outil de dessin manuel).",
      forgeLink:
        "Très utile pour analyser une range avant BOS ICT — applique le FRVP sur la consolidation identifiée en structure, pas au hasard.",
      steps: [
        "Identifie d'abord la plage structurelle pertinente (swing, range, consolidation) via la lecture prix.",
        "Applique le FRVP sur cette plage précise, pas sur une sélection arbitraire.",
        "Utilise le POC local comme zone de retest potentiel après une cassure de la range.",
      ],
      combine:
        "Combine le FRVP avec une range/consolidation déjà identifiée par la structure ICT (avant un BOS) — la sélection doit suivre la lecture structure, jamais l'inverse (ne cherche pas la plage qui donne le résultat voulu).",
      caseStudy: {
        title: "POC de consolidation comme zone de retest",
        setup: "XAU consolide 3 jours dans une range serrée avant une cassure haussière nette (BOS confirmé).",
        action:
          "Un trader applique un FRVP sur exactement cette consolidation, identifie le POC local, et l'utilise comme zone d'intérêt pour un retest après cassure.",
        lesson:
          "Le prix retrace effectivement vers ce POC local avant de reprendre la hausse. Le FRVP a donné un niveau précis et objectif parce que la fenêtre choisie correspondait à une structure réelle (la consolidation), pas à une sélection arbitraire après coup.",
      },
      quiz: [
        {
          q: "La différence principale entre FRVP et Volume Profile de session est :",
          options: [
            "Le FRVP utilise une plage sélectionnée manuellement plutôt qu'une session automatique",
            "Le FRVP ne fonctionne que sur crypto",
            "Le FRVP ignore le volume",
            "Aucune différence, ce sont des synonymes",
          ],
          correct: 0,
        },
        {
          q: "Le FRVP est particulièrement utile pour analyser :",
          options: [
            "Une consolidation/range spécifique avant une cassure",
            "Uniquement les nouvelles économiques",
            "Le carnet d'ordres en temps réel",
            "Le sentiment des réseaux sociaux",
          ],
          correct: 0,
        },
        {
          q: "Le principal risque méthodologique du FRVP est :",
          options: [
            "Un biais de sélection : choisir la plage qui confirme ce qu'on veut voir",
            "Il consomme trop de mémoire sur l'ordinateur",
            "Il n'existe que sur MT5",
            "Il est incompatible avec XAU/USD",
          ],
          correct: 0,
        },
      ],
    },
    {
      slug: "combiner",
      group: "Synthèse",
      title: "Combiner intelligemment + cas multi-indicateurs XAU",
      subtitle: "Structure d'abord, indicateurs en filtres — jamais l'inverse",
      intro:
        "Cette fiche de synthèse propose une méthode simple pour combiner sans surcharger : 1 cadre structurel (ICT : BOS/MSS + liquidité), " +
        "1 filtre de tendance (EMA ou VWAP), 1 filtre de momentum OU de volume (pas les deux systématiquement), et un cas pratique complet sur XAU/USD.",
      chart: "Pile de confluence : structure > tendance > momentum/volume",
      type: "combiner",
      caption:
        "Une pyramide de confluence : la structure ICT en base (obligatoire), un filtre de tendance au milieu, un filtre de momentum/volume au sommet — jamais l'inverse.",
      term: "SYNTHÈSE · CONFLUENCE HIÉRARCHISÉE",
      heads: ["Hiérarchie, pas addition", "2-3 outils max", "Une invalidation, pas cinq"],
      texts: [
        "La structure (BOS/MSS, liquidité, premium/discount) est le socle : sans elle, aucun indicateur ne « sauve » un trade sans contexte. Les indicateurs de cet atlas sont des filtres additionnels, jamais le point de départ.",
        "Une combinaison saine tient sur 2-3 outils maximum : structure + 1 filtre de tendance (EMA/VWAP) + éventuellement 1 filtre de momentum ou volume (pas les deux). Au-delà, le risque de contradictions et de paralysie augmente fortement.",
        "Chaque trade doit avoir UNE seule invalidation claire (un niveau de prix), pas cinq raisons de douter issues de cinq indicateurs différents. Si tu ne peux pas résumer ton setup en 3 phrases, simplifie.",
      ],
      tools: "Journal La Forge (colonne « outils utilisés » + « outil qui a vraiment influencé la décision »), TradingView pour tout combiner visuellement.",
      forgeLink:
        "C'est la doctrine complète de La Forge : Atlas ICT (structure) + ce présent atlas (filtres) + module data-journal (mesure). Aucun raccourci magique.",
      steps: [
        "Établis ton biais structurel H4 (BOS/MSS, liquidité, premium/discount) — c'est non négociable.",
        "Ajoute un filtre de tendance (EMA ou VWAP) aligné avec ce biais.",
        "Ajoute au plus un filtre de momentum/volume pour le timing final ; fixe une seule invalidation avant d'entrer.",
      ],
      combine:
        "La règle générale de tout cet atlas : structure ICT en base obligatoire, 1 filtre de tendance, 1 filtre de momentum OU volume (jamais les deux en même temps), et toujours une seule invalidation écrite. Tout ajout au-delà de 3 couches doit être justifié explicitement ou retiré.",
      caseStudy: {
        title: "Setup complet XAU/USD — killzone Londres",
        setup:
          "H4 : structure haussière claire (série de HH/HL), prix en zone discount après un sweep de liquidité (SSL). EMA20 H1 en pente haussière, prix au-dessus du VWAP de session. RSI H1 sort d'une zone de survente sans être en surachat.",
        action:
          "Le trader attend la confirmation d'un MSS local en M15 dans la zone OTE (61,8-79 % du swing du sweep), avec un pic de volume sur la bougie de retournement. Entrée avec invalidation sous le point bas du sweep — une seule invalidation, un seul niveau.",
        lesson:
          "Chaque outil a joué un rôle précis et non redondant : structure = contexte directionnel, EMA/VWAP = filtre de tendance, RSI = timing de momentum, volume = confirmation de conviction. Aucun n'était utilisé seul, aucun ne contredisait les autres, et l'invalidation restait unique et claire — c'est la définition d'une combinaison saine.",
      },
      quiz: [
        {
          q: "Selon la méthode de synthèse de La Forge, quel élément doit TOUJOURS être la base d'une analyse ?",
          options: ["Le RSI", "Le MACD", "La structure de marché (ICT : BOS/MSS, liquidité)", "Le nombre d'indicateurs affichés"],
          correct: 2,
        },
        {
          q: "Combien d'outils/filtres au maximum recommande-t-on d'empiler pour rester lisible ?",
          options: [
            "Autant que possible, plus il y en a mieux c'est",
            "2-3 outils maximum (structure + tendance + éventuellement momentum/volume)",
            "Exactement 10",
            "Un seul, jamais plus, jamais moins",
          ],
          correct: 1,
        },
        {
          q: "Un trade bien construit doit avoir :",
          options: [
            "Cinq raisons de douter issues de cinq indicateurs",
            "Une seule invalidation claire (un niveau de prix)",
            "Aucune invalidation, on ajuste en cours de route",
            "Une invalidation différente par indicateur utilisé",
          ],
          correct: 1,
        },
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

  function bar(x, y, w, h, color, cls, delay) {
    return (
      '<rect class="' +
      (cls || "anim-grow") +
      " d" +
      (delay || 1) +
      '" x="' +
      x +
      '" y="' +
      y +
      '" width="' +
      w +
      '" height="' +
      h +
      '" fill="' +
      color +
      '" fill-opacity=".75" rx="2"/>'
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

    if (t === "philosophie") {
      s +=
        '<path class="anim-draw d1" d="M70 240 L150 200 L220 220 L300 150 L380 175 L460 100 L540 130 L620 70 L700 105 L780 60" fill="none" stroke="' +
        GOLD +
        '" stroke-width="2.5"/>';
      s +=
        '<path class="anim-draw d3" d="M110 245 L190 215 L260 225 L340 175 L420 190 L500 130 L580 150 L660 100 L740 122" fill="none" stroke="' +
        AQUA +
        '" stroke-width="2" stroke-dasharray="5 5"/>';
      s += label(560, 45, "Prix", GOLD, 15);
      s += label(600, 175, "Indicateur dérivé (retard)", AQUA, 14);
      s += label(70, 300, "Le décalage horizontal illustre le lag mécanique", MUTED, 13);
    }

    if (t === "checklist") {
      var checks = [
        "Quelle question précise cet indicateur répond ?",
        "Redondant avec un indicateur déjà affiché ?",
        "Comportement testé en range ET en tendance ?",
        "Explicable en une phrase à un débutant ?",
        "Utilité mesurée dans le journal (20-30 trades) ?",
      ];
      checks.forEach(function (txt, idx) {
        var y = 45 + idx * 52;
        s +=
          '<rect class="anim-fade d' +
          Math.min(6, idx + 1) +
          '" x="80" y="' +
          y +
          '" width="700" height="40" fill="' +
          (idx % 2 ? "#1a2230" : "#151c28") +
          '" rx="4"/>';
        s +=
          '<circle class="anim-fade d' +
          Math.min(6, idx + 1) +
          '" cx="112" cy="' +
          (y + 20) +
          '" r="11" fill="none" stroke="' +
          GOLD +
          '" stroke-width="2"/>';
        s += label(140, y + 25, txt, MUTED, 14);
      });
    }

    if (t === "ema") {
      var pv = [140, 155, 148, 168, 160, 185, 178, 205, 195, 220, 210, 235, 225, 250, 245, 265];
      for (var i = 1; i < pv.length; i++) {
        s += candle(60 + i * 46, pv[i - 1], pv[i], Math.min(pv[i - 1], pv[i]) - 8, Math.max(pv[i - 1], pv[i]) + 10, 14);
      }
      s +=
        '<path class="anim-draw d3" d="M106 250 C160 235, 220 215, 290 195 S420 165, 500 150 S620 120, 750 80" fill="none" stroke="' +
        AQUA +
        '" stroke-width="2"/>';
      s +=
        '<path class="anim-draw d4" d="M106 260 C160 250, 220 240, 290 225 S420 205, 500 195 S620 175, 750 140" fill="none" stroke="' +
        GOLD +
        '" stroke-width="2"/>';
      s += label(600, 65, "EMA20 (rapide)", AQUA, 14);
      s += label(600, 160, "EMA50 (lente)", GOLD, 14);
      s += label(300, 300, "Croisement = mouvement déjà engagé", MUTED, 13);
    }

    if (t === "rsi") {
      var pv2 = [180, 170, 175, 155, 160, 130, 140, 105, 115, 90, 100, 80];
      for (var j = 1; j < pv2.length; j++) {
        s += candle(70 + j * 60, pv2[j - 1], pv2[j], Math.min(pv2[j - 1], pv2[j]) - 6, Math.max(pv2[j - 1], pv2[j]) + 8, 16);
      }
      s += line(40, 195, 820, 195, GRID, "", "");
      s += line(40, 240, 820, 300, MUTED, "1 1", "");
      s += label(50, 210, "RSI (zone basse)", MUTED, 13);
      s += line(40, 220, 820, 220, AMBER, "3 4", "anim-draw d3");
      s += label(760, 215, "70", AMBER, 12);
      s += line(40, 285, 820, 285, AQUA, "3 4", "anim-draw d3");
      s += label(760, 300, "30", AQUA, 12);
      s +=
        '<path class="anim-draw d4" d="M100 260 L220 250 L340 265 L460 255 L580 270 L700 260" fill="none" stroke="' +
        VIOLET +
        '" stroke-width="2"/>';
      s += label(420, 245, "Divergence : prix ↓, RSI plat/↑", VIOLET, 13);
    }

    if (t === "macd") {
      s += line(40, 190, 820, 190, GRID, "", "");
      s += label(50, 175, "Ligne zéro", MUTED, 12);
      var hist = [10, 18, 24, 15, 6, -8, -18, -22, -14, -4, 8, 20];
      for (var k = 0; k < hist.length; k++) {
        var hx = 90 + k * 60;
        var hh = Math.abs(hist[k]) * 3;
        var hy = hist[k] >= 0 ? 190 - hh : 190;
        s += bar(hx - 12, hy, 24, hh, hist[k] >= 0 ? BULL : BEAR, "anim-grow", Math.min(6, k + 1));
      }
      s +=
        '<path class="anim-draw d4" d="M90 130 L150 110 L210 100 L270 125 L330 155 L390 195 L450 230 L510 245 L570 225 L630 195 L690 165 L750 130" fill="none" stroke="' +
        GOLD +
        '" stroke-width="2"/>';
      s +=
        '<path class="anim-draw d5" d="M90 140 L150 125 L210 118 L270 135 L330 160 L390 185 L450 215 L510 235 L570 235 L630 210 L690 180 L750 150" fill="none" stroke="' +
        AQUA +
        '" stroke-width="1.5" stroke-dasharray="4 3"/>';
      s += label(650, 120, "MACD", GOLD, 13);
      s += label(650, 200, "Signal", AQUA, 13);
      s += label(500, 280, "Histogramme = écart MACD-signal", MUTED, 13);
    }

    if (t === "stoch") {
      s += line(40, 90, 820, 90, AMBER, "3 4", "anim-draw d2");
      s += label(760, 85, "80", AMBER, 12);
      s += line(40, 260, 820, 260, AQUA, "3 4", "anim-draw d2");
      s += label(760, 275, "20", AQUA, 12);
      s +=
        '<path class="anim-draw d3" d="M80 220 L150 240 L220 200 L290 120 L360 80 L430 95 L500 150 L570 210 L640 245 L710 230 L780 190" fill="none" stroke="' +
        GOLD +
        '" stroke-width="2.2"/>';
      s +=
        '<path class="anim-draw d4" d="M80 230 L150 235 L220 220 L290 160 L360 100 L430 90 L500 130 L570 180 L640 225 L710 240 L780 215" fill="none" stroke="' +
        VIOLET +
        '" stroke-width="1.8" stroke-dasharray="4 3"/>';
      s += label(320, 65, "%K croise %D en zone haute", GOLD, 13);
      s += label(300, 60 + 20, "%D (lissée)", VIOLET, 12);
    }

    if (t === "bollinger") {
      s +=
        '<path class="anim-draw d1" d="M60 200 C150 190, 220 195, 300 185 S420 90, 520 60 S680 50, 800 45" fill="none" stroke="' +
        GOLD +
        '" stroke-width="1.5" stroke-dasharray="4 3"/>';
      s +=
        '<path class="anim-draw d1" d="M60 260 C150 265, 220 270, 300 265 S420 150, 520 130 S680 130, 800 130" fill="none" stroke="' +
        GOLD +
        '" stroke-width="1.5" stroke-dasharray="4 3"/>';
      s += zone(260, 180, 100, 90, AQUA, "anim-fade d2 anim-pulse");
      s += label(270, 300, "Squeeze", AQUA, 14);
      s +=
        '<path class="anim-draw d3" d="M60 225 C150 222, 220 228, 300 222 S400 130, 460 100 S560 80, 640 75 S740 78, 800 70" fill="none" stroke="' +
        BULL +
        '" stroke-width="2.5"/>';
      s += label(650, 55, "Prix (walking the band)", BULL, 13);
      s += label(60, 95, "Expansion après squeeze", MUTED, 13);
    }

    if (t === "fibonacci") {
      var levels = [
        [280, "0%"],
        [235, "38,2%"],
        [210, "50%"],
        [180, "61,8%"],
        [150, "78,6%"],
        [90, "100%"],
      ];
      levels.forEach(function (lv, idx) {
        s += line(60, lv[0], 800, lv[0], idx === 3 || idx === 4 ? GOLD : GRID, "3 4", "anim-draw d" + Math.min(6, idx + 1));
        s += label(805, lv[0] + 4, lv[1], idx === 3 || idx === 4 ? GOLD : MUTED, 12);
      });
      s += zone(60, 150, 740, 30, AMBER, "anim-fade d4 anim-pulse");
      s += label(340, 145, "Zone OTE (61,8-78,6%)", AMBER, 14);
      s +=
        '<path class="anim-draw d5" d="M80 280 L280 90 L500 170 L680 100" fill="none" stroke="' +
        BULL +
        '" stroke-width="2.5"/>';
      s += label(90, 300, "Swing bas (0%)", MUTED, 13);
      s += label(260, 75, "Swing haut (100%)", MUTED, 13);
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
      s += label(700, 55, "Prix", BULL, 14);
      s += label(700, 155, "VWAP", GOLD, 14);
      s += label(700, 200, "Bandes σ", AQUA, 14);
    }

    if (t === "volume") {
      var pv3 = [160, 150, 165, 140, 150, 110, 95, 120, 100, 70];
      for (var v = 1; v < pv3.length; v++) {
        s += candle(80 + v * 76, pv3[v - 1], pv3[v], Math.min(pv3[v - 1], pv3[v]) - 8, Math.max(pv3[v - 1], pv3[v]) + 10, 20);
      }
      var vols = [20, 24, 18, 22, 16, 40, 70, 26, 30, 55];
      for (var vv = 1; vv < vols.length; vv++) {
        var vh = vols[vv];
        s += bar(80 + vv * 76 - 10, 300 - vh, 20, vh, vv === 6 || vv === 9 ? GOLD : AQUA, "anim-grow", Math.min(6, vv));
      }
      s += label(500, 90, "Pic de volume sur la cassure", GOLD, 14);
      s += label(60, 300, "Volume", MUTED, 12);
    }

    if (t === "delta") {
      s +=
        '<path class="anim-draw d1" d="M80 200 L180 190 L280 175 L380 155 L480 130 L580 115 L680 100 L780 90" fill="none" stroke="' +
        BULL +
        '" stroke-width="2.5"/>';
      s += label(650, 75, "Prix (nouveau plus haut)", BULL, 13);
      s += line(40, 260, 820, 260, GRID, "", "");
      s +=
        '<path class="anim-draw d3" d="M80 260 L180 250 L280 245 L380 255 L480 265 L580 262 L680 270 L780 268" fill="none" stroke="' +
        VIOLET +
        '" stroke-width="2.2"/>';
      s += label(500, 290, "CVD stagnant → absorption", VIOLET, 14);
      s += zone(560, 90, 220, 190, AMBER, "anim-fade d4 anim-pulse");
    }

    if (t === "vprofile") {
      var bars = [40, 70, 110, 160, 210, 170, 120, 80, 50, 35];
      for (var kk = 0; kk < bars.length; kk++) {
        var yy = 50 + kk * 26;
        var ww = bars[kk];
        var col2 = kk === 4 ? GOLD : AQUA;
        s += bar(80, yy, ww, 20, col2, "anim-grow", Math.min(6, kk + 1));
      }
      s += line(300, 50, 300, 300, GOLD, "4 3", "anim-draw d3");
      s += label(310, 160, "POC", GOLD, 14);
      s += line(80, 80, 780, 80, MUTED, "3 4", "");
      s += line(80, 260, 780, 260, MUTED, "3 4", "");
      s += label(720, 75, "VAH", MUTED, 13);
      s += label(720, 275, "VAL", MUTED, 13);
      s +=
        '<path class="anim-draw d4" d="M340 250 L380 220 L420 200 L460 170 L500 140 L540 120 L580 100 L620 95" fill="none" stroke="' +
        BULL +
        '" stroke-width="2"/>';
      s += label(600, 85, "Prix", BULL, 14);
    }

    if (t === "frvp") {
      s += line(300, 40, 300, 310, AMBER, "4 3", "anim-draw d1");
      s += line(560, 40, 560, 310, AMBER, "4 3", "anim-draw d1");
      s += label(320, 55, "Début sélection", AMBER, 12);
      s += label(580, 55, "Fin sélection", AMBER, 12);
      var barsF = [22, 35, 55, 90, 60, 32];
      for (var f = 0; f < barsF.length; f++) {
        var yF = 90 + f * 34;
        s += bar(305, yF, barsF[f], 24, f === 3 ? GOLD : AQUA, "anim-grow", Math.min(6, f + 1));
      }
      s += line(305 + 90, 90, 305 + 90, 90 + 34 * 5 + 24, GOLD, "3 3", "anim-draw d4");
      s += label(410, 245, "POC local", GOLD, 14);
      s +=
        '<path class="anim-draw d5" d="M240 260 L280 240 L320 200 L360 180 L400 190 L440 160 L480 130 L560 110 L640 90" fill="none" stroke="' +
        BULL +
        '" stroke-width="2"/>';
      s += label(120, 300, "Consolidation choisie manuellement", MUTED, 13);
    }

    if (t === "combiner") {
      s += zone(120, 240, 620, 60, GOLD, "anim-fade d1");
      s += label(150, 275, "Structure ICT (BOS/MSS + liquidité) — socle obligatoire", GOLD, 15);
      s += zone(180, 160, 500, 60, AQUA, "anim-fade d3");
      s += label(210, 195, "Filtre de tendance (EMA / VWAP)", AQUA, 15);
      s += zone(260, 80, 340, 60, AMBER, "anim-fade d5");
      s += label(290, 115, "Momentum OU volume (1 max)", AMBER, 15);
      s += label(120, 320, "Une seule invalidation, jamais cinq", MUTED, 13);
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
      .replace("Pourquoi des indicateurs (et pourquoi pas tous)", "Pourquoi des indicateurs")
      .replace("Moyennes mobiles (SMA / EMA)", "Moyennes mobiles")
      .replace("Fibonacci (retracements / extensions)", "Fibonacci")
      .replace("Delta / CVD / volume delta", "Delta / CVD")
      .replace("Volume Profile (session)", "Volume Profile")
      .replace("Combiner intelligemment + cas multi-indicateurs XAU", "Combiner intelligemment");
  }

  var active = 0;

  function renderQuiz(l) {
    var root = el("quiz-root");
    if (!root) return;
    if (!l.quiz || !l.quiz.length) {
      root.innerHTML = "";
      return;
    }
    var html = "";
    l.quiz.forEach(function (q, qi) {
      html += '<p class="quiz-q">' + (qi + 1) + ". " + q.q + "</p>";
      html += '<div class="quiz-opts">';
      q.options.forEach(function (opt, oi) {
        html +=
          '<label><input type="radio" name="quiz-' +
          qi +
          '" value="' +
          oi +
          '"> <span>' +
          opt +
          "</span></label>";
      });
      html += "</div>";
    });
    html += '<button type="button" class="button primary" id="quiz-submit">Valider le quiz</button>';
    html += '<p class="quiz-result" id="quiz-result" role="status" aria-live="polite"></p>';
    root.innerHTML = html;
    el("quiz-submit").addEventListener("click", function () {
      var score = 0;
      l.quiz.forEach(function (q, qi) {
        var checked = root.querySelector('input[name="quiz-' + qi + '"]:checked');
        if (checked && Number(checked.value) === q.correct) score++;
      });
      var total = l.quiz.length;
      var threshold = Math.round(total * 0.7);
      var pass = score >= threshold;
      var res = el("quiz-result");
      res.textContent =
        "Score : " +
        score +
        " / " +
        total +
        (pass ? " — Acquis (seuil 70 % atteint)." : " — À revoir, seuil 70 % non atteint.");
      res.className = "quiz-result " + (pass ? "ok" : "ko");
    });
  }

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
        var heading = x.group !== group ? '<div class="nav-group">' + x.group + "</div>" : "";
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
    el("steps").innerHTML = l.steps
      .map(function (t) {
        return "<li>" + t + "</li>";
      })
      .join("");

    if (el("combine-text")) el("combine-text").textContent = l.combine || "";

    if (l.caseStudy) {
      if (el("case-title")) el("case-title").textContent = l.caseStudy.title;
      if (el("case-setup")) el("case-setup").textContent = l.caseStudy.setup;
      if (el("case-action")) el("case-action").textContent = l.caseStudy.action;
      if (el("case-lesson")) el("case-lesson").textContent = l.caseStudy.lesson;
    }

    renderQuiz(l);

    el("page-count").textContent = String(active + 1).padStart(2, "0") + " / " + lessons.length;
    el("previous").disabled = active === 0;
    el("next").textContent = active === lessons.length - 1 ? "Revoir le parcours ↺" : "Fiche suivante →";
    document.title = l.title + " — Atlas Indicateurs · La Forge";
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

  function bootForgeIndicateursAtlas() {
    if (!document.getElementById("indicateurs-atlas-root")) return;
    if (!location.hash || location.hash === "#") {
      location.replace("#philosophie");
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

  window.bootForgeIndicateursAtlas = bootForgeIndicateursAtlas;
})();
