/**
 * Garde d'accès pour AITORINVEST2.html (page dev sans licence).
 * Redirige vers dev-access.html si la session développeur est absente ou expirée.
 */
(function () {
  const STORAGE_KEY = "torinvest_dev_session";
  const GATE_URL = "/dev-access.html";

  function redirectToGate() {
    window.location.replace(GATE_URL);
  }

  let session;
  try {
    session = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch (e) {
    redirectToGate();
    return;
  }

  if (!session || !session.token) {
    redirectToGate();
    return;
  }

  if (session.expiresAt && Date.now() / 1000 > session.expiresAt) {
    localStorage.removeItem(STORAGE_KEY);
    redirectToGate();
    return;
  }

  var authUrl = (window.TORINVEST_PHP
    ? window.TORINVEST_PHP.url("/api/dev-auth.php")
  : "/api/dev-auth.php") + "?token=" + encodeURIComponent(session.token);

  fetch(authUrl)
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!data.ok) {
        localStorage.removeItem(STORAGE_KEY);
        redirectToGate();
      }
    })
    .catch(function () {
      // Hors ligne : on garde la session locale si pas expirée
    });
})();
