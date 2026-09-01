/**
 * La Forge — hub Fondamental dans l'app formation.
 * Accès : abonnement Premium La Forge OU Phantom + KRM TorPass ACADEMY (≥ seuil).
 */
(function () {
  "use strict";

  var WWW = "https://www.torinvest-trading.com";
  var FONDA_API = WWW + "/api/fondamental-access.php";
  var FONDA_APP = "/applifonda/";

  function setStatus(text, kind) {
    var el = document.getElementById("fonda-status");
    if (!el) return;
    el.textContent = text || "";
    el.className =
      "alert " + (kind === "ok" ? "alert-success" : kind === "warn" ? "alert-warn" : "alert-error");
    el.hidden = !text;
  }

  function showGate() {
    document.body.classList.remove("fonda-app-open");
    var g = document.getElementById("fonda-krm-gate");
    if (g) g.hidden = false;
  }

  function hideGate() {
    var g = document.getElementById("fonda-krm-gate");
    if (g) g.hidden = true;
  }

  function showFrame() {
    hideGate();
    document.body.classList.add("fonda-app-open");
    var wrap = document.getElementById("fonda-frame-wrap");
    var frame = document.getElementById("fonda-frame");
    if (wrap) wrap.hidden = false;
    if (frame) frame.src = FONDA_APP;
  }

  function apiJson(url, options) {
    var opts = options || {};
    opts.credentials = "include";
    return fetch(url, opts).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok || j && j.ok === false) {
          var err = new Error((j && (j.error || j.message)) || "HTTP " + r.status);
          err.payload = j || {};
          err.status = r.status;
          throw err;
        }
        return j;
      });
    });
  }

  function fmtKrm(n) {
    try {
      return Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
    } catch (e) {
      return String(n);
    }
  }

  function bytesToBase64(bytes) {
    var bin = "";
    var u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    for (var i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
    return btoa(bin);
  }

  function getProvider() {
    var p = window.solana || (window.phantom && window.phantom.solana);
    if (p && p.isPhantom) return p;
    return null;
  }

  function isPremiumMe(me) {
    if (!me) return false;
    if (me.subscribed === true || me.subscribed === 1 || me.subscribed === "true") {
      return true;
    }
    var plan = String(me.plan || "").toLowerCase();
    return plan === "premium" || plan === "subscribed";
  }

  function formatActivateError(e) {
    var p = (e && e.payload) || {};
    var parts = [];
    if (p.error) parts.push(String(p.error));
    if (p.detail) parts.push(String(p.detail));
    if (p.hint) parts.push(String(p.hint));
    if (e && e.message && parts.indexOf(e.message) === -1) parts.push(e.message);
    return parts.join(" — ") || "activation impossible";
  }

  async function pingFondaSession() {
    try {
      return await apiJson("/api/fondamental-bridge/status", { method: "GET" });
    } catch (e) {
      try {
        return await apiJson(FONDA_API + "?action=ping", { method: "GET" });
      } catch (e2) {
        return null;
      }
    }
  }

  async function tryFormationBridge() {
    await apiJson("/api/fondamental-bridge/activate", { method: "POST" });
    return true;
  }

  async function openPremiumFondamental() {
    var btn = document.getElementById("fonda-open-premium");
    if (btn) btn.disabled = true;
    try {
      setStatus("Activation Fondamental (abonnement Premium)…", "ok");
      await tryFormationBridge();
      setStatus("Fondamental ouvert — chargement des modules…", "ok");
      showFrame();
    } catch (e) {
      setStatus("Ouverture Premium échouée : " + formatActivateError(e), "warn");
      showGate();
      updatePremiumUi({ subscribed: true, plan: "premium" });
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function updatePremiumUi(me) {
    var isPremium = isPremiumMe(me);
    var loggedIn = !!(me && me.email);
    var loginHint = document.getElementById("fonda-login-hint");
    var openPremium = document.getElementById("fonda-open-premium");
    var pricing = document.getElementById("fonda-pricing-link");
    if (loginHint) loginHint.hidden = loggedIn || isPremium;
    if (openPremium) openPremium.hidden = !isPremium;
    if (pricing) pricing.hidden = isPremium;
  }

  async function loginWalletKrm(provider, wallet) {
    setStatus("Challenge serveur KRM…", "ok");
    var ch = await apiJson(FONDA_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "challenge", wallet: wallet }),
    });
    setStatus("Signature Phantom…", "ok");
    var encoded = new TextEncoder().encode(ch.message);
    var signed = await provider.signMessage(encoded, "utf8");
    var sig = signed.signature || signed;
    setStatus("Vérification solde KRM (serveur)…", "ok");
    await apiJson(FONDA_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "login_wallet",
        wallet: wallet,
        message: ch.message,
        nonce: ch.nonce,
        signature: bytesToBase64(sig),
      }),
    });
  }

  async function connectPhantomKrm() {
    var btn = document.getElementById("fonda-krm-connect");
    if (btn) btn.disabled = true;
    try {
      var provider = getProvider();
      if (!provider) {
        setStatus("Installe Phantom pour vérifier ton niveau TorPass ACADEMY.", "warn");
        window.open("https://phantom.app/", "_blank", "noopener,noreferrer");
        return;
      }
      setStatus("Connexion Phantom…", "ok");
      var res = await provider.connect();
      var pk = (res && res.publicKey) || provider.publicKey;
      if (!pk) throw new Error("Wallet non détecté");
      await loginWalletKrm(provider, pk.toString());
      setStatus("Accès KRM validé — chargement de Fondamental…", "ok");
      showFrame();
    } catch (e) {
      var p = (e && e.payload) || {};
      if (p.code === "INSUFFICIENT_KRM" || (p.krm != null && p.minKrm != null)) {
        setStatus(
          "Solde insuffisant — " +
            fmtKrm(p.krm) +
            " KRM. Il faut ≥ " +
            fmtKrm(p.minKrm) +
            " KRM (TorPass ACADEMY) ou l'abonnement La Forge Premium.",
          "warn"
        );
      } else if ((e.payload && e.payload.error) === "premium_required") {
        setStatus("Utilise Phantom + KRM ou souscrivez à La Forge Premium.", "warn");
      } else {
        setStatus((e && e.message) || "Connexion impossible", "warn");
      }
      showGate();
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function initFondamentalHub() {
    var me = null;
    try {
      me = typeof getMe === "function" ? await getMe() : null;
    } catch (_) {
      me = null;
    }

    var isPremium = isPremiumMe(me);
    updatePremiumUi(me);

    var openBtn = document.getElementById("fonda-open-premium");
    if (openBtn && !openBtn._fondaBound) {
      openBtn._fondaBound = true;
      openBtn.addEventListener("click", openPremiumFondamental);
    }

    var sess = await pingFondaSession();

    if (isPremium) {
      await openPremiumFondamental();
      return;
    }

    if (sess && sess.ok) {
      if (sess.source === "formation") {
        setStatus("Accès Premium La Forge — ouverture de Fondamental…", "ok");
      } else if (sess.krm != null) {
        setStatus("Session TorPass — " + fmtKrm(sess.krm) + " KRM. Ouverture…", "ok");
      } else {
        setStatus("Session active — ouverture de Fondamental…", "ok");
      }
      showFrame();
      return;
    }

    if (me) {
      setStatus(
        "Deux accès : abonnement La Forge Premium (349€/an) ou TorPass ACADEMY (≥ 250 KRM via Phantom).",
        "ok"
      );
    } else {
      setStatus(
        "TorPass ACADEMY : connecte Phantom ci-dessous. Abonnés La Forge : connectez-vous avec l'email Stripe.",
        "ok"
      );
    }

    showGate();
    var btn = document.getElementById("fonda-krm-connect");
    if (btn && !btn._fondaBound) {
      btn._fondaBound = true;
      btn.addEventListener("click", connectPhantomKrm);
    }
  }

  document.addEventListener("DOMContentLoaded", initFondamentalHub);
  window.openPremiumFondamental = openPremiumFondamental;
})();
