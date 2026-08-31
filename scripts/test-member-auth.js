#!/usr/bin/env node
/** Tests locaux — soft gate membres (sans PHP). */
"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");

var results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name: name, result: "PASS" });
  } catch (e) {
    results.push({ name: name, result: "FAIL", error: e.message });
  }
}

var root = path.join(__dirname, "..");

test("API member-auth présente", function () {
  assert.ok(fs.existsSync(path.join(root, "api/member-auth.php")));
  assert.ok(fs.existsSync(path.join(root, "api/member-auth-lib.php")));
});

test("cookie member dans http-session", function () {
  var s = fs.readFileSync(path.join(root, "api/http-session.php"), "utf8");
  assert.ok(s.indexOf("torinvest_member") !== -1);
});

test("redirect Netlify member-auth", function () {
  var r = fs.readFileSync(path.join(root, "_redirects"), "utf8");
  assert.ok(r.indexOf("/api/member-auth.php") !== -1);
});

test("pull-api inclut member-auth", function () {
  var s = fs.readFileSync(path.join(root, "deploy/vps/pull-api.sh"), "utf8");
  assert.ok(s.indexOf("member-auth.php") !== -1);
});

test("pages membres + espace", function () {
  assert.ok(fs.existsSync(path.join(root, "membres.html")));
  assert.ok(fs.existsSync(path.join(root, "espace-membre.html")));
  assert.ok(fs.existsSync(path.join(root, "assets/torinvest-member-auth.js")));
});

test("pages contenu gated", function () {
  ["chroniques.html", "video.html", "crypto.html"].forEach(function (f) {
    var html = fs.readFileSync(path.join(root, f), "utf8");
    assert.ok(html.indexOf('data-member-required="1"') !== -1, f + " gate");
    assert.ok(html.indexOf("torinvest-member-auth.js") !== -1, f + " script");
  });
});

test("chroniques 4-14 gated", function () {
  for (var n = 4; n <= 14; n++) {
    var f = "chronique" + n + ".html";
    var html = fs.readFileSync(path.join(root, f), "utf8");
    assert.ok(html.indexOf('data-member-required="1"') !== -1, f + " gate");
    assert.ok(html.indexOf("torinvest-member-auth.js") !== -1, f + " script");
  }
});

test("tormission2 gated", function () {
  var html = fs.readFileSync(path.join(root, "tormission2.html"), "utf8");
  assert.ok(html.indexOf('data-member-required="1"') !== -1);
  assert.ok(html.indexOf("torinvest-member-auth.js") !== -1);
});

test("formation.html publique (hub La Forge)", function () {
  var html = fs.readFileSync(path.join(root, "formation.html"), "utf8");
  assert.ok(html.indexOf('data-member-required="1"') === -1, "formation public");
  assert.ok(html.indexOf("/la-forge/") !== -1, "formation CTA la-forge");
  assert.ok(html.indexOf("liste-attente-torinvest") === -1, "no waitlist");
});

test("pages publiques non gated", function () {
  ["index.html", "torpass.html", "activation.html", "disclaimer.html"].forEach(function (f) {
    var html = fs.readFileSync(path.join(root, f), "utf8");
    assert.ok(html.indexOf('data-member-required="1"') === -1, f + " must stay public");
  });
});

test("member-auth-lib admin list helpers", function () {
  var s = fs.readFileSync(path.join(root, "api/member-auth-lib.php"), "utf8");
  assert.ok(s.indexOf("memberAuthAdminList") !== -1);
  assert.ok(s.indexOf("memberAuthAdminExportCsv") !== -1);
});

test("admin-licence API site members actions", function () {
  var s = fs.readFileSync(path.join(root, "api/admin-licence.php"), "utf8");
  assert.ok(s.indexOf("list_site_members") !== -1);
  assert.ok(s.indexOf("export_site_members") !== -1);
});

test("admin-licence UI membres site tab", function () {
  var html = fs.readFileSync(path.join(root, "admin-licence/index.html"), "utf8");
  assert.ok(html.indexOf("data-tab=\"members\"") !== -1);
  assert.ok(html.indexOf("list_site_members") !== -1);
});

var failed = 0;
results.forEach(function (r) {
  console.log(r.result + " — " + r.name + (r.error ? " :: " + r.error : ""));
  if (r.result === "FAIL") failed++;
});
console.log(failed ? "FAILED " + failed : "ALL PASS (" + results.length + ")");
process.exit(failed ? 1 : 0);
