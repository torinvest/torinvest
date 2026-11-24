#!/usr/bin/env node
/**
 * Génère la-forge/js/crypto-course-data.js — curriculum Crypto La Forge.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const PARTS = [
  {
    id: "c-bases",
    title: "Partie 1 — Bases & blockchain",
    week: "Semaines 1–2",
    hours: 6,
    blurb: "Comprendre la crypto, Bitcoin, Ethereum et la taxonomie des tokens.",
  },
  {
    id: "c-marches",
    title: "Partie 2 — Marchés crypto",
    week: "Semaines 3–4",
    hours: 6,
    blurb: "CEX/DEX, liquidité, stablecoins, cycles et dynamiques 24/7.",
  },
  {
    id: "c-pratique",
    title: "Partie 3 — Pratique & sécurité",
    week: "Semaines 5–6",
    hours: 6,
    blurb: "Wallets, sécurité, DeFi, risques et hygiène opérationnelle.",
  },
  {
    id: "c-analyse",
    title: "Partie 4 — Analyse & trading",
    week: "Semaines 7–8",
    hours: 6,
    blurb: "On-chain, corrélations, volatilité et price action crypto.",
  },
  {
    id: "c-cadre",
    title: "Partie 5 — Cadre & narratifs",
    week: "Semaines 9–10",
    hours: 6,
    blurb: "Régulation, catalysts, portfolio et psychologie FOMO.",
  },
  {
    id: "c-avance",
    title: "Partie 6 — Infra, macro & process",
    week: "Semaines 11–12",
    hours: 6,
    blurb: "L2, bridges, macro liquidité, journal et checklist trader crypto.",
  },
];

function mod(id, part, num, title, desc, minutes) {
  return {
    id,
    part,
    href: "/crypto/module.html?id=" + id,
    num,
    title,
    desc,
    minutes: minutes || 90,
    elite: false,
  };
}

const MODULES = [
  mod("c01-intro-crypto", "c-bases", "C1", "Qu’est-ce que la crypto ?", "Blockchain · decentralisation · cas d’usage · ~90 min"),
  mod("c02-bitcoin", "c-bases", "C2", "Bitcoin — thèse monétaire", "Histoire · halving · stock-to-flow · ~90 min"),
  mod("c03-ethereum", "c-bases", "C3", "Ethereum & smart contracts", "EVM · gas · tokens ERC · ~90 min"),
  mod("c04-tokens", "c-bases", "C4", "Altcoins & taxonomie", "L1/L2 · memecoins · utility · ~90 min"),

  mod("c05-cex-dex", "c-marches", "C5", "CEX vs DEX", "Order book · AMM · custody · ~90 min"),
  mod("c06-stablecoins", "c-marches", "C6", "Stablecoins & liquidité", "USDT/USDC · peg · reserves · ~90 min"),
  mod("c07-onchain", "c-marches", "C7", "On-chain & explorateurs", "Adresses · tx · mempool · ~90 min"),
  mod("c08-cycles", "c-marches", "C8", "Cycles crypto", "Halving · risk-on · seasons · ~90 min"),

  mod("c09-wallets", "c-pratique", "C9", "Wallets & custody", "Seed · hardware · hot/cold · ~90 min"),
  mod("c10-securite", "c-pratique", "C10", "Sécurité & arnaques", "Phishing · rugs · approvals · ~90 min"),
  mod("c11-defi", "c-pratique", "C11", "DeFi — bases", "Lending · staking · LP · ~90 min"),
  mod("c12-nft-rw", "c-pratique", "C12", "NFT & tokenisation", "Standards · RWA · cas d’usage · ~90 min"),

  mod("c13-metriques", "c-analyse", "C13", "Métriques on-chain", "Active addresses · MVRV · SOPR · ~90 min"),
  mod("c14-correlations", "c-analyse", "C14", "Corrélations BTC/ETH/risk", "Nasdaq · DXY · gold · ~90 min"),
  mod("c15-volatilite", "c-analyse", "C15", "Volatilité & sizing", "ATR · risque % · levier · ~90 min"),
  mod("c16-price-action", "c-analyse", "C16", "Price action crypto", "Sessions · liquidité · setups · ~90 min"),

  mod("c17-regulation", "c-cadre", "C17", "Régulation & fiscalité", "Cadre FR/EU · KYC · reporting · ~90 min"),
  mod("c18-narratifs", "c-cadre", "C18", "Narratifs & catalysts", "ETF · upgrades · unlocks · ~90 min"),
  mod("c19-portfolio", "c-cadre", "C19", "Portfolio crypto", "Allocation · rebalance · cold storage · ~90 min"),
  mod("c20-psycho", "c-cadre", "C20", "Psychologie FOMO", "Biais · tilt · règles · ~90 min"),

  mod("c21-infra", "c-avance", "C21", "Infrastructure L2 & bridges", "Rollups · bridges · risques · ~90 min"),
  mod("c22-macro", "c-avance", "C22", "Macro & liquidité", "Rates · DXY · risk appetite · ~90 min"),
  mod("c23-journal", "c-avance", "C23", "Journal crypto", "Process · tags · review · ~90 min"),
  mod("c24-capstone", "c-avance", "C24", "Capstone — checklist trader", "Playbook · risques · rituels · ~90 min"),
];

function stepsFrom(sections) {
  return sections.map(function (s, i) {
    return {
      title: s.title,
      sub: s.sub || "",
      body: s.body,
      detail: s.detail || "",
      institution: s.institution || "",
      error: s.error || "",
      example: s.example || "",
      key: s.key || "",
      readMin: s.readMin || 5,
    };
  });
}

function q(qText, a, correct) {
  return { q: qText, a: a, correct: correct };
}

function p(qText, options, correct, explain) {
  return { q: qText, options: options, correct: correct, explain: explain || "" };
}

/** Contenu pédagogique par module */
const LESSON_BUILDERS = {
  "c01-intro-crypto": function () {
    return {
      objectives: [
        "Définir blockchain, crypto-actif et token",
        "Distinguer decentralisation réelle vs marketing",
        "Situer les cas d’usage utiles vs spéculatifs",
      ],
      sections: [
        {
          title: "Le problème que la crypto tente de résoudre",
          body: "La crypto naît d’une volonté de transférer de la valeur sans intermédiaire de confiance unique. Une blockchain est un registre distribué : les participants valident des blocs de transactions selon des règles consensuelles.",
          detail: "Ce n’est pas « de l’argent magique » : c’est un système d’incitations (minage / staking), de coûts (frais) et de risques (clés, bugs, régulation).",
          key: "Sans compréhension du registre et des clés, tu trades un ticker, pas un actif.",
          readMin: 6,
        },
        {
          title: "Blockchain en une phrase utile",
          body: "Une chaîne de blocs horodatés, liés cryptographiquement, répliqués sur un réseau. Modifier l’historique exige de contrôler assez de puissance (PoW) ou de stake (PoS) — et d’être visible.",
          institution: "Les institutions regardent la finalité, la liquidité et la custody — pas le narratif Discord.",
          error: "Croire qu’« immutable » = sans risque. Les smart contracts et bridges cassent ; les exchanges centralisés aussi.",
          readMin: 5,
        },
        {
          title: "Crypto-actif vs token vs coin",
          body: "Coin : natif d’une chaîne (BTC, ETH). Token : émis via smart contract (ERC-20). Un token peut représenter utilité, gouvernance, claim, ou rien d’autre qu’une histoire.",
          example: "USDT est un token sur plusieurs chaînes ; BTC est l’actif natif de Bitcoin.",
          key: "Toujours demander : sur quelle chaîne ? qui contrôle l’émission ? quelle custody ?",
          readMin: 5,
        },
        {
          title: "Cas d’usage vs casino",
          body: "Paiements frontière, règlement, DeFi, tokenisation d’actifs, NFTs utilitaires… existent. Une grande partie du volume retail reste spéculative et narrative.",
          detail: "Ton edge La Forge : traiter la crypto comme un marché (liquidité, sessions, risque), pas comme une religion.",
          readMin: 5,
        },
        {
          title: "Cadre mental du trader crypto",
          body: "Trois couches : (1) tech/custody, (2) microstructure marché, (3) macro/risk-on. Ignorer une couche = surprise.",
          key: "Cette formation couvre les trois. Commence par la custody avant le levier.",
          readMin: 4,
        },
      ],
      quiz: [
        q("Une blockchain est surtout :", ["Un serveur Excel privé", "Un registre distribué consensuel", "Une app mobile de trading", "Un ETF"], 1),
        q("Un token ERC-20 est :", ["L’actif natif Bitcoin", "Un contrat sur une chaîne type Ethereum", "Toujours un stablecoin", "Une seed phrase"], 1),
        q("La custody désigne :", ["Le prix du gas", "Qui détient les clés / l’actif", "Le halving", "Le funding rate"], 1),
        q("« Immutable » signifie :", ["Aucun risque", "Historique difficile à réécrire sous consensus", "Pas de frais", "Interdit de vendre"], 1),
        q("Pour un trader, la priorité n°1 avant le levier :", ["Le narratif Twitter", "Comprendre custody et risques opérationnels", "Le logo du projet", "Le nombre de followers"], 1),
      ],
      practice: [
        p("Tu reçois un lien « claim airdrop » demandant ta seed. Tu :", ["Envoies la seed", "Ignores / vérifies hors lien", "Signes tout", "Envoies 1 BTC « test »"], 1, "Jamais de seed. Les airdrops légitimes ne demandent pas ta seed."),
        p("BTC et USDT diffèrent surtout par :", ["La couleur du logo", "Natif vs token / émetteur", "Le fait que l’un n’a pas de prix", "L’absence de marché"], 1, "BTC est natif ; USDT est un token émis / géré."),
        p("Quel couple décrit mieux l’approche La Forge ?", ["Foi + levier max", "Registre + marché + risque", "Tips Telegram only", "Copy-trading aveugle"], 1, "Techno + microstructure + risque."),
      ],
    };
  },

  "c02-bitcoin": function () {
    return {
      objectives: ["Situer Bitcoin historiquement", "Comprendre rareté programmatique et halving", "Lire BTC comme actif macro risk"],
      sections: [
        {
          title: "Naissance et règles",
          body: "Bitcoin (2009) propose une monnaie numérique peer-to-peer avec offre limitée (~21M) et émission décroissante (halving ~4 ans).",
          detail: "La sécurité repose sur PoW et l’énergie économique des mineurs. Pas de CEO ; des développeurs, mineurs, nodes, users.",
          key: "BTC = règles + adoption + liquidité mondiale 24/7.",
          readMin: 6,
        },
        {
          title: "Halving et cycles",
          body: "Le halving réduit la récompense de bloc. Historiquement associé à des cycles haussiers — mais ce n’est pas une garantie mécanique. La liquidité macro et l’adoption pèsent autant.",
          error: "Trader uniquement « parce que halving » sans plan de risque.",
          readMin: 5,
        },
        {
          title: "Thèse monétaire",
          body: "Stock limité, portabilité, divisibilité, auditabilité on-chain. Concurrent imparfait de l’or digital — corrélé parfois au risk-on tech.",
          institution: "ETF spot, custody institutionnelle, clarté régulatoire changent la demande — pas le protocole overnight.",
          readMin: 5,
        },
        {
          title: "BTC comme benchmark crypto",
          body: "La plupart des alts se pricent vs BTC (dominance). Un bull alt season vs un bear BTC-only sont des régimes différents.",
          key: "Toujours situer ton trade vs BTC et vs USD.",
          readMin: 5,
        },
        {
          title: "Risques Bitcoin",
          body: "Volatilité extrême, régulation, concentration mining, forks narratifs, erreurs de custody. Le protocole peut être robuste et toi fragile.",
          readMin: 4,
        },
      ],
      quiz: [
        q("L’offre Bitcoin est approximativement plafonnée à :", ["Illimitée", "~21 millions", "100 millions", "1 milliard"], 1),
        q("Le halving :", ["Double le prix instantanément", "Réduit la récompense de bloc", "Supprime les frais", "Ferme le marché"], 1),
        q("La dominance BTC mesure surtout :", ["Le hashrate seul", "La part de BTC dans la market cap crypto", "Le nombre de wallets Ledger", "Le funding ETH"], 1),
        q("BTC trade 24/7 :", ["Faux", "Vrai", "Seulement week-end", "Seulement NYSE hours"], 1),
        q("Une thèse « or digital » ignore souvent :", ["La volatilité et la corrélation risk-on", "La divisibilité", "L’existence de blocs", "Les nodes"], 0),
      ],
      practice: [
        p("Avant un trade alt, tu checks en premier :", ["Le meme", "Régime BTC (USD + dominance)", "Le Discord VIP", "Le RSI 1m"], 1, "Le régime BTC conditionne les alts."),
        p("Le halving garantit un bull market :", ["Toujours", "Non — contexte macro requis", "Seulement si ETF", "Seulement si Elon tweet"], 1, "Corrélation historique ≠ garantie."),
        p("Risque n°1 retail sur BTC souvent :", ["Le protocole cassé demain", "Levier + custody + FOMO", "Manque de whitepaper", "Trop de nodes"], 1, "Opérationnel et psychologique."),
      ],
    };
  },

  "c03-ethereum": function () {
    return {
      objectives: ["Comprendre smart contracts et EVM", "Lire gas et congestions", "Situer ETH dans l’écosystème"],
      sections: [
        {
          title: "Ethereum = ordinateur mondial",
          body: "Ethereum exécute des smart contracts : programmes déployés on-chain. L’EVM standardise l’exécution. ETH paie le gas (frais de calcul/stockage).",
          key: "Sans gas / fees, pas de tx. Les congestions font exploser les coûts.",
          readMin: 6,
        },
        {
          title: "Tokens et standards",
          body: "ERC-20 (fongible), ERC-721 (NFT), etc. Un standard facilite wallets, DEX, tooling — et propage aussi les scams plus vite.",
          example: "Un faux token homonyme USDC circule souvent : vérifie le contrat.",
          readMin: 5,
        },
        {
          title: "PoS et staking",
          body: "Après The Merge, Ethereum sécurise via stake. Staking = rendement + risque (slashing, liquid staking risks, lockups).",
          error: "Confondre APY DeFi avec « sans risque ».",
          readMin: 5,
        },
        {
          title: "L2 et scalabilité",
          body: "Les rollups (Optimistic / ZK) déplacent l’exécution hors L1 pour baisser les frais. Bridging introduit de nouveaux risques.",
          readMin: 5,
        },
        {
          title: "ETH pour le trader",
          body: "ETH = beta crypto élevée, gas proxy d’activité, base DeFi. Corrélé BTC mais avec narratifs propres (upgrades, L2 seasons).",
          readMin: 4,
        },
      ],
      quiz: [
        q("Le gas sert à :", ["Miner du BTC", "Payer l’exécution/stockage sur Ethereum", "Acheter un Ledger", "Stabiliser USDT"], 1),
        q("Un smart contract est :", ["Un PDF légal", "Un programme on-chain", "Une seed", "Un CEX"], 1),
        q("ERC-20 désigne :", ["Un hardware wallet", "Un standard de token fongible", "Un L2", "Un ETF"], 1),
        q("Un risque du bridging L2 :", ["Aucun", "Bugs / custody du bridge", "Halving BTC", "KYC email"], 1),
        q("Staking ETH :", ["Sans aucun risque", "Rendement avec risques (slashing, protocole)", "Interdit", "Identique au mining PoW"], 1),
      ],
      practice: [
        p("Avant d’approuver un spender ERC-20 :", ["Approve infinite toujours", "Vérifier contrat + allowance minimale", "Donner la seed", "Ignorer"], 1, "Allowances = vecteur de drain."),
        p("Frais élevés sur ETH L1 :", ["Réseau saturé / priorité", "Bug Ledger", "Halving", "USDT depeg only"], 0, "Congestion → gas up."),
        p("Pour un débutant, mieux vaut :", ["Bridge obscur + levier 50x", "Apprendre L1/L2 + petits montants", "Envoyer seed au support", "Tout en memecoin"], 1, "Progression contrôlée."),
      ],
    };
  },

  "c04-tokens": function () {
    return {
      objectives: ["Classer les tokens", "Spotter narratif vs utilité", "Éviter les pièges d’émission"],
      sections: [
        {
          title: "Taxonomie simple",
          body: "L1 (BTC, ETH, SOL…), L2/tokens gas, DeFi blue chips, stables, memecoins, governance, RWA. Chaque classe a liquidité, risque et horizon différents.",
          key: "Ne mélange pas horizon memecoin et horizon BTC dans le même risk budget.",
          readMin: 5,
        },
        {
          title: "Émission et unlocks",
          body: "Vesting, cliff, unlocks team/VC : pression vendeuse structurelle. Un chart « pump » peut précéder un unlock massif.",
          institution: "Les desks suivent les calendriers d’unlock autant que les RSI.",
          readMin: 5,
        },
        {
          title: "Memecoins",
          body: "Pure narrative + liquidité fragile + manipulation. Possible edge court terme si process strict — pas un investissement.",
          error: "All-in sur un ticker Twitter.",
          readMin: 5,
        },
        {
          title: "Due diligence minimale",
          body: "Contrat, holders, liquidité lock?, audit?, team doxxed?, chain?, bridges?, docs. Si tu ne peux pas répondre : taille = 0 ou play money.",
          readMin: 5,
        },
        {
          title: "Lien avec la formation trading",
          body: "Le module B2 « Marchés crypto » de la Formation ÉLITE reste complémentaire. Ici on construit un parcours dédié et progressif.",
          readMin: 4,
        },
      ],
      quiz: [
        q("Un unlock massif peut :", ["Toujours bullish", "Créer de la pression vendeuse", "Supprimer la volatilité", "Garantir l’utilité"], 1),
        q("Memecoin = surtout :", ["Cash-flow", "Narrative + liquidité fragile", "Obligation d’État", "Stablecoin"], 1),
        q("L1 désigne :", ["Un exchange", "Une blockchain de base", "Un wallet", "Un ETF"], 1),
        q("Due diligence ignore rarement :", ["Le contrat et les holders", "La couleur du site", "Le font du logo", "Le nombre d’emojis"], 0),
        q("Mélanger memecoin et BTC dans le même budget risque :", ["Recommandé", "Dangereux / à séparer", "Obligatoire", "Sans effet"], 1),
      ],
      practice: [
        p("Avant d’acheter un alt, tu regardes :", ["Uniquement le RSI 5m", "Unlocks + liquidité + contrat", "Seulement le logo", "Le tip d’un inconnu"], 1, "Structure d’offre + liquidité."),
        p("Un token « utility » sans users :", ["Toujours undervalued", "Peut être pure marketing", "Sans risque", "Équivaut BTC"], 1, "Utility claim ≠ usage réel."),
        p("Taille position memecoin raisonnable retail :", ["50% du net worth", "Play money bornée", "Levier 100x", "Tout en crédit"], 1, "Plafond de perte assumé."),
      ],
    };
  },

  "c05-cex-dex": function () {
    return {
      objectives: ["Comparer CEX et DEX", "Comprendre order book vs AMM", "Choisir selon besoin"],
      sections: [
        {
          title: "CEX — centralisé",
          body: "Order book, KYC, custody chez l’exchange, levier, fiat on-ramp. UX rapide — risque contrepartie (faillite, gel, hack).",
          key: "« Not your keys, not your coins » reste vrai.",
          readMin: 5,
        },
        {
          title: "DEX — décentralisé",
          body: "AMM (x*y=k) ou order book on-chain. Tu gardes custody (wallet) mais exposes smart contract + MEV + erreurs de tx.",
          example: "Uniswap : pools de liquidité ; prix via réserve.",
          readMin: 5,
        },
        {
          title: "Microstructure",
          body: "Spreads, profondeur, funding perp, basis. Sur CEX les perps dominent le price discovery crypto.",
          institution: "Les flux perp + spot CEX mènent souvent le tape court terme.",
          readMin: 5,
        },
        {
          title: "Quand utiliser quoi",
          body: "Fiat→crypto : souvent CEX. Self-custody long terme : withdraw. Farming / swaps niche : DEX. Trading actif levier : CEX avec risk strict.",
          readMin: 5,
        },
        {
          title: "Risques opérationnels",
          body: "Mauvaise adresse withdraw, réseau (ERC-20 vs TRC-20), memo/tag, phishing UI DEX. Checklist avant chaque envoi.",
          readMin: 4,
        },
      ],
      quiz: [
        q("Sur un CEX, ta crypto est souvent :", ["Dans ton Ledger auto", "En custody exchange", "Burnée", "Sans prix"], 1),
        q("Un AMM fixe le prix surtout via :", ["Un market maker humain seul", "Les réserves de la pool", "La Fed", "Le halving"], 1),
        q("Price discovery crypto court terme :", ["Uniquement DEX spot", "Souvent perps CEX", "Uniquement NFT", "Or seul"], 1),
        q("Withdraw sur mauvais réseau :", ["Sans conséquence", "Perte fréquente de fonds", "Remboursement auto", "Double solde"], 1),
        q("DEX avantage principal :", ["KYC obligatoire", "Self-custody (si bien utilisé)", "Aucun smart contract risk", "Levier 125x natif"], 1),
      ],
      practice: [
        p("Tu stocks 3 ans :", ["Tout sur un CEX levier", "Cold wallet + process", "Seed dans iCloud notes", "Screenshot Discord"], 1, "Self-custody long terme."),
        p("Avant un withdraw :", ["Copier-coller adresse + réseau + test", "Envoyer max d’un coup", "Ignorer le tag", "Utiliser un QR Twitter"], 0, "Test amount + vérif."),
        p("Funding rate élevé long :", ["Toujours buy more", "Coût à porter / signal crowding", "Sans lien marché", "Halving"], 1, "Crowding + coût."),
      ],
    };
  },

  "c06-stablecoins": function () {
    return {
      objectives: ["Comprendre peg et types", "Lire risques depeg", "Utiliser stables sans naïveté"],
      sections: [
        {
          title: "Rôle des stablecoins",
          body: "Dollar on-chain pour trader, collatéral, règlements DeFi. USDT/USDC dominent ; d’autres (DAI, etc.) ont des designs différents.",
          key: "Un stable n’est stable que tant que confiance + réserves + liquidité tiennent.",
          readMin: 5,
        },
        {
          title: "Fiat-backed vs crypto-backed",
          body: "Fiat-backed : réserves off-chain, risque émetteur/banque. Crypto-backed : overcollateral on-chain, risque liquidation/oracle.",
          readMin: 5,
        },
        {
          title: "Depeg — comment ça casse",
          body: "Bank run, doute sur réserves, gel blacklists, stress DeFi. Le prix peut quitter 1.00 brutalement.",
          example: "Épisodes historiques de stress USDC/USDT/UST — leçons différentes.",
          readMin: 5,
        },
        {
          title: "Usage trader",
          body: "Parking entre trades, marge, règlement. Diversifier émetteurs si taille importante. Attention chaînes et bridges.",
          readMin: 4,
        },
        {
          title: "Régulation",
          body: "Cadre EU (MiCA) et règles US évoluent. KYC/travel rule impactent les rails. Reste informé sans paralysie.",
          readMin: 4,
        },
      ],
      quiz: [
        q("Un stablecoin fiat-backed dépend surtout de :", ["Le hashrate BTC", "Réserves / émetteur", "Le RSI", "Les NFT"], 1),
        q("Un depeg signifie :", ["Peg parfait", "Écart durable/temporaire vs 1.00", "Halving", "Listing CEX"], 1),
        q("Parking USDT sur un CEX :", ["Sans risque contrepartie", "Risque exchange + émetteur", "Identique cold BTC", "Interdit"], 1),
        q("DAI est plutôt :", ["Action Apple", "Stable crypto-collatéralisé (design)", "Un L2", "Un hardware"], 1),
        q("Diversifier les stables sert à :", ["Augmenter le FOMO", "Réduire risque émetteur unique", "Supprimer la vol", "Miner"], 1),
      ],
      practice: [
        p("Tu vois USDC à 0.92 :", ["Ignorer", "Stress / gérer exposition", "All-in levier long", "Donner seed"], 1, "Depeg = événement risque."),
        p("Gros cash crypto :", ["Un seul émetteur + un CEX", "Mix émetteurs + custody pensée", "Tout en memecoin", "Tout en perp"], 1, "Réduction single point of failure."),
        p("Stable sur bridge obscur :", ["Safe", "Risque bridge + depeg", "Garanti MiCA", "Sans gas"], 1, "Double risque."),
      ],
    };
  },

  "c07-onchain": function () {
    return {
      objectives: ["Lire un explorateur", "Comprendre tx / mempool", "Utiliser on-chain sans overfit"],
      sections: [
        {
          title: "Explorateurs",
          body: "Etherscan & co : adresse, tx, contrat, logs, token transfers. Apprends à vérifier un hash et un contrat avant d’interagir.",
          readMin: 5,
        },
        {
          title: "Mempool et MEV",
          body: "Tx en attente peuvent être front-run. Slippage + private relays existent pour une raison.",
          institution: "MEV est une industrie — le retail naïf paie la facture.",
          readMin: 5,
        },
        {
          title: "Labels et flux",
          body: "Exchange wallets, whales, bridges. Les labels aident mais sont imparfaits. Un « whale buy » peut être un internal move.",
          error: "Copier aveuglément chaque whale alert.",
          readMin: 5,
        },
        {
          title: "On-chain ≠ alpha automatique",
          body: "Les métriques retardent ou sont déjà pricées. Combine avec prix, liquidité et ton plan.",
          readMin: 4,
        },
        {
          title: "Hygiène",
          body: "Ne signe que ce que tu comprends. Simule si possible. Sépare wallets hot (trading) / cold (épargne).",
          readMin: 4,
        },
      ],
      quiz: [
        q("Un explorateur sert surtout à :", ["Miner", "Inspecter adresses/tx/contrats", "Remplacer un CEX", "Fixer le funding"], 1),
        q("MEV peut entraîner :", ["Des frais négatifs always", "Front-running / sandwich", "Halving", "KYC"], 1),
        q("Un label « exchange » est :", ["Toujours parfait", "Utile mais imparfait", "Une seed", "Un L2"], 1),
        q("Wallet hot vs cold :", ["Identiques", "Hot = usage fréquent ; cold = stockage", "Cold = CEX", "Hot = Ledger only"], 1),
        q("Signer une tx inconnue :", ["OK si APY haut", "Risqué / à éviter", "Obligatoire DeFi", "Sans effet"], 1),
      ],
      practice: [
        p("Avant d’interagir avec un contrat :", ["Vérifier adresse officielle", "Cliquer le premier Google ad", "Follow un bot", "Ignorer"], 0, "Source officielle."),
        p("Whale alert seule :", ["Signal suffisant", "Contexte + plan requis", "Entrée market always", "Close all"], 1, "Pas d’automatisme."),
        p("Tu sépares :", ["Tout sur un hot wallet", "Hot trading / cold savings", "Seed dans email", "Un seul exchange password « 1234 »"], 1, "Séparation des risques."),
      ],
    };
  },

  "c08-cycles": function () {
    return {
      objectives: ["Lire les régimes de cycle", "Relier halving / liquidité / seasons", "Adapter le risque au régime"],
      sections: [
        {
          title: "Anatomie d’un cycle",
          body: "Accumulation, markup, distribution, decline — schémas classiques, jamais calendaires parfaits. La durée et l’amplitude varient.",
          readMin: 5,
        },
        {
          title: "BTC seasons vs alt seasons",
          body: "Dominance BTC↑ : capital vers BTC. Dominance↓ + risk-on : alts outperform. Trading la mauvaise saison tue le compte.",
          key: "Identifie le régime avant d’acheter des alts faibles.",
          readMin: 5,
        },
        {
          title: "Liquidité macro",
          body: "Taux, USD, liquidité globale colorent les cycles crypto plus que les tweets. Risk-on tech ↔ crypto souvent.",
          readMin: 5,
        },
        {
          title: "Indicateurs de régime (simples)",
          body: "BTC vs ATH distance, dominance, funding, breadth alts, corrélation Nasdaq. Pas un graal — un tableau de bord.",
          readMin: 5,
        },
        {
          title: "Process La Forge",
          body: "Réduis taille en distribution/uncertainty. Augmente seulement si plan + edge + liquidité. Journalise le régime chaque semaine.",
          readMin: 4,
        },
      ],
      quiz: [
        q("Alt season typique :", ["Dominance BTC en forte hausse seule", "Alts outperform avec risk-on", "Or only", "Gas = 0"], 1),
        q("Les cycles sont :", ["Calendrier fixe garanti", "Régimes probabilistes", "Sans lien macro", "Uniquement halving"], 1),
        q("Funding extrême peut signaler :", ["Calm", "Crowding", "Peg parfait", "Audit"], 1),
        q("En incertitude de régime, taille :", ["Max levier", "Réduite", "All-in alts", "Ignore risk"], 1),
        q("Corrélation Nasdaq/crypto :", ["Toujours 0", "Souvent élevée en risk-on/off", "Interdite", "Uniquement week-end"], 1),
      ],
      practice: [
        p("Dominance BTC monte fort, alts faibles :", ["All-in shitcoins", "Prudence alts / focus BTC régime", "Levier 50x alt", "Ignorer BTC"], 1, "Pas la saison alts."),
        p("Tu notes chaque semaine :", ["Rien", "Régime + plan risque", "Seulement PnL", "Uniquement tips"], 1, "Revue de régime."),
        p("Distribution probable :", ["Augmenter FOMO size", "Réduire / protéger", "Supprimer stops", "Borrow to buy"], 1, "Défensif."),
      ],
    };
  },

  "c09-wallets": function () {
    return {
      objectives: ["Choisir hot/cold", "Protéger la seed", "Opérer sans erreur fatale"],
      sections: [
        {
          title: "Clés = propriété",
          body: "La seed phrase contrôle les fonds. Qui a la seed a les coins. Backup offline, jamais photo cloud, jamais support « officiel ».",
          key: "Perte de seed = perte de fonds. Fuite de seed = vol.",
          readMin: 6,
        },
        {
          title: "Hot wallets",
          body: "Browser/mobile : pratiques pour DeFi/trading petits montants. Surface d’attaque élevée (extensions, malware).",
          readMin: 4,
        },
        {
          title: "Hardware / cold",
          body: "Ledger & co pour stockage. Vérifie adresses sur l’écran device. Achète neuf via canaux officiels.",
          readMin: 5,
        },
        {
          title: "Architecture recommandée",
          body: "Cold = épargne. Hot = budget ops. CEX = trading actif borné. Multisig si taille institutionnelle / famille.",
          readMin: 5,
        },
        {
          title: "Erreurs classiques",
          body: "Mauvaise chaîne, adresse typo, malware clipboard, fake apps, seed sur Notion. Checklist écrite avant gros moves.",
          readMin: 4,
        },
      ],
      quiz: [
        q("La seed doit être :", ["Dans un tweet", "Offline / secrète", "Envoyée au support", "Dans Discord DM"], 1),
        q("Hardware wallet sert surtout à :", ["Miner", "Sécuriser les clés", "Augmenter le gas", "Lister un token"], 1),
        q("Hot wallet idéal pour :", ["Fortune entière", "Petits montants ops", "Remplacer le cold", "Stocker seed cloud"], 1),
        q("Vérifier l’adresse sur l’écran device :", ["Inutile", "Bonne pratique", "Interdit", "Seulement NFT"], 1),
        q("Clipboard malware peut :", ["Rien", "Remplacer l’adresse collée", "Miner BTC", "Fixer le peg"], 1),
      ],
      practice: [
        p("Quelqu’un DM « support Ledger » :", ["Donner seed", "Ignorer / canal officiel", "Envoyer BTC test", "Partager photo seed"], 1, "Phishing classique."),
        p("Architecture saine :", ["Tout hot", "Cold + hot borné + CEX borné", "Tout CEX levier", "Seed email"], 1, "Séparation."),
        p("Avant un gros withdraw :", ["Test amount + vérif écran", "Max immédiat", "Adresse Twitter bio", "QR random"], 0, "Test + vérif."),
      ],
    };
  },

  "c10-securite": function () {
    return {
      objectives: ["Reconnaître phishing/rugs", "Gérer approvals", "Réagir à un incident"],
      sections: [
        {
          title: "Surface d’attaque retail",
          body: "Faux sites, airdrops, Discord nitro, Google ads malveillantes, drainers de signatures, rugs de liquidité.",
          readMin: 5,
        },
        {
          title: "Approvals token",
          body: "Approve infinite + contrat malveillant = drain. Révise régulièrement (revoke). Prefère allowances limitées.",
          readMin: 5,
        },
        {
          title: "Rugs & honeypots",
          body: "Liquidité retirée, sell tax 100%, blacklist. Teste small, lis holders, méfie des charts trop beaux.",
          readMin: 5,
        },
        {
          title: "Incident response",
          body: "Si compromission : transfer restants vers wallet safe (si possible), revoke, changer tous mots de passe, documenter. Ne panique pas en public seed.",
          readMin: 5,
        },
        {
          title: "Hygiène quotidienne",
          body: "Bookmarks officiels, 2FA non-SMS si possible, devices à jour, séparer browser DeFi, pas de jailbreak hasardeux.",
          readMin: 4,
        },
      ],
      quiz: [
        q("Approve infinite :", ["Toujours safe", "Risqué si contrat malveillant", "Obligatoire", "Sans effet"], 1),
        q("Un honeypot typique :", ["Buy OK / sell bloqué", "APY négatif only", "Gas gratuit", "ETF"], 0),
        q("Revoke approvals sert à :", ["Miner", "Retirer permissions dangereuses", "Augmenter leverage", "Lister CEX"], 1),
        q("Faux Google ad DeFi :", ["Impossible", "Vecteur courant", "Garanti safe", "Réservé institutions"], 1),
        q("Après vol suspect :", ["Tweeter ta seed", "Sécuriser fonds restants + revoke", "Ignorer", "Augmenter levier"], 1),
      ],
      practice: [
        p("Site swap avec URL bizarre :", ["Connecter quand même", "Vérifier domaine officiel", "Entrer seed pour « sync »", "Approve max"], 1, "Domaine officiel."),
        p("Tu revokes :", ["Jamais", "Périodiquement / après expériences", "Seulement après faillite", "Via DM admin"], 1, "Hygiène."),
        p("Chart +9000% en 10 min sur unknown token :", ["All-in", "Soupçon manipulation / skip ou play money", "Mortgage house", "Seed to admin"], 1, "Red flag."),
      ],
    };
  },

  "c11-defi": function () {
    return {
      objectives: ["Comprendre lending/staking/LP", "Lire IL et smart contract risk", "Utiliser DeFi avec taille"],
      sections: [
        {
          title: "Lending",
          body: "Fournir/borrow sur protocoles. Collateral ratio, liquidation, oracles. Taux variables.",
          readMin: 5,
        },
        {
          title: "Staking & restaking",
          body: "Sécuriser réseau / points. Risques de liquidité du LST, smart contract, opportunisme points ≠ valeur.",
          readMin: 5,
        },
        {
          title: "Liquidity providing",
          body: "Fournir à une pool = fees + impermanent loss. IL = divergence de prix vs hold.",
          key: "Fees peuvent ne pas compenser l’IL.",
          readMin: 5,
        },
        {
          title: "Risk stack DeFi",
          body: "Smart contract, oracle, governance, bridge, UI phishing, stable depeg. Stacke les risques consciemment.",
          readMin: 5,
        },
        {
          title: "Règle sizing",
          body: "DeFi = capital que tu peux perdre techiquement. Audits ≠ immunité. Prefère blue chips + montants progressifs.",
          readMin: 4,
        },
      ],
      quiz: [
        q("Impermanent loss apparaît surtout :", ["En holding spot cold", "En LP quand les prix divergent", "Au halving only", "Sur ETF"], 1),
        q("Liquidation lending :", ["Impossible", "Si collateral insuffisant", "Uniquement NFT", "Sans oracle"], 1),
        q("Audit signifie :", ["0 risque", "Revue — pas une assurance", "Peg 1.00", "Listing Binance"], 1),
        q("LST risk inclut :", ["Aucun", "Smart contract / liquidité / depeg relatif", "Seulement gas", "Halving"], 1),
        q("Points / airdrop farming :", ["Cash garanti", "Spéculatif / coûts + risque", "Sans tx", "Custody free"], 1),
      ],
      practice: [
        p("LP volatile/volatile :", ["IL souvent significatif", "IL impossible", "Identique lend", "Sans fees jamais"], 0, "IL réel."),
        p("Capital DeFi débutant :", ["Toute l’épargne", "Tranche à perte assumée", "Levier max borrow", "Seed partagée"], 1, "Perte technique possible."),
        p("Avant deposit :", ["Lire docs + contrat + TVL/historique", "APY seul", "Tip Telegram", "Ignore audits"], 0, "DD minimale."),
      ],
    };
  },

  "c12-nft-rw": function () {
    return {
      objectives: ["Comprendre NFT standards", "Situer RWA", "Éviter la hype inutile"],
      sections: [
        {
          title: "NFT — définition utile",
          body: "Non-fongible : unique on-chain (souvent métadonnées off-chain). Utilité réelle vs collection spéculative.",
          readMin: 4,
        },
        {
          title: "Risques NFT",
          body: "Illiquidité, royalties, wash trading, phishing mint, metadata disparue.",
          readMin: 4,
        },
        {
          title: "Tokenisation RWA",
          body: "Représentation on-chain d’actifs réels (trésor, immo…). Promesse de settlement — dépend du droit et du custodian.",
          institution: "RWA = autant juridique que crypto.",
          readMin: 5,
        },
        {
          title: "Pour le trader",
          body: "Sauf edge clair, NFT/RWA ≠ focus PnL court terme. Surveille narratifs catalysts sans FOMO size.",
          readMin: 4,
        },
        {
          title: "Checklist",
          body: "Utilité, liquidité marketplace, équipe, droits attachés, chain. Sinon pass.",
          readMin: 4,
        },
      ],
      quiz: [
        q("NFT signifie :", ["Token fongible", "Non-fongible", "Stablecoin", "L2"], 1),
        q("RWA tokenisé dépend beaucoup :", ["Du RSI 1m", "Du cadre juridique / custody", "Du meme", "Du gas seul"], 1),
        q("Wash trading NFT :", ["Inexistant", "Peut fausser volumes", "Obligatoire", "Fixe le peg"], 1),
        q("Metadata NFT souvent :", ["Toujours on-chain entière", "Partiellement off-chain", "Une seed", "Un CEX"], 1),
        q("Hype mint sans utilité :", ["Investissement sûr", "Spéculation haute risque", "Bond", "Cash"], 1),
      ],
      practice: [
        p("Approche La Forge NFT :", ["All-in floor", "Sceptique + sizing play", "Mortgage", "Seed to discord"], 1, "Prudence."),
        p("RWA due diligence :", ["Ignore le droit", "Droit + custodian + smart contract", "Seulement logo", "APY Twitter"], 1, "Juridique + tech."),
        p("Illiquidité NFT :", ["Exit always 1s", "Risque réel de stuck", "Comme USDT", "Comme BTC perp"], 1, "Stuck possible."),
      ],
    };
  },

  "c13-metriques": function () {
    return {
      objectives: ["Connaître métriques on-chain clés", "Éviter le data theater", "Lier métriques au plan"],
      sections: [
        {
          title: "Activité",
          body: "Active addresses, tx counts, fees — proxies d’usage. Manipulables / bruités sur certaines chaînes.",
          readMin: 5,
        },
        {
          title: "Profitabilité cohortes",
          body: "MVRV, SOPR, realized price : situent si holders en profit/loss agrégé. Pas un timing parfait.",
          readMin: 5,
        },
        {
          title: "Exchange flows",
          body: "Inflows exchange ≈ pression vendeuse potentielle ; outflows ≈ accumulation possible. Signaux bruités.",
          readMin: 5,
        },
        {
          title: "Comment utiliser",
          body: "Confluence avec prix et liquidité. Une métrique ≠ entrée. Dashboard simple > 40 indicateurs.",
          key: "Moins de métriques, mieux lues.",
          readMin: 4,
        },
        {
          title: "Pièges",
          body: "Lookahead, régimes changeants, data vendors différents. Documente ta source.",
          readMin: 4,
        },
      ],
      quiz: [
        q("MVRV élevé peut suggérer :", ["Holders très en profit (prudence)", "Peg USDT", "Gas 0", "Audit"], 0),
        q("Exchange inflow massif :", ["Toujours bullish", "Pression vendeuse potentielle", "Halving", "NFT mint"], 1),
        q("Trop d’indicateurs :", ["Toujours mieux", "Peut créer du bruit", "Obligatoire", "Sans effet"], 1),
        q("SOPR parle surtout de :", ["Profit réalisé agrégé", "Seed phrase", "KYC", "IL"], 0),
        q("Active addresses :", ["Inmanipulables always", "Proxy usage — parfois bruité", "Prix exact demain", "Funding"], 1),
      ],
      practice: [
        p("Tu entres parce que 1 métrique verte :", ["OK", "Non — confluence", "All-in", "Ignore prix"], 1, "Confluence."),
        p("Dashboard utile :", ["3–7 métriques claires", "200 oscillators", "Aucun prix", "Seulement emojis"], 0, "Simplicité."),
        p("Source data :", ["Documentée", "Random screenshot", "Discord rumor only", "Ignore"], 0, "Traçabilité."),
      ],
    };
  },

  "c14-correlations": function () {
    return {
      objectives: ["Lire corrélations BTC/ETH/risk", "Utiliser DXY/Nasdaq", "Éviter double risque"],
      sections: [
        {
          title: "Risk-on package",
          body: "Crypto se comporte souvent comme tech à beta élevée. Nasdaq↓ + DXY↑ = vent contraire fréquent.",
          readMin: 5,
        },
        {
          title: "BTC vs ETH vs alts",
          body: "ETH beta > BTC souvent. Alts beta encore plus. En stress : flight to BTC puis stables/fiat.",
          readMin: 5,
        },
        {
          title: "Or et BTC",
          body: "Corrélation instable. Parfois hedge narratif, parfois décorrélé. Ne pas assumer hedge parfait.",
          readMin: 4,
        },
        {
          title: "Portfolio implication",
          body: "Long BTC + long alts + long Nasdaq via job/stocks = même facteur risk. Diversification réelle ≠ 10 tickets crypto.",
          key: "Diversifie les facteurs, pas seulement les tickers.",
          readMin: 5,
        },
        {
          title: "Routine",
          body: "Chaque matin : DXY, yields, indices, BTC.dom, funding. 3 minutes.",
          readMin: 4,
        },
      ],
      quiz: [
        q("En risk-off typique :", ["Alts outperform always", "Compression vers BTC/stables", "Memecoin season", "Gas gratis"], 1),
        q("Diversifier 20 alts :", ["Diversification facteur garantie", "Souvent même beta crypto", "Hedge parfait Nasdaq", "Sans vol"], 1),
        q("DXY fort :", ["Souvent headwind crypto", "Toujours bullish crypto", "Sans lien", "Fixe funding"], 0),
        q("Corrélation BTC/or :", ["Fixe 1.0", "Instable", "Interdite", "Seulement 2015"], 1),
        q("Routine macro courte :", ["Inutile", "Utile avant session", "Remplace risk mgmt", "Seed backup"], 1),
      ],
      practice: [
        p("Nasdaq -3% overnight :", ["Ignorer pour alts levier", "Réduire risque crypto probable", "All-in", "Disable stops"], 1, "Vent contraire."),
        p("Double risque :", ["BTC + job tech + alts", "BTC only cold", "Cash", "Bonds only"], 0, "Même facteur."),
        p("Flight to quality crypto :", ["Shitcoin illiquide", "BTC / stables", "Random NFT", "Unknown L3"], 1, "Liquidité."),
      ],
    };
  },

  "c15-volatilite": function () {
    return {
      objectives: ["Mesurer la vol crypto", "Sizer correctement", "Utiliser le levier avec discipline"],
      sections: [
        {
          title: "Volatilité extrême",
          body: "ATR, realized vol, funding : la crypto punit le oversize. Un move 10% n’est pas rare.",
          readMin: 5,
        },
        {
          title: "Risque par trade",
          body: "Définis % compte risqué (ex. 0.5–1%). Distance stop → taille position. Levier suit la taille, pas l’inverse.",
          key: "Levier = outil de sizing, pas d’ego.",
          readMin: 6,
        },
        {
          title: "Liquidations",
          body: "Perps : maintenance margin. Cascades de liquidations amplifient les wicks. Évite le levier qui liquidesur noise.",
          readMin: 5,
        },
        {
          title: "Vol régimes",
          body: "Compression → expansion. Réduis taille en expansion chaotique si pas d’edge clair.",
          readMin: 4,
        },
        {
          title: "Règles écrites",
          body: "Max levier, max daily loss, max correlated exposure. Break = pause obligatoire.",
          readMin: 4,
        },
      ],
      quiz: [
        q("Taille position se calcule surtout via :", ["FOMO", "Risque % et distance stop", "Tip Telegram", "Couleur bougie"], 1),
        q("Levier élevé :", ["Réduit le risque", "Amplifie gains et pertes", "Supprime liquidations", "Fixe le peg"], 1),
        q("Cascade de liquidations :", ["Calme le marché", "Peut amplifier les wicks", "Impossible crypto", "Uniquement stocks"], 1),
        q("Max daily loss :", ["Optionnel vanity", "Circuit breaker utile", "Interdit", "Remplace journal"], 1),
        q("ATR sert à :", ["Mesurer volatilité / sizing", "Remplacer custody", "KYC", "Mint NFT"], 0),
      ],
      practice: [
        p("Stop loin + même risque % :", ["Taille plus petite", "Taille plus grande", "Levier forcé 100x", "Ignore"], 0, "Distance↑ → size↓."),
        p("Après -3R day :", ["Revenge trade", "Stop selon règles", "Double down", "Disable risk"], 1, "Circuit breaker."),
        p("Levier suit :", ["L’ego", "La taille calculée", "Le tweet", "Le funding seul"], 1, "Sizing d’abord."),
      ],
    };
  },

  "c16-price-action": function () {
    return {
      objectives: ["Adapter PA à la crypto 24/7", "Lire liquidité sessions", "Construire setups propres"],
      sections: [
        {
          title: "24/7 et sessions",
          body: "Pas de close officiel — mais liquidité Asia/London/NY compte. Les wicks hors sessions liquides piègent.",
          readMin: 5,
        },
        {
          title: "Liquidité et stops",
          body: "Equal highs/lows, pools au-dessus des ranges : la crypto chasse agressivement. Attends displacement + reclaim.",
          readMin: 5,
        },
        {
          title: "HTF d’abord",
          body: "Bias daily/H4 avant M15. Un setup LTF contre HTF = faible expectancy.",
          readMin: 5,
        },
        {
          title: "Setups types",
          body: "Sweep + MSS, range break & retest, premium/discount vs equilibrium. Qualité > quantité.",
          example: "Comme en Formation ÉLITE — même grammaire, microstructure crypto différente.",
          readMin: 5,
        },
        {
          title: "News & weekends",
          body: "Gaps de liquidité week-end, listings, unlocks. Réduis taille ou flat si event majeur sans plan.",
          readMin: 4,
        },
      ],
      quiz: [
        q("Crypto 24/7 signifie :", ["Liquidité uniforme chaque heure", "Toujours ouvert mais liquidité variable", "Pas de wicks", "Pas de sessions"], 1),
        q("HTF bias :", ["Inutile", "Filtre les LTF", "Remplace risk", "Seed"], 1),
        q("Sweep de liquidité :", ["Toujours continuation immédiate", "Souvent piège avant vrai move", "Interdit", "Uniquement forex"], 1),
        q("Week-end crypto :", ["Toujours safe levier", "Liquidité parfois fine / piégeuse", "Marché fermé", "Sans prix"], 1),
        q("Qualité setup :", ["50 trades/jour", "Peu de trades A+", "Ignorer HTF", "Copy only"], 1),
      ],
      practice: [
        p("Contre daily bear, long M1 FOMO :", ["Edge fort", "Faible expectancy", "Risk free", "Obligatoire"], 1, "Respecte HTF."),
        p("Avant NY open crypto :", ["Check niveaux + news", "Sleep trade levier", "Disable alerts", "Ignore BTC"], 0, "Préparation."),
        p("Après sweep + reclaim :", ["Entrée possible selon plan", "All-in no stop", "Ignore", "Seed"], 0, "Plan."),
      ],
    };
  },

  "c17-regulation": function () {
    return {
      objectives: ["Situer le cadre FR/EU", "Comprendre KYC/reporting", "Rester compliant sans panique"],
      sections: [
        {
          title: "Pourquoi ça compte",
          body: "Accès rails fiat, exchanges, fiscalité, risques de gel. Ignorer la régulation = risque opérationnel.",
          readMin: 5,
        },
        {
          title: "MiCA & Europe",
          body: "Cadre européen pour crypto-assets / stables / CASPs. Transition progressive — suis les sources officielles.",
          readMin: 5,
        },
        {
          title: "Fiscalité (esprit)",
          body: "En France, les plus-values crypto ont des règles spécifiques ; tiens un historique de transactions. Ceci n’est pas un conseil fiscal — consulte un pro.",
          key: "Journal de txs = ami du futur toi.",
          readMin: 5,
        },
        {
          title: "KYC / Travel rule",
          body: "Transfers vers exchanges régulés exigent identité. Privacy ≠ illegal ; non-compliance a un coût.",
          readMin: 4,
        },
        {
          title: "Posture La Forge",
          body: "Trade et apprends dans un cadre propre. Pas de conseils pour contourner la loi.",
          readMin: 4,
        },
      ],
      quiz: [
        q("MiCA concerne surtout :", ["Uniquement le mining US", "Le cadre EU crypto", "Le RSI", "Les seed phrases"], 1),
        q("Historique de transactions :", ["Inutile", "Utile fiscalement / audit perso", "Interdit", "Remplace custody"], 1),
        q("KYC sur CEX :", ["Optionnel always", "Souvent requis rails régulés", "Donne ta seed", "Fixe le gas"], 1),
        q("Ce module donne :", ["Conseil fiscal personnalisé", "Cadre de sensibilisation", "Astuce fraude", "Exemption impôts"], 1),
        q("Gel / compliance risk :", ["Inexistant", "Réel sur rails centralisés", "Seulement NFT", "Uniquement L2"], 1),
      ],
      practice: [
        p("Pour la fiscalité perso :", ["Inventer les chiffres", "Tracer txs + pro si besoin", "Ignorer 10 ans", "Demander à un bot seed"], 1, "Traçabilité."),
        p("Contourner KYC illégalement :", ["Recommandé ici", "Hors scope / non", "Obligatoire trading", "Sans risque"], 1, "Compliance."),
        p("Source régulation :", ["Officielle / counsel", "Random influencer", "Screenshot 2017", "Meme"], 0, "Sources fiables."),
      ],
    };
  },

  "c18-narratifs": function () {
    return {
      objectives: ["Identifier catalysts", "Trader le narratif avec discipline", "Éviter buy-the-rumor traps"],
      sections: [
        {
          title: "Narratif = flux d’attention",
          body: "ETF, upgrades, listings, unlocks, points seasons, régulation. Le marché price l’anticipation puis le fait.",
          readMin: 5,
        },
        {
          title: "Buy rumor / sell news",
          body: "Souvent le catalyseur « évident » est déjà dans le prix. Cherche asymétrie et invalidation claire.",
          readMin: 5,
        },
        {
          title: "Calendrier",
          body: "Tiens un calendrier unlocks / upgrades / macro. Pas pour prédire — pour réduire les surprises.",
          readMin: 4,
        },
        {
          title: "Crowding",
          body: "Quand tout le TL dit la même chose + funding extrême : prudence. Edge = process, pas consensus Twitter.",
          readMin: 5,
        },
        {
          title: "Playbook",
          body: "Catalyst → hypothèse → niveaux → taille → invalidation → exit plan. Sinon pas de trade.",
          readMin: 4,
        },
      ],
      quiz: [
        q("Un catalyseur évident est souvent :", ["Toujours sous-pricé", "Partiellement déjà pricé", "Sans impact", "Une seed"], 1),
        q("Unlock calendar :", ["Inutile", "Réduit les surprises", "Garantit pumps", "Remplace stop"], 1),
        q("Funding extrême + narratif unique :", ["Signal safe all-in", "Crowding possible", "Peg", "Audit"], 1),
        q("Playbook minimal :", ["Hypothèse + invalidation", "Tip only", "Levier only", "Ignore prix"], 0),
        q("Sell the news :", ["Impossible crypto", "Pattern fréquent", "Interdit", "Uniquement forex"], 1),
      ],
      practice: [
        p("ETF annoncé depuis des mois, news day :", ["All-in no plan", "Plan / prudence sell-news", "Mortgage", "Seed"], 1, "Souvent pricé."),
        p("Tu trades un upgrade :", ["Sans niveaux", "Avec niveaux + invalidation", "Levier 125x", "Ignore funding"], 1, "Process."),
        p("TL unanime :", ["Edge maximal", "Vérifier crowding", "Disable risk", "Copy 50x"], 1, "Crowding."),
      ],
    };
  },

  "c19-portfolio": function () {
    return {
      objectives: ["Allouer avec intention", "Rebalancer", "Séparer horizons"],
      sections: [
        {
          title: "Buckets",
          body: "Core (BTC/ETH), satellite (convictions), ops/trading, stables buffer. Horizons différents = règles différentes.",
          readMin: 5,
        },
        {
          title: "Allocation",
          body: "Pas de % universel. Cap alts, cap DeFi risk, cap levier. Écris tes caps.",
          readMin: 5,
        },
        {
          title: "Rebalance",
          body: "Trim winners vers targets ; évite le « let it ride » émotionnel sans règle. Tax awareness.",
          readMin: 4,
        },
        {
          title: "Custody map",
          body: "Où est chaque bucket (cold/CEX/DeFi). Une feuille suffit. Test restores seed (sans exposer).",
          readMin: 5,
        },
        {
          title: "Drawdown plan",
          body: "Que fais-tu à -30% portfolio crypto ? Préécrit. Sinon tu improvises mal.",
          readMin: 4,
        },
      ],
      quiz: [
        q("Séparer core et trading :", ["Inutile", "Utile discipline", "Interdit", "Uniquement institutions"], 1),
        q("Caps d’allocation :", ["Ego only", "Règles écrites", "Random", "Funding"], 1),
        q("Rebalance :", ["Jamais", "Selon règles / targets", "Chaque tick", "Via seed DM"], 1),
        q("Drawdown plan :", ["À écrire avant crise", "Pendant panique only", "Inutile", "Remplace custody"], 0),
        q("Stables buffer sert à :", ["FOMO max", "Opportunités + marge d’erreur", "Augmenter IL", "Mint scam"], 1),
      ],
      practice: [
        p("Bucket trading blow-up :", ["Touche au cold core impulsively", "Respecte séparation", "Seed online", "Disable all"], 1, "Séparation."),
        p("Après x3 sur un alt satellite :", ["Règle de trim ?", "Ignore forever", "All portfolio in", "Leverage more"], 0, "Trim rules."),
        p("Map custody :", ["Dans ta tête only", "Documentée", "Tweetée", "Chez un inconnu"], 1, "Documente."),
      ],
    };
  },

  "c20-psycho": function () {
    return {
      objectives: ["Nommer FOMO/FUD", "Installer des garde-fous", "Lier psycho et process"],
      sections: [
        {
          title: "FOMO crypto",
          body: "Pumps verticaux + TL hype = décisions hors plan. Antidote : watchlist préécrite, taille max émotion.",
          readMin: 5,
        },
        {
          title: "FUD et capitulation",
          body: "Soldes panique sur wicks. Antidote : niveaux invalidation prédéfinis, pas PnL minute.",
          readMin: 4,
        },
        {
          title: "Addiction levier",
          body: "Dopamine funding. Si tu ne peux pas rester flat : pause hard.",
          readMin: 4,
        },
        {
          title: "Rituels",
          body: "Pré-session checklist, post-session journal 5 lignes, weekly review. Boredom = edge.",
          readMin: 5,
        },
        {
          title: "Lien Atlas Psycho",
          body: "L’Atlas Psychologie La Forge complète ce module — ici focus spécificités crypto.",
          readMin: 3,
        },
      ],
      quiz: [
        q("FOMO se combat surtout par :", ["Plus de levier", "Règles préécrites / sizing", "Plus de TL", "Seed sharing"], 1),
        q("Capitulation wick :", ["Market sell always", "Respecter plan / invalidation", "Disable brain", "All-in reverse"], 1),
        q("Inability to stay flat :", ["Normal elite", "Red flag addiction", "Edge", "MiCA"], 1),
        q("Weekly review :", ["Perte de temps", "Améliore process", "Interdit", "Remplace risk"], 1),
        q("Boredom trading :", ["Souvent négatif expectancy", "Toujours profitable", "Obligatoire", "Sans frais"], 0),
      ],
      practice: [
        p("Coin +200% hors watchlist :", ["Chase market", "Skip ou wait pullback plan", "Mortgage", "Seed"], 1, "Pas de chase."),
        p("Tilt après loss :", ["Size up revenge", "Stop session", "Disable stops", "Loan"], 1, "Pause."),
        p("Checklist pré-session :", ["Utile", "Inutile", "Shameful", "Only for stocks"], 0, "Rituel."),
      ],
    };
  },

  "c21-infra": function () {
    return {
      objectives: ["Comprendre L2/rollups", "Évaluer bridges", "Choisir rails avec risque"],
      sections: [
        {
          title: "Pourquoi L2",
          body: "Scalabilité : frais bas, throughput. Sécurité dérivée du L1 avec nuances selon design.",
          readMin: 5,
        },
        {
          title: "Optimistic vs ZK",
          body: "Optimistic : challenge period. ZK : preuves — complexité et trust assumptions différentes.",
          readMin: 5,
        },
        {
          title: "Bridges",
          body: "Ponts = honeypots historiques. Prefère bridges canoniques / canonical ; taille limitée.",
          error: "Bridge obscur pour 2$ de fees économisés.",
          readMin: 5,
        },
        {
          title: "Sequencers & centralisation",
          body: "Beaucoup de L2 ont des composants centralisés. Risque de downtime / censure — à connaître.",
          readMin: 4,
        },
        {
          title: "Pour le trader",
          body: "Choisis 1–2 écosystèmes max au début. Maîtrise adresse/réseau avant multi-chain chaos.",
          readMin: 4,
        },
      ],
      quiz: [
        q("L2 vise surtout :", ["Remplacer BTC", "Scalabilité / frais", "Supprimer custody", "KYC"], 1),
        q("Bridges ont :", ["0 exploits historiques", "Un historique d’exploits notable", "Peg magique", "Pas de smart contracts"], 1),
        q("Challenge period optimistic :", ["Inexistant", "Délai de finalité / withdraw", "Halving", "Funding"], 1),
        q("Multi-chain débutant :", ["10 chains day one", "1–2 écosystèmes maîtrisés", "Ignore réseaux", "Seed per chain tweet"], 1),
        q("Sequencer centralisé :", ["Sans aucun risque", "Risque downtime/censure possible", "Identique BTC mining", "Stablecoin"], 1),
      ],
      practice: [
        p("Économiser 2$ sur bridge inconnu avec 5 figures :", ["OK", "Mauvais risk/reward", "Obligatoire", "MiCA"], 1, "Risque >> fees."),
        p("Withdraw L2 :", ["Comprendre finalité / délais", "Spam click", "Ignore docs", "Use fake UI"], 0, "Finalité."),
        p("Stack débutant :", ["Chaos 15 wallets", "Simple + documenté", "All bridges", "Random RPCs"], 1, "Simplicité."),
      ],
    };
  },

  "c22-macro": function () {
    return {
      objectives: ["Relier rates/DXY/crypto", "Utiliser Macro Edge en complément", "Adapter le bias"],
      sections: [
        {
          title: "Liquidité mondiale",
          body: "Crypto aime la liquidité abondante et les taux réels bas. Tightening = vent contraire fréquent.",
          readMin: 5,
        },
        {
          title: "USD et yields",
          body: "DXY↑ et yields↑ pèsent souvent sur risk assets. Pas une règle 100% — une tendance conditionnelle.",
          readMin: 5,
        },
        {
          title: "Events",
          body: "FOMC, CPI, NFP : volatilité. Flat ou taille réduite si pas de edge event.",
          readMin: 4,
        },
        {
          title: "Macro Edge La Forge",
          body: "L’outil Macro Edge (SMT / drivers) complète ce module pour le desk gold/macro — utile au contexte risk.",
          readMin: 4,
        },
        {
          title: "Synthèse bias",
          body: "Macro + cycle crypto + microstructure = bias. Puis seulement setups.",
          readMin: 4,
        },
      ],
      quiz: [
        q("Taux réels en hausse :", ["Souvent support risk assets", "Souvent headwind", "Sans effet crypto", "Fixe gas"], 1),
        q("Avant FOMC :", ["Levier max always", "Taille / flat selon plan", "Ignore", "Seed backup live"], 1),
        q("DXY fort :", ["Souvent difficile pour crypto", "Toujours bullish alts", "Peg USDT only", "NFT floor up always"], 0),
        q("Bias se construit :", ["Après entrée", "Avant setups", "Via FOMO", "Via DM admin"], 1),
        q("Macro Edge :", ["Remplace risk", "Complément contexte", "Donne seed", "Mine BTC"], 1),
      ],
      practice: [
        p("CPI surprise hot :", ["All-in alts", "Réévaluer risk bias", "Disable news", "Ignore DXY"], 1, "Réévalue."),
        p("Ordre correct :", ["Setup → bias", "Bias → setup", "Levier → plan", "Tweet → mortgage"], 1, "Bias d’abord."),
        p("Event sans edge :", ["Trade quand même 20x", "Réduire / passer", "Yolo", "Share seed"], 1, "Pass autorisé."),
      ],
    };
  },

  "c23-journal": function () {
    return {
      objectives: ["Journaliser trades crypto", "Taguer régimes", "Review hebdo"],
      sections: [
        {
          title: "Pourquoi un journal crypto",
          body: "24/7 + narratifs + levier = amnésie. Le journal force la vérité.",
          readMin: 4,
        },
        {
          title: "Champs utiles",
          body: "Paire, direction, timeframe, régime BTC, catalyst, size/R, émotion 1–5, screenshot, invalidation.",
          readMin: 5,
        },
        {
          title: "Tags",
          body: "Ex. : sweep-mss, news-fade, narrative-chase (à éviter), weekend-thin. Tags → stats.",
          readMin: 4,
        },
        {
          title: "Journal La Forge",
          body: "Utilise le Trading Journal membre pour centraliser. Ce module fixe la méthode.",
          readMin: 4,
        },
        {
          title: "Review",
          body: "Hebdo : expectancy par tag, erreurs répétées, une règle à ajuster max.",
          readMin: 4,
        },
      ],
      quiz: [
        q("Journal sert à :", ["Décoration", "Améliorer process via données", "Remplacer stops", "KYC"], 1),
        q("Tag narrative-chase :", ["À maximiser", "À surveiller / réduire", "Obligatoire", "Sans sens"], 1),
        q("Review hebdo change :", ["Tout le système chaque fois", "Une règle max idéalement", "Rien jamais", "La seed"], 1),
        q("Émotion 1–5 :", ["Inutile", "Utile corrélation tilt/PnL", "Interdit", "Remplace R"], 1),
        q("Screenshot :", ["Optionnel vanity", "Utile contexte post-trade", "Seed backup", "Gas pay"], 1),
      ],
      practice: [
        p("Après trade :", ["Rien", "Logger champs clés", "Delete history", "Tweet seed"], 1, "Log."),
        p("Stats sans tags :", ["Difficiles", "Parfaites", "Inutiles always", "Automatiques magiques"], 0, "Tags aident."),
        p("Une semaine tilt :", ["Augmenter size", "Analyser tags émotion + freiner", "Ignore journal", "Loan"], 1, "Frein."),
      ],
    };
  },

  "c24-capstone": function () {
    return {
      objectives: ["Assembler le playbook", "Valider checklist", "Passer en exécution disciplinée"],
      sections: [
        {
          title: "Playbook une page",
          body: "Marchés autorisés, sessions, setups A, risque %, max daily loss, custody map, catalysts suivis.",
          key: "Si ça ne tient pas sur une page, c’est trop complexe pour trader sous stress.",
          readMin: 5,
        },
        {
          title: "Checklist pré-trade",
          body: "Régime BTC ? Corrélation risk ? Event ? Setup A ? R clair ? Taille OK ? Émotion ≤3 ?",
          readMin: 5,
        },
        {
          title: "Checklist post-trade",
          body: "Plan suivi ? Erreur process ? Screenshot + tags ? Revenge tentation ?",
          readMin: 4,
        },
        {
          title: "Lien formation trading",
          body: "La grammaire ICT/PA de la Formation ÉLITE s’applique. La crypto ajoute custody, 24/7, narratifs, perps.",
          readMin: 4,
        },
        {
          title: "Prochaines étapes",
          body: "Valide ce module (quiz+exo). Ouvre 3 prochains modules non validés. Tiens 4 semaines de journal. Reviens au capstone et ajuste.",
          readMin: 4,
        },
      ],
      quiz: [
        q("Playbook trop long :", ["Mieux sous stress", "Difficile à exécuter sous stress", "Obligatoire 50 pages", "Remplace risk"], 1),
        q("Pré-trade checklist inclut :", ["Émotion / R / régime", "Seulement le logo", "Seed", "Tip inconnu"], 0),
        q("Crypto ajoute surtout vs spot FX :", ["Rien", "Custody, 24/7, narratifs, perps", "Pas de vol", "Pas de risque"], 1),
        q("Après capstone :", ["Arrêter d’apprendre", "Exécuter + journal 4 semaines", "All-in memecoin", "Donner accès compte"], 1),
        q("Setup non-A :", ["Trader quand même always", "Passer", "Levier up", "Ignore invalidation"], 1),
      ],
      practice: [
        p("Émotion 5/5 FOMO :", ["Trade normal", "No trade / pause", "Max size", "Disable checklist"], 1, "No trade."),
        p("Playbook :", ["Dans la tête floue", "Écrit une page", "50 indicateurs no rule", "Chez un tipster"], 1, "Écrit."),
        p("Invalidation touchée :", ["Espérer", "Sortir selon plan", "Add to loser", "Loan"], 1, "Respecte le plan."),
      ],
    };
  },
};

