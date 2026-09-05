/**
 * Types des réponses de l'API REST, consommés par le frontend.
 */
import type {
  CertaintyLevel,
  ConflictCountryRole,
  EconomicMetricType,
  InterventionCategory,
  ReliabilityLevel,
  SourceType,
  TerritoryCoverageType,
} from "./enums.js";

export interface ApiSuccess<T, M = Record<string, unknown>> {
  success: true;
  data: T;
  meta?: M;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T, M = Record<string, unknown>> = ApiSuccess<T, M> | ApiError;

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CountryDto {
  id: string;
  name: string;
  officialName: string | null;
  iso2: string;
  iso3: string;
  latitude: number | null;
  longitude: number | null;
  region: string | null;
}

export interface ConflictCountryDto {
  id: string;
  role: ConflictCountryRole;
  side: string | null;
  description: string | null;
  country: CountryDto;
}

export interface SourceDto {
  id: string;
  title: string;
  publisher: string | null;
  url: string | null;
  publicationDate: string | null;
  accessedAt: string | null;
  sourceType: SourceType;
  reliabilityLevel: ReliabilityLevel;
  notes: string | null;
}

export interface CasualtyEstimateDto {
  id: string;
  category: string;
  minimumValue: number | null;
  maximumValue: number | null;
  bestEstimate: number | null;
  unit: string;
  description: string | null;
  needsReview: boolean;
  source: SourceDto | null;
}

export interface TimelineEventDto {
  id: string;
  date: string;
  title: string;
  description: string | null;
  eventType: string;
}

export interface InterventionDto {
  id: string;
  type: InterventionCategory;
  title: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  agency: string | null;
  isCovert: boolean;
  certaintyLevel: CertaintyLevel;
}

export interface ConflictListItemDto {
  id: string;
  slug: string;
  title: string;
  shortTitle: string | null;
  summary: string;
  startDate: string;
  endDate: string | null;
  isOngoing: boolean;
  region: string;
  primaryCategory: InterventionCategory;
  certaintyLevel: CertaintyLevel;
  needsReview: boolean;
}

export interface ConflictDetailDto extends ConflictListItemDto {
  officialJustification: string | null;
  strategicContext: string | null;
  militaryResult: string | null;
  politicalResult: string | null;
  humanConsequences: string | null;
  economicConsequences: string | null;
  territorialConsequences: string | null;
  legalBasis: string | null;
  verified: boolean;
  countries: ConflictCountryDto[];
  interventions: InterventionDto[];
  casualtyEstimates: CasualtyEstimateDto[];
  timelineEvents: TimelineEventDto[];
  sources: Array<{ usageDescription: string | null; source: SourceDto }>;
  territories: Array<{
    id: string;
    slug: string;
    name: string;
    treatyName: string | null;
    areaKm2: number | null;
    originalPrice: number | null;
    originalCurrency: string | null;
  }>;
}

export interface TerritoryStateDto {
  id: string;
  stateName: string;
  coverageType: TerritoryCoverageType;
  estimatedShare: number | null;
  notes: string | null;
}

export interface EconomicMetricDto {
  id: string;
  stateName: string | null;
  year: number;
  metricType: EconomicMetricType;
  value: number;
  currency: string;
  isEstimate: boolean;
  methodology: string | null;
  needsReview: boolean;
  source: SourceDto | null;
}

export interface TerritoryListItemDto {
  id: string;
  name: string;
  slug: string;
  formerSovereign: string;
  newSovereign: string;
  acquisitionDate: string | null;
  areaKm2: number | null;
  treatyName: string | null;
  originalPrice: number | null;
  originalCurrency: string | null;
  inflationAdjustedValue: number | null;
  description: string | null;
  needsReview: boolean;
  states: TerritoryStateDto[];
  conflict: { slug: string; title: string } | null;
}

export interface TerritoryDetailDto extends TerritoryListItemDto {
  economicMetrics: EconomicMetricDto[];
}

export interface ConflictCompareDto extends ConflictListItemDto {
  officialJustification: string | null;
  strategicContext: string | null;
  militaryResult: string | null;
  politicalResult: string | null;
  humanConsequences: string | null;
  economicConsequences: string | null;
  territorialConsequences: string | null;
  legalBasis: string | null;
  countries: ConflictCountryDto[];
  casualtyEstimates: CasualtyEstimateDto[];
  sources: Array<{ usageDescription: string | null; source: SourceDto }>;
}

export interface SourceWithConflictsDto extends SourceDto {
  conflicts: Array<{
    usageDescription: string | null;
    conflict: { slug: string; title: string };
  }>;
}

export interface ConflictGeoDto {
  id: string;
  slug: string;
  title: string;
  shortTitle: string | null;
  startDate: string;
  endDate: string | null;
  isOngoing: boolean;
  region: string;
  primaryCategory: InterventionCategory;
  hasCovert: boolean;
  countries: Array<{
    role: ConflictCountryRole;
    country: {
      name: string;
      iso3: string;
      latitude: number | null;
      longitude: number | null;
    };
  }>;
}

export interface TimelineBucketDto {
  decade: number;
  count: number;
}

export interface StatsOverviewDto {
  totalConflicts: number;
  ongoingConflicts: number;
  countriesInvolved: number;
  totalSources: number;
  firstConflictYear: number | null;
  latestConflictYear: number | null;
  byCategory: Array<{ category: InterventionCategory; count: number }>;
}
