/**
 * TORINVEST — Configuration centralisée KRM Economy
 * -------------------------------------------------
 * Modifier ici UNIQUEMENT :
 * - KRM_SERVICES_TREASURY (pubkey Solana qui reçoit les paiements)
 * - KRM_SERVICES (noms + montants)
 *
 * Aucune private key. Aucune seed. Aucune adresse inventée.
 * Tant que KRM_SERVICES_TREASURY === "", les paiements on-chain sont désactivés.
 */
(function (global) {
  "use strict";

  var KRM_DECIMALS = 6;

  var KRM_SERVICES = {
    trade_idea_review: {
      name: "Revue pédagogique d'une idée de trade",
      amountKrm: 50,
    },
    trade_debrief: {
      name: "Débrief pédagogique d'un trade",
      amountKrm: 100,
    },
  };

  /**
   * Wallet Treasury (PUBLIC KEY Solana uniquement).
   * Laisser "" jusqu'à validation du wallet de réception.
   * Renseigner ici ET dans api/config.local.php → krm_services_treasury
   */
  var KRM_SERVICES_TREASURY = "HVh9oAtjQ9fghqB8mLCauJKqFgjJMorwg8216vQQCzNs";

  function amountKrmToRaw(amountKrm) {
    var n = Number(amountKrm);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      throw new Error("Montant KRM invalide (entier UI requis) : " + amountKrm);
    }
    return BigInt(n) * 10n ** BigInt(KRM_DECIMALS);
  }

  function rawToAmountKrm(raw) {
    var r = typeof raw === "bigint" ? raw : BigInt(raw);
    var base = 10n ** BigInt(KRM_DECIMALS);
    var whole = r / base;
    var frac = r % base;
    if (frac === 0n) return Number(whole);
    var fracStr = frac.toString().padStart(KRM_DECIMALS, "0").replace(/0+$/, "");
    return Number(whole.toString() + "." + fracStr);
  }

  /** Lien d'achat KRM (Jupiter) — même mint officiel. */
  var KRM_BUY_URL =
    "https://jup.ag/tokens/Cvx4uEQUHgkrNR1apuz8eBSbWVFDwKhPFGFJn3XcBBwA";

  global.TORINVEST_KRM = {
    KRM_MINT: "Cvx4uEQUHgkrNR1apuz8eBSbWVFDwKhPFGFJn3XcBBwA",
    KRM_DECIMALS: KRM_DECIMALS,
    /** Public key Treasury — modifier ici (jamais de private key). */
    KRM_SERVICES_TREASURY: KRM_SERVICES_TREASURY,
    KRM_SERVICES: KRM_SERVICES,
    KRM_BUY_URL: KRM_BUY_URL,
    TOKEN_PROGRAM_ID: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    ASSOCIATED_TOKEN_PROGRAM_ID: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
    EXPLORER_TX_BASE: "https://explorer.solana.com/tx/",
    amountKrmToRaw: amountKrmToRaw,
    rawToAmountKrm: rawToAmountKrm,
    isTreasuryConfigured: function () {
      var t = global.TORINVEST_KRM.KRM_SERVICES_TREASURY;
      return typeof t === "string" && t.trim() !== "";
    },
    getService: function (serviceId) {
      return KRM_SERVICES[serviceId] || null;
    },
    listServices: function () {
      return Object.keys(KRM_SERVICES).map(function (id) {
        var s = KRM_SERVICES[id];
        return {
          id: id,
          name: s.name,
          amountKrm: s.amountKrm,
          amountRaw: amountKrmToRaw(s.amountKrm).toString(),
        };
      });
    },
  };
})(typeof window !== "undefined" ? window : global);
