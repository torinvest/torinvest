/**
 * Provision automatique licence après formulaire d'activation Netlify.
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

  function provisionFromPayload(formName, fields) {
    var payload = { action: "provision_vip" };
    if (formName === "activation-accompagnement-torinvest") {
      payload.action = "provision_accompagnement";
    }
    Object.keys(fields || {}).forEach(function (key) {
      if (key === "form-name" || key === "bot-field") return;
      payload[key] = fields[key];
    });
    return fetch(API, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (r) {
        return r.text().then(function (text) {
          try {
            return JSON.parse(text);
          } catch (e) {
            return { ok: false, error: "invalid_response", httpStatus: r.status, raw: text.slice(0, 120) };
          }
        });
      })
      .catch(function () {
        return { ok: false, error: "network_error" };
      });
  }

  function provisionAfterForm(formName, form) {
    return provisionFromPayload(formName, snapshotForm(form));
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

  window.TORINVEST_ACTIVATION = {
    snapshotForm: snapshotForm,
    provisionFromPayload: provisionFromPayload,
    provisionAfterForm: provisionAfterForm,
    formatProvisionSuccess: formatProvisionSuccess,
    submitNetlifyForm: submitNetlifyForm,
  };
})();
