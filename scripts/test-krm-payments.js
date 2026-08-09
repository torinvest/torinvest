#!/usr/bin/env node
/**
 * Tests mockés — paiements services KRM (aucune tx mainnet).
 */
"use strict";

var assert = require("assert");
var path = require("path");
var fs = require("fs");

// Minimal browser globals
global.window = global;
global.localStorage = {
  _d: {},
  getItem: function (k) {
    return this._d[k] || null;
  },
  setItem: function (k, v) {
    this._d[k] = String(v);
  },
  removeItem: function (k) {
    delete this._d[k];
  },
};

// Stub Phantom / web3 not required for simulatePreflight tests
require(path.join(__dirname, "../assets/torinvest-offers-config.js"));
require(path.join(__dirname, "../assets/torinvest-krm-config.js"));
require(path.join(__dirname, "../assets/torinvest-torpass.js"));
require(path.join(__dirname, "../assets/torinvest-krm-pay.js"));

var KRM = global.TORINVEST_KRM;
var TP = global.TorinvestTorpass;
var PAY = global.TorinvestKrmPay;

var results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name: name, result: "PASS" });
  } catch (e) {
    results.push({ name: name, result: "FAIL", error: e.message });
  }
}

// Restore empty treasury for disable tests
var originalTreasury = KRM.KRM_SERVICES_TREASURY;

test("config mint officiel", function () {
  assert.strictEqual(
    KRM.KRM_MINT,
    "Cvx4uEQUHgkrNR1apuz8eBSbWVFDwKhPFGFJn3XcBBwA"
  );
});

test("montants raw exacts bigint", function () {
  assert.strictEqual(KRM.amountKrmToRaw(50).toString(), "50000000");
  assert.strictEqual(KRM.amountKrmToRaw(100).toString(), "100000000");
  assert.strictEqual(KRM.KRM_DECIMALS, 6);
});

test("services centralisés non dupliqués", function () {
  assert.ok(KRM.KRM_SERVICES.trade_idea_review);
  assert.ok(KRM.KRM_SERVICES.trade_debrief);
  assert.strictEqual(KRM.KRM_SERVICES.trade_idea_review.amountKrm, 50);
  assert.strictEqual(KRM.KRM_SERVICES.trade_debrief.amountKrm, 100);
  assert.strictEqual(TP.getServiceById("trade_idea_review").priceKrm, 50);
});

test("1. wallet non connecté", function () {
  KRM.KRM_SERVICES_TREASURY = "TreasuryPublicKey111111111111111111111111111";
  var r = PAY.simulatePreflight({
    walletConnected: false,
    serviceId: "trade_idea_review",
    rawBalance: "50000000",
  });
  assert.strictEqual(r.error, "WALLET_NOT_CONNECTED");
});

test("treasury vide → désactivé", function () {
  KRM.KRM_SERVICES_TREASURY = "";
  assert.strictEqual(KRM.isTreasuryConfigured(), false);
  var r = PAY.simulatePreflight({
    walletConnected: true,
    serviceId: "trade_idea_review",
    rawBalance: "50000000",
  });
  assert.strictEqual(r.state, PAY.STATES.TREASURY_MISSING);
  assert.match(r.error, /Treasury KRM non configuré/);
});

// Enable treasury for remaining payment sims (fake pubkey string — no network)
KRM.KRM_SERVICES_TREASURY = "TreasuryPublicKey111111111111111111111111111";

test("2. solde KRM = 0", function () {
  var r = PAY.simulatePreflight({
    walletConnected: true,
    serviceId: "trade_idea_review",
    rawBalance: "0",
  });
  assert.strictEqual(r.error, "INSUFFICIENT_BALANCE");
  assert.strictEqual(PAY.canPayWithBalance(0n, "trade_idea_review"), false);
});

