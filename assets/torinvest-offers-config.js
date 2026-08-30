/**
 * TORINVEST — Offres commerciales + TorPass + mode de pricing (centralisé).
 * --------------------------------------------------------------------------
 * Modifier ICI pour changer :
 * - PRICING_MODE (PUBLIC_PROMO | MEMBER_PRICING | REGULAR)
 * - prix € Robot / Formation
 * - seuils TorPass
 * - libellés avantages
 *
 * Ne PAS y mettre de private key.
 * Les services KRM ponctuels (50/100) restent dans torinvest-krm-config.js.
 */
(function (global) {
  "use strict";

  /**
   * PUBLIC_PROMO  → tout le monde voit promoPrice (79 / 349), aucun KRM requis
   * MEMBER_PRICING → public = regularPrice ; ACADEMY/PRO = memberPrice selon offre
   * REGULAR       → regularPrice pour tous (sauf si memberPrice explicitement activé)
   */
  var PRICING_MODE = "PUBLIC_PROMO";

  var TORPASS_LEVELS = {
    PUBLIC: 0,
    COMMUNITY: 100,
    ACADEMY: 250,
    PRO: 500,
  };

  /** Alias rétrocompat (ancien nom COACHING = PRO). */
  TORPASS_LEVELS.COACHING = TORPASS_LEVELS.PRO;

  var LEVEL_ORDER = ["PUBLIC", "COMMUNITY", "ACADEMY", "PRO"];

  var LEVEL_META = {
    PUBLIC: {
      label: "PUBLIC",
      access: {
        public: true,
        discord: false,
        memberFormation: false,
        memberRobot: false,
        accompagnement: false,
        // aliases legacy (éligibilité, PAS accès gratuit produit)
        formations: false,
        coaching: false,
      },
      perks: ["Contenu public"],
    },
    COMMUNITY: {
      label: "COMMUNITY",
      access: {
        public: true,
        discord: true,
        memberFormation: false,
        memberRobot: false,
        accompagnement: false,
        formations: false,
        coaching: false,
      },
      perks: ["Discord privé"],
    },
    ACADEMY: {
      label: "ACADEMY",
      access: {
        public: true,
        discord: true,
        memberFormation: true,
        memberRobot: false,
        accompagnement: false,
        formations: true,
        coaching: false,
      },
      perks: [
        "Discord privé",
        "Statut Academy",
        "Avantages membres liés à la Formation",
      ],
    },
    PRO: {
      label: "PRO",
      access: {
        public: true,
        discord: true,
        memberFormation: true,
        memberRobot: true,
        accompagnement: true,
        formations: true,
        coaching: true,
      },
      perks: [
        "Discord privé",
        "Statut Academy",
        "Statut Pro",
        "Avantages membres Robot Access",
        "Accompagnement / avantages Pro",
      ],
    },
  };
  LEVEL_META.COACHING = LEVEL_META.PRO;

  var TORINVEST_OFFERS = {
    ROBOT: {
      id: "ROBOT",
      name: "Robot Access",
      billing: "month",
      regularPrice: 149,
      promoPrice: 79,
      memberPrice: 79,
      requiredKrmLevel: "PRO",
      requiredKrm: TORPASS_LEVELS.PRO,
      stripePaymentLink: "https://buy.stripe.com/eVq14nclt5XV3ka0zFd7q02",
      /** Paiement Stripe temporairement fermé — le bloc offre reste visible. */
      checkoutPaused: true,
      pausedMessage: "En pause actuellement",
      currency: "EUR",
      unitLabel: "/mois",
    },
    FORMATION: {
      id: "FORMATION",
      name: "Formation Trading",
      billing: "year",
      regularPrice: 499,
      promoPrice: 349,
      memberPrice: 349,
      requiredKrmLevel: "ACADEMY",
      requiredKrm: TORPASS_LEVELS.ACADEMY,
      stripePaymentLink: "https://buy.stripe.com/aFabJ10CLeurf2S827d7q01",
      currency: "EUR",
      unitLabel: "/an",
    },
  };

  var LEVEL_RANK = { PUBLIC: 0, COMMUNITY: 1, ACADEMY: 2, PRO: 3, COACHING: 3 };

  function levelRank(key) {
    var r = LEVEL_RANK[key];
    return r == null ? 0 : r;
  }

  function getLevelFromBalance(krmBalance) {
    var bal = Number(krmBalance) || 0;
    if (bal >= TORPASS_LEVELS.PRO) return "PRO";
    if (bal >= TORPASS_LEVELS.ACADEMY) return "ACADEMY";
    if (bal >= TORPASS_LEVELS.COMMUNITY) return "COMMUNITY";
    return "PUBLIC";
  }

  /**
   * Résout le prix affiché / applicable pour une offre.
   * @param {string} offerId ROBOT | FORMATION
   * @param {string|null} torpassLevel niveau wallet (null = visiteur public)
   */
  function currentPricingMode() {
    if (
      global.TORINVEST_OFFERS_CONFIG &&
      global.TORINVEST_OFFERS_CONFIG.PRICING_MODE
    ) {
      return String(global.TORINVEST_OFFERS_CONFIG.PRICING_MODE);
    }
    return PRICING_MODE;
  }

  function isOfferCheckoutPaused(offerId) {
    var offer = TORINVEST_OFFERS[offerId];
    return !!(offer && offer.checkoutPaused);
  }

  function checkoutStripeLink(offer) {
    if (!offer || offer.checkoutPaused) return null;
    return offer.stripePaymentLink || null;
  }

  /**
   * Applique pause ou lien Stripe sur un CTA (bouton / lien d’achat).
   * @param {HTMLElement} linkEl
   * @param {object} resolved résultat resolveOfferPrice
   * @param {{ activeLabel?: string }} options activeLabel = libellé quand le paiement est ouvert
   */
  function applyCheckoutLink(linkEl, resolved, options) {
    options = options || {};
    if (!linkEl || !resolved || !resolved.ok) return;
    if (resolved.paused) {
      linkEl.removeAttribute("href");
      linkEl.removeAttribute("target");
      linkEl.removeAttribute("rel");
      linkEl.setAttribute("aria-disabled", "true");
      linkEl.classList.add("checkout-paused");
      linkEl.textContent = resolved.pausedMessage || "En pause actuellement";
      linkEl.style.pointerEvents = "none";
      linkEl.style.opacity = "0.65";
      linkEl.style.cursor = "not-allowed";
      return;
    }
    linkEl.classList.remove("checkout-paused");
    linkEl.removeAttribute("aria-disabled");
    linkEl.style.pointerEvents = "";
    linkEl.style.opacity = "";
    linkEl.style.cursor = "";
    if (options.activeLabel) linkEl.textContent = options.activeLabel;
    if (resolved.stripePaymentLink) {
      linkEl.href = resolved.stripePaymentLink;
      linkEl.target = "_blank";
      linkEl.rel = "noopener";
    }
  }

  function resolveOfferPrice(offerId, torpassLevel) {
    var offer = TORINVEST_OFFERS[offerId];
    if (!offer) {
      return { ok: false, error: "UNKNOWN_OFFER" };
    }
    var mode = currentPricingMode();
    var level = torpassLevel || "PUBLIC";
    var memberOk =
      levelRank(level) >= levelRank(offer.requiredKrmLevel);
    var paused = isOfferCheckoutPaused(offerId);
    var stripeLink = checkoutStripeLink(offer);
    var pausedMessage = offer.pausedMessage || "En pause actuellement";

    if (mode === "PUBLIC_PROMO") {
      return {
        ok: true,
        offerId: offerId,
        mode: mode,
        displayPrice: offer.promoPrice,
        compareAtPrice: offer.regularPrice,
        badge: "OFFRE DE LANCEMENT — aucun KRM requis",
        krmRequiredNow: false,
        memberEligible: memberOk,
        unitLabel: offer.unitLabel,
        paused: paused,
        pausedMessage: pausedMessage,
        stripePaymentLink: stripeLink,
        advantageText: "Offre de lancement : aucun KRM requis.",
        futureAdvantageText:
          "Les membres TorPass bénéficieront d’avantages spécifiques après la période de lancement.",
        /** Préparé pour MEMBER_PRICING (non activé tant que PUBLIC_PROMO). */
        memberPricingPreview:
          offerId === "ROBOT"
            ? "Tarif membre PRO : " +
              offer.memberPrice +
              " €/mois (≥ " +
              offer.requiredKrm +
              " KRM)."
            : "Tarif membre ACADEMY : " +
              offer.memberPrice +
              " €/an (≥ " +
              offer.requiredKrm +
              " KRM).",
      };
    }

    if (mode === "MEMBER_PRICING") {
      if (memberOk) {
        return {
          ok: true,
          offerId: offerId,
          mode: mode,
          displayPrice: offer.memberPrice,
          compareAtPrice: offer.regularPrice,
          badge: "Tarif membre " + offer.requiredKrmLevel,
          krmRequiredNow: true,
          memberEligible: true,
          unitLabel: offer.unitLabel,
          paused: paused,
          pausedMessage: pausedMessage,
          stripePaymentLink: stripeLink,
          advantageText:
            offerId === "ROBOT"
              ? "Tarif membre PRO : " +
                offer.memberPrice +
                " €/mois — nécessite ≥ " +
                offer.requiredKrm +
                " KRM au moment de l’achat ou du renouvellement."
              : "Tarif membre ACADEMY : " +
                offer.memberPrice +
                " €/an — nécessite ≥ " +
                offer.requiredKrm +
                " KRM au moment de l’achat ou du renouvellement.",
          futureAdvantageText: "",
        };
      }
      return {
        ok: true,
        offerId: offerId,
        mode: mode,
        displayPrice: offer.regularPrice,
        compareAtPrice: null,
        badge: "Tarif public",
        krmRequiredNow: false,
        memberEligible: false,
        unitLabel: offer.unitLabel,
        paused: paused,
        pausedMessage: pausedMessage,
        stripePaymentLink: stripeLink,
        advantageText:
          "Tarif public. Détiens ≥ " +
          offer.requiredKrm +
          " KRM (" +
          offer.requiredKrmLevel +
          ") pour le tarif membre " +
          offer.memberPrice +
          " €" +
          offer.unitLabel +
          " à l’achat / renouvellement.",
        futureAdvantageText: "",
      };
    }

    // REGULAR
    return {
      ok: true,
      offerId: offerId,
      mode: mode,
      displayPrice: offer.regularPrice,
      compareAtPrice: null,
      badge: "Tarif normal",
      krmRequiredNow: false,
      memberEligible: memberOk,
      unitLabel: offer.unitLabel,
      paused: paused,
      pausedMessage: pausedMessage,
      stripePaymentLink: stripeLink,
      advantageText: "Tarif normal. Les avantages TorPass membres ne sont pas actifs (mode REGULAR).",
      futureAdvantageText:
        "Configurer PRICING_MODE = MEMBER_PRICING pour activer les tarifs membres KRM.",
    };
  }

  /**
   * Vérifie l’éligibilité au tarif membre au moment d’un achat / renouvellement.
   * Ne doit PAS servir à révoquer un abonnement déjà payé.
   */
  function canUseMemberPriceAtCheckout(offerId, krmBalance) {
    var offer = TORINVEST_OFFERS[offerId];
    if (!offer) return { ok: false, eligible: false, error: "UNKNOWN_OFFER" };
    var mode = currentPricingMode();
    if (mode === "PUBLIC_PROMO") {
      return {
        ok: true,
        eligible: true,
        krmRequired: false,
        reason: "PUBLIC_PROMO",
        level: getLevelFromBalance(krmBalance),
      };
    }
    if (mode !== "MEMBER_PRICING") {
      return {
        ok: true,
        eligible: false,
        krmRequired: false,
        reason: "MEMBER_PRICING_OFF",
        level: getLevelFromBalance(krmBalance),
      };
    }
    var level = getLevelFromBalance(krmBalance);
    var eligible = levelRank(level) >= levelRank(offer.requiredKrmLevel);
    return {
      ok: true,
      eligible: eligible,
      krmRequired: true,
      reason: eligible ? "MEMBER_OK" : "INSUFFICIENT_KRM",
      level: level,
      requiredKrm: offer.requiredKrm,
      requiredKrmLevel: offer.requiredKrmLevel,
      balance: Number(krmBalance) || 0,
    };
  }

  /**
   * Abonnements € (séparés du niveau KRM).
   * Par défaut NON ABONNÉ — brancher plus tard sur l’API licences.
   * Override localStorage optionnel (tests UX) :
   *   torinvest_sub_formation = "1"
   *   torinvest_sub_robot = "1"
   */
  function readLocalSubFlag(key) {
    try {
      if (typeof global.localStorage === "undefined") return false;
      return global.localStorage.getItem(key) === "1";
    } catch (e) {
      return false;
    }
  }

  function getClientSubscriptions(/* wallet */) {
    return {
      formationActive: readLocalSubFlag("torinvest_sub_formation"),
      robotActive: readLocalSubFlag("torinvest_sub_robot"),
      source: "local_stub",
    };
  }

  global.TORINVEST_OFFERS_CONFIG = {
    PRICING_MODE: PRICING_MODE,
    TORPASS_LEVELS: TORPASS_LEVELS,
    LEVEL_ORDER: LEVEL_ORDER,
    LEVEL_META: LEVEL_META,
    TORINVEST_OFFERS: TORINVEST_OFFERS,
    getLevelFromBalance: getLevelFromBalance,
    levelRank: levelRank,
    resolveOfferPrice: resolveOfferPrice,
    isOfferCheckoutPaused: isOfferCheckoutPaused,
    applyCheckoutLink: applyCheckoutLink,
    canUseMemberPriceAtCheckout: canUseMemberPriceAtCheckout,
    getClientSubscriptions: getClientSubscriptions,
    DISCLAIMER:
      "Les niveaux TorPass donnent des droits et avantages dans l’écosystème TORINVEST. Ils ne remplacent pas l’achat des produits payants.",
    HOLD_VS_SPEND: {
      holdTitle: "DÉTENIR DES KRM",
      holdSubtitle: "= niveau TorPass",
      spendTitle: "DÉPENSER DES KRM",
      spendSubtitle: "= services ponctuels",
    },
    HOW_KRM_WORKS_STEPS: [
      {
        title: "ACHÈTE OU DÉTIENS DES KRM",
        body: "Les KRM peuvent être obtenus sur Raydium avec un wallet Solana.",
      },
      {
        title: "DÉBLOQUE TON TORPASS",
        body:
          "100 KRM → Discord privé · 250 KRM → Academy · 500 KRM → Pro. Les KRM nécessaires au niveau restent dans ton wallet. Ils ne sont pas consommés.",
      },
      {
        title: "UTILISE DES KRM",
        body:
          "Certains services ponctuels peuvent être payés directement en KRM. 50 KRM → revue pédagogique d’une idée de trade · 100 KRM → débrief pédagogique d’un trade.",
      },
    ],
    /** Compat affichage liste simple. */
    HOW_KRM_WORKS: [
      "Achète ou détiens des KRM (Raydium / wallet Solana)",
      "Débloque ton TorPass (100 / 250 / 500) — KRM non consommés",
      "Utilise des KRM pour des services ponctuels (50 / 100)",
    ],
  };
})(typeof window !== "undefined" ? window : global);
