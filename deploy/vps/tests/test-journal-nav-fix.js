#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const bridge = fs.readFileSync(
  path.join(__dirname, "../formation-server/routes-journal-bridge.js"),
  "utf8"
);
assert.ok(bridge.includes("navFix: true"), "navFix flag");
assert.ok(bridge.includes("version: 15"), "version 15");
assert.ok(bridge.includes('href="/journal-embed/?$2"'), "query href → embed");
assert.ok(bridge.includes("__tjForgeNavFix = 15"), "shim nav marker");
assert.ok(!/return attr \+ "=" \+ q \+ base \+ "\/" \+ path\.replace/.test(
  bridge.match(/Relative paths: ONLY static assets[\s\S]{0,400}/)?.[0] || ""
) || bridge.includes("if (!assetExt.test(clean)) return m"), "relative non-assets not forced to radar");
// Simulate critical rewrite
function abs(html) {
  let out = html;
  out = out.replace(/\bhref=(["'])\?([^"']*)\1/gi, 'href="/journal-embed/?$2"');
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
console.log("OK — navFix v15");
