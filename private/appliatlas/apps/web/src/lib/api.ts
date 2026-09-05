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

const API_URL = import.meta.env.VITE_API_URL ?? "";

async function fetchApi<T, M = Record<string, unknown>>(
  path: string
): Promise<{ data: T; meta?: M }> {
  const res = await fetch(`${API_URL}${path}`);
  const body = (await res.json()) as ApiResponse<T, M>;
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
