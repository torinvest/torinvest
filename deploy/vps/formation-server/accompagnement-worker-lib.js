/**
 * Validation licence ACCOMPAGNEMENT via Worker Cloudflare (même source que le CRM).
 * Flux client : email Stripe + clé TOR-ACCOMPAGNEMENT dans le champ mot de passe.
 */
"use strict";

function isAccompagnementPlan(plan) {
  const p = String(plan || "")
    .toUpperCase()
    .trim();
  return p === "ACCOMPAGNEMENT" || p.startsWith("ACCOMP");
}

function looksLikeTorLicense(value) {
  const v = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  return (
    v.startsWith("TOR-ACCOMPAGNEMENT") ||
    v.startsWith("TOR-ACCOMP") ||
    /^TOR-[A-Z0-9-]+$/.test(v)
  );
}

function normalizeLicenseKey(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[\r\n\t]+/g, "")
    .replace(/\s+/g, "")
    .trim();
}

async function callValidate(base, params) {
  const url = base + "/validate-license?" + new URLSearchParams(params).toString();
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
      data,
    };
  }
  return { ok: true, data };
}

/**
 * @returns {{ ok: boolean, reason?: string, data?: object, via?: string }}
 */
async function validateAccompagnementLicense(workerUrl, email, licenseKey) {
  const base = String(workerUrl || "").replace(/\/$/, "");
  const key = normalizeLicenseKey(licenseKey);
  const em = String(email || "")
    .trim()
    .toLowerCase();
  if (!base || !key || !em) {
    return { ok: false, reason: "missing_params" };
  }

  // 1) email + clé (cas normal CRM)
  const withEmail = await callValidate(base, { key, email: em });
  if (withEmail.ok) {
    if (!isAccompagnementPlan(withEmail.data.plan)) {
      return { ok: false, reason: "not_accompagnement_plan", data: withEmail.data };
    }
    return { ok: true, data: withEmail.data, via: "key_email" };
  }

  // 2) clé seule — si l'email saisi ≠ email lié à la licence
  const keyOnly = await callValidate(base, { key });
  if (keyOnly.ok) {
    if (!isAccompagnementPlan(keyOnly.data.plan)) {
      return { ok: false, reason: "not_accompagnement_plan", data: keyOnly.data };
    }
    return { ok: true, data: keyOnly.data, via: "key_only" };
  }

  return {
    ok: false,
    reason: withEmail.reason || keyOnly.reason || "license_invalid",
    detail: withEmail.detail || keyOnly.detail,
  };
}

module.exports = {
  validateAccompagnementLicense,
  isAccompagnementPlan,
  looksLikeTorLicense,
  normalizeLicenseKey,
};