test("3. solde 49.999999 pour service 50", function () {
  var raw = 49999999n;
  assert.strictEqual(PAY.canPayWithBalance(raw, "trade_idea_review"), false);
  var r = PAY.simulatePreflight({
    walletConnected: true,
    serviceId: "trade_idea_review",
    rawBalance: raw.toString(),
  });
  assert.strictEqual(r.error, "INSUFFICIENT_BALANCE");
});

test("4. solde 50 exact", function () {
  var raw = 50000000n;
  assert.strictEqual(PAY.canPayWithBalance(raw, "trade_idea_review"), true);
  var r = PAY.simulatePreflight({
    walletConnected: true,
    serviceId: "trade_idea_review",
    rawBalance: raw.toString(),
  });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.amountRaw, "50000000");
  assert.strictEqual(r.newRawBalance, "0");
});

test("5. solde 99.999999 pour service 100", function () {
  var raw = 99999999n;
  assert.strictEqual(PAY.canPayWithBalance(raw, "trade_debrief"), false);
  var r = PAY.simulatePreflight({
    walletConnected: true,
    serviceId: "trade_debrief",
    rawBalance: raw.toString(),
  });
  assert.strictEqual(r.error, "INSUFFICIENT_BALANCE");
});

test("6. solde 100 exact", function () {
  var raw = 100000000n;
  assert.strictEqual(PAY.canPayWithBalance(raw, "trade_debrief"), true);
  var r = PAY.simulatePreflight({
    walletConnected: true,
    serviceId: "trade_debrief",
    rawBalance: raw.toString(),
  });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.amountRaw, "100000000");
});

test("7. utilisateur annule dans le wallet", function () {
  var r = PAY.simulatePreflight({
    walletConnected: true,
    serviceId: "trade_idea_review",
    rawBalance: "50000000",
    userRejected: true,
  });
  assert.strictEqual(r.state, PAY.STATES.CANCELLED);
  assert.strictEqual(r.error, "USER_REJECTED");
});

test("8. RPC échoue", function () {
  var r = PAY.simulatePreflight({
    walletConnected: true,
    serviceId: "trade_idea_review",
    rawBalance: "50000000",
    rpcFail: true,
  });
  assert.strictEqual(r.error, "RPC_FAILED");
});

test("9. transaction Solana échoue", function () {
  var r = PAY.simulatePreflight({
    walletConnected: true,
    serviceId: "trade_idea_review",
    rawBalance: "50000000",
    txFail: true,
  });
  assert.strictEqual(r.error, "TX_FAILED_ONCHAIN");
});

test("10. confirmation réussit", function () {
  var r = PAY.simulatePreflight({
    walletConnected: true,
    serviceId: "trade_idea_review",
    rawBalance: "50000000",
  });
  assert.strictEqual(r.state, PAY.STATES.SUCCESS);
});

test("11. mauvais mint détecté", function () {
  var r = PAY.simulatePreflight({
    walletConnected: true,
    serviceId: "trade_idea_review",
    rawBalance: "50000000",
    wrongMint: true,
  });
  assert.strictEqual(r.error, "WRONG_MINT");
});

test("12. mauvais destinataire détecté", function () {
  var r = PAY.simulatePreflight({
    walletConnected: true,
    serviceId: "trade_idea_review",
    rawBalance: "50000000",
    wrongRecipient: true,
  });
  assert.strictEqual(r.error, "WRONG_RECIPIENT");
});

test("13. mauvais montant détecté", function () {
  var r = PAY.simulatePreflight({
    walletConnected: true,
    serviceId: "trade_idea_review",
    rawBalance: "50000000",
    wrongAmount: true,
  });
  assert.strictEqual(r.error, "WRONG_AMOUNT");
});

test("14. transaction déjà utilisée", function () {
  PAY.markUsedSignatureLocal("FakeSigAlreadyUsed111", {
    serviceId: "trade_idea_review",
  });
  assert.strictEqual(PAY.isUsedLocally("FakeSigAlreadyUsed111"), true);
  var r = PAY.simulatePreflight({
    walletConnected: true,
    serviceId: "trade_idea_review",
    rawBalance: "50000000",
    alreadyUsed: true,
  });
  assert.strictEqual(r.error, "PAYMENT_ALREADY_USED");
});

