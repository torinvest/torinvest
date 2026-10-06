/**
 * Forensic guards for journal click→detail root cause:
 * Helmet script-src-attr 'none' blocked TJ onclick="openTrade(...)".
 * v14: bridge STRIPS CSP entirely on /journal-embed/* (match radar = no CSP).
 * Helmet patch still allows unsafe-inline as defense-in-depth for non-embed pages.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const ROOT = path.join(__dirname, "..", "..", "..");
const bridgePath = path.join(
  ROOT,
  "deploy/vps/formation-server/routes-journal-bridge.js"
);
const routesPath = path.join(
  ROOT,
  "deploy/vps/formation-server/routes-journal-trade-screens.js"
);
const helmetPath = path.join(ROOT, "deploy/vps/patch-helmet-journal-frames.js");

const bridge = fs.readFileSync(bridgePath, "utf8");
const routes = fs.readFileSync(routesPath, "utf8");
const helmet = fs.readFileSync(helmetPath, "utf8");

assert.ok(
  bridge.includes("__tjCspStripped"),
  "bridge must nuclear-strip CSP on journal-embed"
);
assert.ok(
  bridge.includes('scriptSrcAttr: "none-stripped"'),
  "bridge ping must advertise none-stripped"
);
assert.ok(
  bridge.includes("applyJournalEmbedCsp"),
  "bridge must call applyJournalEmbedCsp"
);
assert.ok(
  bridge.includes("forge-jts:injectHardOff"),
  "bridge must hard-off screens inject marker"
);
assert.ok(
  !bridge.includes('<script src="/js/forge-journal-trade-screens.js'),
  "bridge source must contain ZERO trade-screens script tags"
);
assert.ok(bridge.includes("cspClickFix: true"), "bridge ping cspClickFix");
assert.ok(bridge.includes("cspStrip: true"), "bridge ping cspStrip");
assert.ok(bridge.includes("version: 15"), "bridge ping version 15");
assert.ok(bridge.includes("navFix: true"), "bridge ping navFix");
assert.ok(
  bridge.includes("return false;"),
  "tradeScreensInjectEnabled must hard-return false"
);

assert.ok(routes.includes("version: 15"), "routes ping version 15");
assert.ok(routes.includes("navFix: true"), "routes ping navFix");
assert.ok(routes.includes("cspClickFix: true"), "routes ping cspClickFix");
assert.ok(routes.includes("cspStrip: true"), "routes ping cspStrip");
assert.ok(routes.includes("injectHardOff: true"), "routes injectHardOff");

assert.ok(
  helmet.includes("\"script-src-attr\": [\"'unsafe-inline'\"]"),
  "helmet patch must allow script-src-attr unsafe-inline"
);
assert.ok(
  !helmet.includes("\"script-src-attr\": [\"'none'\"]"),
  "helmet patch must NOT set script-src-attr none"
);
assert.ok(
  helmet.includes("torinvest-csp-v4-tj-onclick"),
  "helmet patch version marker v4"
);

// Document the TJ click contract that CSP must not break
const sample =
  '<tr data-trade-id="1" onclick="openTrade(1)"><td>EURUSD</td></tr>';
assert.ok(/onclick="openTrade\(1\)"/.test(sample), "TJ onclick contract");

console.log("OK — journal click CSP strip (v15 navFix) guards passed");
