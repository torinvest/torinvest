#!/usr/bin/env node
/** Tests Masterclass Macro — config, store, gate admin/grant, sales guard. */
"use strict";

var assert = require("assert");
var fs = require("fs");
var os = require("os");
var path = require("path");

var root = path.join(__dirname, "..");
var mcDir = path.join(root, "deploy/vps/formation-server/masterclass");
var { publicCatalog, mergeConfig, getDefaultConfig } = require(path.join(
  mcDir,
  "config.js"
));
var { createMasterclassStore } = require(path.join(mcDir, "store.js"));

var results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name: name, result: "PASS" });
  } catch (e) {
    results.push({ name: name, result: "FAIL", error: e.message });
  }
}

test("fichiers socle présents", function () {
  [
    "deploy/vps/formation-server/routes-masterclass.js",
    "deploy/vps/formation-server/masterclass/config.js",
    "deploy/vps/formation-server/masterclass/store.js",
    "deploy/vps/app-shells/masterclass.html",
    "deploy/vps/app-shells/masterclass-chapter.html",
    "la-forge/js/forge-masterclass.js",
    "la-forge/css/forge-masterclass.css",
    "deploy/vps/DEPLOY-MASTERCLASS.sh",
    "deploy/vps/MASTERCLASS.md",
    "deploy/vps/masterclass-seed/index.json",
    "scripts/import-masterclass-docx.py",
  ].forEach(function (rel) {
    assert.ok(fs.existsSync(path.join(root, rel)), "missing " + rel);
  });
});

test("config défaut = draft / admin_only / sales off", function () {
  var c = getDefaultConfig();
  assert.strictEqual(c.publication_status, "draft");
  assert.strictEqual(c.visibility, "admin_only");
  assert.strictEqual(c.sales_enabled, false);
  assert.strictEqual(c.price_amount, null);
  assert.strictEqual(c.payment_url, null);
  assert.strictEqual(c.chapterCount, 23);
});

test("publicCatalog masque prix tant que ventes off", function () {
  var cat = publicCatalog({
    sales_enabled: false,
    publication_status: "published",
    price_amount: 999,
    payment_url: "https://pay.example/x",
  });
  assert.strictEqual(cat.price_amount, null);
  assert.strictEqual(cat.payment_url, null);
  assert.strictEqual(cat.sales_enabled, false);
});

test("publicCatalog expose prix seulement si published + sales", function () {
  var cat = publicCatalog({
    sales_enabled: true,
    publication_status: "published",
    price_amount: 490,
    payment_url: "https://pay.example/ok",
    currency: "EUR",
  });
  assert.strictEqual(cat.price_amount, 490);
  assert.strictEqual(cat.payment_url, "https://pay.example/ok");
});

test("store grants + chapters + progress", function () {
  var tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mc-test-"));
  var store = createMasterclassStore(tmp);
  var cfg = store.loadConfig();
  assert.strictEqual(cfg.visibility, "admin_only");

  store.saveConfig({ publication_status: "published", visibility: "granted" });
  assert.strictEqual(store.loadConfig().publication_status, "published");

  store.saveGrants([
    { email: "eleve@example.com", grantedAt: new Date().toISOString(), revokedAt: null },
  ]);
  assert.ok(store.hasGrant("eleve@example.com"));
  assert.ok(!store.hasGrant("autre@example.com"));

  var chPath = store.chapterPath(1);
  fs.writeFileSync(
    chPath,
    JSON.stringify({
      id: "ch01",
      number: 1,
      title: "Test",
      status: "published",
      sections: [],
      tables: [],
    }),
    "utf8"
  );
  assert.deepStrictEqual(store.listChapterNumbers(), [1]);
  assert.strictEqual(store.loadChapter(1).title, "Test");

  var prog = store.saveProgress("eleve@example.com", {
    chapters: { "1": { completed: true, sectionsDone: 2 } },
  });
  assert.ok(prog.chapters["1"].completed);
  assert.ok(prog.updatedAt);
});

test("index seed = 23 chapitres", function () {
  var idx = JSON.parse(
    fs.readFileSync(path.join(root, "deploy/vps/masterclass-seed/index.json"), "utf8")
  );
  assert.strictEqual(idx.chapterCount, 23);
  assert.strictEqual(idx.chapters.length, 23);
  assert.strictEqual(idx.chapters[0].number, 1);
  assert.strictEqual(idx.chapters[22].number, 23);
});

test("wire monte createMasterclassRouter", function () {
  var wire = fs.readFileSync(
    path.join(root, "deploy/vps/wire-formation-server-patches.js"),
    "utf8"
  );
  assert.ok(wire.indexOf("createMasterclassRouter") !== -1);
  assert.ok(wire.indexOf("ensureMasterclassMounted") !== -1);
  assert.ok(wire.indexOf("routes-masterclass") !== -1);
});

test("routes : sales_enabled exige prix+url", function () {
  var src = fs.readFileSync(
    path.join(root, "deploy/vps/formation-server/routes-masterclass.js"),
    "utf8"
  );
  assert.ok(src.indexOf("sales_requires_price_and_url") !== -1);
  assert.ok(src.indexOf("requireContentAccess") !== -1);
  assert.ok(src.indexOf("admin_only") !== -1);
  assert.ok(src.indexOf("/api/masterclass/chapters/:num") !== -1);
});

test("dashboard carte masterclass hidden par défaut", function () {
  var html = fs.readFileSync(
    path.join(root, "deploy/vps/app-shells/dashboard.html"),
    "utf8"
  );
  assert.ok(html.indexOf('id="masterclass-access" hidden') !== -1);
  assert.ok(html.indexOf("/masterclass.html") !== -1);
  assert.ok(html.indexOf("Parcours ÉLITE") !== -1);
});

test("gitignore protège contenu privé", function () {
  var gi = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
  assert.ok(/private\//.test(gi));
  assert.ok(gi.indexOf("deploy/vps/masterclass-seed/chapters/") !== -1);
});

test("accès logique admin vs élève (simulation)", function () {
  var tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mc-access-"));
  var store = createMasterclassStore(tmp);
  // défaut draft/admin_only
  function canAccess(email, isAdmin) {
    if (isAdmin) return { ok: true, role: "admin" };
    var cfg = store.loadConfig();
    if (cfg.publication_status !== "published") return { ok: false, reason: "not_published" };
    if (cfg.visibility === "admin_only") return { ok: false, reason: "admin_only" };
    if (store.hasGrant(email)) return { ok: true, role: "granted" };
    return { ok: false, reason: "no_grant" };
  }
  assert.strictEqual(canAccess("a@x.com", true).ok, true);
  assert.strictEqual(canAccess("eleve@x.com", false).reason, "not_published");
  store.saveConfig({ publication_status: "published", visibility: "admin_only" });
  assert.strictEqual(canAccess("eleve@x.com", false).reason, "admin_only");
  store.saveConfig({ visibility: "granted" });
  assert.strictEqual(canAccess("eleve@x.com", false).reason, "no_grant");
  store.saveGrants([{ email: "eleve@x.com", grantedAt: "2026-01-01", revokedAt: null }]);
  assert.strictEqual(canAccess("eleve@x.com", false).role, "granted");
});

var failed = results.filter(function (r) {
  return r.result === "FAIL";
});
results.forEach(function (r) {
  console.log(r.result + " — " + r.name + (r.error ? " :: " + r.error : ""));
});
if (failed.length) {
  console.error("FAILED " + failed.length);
  process.exit(1);
}
console.log("ALL PASS — masterclass (" + results.length + " tests)");
