#!/usr/bin/env node
/**
 * Tests — offres € + modes pricing TorPass (sans on-chain).
 */
"use strict";

var assert = require("assert");
var path = require("path");

global.window = global;
require(path.join(__dirname, "../assets/torinvest-offers-config.js"));
require(path.join(__dirname, "../assets/torinvest-torpass.js"));

var CFG = global.TORINVEST_OFFERS_CONFIG;
var TP = global.TorinvestTorpass;
var results = [];

function test(name, fn) {
  try {
    fn();
    results.push({ name: name, result: "PASS" });
  } catch (e) {
    results.push({ name: name, result: "FAIL", error: e.message });
  }
}

test("0 KRM → PUBLIC", function () {
  assert.strictEqual(TP.getLevelFromBalance(0), "PUBLIC");
});

test("100 KRM → COMMUNITY", function () {
  assert.strictEqual(TP.getLevelFromBalance(100), "COMMUNITY");
});

test("250 KRM → ACADEMY sans Robot membre", function () {
  var st = TP.buildStatus(250);
  assert.strictEqual(st.level, "ACADEMY");
  assert.strictEqual(st.access.memberFormation, true);
  assert.strictEqual(st.access.memberRobot, false);
});

test("500 KRM → PRO sans gratuité produit", function () {
  var st = TP.buildStatus(500);
  assert.strictEqual(st.level, "PRO");
  assert.strictEqual(st.access.memberRobot, true);
  assert.strictEqual(st.access.memberFormation, true);
  // Éligibilité ≠ accès produit gratuit
  assert.ok(CFG.DISCLAIMER.indexOf("ne remplacent pas") !== -1);
});

test("PUBLIC_PROMO : 0 KRM voit 79 et 349", function () {
  assert.strictEqual(CFG.PRICING_MODE, "PUBLIC_PROMO");
  var robot = CFG.resolveOfferPrice("ROBOT", "PUBLIC");
  var form = CFG.resolveOfferPrice("FORMATION", "PUBLIC");
  assert.strictEqual(robot.displayPrice, 79);
  assert.strictEqual(form.displayPrice, 349);
  assert.strictEqual(robot.krmRequiredNow, false);
  assert.strictEqual(form.krmRequiredNow, false);
});

test("MEMBER_PRICING : 0 KRM voit 149 / 499", function () {
  var saved = CFG.PRICING_MODE;
  CFG.PRICING_MODE = "MEMBER_PRICING";
  var robot = CFG.resolveOfferPrice("ROBOT", "PUBLIC");
  var form = CFG.resolveOfferPrice("FORMATION", "PUBLIC");
  assert.strictEqual(robot.displayPrice, 149);
  assert.strictEqual(form.displayPrice, 499);
  CFG.PRICING_MODE = saved;
});

test("MEMBER_PRICING : 250 Formation 349, Robot 149 ; 500 les deux membres", function () {
  var saved = CFG.PRICING_MODE;
  CFG.PRICING_MODE = "MEMBER_PRICING";
  assert.strictEqual(CFG.resolveOfferPrice("FORMATION", "ACADEMY").displayPrice, 349);
  assert.strictEqual(CFG.resolveOfferPrice("ROBOT", "ACADEMY").displayPrice, 149);
  assert.strictEqual(CFG.resolveOfferPrice("FORMATION", "PRO").displayPrice, 349);
  assert.strictEqual(CFG.resolveOfferPrice("ROBOT", "PRO").displayPrice, 79);
  var gateFail = CFG.canUseMemberPriceAtCheckout("FORMATION", 0);
  assert.strictEqual(gateFail.eligible, false);
  var gateOk = CFG.canUseMemberPriceAtCheckout("FORMATION", 250);
  assert.strictEqual(gateOk.eligible, true);
  CFG.PRICING_MODE = saved;
});

test("PUBLIC_PROMO checkout : 0 KRM éligible promo", function () {
  var g0 = CFG.canUseMemberPriceAtCheckout("FORMATION", 0);
  assert.strictEqual(g0.eligible, true);
  assert.strictEqual(g0.reason, "PUBLIC_PROMO");
});

test("services KRM 50/100 intacts", function () {
  require(path.join(__dirname, "../assets/torinvest-krm-config.js"));
  var KRM = global.TORINVEST_KRM;
  assert.strictEqual(KRM.KRM_SERVICES.trade_idea_review.amountKrm, 50);
  assert.strictEqual(KRM.KRM_SERVICES.trade_debrief.amountKrm, 100);
  assert.strictEqual(
    KRM.KRM_MINT,
    "Cvx4uEQUHgkrNR1apuz8eBSbWVFDwKhPFGFJn3XcBBwA"
  );
});

// Simulation MEMBER_PRICING en ré-exécutant la logique de rang
test("MEMBER_PRICING logique rang (simulée)", function () {
  function resolve(mode, offerId, level) {
    var offer = CFG.TORINVEST_OFFERS[offerId];
    var rank = CFG.levelRank;
    if (mode === "PUBLIC_PROMO") return offer.promoPrice;
    if (mode === "MEMBER_PRICING") {
      if (rank(level) >= rank(offer.requiredKrmLevel)) return offer.memberPrice;
      return offer.regularPrice;
    }
    return offer.regularPrice;
  }
  assert.strictEqual(resolve("MEMBER_PRICING", "ROBOT", "PUBLIC"), 149);
  assert.strictEqual(resolve("MEMBER_PRICING", "FORMATION", "PUBLIC"), 499);
  assert.strictEqual(resolve("MEMBER_PRICING", "FORMATION", "ACADEMY"), 349);
  assert.strictEqual(resolve("MEMBER_PRICING", "ROBOT", "ACADEMY"), 149);
  assert.strictEqual(resolve("MEMBER_PRICING", "ROBOT", "PRO"), 79);
  assert.strictEqual(resolve("MEMBER_PRICING", "FORMATION", "PRO"), 349);
});

var failed = 0;
results.forEach(function (r) {
  console.log(r.result + " — " + r.name + (r.error ? " :: " + r.error : ""));
  if (r.result === "FAIL") failed++;
});
console.log(failed ? "FAILED " + failed : "ALL PASS (" + results.length + ")");
process.exit(failed ? 1 : 0);
