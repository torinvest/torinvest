/**
 * TorPass — KRM ECONOMY BETA V1
 * Niveaux d'accès basés uniquement sur le solde KRM (détention, non consommé).
 * ORAX reste disponible pour d'autres flux (premium/forge legacy) mais n'entre
 * plus dans le calcul des niveaux TorPass.
 */
(function () {
  "use strict";

  var WORKER_ACCESS_URL =
    (window.TORINVEST_WORKER && window.TORINVEST_WORKER.baseUrl
      ? window.TORINVEST_WORKER.baseUrl
      : "https://morning-hall-d8f6.onzerimes.workers.dev") + "/access-code";

  /** Seuils TorPass — modifier ici uniquement pour changer les niveaux. */
  var TORPASS_LEVELS = {
    PUBLIC: 0,
    COMMUNITY: 100,
    ACADEMY: 250,
    COACHING: 500,
  };

  var LEVEL_ORDER = ["PUBLIC", "COMMUNITY", "ACADEMY", "COACHING"];

  var LEVEL_META = {
    PUBLIC: {
      label: "PUBLIC",
      access: {
        public: true,
        discord: false,
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
        formations: false,
        coaching: false,
      },
      perks: ["Contenu public", "Discord privé"],
    },
    ACADEMY: {
      label: "ACADEMY",
      access: {
        public: true,
        discord: true,
        formations: true,
        coaching: false,
      },
      perks: ["Contenu public", "Discord privé", "Formations en ligne"],
    },
    COACHING: {
      label: "COACHING",
      access: {
        public: true,
        discord: true,
        formations: true,
        coaching: true,
      },
      perks: [
        "Contenu public",
        "Discord privé",
        "Formations en ligne",
        "Espace accompagnement / coaching",
      ],
    },
  };

  /**
   * Services ponctuels — montants centralisés dans TORINVEST_KRM.KRM_SERVICES
   * (assets/torinvest-krm-config.js). Pas de duplication des prix.
   */
  function listTorpassServices() {
    if (window.TORINVEST_KRM && typeof window.TORINVEST_KRM.listServices === "function") {
      return window.TORINVEST_KRM.listServices().map(function (s) {
        return { id: s.id, name: s.name, priceKrm: s.amountKrm };
      });
    }
    return [];
  }

  window.TorinvestTorpass = {
    WORKER_ACCESS_URL: WORKER_ACCESS_URL,
    KRM_MINT: "Cvx4uEQUHgkrNR1apuz8eBSbWVFDwKhPFGFJn3XcBBwA",
    /** Conservé pour d'autres pages ; non utilisé pour les niveaux TorPass V1. */
    ORAX_MINT: "Ej5okcJb5oncGiZ7w53SgjCD9n4M7C3Uhzp1Lstxpump",
    KRM_DECIMALS: 6,
    TORPASS_LEVELS: TORPASS_LEVELS,
    LEVEL_ORDER: LEVEL_ORDER,
    LEVEL_META: LEVEL_META,
    get TORPASS_SERVICES() {
      return listTorpassServices();
    },

    /** Legacy forge / premium — ne pas utiliser pour les niveaux TorPass V1. */
    MIN_KRM: 40000,
    MIN_ORAX: 2000000,

    getPhantomProvider: function () {
      var p = window.phantom && window.phantom.solana;
      if (p && p.isPhantom) return p;
      return null;
    },

    pubkeyFromConnectResult: function (provider, resp) {
      if (resp && resp.publicKey) {
        return resp.publicKey.toString
          ? resp.publicKey.toString()
          : String(resp.publicKey);
      }
      if (provider.publicKey) {
        return provider.publicKey.toString
          ? provider.publicKey.toString()
          : String(provider.publicKey);
      }
      return null;
    },

    /** Connexion Phantom — connect() puis fallback request(). */
    connectWallet: function (provider) {
      if (provider.isConnected && provider.publicKey) {
        return Promise.resolve(this.pubkeyFromConnectResult(provider, null));
      }
      var self = this;
      return provider
        .connect()
        .then(function (resp) {
          var pk = self.pubkeyFromConnectResult(provider, resp);
          if (pk) return pk;
          throw new Error("Connexion Phantom sans clé publique.");
        })
        .catch(function (err) {
          if (err && err.code === 4001) throw err;
          if (typeof provider.request !== "function") throw err;
          return provider.request({ method: "connect" }).then(function (resp) {
            var pk = self.pubkeyFromConnectResult(provider, resp);
            if (pk) return pk;
            throw err;
          });
        });
    },

    finishAfterConnect: async function (pubkey) {
      var balances = await this.readBalances(pubkey);
      return { wallet: pubkey, balances: balances };
    },

    formatConnectError: function (err) {
      var msg = err && err.message ? err.message : String(err);
      if (this.isEdgeBrowser && this.isEdgeBrowser()) {
        return msg + "\n\n" + this.edgeTorpassHint();
      }
      if (/unexpected error/i.test(msg)) {
        return (
          msg +
          "\n\nEssaye Opera ou Firefox. Sur Edge, Phantom échoue souvent à se connecter."
        );
      }
      return msg;
    },

    isEdgeBrowser: function () {
      return /Edg\//.test(navigator.userAgent || "");
    },

    edgeTorpassHint: function () {
      return (
        "Microsoft Edge + Phantom : connexion souvent impossible (Unexpected error). " +
        "TorPass fonctionne sur Opera et Firefox. Ouvre torinvest-trading.com/torpass dans Opera."
      );
    },

    showEdgeBanner: function (elementId) {
      if (!this.isEdgeBrowser()) return;
      var el = document.getElementById(elementId);
      if (!el) return;
      el.style.display = "block";
      el.textContent = "⚠ " + this.edgeTorpassHint();
    },

    buildSignMessage: function (wallet, timestampMs) {
      return (
        "TORINVEST TorPass Verification V1\nWallet: " +
        wallet +
        "\nTimestamp: " +
        timestampMs
      );
    },

    /**
     * Convertit un montant UI (ou raw+decimals) en nombre KRM.
     * Les lectures RPC utilisent déjà uiAmount (6 décimales KRM).
     */
    normalizeKrmAmount: function (uiAmount, rawAmount, decimals) {
      if (uiAmount != null && uiAmount !== "") {
        var n = Number(uiAmount);
        if (!isNaN(n) && isFinite(n)) return n;
      }
      if (rawAmount != null && rawAmount !== "") {
        var dec = decimals != null ? Number(decimals) : this.KRM_DECIMALS;
        var raw = Number(rawAmount);
        if (!isNaN(raw) && isFinite(raw)) return raw / Math.pow(10, dec);
      }
      return 0;
    },

    formatKrm: function (amount) {
      var n = Number(amount);
      if (isNaN(n) || !isFinite(n)) n = 0;
      return n.toLocaleString("fr-FR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: this.KRM_DECIMALS,
      });
    },

    /** Niveau TorPass à partir du solde KRM uniquement. */
    getLevelFromBalance: function (krmBalance) {
      var bal = Number(krmBalance) || 0;
      var levels = this.TORPASS_LEVELS;
      if (bal >= levels.COACHING) return "COACHING";
      if (bal >= levels.ACADEMY) return "ACADEMY";
      if (bal >= levels.COMMUNITY) return "COMMUNITY";
      return "PUBLIC";
    },

    getLevelMeta: function (levelKey) {
      return this.LEVEL_META[levelKey] || this.LEVEL_META.PUBLIC;
    },

    getAccessForBalance: function (krmBalance) {
      var level = this.getLevelFromBalance(krmBalance);
      return this.getLevelMeta(level).access;
    },

    /**
     * Infos prochain niveau + KRM manquants.
     * null si niveau max (COACHING) atteint.
     */
    getNextLevelInfo: function (krmBalance) {
      var bal = Number(krmBalance) || 0;
      var current = this.getLevelFromBalance(bal);
      var idx = this.LEVEL_ORDER.indexOf(current);
      if (idx < 0 || idx >= this.LEVEL_ORDER.length - 1) {
        return null;
      }
      var nextKey = this.LEVEL_ORDER[idx + 1];
      var threshold = this.TORPASS_LEVELS[nextKey];
      var missing = Math.max(0, threshold - bal);
      // Arrondi à 6 décimales pour éviter les artefacts float
      missing =
        Math.round(missing * Math.pow(10, this.KRM_DECIMALS)) /
        Math.pow(10, this.KRM_DECIMALS);
      return {
        key: nextKey,
        label: this.getLevelMeta(nextKey).label,
        threshold: threshold,
        missing: missing,
      };
    },

    isMaxLevel: function (krmBalance) {
      return this.getLevelFromBalance(krmBalance) === "COACHING";
    },

    getServiceById: function (serviceId) {
      if (window.TORINVEST_KRM && window.TORINVEST_KRM.getService) {
        var s = window.TORINVEST_KRM.getService(serviceId);
        if (!s) return null;
        return { id: serviceId, name: s.name, priceKrm: s.amountKrm };
      }
      var list = listTorpassServices();
      var i;
      for (i = 0; i < list.length; i++) {
        if (list[i].id === serviceId) return list[i];
      }
      return null;
    },

    /** Vérifie le solde UI pour un service. */
    canAffordService: function (krmBalance, serviceId) {
      var service = this.getServiceById(serviceId);
      if (!service) return false;
      return (Number(krmBalance) || 0) >= service.priceKrm;
    },

    /**
     * Snapshot TorPass V1 à partir d'un solde KRM.
     */
    buildStatus: function (krmBalance) {
      var bal = Number(krmBalance) || 0;
      var level = this.getLevelFromBalance(bal);
      var meta = this.getLevelMeta(level);
      var next = this.getNextLevelInfo(bal);
      return {
        krm: bal,
        level: level,
        label: meta.label,
        access: meta.access,
        perks: meta.perks.slice(),
        next: next,
        isMax: !next,
      };
    },

    /** Lecture solde KRM seul (niveaux TorPass V1). */
    readKrmBalance: function (wallet) {
      var self = this;
      if (!window.TorinvestSolana) {
        return Promise.reject(new Error("TorinvestSolana non chargé"));
      }
      return window.TorinvestSolana.readMintBalance(wallet, this.KRM_MINT).then(
        function (amount) {
          return self.normalizeKrmAmount(amount, null, self.KRM_DECIMALS);
        }
      );
    },

    /** Lecture KRM + ORAX (legacy premium / forge). */
    readBalances: function (wallet) {
      if (!window.TorinvestSolana) {
        return Promise.reject(new Error("TorinvestSolana non chargé"));
      }
      return window.TorinvestSolana.readKrmOrax(
        wallet,
        this.KRM_MINT,
        this.ORAX_MINT
      );
    },

    /** Legacy : accès forge/premium (KRM + ORAX). Non utilisé pour TorPass V1. */
    hasAccess: function (balances) {
      return balances.krm >= this.MIN_KRM && balances.orax >= this.MIN_ORAX;
    },

    signatureToHex: function (signature) {
      return Array.from(signature)
        .map(function (b) {
          return b.toString(16).padStart(2, "0");
        })
        .join("");
    },

    signAccessProof: async function (provider, wallet) {
      var timestamp = Date.now();
      var message = this.buildSignMessage(wallet, timestamp);
      var encoded = new TextEncoder().encode(message);
      var result;
      try {
        result = await provider.signMessage(encoded, "utf8");
      } catch (e1) {
        try {
          result = await provider.signMessage(encoded, { display: "utf8" });
        } catch (e2) {
          result = await provider.signMessage(message, "utf8");
        }
      }
      var sig = result && (result.signature || result);
      if (!sig || typeof sig.length !== "number") {
        throw new Error("Signature Phantom invalide.");
      }
      return {
        wallet: wallet,
        timestamp: timestamp,
        signature: this.signatureToHex(sig),
      };
    },

    requestForgeCode: async function (wallet, signature, timestamp) {
      var resp = await fetch(this.WORKER_ACCESS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          wallet: wallet,
          signature: signature,
          timestamp: timestamp,
        }),
      });
      var text = await resp.text();
      var data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = { ok: false, error: text.slice(0, 200) };
      }
      data._httpStatus = resp.status;
      return data;
    },

    verifyAndRequestForgeCode: function (provider) {
      var self = this;
      return this.connectWallet(provider).then(function (wallet) {
        return self.readBalances(wallet).then(function (balances) {
          if (!self.hasAccess(balances)) {
            return {
              ok: false,
              wallet: wallet,
              balances: balances,
              reason: "insufficient",
            };
          }
          return self.signAccessProof(provider, wallet).then(function (proof) {
            return self
              .requestForgeCode(proof.wallet, proof.signature, proof.timestamp)
              .then(function (codeResp) {
                return {
                  ok: !!codeResp.ok,
                  wallet: wallet,
                  balances: balances,
                  code: codeResp.code || null,
                  reused: !!codeResp.reused,
                  error: codeResp.error || null,
                  message: codeResp.message || null,
                  _httpStatus: codeResp._httpStatus,
                };
              });
          });
        });
      });
    },
  };
})();
