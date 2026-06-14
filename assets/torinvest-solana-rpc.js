/**
 * TorPass — lecture soldes KRM/ORAX via proxy Helius (same-origin /api/solana-rpc.php).
 * Requêtes filtrées par mint (2 appels légers) : évite timeout sur wallets avec des centaines de tokens SPL.
 */
window.TorinvestSolana = {
  rpcUrl: function () {
    return window.location.origin + "/api/solana-rpc.php";
  },

  readMintBalance: async function (walletAddress, mintAddress) {
    const resp = await fetch(window.TorinvestSolana.rpcUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenAccountsByOwner",
        params: [
          walletAddress,
          { mint: mintAddress },
          { encoding: "jsonParsed" },
        ],
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
    var rows = (data.result && data.result.value) || [];
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
