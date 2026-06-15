/**
 * Netlify submission-created — provision licence côté serveur (sans dépendre du navigateur).
 * Env requises sur Netlify : PROVISION_WEBHOOK_SECRET (= provision_webhook_secret radar)
 */
exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  var secret = process.env.PROVISION_WEBHOOK_SECRET || "";
  if (!secret) {
    console.error("PROVISION_WEBHOOK_SECRET manquant sur Netlify");
    return { statusCode: 500, body: "Config missing" };
  }

  var body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  var payload = body.payload || body;
  var formName =
    payload.form_name ||
    payload.name ||
    (payload.data && payload.data["form-name"]) ||
    "";

  var allowed = ["activation-torinvest", "activation-accompagnement-torinvest", "liste-attente-torinvest"];
  if (allowed.indexOf(formName) === -1) {
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, skipped: true, form_name: formName }),
    };
  }

  var radarUrl =
    process.env.PROVISION_RADAR_URL ||
    "https://radar.torinvest-trading.com/api/license-provision.php";

  var forward = {
    form_name: formName,
    data: payload.data || payload,
    id: payload.id || null,
    number: payload.number || null,
    netlify_id: payload.id || null,
    netlify_number: payload.number || null,
  };

  try {
    var resp = await fetch(radarUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Provision-Key": secret,
      },
      body: JSON.stringify(forward),
    });
    var text = await resp.text();
    console.log("Provision radar", resp.status, text.slice(0, 500));
    return { statusCode: 200, body: text };
  } catch (err) {
    console.error("Provision radar error", err);
    return { statusCode: 502, body: "Radar unreachable" };
  }
};
