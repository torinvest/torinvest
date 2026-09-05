/**
 * Validation licence ACCOMPAGNEMENT via Worker Cloudflare (même source que le CRM).
 * Flux client : email Stripe + clé TOR-ACCOMPAGNEMENT dans le champ mot de passe.
 *
 * Sécurité : la clé seule ne suffit jamais — l'email Worker doit matcher l'email saisi.
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

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function emailsMatch(a, b) {
  const ea = normalizeEmail(a);
  const eb = normalizeEmail(b);
  if (!ea || !eb) return false;
  return ea === eb;
}

function licenseBoundEmail(data) {
  if (!data || typeof data !== "object") return "";
  return normalizeEmail(
    data.email || data.ownerEmail || data.owner_email || data.userEmail || ""
  );
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
 * @returns {{ ok: boolean, reason?: string, data?: object, via?: string, boundEmail?: string }}
 */
async function validateAccompagnementLicense(workerUrl, email, licenseKey) {
  const base = String(workerUrl || "").replace(/\/$/, "");
  const key = normalizeLicenseKey(licenseKey);
  const em = normalizeEmail(email);
  if (!base || !key || !em) {
    return { ok: false, reason: "missing_params" };
  }

  // 1) email + clé (cas normal CRM)
  const withEmail = await callValidate(base, { key, email: em });
  if (withEmail.ok) {
    if (!isAccompagnementPlan(withEmail.data.plan)) {
      return { ok: false, reason: "not_accompagnement_plan", data: withEmail.data };
    }
    const bound = licenseBoundEmail(withEmail.data) || em;
    if (licenseBoundEmail(withEmail.data) && !emailsMatch(bound, em)) {
      return { ok: false, reason: "email_mismatch", data: withEmail.data };
    }
    return { ok: true, data: withEmail.data, via: "key_email", boundEmail: bound };
  }

  // 2) clé seule — UNIQUEMENT si l'email Worker matche l'email saisi
  const keyOnly = await callValidate(base, { key });
  if (keyOnly.ok) {
    if (!isAccompagnementPlan(keyOnly.data.plan)) {
      return { ok: false, reason: "not_accompagnement_plan", data: keyOnly.data };
    }
    const bound = licenseBoundEmail(keyOnly.data);
    if (!bound) {
      return { ok: false, reason: "email_required", data: keyOnly.data };
    }
    if (!emailsMatch(bound, em)) {
      return { ok: false, reason: "email_mismatch", data: keyOnly.data };
    }
    return { ok: true, data: keyOnly.data, via: "key_bound_email", boundEmail: bound };
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
  normalizeEmail,
  emailsMatch,
  licenseBoundEmail,
};
