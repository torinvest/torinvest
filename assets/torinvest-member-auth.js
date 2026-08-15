/**
 * TORINVEST — Auth membres du site (soft gate).
 * Session HttpOnly via /api/member-auth.php (radar).
 *
 * Usage :
 * - Pages protégées : <body data-member-required="1"> + ce script
 * - Pages publiques : appeler TorinvestMember.decorateNav() si besoin
 */
(function () {
  "use strict";

  var MEMBERS_PAGE = "/membres.html";
  var SPACE_PAGE = "/espace-membre.html";

  function apiUrl() {
    if (window.TORINVEST_PHP && typeof window.TORINVEST_PHP.url === "function") {
      return window.TORINVEST_PHP.url("/api/member-auth.php");
    }
    return "/api/member-auth.php";
  }

  function nextParam() {
    try {
      return encodeURIComponent(
        window.location.pathname + window.location.search + window.location.hash
      );
    } catch (e) {
      return encodeURIComponent("/");
    }
  }

  function membersUrl(mode) {
    var q = "?next=" + nextParam();
    if (mode) q += "&mode=" + encodeURIComponent(mode);
    return MEMBERS_PAGE + q;
  }

  function api(action, body) {
    return fetch(apiUrl(), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(Object.assign({ action: action }, body || {})),
    }).then(function (resp) {
      return resp.text().then(function (text) {
        var data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          data = { ok: false, error: text.slice(0, 180) || "invalid_json" };
        }
        data._http = resp.status;
        return data;
      });
    });
  }

  function redirectToMembers(mode) {
    window.location.replace(membersUrl(mode || "login"));
  }

  function ensureOverlayStyles() {
    if (document.getElementById("torinvest-member-gate-style")) return;
    var style = document.createElement("style");
    style.id = "torinvest-member-gate-style";
    style.textContent =
      "body.member-gate-pending{visibility:hidden}" +
      "body.member-gate-blocked{visibility:visible}" +
      "#torinvestMemberGate{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(2,6,23,.88);backdrop-filter:blur(8px)}" +
      "#torinvestMemberGate .box{max-width:420px;width:100%;border-radius:18px;border:1px solid rgba(148,163,184,.28);background:linear-gradient(180deg,#152033,#0b1220);padding:22px;color:#f8fafc;font-family:system-ui,sans-serif}" +
      "#torinvestMemberGate h2{margin:0 0 8px;font-size:1.25rem}" +
      "#torinvestMemberGate p{margin:0 0 16px;color:#94a3b8;font-size:14px;line-height:1.5}" +
      "#torinvestMemberGate .actions{display:flex;flex-wrap:wrap;gap:10px}" +
      "#torinvestMemberGate a{display:inline-flex;align-items:center;justify-content:center;padding:10px 14px;border-radius:999px;text-decoration:none;font-weight:600;font-size:13px}" +
      "#torinvestMemberGate .primary{background:linear-gradient(90deg,#f97316,#facc15);color:#020617}" +
      "#torinvestMemberGate .ghost{border:1px solid rgba(148,163,184,.35);color:#e2e8f0}";
    document.head.appendChild(style);
  }

  function showBlockedGate() {
    ensureOverlayStyles();
    document.body.classList.remove("member-gate-pending");
    document.body.classList.add("member-gate-blocked");
    if (document.getElementById("torinvestMemberGate")) return;
    var el = document.createElement("div");
    el.id = "torinvestMemberGate";
    el.setAttribute("role", "dialog");
    el.innerHTML =
      '<div class="box">' +
      "<h2>Espace membres TORINVEST</h2>" +
      "<p>Cette page est réservée aux membres inscrits. Crée un compte gratuit pour continuer — l’accueil, TorPass et les offres restent accessibles.</p>" +
      '<div class="actions">' +
      '<a class="primary" href="' +
      membersUrl("register") +
      '">Créer un compte</a>' +
      '<a class="ghost" href="' +
      membersUrl("login") +
      '">Se connecter</a>' +
      '<a class="ghost" href="/">Accueil</a>' +
      "</div></div>";
    document.body.appendChild(el);
  }

  function decorateNav(member) {
    var slots = document.querySelectorAll("[data-member-nav]");
    slots.forEach(function (slot) {
      if (member && member.email) {
        slot.innerHTML =
          '<a href="' +
          SPACE_PAGE +
          '">Mon espace</a>' +
          ' · <button type="button" data-member-logout="1" style="all:unset;cursor:pointer;color:inherit;text-decoration:underline">Déconnexion</button>';
      } else {
        slot.innerHTML =
          '<a href="' +
          MEMBERS_PAGE +
          '?mode=register">Inscription</a>' +
          ' · <a href="' +
          MEMBERS_PAGE +
          '?mode=login">Connexion</a>';
      }
    });
    document.querySelectorAll("[data-member-logout]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        window.TorinvestMember.logout().then(function () {
          window.location.href = "/";
        });
      });
    });
  }

  window.TorinvestMember = {
    session: null,
    api: api,
    membersPage: MEMBERS_PAGE,
    spacePage: SPACE_PAGE,

    me: function () {
      return api("me", {}).then(function (data) {
        if (data && data.ok && data.member) {
          window.TorinvestMember.session = data;
          return data;
        }
        window.TorinvestMember.session = null;
        return null;
      });
    },

    register: function (email, password, displayName) {
      return api("register", {
        email: email,
        password: password,
        displayName: displayName || "",
      }).then(function (data) {
        if (!data || !data.ok) {
          throw new Error((data && data.error) || "register_failed");
        }
        window.TorinvestMember.session = data;
        return data;
      });
    },

    login: function (email, password) {
      return api("login", { email: email, password: password }).then(function (data) {
        if (!data || !data.ok) {
          throw new Error((data && data.error) || "login_failed");
        }
        window.TorinvestMember.session = data;
        return data;
      });
    },

    logout: function () {
      return api("logout", {}).then(function () {
        window.TorinvestMember.session = null;
      });
    },

    decorateNav: decorateNav,

    requireMember: function () {
      document.body.classList.add("member-gate-pending");
      return window.TorinvestMember.me().then(function (data) {
        if (data && data.member) {
          document.body.classList.remove("member-gate-pending");
          decorateNav(data.member);
          return data;
        }
        showBlockedGate();
        return null;
      }).catch(function () {
        showBlockedGate();
        return null;
      });
    },
  };

  function boot() {
    var required =
      document.body &&
      document.body.getAttribute("data-member-required") === "1";
    if (required) {
      window.TorinvestMember.requireMember();
      return;
    }
    window.TorinvestMember.me()
      .then(function (data) {
        decorateNav(data && data.member ? data.member : null);
      })
      .catch(function () {
        decorateNav(null);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
