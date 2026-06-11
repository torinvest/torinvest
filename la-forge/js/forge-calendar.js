/**
 * La Forge — Calendrier d'apprentissage v2
 * localStorage (par email) + sync serveur + export/import JSON
 */
const FORGE_CAL_KEY_PREFIX = "forge_calendar_v2_";
const FORGE_CAL_META_KEY = "forge_calendar_meta_v2";

function calStorageKey() {
  const email = window.__forgeUserEmail || "guest";
  return FORGE_CAL_KEY_PREFIX + email.replace(/[^a-z0-9@._-]/gi, "_");
}

function loadLocalStore() {
  try {
    return JSON.parse(localStorage.getItem(calStorageKey()) || "{}");
  } catch {
    return {};
  }
}

function saveLocalStore(data) {
  localStorage.setItem(calStorageKey(), JSON.stringify(data));
}

function loadLocalMeta() {
  try {
    return JSON.parse(localStorage.getItem(FORGE_CAL_META_KEY + calStorageKey()) || "{}");
  } catch {
    return {};
  }
}

function saveLocalMeta(meta) {
  localStorage.setItem(FORGE_CAL_META_KEY + calStorageKey(), JSON.stringify(meta));
}

function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

function parseDateKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function emptyDay() {
  return {
    modules: [],
    notes: "",
    mood: "",
    hours: "",
    goals: "",
    reminder: "",
    completed: false,
    chartDone: false,
  };
}

function normalizeEntry(entry) {
  const e = { ...emptyDay(), ...(entry || {}) };
  if (typeof e.modules === "string") {
    e.modules = e.modules.split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (!Array.isArray(e.modules)) e.modules = [];
  return e;
}

/** Cache mémoire fusionné local + serveur */
let _storeCache = null;
let _syncStatus = "idle";

function getStore() {
  if (!_storeCache) _storeCache = loadLocalStore();
  return _storeCache;
}

function setStore(store) {
  _storeCache = store;
  saveLocalStore(store);
}

function getDayEntry(key) {
  const store = getStore();
  return normalizeEntry(store[key]);
}

function mergeEntry(local, remote) {
  if (!remote) return local;
  if (!local || !local.updated) return { ...remote, updated: remote.updated || new Date().toISOString() };
  if (!remote.updated) return local;
  return new Date(remote.updated) >= new Date(local.updated) ? remote : local;
}

async function syncCalendarFromServer() {
  _syncStatus = "syncing";
  updateSyncBadge();
  try {
    const res = await fetch("/api/calendar", { credentials: "same-origin" });
    if (!res.ok) throw new Error("sync failed");
    const data = await res.json();
    const local = loadLocalStore();
    const merged = { ...local };
    const days = data.days || {};
    Object.keys(days).forEach((key) => {
      merged[key] = mergeEntry(normalizeEntry(local[key]), normalizeEntry(days[key]));
    });
    setStore(merged);
    if (data.meta) saveLocalMeta({ ...loadLocalMeta(), ...data.meta, lastSync: new Date().toISOString() });
    _syncStatus = "ok";
  } catch {
    _syncStatus = "offline";
  }
  updateSyncBadge();
  return getStore();
}

async function pushCalendarToServer() {
  _syncStatus = "syncing";
  updateSyncBadge();
  try {
    const res = await fetch("/api/calendar", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days: getStore(), meta: loadLocalMeta() }),
    });
    if (!res.ok) throw new Error("push failed");
    saveLocalMeta({ ...loadLocalMeta(), lastSync: new Date().toISOString() });
    _syncStatus = "ok";
  } catch {
    _syncStatus = "offline";
  }
  updateSyncBadge();
}

async function saveDayEntry(key, entry) {
  const store = getStore();
  store[key] = {
    ...normalizeEntry(store[key]),
    ...entry,
    updated: new Date().toISOString(),
  };
  setStore(store);
  await pushCalendarToServer();
  return store[key];
}

function updateSyncBadge() {
  const el = document.getElementById("cal-sync-badge");
  if (!el) return;
  const labels = { idle: "—", syncing: "Synchronisation…", ok: "Synchronisé", offline: "Hors ligne (local)" };
  el.textContent = labels[_syncStatus] || _syncStatus;
  el.className = "cal-sync-badge " + _syncStatus;
}

