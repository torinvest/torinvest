/**
 * Garde d'accès TORINVEST AI Access — session HttpOnly (cookie same-origin /api).
 */
(function () {
  "use strict";

  var LOGIN_PAGE = "/ai-access.html";
  var API_URL = "/api/ai-access.php";
  var PING_INTERVAL_MS = 10 * 60 * 1000;
  var LEGACY_KEYS = [
    "torinvest_ai_access_session_v2",
    "torinvest_ai_access_session",
    "torinvest_dev_session",
  ];

  function redirectLogin() {
    window.location.replace(LOGIN_PAGE);
  }

  function clearLegacyStorage() {
    LEGACY_KEYS.forEach(function (key) {
      try {
        localStorage.removeItem(key);
      } catch (e) {}
    });
  }

  async function apiCall(action, body) {
    var resp = await fetch(API_URL, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(Object.assign({ action: action }, body || {})),
    });
    var text = await resp.text();
    var data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error(text.slice(0, 200) || "Réponse invalide");
    }
    if (!resp.ok && !data.error) data.error = "HTTP " + resp.status;
    return data;
  }

  window.TORINVEST_AI_ACCESS = {
    API_URL: API_URL,
    session: null,

    api: apiCall,

    isAdmin: function () {
      return this.session && this.session.role === "admin";
    },

    logout: async function () {
      try {
        await apiCall("logout", {});
      } catch (e) {}
      clearLegacyStorage();
      this.session = null;
      redirectLogin();
    },

    renderSessionBadge: function () {
      var el = document.getElementById("sessionBadge");
      if (!el || !this.session) return;
      var s = this.session;
      if (s.role === "admin") {
        el.innerHTML =
          '<span class="badge ok">ADMIN</span> Accès développeur · sans licence';
      } else {
        el.innerHTML =
          '<span class="badge blue">' +
          (s.plan || "VIP") +
          "</span> " +
          (s.email || "Client") +
          " · expire " +
          (s.licenseExpires || s.expires || "N/A").slice(0, 10);
      }
    },
  };

  async function verifySession() {
    clearLegacyStorage();

    try {
      var data = await apiCall("ping", {});
      if (!data.ok) throw new Error(data.error || "session_expired");
      window.TORINVEST_AI_ACCESS.session = data;
      document.body.classList.remove("auth-pending");
      window.TORINVEST_AI_ACCESS.renderSessionBadge();
      window.dispatchEvent(new CustomEvent("torinvest-ai-access-ready"));
    } catch (err) {
      clearLegacyStorage();
      redirectLogin();
      return;
    }

    setInterval(async function () {
      var sess = window.TORINVEST_AI_ACCESS.session;
      if (!sess) return;
      try {
        var ping = await apiCall("ping", {});
        if (!ping.ok) throw new Error("expired");
        window.TORINVEST_AI_ACCESS.session = Object.assign({}, sess, ping);
        window.TORINVEST_AI_ACCESS.renderSessionBadge();
      } catch (e) {
        clearLegacyStorage();
        redirectLogin();
      }
    }, PING_INTERVAL_MS);
  }

  document.body.classList.add("auth-pending");
  verifySession();
})();
