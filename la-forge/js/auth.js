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
  // Uniquement chemins relatifs same-origin (anti open-redirect phishing).
  const next = String(raw || "/start.html").trim();
  if (!next || next.startsWith("http") || next.startsWith("//") || next.includes("\\")) {
    return "/start.html";
  }
  if (next.startsWith("/")) {
    if (next.startsWith("//") || next.startsWith("/\\")) return "/start.html";
    return next;
  }
  return "/" + next;
}

/** Vérifie qu'une page membre est joignable (pas un 302→login) — évite la boucle qui « saute ». */
async function forgePageReachable(path) {
  try {
    const res = await fetch(APP_ORIGIN + path, {
      method: "GET",
      credentials: "include",
      redirect: "manual",
      cache: "no-store",
    });
    if (res.status >= 200 && res.status < 300) return true;
    if (res.status >= 300 && res.status < 400) {
      const loc = String(res.headers.get("Location") || "");
      if (loc.includes("login.html")) return false;
      return true;
    }
    return false;
  } catch (_) {
    return false;
  }
}

async function forgeSafeNext(raw) {
  const target = forgeNextUrl(raw);
  if (await forgePageReachable(target)) return target;
  // Dashboard / course parfois paywall serveur native → fallback stable
  if (await forgePageReachable("/start.html")) return "/start.html";
  return "/login.html";
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

    // NE PLUS auto-rediriger dès qu'il y a ?next= — ça bouclait :
    // getMe OK (cookie forge) → dashboard → 302 login?next=dashboard → ∞
    // On ne redirige que si la cible est vraiment joignable (200).
    if (nextParam) {
      const already = await getMe();
      if (already) {
        const dest = await forgeSafeNext(nextParam);
        if (dest && !dest.includes("login.html")) {
          window.location.replace(dest);
          return;
        }
        // Session client OK mais page protégée serveur → rester sur login (stable)
        showAlert(
          alertEl,
          "Session détectée mais l’accès page est bloqué côté serveur. Reconnecte-toi (email + mot de passe) ou ouvre Premiers pas.",
          "error"
        );
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
        const dest = await forgeSafeNext(
          new URLSearchParams(window.location.search).get("next")
        );
        window.location.href = dest.includes("login.html") ? "/start.html" : dest;
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
window.forgeSafeNext = forgeSafeNext;
