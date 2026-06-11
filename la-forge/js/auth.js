async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Erreur serveur");
  return data;
}

async function getMe() {
  try {
    return await api("/api/me");
  } catch {
    return null;
  }
}

async function logout() {
  await api("/api/logout", { method: "POST" });
  window.location.href = "/";
}

function showAlert(el, message, type = "error") {
  if (!el) return;
  el.className = "alert alert-" + type;
  el.textContent = message;
  el.hidden = false;
}

document.addEventListener("DOMContentLoaded", async () => {
  const loginForm = document.getElementById("login-form");
  const logoutBtn = document.getElementById("logout-btn");
  const userBadge = document.getElementById("user-badge");

  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      logout();
    });
  }

  if (userBadge) {
    const me = await getMe();
    if (me) {
      userBadge.textContent = me.email;
      userBadge.className = "badge " + (me.subscribed ? "badge-premium" : "badge-free");
    }
  }

  if (loginForm) {
    const alertEl = document.getElementById("login-alert");
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(loginForm);
      try {
        await api("/api/login", {
          method: "POST",
          body: JSON.stringify({
            email: fd.get("email"),
            password: fd.get("password"),
          }),
        });
        const next = new URLSearchParams(window.location.search).get("next") || "https://app.torinvest-trading.com/dashboard.html";
        window.location.href = next;
      } catch (err) {
        showAlert(alertEl, err.message);
      }
    });
  }

  const locked = new URLSearchParams(window.location.search).get("locked");
  if (locked && document.getElementById("locked-alert")) {
    document.getElementById("locked-alert").hidden = false;
  }
});

/**
 * Contrôleur d'étapes pour illustrations SVG
 * usage: initStepLesson({ steps: [...], onStep: (i) => {} })
 */
function initStepLesson(config) {
  const { steps, onStep, containerId = "step-text" } = config;
  const textEl = document.getElementById(containerId);
  const progressEl = document.getElementById("lesson-progress");
  const buttons = document.querySelectorAll("[data-step]");
  let current = 0;

  function goTo(index) {
    current = Math.max(0, Math.min(steps.length - 1, index));
    buttons.forEach((btn) => {
      btn.classList.toggle("active", Number(btn.dataset.step) === current);
    });
    if (textEl) {
      textEl.innerHTML = "<h4>" + steps[current].title + "</h4><p>" + steps[current].body + "</p>";
    }
    if (progressEl) {
      progressEl.style.width = ((current + 1) / steps.length) * 100 + "%";
    }
    if (onStep) onStep(current);
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => goTo(Number(btn.dataset.step)));
  });

  document.getElementById("step-prev")?.addEventListener("click", () => goTo(current - 1));
  document.getElementById("step-next")?.addEventListener("click", () => goTo(current + 1));

  goTo(0);
}

window.initStepLesson = initStepLesson;
window.getMe = getMe;
window.logout = logout;
