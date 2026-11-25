#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const lib = require("../formation-server/weekly-digest-lib");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "weekly-digest-"));

async function main() {
  const sent = [];
  const sendFn = async (payload) => {
    sent.push(payload);
    return { ok: true };
  };

  // Force send regardless of weekday
  const r = await lib.tickWeeklyDigest({
    dataDir: tmp,
    nowMs: Date.now(),
    force: true,
    sendFn,
  });
  assert.ok(r.ok, "force send ok");
  assert.strictEqual(sent.length, 1, "one campaign");
  assert.ok(sent[0].weekKey, "weekKey present");
  assert.ok(sent[0].dashboardUrl.includes("dashboard"));

  // Idempotence without force
  const r2 = await lib.tickWeeklyDigest({
    dataDir: tmp,
    nowMs: Date.now(),
    force: true,
    sendFn,
  });
  // force:true bypasses already_sent — so second send happens.
  // Without force after first: skip
  const r3 = await lib.tickWeeklyDigest({
    dataDir: tmp,
    nowMs: Date.now(),
    force: false,
    sendFn,
  });
  assert.ok(r3.skipped, "second non-force skipped or not sunday");

  console.log("OK weekly-digest", r.weekKey, "sent=", sent.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
