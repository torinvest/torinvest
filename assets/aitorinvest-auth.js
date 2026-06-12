/**
 * Garde d'accès TORINVEST AI Access — session radar (licence client ou admin PIN).
 */
(function () {
  "use strict";

  var LOGIN_PAGE = "/ai-access.html";
  var API_URL = "https://radar.torinvest-trading.com/api/ai-access.php";
  var STORAGE_KEY = "torinvest_ai_access_session_v2";
  var PING_INTERVAL_MS = 10 * 60 * 1000;

  function redirectLogin() {
    window.location.replace(LOGIN_PAGE);
  }

  function readSession() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    } catch (e) {
      return null;
    }
  }

  function saveSession(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function clearSession() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("torinvest_ai_access_session");
    localStorage.removeItem("torinvest_dev_session");
  }

  async function apiCall(action, body, token) {
    var headers = { "Content-Type": "application/json", Accept: "application/json" };
    if (token) headers.Authorization = "Bearer " + token;
    var resp = await fetch(API_URL, {
      method: "POST",
      headers: headers,
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
    STORAGE_KEY: STORAGE_KEY,
    session: null,

    api: apiCall,

    getToken: function () {
      return (this.session && this.session.token) || "";
    },

    getAuthHeaders: function () {
      var t = this.getToken();
      return t
        ? { "Content-Type": "application/json", Authorization: "Bearer " + t }
        : { "Content-Type": "application/json" };
    },

    isAdmin: function () {
      return this.session && this.session.role === "admin";
    },

    logout: function () {
      clearSession();
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
    var stored = readSession();
    if (!stored || !stored.token) {
      redirectLogin();
      return;
    }

    try {
      var data = await apiCall("ping", {}, stored.token);
      if (!data.ok) throw new Error(data.error || "session_expired");
      window.TORINVEST_AI_ACCESS.session = Object.assign({}, stored, data);
      saveSession(window.TORINVEST_AI_ACCESS.session);
      document.body.classList.remove("auth-pending");
      window.TORINVEST_AI_ACCESS.renderSessionBadge();
      window.dispatchEvent(new CustomEvent("torinvest-ai-access-ready"));
    } catch (err) {
      if (stored.expiresAt && stored.expiresAt * 1000 > Date.now()) {
        window.TORINVEST_AI_ACCESS.session = stored;
        document.body.classList.remove("auth-pending");
        window.TORINVEST_AI_ACCESS.renderSessionBadge();
        window.dispatchEvent(new CustomEvent("torinvest-ai-access-ready"));
        setInterval(function () {
          apiCall("ping", {}, stored.token).catch(function () {});
        }, PING_INTERVAL_MS);
        return;
      }
      clearSession();
      redirectLogin();
    }

    setInterval(async function () {
      var sess = window.TORINVEST_AI_ACCESS.session;
      if (!sess || !sess.token) return;
      try {
        var ping = await apiCall("ping", {}, sess.token);
        if (!ping.ok) throw new Error("expired");
        window.TORINVEST_AI_ACCESS.session = Object.assign({}, sess, ping);
        saveSession(window.TORINVEST_AI_ACCESS.session);
        window.TORINVEST_AI_ACCESS.renderSessionBadge();
      } catch (e) {
        clearSession();
        redirectLogin();
      }
    }, PING_INTERVAL_MS);
  }

  document.body.classList.add("auth-pending");
  verifySession();
})();
