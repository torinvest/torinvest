#!/usr/bin/env node
/**
 * Tests — offres € + parcours client TorPass / KRM (sans on-chain).
 */
"use strict";

var assert = require("assert");
var path = require("path");

global.window = global;
global.localStorage = {
  _d: {},
  getItem: function (k) {
    return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null;
  },
  setItem: function (k, v) {
    this._d[k] = String(v);
  },
  removeItem: function (k) {
    delete this._d[k];
  },
};

require(path.join(__dirname, "../assets/torinvest-offers-config.js"));
require(path.join(__dirname, "../assets/torinvest-krm-config.js"));
require(path.join(__dirname, "../assets/torinvest-torpass.js"));

var CFG = global.TORINVEST_OFFERS_CONFIG;
var KRM = global.TORINVEST_KRM;
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
  assert.strictEqual(st.access.discord, true);
});

test("500 KRM → PRO sans gratuité produit", function () {
  var st = TP.buildStatus(500);
  assert.strictEqual(st.level, "PRO");
  assert.strictEqual(st.access.memberRobot, true);
  assert.strictEqual(st.access.memberFormation, true);
  assert.ok(CFG.DISCLAIMER.indexOf("ne remplacent pas") !== -1);
});

test("250 KRM : Academy OUI, abonnement Formation défaut NON", function () {
  var st = TP.buildStatus(250);
  assert.strictEqual(st.level, "ACADEMY");
  global.localStorage.removeItem("torinvest_sub_formation");
  var subs = CFG.getClientSubscriptions("test");
  assert.strictEqual(subs.formationActive, false);
  assert.strictEqual(st.access.memberFormation, true);
});

test("500 KRM : Pro OUI, Robot Access défaut NON ABONNÉ", function () {
  var st = TP.buildStatus(500);
  assert.strictEqual(st.level, "PRO");
  global.localStorage.removeItem("torinvest_sub_robot");
  var subs = CFG.getClientSubscriptions("test");
  assert.strictEqual(subs.robotActive, false);
  assert.strictEqual(st.access.memberRobot, true);
});

test("Formation payée (stub localStorage) → ACTIF", function () {
  global.localStorage.setItem("torinvest_sub_formation", "1");
  assert.strictEqual(CFG.getClientSubscriptions().formationActive, true);
  global.localStorage.removeItem("torinvest_sub_formation");
});

test("Robot payé (stub localStorage) → ACTIF", function () {
  global.localStorage.setItem("torinvest_sub_robot", "1");
  assert.strictEqual(CFG.getClientSubscriptions().robotActive, true);
  global.localStorage.removeItem("torinvest_sub_robot");
});

test("niveau max ≥ 500 : isMax + prochain null", function () {
  var st = TP.buildStatus(500);
  assert.strictEqual(st.isMax, true);
  assert.strictEqual(st.next, null);
  assert.strictEqual(TP.isMaxLevel(500), true);
});

test("183.42 KRM → COMMUNITY, manque ACADEMY", function () {
  var st = TP.buildStatus(183.42);
  assert.strictEqual(st.level, "COMMUNITY");
  assert.ok(st.next);
  assert.strictEqual(st.next.key, "ACADEMY");
  assert.ok(Math.abs(st.next.missing - 66.58) < 0.001);
});

test("ROBOT checkout paused : pas de lien Stripe", function () {
  assert.strictEqual(CFG.isOfferCheckoutPaused("ROBOT"), true);
  var robot = CFG.resolveOfferPrice("ROBOT", "PUBLIC");
  assert.strictEqual(robot.paused, true);
  assert.strictEqual(robot.stripePaymentLink, null);
  assert.ok(robot.pausedMessage.indexOf("pause") !== -1);
  var form = CFG.resolveOfferPrice("FORMATION", "PUBLIC");
  assert.strictEqual(form.paused, false);
  assert.ok(form.stripePaymentLink);
});

test("PUBLIC_PROMO : 0 KRM voit 79 et 349", function () {
  assert.strictEqual(CFG.PRICING_MODE, "PUBLIC_PROMO");
  var robot = CFG.resolveOfferPrice("ROBOT", "PUBLIC");
  var form = CFG.resolveOfferPrice("FORMATION", "PUBLIC");
  assert.strictEqual(robot.displayPrice, 79);
  assert.strictEqual(form.displayPrice, 349);
  assert.strictEqual(robot.krmRequiredNow, false);
  assert.strictEqual(form.krmRequiredNow, false);
  assert.ok(robot.advantageText.indexOf("aucun KRM requis") !== -1);
  assert.ok(robot.futureAdvantageText.indexOf("après la période de lancement") !== -1);
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

test("RAYDIUM_CONFIG centralisé + mint exact", function () {
  assert.strictEqual(
    KRM.KRM_MINT,
    "Cvx4uEQUHgkrNR1apuz8eBSbWVFDwKhPFGFJn3XcBBwA"
  );
  assert.ok(KRM.RAYDIUM_CONFIG);
  assert.strictEqual(KRM.RAYDIUM_CONFIG.krmMint, KRM.KRM_MINT);
  assert.strictEqual(
    KRM.RAYDIUM_CONFIG.usdcMint,
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
  );
  assert.strictEqual(
    KRM.RAYDIUM_CONFIG.poolId,
    "BLXPTAFedmjRHKrkZp42pd6vUs4gTR8sLGJFStNR7iWZ"
  );
  assert.strictEqual(KRM.RAYDIUM_CONFIG.network, "mainnet");
  assert.ok(KRM.KRM_POOL_URL.indexOf(KRM.RAYDIUM_CONFIG.usdcMint) !== -1);
  assert.ok(KRM.KRM_POOL_URL.indexOf(KRM.RAYDIUM_CONFIG.krmMint) !== -1);
  assert.ok(KRM.KRM_POOL_URL.indexOf("raydium.io") !== -1);
  assert.strictEqual(KRM.getRaydiumSwapUrl(), KRM.KRM_BUY_PRIMARY_URL);
});

test("BETA liquidité note présente", function () {
  assert.ok(KRM.KRM_BETA_LIQUIDITY_NOTE.indexOf("BETA") !== -1);
  assert.ok(KRM.KRM_BETA_LIQUIDITY_NOTE.indexOf("liquidité") !== -1);
});

test("HOW_KRM_WORKS_STEPS = 3 étapes", function () {
  assert.strictEqual(CFG.HOW_KRM_WORKS_STEPS.length, 3);
  assert.ok(CFG.HOW_KRM_WORKS_STEPS[0].title.indexOf("KRM") !== -1);
  assert.ok(CFG.HOLD_VS_SPEND.holdTitle.indexOf("DÉTENIR") !== -1);
  assert.ok(CFG.HOLD_VS_SPEND.spendTitle.indexOf("DÉPENSER") !== -1);
});

test("services KRM 50/100 intacts", function () {
  assert.strictEqual(KRM.KRM_SERVICES.trade_idea_review.amountKrm, 50);
  assert.strictEqual(KRM.KRM_SERVICES.trade_debrief.amountKrm, 100);
});

test("TorPass mint aligné sur TORINVEST_KRM", function () {
  assert.strictEqual(TP.KRM_MINT, KRM.KRM_MINT);
});

var failed = 0;
results.forEach(function (r) {
  console.log(r.result + " — " + r.name + (r.error ? " :: " + r.error : ""));
  if (r.result === "FAIL") failed++;
});
console.log(failed ? "FAILED " + failed : "ALL PASS (" + results.length + ")");
process.exit(failed ? 1 : 0);
