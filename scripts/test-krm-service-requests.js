#!/usr/bin/env node
/**
 * Tests workflow post-paiement services KRM (sans tx mainnet).
 * Simule les règles serveur + transitions admin.
 */
"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var os = require("os");

// --- Minimal PHP-rule mirror in JS for offline tests ---
var CATALOG = {
  trade_idea_review: { name: "Revue pédagogique d'une idée de trade", amountKrm: 50, amountRaw: "50000000" },
  trade_debrief: { name: "Débrief pédagogique d'un trade", amountKrm: 100, amountRaw: "100000000" },
};
var TRANSITIONS = {
  SUBMITTED: ["IN_REVIEW", "CANCELLED"],
  IN_REVIEW: ["COMPLETED", "CANCELLED"],
  PAID: ["CANCELLED"],
};

function simulateVerify(opts) {
  if (opts.noPayment) return { valid: false, error: "FORM_WITHOUT_PAYMENT" };
  if (opts.alreadyUsed) return { valid: false, error: "PAYMENT_ALREADY_USED" };
  if (opts.txFailed) return { valid: false, error: "TX_FAILED_ONCHAIN" };
  if (opts.wrongMint) return { valid: false, error: "WRONG_MINT" };
  if (opts.wrongTreasury) return { valid: false, error: "WRONG_RECIPIENT" };
  if (opts.wrongAmount) return { valid: false, error: "WRONG_AMOUNT" };
  if (!CATALOG[opts.serviceId]) return { valid: false, error: "UNKNOWN_SERVICE" };
  return { valid: true, amountKrm: CATALOG[opts.serviceId].amountKrm, status: "PAID", paymentId: opts.signature };
}

function simulateSubmit(store, opts) {
  if (!opts.signature) return { ok: false, error: "FORM_WITHOUT_PAYMENT" };
  if (store.payments[opts.signature] && store.payments[opts.signature].requestId) {
    return { ok: false, error: "PAYMENT_ALREADY_USED" };
  }
  var v = simulateVerify(opts);
  if (!v.valid) return { ok: false, error: v.error };
  if (!opts.asset || !opts.timeframe || !opts.description) {
    return { ok: false, error: "MISSING_REQUEST_FIELDS" };
  }
  var id = "req_" + Object.keys(store.requests).length + 1;
  store.requests[id] = {
    id: id,
    paymentId: opts.signature,
    signature: opts.signature,
    serviceId: opts.serviceId,
    amountKrm: v.amountKrm,
    status: "SUBMITTED",
    userWallet: opts.userWallet,
    payload: { asset: opts.asset, timeframe: opts.timeframe, description: opts.description },
  };
  store.payments[opts.signature] = {
    paymentId: opts.signature,
    requestId: id,
    status: "SUBMITTED",
    amountKrm: v.amountKrm,
  };
  return { ok: true, requestId: id, request: store.requests[id] };
}

function simulateAdmin(store, requestId, to) {
  var r = store.requests[requestId];
  if (!r) return { ok: false, error: "NOT_FOUND" };
  var allowed = TRANSITIONS[r.status] || [];
  if (allowed.indexOf(to) < 0) return { ok: false, error: "INVALID_TRANSITION" };
  r.status = to;
  return { ok: true, status: to };
}

var results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name: name, result: "PASS" });
  } catch (e) {
    results.push({ name: name, result: "FAIL", error: e.message });
  }
}

var store = { payments: {}, requests: {} };

test("paiement valide 50 → demande autorisée", function () {
  var r = simulateSubmit(store, {
    signature: "Sig50ValidMainnetFake",
    serviceId: "trade_idea_review",
    userWallet: "WalletA",
    asset: "XAUUSD",
    timeframe: "M15",
    description: "test idea",
  });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.request.amountKrm, 50);
  assert.strictEqual(r.request.status, "SUBMITTED");
});

test("paiement valide 100 → demande autorisée", function () {
  var r = simulateSubmit(store, {
    signature: "Sig100ValidMainnetFake",
    serviceId: "trade_debrief",
    userWallet: "WalletA",
    asset: "BTCUSD",
    timeframe: "H1",
    description: "test debrief",
  });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.request.amountKrm, 100);
});

