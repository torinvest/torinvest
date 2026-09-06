import type {
  ApiResponse,
  ConflictCompareDto,
  ConflictDetailDto,
  ConflictGeoDto,
  ConflictListItemDto,
  PaginationMeta,
  SourceWithConflictsDto,
  StatsOverviewDto,
  TerritoryDetailDto,
  TerritoryListItemDto,
  TimelineBucketDto,
} from "@usa-war-atlas/shared";

/** Base API : en embed Forge = `/atlas-embed` (voir build:forge). */
const API_URL = String(import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

async function fetchApi<T, M = Record<string, unknown>>(
  path: string
): Promise<{ data: T; meta?: M }> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  const ct = String(res.headers.get("content-type") || "");
  const raw = await res.text();
  if (!ct.includes("application/json")) {
    const isHtml = /^\s*</.test(raw);
    throw new Error(
      isHtml
        ? "L’API Atlas a renvoyé du HTML au lieu de JSON (proxy mal configuré ou API arrêtée sur :3011)."
        : `Réponse non JSON (HTTP ${res.status}).`
    );
  }
  let body: ApiResponse<T, M>;
  try {
    body = JSON.parse(raw) as ApiResponse<T, M>;
  } catch {
    throw new Error("Réponse API illisible (JSON invalide).");
  }
  if (!body.success) {
    throw new Error(body.error.message);
  }
  return { data: body.data, meta: body.meta };
}

export interface ConflictListParams {
  category?: string;
  region?: string;
  search?: string;
  isOngoing?: boolean;
  page?: number;
  limit?: number;
  sort?: string;
}

export function getConflicts(params: ConflictListParams = {}) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") qs.set(key, String(value));
  }
  const query = qs.toString();
  return fetchApi<ConflictListItemDto[], PaginationMeta>(
    `/api/conflicts${query ? `?${query}` : ""}`
  );
}

export function getConflict(slug: string) {
  return fetchApi<ConflictDetailDto>(`/api/conflicts/${slug}`);
}

export function getStatsOverview() {
  return fetchApi<StatsOverviewDto>(`/api/stats/overview`);
}

export function getConflictsGeo() {
  return fetchApi<ConflictGeoDto[]>(`/api/conflicts/geo`);
}

export function getStatsTimeline() {
  return fetchApi<TimelineBucketDto[]>(`/api/stats/timeline`);
}

export function getTerritories() {
  return fetchApi<TerritoryListItemDto[]>(`/api/territories`);
}

export function getTerritory(slug: string) {
  return fetchApi<TerritoryDetailDto>(`/api/territories/${slug}`);
}

export function getCompare(slugs: string[]) {
  return fetchApi<ConflictCompareDto[]>(
    `/api/compare?conflicts=${slugs.map(encodeURIComponent).join(",")}`
  );
}

export function getSources() {
  return fetchApi<SourceWithConflictsDto[]>(`/api/sources`);
}
