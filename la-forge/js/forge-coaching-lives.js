/**
 * Lives coaching 1:1 — UI calendrier La Forge.
 * Admin propose → élève confirme sa présence.
 */
(function () {
  "use strict";

  let _me = null;
  let _isAdmin = false;
  let _sessions = [];
  let _templates = [];

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

  function statusLabel(status) {
    if (status === "proposed") return "Proposé";
    if (status === "confirmed") return "Confirmé";
    if (status === "declined") return "Refusé";
    if (status === "cancelled") return "Annulé";
    return status;
  }

  function statusClass(status) {
    return "coach-status coach-status--" + status;
  }

  function weekdayName(n) {
    return ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"][n] || "";
  }

  function sessionsForDate(dateKey) {
    return _sessions.filter((s) => s.date === dateKey && s.status !== "cancelled" && s.status !== "declined");
  }

  function paintCalendarChips() {
    const root = document.getElementById("calendar-root");
    if (!root) return;
    root.querySelectorAll("a.cal-cell[href*='date=']").forEach((cell) => {
      const href = cell.getAttribute("href") || "";
      const m = href.match(/date=(\d{4}-\d{2}-\d{2})/);
      if (!m) return;
      const lives = sessionsForDate(m[1]);
      cell.classList.toggle("has-coaching", lives.length > 0);
      let chip = cell.querySelector(".coach-chip");
      if (!lives.length) {
        if (chip) chip.remove();
        return;
      }
      const confirmed = lives.some((s) => s.status === "confirmed");
      if (!chip) {
        chip = document.createElement("span");
        chip.className = "coach-chip";
        cell.appendChild(chip);
      }
      chip.textContent = confirmed ? "Live ✓" : "Live";
      chip.classList.toggle("confirmed", confirmed);
      chip.classList.toggle("proposed", !confirmed);
    });
  }

  function renderList() {
    const list = document.getElementById("coach-lives-list");
    if (!list) return;

    const upcoming = _sessions
      .filter((s) => s.status === "proposed" || s.status === "confirmed")
      .slice()
      .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));

    if (!upcoming.length) {
      list.innerHTML =
        '<p class="coach-empty">Aucun live coaching planifié pour le moment.</p>';
      return;
    }

    list.innerHTML = upcoming
      .map((s) => {
        const actions = [];
        if (s.canConfirm) {
          actions.push(
            '<button type="button" class="btn btn-primary btn-sm" data-coach-confirm="' +
              esc(s.id) +
              '">Confirmer ma présence</button>'
          );
        }
        if (s.canDecline) {
          actions.push(
            '<button type="button" class="btn btn-secondary btn-sm" data-coach-decline="' +
              esc(s.id) +
              '">Me désister</button>'
          );
        }
        if (s.canCancel) {
          actions.push(
            '<button type="button" class="btn btn-secondary btn-sm" data-coach-cancel="' +
              esc(s.id) +
              '">Annuler</button>'
          );
        }
        if (
          _isAdmin &&
          s.studentEmail &&
          s.studentEmail !== "(réservé)" &&
          String(s.studentEmail).includes("@")
        ) {
          actions.push(
            '<a class="btn btn-secondary btn-sm" href="/coaching-fiches.html?student=' +
              encodeURIComponent(s.studentEmail) +
              "&fromLive=" +
              encodeURIComponent(s.date || "") +
              '">Fiche + Journal</a>'
          );
        }
        const student =
          s.studentEmail && s.studentEmail !== "(réservé)"
            ? '<div class="coach-meta">Élève : ' + esc(s.studentEmail) + "</div>"
            : s.status === "proposed"
              ? '<div class="coach-meta">Ouvert — un élève peut confirmer</div>'
              : "";
        return (
          '<article class="coach-card" data-id="' +
          esc(s.id) +
          '">' +
          '<div class="coach-card-top">' +
          "<strong>" +
          esc(s.label) +
          "</strong>" +
          '<span class="' +
          statusClass(s.status) +
          '">' +
          esc(statusLabel(s.status)) +
          "</span></div>" +
          '<div class="coach-when">' +
          esc(s.date) +
          " · " +
          esc(s.start) +
          "–" +
          esc(s.end) +
          "</div>" +
          (s.objective
            ? '<div class="coach-meta">Objectif : ' + esc(s.objective) + "</div>"
            : "") +
          student +
          (actions.length ? '<div class="coach-actions">' + actions.join("") + "</div>" : "") +
          "</article>"
        );
      })
      .join("");
  }

  function nextDateKeyForWeekday(weekday) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    const delta = (weekday - d.getDay() + 7) % 7;
    d.setDate(d.getDate() + (delta === 0 ? 7 : delta));
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function fillTemplateSelect(select, preferredWeekday, keepValue) {
    if (!select || !_templates.length) return;
    const prev = keepValue ? select.value : "";
    const matching =
      preferredWeekday == null
        ? _templates
        : _templates.filter((t) => t.weekday === preferredWeekday);
    const source = matching.length ? matching : _templates;
    select.innerHTML = source
      .map((t) => {
        return (
          '<option value="' +
          esc(t.id) +
          '">' +
          esc(weekdayName(t.weekday) + " " + t.start + "–" + t.end + " — " + t.label) +
          "</option>"
        );
      })
      .join("");
    if (prev && Array.from(select.options).some((o) => o.value === prev)) {
      select.value = prev;
    }
  }

  function renderAdminForm() {
    const panel = document.getElementById("coach-admin-panel");
    if (!panel) return;
    panel.hidden = !_isAdmin;
    if (!_isAdmin) return;

    const select = document.getElementById("coach-template");
    const dateInput = document.getElementById("coach-date");
    let wd = null;
    if (dateInput && dateInput.value) {
      const [y, m, d] = dateInput.value.split("-").map(Number);
      if (y && m && d) wd = new Date(y, m - 1, d).getDay();
    }
    fillTemplateSelect(select, wd, true);
  }

  async function reload() {
    const data = await api("/api/coaching-lives");
    _sessions = data.sessions || [];
    _isAdmin = !!data.isAdmin;
    renderList();
    renderAdminForm();
    paintCalendarChips();
    checkCoachingReminderPopups();
  }

  async function loadTemplates() {
    const data = await api("/api/coaching-lives/templates");
    _templates = data.templates || [];
    _isAdmin = !!data.isAdmin;
    renderAdminForm();
  }

  function bindActions() {
    const list = document.getElementById("coach-lives-list");
    list?.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-coach-confirm],[data-coach-decline],[data-coach-cancel]");
      if (!btn) return;
      const id =
        btn.getAttribute("data-coach-confirm") ||
        btn.getAttribute("data-coach-decline") ||
        btn.getAttribute("data-coach-cancel");
      let path = "/api/coaching-lives/" + id + "/confirm";
      if (btn.hasAttribute("data-coach-decline")) path = "/api/coaching-lives/" + id + "/decline";
      if (btn.hasAttribute("data-coach-cancel")) path = "/api/coaching-lives/" + id + "/cancel";
      const msg =
        btn.hasAttribute("data-coach-cancel")
          ? "Annuler ce live ?"
          : btn.hasAttribute("data-coach-decline")
            ? "Te désister de ce créneau ?"
            : "Confirmer ta présence sur ce live coaching ?";
      if (!window.confirm(msg)) return;
      try {
        btn.disabled = true;
        await api(path, { method: "POST", body: "{}" });
        await reload();
      } catch (err) {
        alert(err.message || String(err));
        btn.disabled = false;
      }
    });

    document.getElementById("coach-propose-week")?.addEventListener("click", async () => {
      if (
        !window.confirm(
          "Proposer un créneau soir (18h–19h) pour chaque jour de la semaine prochaine ?"
        )
      ) {
        return;
      }
      try {
        const data = await api("/api/coaching-lives/propose-week", { method: "POST", body: "{}" });
        alert((data.count || 0) + " créneau(x) proposé(s).");
        await reload();
      } catch (err) {
        alert(err.message || String(err));
      }
    });

    const dateInput = document.getElementById("coach-date");
    const templateSelect = document.getElementById("coach-template");
    dateInput?.addEventListener("change", () => {
      if (!dateInput.value) {
        fillTemplateSelect(templateSelect, null, true);
        return;
      }
      const [y, m, d] = dateInput.value.split("-").map(Number);
      const wd = new Date(y, m - 1, d).getDay();
      fillTemplateSelect(templateSelect, wd, false);
    });
    templateSelect?.addEventListener("change", () => {
      const tpl = _templates.find((t) => t.id === templateSelect.value);
      if (!tpl || !dateInput) return;
      if (!dateInput.value) {
        dateInput.value = nextDateKeyForWeekday(tpl.weekday);
        return;
      }
      const [y, m, d] = dateInput.value.split("-").map(Number);
      if (new Date(y, m - 1, d).getDay() !== tpl.weekday) {
        dateInput.value = nextDateKeyForWeekday(tpl.weekday);
      }
    });

    document.getElementById("coach-propose-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.target;
      const fd = new FormData(form);
      const payload = {
        templateId: String(fd.get("templateId") || "") || null,
        date: String(fd.get("date") || "").trim(),
        studentEmail: String(fd.get("studentEmail") || "").trim() || null,
        objective: String(fd.get("objective") || "").trim() || "",
        notes: String(fd.get("notes") || fd.get("objective") || "").trim() || "",
      };
      if (!payload.date) {
        alert("Choisis une date.");
        return;
      }
      try {
        await api("/api/coaching-lives", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        form.reset();
        fillTemplateSelect(templateSelect, null, false);
        await reload();
      } catch (err) {
        alert(err.message || String(err));
      }
    });
  }

  // Hook month re-render to keep chips
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

  function popupDismissKey(sessionId, windowKey) {
    return "forge_coach_popup_" + sessionId + "_" + windowKey;
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

  /** Heure du créneau interprétée en heure locale navigateur (élèves FR ≈ Europe/Paris). */
  function sessionStartMs(session) {
    if (!session || !session.date || !session.start) return NaN;
    const t = Date.parse(String(session.date) + "T" + String(session.start) + ":00");
    return Number.isFinite(t) ? t : NaN;
  }

  function myEmail() {
    return String((_me && _me.email) || "")
      .trim()
      .toLowerCase();
  }

  function isMyConfirmedLive(session) {
    if (!session || session.status !== "confirmed") return false;
    const me = myEmail();
    if (!me) return false;
    const student = String(session.studentEmail || "").trim().toLowerCase();
    const confirmedBy = String(session.confirmedBy || "").trim().toLowerCase();
    return student === me || confirmedBy === me;
  }

  /**
   * Fenêtres d’alerte : popup si on est après T−4h / T−1h et avant le live,
   * et que la fenêtre n’a pas encore été fermée.
   */
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
    // Priorité : montrer d’abord le rappel le plus proche (1h avant 4h)
    out.sort((a, b) => a.hours - b.hours);
    return out;
  }

  function ensureReminderModal() {
    let root = document.getElementById("coach-reminder-modal");
    if (root) return root;
    root = document.createElement("div");
    root.id = "coach-reminder-modal";
    root.className = "coach-reminder-modal";
    root.hidden = true;
    root.innerHTML =
      '<div class="coach-reminder-backdrop" data-coach-reminder-dismiss></div>' +
      '<div class="coach-reminder-dialog" role="dialog" aria-modal="true" aria-labelledby="coach-reminder-title">' +
      '<p class="coach-reminder-eyebrow" id="coach-reminder-eyebrow">Live coaching</p>' +
      '<h3 id="coach-reminder-title">Rappel</h3>' +
      '<p class="coach-reminder-body" id="coach-reminder-body"></p>' +
      '<div class="coach-reminder-actions">' +
      '<button type="button" class="btn btn-primary" id="coach-reminder-ok">Compris</button>' +
      '<a class="btn btn-secondary" href="/calendar.html" id="coach-reminder-cal">Calendrier</a>' +
      "</div></div>";
    document.body.appendChild(root);
    return root;
  }

  let _reminderShowing = null;

  function hideReminderModal() {
    const root = document.getElementById("coach-reminder-modal");
    if (root) root.hidden = true;
    _reminderShowing = null;
  }

  function showReminderModal(session, windowInfo) {
    if (_reminderShowing) return;
    const root = ensureReminderModal();
    const title = document.getElementById("coach-reminder-title");
    const body = document.getElementById("coach-reminder-body");
    const eyebrow = document.getElementById("coach-reminder-eyebrow");
    if (title) title.textContent = "Rappel — " + windowInfo.title;
    if (eyebrow) eyebrow.textContent = "Live coaching confirmé";
    if (body) {
      body.innerHTML =
        "<strong>" +
        esc(session.label || "Live coaching") +
        "</strong><br>" +
        esc(session.date) +
        " · " +
        esc(session.start) +
        (session.end ? "–" + esc(session.end) : "") +
        '<br><span class="coach-reminder-hint">Prépare-toi : le live est bientôt. Un email de rappel t’a aussi été / sera envoyé.</span>';
    }
    _reminderShowing = { id: session.id, key: windowInfo.key };
    root.hidden = false;

    const ok = document.getElementById("coach-reminder-ok");
    if (ok) {
      ok.onclick = function () {
        dismissPopup(session.id, windowInfo.key);
        hideReminderModal();
        // Enchaîner un éventuel autre rappel (ex. 4h si 1h déjà vu)
        setTimeout(checkCoachingReminderPopups, 200);
      };
    }
    root.querySelectorAll("[data-coach-reminder-dismiss]").forEach((el) => {
      el.onclick = function () {
        dismissPopup(session.id, windowInfo.key);
        hideReminderModal();
      };
    });
  }

  function checkCoachingReminderPopups() {
    if (_reminderShowing) return;
    const now = Date.now();
    const mine = _sessions.filter(isMyConfirmedLive);
    for (const s of mine) {
      const wins = activeReminderWindows(s, now);
      if (wins.length) {
        showReminderModal(s, wins[0]);
        return;
      }
    }
  }

  let _reminderTimer = null;
  function startReminderPolling() {
    checkCoachingReminderPopups();
    if (_reminderTimer) return;
    _reminderTimer = setInterval(checkCoachingReminderPopups, 60000);
  }

  async function initForgeCoachingLives(me) {
    _me = me || null;
    _isAdmin = !!(me && me.isAdmin);
    const panel = document.getElementById("coach-panel");
    if (!panel) return;

    hookCalendarRender();
    bindActions();
    try {
      await loadTemplates();
      await reload();
      startReminderPolling();
    } catch (err) {
      const list = document.getElementById("coach-lives-list");
      if (list) {
        list.innerHTML =
          '<p class="coach-empty">Lives coaching indisponibles : ' +
          esc(err.message || err) +
          "</p>";
      }
    }
  }

  // Day page: show lives for that date
  async function initForgeCoachingDay(me) {
    _me = me || null;
    const mount = document.getElementById("coach-day-panel");
    if (!mount) return;
    const params = new URLSearchParams(window.location.search);
    const date = params.get("date");
    if (!date) return;

    try {
      const data = await api("/api/coaching-lives?from=" + encodeURIComponent(date) + "&to=" + encodeURIComponent(date));
      _sessions = data.sessions || [];
      _isAdmin = !!data.isAdmin;
      const lives = sessionsForDate(date);
      if (!lives.length && !_isAdmin) {
        mount.hidden = true;
        return;
      }
      mount.hidden = false;
      mount.innerHTML =
        '<h3 style="color:var(--gold);font-size:1rem;margin-bottom:0.75rem">Live coaching</h3>' +
        '<div id="coach-lives-list"></div>';
      if (_isAdmin) {
        mount.innerHTML +=
          '<div id="coach-admin-panel" class="coach-admin" style="margin-top:1rem">' +
          '<form id="coach-propose-form" class="coach-form">' +
          '<label>Proposer un créneau le ' +
          esc(date) +
          '</label>' +
          '<select name="templateId" id="coach-template" required></select>' +
          '<input type="hidden" name="date" value="' +
          esc(date) +
          '" />' +
          '<input type="email" name="studentEmail" placeholder="Email élève (optionnel)" />' +
          '<button type="submit" class="btn btn-primary btn-sm">Proposer ce live</button>' +
          "</form></div>";
      }
      await loadTemplates();
      const sel = document.getElementById("coach-template");
      if (sel && date) {
        const [y, m, d] = date.split("-").map(Number);
        const wd = new Date(y, m - 1, d).getDay();
        const matching = _templates.filter((t) => t.weekday === wd);
        const source = matching.length ? matching : _templates;
        sel.innerHTML = source
          .map(
            (t) =>
              '<option value="' +
              esc(t.id) +
              '">' +
              esc(t.start + "–" + t.end + " — " + t.label) +
              "</option>"
          )
          .join("");
      }
      renderList();
      bindActions();
      startReminderPolling();
    } catch (err) {
      mount.hidden = false;
      mount.innerHTML =
        '<p class="coach-empty">Impossible de charger les lives : ' + esc(err.message || err) + "</p>";
    }
  }

  window.initForgeCoachingLives = initForgeCoachingLives;
  window.initForgeCoachingDay = initForgeCoachingDay;
  window.checkCoachingReminderPopups = checkCoachingReminderPopups;
})();
