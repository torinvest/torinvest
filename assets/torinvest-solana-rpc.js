/**
 * TorPass — RPC Solana via proxy Helius (same-origin /api/solana-rpc.php).
 * Lecture soldes + méthodes nécessaires au paiement KRM (blockhash, comptes, tx).
 */
window.TorinvestSolana = {
  rpcUrl: function () {
    if (window.TORINVEST_PHP && typeof window.TORINVEST_PHP.url === "function") {
      return window.TORINVEST_PHP.url("/api/solana-rpc.php");
    }
    return window.location.origin + "/api/solana-rpc.php";
  },

  rpcCall: async function (method, params, id) {
    const resp = await fetch(window.TorinvestSolana.rpcUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: id == null ? 1 : id,
        method: method,
        params: params || [],
      }),
    });
    const raw = await resp.text();
    if (!resp.ok) {
      throw new Error("RPC " + resp.status + " : " + raw.slice(0, 300));
    }
    var data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      throw new Error(raw.slice(0, 300) || "Réponse RPC invalide");
    }
    if (data.error) {
      throw new Error(
        (data.error.message || JSON.stringify(data.error)).slice(0, 300)
      );
    }
    return data.result;
  },

  readMintBalance: async function (walletAddress, mintAddress) {
    const rows = await window.TorinvestSolana.getTokenAccountsByOwner(
      walletAddress,
      mintAddress
    );
    if (!rows.length) return 0;
    var info =
      rows[0].account &&
      rows[0].account.data &&
      rows[0].account.data.parsed &&
      rows[0].account.data.parsed.info;
    if (!info || !info.tokenAmount) return 0;
    var amount = info.tokenAmount;
    return Number(
      amount.uiAmountString != null ? amount.uiAmountString : amount.uiAmount || 0
    );
  },

  /** Solde brut (entier string / bigint) pour montants on-chain. */
  readMintBalanceRaw: async function (walletAddress, mintAddress) {
    const rows = await window.TorinvestSolana.getTokenAccountsByOwner(
      walletAddress,
      mintAddress
    );
    if (!rows.length) {
      return { raw: 0n, uiAmount: 0, decimals: 6, ata: null };
    }
    var info =
      rows[0].account &&
      rows[0].account.data &&
      rows[0].account.data.parsed &&
      rows[0].account.data.parsed.info;
    if (!info || !info.tokenAmount) {
      return { raw: 0n, uiAmount: 0, decimals: 6, ata: rows[0].pubkey || null };
    }
    var amount = info.tokenAmount;
    var rawStr = amount.amount != null ? String(amount.amount) : "0";
    var decimals = amount.decimals != null ? Number(amount.decimals) : 6;
    var ui = Number(
      amount.uiAmountString != null ? amount.uiAmountString : amount.uiAmount || 0
    );
    return {
      raw: BigInt(rawStr),
      uiAmount: ui,
      decimals: decimals,
      ata: rows[0].pubkey || null,
    };
  },

  getTokenAccountsByOwner: async function (walletAddress, mintAddress) {
    const result = await window.TorinvestSolana.rpcCall(
      "getTokenAccountsByOwner",
      [
        walletAddress,
        { mint: mintAddress },
        { encoding: "jsonParsed" },
      ]
    );
    return (result && result.value) || [];
  },

  getAccountInfo: async function (pubkey) {
    return window.TorinvestSolana.rpcCall("getAccountInfo", [
      pubkey,
      { encoding: "jsonParsed" },
    ]);
  },

  getLatestBlockhash: async function (commitment) {
    return window.TorinvestSolana.rpcCall("getLatestBlockhash", [
      { commitment: commitment || "confirmed" },
    ]);
  },

  getTransaction: async function (signature, commitment) {
    return window.TorinvestSolana.rpcCall("getTransaction", [
      signature,
      {
        encoding: "jsonParsed",
        commitment: commitment || "confirmed",
        maxSupportedTransactionVersion: 0,
      },
    ]);
  },

  getSignatureStatuses: async function (signatures) {
    return window.TorinvestSolana.rpcCall("getSignatureStatuses", [
      signatures,
      { searchTransactionHistory: true },
    ]);
  },

  readSplBalances: async function (walletAddress, mintAddresses) {
    var out = {};
    var i;
    for (i = 0; i < mintAddresses.length; i++) {
      out[mintAddresses[i]] = await window.TorinvestSolana.readMintBalance(
        walletAddress,
        mintAddresses[i]
      );
    }
    return out;
  },

  readKrmOrax: async function (walletAddress, krmMint, oraxMint) {
    var b = await window.TorinvestSolana.readSplBalances(walletAddress, [
      krmMint,
      oraxMint,
    ]);
    return { krm: b[krmMint] || 0, orax: b[oraxMint] || 0 };
  },
};
