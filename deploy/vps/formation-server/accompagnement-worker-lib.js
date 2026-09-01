/**
 * Validation licence ACCOMPAGNEMENT via Worker Cloudflare (même source que CRM).
 */
"use strict";

function isAccompagnementPlan(plan) {
  const p = String(plan || "").toUpperCase().trim();
  return p === "ACCOMPAGNEMENT" || p.startsWith("ACCOMP");
}

async function validateAccompagnementLicense(workerUrl, email, licenseKey) {
  const base = String(workerUrl || "").replace(/\/$/, "");
  const key = String(licenseKey || "").trim();
  const em = String(email || "")
    .trim()
    .toLowerCase();
  if (!base || !key || !em) {
    return { ok: false, reason: "missing_params" };
  }

  const qs = new URLSearchParams({ key, email: em });
  const url = base + "/validate-license?" + qs.toString();

  let res;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(20000),
    });
  } catch (err) {
    return { ok: false, reason: "worker_unreachable", detail: String(err.message || err) };
  }

  const data = await res.json().catch(() => ({}));
  if (!data || !data.ok) {
    return {
      ok: false,
      reason: String(data.reason || data.error || "license_invalid"),
    };
  }
  if (!isAccompagnementPlan(data.plan)) {
    return { ok: false, reason: "not_accompagnement_plan" };
  }
  return { ok: true, data };
}

module.exports = {
  validateAccompagnementLicense,
  isAccompagnementPlan,
};
