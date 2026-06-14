/**
 * TorPass — Phantom connect, soldes KRM/ORAX, signature wallet pour /access-code.
 */
(function () {
  "use strict";

  var WORKER_ACCESS_URL =
    (window.TORINVEST_WORKER && window.TORINVEST_WORKER.baseUrl
      ? window.TORINVEST_WORKER.baseUrl
      : "https://morning-hall-d8f6.onzerimes.workers.dev") + "/access-code";

  window.TorinvestTorpass = {
    WORKER_ACCESS_URL: WORKER_ACCESS_URL,
    KRM_MINT: "Cvx4uEQUHgkrNR1apuz8eBSbWVFDwKhPFGFJn3XcBBwA",
    ORAX_MINT: "Ej5okcJb5oncGiZ7w53SgjCD9n4M7C3Uhzp1Lstxpump",
    MIN_KRM: 40000,
    MIN_ORAX: 2000000,

    getPhantomProvider: function () {
      var p = window.phantom && window.phantom.solana;
      if (p && p.isPhantom) return p;
      if (window.solana && window.solana.isPhantom) return window.solana;
      return null;
    },

    /** Attend que Phantom injecte window.phantom (évite connect trop tôt). */
    waitForPhantomProvider: function (timeoutMs) {
      var self = this;
      timeoutMs = timeoutMs || 5000;
      return new Promise(function (resolve, reject) {
        var start = Date.now();
        (function poll() {
          var p = self.getPhantomProvider();
          if (p) return resolve(p);
          if (Date.now() - start >= timeoutMs) {
            return reject(
              new Error(
                "Phantom non détecté. Installe l'extension, déverrouille-la, puis Ctrl+F5."
              )
            );
          }
          setTimeout(poll, 150);
        })();
      });
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

    /** Connexion Phantom — connect() doit être appelé sans await préalable (user gesture). */
    connectWallet: function (provider) {
      if (provider.isConnected && provider.publicKey) {
        return Promise.resolve(this.pubkeyFromConnectResult(provider, null));
      }
      return provider.connect().then(
        function (resp) {
          var pubkey = window.TorinvestTorpass.pubkeyFromConnectResult(provider, resp);
          if (pubkey) return pubkey;
          throw new Error("Connexion Phantom sans clé publique.");
        }
      );
    },

    /** Après connect réussi : soldes (helper optionnel). */
    finishAfterConnect: async function (pubkey) {
      var balances = await this.readBalances(pubkey);
      return { wallet: pubkey, balances: balances };
    },

    formatConnectError: function (err) {
      var msg = err && err.message ? err.message : String(err);
      if (/unexpected error/i.test(msg)) {
        return (
          msg +
          "\n\nCorrectifs Phantom (dans l'ordre) :\n" +
          "1. Ctrl+F5 pour rafraîchir la page\n" +
          "2. Déverrouille Phantom (mot de passe extension)\n" +
          "3. chrome://extensions → Phantom → bouton Recharger\n" +
          "4. Désactive temporairement MetaMask / autres wallets Solana\n" +
          "5. Ferme le panneau Phantom latéral, puis reclique sur Connecter"
        );
      }
      return msg;
    },

    buildSignMessage: function (wallet, timestampMs) {
      return (
        "TORINVEST TorPass Verification V1\nWallet: " +
        wallet +
        "\nTimestamp: " +
        timestampMs
      );
    },

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

    /** Demande à Phantom de signer la preuve de propriété du wallet. */
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

    /** Connecte Phantom, vérifie soldes, signe et récupère le code FORGE. */
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
            return self.requestForgeCode(
              proof.wallet,
              proof.signature,
              proof.timestamp
            ).then(function (codeResp) {
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
