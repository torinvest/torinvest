#!/usr/bin/env node
/** Tests — mapping niveaux TorPass → rôles Discord (sans API Discord). */
"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");

global.window = global;
require(path.join(__dirname, "../assets/torinvest-offers-config.js"));
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

function rolesForLevel(level, roleIds) {
  var rank = CFG.levelRank(level);
  var out = [];
  if (rank >= 1 && roleIds.COMMUNITY) out.push(roleIds.COMMUNITY);
  if (rank >= 2 && roleIds.ACADEMY) out.push(roleIds.ACADEMY);
  if (rank >= 3 && roleIds.PRO) out.push(roleIds.PRO);
  return out;
}

var IDS = { COMMUNITY: "c1", ACADEMY: "a1", PRO: "p1" };

test("0 KRM PUBLIC → aucun rôle", function () {
  assert.deepStrictEqual(rolesForLevel("PUBLIC", IDS), []);
});

test("100 COMMUNITY → community only", function () {
  assert.deepStrictEqual(rolesForLevel("COMMUNITY", IDS), ["c1"]);
});

test("250 ACADEMY → community + academy", function () {
  assert.deepStrictEqual(rolesForLevel("ACADEMY", IDS), ["c1", "a1"]);
});

test("500 PRO → trois rôles", function () {
  assert.deepStrictEqual(rolesForLevel("PRO", IDS), ["c1", "a1", "p1"]);
});

test("fichiers API présents", function () {
  assert.ok(fs.existsSync(path.join(__dirname, "../api/discord-torpass.php")));
  assert.ok(fs.existsSync(path.join(__dirname, "../api/discord-torpass-lib.php")));
  assert.ok(fs.existsSync(path.join(__dirname, "../deploy/DISCORD-TORPASS-ROLES.md")));
});

test("redirect + pull-api", function () {
  var r = fs.readFileSync(path.join(__dirname, "../_redirects"), "utf8");
  var p = fs.readFileSync(path.join(__dirname, "../deploy/vps/pull-api.sh"), "utf8");
  assert.ok(r.indexOf("discord-torpass.php") !== -1);
  assert.ok(p.indexOf("discord-torpass.php") !== -1);
});

test("torpass bouton auto", function () {
  var html = fs.readFileSync(path.join(__dirname, "../torpass.html"), "utf8");
  assert.ok(html.indexOf("discord-torpass.php") !== -1);
  assert.ok(html.indexOf("authorizeUrl") !== -1);
});

var failed = 0;
results.forEach(function (r) {
  console.log(r.result + " — " + r.name + (r.error ? " :: " + r.error : ""));
  if (r.result === "FAIL") failed++;
});
console.log(failed ? "FAILED " + failed : "ALL PASS (" + results.length + ")");
process.exit(failed ? 1 : 0);
