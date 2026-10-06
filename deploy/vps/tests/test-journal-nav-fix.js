#!/usr/bin/env node
/**
 * Guards: navFix v16 — menu ?query must stay in /journal-embed/ (never radar/www root).
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

assert.ok(bridge.includes("navFix: true"), "navFix flag");
assert.ok(bridge.includes("version: 16"), "version 16");
assert.ok(bridge.includes('href="/journal-embed/?$2"'), "query href → embed");
assert.ok(bridge.includes("__tjForgeNavFix = 16"), "shim nav marker");
assert.ok(bridge.includes("__tjSsoDirect"), "shim ssoDirect marker");
assert.ok(bridge.includes("isJournalNav"), "isJournalNav helper");
assert.ok(
  bridge.includes('out = out.replace(/\\bhref=(["\'])\\/\\?([^"\']*)\\1/gi'),
  "root-relative /?query → embed"
);
assert.ok(
  bridge.includes("radar\\.torinvest-trading\\.com\\/?\\?"),
  "rewrites radar root+query"
);
assert.ok(
  /if \(!assetExt\.test\(clean\)\) return m/.test(bridge),
  "relative non-assets not forced to radar"
);
assert.ok(screens.includes("navFix: true"), "screens navFix");
assert.ok(screens.includes("version: 16"), "screens version 16");
assert.ok(hotfix.includes("ssoDirect"), "hotfix requires ssoDirect");
assert.ok(hotfix.includes("version: 16") || hotfix.includes('"version":\\s*16'), "hotfix v16");
assert.ok(
  hotfix.includes("cursor/journal-sso-direct-691a"),
  "hotfix pulls SSO direct branch"
);

// Simulate critical HTML rewrite (query + root-query)
function abs(html) {
  let out = html;
  out = out.replace(/\bhref=(["'])\?([^"']*)\1/gi, 'href="/journal-embed/?$2"');
  out = out.replace(/\bhref=(["'])\/\?([^"']*)\1/gi, 'href="/journal-embed/?$2"');
  return out;
}
assert.strictEqual(
  abs('<a href="?view=historique">H</a>'),
  '<a href="/journal-embed/?view=historique">H</a>'
);
assert.strictEqual(
  abs('<a href="?page=calendrier">C</a>'),
  '<a href="/journal-embed/?page=calendrier">C</a>'
);
assert.strictEqual(
  abs('<a href="/?view=historique">H</a>'),
  '<a href="/journal-embed/?view=historique">H</a>'
);

// Simulate fix() rules for menu escape paths
function fix(u) {
  if (!u || typeof u !== "string") return u;
  const s = u.trim();
  const P = "/journal-embed/";
  if (s.charAt(0) === "?") return P + s;
  if (/^\/\?/.test(s)) return P + s.slice(1);
  if (/^https?:\/\/radar\.torinvest-trading\.com\/trading_journal\.php/i.test(s)) {
    const q = s.indexOf("?");
    return P + (q >= 0 ? s.slice(q) : "");
  }
  if (/^\/?trading_journal\.php/i.test(s)) {
    const q2 = s.indexOf("?");
    return P + (q2 >= 0 ? s.slice(q2) : "");
  }
  if (/^https?:\/\/radar\.torinvest-trading\.com\/?\?/i.test(s)) {
    const q4 = s.indexOf("?");
    return P + (q4 >= 0 ? s.slice(q4) : "");
  }
  if (/^https?:\/\/app\.torinvest-trading\.com\/?\?/i.test(s)) {
    const q6 = s.indexOf("?");
    return P + (q6 >= 0 ? s.slice(q6) : "");
  }
  return u;
}
assert.strictEqual(fix("?view=historique"), "/journal-embed/?view=historique");
assert.strictEqual(fix("/?page=calendar"), "/journal-embed/?page=calendar");
assert.strictEqual(
  fix("https://radar.torinvest-trading.com/?view=historique"),
  "/journal-embed/?view=historique"
);
assert.strictEqual(
  fix("https://app.torinvest-trading.com/?page=calendar"),
  "/journal-embed/?page=calendar"
);
assert.strictEqual(
  fix("https://docs.example.com/guide"),
  "https://docs.example.com/guide"
);

console.log("OK — navFix v16 (menu stay in embed)");