function computeStreak(store) {
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 365; i++) {
    const k = dateKey(d);
    const e = store[k];
    if (e && (e.completed || e.notes || (e.modules && e.modules.length))) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else if (i === 0) {
      d.setDate(d.getDate() - 1);
      continue;
    } else break;
  }
  return streak;
}

function upcomingDays(store, fromDate, count) {
  const out = [];
  const d = new Date(fromDate);
  for (let i = 0; i < count; i++) {
    const k = dateKey(d);
    const e = normalizeEntry(store[k]);
    if (e.modules.length || e.goals || e.reminder) out.push({ key: k, entry: e });
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function exportCalendarJson() {
  const payload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    days: getStore(),
    meta: loadLocalMeta(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "la-forge-calendrier-" + dateKey(new Date()) + ".json";
  a.click();
  URL.revokeObjectURL(a.href);
}

async function importCalendarJson(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  if (!data.days || typeof data.days !== "object") throw new Error("Format JSON invalide");
  const merged = { ...getStore() };
  Object.keys(data.days).forEach((key) => {
    merged[key] = mergeEntry(normalizeEntry(merged[key]), normalizeEntry(data.days[key]));
  });
  setStore(merged);
  if (data.meta) saveLocalMeta({ ...loadLocalMeta(), ...data.meta });
  await pushCalendarToServer();
}

function renderMonthCalendar(containerId, year, month) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const store = getStore();
  const first = new Date(year, month, 1);
  const startDay = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = dateKey(new Date());
  const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

  let html =
    '<div class="cal-header"><button type="button" class="btn btn-secondary cal-nav" data-cal-delta="-1">←</button>' +
    '<h2>' + monthNames[month] + " " + year + '</h2>' +
    '<button type="button" class="btn btn-secondary cal-nav" data-cal-delta="1">→</button></div>' +
    '<div class="cal-weekdays"><span>Lun</span><span>Mar</span><span>Mer</span><span>Jeu</span><span>Ven</span><span>Sam</span><span>Dim</span></div>' +
    '<div class="cal-grid">';

  for (let i = 0; i < startDay; i++) html += '<div class="cal-cell empty"></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const key = dateKey(new Date(year, month, d));
    const entry = normalizeEntry(store[key]);
    const hasContent = entry.notes || entry.modules.length || entry.hours || entry.goals;
    const cls = [
      "cal-cell",
      key === todayKey ? "today" : "",
      hasContent ? "has-entry" : "",
      entry.completed ? "day-done" : "",
      entry.reminder ? "has-reminder" : "",
    ].filter(Boolean).join(" ");
    const preview = entry.modules.slice(0, 2).join(" · ");
    html +=
      '<a class="' + cls + '" href="/calendar-day.html?date=' + key + '" title="' + (preview || "") + '">' +
      '<span class="cal-date">' + d + "</span>" +
      (preview ? '<span class="cal-preview">' + preview + "</span>" : "") +
      (hasContent ? '<span class="cal-dot"></span>' : "") +
      "</a>";
  }

  html += "</div>";
  el.innerHTML = html;
  el.dataset.calYear = String(year);
  el.dataset.calMonth = String(month);

  el.querySelectorAll(".cal-nav").forEach((btn) => {
    btn.addEventListener("click", () => {
      let y = year;
      let m = month + Number(btn.dataset.calDelta);
      if (m < 0) { m = 11; y--; }
      if (m > 11) { m = 0; y++; }
      renderMonthCalendar(containerId, y, m);
    });
  });

  renderCalendarSidebar(store);
}

function renderCalendarSidebar(store) {
  const streakEl = document.getElementById("cal-streak");
  const upcomingEl = document.getElementById("cal-upcoming");
  if (streakEl) streakEl.textContent = String(computeStreak(store));

  if (upcomingEl) {
    const items = upcomingDays(store, new Date(), 14);
    if (!items.length) {
      upcomingEl.innerHTML = '<p style="color:var(--muted);font-size:0.88rem">Aucun module planifié — cliquez une date pour planifier.</p>';
      return;
    }
    upcomingEl.innerHTML = items
      .slice(0, 7)
      .map(({ key, entry }) => {
        const d = parseDateKey(key);
        const label = d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
        return (
          '<a class="cal-upcoming-item" href="/calendar-day.html?date=' + key + '">' +
          "<strong>" + label + "</strong>" +
          "<span>" + (entry.modules.join(", ") || entry.goals || "—") + "</span>" +
          (entry.reminder ? '<em class="cal-reminder-tag">⏰ ' + entry.reminder + "</em>" : "") +
          "</a>"
        );
      })
      .join("");
  }
}

function initCalendarPage() {
  const exportBtn = document.getElementById("cal-export");
  const importInput = document.getElementById("cal-import");
  const syncBtn = document.getElementById("cal-sync-btn");

  exportBtn?.addEventListener("click", exportCalendarJson);
  importInput?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importCalendarJson(file);
      alert("Import réussi — calendrier fusionné.");
      const root = document.getElementById("calendar-root");
      if (root) renderMonthCalendar("calendar-root", Number(root.dataset.calYear || new Date().getFullYear()), Number(root.dataset.calMonth ?? new Date().getMonth()));
    } catch (err) {
      alert("Erreur import : " + err.message);
    }
    e.target.value = "";
  });
  syncBtn?.addEventListener("click", async () => {
    await syncCalendarFromServer();
    const now = new Date();
    renderMonthCalendar("calendar-root", now.getFullYear(), now.getMonth());
  });
}