test("15. double clic sur bouton", function () {
  PAY.setPaymentLockForTests(true);
  var r = PAY.simulatePreflight({
    walletConnected: true,
    serviceId: "trade_idea_review",
    rawBalance: "50000000",
    doubleClick: true,
  });
  assert.strictEqual(r.error, "PAYMENT_IN_PROGRESS");
  PAY.setPaymentLockForTests(false);
});

test("16. actualisation du solde après paiement", function () {
  var r = PAY.simulatePreflight({
    walletConnected: true,
    serviceId: "trade_idea_review",
    rawBalance: "270000000", // 270 KRM
  });
  assert.strictEqual(r.newRawBalance, "220000000"); // 220 KRM
});

test("17. downgrade TorPass après paiement", function () {
  var before = TP.buildStatus(270);
  assert.strictEqual(before.level, "ACADEMY");
  var after = PAY.levelAfterPayment(270, "trade_idea_review");
  assert.strictEqual(after.level, "COMMUNITY");
  assert.strictEqual(after.krm, 220);
  assert.strictEqual(after.access.formations, false);
  assert.strictEqual(after.access.discord, true);
});

test("TransferChecked data encoding (50 KRM)", function () {
  var data = PAY.transferCheckedData(50000000n, 6);
  assert.strictEqual(data[0], 12);
  assert.strictEqual(data[9], 6);
  // little-endian 50000000
  var n = 0n;
  for (var i = 0; i < 8; i++) n |= BigInt(data[1 + i]) << BigInt(8 * i);
  assert.strictEqual(n.toString(), "50000000");
});

test("niveaux TorPass (PRO + alias COACHING)", function () {
  assert.strictEqual(TP.TORPASS_LEVELS.PUBLIC, 0);
  assert.strictEqual(TP.TORPASS_LEVELS.COMMUNITY, 100);
  assert.strictEqual(TP.TORPASS_LEVELS.ACADEMY, 250);
  assert.strictEqual(TP.TORPASS_LEVELS.PRO, 500);
  assert.strictEqual(TP.TORPASS_LEVELS.COACHING, 500);
  assert.strictEqual(TP.getLevelFromBalance(0), "PUBLIC");
  assert.strictEqual(TP.getLevelFromBalance(100), "COMMUNITY");
  assert.strictEqual(TP.getLevelFromBalance(250), "ACADEMY");
  assert.strictEqual(TP.getLevelFromBalance(500), "PRO");
  assert.ok(!TP.getAccessForBalance(250).memberRobot);
  assert.ok(TP.getAccessForBalance(250).memberFormation);
  assert.ok(TP.getAccessForBalance(500).memberRobot);
});

test("aucune private key dans assets krm", function () {
  var files = [
    "assets/torinvest-krm-config.js",
    "assets/torinvest-krm-pay.js",
    "assets/torinvest-torpass.js",
  ];
  files.forEach(function (f) {
    var txt = fs.readFileSync(path.join(__dirname, "..", f), "utf8");
    // Interdit les assignments/secrets, pas les commentaires de sécurité
    assert.ok(
      !/secretKey\s*[:=]|privateKey\s*[:=]|BEGIN PRIVATE|seedPhrase\s*[:=]|mnemonic\s*[:=]\s*['\"]/i.test(
        txt
      ),
      f
    );
  });
});

// restore
KRM.KRM_SERVICES_TREASURY = originalTreasury;

var failed = results.filter(function (r) {
  return r.result === "FAIL";
});
console.log(JSON.stringify({ summary: { total: results.length, failed: failed.length }, results: results }, null, 2));
if (failed.length) {
  process.exit(1);
}
console.log("ALL_KRM_PAYMENT_TESTS_PASSED");
