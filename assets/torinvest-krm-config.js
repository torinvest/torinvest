/**
 * TORINVEST — Configuration centralisée KRM Economy
 * -------------------------------------------------
 * Modifier ici UNIQUEMENT :
 * - KRM_SERVICES_TREASURY (pubkey Solana qui reçoit les paiements)
 * - KRM_SERVICES (noms + montants)
 * - RAYDIUM_CONFIG (mint / pool / liens d’achat)
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
   * Laisser "" jusqu’à validation du wallet de réception.
   * Renseigner ici ET dans api/config.local.php → krm_services_treasury
   */
  var KRM_SERVICES_TREASURY = "HVh9oAtjQ9fghqB8mLCauJKqFgjJMorwg8216vQQCzNs";

  /**
   * Marché officiel KRM (Solana Mainnet) — source unique des adresses.
   * Ne pas dupliquer ailleurs.
   */
  var RAYDIUM_CONFIG = {
    network: "mainnet",
    krmMint: "Cvx4uEQUHgkrNR1apuz8eBSbWVFDwKhPFGFJn3XcBBwA",
    usdcMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    poolId: "BLXPTAFedmjRHKrkZp42pd6vUs4gTR8sLGJFStNR7iWZ",
    marketLabel: "Raydium KRM / USDC",
  };

  /** Swap Raydium prérempli USDC → KRM (pool TORINVEST). */
  var KRM_POOL_URL =
    "https://raydium.io/swap/?inputMint=" +
    RAYDIUM_CONFIG.usdcMint +
    "&outputMint=" +
    RAYDIUM_CONFIG.krmMint;

  /** Lien secondaire Jupiter (fallback / alternative). */
  var KRM_BUY_URL =
    "https://jup.ag/swap/SOL-" + RAYDIUM_CONFIG.krmMint;

  /** URL principale « Acheter des KRM » → Raydium. */
  var KRM_BUY_PRIMARY_URL = KRM_POOL_URL;

  var KRM_BETA_LIQUIDITY_NOTE =
    "KRM Economy est actuellement en phase BETA. La liquidité du marché est limitée et le prix peut varier fortement lors d’un achat ou d’une vente.";

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

  global.TORINVEST_KRM = {
    KRM_MINT: RAYDIUM_CONFIG.krmMint,
    KRM_DECIMALS: KRM_DECIMALS,
    /** Public key Treasury — modifier ici (jamais de private key). */
    KRM_SERVICES_TREASURY: KRM_SERVICES_TREASURY,
    KRM_SERVICES: KRM_SERVICES,
    RAYDIUM_CONFIG: RAYDIUM_CONFIG,
    KRM_BUY_URL: KRM_BUY_URL,
    KRM_POOL_URL: KRM_POOL_URL,
    KRM_BUY_PRIMARY_URL: KRM_BUY_PRIMARY_URL,
    KRM_BETA_LIQUIDITY_NOTE: KRM_BETA_LIQUIDITY_NOTE,
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
    getRaydiumSwapUrl: function () {
      return global.TORINVEST_KRM.KRM_BUY_PRIMARY_URL || KRM_POOL_URL;
    },
  };
})(typeof window !== "undefined" ? window : global);
