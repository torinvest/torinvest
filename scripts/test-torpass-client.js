#!/usr/bin/env node
/**
 * Tests locaux — helpers TorPass client (sans PHP / sans on-chain).
 * Vérifie la config Discord / abonnements côté JS.
 */
"use strict";

var assert = require("assert");
var path = require("path");
var fs = require("fs");

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

var CFG = global.TORINVEST_OFFERS_CONFIG;
var results = [];

function test(name, fn) {
  try {
    fn();
    results.push({ name: name, result: "PASS" });
  } catch (e) {
    results.push({ name: name, result: "FAIL", error: e.message });
  }
}

test("API torpass-client.php présente", function () {
  assert.ok(fs.existsSync(path.join(__dirname, "../api/torpass-client.php")));
  assert.ok(fs.existsSync(path.join(__dirname, "../api/torpass-client-lib.php")));
});

test("redirect Netlify torpass-client", function () {
  var redirects = fs.readFileSync(path.join(__dirname, "../_redirects"), "utf8");
  assert.ok(redirects.indexOf("/api/torpass-client.php") !== -1);
  assert.ok(redirects.indexOf("radar.torinvest-trading.com/api/torpass-client.php") !== -1);
});

test("stub abonnements défaut NON", function () {
  global.localStorage.removeItem("torinvest_sub_formation");
  global.localStorage.removeItem("torinvest_sub_robot");
  var s = CFG.getClientSubscriptions("wallet");
  assert.strictEqual(s.formationActive, false);
  assert.strictEqual(s.robotActive, false);
});

test("lib PHP expose link + status (source)", function () {
  var lib = fs.readFileSync(
    path.join(__dirname, "../api/torpass-client-lib.php"),
    "utf8"
  );
  assert.ok(lib.indexOf("function torpassClientStatusForWallet") !== -1);
  assert.ok(lib.indexOf("function torpassClientLinkLicense") !== -1);
  assert.ok(lib.indexOf("licenceCrmAttachWalletToLicense") !== -1);
});

test("torpass.html : Discord + liaison licence", function () {
  var html = fs.readFileSync(path.join(__dirname, "../torpass.html"), "utf8");
  assert.ok(html.indexOf("discordActivateBtn") !== -1);
  assert.ok(html.indexOf("licenseLinkBtn") !== -1);
  assert.ok(html.indexOf("torpass-client.php") !== -1);
  assert.ok(html.indexOf("link_license") !== -1);
});

var failed = 0;
results.forEach(function (r) {
  console.log(r.result + " — " + r.name + (r.error ? " :: " + r.error : ""));
  if (r.result === "FAIL") failed++;
});
console.log(failed ? "FAILED " + failed : "ALL PASS (" + results.length + ")");
process.exit(failed ? 1 : 0);
