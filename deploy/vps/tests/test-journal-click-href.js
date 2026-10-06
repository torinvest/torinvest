#!/usr/bin/env node
/**
 * Guards: location.href rewrite for openTrade → /journal-embed/
 * (trading_journal.php 404s on app.*).
 */
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const bridge = fs.readFileSync(
  path.join(__dirname, "../formation-server/routes-journal-bridge.js"),
  "utf8"
);

assert.ok(bridge.includes("hrefClickFix"), "bridge must advertise hrefClickFix");
assert.ok(
  bridge.includes('getOwnPropertyDescriptor(Location.prototype, "href")'),
  "bridge must patch Location.href setter"
);
assert.ok(bridge.includes("version: 12"), "bridge ping version 12");
assert.ok(
  bridge.includes('router.all("/trading_journal.php"'),
  "bridge must redirect /trading_journal.php → /journal-embed/"
);
assert.ok(
  bridge.includes("forge-jts:injectHardOff hrefClickFix v12"),
  "inject marker v12"
);

// Simulate fix() rules (same regexes as shim, unescaped)
function fix(u) {
  if (!u || typeof u !== "string") return u;
  const s = u.trim();
  const P = "/journal-embed/";
  if (/^https?:\/\/radar\.torinvest-trading\.com\/trading_journal\.php/i.test(s)) {
    const q = s.indexOf("?");
    return P + (q >= 0 ? s.slice(q) : "");
  }
  if (/^\/?trading_journal\.php/i.test(s)) {
    const q2 = s.indexOf("?");
    return P + (q2 >= 0 ? s.slice(q2) : "");
  }
  if (/^https?:\/\/app\.torinvest-trading\.com\/trading_journal\.php/i.test(s)) {
    const q3 = s.indexOf("?");
    return P + (q3 >= 0 ? s.slice(q3) : "");
  }
  return u;
}

assert.strictEqual(
  fix("trading_journal.php?action=view&id=42"),
  "/journal-embed/?action=view&id=42"
);
assert.strictEqual(
  fix("/trading_journal.php?id=7"),
  "/journal-embed/?id=7"
);
assert.strictEqual(
  fix("https://radar.torinvest-trading.com/trading_journal.php?view=1"),
  "/journal-embed/?view=1"
);
assert.strictEqual(
  fix("https://app.torinvest-trading.com/trading_journal.php?x=1"),
  "/journal-embed/?x=1"
);
assert.strictEqual(fix("/journal-embed/?ok=1"), "/journal-embed/?ok=1");

console.log("OK — hrefClickFix guards + fix() cases");
