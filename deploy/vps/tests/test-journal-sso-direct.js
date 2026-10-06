#!/usr/bin/env node
/**
 * Guards: journal SSO DIRECT v16 — default open = radar native TJ.
 */
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const bridge = fs.readFileSync(
  path.join(__dirname, "../formation-server/routes-journal-bridge.js"),
  "utf8"
);
const screens = fs.readFileSync(
  path.join(__dirname, "../formation-server/routes-journal-trade-screens.js"),
  "utf8"
);
const forgeJournal = fs.readFileSync(
  path.join(__dirname, "../../../la-forge/js/forge-journal.js"),
  "utf8"
);
const journalHtml = fs.readFileSync(
  path.join(__dirname, "../app-shells/journal.html"),
  "utf8"
);
const hotfix = fs.readFileSync(
  path.join(__dirname, "../HOTFIX-JOURNAL-SSO-DIRECT.sh"),
  "utf8"
);

assert.ok(bridge.includes("version: 16"), "bridge version 16");
assert.ok(bridge.includes("ssoDirect: true"), "bridge ssoDirect");
assert.ok(bridge.includes("radar-url"), "radar-url endpoint");

assert.ok(screens.includes("version: 16"), "screens version 16");
assert.ok(screens.includes("ssoDirect: true"), "screens ssoDirect");

assert.ok(forgeJournal.includes("radar-url"), "shell fetches radar-url");
assert.ok(
  forgeJournal.includes("window.top.location") || forgeJournal.includes("goTop"),
  "shell uses top navigation"
);
assert.ok(forgeJournal.includes("journal-open-embed"), "optional embed mode");
assert.ok(forgeJournal.includes("openRadarDirect"), "default SSO open");
assert.ok(!forgeJournal.includes("journal-open-radar"), "old rescue id removed");

assert.ok(journalHtml.includes("forge-journal.js?v=16"), "cache-bust v16");
assert.ok(
  journalHtml.includes("Ouvrir Trading Journal Pro"),
  "primary CTA label"
);
assert.ok(journalHtml.includes("journal-open-embed"), "embed button in HTML");
assert.ok(
  journalHtml.includes("Mode intégré (iframe)"),
  "secondary embed label"
);

assert.ok(hotfix.includes("version: 16") || hotfix.includes("version:16"), "hotfix v16");
assert.ok(hotfix.includes("ssoDirect"), "hotfix requires ssoDirect");
assert.ok(
  hotfix.includes("cursor/journal-sso-direct-691a"),
  "hotfix pulls THIS branch"
);
assert.ok(hotfix.includes("forge-journal.js"), "hotfix deploys forge-journal");
assert.ok(hotfix.includes("journal.html"), "hotfix deploys journal.html");

console.log("OK — journal SSO direct v16");
