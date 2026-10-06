#!/usr/bin/env node
/**
 * Guards: nuclear clickEverywhere v16 navFix — CSP strip + MutationObserver + deep-link.
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
const hotfix = fs.readFileSync(
  path.join(__dirname, "../HOTFIX-JOURNAL-SSO-DIRECT.sh"),
  "utf8"
);
const forgeJournal = fs.readFileSync(
  path.join(__dirname, "../../../la-forge/js/forge-journal.js"),
  "utf8"
);

assert.ok(bridge.includes("clickEverywhere"), "clickEverywhere flag");
assert.ok(bridge.includes("keepInFrame"), "top/parent keepInFrame");
assert.ok(bridge.includes("absolutizeRadarAssets"), "radar asset absolutize");
assert.ok(bridge.includes("version: 16"), "version 16");
assert.ok(bridge.includes("navFix: true"), "navFix");
assert.ok(bridge.includes("__tjCspStripped"), "CSP strip nuclear");
assert.ok(bridge.includes("MutationObserver"), "trade row MutationObserver");
assert.ok(bridge.includes("goTrade"), "goTrade fallback");
assert.ok(bridge.includes("tradeIdFromEl"), "tradeIdFromEl");
assert.ok(bridge.includes("radar-url"), "SSO deep-link API");
assert.ok(
  bridge.includes("(?!https?:|\\/\\/|\\/|\\?|#|data:|blob:|javascript:|mailto:)"),
  "relative asset absolutize (skip query)"
);
assert.ok(
  bridge.includes("Content-Security-Policy"),
  "mentions CSP (to strip)"
);
assert.ok(
  /http-equiv\s*=\s*\["'\]Content-Security-Policy/.test(bridge) ||
    bridge.includes('http-equiv\\s*=\\s*["\']Content-Security-Policy'),
  "strips meta CSP"
);
assert.ok(
  bridge.includes("forge-jts:injectHardOff navFix v16"),
  "inject marker v16"
);
{
  const shimMatch = bridge.match(/const shim = `([\s\S]*?)`;/);
  assert.ok(shimMatch, "shim template exists");
  const shimBody = shimMatch[1];
  assert.ok(
    !/\.stopPropagation\s*\(/.test(shimBody),
    "shim must not call stopPropagation"
  );
  assert.ok(
    !/\.stopImmediatePropagation\s*\(/.test(shimBody),
    "shim must not call stopImmediatePropagation"
  );
}

assert.ok(screens.includes("clickEverywhere"), "screens ping clickEverywhere");
assert.ok(screens.includes("cspStrip"), "screens ping cspStrip");
assert.ok(screens.includes("tradeRowObserver"), "screens ping tradeRowObserver");
assert.ok(screens.includes("version: 16"), "screens version 16");
assert.ok(screens.includes("navFix: true"), "screens navFix");

assert.ok(hotfix.includes("PM2_SCRIPT"), "hotfix pm2 script walk");
assert.ok(hotfix.includes("node --check"), "hotfix node --check");
assert.ok(hotfix.includes("ssoDirect"), "hotfix requires ssoDirect");
assert.ok(hotfix.includes("version: 16") || hotfix.includes("version:16"), "hotfix v16");
assert.ok(
  hotfix.includes("cursor/journal-sso-direct-691a"),
  "hotfix pulls SSO direct branch"
);

assert.ok(forgeJournal.includes("radar-url"), "shell deep-link");
assert.ok(
  forgeJournal.includes("openRadarDirect") || forgeJournal.includes("window.top.location"),
  "shell SSO direct default"
);
assert.ok(forgeJournal.includes("journal-open-embed"), "optional embed mode");

console.log("OK — clickEverywhere + SSO direct v16 guards");