async function initCalendarDayPage() {
  const params = new URLSearchParams(window.location.search);
  const key = params.get("date") || dateKey(new Date());
  const d = parseDateKey(key);
  const titleEl = document.getElementById("day-title");
  const form = document.getElementById("day-form");
  if (!form) return;

  await syncCalendarFromServer();

  const opts = { weekday: "long", day: "numeric", month: "long", year: "numeric" };
  if (titleEl) titleEl.textContent = d.toLocaleDateString("fr-FR", opts);

  const entry = getDayEntry(key);
  form.elements.modules.value = (entry.modules || []).join(", ");
  form.elements.hours.value = entry.hours || "";
  form.elements.mood.value = entry.mood || "";
  form.elements.goals.value = entry.goals || "";
  form.elements.notes.value = entry.notes || "";
  if (form.elements.reminder) form.elements.reminder.value = entry.reminder || "";
  if (form.elements.completed) form.elements.completed.checked = !!entry.completed;
  if (form.elements.chartDone) form.elements.chartDone.checked = !!entry.chartDone;

  populateModulePicker(entry.modules);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const picked = Array.from(form.querySelectorAll('input[name="modpick"]:checked')).map((el) => el.value);
    const modulesRaw = String(fd.get("modules") || "").split(",").map((s) => s.trim()).filter(Boolean);
    const modules = picked.length ? picked : modulesRaw;

    await saveDayEntry(key, {
      modules,
      notes: fd.get("notes"),
      hours: fd.get("hours"),
      mood: fd.get("mood"),
      goals: fd.get("goals"),
      reminder: fd.get("reminder") || "",
      completed: fd.get("completed") === "on",
      chartDone: fd.get("chartDone") === "on",
    });

    const msg = document.getElementById("save-msg");
    if (msg) {
      msg.hidden = false;
      msg.className = "alert alert-success";
      msg.textContent = "Journée enregistrée et synchronisée — " + key;
    }
    if (entry.reminder && "Notification" in window && Notification.permission === "granted") {
      /* rappel navigateur si autorisé — affichage passif */
    }
  });

  document.getElementById("day-export")?.addEventListener("click", exportCalendarJson);
}

function populateModulePicker(selected) {
  const root = document.getElementById("module-picker");
  if (!root || typeof MODULES === "undefined") return;
  const sel = new Set(selected || []);
  root.innerHTML = MODULES.map(
    (m) =>
      '<label class="mod-pick"><input type="checkbox" name="modpick" value="' +
      m.num +
      '" ' +
      (sel.has(m.num) ? "checked" : "") +
      " /> " +
      m.num +
      " · " +
      m.title +
      "</label>"
  ).join("");
}

async function initForgeCalendar(userEmail) {
  window.__forgeUserEmail = userEmail || "guest";
  _storeCache = null;
  await syncCalendarFromServer();
}

window.renderMonthCalendar = renderMonthCalendar;
window.initCalendarDayPage = initCalendarDayPage;
window.initCalendarPage = initCalendarPage;
window.initForgeCalendar = initForgeCalendar;
window.getDayEntry = getDayEntry;
window.dateKey = dateKey;
window.exportCalendarJson = exportCalendarJson;
