/**
 * Client API des routes protégées d'administration (MVP).
 * Le jeton est conservé en sessionStorage : il disparaît à la fermeture
 * de l'onglet et n'est jamais écrit dans le code ou dans le dépôt.
 */
const API_URL = import.meta.env.VITE_API_URL ?? "";
const TOKEN_KEY = "usa-war-atlas-admin-token";

export const getAdminToken = () => sessionStorage.getItem(TOKEN_KEY);
export const setAdminToken = (token: string) =>
  sessionStorage.setItem(TOKEN_KEY, token);
export const clearAdminToken = () => sessionStorage.removeItem(TOKEN_KEY);

async function adminFetch<T>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const token = getAdminToken();
  if (!token) throw new Error("Jeton administrateur manquant");

  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
    },
    ...(options.body !== undefined
      ? { body: JSON.stringify(options.body) }
      : {}),
  });

  const body = await res.json();
  if (!body.success) {
    const details = body.error?.details
      ? ` — ${JSON.stringify(body.error.details)}`
      : "";
    throw new Error(`${body.error?.message ?? "Erreur inconnue"}${details}`);
  }
  return body.data as T;
}

export const adminApi = {
  /** Vérifie le jeton en appelant une route protégée légère. */
  verifyToken: () => adminFetch<unknown>("/api/admin/export"),

  updateConflict: (id: string, data: Record<string, unknown>) =>
    adminFetch<unknown>(`/api/conflicts/${id}`, { method: "PUT", body: data }),

  createConflict: (data: Record<string, unknown>) =>
    adminFetch<unknown>("/api/conflicts", { method: "POST", body: data }),

  deleteConflict: (id: string) =>
    adminFetch<unknown>(`/api/conflicts/${id}`, { method: "DELETE" }),

  createSource: (data: Record<string, unknown>) =>
    adminFetch<unknown>("/api/sources", { method: "POST", body: data }),

  exportData: () => adminFetch<Record<string, unknown>>("/api/admin/export"),

  importConflicts: (conflicts: unknown[]) =>
    adminFetch<{ created: number; updated: number; total: number }>(
      "/api/admin/import",
      { method: "POST", body: { conflicts } }
    ),
};
