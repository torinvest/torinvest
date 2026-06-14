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
      if ("phantom" in window) {
        var p = window.phantom && window.phantom.solana;
        if (p && p.isPhantom) return p;
      }
      if (window.solana && window.solana.isPhantom) return window.solana;
      return null;
    },

    /** Connexion Phantom robuste (déjà connecté, popup fermée, etc.). */
    connectWallet: async function (provider) {
      if (provider.isConnected && provider.publicKey) {
        return provider.publicKey.toString();
      }
      try {
        var resp = await provider.connect();
        if (resp && resp.publicKey) return resp.publicKey.toString();
        if (provider.publicKey) return provider.publicKey.toString();
        throw new Error("Connexion Phantom sans clé publique.");
      } catch (err) {
        if (err && err.code === 4001) throw err;
        if (provider.isConnected && provider.publicKey) {
          return provider.publicKey.toString();
        }
        throw err;
      }
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
    verifyAndRequestForgeCode: async function (provider) {
      var wallet = await this.connectWallet(provider);
      var balances = await this.readBalances(wallet);
      if (!this.hasAccess(balances)) {
        return {
          ok: false,
          wallet: wallet,
          balances: balances,
          reason: "insufficient",
        };
      }
      var proof = await this.signAccessProof(provider, wallet);
      var codeResp = await this.requestForgeCode(
        proof.wallet,
        proof.signature,
        proof.timestamp
      );
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
    },
  };
})();
