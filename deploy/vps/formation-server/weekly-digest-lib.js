/**
 * Bilan hebdomadaire La Forge — mail Brevo (liste accompagnement) le dimanche.
 *
 * Env :
 *   FORGE_WEEKLY_DIGEST=0
 *   FORGE_COACHING_TZ=Europe/Paris
 *   FORGE_WEEKLY_DIGEST_URL=https://radar…/api/weekly-digest.php
 *   FORGE_WEEKLY_DIGEST_HOUR=9   (heure locale Paris)
 *   FORGE_FORMATION_PROVISION_SECRET=…
 *   FORGE_SKIP_COACHING_BREVO=1
 */
"use strict";

const fs = require("fs");
const path = require("path");
const coaching = require("./coaching-reminders-lib");

function isoWeekKey(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone || "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type) => {
    const p = parts.find((x) => x.type === type);
    return p ? p.value : "";
  };
  const y = Number(get("year"));
  const m = Number(get("month"));
  const d = Number(get("day"));
  const weekday = get("weekday"); // Sun, Mon…
  const hour = Number(get("hour"));
  // ISO week: Thursday-based
  const utc = new Date(Date.UTC(y, m - 1, d));
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((utc - yearStart) / 86400000 + 1) / 7);
  const weekKey = utc.getUTCFullYear() + "-W" + String(weekNo).padStart(2, "0");
  return { weekKey, weekday, hour, dateKey: y + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0") };
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (_) {
    return fallback;
  }
}

function writeJson(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
}

function nextCollectiveBlurb(dataDir, timeZone, nowMs) {
  const storePath = path.join(dataDir, "collective-lives", "sessions.json");
  const store = readJson(storePath, { sessions: [] });
  const sessions = Array.isArray(store.sessions) ? store.sessions : [];
  let best = null;
  let bestMs = Infinity;
  for (const s of sessions) {
    if (!s || s.status !== "scheduled") continue;
    const startMs = coaching.zonedWallTimeToUtcMs(s.date, s.start, timeZone);
    if (!Number.isFinite(startMs) || startMs < nowMs) continue;
    if (startMs < bestMs) {
      bestMs = startMs;
      best = s;
    }
  }
  if (!best) return "";
  return (
    (best.label || "Live collectif") +
    " — " +
    best.date +
    " · " +
    best.start +
    (best.end ? "–" + best.end : "")
  );
}

function progressSnapshot(dataDir) {
  const dir = path.join(dataDir, "progress");
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch (_) {
    return { studentsWithProgress: 0, modulesCompletedSum: 0 };
  }
  let modulesCompletedSum = 0;
  for (const f of files) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      const modules = (raw && raw.modules) || {};
      for (const id of Object.keys(modules)) {
        if (modules[id] && (modules[id].completed || modules[id].done)) {
          modulesCompletedSum += 1;
        }
      }
    } catch (_) {}
  }
  return { studentsWithProgress: files.length, modulesCompletedSum };
}

async function sendWeeklyDigest(payload) {
  if (String(process.env.FORGE_SKIP_COACHING_BREVO || "").trim() === "1") {
    return { ok: true, skipped: true, reason: "FORGE_SKIP_COACHING_BREVO" };
  }
  const notifyUrl =
    process.env.FORGE_WEEKLY_DIGEST_URL ||
    "https://radar.torinvest-trading.com/api/weekly-digest.php";
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

async function tickWeeklyDigest(options) {
  const dataDir = options.dataDir;
  const timeZone = options.timeZone || process.env.FORGE_COACHING_TZ || "Europe/Paris";
  const now = options.nowMs != null ? Number(options.nowMs) : Date.now();
  const sendFn = options.sendFn || sendWeeklyDigest;
  const targetHour = Number(process.env.FORGE_WEEKLY_DIGEST_HOUR || 9);
  const force = !!options.force;

  const meta = isoWeekKey(new Date(now), timeZone);
  if (!force) {
    if (meta.weekday !== "Sun") {
      return { ok: true, skipped: true, reason: "not_sunday", meta };
    }
    if (meta.hour < targetHour) {
      return { ok: true, skipped: true, reason: "before_hour", meta };
    }
  }

  const jobPath = path.join(dataDir, "email-jobs", "weekly-digest.json");
  const job = readJson(jobPath, { sent: {} });
  if (!force && job.sent && job.sent[meta.weekKey]) {
    return { ok: true, skipped: true, reason: "already_sent", weekKey: meta.weekKey };
  }

  const nextLive = nextCollectiveBlurb(dataDir, timeZone, now);
  const progress = progressSnapshot(dataDir);
  const payload = {
    weekKey: meta.weekKey,
    dateKey: meta.dateKey,
    nextLive,
    progress,
    dashboardUrl: "https://app.torinvest-trading.com/dashboard.html",
    cryptoUrl: "https://app.torinvest-trading.com/crypto/index.html",
    journalUrl: "https://app.torinvest-trading.com/journal.html",
    calendarUrl: "https://app.torinvest-trading.com/calendar.html",
    courseUrl: "https://app.torinvest-trading.com/course/index.html",
  };

  const sent = await sendFn(payload);
  if (sent && sent.ok) {
    job.sent = job.sent || {};
    job.sent[meta.weekKey] = new Date(now).toISOString();
    job.updated = new Date(now).toISOString();
    writeJson(jobPath, job);
  } else {
    console.warn("[weekly-digest] envoi échoué", sent && (sent.error || sent.status));
  }
  return { ok: !!(sent && sent.ok), weekKey: meta.weekKey, detail: sent };
}

let _timer = null;
let _startedFor = null;

function startWeeklyDigest(options) {
  const disabled = String(process.env.FORGE_WEEKLY_DIGEST || "1").trim() === "0";
  if (disabled) {
    console.log("[weekly-digest] désactivé (FORGE_WEEKLY_DIGEST=0)");
    return { started: false, reason: "disabled" };
  }
  const dataDir = options && options.dataDir;
  if (!dataDir) throw new Error("startWeeklyDigest: dataDir requis");

  const key = path.resolve(dataDir);
  if (_timer && _startedFor === key) {
    return { started: true, already: true };
  }
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }

  const intervalMs = Math.max(60000, Number(options.intervalMs) || 5 * 60000);
  const run = () => {
    tickWeeklyDigest({ dataDir }).catch((err) => {
      console.warn("[weekly-digest] tick error", err && err.message ? err.message : err);
    });
  };

  setTimeout(run, 20000);
  _timer = setInterval(run, intervalMs);
  if (typeof _timer.unref === "function") _timer.unref();
  _startedFor = key;
  console.log(
    "[weekly-digest] démarré (interval=" +
      intervalMs +
      "ms, tz=" +
      (process.env.FORGE_COACHING_TZ || "Europe/Paris") +
      ")"
  );
  return { started: true, intervalMs };
}

module.exports = {
  isoWeekKey,
  tickWeeklyDigest,
  startWeeklyDigest,
  sendWeeklyDigest,
  nextCollectiveBlurb,
};
