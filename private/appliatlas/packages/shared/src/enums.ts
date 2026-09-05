/**
 * Enums partagés entre le frontend, le backend et le seed.
 * SQLite ne supportant pas les enums Prisma, ces constantes font autorité
 * et sont validées par Zod côté API.
 */

export const INTERVENTION_CATEGORIES = [
  "DIRECT_WAR",
  "LIMITED_MILITARY_INTERVENTION",
  "INDIRECT_CONFLICT",
  "COVERT_OPERATION",
  "ECONOMIC_PRESSURE",
  "HYBRID_CONFLICT",
] as const;
export type InterventionCategory = (typeof INTERVENTION_CATEGORIES)[number];

export const CATEGORY_LABELS_FR: Record<InterventionCategory, string> = {
  DIRECT_WAR: "Guerre directe",
  LIMITED_MILITARY_INTERVENTION: "Intervention militaire limitée",
  INDIRECT_CONFLICT: "Conflit indirect",
  COVERT_OPERATION: "Opération clandestine",
  ECONOMIC_PRESSURE: "Pression économique",
  HYBRID_CONFLICT: "Conflit hybride",
};

export const CERTAINTY_LEVELS = [
  "ESTABLISHED",
  "HIGH_CONFIDENCE",
  "ESTIMATE",
  "DISPUTED",
  "OFFICIAL_CLAIM",
  "INTERPRETATION",
  "UNKNOWN",
] as const;
export type CertaintyLevel = (typeof CERTAINTY_LEVELS)[number];

export const CERTAINTY_LABELS_FR: Record<CertaintyLevel, string> = {
  ESTABLISHED: "Fait établi",
  HIGH_CONFIDENCE: "Confiance élevée",
  ESTIMATE: "Estimation",
  DISPUTED: "Point débattu",
  OFFICIAL_CLAIM: "Justification officielle",
  INTERPRETATION: "Analyse historique",
  UNKNOWN: "Donnée à vérifier",
};

export const CONFLICT_COUNTRY_ROLES = [
  "BELLIGERENT",
  "ALLY",
  "SUPPORTED_FORCE",
  "TARGET",
  "HOST_COUNTRY",
  "MEDIATOR",
] as const;
export type ConflictCountryRole = (typeof CONFLICT_COUNTRY_ROLES)[number];

export const TERRITORY_COVERAGE_TYPES = [
  "FULL",
  "MOSTLY",
  "PARTIAL",
  "SMALL_PART",
] as const;
export type TerritoryCoverageType = (typeof TERRITORY_COVERAGE_TYPES)[number];

export const ECONOMIC_METRIC_TYPES = [
  "GDP",
  "FEDERAL_TAX_COLLECTIONS",
  "FEDERAL_SPENDING",
  "POPULATION",
  "LAND_VALUE",
  "RESOURCE_OUTPUT",
  "EXPORTS",
] as const;
export type EconomicMetricType = (typeof ECONOMIC_METRIC_TYPES)[number];

export const SOURCE_TYPES = [
  "GOVERNMENT",
  "ACADEMIC",
  "INTERNATIONAL_ORGANIZATION",
  "BOOK",
  "PRESS",
  "DATABASE",
  "ARCHIVE",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const RELIABILITY_LEVELS = ["HIGH", "MEDIUM", "LOW", "CONTESTED"] as const;
export type ReliabilityLevel = (typeof RELIABILITY_LEVELS)[number];

export const CASUALTY_CATEGORIES = [
  "MILITARY_US",
  "MILITARY_ALLIED",
  "MILITARY_OPPONENT",
  "CIVILIAN",
  "TOTAL",
] as const;
export type CasualtyCategory = (typeof CASUALTY_CATEGORIES)[number];

export const TIMELINE_EVENT_TYPES = [
  "EVENT",
  "BATTLE",
  "TREATY",
  "POLITICAL",
  "DECLARATION",
] as const;
export type TimelineEventType = (typeof TIMELINE_EVENT_TYPES)[number];

export const REGIONS = [
  "Amérique du Nord",
  "Amérique latine et Caraïbes",
  "Europe",
  "Moyen-Orient",
  "Afrique",
  "Asie de l'Est",
  "Asie du Sud-Est",
  "Asie centrale et du Sud",
  "Océanie",
  "Mondial",
] as const;
export type Region = (typeof REGIONS)[number];
