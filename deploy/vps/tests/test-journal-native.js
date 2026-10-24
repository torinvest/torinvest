#!/usr/bin/env node
/** Tests — journal natif Forge (fichiers + contrat list→view→edit). */
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..", "..", "..");
const ROUTES = path.join(ROOT, "deploy/vps/formation-server/routes-journal-trades.js");
const JS = path.join(ROOT, "la-forge/js/forge-journal-native.js");
const CSS = path.join(ROOT, "la-forge/css/forge-journal-native.css");
const HTML = path.join(ROOT, "deploy/vps/app-shells/journal.html");
const DEPLOY = path.join(ROOT, "deploy/vps/DEPLOY-JOURNAL-NATIVE.sh");
const WIRE = path.join(ROOT, "deploy/vps/wire-formation-server-patches.js");
const ASSETS = path.join(ROOT, "deploy/vps/pull-forge-assets.sh");
const PULL = path.join(ROOT, "deploy/vps/pull-forge-all.sh");

function assert(c, m) {
  if (!c) throw new Error("FAIL: " + m);
}

assert(fs.existsSync(ROUTES), "routes");
assert(fs.existsSync(JS), "js");
assert(fs.existsSync(CSS), "css");
assert(fs.existsSync(HTML), "html");
assert(fs.existsSync(DEPLOY), "deploy");

const routes = fs.readFileSync(ROUTES, "utf8");
assert(routes.includes("createJournalTradesRouter"), "export router");
assert(routes.includes("/api/journal-trades"), "api path");
assert(routes.includes("Premium requis"), "premium gate");
assert(routes.includes("journal-trades"), "store dir");
assert(routes.includes("resolveOwner"), "owner isolation");
assert(routes.includes("Accès refusé"), "student cannot open other");
assert(routes.includes("/api/journal-trades-admin/students"), "admin students");
assert(routes.includes("dataUrls"), "multi screens");
assert(routes.includes("PATCH"), "caption patch");

const js = fs.readFileSync(JS, "utf8");
assert(js.includes("initJournalNative"), "init");
assert(js.includes('mode: "list"'), "list mode");
assert(js.includes("openTrade"), "openTrade view");
assert(js.includes("tj-edit"), "edit button");
assert(js.includes("Mode lecture"), "readonly banner");
assert(js.includes("data-trade-id"), "row click");
assert(js.includes("uploadShots"), "multi upload");
assert(js.includes("tj-owner-select"), "admin picker");
assert(js.includes("privés"), "privacy copy");

const html = fs.readFileSync(HTML, "utf8");
assert(html.includes("journal-native-root"), "root");
assert(html.includes("forge-journal-native.js"), "script");
assert(!html.includes('id="journal-frame"'), "no iframe");

const wire = fs.readFileSync(WIRE, "utf8");
assert(wire.includes("createJournalTradesRouter"), "wire require");
assert(wire.includes("ensureJournalTradesMounted"), "wire ensure");

const assets = fs.readFileSync(ASSETS, "utf8");
assert(assets.includes("forge-journal-native.js"), "assets js");
assert(assets.includes("forge-journal-native.css"), "assets css");

const pull = fs.readFileSync(PULL, "utf8");
assert(pull.includes("routes-journal-trades.js"), "pull routes");

const chk = spawnSync("node", ["--check", ROUTES], { encoding: "utf8" });
assert(chk.status === 0, "node --check routes");

console.log("ALL PASS — journal native (static)");
