/**
 * Rappels Live coaching confirmés — emails 4 h et 1 h avant le créneau.
 *
 * Démarré depuis routes-coaching-lives.js (même process PM2).
 * Env :
 *   FORGE_COACHING_REMINDERS=0          → désactive
 *   FORGE_COACHING_TZ=Europe/Paris      → fuseau des créneaux date+start
 *   FORGE_COACHING_REMINDER_URL=…       → endpoint Brevo radar
 *   FORGE_FORMATION_PROVISION_SECRET=… → auth header (comme password mail)
 *   FORGE_SKIP_COACHING_BREVO=1         → tick sans envoi (tests)
 */
"use strict";

const fs = require("fs");
const path = require("path");

const WINDOWS = [
  { key: "4h", hoursBefore: 4 },
  { key: "1h", hoursBefore: 1 },
];

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

/**
 * Convertit date YYYY-MM-DD + HH:MM (heure murale dans timeZone) → epoch ms UTC.
 */
function zonedWallTimeToUtcMs(dateKey, timeHm, timeZone) {
  const [y, mo, d] = String(dateKey).split("-").map(Number);
  const [hh, mm] = String(timeHm).split(":").map(Number);
  if (![y, mo, d, hh, mm].every((n) => Number.isFinite(n))) return NaN;

  let guess = Date.UTC(y, mo - 1, d, hh, mm, 0);
  for (let i = 0; i < 4; i++) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone || "Europe/Paris",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(guess));
    const get = (type) => {
      const p = parts.find((x) => x.type === type);
      return p ? Number(p.value) : NaN;
    };
    let hour = get("hour");
    if (hour === 24) hour = 0;
    const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), hour, get("minute"));
    const wanted = Date.UTC(y, mo - 1, d, hh, mm);
    const delta = wanted - asUtc;
    if (delta === 0) break;
    guess += delta;
  }
  return guess;
}

function recipientForSession(session) {
  return normalizeEmail(session.studentEmail || session.confirmedBy || "");
}

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

async function sendReminderEmail(payload) {
  if (String(process.env.FORGE_SKIP_COACHING_BREVO || "").trim() === "1") {
    return { ok: true, skipped: true, reason: "FORGE_SKIP_COACHING_BREVO" };
  }
  const notifyUrl =
    process.env.FORGE_COACHING_REMINDER_URL ||
    "https://radar.torinvest-trading.com/api/coaching-live-reminder.php";
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
      signal: AbortSignal.timeout(25000),
    });
    const json = await res.json().catch(() => ({}));
    return {
      ok: res.ok && json && json.ok === true,
      status: res.status,
      ...(json && typeof json === "object" ? json : {}),
    };
  } catch (err) {
    return {
      ok: false,
      error: String(err && err.message ? err.message : err),
    };
  }
}

/**
 * Pour chaque live confirmé : si now >= start - Nh et now < start, et pas encore envoyé → mail.
 */
async function tickCoachingReminders(options) {
  const dataDir = options.dataDir;
  const storePath =
    options.storePath || path.join(dataDir, "coaching-lives", "sessions.json");
  const timeZone = options.timeZone || process.env.FORGE_COACHING_TZ || "Europe/Paris";
  const now = options.nowMs != null ? Number(options.nowMs) : Date.now();
  const sendFn = options.sendFn || sendReminderEmail;

  const store = readStore(storePath);
  let dirty = false;
  const results = [];

  for (const session of store.sessions) {
    if (!session || session.status !== "confirmed") continue;
    const email = recipientForSession(session);
    if (!email || !email.includes("@")) continue;

    const startMs = zonedWallTimeToUtcMs(session.date, session.start, timeZone);
    if (!Number.isFinite(startMs)) continue;
    if (now >= startMs) continue; // live déjà commencé / passé

    if (!session.reminders || typeof session.reminders !== "object") {
      session.reminders = {};
    }

    for (const win of WINDOWS) {
      if (session.reminders[win.key]) continue;
      const triggerAt = startMs - win.hoursBefore * 3600 * 1000;
      if (now < triggerAt) continue;

      const payload = {
        email,
        date: session.date,
        start: session.start,
        end: session.end,
        label: session.label || "Live coaching",
        hoursBefore: win.hoursBefore,
        sessionId: session.id,
        calendarUrl: "https://app.torinvest-trading.com/calendar.html",
      };

      const sent = await sendFn(payload);
      results.push({
        id: session.id,
        window: win.key,
        email,
        ok: !!(sent && sent.ok),
        detail: sent,
      });

      if (sent && sent.ok) {
        session.reminders[win.key] = new Date(now).toISOString();
        dirty = true;
      } else {
        console.warn(
          "[coaching-reminders] envoi échoué",
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

function startCoachingReminders(options) {
  const disabled = String(process.env.FORGE_COACHING_REMINDERS || "1").trim() === "0";
  if (disabled) {
    console.log("[coaching-reminders] désactivé (FORGE_COACHING_REMINDERS=0)");
    return { started: false, reason: "disabled" };
  }
  const dataDir = options && options.dataDir;
  if (!dataDir) throw new Error("startCoachingReminders: dataDir requis");

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
    tickCoachingReminders({ dataDir }).catch((err) => {
      console.warn("[coaching-reminders] tick error", err && err.message ? err.message : err);
    });
  };

  // Premier tick différé pour ne pas ralentir le boot
  setTimeout(run, 8000);
  _timer = setInterval(run, intervalMs);
  if (typeof _timer.unref === "function") _timer.unref();
  _startedFor = key;
  console.log("[coaching-reminders] démarré (interval=" + intervalMs + "ms, tz=" + (process.env.FORGE_COACHING_TZ || "Europe/Paris") + ")");
  return { started: true, intervalMs };
}

module.exports = {
  WINDOWS,
  zonedWallTimeToUtcMs,
  recipientForSession,
  tickCoachingReminders,
  startCoachingReminders,
  sendReminderEmail,
};
