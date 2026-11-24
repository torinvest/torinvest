/**
 * Schémas SVG pédagogiques — Formation Crypto La Forge.
 * Accès : getCryptoSchema(id) → { title, caption, svg }
 */
(function (global) {
  "use strict";

  var TEAL = "#2dd4bf";
  var GOLD = "#f7931a"; /* BTC */
  var ETH = "#627eea";
  var SOL = "#14f195";
  var SOL2 = "#9945ff";
  var XRP = "#00aae4";
  var HYPE = "#97fce4";
  var MUTED = "#8aa39c";
  var RED = "#ff8f86";
  var GREEN = "#7dffc8";
  var LINE = "#2a3a38";

  function label(x, y, text, color, size) {
    return (
      '<text x="' +
      x +
      '" y="' +
      y +
      '" fill="' +
      (color || MUTED) +
      '" style="font-size:' +
      (size || 13) +
      'px;font-family:system-ui,sans-serif">' +
      text +
      "</text>"
    );
  }

  function rect(x, y, w, h, fill, stroke, opacity) {
    return (
      '<rect x="' +
      x +
      '" y="' +
      y +
      '" width="' +
      w +
      '" height="' +
      h +
      '" rx="6" fill="' +
      (fill || "rgba(45,212,191,0.08)") +
      '" stroke="' +
      (stroke || TEAL) +
      '" stroke-opacity="' +
      (opacity != null ? opacity : 0.45) +
      '"/>'
    );
  }

  function line(x1, y1, x2, y2, color, dash) {
    return (
      '<line x1="' +
      x1 +
      '" y1="' +
      y1 +
      '" x2="' +
      x2 +
      '" y2="' +
      y2 +
      '" stroke="' +
      (color || LINE) +
      '" stroke-width="1.5"' +
      (dash ? ' stroke-dasharray="' + dash + '"' : "") +
      "/>"
    );
  }

  function arrow(x1, y1, x2, y2, color) {
    var c = color || TEAL;
    return (
      line(x1, y1, x2, y2, c) +
      '<polygon points="' +
      x2 +
      "," +
      y2 +
      " " +
      (x2 - 8) +
      "," +
      (y2 - 4) +
      " " +
      (x2 - 8) +
      "," +
      (y2 + 4) +
      '" fill="' +
      c +
      '"/>'
    );
  }

  function node(x, y, w, h, title, sub) {
    return (
      rect(x, y, w, h) +
      label(x + 12, y + 28, title, TEAL, 14) +
      (sub ? label(x + 12, y + 48, sub, MUTED, 11) : "")
    );
  }

  function wrap(inner, title, caption) {
    return {
      title: title,
      caption: caption,
      svg:
        '<svg viewBox="0 0 860 320" role="img" aria-label="' +
        title +
        '"><title>' +
        title +
        "</title><desc>" +
        caption +
        "</desc>" +
        '<defs><linearGradient id="cxg" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0%" stop-color="' +
        GOLD +
        '" stop-opacity="0.35"/>' +
        '<stop offset="40%" stop-color="' +
        ETH +
        '" stop-opacity="0.35"/>' +
        '<stop offset="75%" stop-color="' +
        SOL +
        '" stop-opacity="0.35"/>' +
        '<stop offset="100%" stop-color="' +
        SOL2 +
        '" stop-opacity="0.3"/>' +
        "</linearGradient></defs>" +
        '<rect x="20" y="20" width="820" height="280" rx="14" fill="#060d12" stroke="url(#cxg)" stroke-width="1.5"/>' +
        line(40, 70, 820, 70, "#1e2c2a", "2 6") +
        line(40, 160, 820, 160, "#1e2c2a", "2 6") +
        line(40, 250, 820, 250, "#1e2c2a", "2 6") +
        inner +
        "</svg>",
    };
  }

  var SCHEMAS = {
    blockchain: function () {
      var s = "";
      for (var i = 0; i < 4; i++) {
        var x = 70 + i * 180;
        s += rect(x, 90, 140, 100, "rgba(45,212,191,0.1)", TEAL);
        s += label(x + 28, 130, "Bloc #" + (i + 1), TEAL, 15);
        s += label(x + 20, 155, "hash · txs · time", MUTED, 11);
        if (i < 3) s += arrow(x + 145, 140, x + 175, 140, GOLD);
      }
      s += label(70, 230, "Chaque bloc référence le hash du précédent → chaîne difficile à réécrire", MUTED, 13);
      s += label(70, 255, "Consensus (PoW / PoS) décide quelle chaîne est valide", MUTED, 13);
      return wrap(s, "Chaîne de blocs", "Blocs liés par hash : modifier l’historique exige de contrôler le consensus.");
    },

    keys_custody: function () {
      var s =
        node(60, 70, 200, 90, "Seed phrase", "12/24 mots → clés") +
        arrow(270, 115, 320, 115, GOLD) +
        node(330, 70, 200, 90, "Clé privée", "signe les tx") +
        arrow(540, 115, 590, 115, GOLD) +
        node(600, 70, 200, 90, "Adresse publique", "reçoit les fonds") +
        rect(60, 200, 340, 70, "rgba(245,215,110,0.08)", GOLD) +
        label(80, 240, "Cold wallet = seed offline (épargne)", GOLD, 13) +
        rect(440, 200, 360, 70, "rgba(206,138,126,0.1)", RED) +
        label(460, 240, "Hot / CEX = surface d’attaque ↑", RED, 13);
      return wrap(s, "Custody & clés", "Qui possède la seed possède les fonds. Sépare épargne (cold) et ops (hot/CEX).");
    },

    btc_halving: function () {
      var s = label(60, 50, "Récompense de bloc (schéma)", MUTED, 12);
      var heights = [180, 120, 80, 50];
      var labels = ["50 BTC", "25", "12.5", "6.25…"];
      for (var i = 0; i < 4; i++) {
        var x = 100 + i * 160;
        var h = heights[i];
        s += rect(x, 250 - h, 100, h, "rgba(245,215,110,0.15)", GOLD);
        s += label(x + 18, 240 - h, labels[i], GOLD, 13);
        if (i < 3) s += label(x + 105, 200, "÷2", TEAL, 12);
      }
      s += label(100, 285, "~4 ans entre halvings — offre nouvelle ralentit (pas une garantie de prix)", MUTED, 12);
      return wrap(s, "Halving Bitcoin", "L’émission décroît périodiquement ; le prix dépend aussi de liquidité et adoption.");
    },

    eth_stack: function () {
      var s =
        node(80, 60, 220, 70, "App / Wallet", "MetaMask, dApp") +
        arrow(190, 135, 190, 165, TEAL) +
        node(80, 170, 220, 70, "Smart contract", "ERC-20 / logique") +
        arrow(190, 245, 190, 270, TEAL) +
        label(150, 295, "EVM + gas (ETH)", GOLD, 13) +
        node(400, 60, 220, 70, "L2 / Rollup", "frais ↓") +
        arrow(510, 135, 510, 165, TEAL) +
        node(400, 170, 220, 70, "Bridge", "risque !") +
        arrow(620, 205, 700, 205, GOLD) +
        node(700, 170, 120, 70, "L1 ETH", "sécurité");
      return wrap(s, "Stack Ethereum", "Wallet → contrat → L1/L2. Le bridge est souvent le maillon faible.");
    },

    token_taxonomy: function () {
      var s =
        node(40, 55, 130, 70, "BTC", "benchmark") +
        node(185, 55, 130, 70, "ETH", "smart contracts") +
        node(330, 55, 130, 70, "SOL", "high throughput") +
        node(475, 55, 130, 70, "XRP", "rails / liquidity") +
        node(620, 55, 140, 70, "HYPE", "perp / narrative") +
        node(110, 160, 150, 70, "L2 / DeFi", "ARB · OP · AAVE") +
        node(310, 160, 150, 70, "Stables", "USDT · USDC") +
        node(510, 160, 150, 70, "RWA / gov", "droit + votes") +
        label(40, 270, "BTC · ETH · SOL · XRP · HYPE — classes et horizons différents, budgets séparés", MUTED, 12);
      return wrap(s, "Univers tickers", "Classe l’actif avant le ticker : horizon et risque doivent matcher.");
    },

    cex_dex: function () {
      var s =
        rect(60, 70, 320, 180, "rgba(245,215,110,0.08)", GOLD) +
        label(90, 105, "CEX", GOLD, 18) +
        label(90, 135, "• Order book + perps", MUTED, 13) +
        label(90, 160, "• Custody exchange", MUTED, 13) +
        label(90, 185, "• Fiat on-ramp / KYC", MUTED, 13) +
        label(90, 210, "• Risque contrepartie", RED, 13) +
        rect(460, 70, 320, 180, "rgba(45,212,191,0.08)", TEAL) +
        label(490, 105, "DEX", TEAL, 18) +
        label(490, 135, "• AMM / pools", MUTED, 13) +
        label(490, 160, "• Self-custody wallet", MUTED, 13) +
        label(490, 185, "• MEV + SC risk", MUTED, 13) +
        label(490, 210, "• Pas de CEO à appeler", MUTED, 13) +
        label(300, 280, "Choix = besoin (fiat, levier, custody) × risque accepté", MUTED, 12);
      return wrap(s, "CEX vs DEX", "Centralisé = UX et contrepartie ; décentralisé = clés et smart contracts.");
    },

    amm_pool: function () {
      var s =
        node(80, 100, 180, 80, "Token A", "réserve x") +
        node(560, 100, 180, 80, "Token B", "réserve y") +
        rect(320, 90, 180, 100, "rgba(45,212,191,0.12)", TEAL) +
        label(350, 130, "Pool AMM", TEAL, 16) +
        label(345, 155, "x · y = k", GOLD, 14) +
        arrow(265, 140, 315, 140, MUTED) +
        arrow(505, 140, 555, 140, MUTED) +
        label(80, 230, "Swap A→B : tu ajoutes A, retires B → prix glisse (slippage)", MUTED, 13) +
        label(80, 255, "LP gagne fees mais subit l’impermanent loss si les prix divergent", MUTED, 13);
      return wrap(s, "AMM & liquidité", "Le prix sort des réserves. Plus le trade est gros vs pool, plus le slippage.");
    },

    stable_peg: function () {
      var s =
        line(80, 160, 780, 160, GOLD, "4 4") +
        label(700, 150, "Peg 1.00", GOLD, 13) +
        '<path d="M80 155 L180 150 L280 158 L380 145 L480 170 L580 210 L650 120 L720 155 L780 152" fill="none" stroke="' +
        TEAL +
        '" stroke-width="2.5"/>' +
        label(560, 230, "Stress / depeg", RED, 13) +
        label(80, 280, "Fiat-backed : réserves + confiance émetteur · Crypto-backed : collateral + oracles", MUTED, 12);
      return wrap(s, "Stablecoin & peg", "« Stable » tant que confiance, liquidité et design tiennent — un depeg est un event risque.");
    },

    onchain_flow: function () {
      var s =
        node(50, 80, 160, 70, "Wallet", "signe") +
        arrow(220, 115, 270, 115) +
        node(280, 80, 160, 70, "Mempool", "en attente") +
        arrow(450, 115, 500, 115) +
        node(510, 80, 160, 70, "Bloc", "inclus") +
        arrow(680, 115, 730, 115) +
        node(730, 80, 100, 70, "Finalité", "") +
        label(50, 200, "MEV : bots peuvent réordonner / sandwicher des tx visibles", RED, 13) +
        label(50, 230, "Explorateur = vérifier hash, contrat, transfers avant d’interagir", MUTED, 13) +
        label(50, 260, "Labels exchange/whale = utiles mais imparfaits", MUTED, 12);
      return wrap(s, "Cycle d’une transaction", "Signée → mempool → bloc. Entre les deux : frais, délai, parfois MEV.");
    },

    cycle_regimes: function () {
      var s =
        '<path d="M80 220 C160 220, 200 80, 300 90 S450 250, 520 200 S650 60, 780 70" fill="none" stroke="' +
        TEAL +
        '" stroke-width="3"/>' +
        label(100, 250, "Accum.", MUTED, 12) +
        label(280, 70, "Markup", GREEN, 12) +
        label(480, 250, "Distrib.", GOLD, 12) +
        label(680, 55, "Decline", RED, 12) +
        label(80, 290, "Régime ≠ calendrier fixe. Combine dominance BTC, funding, macro liquidité", MUTED, 12);
      return wrap(s, "Cycles de marché", "Phases schématiques : adapte la taille au régime, pas au FOMO.");
    },

    defi_stack: function () {
      var s =
        node(60, 70, 170, 80, "Lending", "borrow / supply") +
        node(260, 70, 170, 80, "Staking", "yield + lock") +
        node(460, 70, 170, 80, "LP / AMM", "fees ± IL") +
        node(660, 70, 140, 80, "Points", "spéculation") +
        rect(60, 190, 740, 80, "rgba(206,138,126,0.08)", RED) +
        label(90, 225, "Risk stack : smart contract · oracle · governance · bridge · UI phishing · stable depeg", RED, 13) +
        label(90, 250, "Taille = capital que tu peux perdre techniquement (audit ≠ assurance)", MUTED, 12);
      return wrap(s, "Couches DeFi", "Chaque brique empile des risques. APY haut = souvent complexité ou risque caché.");
    },

    risk_sizing: function () {
      var s =
        label(60, 70, "Risque compte fixe (ex. 1 %)", TEAL, 14) +
        node(60, 95, 220, 70, "Stop distance", "ex. 4 %") +
        arrow(290, 130, 340, 130, GOLD) +
        node(350, 95, 220, 70, "Taille position", "risque ÷ distance") +
        arrow(580, 130, 630, 130, GOLD) +
        node(640, 95, 160, 70, "Levier", "suit la taille") +
        label(60, 210, "Levier n’est pas un objectif : c’est un outil pour atteindre la taille calculée", MUTED, 13) +
        label(60, 240, "Max daily loss + pause = circuit breaker obligatoire crypto", GOLD, 13);
      return wrap(s, "Volatilité & sizing", "Calcule la taille depuis le risque et le stop — le levier suit.");
    },

    sessions_crypto: function () {
      var s =
        rect(70, 100, 180, 60, "rgba(141,204,175,0.12)", GREEN) +
        label(100, 135, "Asie", GREEN, 14) +
        rect(280, 100, 180, 60, "rgba(45,212,191,0.12)", TEAL) +
        label(310, 135, "Londres", TEAL, 14) +
        rect(490, 100, 200, 60, "rgba(245,215,110,0.12)", GOLD) +
        label(530, 135, "New York", GOLD, 14) +
        label(70, 200, "Marché 24/7 ≠ liquidité uniforme. Wicks hors sessions liquides = pièges fréquents", MUTED, 13) +
        label(70, 230, "Week-end / unlocks / listings : réduis taille ou reste flat sans plan", MUTED, 12);
      return wrap(s, "Sessions crypto", "Toujours ouvert, mais la liquidité et la qualité des setups varient.");
    },

    correlation_risk: function () {
      var s =
        node(80, 80, 160, 70, "BTC", "benchmark") +
        node(300, 80, 160, 70, "ETH / alts", "beta ↑") +
        node(520, 80, 160, 70, "Nasdaq", "risk-on") +
        node(300, 200, 160, 70, "DXY / yields", "headwind") +
        line(240, 115, 300, 115, TEAL) +
        line(460, 115, 520, 115, TEAL) +
        line(380, 150, 380, 200, GOLD, "4 3") +
        label(80, 290, "Long BTC + alts + job tech = souvent le même facteur risque", MUTED, 12);
      return wrap(s, "Corrélations risk-on", "Diversifie les facteurs, pas seulement 10 tickers crypto.");
    },

    portfolio_buckets: function () {
      var s =
        node(50, 80, 180, 90, "Core", "BTC/ETH cold") +
        node(250, 80, 180, 90, "Satellite", "convictions") +
        node(450, 80, 180, 90, "Trading", "budget borné") +
        node(650, 80, 160, 90, "Stables", "buffer") +
        label(50, 210, "Caps écrits · rebalance selon règles · drawdown plan préécrit (-30 % ?)", MUTED, 13) +
        label(50, 240, "Blow-up trading ≠ toucher au cold core", GOLD, 13);
      return wrap(s, "Buckets portfolio", "Sépare horizons et custody. Une page de règles > improvisation.");
    },

    l2_bridge: function () {
      var s =
        node(80, 90, 160, 80, "L1 Ethereum", "sécurité") +
        arrow(250, 130, 320, 130, GOLD) +
        node(330, 90, 180, 80, "Bridge", "honeypot historique") +
        arrow(520, 130, 590, 130, GOLD) +
        node(600, 90, 180, 80, "L2 Rollup", "frais ↓") +
        label(80, 220, "Optimistic : délai de challenge · ZK : preuves — assumptions différentes", MUTED, 13) +
        label(80, 250, "Économiser 2 $ de fees sur un bridge obscur avec gros notional = mauvais R/R", RED, 12);
      return wrap(s, "L2 & bridges", "Scalabilité utile, bridges risqués. Prefère rails canoniques + taille limitée.");
    },

    playbook: function () {
      var steps = ["Régime BTC", "Macro / news", "Setup A", "R & taille", "Invalidation", "Journal"];
      var s = "";
      steps.forEach(function (t, i) {
        var x = 50 + i * 130;
        s += rect(x, 110, 110, 70);
        s += label(x + 12, 150, i + 1 + ". " + t, TEAL, 12);
        if (i < steps.length - 1) s += arrow(x + 112, 145, x + 128, 145, GOLD);
      });
      s += label(50, 230, "Si ça ne tient pas sur une page, c’est trop complexe sous stress", MUTED, 13);
      s += label(50, 260, "Émotion FOMO 5/5 → no trade. Qualité > quantité.", GOLD, 13);
      return wrap(s, "Checklist trader crypto", "Bias → setup → risque → exécution → revue. Pas l’inverse.");
    },

    narrative_flow: function () {
      var s =
        node(60, 90, 160, 70, "Rumor", "attention ↑") +
        arrow(230, 125, 280, 125) +
        node(290, 90, 160, 70, "Prix anticipe", "déjà dans le tape") +
        arrow(460, 125, 510, 125) +
        node(520, 90, 160, 70, "News", "catalyseur") +
        arrow(690, 125, 740, 125) +
        node(740, 90, 90, 70, "Fade ?", "") +
        label(60, 210, "Buy rumor / sell news est fréquent — cherche asymétrie + invalidation claire", MUTED, 13) +
        label(60, 240, "Calendrier unlocks / upgrades / macro = réduire les surprises, pas prédire", MUTED, 12);
      return wrap(s, "Narratifs & catalysts", "L’attention déplace le flux ; le fait acquis est souvent déjà pricé.");
    },

    psycho_fomo: function () {
      var s =
        rect(60, 80, 240, 120, "rgba(206,138,126,0.1)", RED) +
        label(90, 120, "FOMO / chase", RED, 16) +
        label(90, 150, "hors watchlist", MUTED, 12) +
        label(90, 175, "size émotionnelle", MUTED, 12) +
        rect(340, 80, 240, 120, "rgba(245,215,110,0.1)", GOLD) +
        label(370, 120, "Garde-fous", GOLD, 16) +
        label(370, 150, "watchlist préécrite", MUTED, 12) +
        label(370, 175, "max size émotion", MUTED, 12) +
        rect(620, 80, 180, 120, "rgba(45,212,191,0.1)", TEAL) +
        label(645, 120, "Rituel", TEAL, 16) +
        label(645, 150, "checklist", MUTED, 12) +
        label(645, 175, "review hebdo", MUTED, 12) +
        label(60, 250, "Inability to stay flat = red flag. Boredom trading = expectancy souvent négative", MUTED, 12);
      return wrap(s, "Psychologie FOMO", "Les garde-fous s’écrivent avant le pump, pas pendant.");
    },

    macro_liquidity: function () {
      var s =
        node(60, 80, 180, 70, "Rates / DXY", "vent") +
        arrow(250, 115, 300, 115) +
        node(310, 80, 180, 70, "Risk assets", "Nasdaq…") +
        arrow(500, 115, 550, 115) +
        node(560, 80, 220, 70, "Crypto beta", "amplifié") +
        label(60, 200, "Liquidité abondante + taux réels bas → souvent support risk-on / crypto", GREEN, 13) +
        label(60, 230, "Tightening / DXY fort → headwind fréquent (pas une loi 100 %)", MUTED, 13) +
        label(60, 260, "Events FOMC/CPI : flat ou taille réduite sans edge event", GOLD, 12);
      return wrap(s, "Macro & liquidité", "Construis le bias macro avant les setups — pas après l’entrée.");
    },

    journal_loop: function () {
      var s =
        node(80, 100, 160, 70, "Trade", "plan") +
        arrow(250, 135, 300, 135) +
        node(310, 100, 160, 70, "Log", "tags + R") +
        arrow(480, 135, 530, 135) +
        node(540, 100, 160, 70, "Review", "hebdo") +
        arrow(620, 175, 620, 210, GOLD) +
        arrow(620, 210, 160, 210, GOLD) +
        arrow(160, 210, 160, 175, GOLD) +
        label(200, 230, "Une règle ajustée max par revue", MUTED, 12) +
        label(80, 280, "Champs : paire, régime BTC, catalyst, émotion 1–5, invalidation, screenshot", MUTED, 12);
      return wrap(s, "Boucle journal", "Sans tags et revue, tu rejoues les mêmes erreurs 24/7.");
    },
  };

  // Alias per module default schema
  var MODULE_DEFAULT = {
    "c01-intro-crypto": "blockchain",
    "c02-bitcoin": "btc_halving",
    "c03-ethereum": "eth_stack",
    "c04-tokens": "token_taxonomy",
    "c05-cex-dex": "cex_dex",
    "c06-stablecoins": "stable_peg",
    "c07-onchain": "onchain_flow",
    "c08-cycles": "cycle_regimes",
    "c09-wallets": "keys_custody",
    "c10-securite": "keys_custody",
    "c11-defi": "defi_stack",
    "c12-nft-rw": "token_taxonomy",
    "c13-metriques": "onchain_flow",
    "c14-correlations": "correlation_risk",
    "c15-volatilite": "risk_sizing",
    "c16-price-action": "sessions_crypto",
    "c17-regulation": "cex_dex",
    "c18-narratifs": "narrative_flow",
    "c19-portfolio": "portfolio_buckets",
    "c20-psycho": "psycho_fomo",
    "c21-infra": "l2_bridge",
    "c22-macro": "macro_liquidity",
    "c23-journal": "journal_loop",
    "c24-capstone": "playbook",
  };

  function getCryptoSchema(id) {
    var fn = SCHEMAS[id];
    if (!fn) return null;
    return fn();
  }

  function getCryptoSchemaForModule(moduleId) {
    return getCryptoSchema(MODULE_DEFAULT[moduleId] || "blockchain");
  }

  global.CRYPTO_SCHEMAS = SCHEMAS;
  global.getCryptoSchema = getCryptoSchema;
  global.getCryptoSchemaForModule = getCryptoSchemaForModule;
  global.CRYPTO_MODULE_SCHEMA = MODULE_DEFAULT;
})(typeof window !== "undefined" ? window : global);
