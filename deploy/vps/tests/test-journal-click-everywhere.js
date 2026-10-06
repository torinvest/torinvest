#!/usr/bin/env node
/**
 * Guards: nuclear clickEverywhere v15 navFix — CSP strip + MutationObserver + deep-link.
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
  path.join(__dirname, "../HOTFIX-JOURNAL-CLICK-EVERYWHERE.sh"),
  "utf8"
);
const forgeJournal = fs.readFileSync(
  path.join(__dirname, "../../../la-forge/js/forge-journal.js"),
  "utf8"
);

assert.ok(bridge.includes("clickEverywhere"), "clickEverywhere flag");
assert.ok(bridge.includes("keepInFrame"), "top/parent keepInFrame");
assert.ok(bridge.includes("absolutizeRadarAssets"), "radar asset absolutize");
assert.ok(bridge.includes("version: 15"), "version 15");
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
  bridge.includes("forge-jts:injectHardOff navFix v15"),
  "inject marker v15"
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
assert.ok(screens.includes("version: 15"), "screens version 15");
assert.ok(screens.includes("navFix: true"), "screens navFix");

assert.ok(hotfix.includes("MutationObserver"), "hotfix checks MutationObserver");
assert.ok(hotfix.includes("PM2_SCRIPT"), "hotfix pm2 script walk");
assert.ok(hotfix.includes("node --check"), "hotfix node --check");
assert.ok(hotfix.includes("cspStrip"), "hotfix requires cspStrip ping");
assert.ok(hotfix.includes("tradeRowObserver"), "hotfix requires tradeRowObserver");
assert.ok(hotfix.includes("navFix"), "hotfix requires navFix");
assert.ok(hotfix.includes("version: 15") || hotfix.includes("version:15"), "hotfix v15");
assert.ok(
  hotfix.includes("Content-Security-Policy"),
  "hotfix verifies CSP absence"
);

assert.ok(forgeJournal.includes("radar-url"), "shell deep-link");
assert.ok(forgeJournal.includes("journal-open-radar"), "shell rescue button");

console.log("OK — clickEverywhere v15 navFix nuclear + deep-link guards");
