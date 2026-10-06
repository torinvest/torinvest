#!/usr/bin/env node
/**
 * Guards: nuclear clickEverywhere v13 — CSP strip + MutationObserver openTrade.
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

assert.ok(bridge.includes("clickEverywhere"), "clickEverywhere flag");
assert.ok(bridge.includes("keepInFrame"), "top/parent keepInFrame");
assert.ok(bridge.includes("absolutizeRadarAssets"), "radar asset absolutize");
assert.ok(bridge.includes("version: 13"), "version 13");
assert.ok(bridge.includes("__tjCspStripped"), "CSP strip nuclear");
assert.ok(bridge.includes("MutationObserver"), "trade row MutationObserver");
assert.ok(bridge.includes("goTrade"), "goTrade fallback");
assert.ok(bridge.includes("tradeIdFromEl"), "tradeIdFromEl");
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
  bridge.includes("forge-jts:injectHardOff clickEverywhere v13"),
  "inject marker v13"
);
// Trade-click path must not stopPropagation (capture kill). Comments mentioning
// "never stopPropagation" are fine; ban the call itself in the shim body.
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

assert.ok(hotfix.includes("MutationObserver"), "hotfix checks MutationObserver");
assert.ok(hotfix.includes("PM2_SCRIPT"), "hotfix pm2 script walk");
assert.ok(hotfix.includes("node --check"), "hotfix node --check");
assert.ok(hotfix.includes("clickEverywhere"), "hotfix requires clickEverywhere ping");

console.log("OK — clickEverywhere v13 nuclear guards");
