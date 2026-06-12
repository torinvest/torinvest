/**
 * TorPass — lecture soldes KRM/ORAX via proxy Helius sur radar.
 * fetch() direct (sans @solana/web3.js) : CORS OK, headers minimaux.
 */
window.TorinvestSolana = {
  RPC_URL: "https://radar.torinvest-trading.com/api/solana-rpc.php",

  readSplBalances: async function (walletAddress, mintAddresses) {
    const resp = await fetch(window.TorinvestSolana.RPC_URL, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenAccountsByOwner",
        params: [
          walletAddress,
          { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
          { encoding: "jsonParsed" },
        ],
      }),
    });
    const raw = await resp.text();
    if (!resp.ok) throw new Error(resp.status + " : " + raw.slice(0, 300));
    var data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      throw new Error(raw.slice(0, 300) || "Réponse RPC invalide");
    }
    if (data.error) throw new Error(JSON.stringify(data.error));
    var out = {};
    for (var i = 0; i < mintAddresses.length; i++) out[mintAddresses[i]] = 0;
    var rows = (data.result && data.result.value) || [];
    for (var j = 0; j < rows.length; j++) {
      var info = rows[j].account && rows[j].account.data && rows[j].account.data.parsed && rows[j].account.data.parsed.info;
      if (!info || out[info.mint] === undefined) continue;
      var amount = info.tokenAmount || {};
      out[info.mint] = Number(amount.uiAmountString != null ? amount.uiAmountString : amount.uiAmount || 0);
    }
    return out;
  },

  readKrmOrax: async function (walletAddress, krmMint, oraxMint) {
    var b = await window.TorinvestSolana.readSplBalances(walletAddress, [krmMint, oraxMint]);
    return { krm: b[krmMint] || 0, orax: b[oraxMint] || 0 };
  },
};
