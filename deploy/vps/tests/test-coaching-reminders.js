#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const lib = require("../formation-server/coaching-reminders-lib");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "coach-remind-"));
const storePath = path.join(tmp, "sessions.json");

function writeSessions(sessions) {
  fs.writeFileSync(
    storePath,
    JSON.stringify({ sessions, updated: new Date().toISOString() }, null, 2)
  );
}

async function main() {
  const tz = "Europe/Paris";
  // Pick a fixed wall start far in the future relative to a fake now.
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
      id: "cl_test1",
      date,
      start,
      end: "19:00",
      label: "Live coaching test",
      status: "confirmed",
      studentEmail: "eleve@example.com",
      confirmedBy: "eleve@example.com",
    },
    {
      id: "cl_proposed",
      date,
      start: "16:00",
      end: "17:00",
      label: "Pas encore confirmé",
      status: "proposed",
      studentEmail: "eleve@example.com",
    },
  ]);

  // Avant la fenêtre 4h → rien
  let r = await lib.tickCoachingReminders({
    storePath,
    dataDir: tmp,
    timeZone: tz,
    nowMs: startMs - 5 * 3600 * 1000,
    sendFn,
  });
  assert.strictEqual(sent.length, 0, "pas d'envoi 5h avant");

  // Dans la fenêtre 4h → un mail 4h
  r = await lib.tickCoachingReminders({
    storePath,
    dataDir: tmp,
    timeZone: tz,
    nowMs: startMs - 4 * 3600 * 1000 + 30 * 1000,
    sendFn,
  });
  assert.strictEqual(sent.length, 1, "mail 4h");
  assert.strictEqual(sent[0].hoursBefore, 4);
  assert.strictEqual(sent[0].email, "eleve@example.com");

  // Idempotence 4h
  r = await lib.tickCoachingReminders({
    storePath,
    dataDir: tmp,
    timeZone: tz,
    nowMs: startMs - 3.5 * 3600 * 1000,
    sendFn,
  });
  assert.strictEqual(sent.length, 1, "pas de double 4h");

  // Fenêtre 1h
  r = await lib.tickCoachingReminders({
    storePath,
    dataDir: tmp,
    timeZone: tz,
    nowMs: startMs - 1 * 3600 * 1000 + 10 * 1000,
    sendFn,
  });
  assert.strictEqual(sent.length, 2, "mail 1h");
  assert.strictEqual(sent[1].hoursBefore, 1);

  // Après le live → rien de plus
  r = await lib.tickCoachingReminders({
    storePath,
    dataDir: tmp,
    timeZone: tz,
    nowMs: startMs + 60 * 1000,
    sendFn,
  });
  assert.strictEqual(sent.length, 2, "rien après start");

  const stored = JSON.parse(fs.readFileSync(storePath, "utf8"));
  const s = stored.sessions.find((x) => x.id === "cl_test1");
  assert.ok(s.reminders && s.reminders["4h"] && s.reminders["1h"], "reminders persisted");

  console.log("OK — coaching reminders (" + (r.results || []).length + " last results)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
