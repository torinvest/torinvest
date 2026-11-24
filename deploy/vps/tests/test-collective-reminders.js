#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const lib = require("../formation-server/collective-reminders-lib");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "col-remind-"));
const storePath = path.join(tmp, "sessions.json");

function writeSessions(sessions) {
  fs.writeFileSync(
    storePath,
    JSON.stringify({ sessions, updated: new Date().toISOString() }, null, 2)
  );
}

async function main() {
  const tz = "Europe/Paris";
  const date = "2030-06-15";
  const start = "18:00";
  const startMs = lib.zonedWallTimeToUtcMs(date, start, tz);
  assert.ok(Number.isFinite(startMs), "startMs finite");

  const sent = [];
  const sendFn = async (payload) => {
    sent.push(payload);
    return { ok: true };
  };

  writeSessions([
    {
      id: "col_test1",
      date,
      start,
      end: "19:00",
      label: "Live collectif test",
      status: "scheduled",
      channel: "discord",
      url: "https://discord.gg/example",
    },
    {
      id: "col_cancelled",
      date,
      start: "16:00",
      end: "17:00",
      label: "Annulé",
      status: "cancelled",
    },
  ]);

  let r = await lib.tickCollectiveReminders({
    storePath,
    dataDir: tmp,
    timeZone: tz,
    nowMs: startMs - 5 * 3600 * 1000,
    sendFn,
  });
  assert.strictEqual(sent.length, 0, "pas d'envoi 5h avant");

  r = await lib.tickCollectiveReminders({
    storePath,
    dataDir: tmp,
    timeZone: tz,
    nowMs: startMs - 4 * 3600 * 1000 + 30 * 1000,
    sendFn,
  });
  assert.strictEqual(sent.length, 1, "mail 4h");
  assert.strictEqual(sent[0].hoursBefore, 4);
  assert.strictEqual(sent[0].kind, "collective");

  r = await lib.tickCollectiveReminders({
    storePath,
    dataDir: tmp,
    timeZone: tz,
    nowMs: startMs - 4 * 3600 * 1000 + 60 * 1000,
    sendFn,
  });
  assert.strictEqual(sent.length, 1, "idempotence 4h");

  r = await lib.tickCollectiveReminders({
    storePath,
    dataDir: tmp,
    timeZone: tz,
    nowMs: startMs - 1 * 3600 * 1000 + 30 * 1000,
    sendFn,
  });
  assert.strictEqual(sent.length, 2, "mail 1h");
  assert.strictEqual(sent[1].hoursBefore, 1);

  console.log("OK collective-reminders", r.checked, "sessions");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
