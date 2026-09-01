const APP_ORIGIN =
  window.location.hostname === "app.torinvest-trading.com"
    ? ""
    : "https://app.torinvest-trading.com";

async function api(path, options = {}) {
  const url = path.startsWith("http") ? path : APP_ORIGIN + path;
  let res;
  try {
    res = await fetch(url, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });
  } catch {
    throw new Error(
      "Connexion La Forge indisponible pour le moment. Réessayez après réception de vos identifiants par email, ou utilisez votre clé TOR-ACCOMPAGNEMENT dans le champ mot de passe."
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Erreur serveur");
  return data;
}

function normalizeMe(data) {
  if (!data || typeof data !== "object") return null;
  if (data.user && typeof data.user === "object") return data.user;
  if (data.email) return data;
  return null;
}

async function getMe() {
  try {
    return normalizeMe(await api("/api/me"));
  } catch {
    return null;
  }
}

async function logout() {
  await api("/api/logout", { method: "POST" });
  window.location.href =
    window.location.hostname === "app.torinvest-trading.com"
      ? "/login.html"
      : "https://app.torinvest-trading.com/login.html";
}

function showAlert(el, message, type = "error") {
  if (!el) return;
  el.className = "alert alert-" + type;
  el.textContent = message;
  el.hidden = false;
}

function forgeNextUrl(raw) {
  const next = raw || "/dashboard.html";
  if (next.startsWith("http")) return next;
  return next.startsWith("/") ? next : "/" + next;
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
    const nextParam = new URLSearchParams(window.location.search).get("next");
    if (nextParam) {
      const already = await getMe();
      if (already && nextParam.indexOf("fondamental") === -1) {
        window.location.replace(forgeNextUrl(nextParam));
        return;
      }
      if (already && nextParam.indexOf("fondamental") !== -1) {
        window.location.replace(forgeNextUrl(nextParam));
        return;
      }
    }
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
        window.location.href = forgeNextUrl(
          new URLSearchParams(window.location.search).get("next")
        );
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

window.getMe = getMe;
window.logout = logout;
