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
          student +
          (actions.length ? '<div class="coach-actions">' + actions.join("") + "</div>" : "") +
          "</article>"
        );
      })
      .join("");
  }

  function renderAdminForm() {
    const panel = document.getElementById("coach-admin-panel");
    if (!panel) return;
    panel.hidden = !_isAdmin;
    if (!_isAdmin) return;

    const select = document.getElementById("coach-template");
    if (select && _templates.length) {
      select.innerHTML = _templates
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
    }
  }

  async function reload() {
    const data = await api("/api/coaching-lives");
    _sessions = data.sessions || [];
    _isAdmin = !!data.isAdmin;
    renderList();
    renderAdminForm();
    paintCalendarChips();
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
      if (!window.confirm("Proposer les créneaux types pour la semaine prochaine (sam + 2 dim) ?")) return;
      try {
        const data = await api("/api/coaching-lives/propose-week", { method: "POST", body: "{}" });
        alert((data.count || 0) + " créneau(x) proposé(s).");
        await reload();
      } catch (err) {
        alert(err.message || String(err));
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
        notes: String(fd.get("notes") || "").trim() || "",
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
    } catch (err) {
      mount.hidden = false;
      mount.innerHTML =
        '<p class="coach-empty">Impossible de charger les lives : ' + esc(err.message || err) + "</p>";
    }
  }

  window.initForgeCoachingLives = initForgeCoachingLives;
  window.initForgeCoachingDay = initForgeCoachingDay;
})();
