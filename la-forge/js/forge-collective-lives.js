/**
 * Lives collectifs — UI calendrier La Forge + popup rappel 4h/1h.
 */
(function () {
  "use strict";

  let _me = null;
  let _isAdmin = false;
  let _sessions = [];

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function api(path, options) {
    const res = await fetch(path, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(options && options.headers) },
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Erreur serveur (" + res.status + ")");
    return data;
  }

  function sessionsForDate(dateKey) {
    return _sessions.filter((s) => s.date === dateKey && s.status === "scheduled");
  }

  function paintCalendarChips() {
    const root = document.getElementById("calendar-root");
    if (!root) return;
    root.querySelectorAll("a.cal-cell[href*='date=']").forEach((cell) => {
      const href = cell.getAttribute("href") || "";
      const m = href.match(/date=(\d{4}-\d{2}-\d{2})/);
      if (!m) return;
      const lives = sessionsForDate(m[1]);
      cell.classList.toggle("has-collective", lives.length > 0);
      let chip = cell.querySelector(".col-chip");
      if (!lives.length) {
        if (chip) chip.remove();
        return;
      }
      if (!chip) {
        chip = document.createElement("span");
        chip.className = "col-chip";
        cell.appendChild(chip);
      }
      chip.textContent = "Collectif";
    });
  }

  function renderList() {
    const list = document.getElementById("collective-lives-list");
    if (!list) return;
    const upcoming = _sessions
      .filter((s) => s.status === "scheduled")
      .slice()
      .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));

    if (!upcoming.length) {
      list.innerHTML = '<p class="coach-empty">Aucun live collectif planifié.</p>';
      return;
    }

    list.innerHTML = upcoming
      .map((s) => {
        const actions = [];
        if (s.url) {
          actions.push(
            '<a class="btn btn-primary btn-sm" href="' +
              esc(s.url) +
              '" target="_blank" rel="noopener noreferrer">Rejoindre</a>'
          );
        }
        if (_isAdmin) {
          actions.push(
            '<button type="button" class="btn btn-secondary btn-sm" data-col-cancel="' +
              esc(s.id) +
              '">Annuler</button>'
          );
        }
        return (
          '<article class="coach-card collective-card">' +
          '<div class="coach-card-top"><strong>' +
          esc(s.label) +
          '</strong><span class="coach-status coach-status--confirmed">Collectif</span></div>' +
          '<div class="coach-when">' +
          esc(s.date) +
          " · " +
          esc(s.start) +
          (s.end ? "–" + esc(s.end) : "") +
          "</div>" +
          (s.channel
            ? '<div class="coach-meta">Canal : ' + esc(s.channel) + "</div>"
            : "") +
          (actions.length ? '<div class="coach-actions">' + actions.join("") + "</div>" : "") +
          "</article>"
        );
      })
      .join("");
  }

  function renderAdminForm() {
    const panel = document.getElementById("collective-admin-panel");
    if (!panel) return;
    panel.hidden = !_isAdmin;
  }

  async function reload() {
    const data = await api("/api/collective-lives");
    _sessions = data.sessions || [];
    _isAdmin = !!data.isAdmin;
    renderList();
    renderAdminForm();
    paintCalendarChips();
    checkCollectiveReminderPopups();
  }

  function popupDismissKey(sessionId, windowKey) {
    return "forge_col_popup_" + sessionId + "_" + windowKey;
  }

  function isPopupDismissed(sessionId, windowKey) {
    try {
      return localStorage.getItem(popupDismissKey(sessionId, windowKey)) === "1";
    } catch (_) {
      return false;
    }
  }

  function dismissPopup(sessionId, windowKey) {
    try {
      localStorage.setItem(popupDismissKey(sessionId, windowKey), "1");
    } catch (_) {}
  }

  function sessionStartMs(session) {
    if (!session || !session.date || !session.start) return NaN;
    const t = Date.parse(String(session.date) + "T" + String(session.start) + ":00");
    return Number.isFinite(t) ? t : NaN;
  }

  function activeReminderWindows(session, nowMs) {
    const start = sessionStartMs(session);
    if (!Number.isFinite(start) || nowMs >= start) return [];
    const out = [];
    const windows = [
      { key: "4h", hours: 4, title: "Dans 4 heures" },
      { key: "1h", hours: 1, title: "Dans 1 heure" },
    ];
    for (const w of windows) {
      const trigger = start - w.hours * 3600 * 1000;
      if (nowMs >= trigger && !isPopupDismissed(session.id, w.key)) {
        out.push(w);
      }
    }
    out.sort((a, b) => a.hours - b.hours);
    return out;
  }

  function ensureReminderModal() {
    let root = document.getElementById("collective-reminder-modal");
    if (root) return root;
    root = document.createElement("div");
    root.id = "collective-reminder-modal";
    root.className = "coach-reminder-modal";
    root.hidden = true;
    root.innerHTML =
      '<div class="coach-reminder-backdrop" data-col-reminder-dismiss></div>' +
      '<div class="coach-reminder-dialog" role="dialog" aria-modal="true">' +
      '<p class="coach-reminder-eyebrow" id="col-reminder-eyebrow">Live collectif</p>' +
      '<h3 id="col-reminder-title">Rappel</h3>' +
      '<p class="coach-reminder-body" id="col-reminder-body"></p>' +
      '<div class="coach-reminder-actions">' +
      '<button type="button" class="btn btn-primary" id="col-reminder-ok">Compris</button>' +
      '<a class="btn btn-secondary" href="/calendar.html">Calendrier</a>' +
      "</div></div>";
    document.body.appendChild(root);
    return root;
  }

  let _reminderShowing = null;

  function hideReminderModal() {
    const root = document.getElementById("collective-reminder-modal");
    if (root) root.hidden = true;
    _reminderShowing = null;
  }

  function showReminderModal(session, windowInfo) {
    if (_reminderShowing) return;
    // Ne pas empiler si un rappel coaching 1:1 est déjà ouvert
    if (document.getElementById("coach-reminder-modal") && !document.getElementById("coach-reminder-modal").hidden) {
      return;
    }
    const root = ensureReminderModal();
    const title = document.getElementById("col-reminder-title");
    const body = document.getElementById("col-reminder-body");
    if (title) title.textContent = "Rappel — " + windowInfo.title;
    if (body) {
      body.innerHTML =
        "<strong>" +
        esc(session.label || "Live collectif") +
        "</strong><br>" +
        esc(session.date) +
        " · " +
        esc(session.start) +
        (session.end ? "–" + esc(session.end) : "") +
        (session.channel ? "<br>Canal : " + esc(session.channel) : "") +
        (session.url
          ? '<br><a href="' + esc(session.url) + '" target="_blank" rel="noopener noreferrer">Lien du live</a>'
          : "") +
        '<br><span class="coach-reminder-hint">Un email de rappel a aussi été / sera envoyé à tous les élèves.</span>';
    }
    _reminderShowing = { id: session.id, key: windowInfo.key };
    root.hidden = false;
    const ok = document.getElementById("col-reminder-ok");
    if (ok) {
      ok.onclick = function () {
        dismissPopup(session.id, windowInfo.key);
        hideReminderModal();
        setTimeout(checkCollectiveReminderPopups, 200);
      };
    }
    root.querySelectorAll("[data-col-reminder-dismiss]").forEach((el) => {
      el.onclick = function () {
        dismissPopup(session.id, windowInfo.key);
        hideReminderModal();
      };
    });
  }

  function checkCollectiveReminderPopups() {
    if (_reminderShowing) return;
    const now = Date.now();
    for (const s of _sessions) {
      if (s.status !== "scheduled") continue;
      const wins = activeReminderWindows(s, now);
      if (wins.length) {
        showReminderModal(s, wins[0]);
        return;
      }
    }
  }

  function bindActions() {
    document.getElementById("collective-lives-list")?.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-col-cancel]");
      if (!btn) return;
      if (!window.confirm("Annuler ce live collectif ?")) return;
      try {
        btn.disabled = true;
        await api("/api/collective-lives/" + btn.getAttribute("data-col-cancel") + "/cancel", {
          method: "POST",
          body: "{}",
        });
        await reload();
      } catch (err) {
        alert(err.message || String(err));
        btn.disabled = false;
      }
    });

    document.getElementById("collective-propose-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.target;
      const fd = new FormData(form);
      const payload = {
        date: String(fd.get("date") || "").trim(),
        start: String(fd.get("start") || "").trim(),
        end: String(fd.get("end") || "").trim(),
        label: String(fd.get("label") || "").trim() || "Live collectif",
        channel: String(fd.get("channel") || "").trim() || "discord",
        url: String(fd.get("url") || "").trim(),
        notes: String(fd.get("notes") || "").trim(),
      };
      if (!payload.date || !payload.start) {
        alert("Date et heure de début requises.");
        return;
      }
      try {
        await api("/api/collective-lives", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        form.reset();
        await reload();
      } catch (err) {
        alert(err.message || String(err));
      }
    });
  }

  function hookCalendarRender() {
    const original = window.renderMonthCalendar;
    if (typeof original !== "function") return;
    window.renderMonthCalendar = function () {
      const result = original.apply(this, arguments);
      try {
        paintCalendarChips();
      } catch (_) {}
      return result;
    };
  }

  let _timer = null;

  async function initForgeCollectiveLives(me) {
    _me = me || null;
    const panel = document.getElementById("collective-panel");
    if (!panel) return;
    bindActions();
    hookCalendarRender();
    try {
      await reload();
    } catch (err) {
      const list = document.getElementById("collective-lives-list");
      if (list) {
        list.innerHTML =
          '<p class="coach-empty">Lives collectifs indisponibles : ' +
          esc(err.message || String(err)) +
          "</p>";
      }
    }
    if (!_timer) {
      _timer = setInterval(checkCollectiveReminderPopups, 60000);
    }
  }

  window.initForgeCollectiveLives = initForgeCollectiveLives;
})();