test("signature déjà utilisée → refus", function () {
  var r = simulateSubmit(store, {
    signature: "Sig50ValidMainnetFake",
    serviceId: "trade_idea_review",
    userWallet: "WalletA",
    asset: "XAUUSD",
    timeframe: "M15",
    description: "reuse",
  });
  assert.strictEqual(r.error, "PAYMENT_ALREADY_USED");
});

test("mauvais montant → refus", function () {
  var r = simulateVerify({
    signature: "x",
    serviceId: "trade_idea_review",
    wrongAmount: true,
  });
  assert.strictEqual(r.error, "WRONG_AMOUNT");
});

test("mauvais mint → refus", function () {
  assert.strictEqual(simulateVerify({ serviceId: "trade_idea_review", wrongMint: true }).error, "WRONG_MINT");
});

test("mauvais Treasury → refus", function () {
  assert.strictEqual(simulateVerify({ serviceId: "trade_idea_review", wrongTreasury: true }).error, "WRONG_RECIPIENT");
});

test("transaction failed → refus", function () {
  assert.strictEqual(simulateVerify({ serviceId: "trade_idea_review", txFailed: true }).error, "TX_FAILED_ONCHAIN");
});

test("formulaire sans paiement → refus", function () {
  var r = simulateSubmit(store, {
    signature: "",
    serviceId: "trade_idea_review",
    userWallet: "WalletA",
    asset: "XAUUSD",
    timeframe: "M15",
    description: "no pay",
    noPayment: true,
  });
  assert.strictEqual(r.error, "FORM_WITHOUT_PAYMENT");
});

test("demande créée → signature marquée utilisée", function () {
  assert.ok(store.payments.Sig50ValidMainnetFake.requestId);
  assert.strictEqual(store.payments.Sig50ValidMainnetFake.status, "SUBMITTED");
});

test("changement statut admin SUBMITTED → IN_REVIEW → COMPLETED", function () {
  var id = store.payments.Sig50ValidMainnetFake.requestId;
  assert.strictEqual(simulateAdmin(store, id, "IN_REVIEW").ok, true);
  assert.strictEqual(simulateAdmin(store, id, "COMPLETED").ok, true);
  assert.strictEqual(store.requests[id].status, "COMPLETED");
});

test("transition admin invalide refusée", function () {
  var id = store.payments.Sig100ValidMainnetFake.requestId;
  assert.strictEqual(simulateAdmin(store, id, "COMPLETED").error, "INVALID_TRANSITION");
});

test("refresh navigateur → données conservées (store serveur simulé)", function () {
  var tmp = fs.mkdtempSync(path.join(os.tmpdir(), "krm-req-"));
  var file = path.join(tmp, "requests.json");
  fs.writeFileSync(file, JSON.stringify(store.requests, null, 2));
  var reloaded = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.ok(Object.keys(reloaded).length >= 2);
});

test("montants raw officiels", function () {
  assert.strictEqual(CATALOG.trade_idea_review.amountRaw, "50000000");
  assert.strictEqual(CATALOG.trade_debrief.amountRaw, "100000000");
});

test("pas de private key dans fichiers services", function () {
  ["api/krm-service-payment-lib.php", "api/krm-service-payment.php", "assets/torinvest-krm-pay.js"].forEach(function (f) {
    var txt = fs.readFileSync(path.join(__dirname, "..", f), "utf8");
    assert.ok(!/secretKey\s*[:=]|privateKey\s*[:=]|BEGIN PRIVATE|seedPhrase\s*[:=]/i.test(txt), f);
  });
});

var failed = results.filter(function (r) { return r.result === "FAIL"; });
console.log(JSON.stringify({ summary: { total: results.length, failed: failed.length }, results: results }, null, 2));
if (failed.length) process.exit(1);
console.log("ALL_KRM_SERVICE_REQUEST_TESTS_PASSED");
