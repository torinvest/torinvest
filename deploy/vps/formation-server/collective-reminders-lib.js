/**
 * Rappels Live collectif — emails Brevo (liste accompagnement) 4 h et 1 h avant.
 * Démarré depuis routes-collective-lives.js.
 *
 * Env :
 *   FORGE_COLLECTIVE_REMINDERS=0
 *   FORGE_COACHING_TZ=Europe/Paris
 *   FORGE_COLLECTIVE_REMINDER_URL=…  (défaut: radar weekly/collective endpoint)
 *   FORGE_FORMATION_PROVISION_SECRET=…
 *   FORGE_SKIP_COACHING_BREVO=1
 */
"use strict";

const fs = require("fs");
const path = require("path");
const coaching = require("./coaching-reminders-lib");

const WINDOWS = coaching.WINDOWS;
const zonedWallTimeToUtcMs = coaching.zonedWallTimeToUtcMs;

function readStore(storePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(storePath, "utf8"));
    return {
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      updated: parsed.updated || null,
    };
  } catch (_) {
    return { sessions: [], updated: null };
  }
}

function writeStore(storePath, sessions) {
  const payload = {
    sessions: sessions || [],
    updated: new Date().toISOString(),
  };
  fs.writeFileSync(storePath, JSON.stringify(payload, null, 2));
  return payload;
}

async function sendCollectiveReminder(payload) {
  if (String(process.env.FORGE_SKIP_COACHING_BREVO || "").trim() === "1") {
    return { ok: true, skipped: true, reason: "FORGE_SKIP_COACHING_BREVO" };
  }
  const notifyUrl =
    process.env.FORGE_COLLECTIVE_REMINDER_URL ||
    "https://radar.torinvest-trading.com/api/collective-live-reminder.php";
  const secret = String(
    process.env.FORGE_FORMATION_PROVISION_SECRET ||
      process.env.FORMATION_PROVISION_SECRET ||
      ""
  ).trim();
  if (!secret) {
    return { ok: false, error: "FORGE_FORMATION_PROVISION_SECRET manquant" };
  }
  try {
    const res = await fetch(notifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Formation-Provision-Key": secret,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(45000),
    });
    const json = await res.json().catch(() => ({}));
    return {
      ok: res.ok && json && json.ok === true,
      status: res.status,
      ...(json && typeof json === "object" ? json : {}),
    };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

async function tickCollectiveReminders(options) {
  const dataDir = options.dataDir;
  const storePath =
    options.storePath || path.join(dataDir, "collective-lives", "sessions.json");
  const timeZone = options.timeZone || process.env.FORGE_COACHING_TZ || "Europe/Paris";
  const now = options.nowMs != null ? Number(options.nowMs) : Date.now();
  const sendFn = options.sendFn || sendCollectiveReminder;

  const store = readStore(storePath);
  let dirty = false;
  const results = [];

  for (const session of store.sessions) {
    if (!session || session.status !== "scheduled") continue;
    const startMs = zonedWallTimeToUtcMs(session.date, session.start, timeZone);
    if (!Number.isFinite(startMs)) continue;
    if (now >= startMs) continue;

    if (!session.reminders || typeof session.reminders !== "object") {
      session.reminders = {};
    }

    for (const win of WINDOWS) {
      if (session.reminders[win.key]) continue;
      const triggerAt = startMs - win.hoursBefore * 3600 * 1000;
      if (now < triggerAt) continue;

      const payload = {
        kind: "collective",
        date: session.date,
        start: session.start,
        end: session.end,
        label: session.label || "Live collectif",
        hoursBefore: win.hoursBefore,
        sessionId: session.id,
        channel: session.channel || "",
        url: session.url || "",
        calendarUrl: "https://app.torinvest-trading.com/calendar.html",
      };

      const sent = await sendFn(payload);
      results.push({
        id: session.id,
        window: win.key,
        ok: !!(sent && sent.ok),
        detail: sent,
      });

      if (sent && sent.ok) {
        session.reminders[win.key] = new Date(now).toISOString();
        dirty = true;
      } else {
        console.warn(
          "[collective-reminders] envoi échoué",
          session.id,
          win.key,
          sent && (sent.error || sent.status)
        );
      }
    }
  }

  if (dirty) writeStore(storePath, store.sessions);
  return { ok: true, checked: store.sessions.length, results };
}

let _timer = null;
let _startedFor = null;

function startCollectiveReminders(options) {
  const disabled = String(process.env.FORGE_COLLECTIVE_REMINDERS || "1").trim() === "0";
  if (disabled) {
    console.log("[collective-reminders] désactivé (FORGE_COLLECTIVE_REMINDERS=0)");
    return { started: false, reason: "disabled" };
  }
  const dataDir = options && options.dataDir;
  if (!dataDir) throw new Error("startCollectiveReminders: dataDir requis");

  const key = path.resolve(dataDir);
  if (_timer && _startedFor === key) {
    return { started: true, already: true };
  }
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }

  const intervalMs = Math.max(15000, Number(options.intervalMs) || 60000);
  const run = () => {
    tickCollectiveReminders({ dataDir }).catch((err) => {
      console.warn(
        "[collective-reminders] tick error",
        err && err.message ? err.message : err
      );
    });
  };

  setTimeout(run, 12000);
  _timer = setInterval(run, intervalMs);
  if (typeof _timer.unref === "function") _timer.unref();
  _startedFor = key;
  console.log(
    "[collective-reminders] démarré (interval=" +
      intervalMs +
      "ms, tz=" +
      (process.env.FORGE_COACHING_TZ || "Europe/Paris") +
      ")"
  );
  return { started: true, intervalMs };
}

module.exports = {
  WINDOWS,
  zonedWallTimeToUtcMs,
  tickCollectiveReminders,
  startCollectiveReminders,
  sendCollectiveReminder,
};
