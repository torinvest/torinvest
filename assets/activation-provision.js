/**
 * Formulaires activation — envoi metadata Netlify (licence via Stripe + email Brevo).
 */
(function () {
  "use strict";

  var API = "/api/license-provision.php";

  function snapshotForm(form) {
    var fd = new FormData(form);
    var payload = {};
    fd.forEach(function (value, key) {
      if (key === "bot-field") return;
      payload[key] = value;
    });
    return payload;
  }

  function submitNetlifyForm(form) {
    var data = new FormData(form);
    return fetch("/", { method: "POST", body: data })
      .then(function (r) {
        return { ok: r.ok, status: r.status };
      })
      .catch(function () {
        return { ok: false, status: 0, error: "network_error" };
      });
  }

  function formatMetadataSuccess(kind) {
    var activationUrl =
      kind === "accompagnement"
        ? "/activation-accompagnement.html"
        : "/activation.html";
    var accessUrl =
      kind === "accompagnement"
        ? "/accompagnement-access.html"
        : "/ai-access.html";
    return (
      '<br><br><span class="ok">Profil enregistré.</span><br>' +
      '<span class="warn">Rappel :</span> ta licence est envoyée par email après paiement Stripe (vérifie les spams).<br>' +
      'Utilise le même email que sur Stripe.<br><br>' +
      '<a href="' +
      accessUrl +
      '" style="color:var(--gold2)">Accéder à mon espace →</a><br>' +
      '<a href="/payment-success.html?plan=' +
      (kind === "accompagnement" ? "accompagnement" : "vip") +
      '" style="color:var(--gold2)">Voir le parcours après paiement →</a>'
    );
  }

  function formatProvisionSuccess(data, kind) {
    if (!data || !data.ok) return "";
    var reused = data.reused ? " (licence existante réutilisée)" : "";
    if (kind === "accompagnement") {
      var links = data.accessLinks || {};
      return (
        '<br><br><span class="ok">Licence générée' +
        reused +
        " :</span><br><b>" +
        (data.license || "—") +
        '</b><br><span class="warn">Prochaine étape :</span> ' +
        '<a href="/accompagnement-access.html" style="color:var(--gold2)">valider ton accès →</a>' +
        (links.appLoginUrl
          ? '<br><a href="' +
            links.appLoginUrl +
            '" style="color:var(--gold2)" target="_blank" rel="noopener">Espace formation (login) →</a>'
          : "")
      );
    }
    return (
      '<br><br><span class="ok">Licence générée' +
      reused +
      " :</span><br><b>" +
      (data.license || "—") +
      "</b>" +
      (data.activationCode
        ? '<br><b>Code activation MT5 :</b> ' + data.activationCode
        : "") +
      (data.status === "pending_activation"
        ? '<br><span class="warn">Étape MT5 :</span> lie ta licence à ton compte MT5 avec ce code (EA ou page admin).'
        : "") +
      '<br><a href="/ai-access.html" style="color:var(--gold2)">Connexion AI Access →</a>'
    );
  }

  function submitActivationForm(formName, form, kind) {
    submitBtnSafe(form, true);
    return submitNetlifyForm(form).then(function (netlify) {
      submitBtnSafe(form, false);
      if (!netlify.ok) {
        return {
          ok: false,
          html:
            '<span class="bad">Échec envoi.</span><br>Netlify HTTP ' +
            (netlify.status || "?") +
            ". Réessaie ou contacte TORINVEST avec ton email de paiement.",
        };
      }
      return {
        ok: true,
        html:
          '<span class="ok">Merci — informations reçues.</span>' +
          formatMetadataSuccess(kind),
      };
    });
  }

  function submitBtnSafe(form, disabled) {
    var btn = form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = disabled;
  }

  window.TORINVEST_ACTIVATION = {
    snapshotForm: snapshotForm,
    submitNetlifyForm: submitNetlifyForm,
    submitActivationForm: submitActivationForm,
    formatMetadataSuccess: formatMetadataSuccess,
    formatProvisionSuccess: formatProvisionSuccess,
  };
})();
