/**
 * TORINVEST — Paiements on-chain KRM (TransferChecked)
 * Stack : Phantom (signAndSend) + @solana/web3.js (CDN) + proxy RPC PHP.
 * Aucune clé privée. Montants en bigint (unités brutes 10^6).
 */
(function (global) {
  "use strict";

  var STATES = {
    READY: "READY",
    CHECKING_BALANCE: "CHECKING_BALANCE",
    AWAITING_SIGNATURE: "AWAITING_SIGNATURE",
    SENDING: "SENDING",
    CONFIRMING: "CONFIRMING",
    SUCCESS: "SUCCESS",
    FAILED: "FAILED",
    CANCELLED: "CANCELLED",
    TREASURY_MISSING: "TREASURY_MISSING",
  };

  var USED_SIG_STORAGE_KEY = "torinvest_krm_used_payments_v1";
  var paymentLock = false;
  var listeners = [];

  function cfg() {
    return global.TORINVEST_KRM;
  }

  function requireWeb3() {
    if (!global.solanaWeb3) {
      throw new Error("@solana/web3.js non chargé (solanaWeb3 manquant)");
    }
    return global.solanaWeb3;
  }

  function u64leBytes(amountBigInt) {
    var buf = new Uint8Array(8);
    var n = BigInt(amountBigInt);
    if (n < 0n) throw new Error("Montant négatif interdit");
    for (var i = 0; i < 8; i++) {
      buf[i] = Number(n & 0xffn);
      n >>= 8n;
    }
    return buf;
  }

  function transferCheckedData(amountBigInt, decimals) {
    var data = new Uint8Array(10);
    data[0] = 12; // TransferChecked
    data.set(u64leBytes(amountBigInt), 1);
    data[9] = decimals & 0xff;
    return data;
  }

  function getProvider() {
    if (global.TorinvestTorpass && global.TorinvestTorpass.getPhantomProvider) {
      return global.TorinvestTorpass.getPhantomProvider();
    }
    var p = global.phantom && global.phantom.solana;
    if (p && p.isPhantom) return p;
    if (global.solana && global.solana.isPhantom) return global.solana;
    return null;
  }

  function emit(state, payload) {
    listeners.forEach(function (fn) {
      try {
        fn(state, payload || {});
      } catch (e) {
        /* ignore UI listener errors */
      }
    });
  }

  function onStateChange(fn) {
    listeners.push(fn);
    return function () {
      listeners = listeners.filter(function (x) {
        return x !== fn;
      });
    };
  }

  function isBusyState(state) {
    return (
      state === STATES.CHECKING_BALANCE ||
      state === STATES.AWAITING_SIGNATURE ||
      state === STATES.SENDING ||
      state === STATES.CONFIRMING
    );
  }

  function readUsedSignaturesLocal() {
    try {
      var raw = global.localStorage && localStorage.getItem(USED_SIG_STORAGE_KEY);
      if (!raw) return {};
      var obj = JSON.parse(raw);
      return obj && typeof obj === "object" ? obj : {};
    } catch (e) {
      return {};
    }
  }

  function markUsedSignatureLocal(signature, meta) {
    try {
      if (!global.localStorage) return;
      var map = readUsedSignaturesLocal();
      map[signature] = meta || { at: Date.now() };
      localStorage.setItem(USED_SIG_STORAGE_KEY, JSON.stringify(map));
    } catch (e) {
      /* localStorage optional */
    }
  }

  function isUsedLocally(signature) {
    var map = readUsedSignaturesLocal();
    return !!map[signature];
  }

  function deriveAta(mintPubkey, ownerPubkey) {
    var web3 = requireWeb3();
    var TOKEN_PROGRAM_ID = new web3.PublicKey(cfg().TOKEN_PROGRAM_ID);
    var ASSOCIATED_TOKEN_PROGRAM_ID = new web3.PublicKey(
      cfg().ASSOCIATED_TOKEN_PROGRAM_ID
    );
    var found = web3.PublicKey.findProgramAddressSync(
      [
        ownerPubkey.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        mintPubkey.toBuffer(),
      ],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    return found[0];
  }

  function createAtaIdempotentIx(payer, ata, owner, mint) {
    var web3 = requireWeb3();
    return new web3.TransactionInstruction({
      programId: new web3.PublicKey(cfg().ASSOCIATED_TOKEN_PROGRAM_ID),
      keys: [
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: ata, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: false, isWritable: false },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: web3.SystemProgram.programId, isSigner: false, isWritable: false },
        {
          pubkey: new web3.PublicKey(cfg().TOKEN_PROGRAM_ID),
          isSigner: false,
          isWritable: false,
        },
      ],
      data: new Uint8Array([1]), // CreateIdempotent
    });
  }

  function createTransferCheckedIx(source, mint, dest, owner, amountRaw, decimals) {
    var web3 = requireWeb3();
    return new web3.TransactionInstruction({
      programId: new web3.PublicKey(cfg().TOKEN_PROGRAM_ID),
      keys: [
        { pubkey: source, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: dest, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: true, isWritable: false },
      ],
      data: transferCheckedData(amountRaw, decimals),
    });
  }

  async function accountExists(pubkeyStr) {
    var info = await global.TorinvestSolana.getAccountInfo(pubkeyStr);
    return !!(info && info.value);
  }

  function apiPaymentUrl() {
    if (global.TORINVEST_PHP && typeof global.TORINVEST_PHP.url === "function") {
      return global.TORINVEST_PHP.url("/api/krm-service-payment.php");
    }
    return "/api/krm-service-payment.php";
  }

  /**
   * Vérifie on-chain qu'une tx est un paiement KRM valide.
   * Ne fait PAS confiance à la seule présence d'une signature.
   */
  async function verifyKrmServicePayment(opts) {
    var c = cfg();
    var signature = opts.signature;
    var expectedServiceId = opts.expectedServiceId;
    var expectedAmountRaw =
      opts.expectedAmountRaw != null
        ? BigInt(opts.expectedAmountRaw)
        : null;
    var expectedUserWallet = opts.expectedUserWallet;
    var expectedTreasuryWallet =
      opts.expectedTreasuryWallet || c.KRM_SERVICES_TREASURY;

    var base = {
      valid: false,
      signature: signature || null,
      serviceId: expectedServiceId || null,
      amountKrm: null,
      payer: expectedUserWallet || null,
      treasury: expectedTreasuryWallet || null,
      confirmedAt: null,
      error: null,
    };

    try {
      if (!signature) {
        base.error = "SIGNATURE_MISSING";
        return base;
      }
      if (!expectedServiceId || !c.getService(expectedServiceId)) {
        base.error = "UNKNOWN_SERVICE";
        return base;
      }
      if (!expectedUserWallet) {
        base.error = "WALLET_MISSING";
        return base;
      }
      if (!expectedTreasuryWallet || !String(expectedTreasuryWallet).trim()) {
        base.error = "TREASURY_MISSING";
        return base;
      }

      var service = c.getService(expectedServiceId);
      var expectedRaw =
        expectedAmountRaw != null
          ? expectedAmountRaw
          : c.amountKrmToRaw(service.amountKrm);
      base.amountKrm = service.amountKrm;

      if (isUsedLocally(signature)) {
        base.error = "PAYMENT_ALREADY_USED";
        return base;
      }

      if (!global.TorinvestSolana || !global.TorinvestSolana.getTransaction) {
        base.error = "RPC_UNAVAILABLE";
        return base;
      }

      var tx = await global.TorinvestSolana.getTransaction(signature, "confirmed");
      if (!tx) {
        // retry once after short wait
        await new Promise(function (r) {
          setTimeout(r, 1200);
        });
        tx = await global.TorinvestSolana.getTransaction(signature, "confirmed");
      }
      if (!tx) {
        base.error = "TX_NOT_FOUND";
        return base;
      }
      if (tx.meta && tx.meta.err) {
        base.error = "TX_FAILED_ONCHAIN";
        return base;
      }

      var web3 = requireWeb3();
      var mint = new web3.PublicKey(c.KRM_MINT);
      var user = new web3.PublicKey(expectedUserWallet);
      var treasury = new web3.PublicKey(expectedTreasuryWallet);
      var userAta = deriveAta(mint, user).toString();
      var treasuryAta = deriveAta(mint, treasury).toString();

      var matched = false;
      var instructions = [];
      var message = tx.transaction && tx.transaction.message;
      if (message && message.instructions) {
        instructions = message.instructions;
      }
      // inner instructions (ATA create etc.)
      var allIx = instructions.slice();
      if (tx.meta && Array.isArray(tx.meta.innerInstructions)) {
        tx.meta.innerInstructions.forEach(function (inner) {
          if (inner && Array.isArray(inner.instructions)) {
            allIx = allIx.concat(inner.instructions);
          }
        });
      }

      for (var i = 0; i < allIx.length; i++) {
        var ix = allIx[i];
        var parsed = ix.parsed;
        if (!parsed || parsed.type !== "transferChecked") continue;
        var info = parsed.info || {};
        var tokenAmount = info.tokenAmount || {};
        var mintOk = info.mint === c.KRM_MINT;
        var amountOk = String(tokenAmount.amount || "") === expectedRaw.toString();
        var decimalsOk =
          tokenAmount.decimals == null ||
          Number(tokenAmount.decimals) === c.KRM_DECIMALS;
        var destOk = info.destination === treasuryAta;
        var sourceOk = info.source === userAta || info.authority === expectedUserWallet;
        if (mintOk && amountOk && decimalsOk && destOk && sourceOk) {
          matched = true;
          break;
        }
        if (!mintOk) base.error = "WRONG_MINT";
        else if (!destOk) base.error = "WRONG_RECIPIENT";
        else if (!amountOk) base.error = "WRONG_AMOUNT";
        else if (!sourceOk) base.error = "WRONG_PAYER";
      }

      if (!matched) {
        if (!base.error) base.error = "NO_MATCHING_TRANSFER";
        return base;
      }

      // Token balance delta cross-check when available
      if (tx.meta && Array.isArray(tx.meta.postTokenBalances)) {
        var pre = tx.meta.preTokenBalances || [];
        var post = tx.meta.postTokenBalances || [];
        var treasuryGain = null;
        post.forEach(function (p) {
          if (p.mint !== c.KRM_MINT) return;
          if (p.owner && p.owner !== expectedTreasuryWallet) return;
          var preRow = pre.find(function (x) {
            return x.accountIndex === p.accountIndex;
          });
          var preAmt = BigInt(
            (preRow && preRow.uiTokenAmount && preRow.uiTokenAmount.amount) || "0"
          );
          var postAmt = BigInt(
            (p.uiTokenAmount && p.uiTokenAmount.amount) || "0"
          );
          treasuryGain = postAmt - preAmt;
        });
        if (treasuryGain != null && treasuryGain !== expectedRaw) {
          base.error = "WRONG_AMOUNT";
          return base;
        }
      }

      base.valid = true;
      base.error = null;
      base.confirmedAt =
        tx.blockTime != null
          ? new Date(tx.blockTime * 1000).toISOString()
          : new Date().toISOString();
      base.payer = expectedUserWallet;
      base.treasury = expectedTreasuryWallet;
      return base;
    } catch (err) {
      base.error = err && err.message ? err.message : String(err);
      return base;
    }
  }

  async function verifyViaServer(opts) {
    try {
      var resp = await fetch(apiPaymentUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          action: "verify",
          signature: opts.signature,
          serviceId: opts.expectedServiceId,
          userWallet: opts.expectedUserWallet,
        }),
      });
      var data = await resp.json();
      if (data && data.error === "PAYMENT_ALREADY_USED") {
        return {
          valid: false,
          signature: opts.signature,
          serviceId: opts.expectedServiceId,
          amountKrm: null,
          payer: opts.expectedUserWallet,
          treasury: cfg().KRM_SERVICES_TREASURY,
          confirmedAt: null,
          error: "PAYMENT_ALREADY_USED",
          server: data,
        };
      }
      if (data && typeof data.valid === "boolean") {
        return data;
      }
      // fallback client if server unavailable
      return null;
    } catch (e) {
      return null;
    }
  }

  async function submitServiceRequest(payload) {
    var resp = await fetch(apiPaymentUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(Object.assign({ action: "submit_request" }, payload)),
    });
    var text = await resp.text();
    var data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error("Réponse serveur invalide");
    }
    if (!resp.ok || !data.ok) {
      var err = new Error(data.error || "SUBMIT_FAILED");
      err.code = data.error || "SUBMIT_FAILED";
      err.payload = data;
      throw err;
    }
    return data;
  }

  /**
   * Construit la transaction SPL TransferChecked (pas de SOL).
   */
  async function buildKrmPaymentTransaction(userWallet, serviceId) {
    var web3 = requireWeb3();
    var c = cfg();
    if (!c.isTreasuryConfigured()) {
      throw Object.assign(new Error("Treasury KRM non configuré"), {
        code: "TREASURY_MISSING",
      });
    }
    if (c.KRM_MINT !== "Cvx4uEQUHgkrNR1apuz8eBSbWVFDwKhPFGFJn3XcBBwA") {
      throw new Error("Mint KRM invalide");
    }
    var service = c.getService(serviceId);
    if (!service) throw new Error("UNKNOWN_SERVICE");

    var amountRaw = c.amountKrmToRaw(service.amountKrm);
    var mint = new web3.PublicKey(c.KRM_MINT);
    var user = new web3.PublicKey(userWallet);
    var treasury = new web3.PublicKey(c.KRM_SERVICES_TREASURY.trim());
    var userAta = deriveAta(mint, user);
    var treasuryAta = deriveAta(mint, treasury);

    var bal = await global.TorinvestSolana.readMintBalanceRaw(
      userWallet,
      c.KRM_MINT
    );
    if (bal.decimals != null && bal.decimals !== c.KRM_DECIMALS) {
      throw new Error("Décimales KRM inattendues : " + bal.decimals);
    }
    if (bal.raw < amountRaw) {
      throw Object.assign(new Error("Solde KRM insuffisant"), {
        code: "INSUFFICIENT_BALANCE",
        raw: bal.raw.toString(),
        need: amountRaw.toString(),
      });
    }
    if (!bal.ata) {
      throw Object.assign(new Error("Aucun compte KRM trouvé"), {
        code: "NO_KRM_ATA",
      });
    }

    var ixs = [];
    var treasuryAtaExists = await accountExists(treasuryAta.toString());
    if (!treasuryAtaExists) {
      ixs.push(createAtaIdempotentIx(user, treasuryAta, treasury, mint));
    }
    ixs.push(
      createTransferCheckedIx(
        userAta,
        mint,
        treasuryAta,
        user,
        amountRaw,
        c.KRM_DECIMALS
      )
    );

    var bh = await global.TorinvestSolana.getLatestBlockhash("confirmed");
    var blockhash =
      bh && bh.value && bh.value.blockhash
        ? bh.value.blockhash
        : bh && bh.blockhash
          ? bh.blockhash
          : null;
    if (!blockhash) throw new Error("Blockhash indisponible");

    var tx = new web3.Transaction();
    tx.feePayer = user;
    tx.recentBlockhash = blockhash;
    ixs.forEach(function (ix) {
      tx.add(ix);
    });

    return {
      transaction: tx,
      amountRaw: amountRaw,
      amountKrm: service.amountKrm,
      service: service,
      serviceId: serviceId,
      userAta: userAta.toString(),
      treasuryAta: treasuryAta.toString(),
      treasury: treasury.toString(),
      createdTreasuryAta: !treasuryAtaExists,
    };
  }

  /**
   * Flux complet après confirmation UI.
   */
  async function executeKrmPayment(serviceId, userWallet) {
    if (paymentLock) {
      return {
        state: STATES.FAILED,
        error: "PAYMENT_IN_PROGRESS",
        doubleClickBlocked: true,
      };
    }
    paymentLock = true;

    var c = cfg();
    var provider = getProvider();
    var result = {
      state: STATES.READY,
      signature: null,
      verification: null,
      serviceId: serviceId,
      error: null,
    };

    try {
      if (!c.isTreasuryConfigured()) {
        result.state = STATES.TREASURY_MISSING;
        result.error = "Treasury KRM non configuré";
        emit(result.state, result);
        return result;
      }
      if (!provider) {
        result.state = STATES.FAILED;
        result.error = "WALLET_NOT_CONNECTED";
        emit(result.state, result);
        return result;
      }
      if (!userWallet) {
        result.state = STATES.FAILED;
        result.error = "WALLET_NOT_CONNECTED";
        emit(result.state, result);
        return result;
      }

      emit(STATES.CHECKING_BALANCE, { serviceId: serviceId });
      var built = await buildKrmPaymentTransaction(userWallet, serviceId);

      emit(STATES.AWAITING_SIGNATURE, {
        serviceId: serviceId,
        amountKrm: built.amountKrm,
        summary: {
          name: built.service.name,
          amountKrm: built.amountKrm,
          recipient: "TORINVEST",
          network: "Solana Mainnet",
        },
      });

      emit(STATES.SENDING, { serviceId: serviceId });
      var sendResult;
      try {
        sendResult = await provider.signAndSendTransaction(built.transaction);
      } catch (signErr) {
        var code = signErr && signErr.code;
        var msg = signErr && signErr.message ? signErr.message : String(signErr);
        if (code === 4001 || /reject|refus|denied|cancel/i.test(msg)) {
          result.state = STATES.CANCELLED;
          result.error = "USER_REJECTED";
          emit(result.state, result);
          return result;
        }
        result.state = STATES.FAILED;
        result.error = msg;
        emit(result.state, result);
        return result;
      }

      var signature =
        typeof sendResult === "string"
          ? sendResult
          : sendResult && (sendResult.signature || sendResult);
      if (!signature) {
        result.state = STATES.FAILED;
        result.error = "NO_SIGNATURE";
        emit(result.state, result);
        return result;
      }
      result.signature = signature;

      emit(STATES.CONFIRMING, { signature: signature });

      // Wait for confirmation via signature status
      var confirmed = false;
      for (var attempt = 0; attempt < 30; attempt++) {
        try {
          var st = await global.TorinvestSolana.getSignatureStatuses([signature]);
          var value = st && st.value && st.value[0];
          if (value && (value.confirmationStatus === "confirmed" || value.confirmationStatus === "finalized")) {
            if (value.err) {
              result.state = STATES.FAILED;
              result.error = "TX_FAILED_ONCHAIN";
              emit(result.state, result);
              return result;
            }
            confirmed = true;
            break;
          }
        } catch (e) {
          /* retry */
        }
        await new Promise(function (r) {
          setTimeout(r, 800);
        });
      }

      var verifyOpts = {
        signature: signature,
        expectedServiceId: serviceId,
        expectedAmountRaw: built.amountRaw.toString(),
        expectedUserWallet: userWallet,
        expectedTreasuryWallet: c.KRM_SERVICES_TREASURY.trim(),
      };

      var serverVerify = await verifyViaServer(verifyOpts);
      var verification =
        serverVerify || (await verifyKrmServicePayment(verifyOpts));

      // If server unavailable, client verify is the available path
      if (!verification.valid) {
        result.state = STATES.FAILED;
        result.error = verification.error || "VERIFY_FAILED";
        result.verification = verification;
        emit(result.state, result);
        return result;
      }

      markUsedSignatureLocal(signature, {
        serviceId: serviceId,
        at: Date.now(),
        amountKrm: built.amountKrm,
      });

      result.state = STATES.SUCCESS;
      result.verification = verification;
      result.amountKrm = built.amountKrm;
      result.serviceName = built.service.name;
      result.explorerUrl = c.EXPLORER_TX_BASE + signature;
      result.confirmed = confirmed;
      emit(result.state, result);
      return result;
    } catch (err) {
      if (err && err.code === "TREASURY_MISSING") {
        result.state = STATES.TREASURY_MISSING;
        result.error = "Treasury KRM non configuré";
      } else {
        result.state = STATES.FAILED;
        result.error = err && err.message ? err.message : String(err);
        result.code = err && err.code;
      }
      emit(result.state, result);
      return result;
    } finally {
      paymentLock = false;
    }
  }

  /** Helpers testables (mocks) sans réseau. */
  function canPayWithBalance(rawBalance, serviceId) {
    var c = cfg();
    var service = c.getService(serviceId);
    if (!service) return false;
    return BigInt(rawBalance) >= c.amountKrmToRaw(service.amountKrm);
  }

  function simulatePreflight(opts) {
    var c = cfg();
    if (!opts.walletConnected) {
      return { ok: false, state: STATES.FAILED, error: "WALLET_NOT_CONNECTED" };
    }
    if (!c.isTreasuryConfigured()) {
      return {
        ok: false,
        state: STATES.TREASURY_MISSING,
        error: "Treasury KRM non configuré",
      };
    }
    if (c.KRM_MINT !== "Cvx4uEQUHgkrNR1apuz8eBSbWVFDwKhPFGFJn3XcBBwA") {
      return { ok: false, state: STATES.FAILED, error: "WRONG_MINT" };
    }
    var service = c.getService(opts.serviceId);
    if (!service) {
      return { ok: false, state: STATES.FAILED, error: "UNKNOWN_SERVICE" };
    }
    var need = c.amountKrmToRaw(service.amountKrm);
    var have = BigInt(opts.rawBalance || 0);
    if (have < need) {
      return { ok: false, state: STATES.FAILED, error: "INSUFFICIENT_BALANCE" };
    }
    if (opts.userRejected) {
      return { ok: false, state: STATES.CANCELLED, error: "USER_REJECTED" };
    }
    if (opts.rpcFail) {
      return { ok: false, state: STATES.FAILED, error: "RPC_FAILED" };
    }
    if (opts.txFail) {
      return { ok: false, state: STATES.FAILED, error: "TX_FAILED_ONCHAIN" };
    }
    if (opts.wrongMint) {
      return { ok: false, state: STATES.FAILED, error: "WRONG_MINT" };
    }
    if (opts.wrongRecipient) {
      return { ok: false, state: STATES.FAILED, error: "WRONG_RECIPIENT" };
    }
    if (opts.wrongAmount) {
      return { ok: false, state: STATES.FAILED, error: "WRONG_AMOUNT" };
    }
    if (opts.alreadyUsed) {
      return { ok: false, state: STATES.FAILED, error: "PAYMENT_ALREADY_USED" };
    }
    if (opts.doubleClick && paymentLock) {
      return { ok: false, state: STATES.FAILED, error: "PAYMENT_IN_PROGRESS" };
    }
    return {
      ok: true,
      state: STATES.SUCCESS,
      amountRaw: need.toString(),
      amountKrm: service.amountKrm,
      newRawBalance: (have - need).toString(),
    };
  }

  function levelAfterPayment(uiBalance, serviceId) {
    var c = cfg();
    var service = c.getService(serviceId);
    var TP = global.TorinvestTorpass;
    if (!service || !TP) return null;
    var next = Number(uiBalance) - service.amountKrm;
    return TP.buildStatus(next);
  }

  global.TorinvestKrmPay = {
    STATES: STATES,
    onStateChange: onStateChange,
    isBusyState: isBusyState,
    isPaymentLocked: function () {
      return paymentLock;
    },
    setPaymentLockForTests: function (v) {
      paymentLock = !!v;
    },
    deriveAta: deriveAta,
    buildKrmPaymentTransaction: buildKrmPaymentTransaction,
    executeKrmPayment: executeKrmPayment,
    verifyKrmServicePayment: verifyKrmServicePayment,
    verifyViaServer: verifyViaServer,
    submitServiceRequest: submitServiceRequest,
    canPayWithBalance: canPayWithBalance,
    simulatePreflight: simulatePreflight,
    levelAfterPayment: levelAfterPayment,
    markUsedSignatureLocal: markUsedSignatureLocal,
    isUsedLocally: isUsedLocally,
    getProvider: getProvider,
    transferCheckedData: transferCheckedData,
  };
})(typeof window !== "undefined" ? window : global);
