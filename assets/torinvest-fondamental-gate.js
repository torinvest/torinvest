/**
 * Portail d'accès Fondamental (applifonda) — TorPass ACADEMY (≥ 250 KRM).
 * Le HTML du portail est déjà dans index.html ; ce script gère Phantom + unlock.
 */
(function () {
  "use strict";

  var MIN_LEVEL = "ACADEMY";

  function levelRank(key) {
    var order =
      (window.TorinvestTorpass && window.TorinvestTorpass.LEVEL_ORDER) || [
        "PUBLIC",
        "COMMUNITY",
        "ACADEMY",
        "COACHING",
      ];
    var i = order.indexOf(key);
    return i < 0 ? 0 : i;
  }

  function hasAcademyAccess(krmBalance) {
    var T = window.TorinvestTorpass;
    if (!T) return false;
    var level = T.getLevelFromBalance(krmBalance);
    return levelRank(level) >= levelRank(MIN_LEVEL);
  }

  function setMsg(text, ok) {
    var msg = document.getElementById("tf-fonda-msg");
    if (!msg) return;
    msg.textContent = text || "";
    msg.className = "msg " + (ok ? "ok" : "ko");
  }

  function showGate() {
    document.documentElement.classList.add("tf-fonda-locked");
    var el = document.getElementById("tf-fonda-gate");
    if (el) el.hidden = false;
  }

  function hideGate() {
    document.documentElement.classList.remove("tf-fonda-locked");
    var el = document.getElementById("tf-fonda-gate");
    if (el) el.hidden = true;
  }

  async function connectAndCheck() {
    setMsg("Connexion Phantom…", true);
    try {
      var T = window.TorinvestTorpass;
      if (!T) throw new Error("Module TorPass manquant");
      var provider = T.getPhantomProvider && T.getPhantomProvider();
      if (!provider) {
        setMsg(
          "Phantom introuvable. Installe l'extension puis reessaie.",
          false
        );
        return;
      }
      var wallet = await T.connectWallet(provider);
      if (!wallet) throw new Error("Wallet non detecte");

      setMsg("Lecture du solde KRM…", true);
      var bal = Number(await T.readKrmBalance(wallet)) || 0;
      var level = T.getLevelFromBalance(bal);
      var need = (T.TORPASS_LEVELS && T.TORPASS_LEVELS.ACADEMY) || 250;

      if (!hasAcademyAccess(bal)) {
        setMsg(
          "Acces refuse — niveau " +
            level +
            " (" +
            T.formatKrm(bal) +
            " KRM). Il faut >= " +
            need +
            " KRM (ACADEMY).",
          false
        );
        return;
      }

      setMsg(
        "Acces ACADEMY OK — " + T.formatKrm(bal) + " KRM. Ouverture…",
        true
      );
      hideGate();
    } catch (e) {
      setMsg((e && e.message) || "Erreur de connexion", false);
    }
  }

  function boot() {
    // Si on n'est pas sous /applifonda/, forcer la bonne URL (basename React).
    var path = window.location.pathname || "";
    if (path === "/fondamental" || path === "/fondamental/") {
      window.location.replace("/applifonda/");
      return;
    }

    showGate();
    setMsg("Connecte Phantom pour verifier ton niveau TorPass.", true);

    var btn = document.getElementById("tf-fonda-connect");
    if (btn && !btn._tfBound) {
      btn._tfBound = true;
      btn.addEventListener("click", connectAndCheck);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
