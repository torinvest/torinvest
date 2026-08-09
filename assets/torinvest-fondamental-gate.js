/**
 * Portail d'accès Fondamental (applifonda) — TorPass ACADEMY (≥ 250 KRM).
 * Bloque le rendu tant que le solde n'est pas validé via Phantom.
 */
(function () {
  "use strict";

  var MIN_LEVEL = "ACADEMY";
  var STORAGE_KEY = "torinvest_fondamental_gate_ok";

  function levelRank(key) {
    var order = (window.TorinvestTorpass && window.TorinvestTorpass.LEVEL_ORDER) || [
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

  function ensureStyles() {
    if (document.getElementById("tf-fonda-gate-style")) return;
    var style = document.createElement("style");
    style.id = "tf-fonda-gate-style";
    style.textContent =
      "#tf-fonda-gate{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:24px;background:radial-gradient(circle at top,#152033,#07090f 65%);color:#f3f0e8;font-family:system-ui,sans-serif}" +
      "#tf-fonda-gate[hidden]{display:none!important}" +
      "#tf-fonda-gate .box{max-width:460px;width:100%;border:1px solid rgba(232,184,74,.35);border-radius:18px;background:rgba(18,26,43,.96);padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.45)}" +
      "#tf-fonda-gate h1{margin:0 0 8px;font-size:22px;letter-spacing:.04em}" +
      "#tf-fonda-gate p{margin:0 0 12px;color:#a8b0bf;font-size:14px;line-height:1.5}" +
      "#tf-fonda-gate .meta{font-size:12px;color:#e8b84a;margin-bottom:14px}" +
      "#tf-fonda-gate button,#tf-fonda-gate a.btn{display:inline-block;border:0;border-radius:10px;padding:10px 14px;font-weight:700;cursor:pointer;text-decoration:none;font-size:14px}" +
      "#tf-fonda-gate .primary{background:linear-gradient(90deg,#f97316,#facc15);color:#111}" +
      "#tf-fonda-gate .ghost{background:transparent;border:1px solid rgba(232,184,74,.4);color:#e8b84a;margin-left:8px}" +
      "#tf-fonda-gate .msg{margin-top:12px;font-size:13px;min-height:1.2em}" +
      "#tf-fonda-gate .ok{color:#34d399}#tf-fonda-gate .ko{color:#f87171}" +
      "html.tf-fonda-locked #root{visibility:hidden!important}";
    document.head.appendChild(style);
  }

  function showGate() {
    ensureStyles();
    document.documentElement.classList.add("tf-fonda-locked");
    var el = document.getElementById("tf-fonda-gate");
    if (el) {
      el.hidden = false;
      return el;
    }
    el = document.createElement("div");
    el.id = "tf-fonda-gate";
    el.innerHTML =
      '<div class="box">' +
      "<h1>FONDAMENTAL</h1>" +
      "<p>Appli pédagogique TORINVEST — accès payant via détention <strong>KRM</strong> (TorPass).</p>" +
      '<div class="meta">Niveau requis : ACADEMY · ≥ 250 KRM</div>' +
      '<button type="button" class="primary" id="tf-fonda-connect">Connecter Phantom</button>' +
      '<a class="btn ghost" href="/torpass">Voir TorPass</a>' +
      '<div class="msg" id="tf-fonda-msg"></div>' +
      "</div>";
    document.body.appendChild(el);
    document.getElementById("tf-fonda-connect").addEventListener("click", connectAndCheck);
    return el;
  }

  function hideGate() {
    document.documentElement.classList.remove("tf-fonda-locked");
    var el = document.getElementById("tf-fonda-gate");
    if (el) el.hidden = true;
  }

  function setMsg(text, ok) {
    var msg = document.getElementById("tf-fonda-msg");
    if (!msg) return;
    msg.textContent = text || "";
    msg.className = "msg " + (ok ? "ok" : "ko");
  }

  function unlock() {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch (e) {}
    hideGate();
  }

  async function connectAndCheck() {
    setMsg("Connexion Phantom…", true);
    try {
      var T = window.TorinvestTorpass;
      if (!T) throw new Error("Module TorPass manquant");
      var provider = T.getPhantomProvider && T.getPhantomProvider();
      if (!provider) {
        setMsg("Phantom introuvable. Installe l’extension puis réessaie.", false);
        return;
      }
      var wallet = await T.connectWallet(provider);
      if (!wallet) throw new Error("Wallet non détecté");

      setMsg("Lecture du solde KRM…", true);
      var bal = Number(await T.readKrmBalance(wallet)) || 0;
      var level = T.getLevelFromBalance(bal);
      var need = (T.TORPASS_LEVELS && T.TORPASS_LEVELS.ACADEMY) || 250;

      if (!hasAcademyAccess(bal)) {
        setMsg(
          "Accès refusé — niveau " +
            level +
            " (" +
            T.formatKrm(bal) +
            " KRM). Il faut ≥ " +
            need +
            " KRM (ACADEMY).",
          false
        );
        return;
      }

      setMsg("Accès ACADEMY OK — " + T.formatKrm(bal) + " KRM. Ouverture…", true);
      unlock();
    } catch (e) {
      setMsg((e && e.message) || "Erreur de connexion", false);
    }
  }

  function boot() {
    // Toujours afficher le gate au chargement (re-vérif session).
    showGate();
    setMsg("Connecte Phantom pour vérifier ton niveau TorPass.", true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