function buildLesson(id) {
  const builder = LESSON_BUILDERS[id];
  if (!builder) throw new Error("Missing lesson " + id);
  const raw = builder();
  const steps = stepsFrom(raw.sections);
  return {
    objectives: raw.objectives,
    steps: steps,
    totalSteps: steps.length,
    quiz: raw.quiz,
    practice: raw.practice,
  };
}

const LESSONS = {};
for (const m of MODULES) {
  LESSONS[m.id] = buildLesson(m.id);
}

const hours = PARTS.reduce((s, p) => s + p.hours, 0);

const out = `/**
 * Crypto La Forge — curriculum (parties, modules, leçons).
 * Généré par scripts/generate-crypto-course-data.js — ne pas éditer à la main sauf hotfix.
 */
(function (global) {
  "use strict";

  var CRYPTO_COURSE_PARTS = ${JSON.stringify(PARTS, null, 2)};

  var CRYPTO_MODULES = ${JSON.stringify(MODULES, null, 2)};

  var CRYPTO_LESSONS = ${JSON.stringify(LESSONS)};

  var CRYPTO_TOTAL_HOURS = ${hours};
  var CRYPTO_TOTAL_MODULES = CRYPTO_MODULES.length;

  function getCryptoModuleIds() {
    return CRYPTO_MODULES.map(function (m) { return m.id; });
  }

  function getCryptoModuleById(id) {
    return CRYPTO_MODULES.find(function (m) { return m.id === id; }) || null;
  }

  function getCryptoPartById(id) {
    return CRYPTO_COURSE_PARTS.find(function (p) { return p.id === id; }) || null;
  }

  function getCryptoLesson(id) {
    return CRYPTO_LESSONS[id] || null;
  }

  function getCryptoStatsLine() {
    return (
      "~" +
      CRYPTO_TOTAL_HOURS +
      " h · " +
      CRYPTO_TOTAL_MODULES +
      " modules · " +
      CRYPTO_COURSE_PARTS.length +
      " parties"
    );
  }

  global.CRYPTO_COURSE_PARTS = CRYPTO_COURSE_PARTS;
  global.CRYPTO_MODULES = CRYPTO_MODULES;
  global.CRYPTO_LESSONS = CRYPTO_LESSONS;
  global.CRYPTO_TOTAL_HOURS = CRYPTO_TOTAL_HOURS;
  global.CRYPTO_TOTAL_MODULES = CRYPTO_TOTAL_MODULES;
  global.getCryptoModuleIds = getCryptoModuleIds;
  global.getCryptoModuleById = getCryptoModuleById;
  global.getCryptoPartById = getCryptoPartById;
  global.getCryptoLesson = getCryptoLesson;
  global.getCryptoStatsLine = getCryptoStatsLine;
})(typeof window !== "undefined" ? window : global);
`;

const dest = path.join(__dirname, "..", "la-forge", "js", "crypto-course-data.js");
fs.writeFileSync(dest, out);
console.log("Wrote", dest, "modules=", MODULES.length, "hours=", hours);
