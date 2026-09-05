import { z } from "zod";
import {
  CASUALTY_CATEGORIES,
  CERTAINTY_LEVELS,
  CONFLICT_COUNTRY_ROLES,
  ECONOMIC_METRIC_TYPES,
  INTERVENTION_CATEGORIES,
  RELIABILITY_LEVELS,
  SOURCE_TYPES,
  TERRITORY_COVERAGE_TYPES,
  TIMELINE_EVENT_TYPES,
} from "./enums.js";

// ---------------------------------------------------------------------------
// Briques de base
// ---------------------------------------------------------------------------

export const interventionCategorySchema = z.enum(INTERVENTION_CATEGORIES);
export const certaintyLevelSchema = z.enum(CERTAINTY_LEVELS);
export const conflictCountryRoleSchema = z.enum(CONFLICT_COUNTRY_ROLES);
export const territoryCoverageTypeSchema = z.enum(TERRITORY_COVERAGE_TYPES);
export const economicMetricTypeSchema = z.enum(ECONOMIC_METRIC_TYPES);
export const sourceTypeSchema = z.enum(SOURCE_TYPES);
export const reliabilityLevelSchema = z.enum(RELIABILITY_LEVELS);
export const casualtyCategorySchema = z.enum(CASUALTY_CATEGORIES);
export const timelineEventTypeSchema = z.enum(TIMELINE_EVENT_TYPES);

export const slugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug invalide (kebab-case attendu)");

/** Date ISO (chaîne) transformée en Date. Accepte "1846-04-25" ou ISO complet. */
export const isoDateSchema = z.coerce.date();

// ---------------------------------------------------------------------------
// Conflict
// ---------------------------------------------------------------------------

export const conflictCreateSchema = z
  .object({
    slug: slugSchema,
    title: z.string().min(1).max(200),
    shortTitle: z.string().max(80).nullish(),
    summary: z.string().min(1),
    startDate: isoDateSchema,
    endDate: isoDateSchema.nullish(),
    isOngoing: z.boolean().default(false),
    region: z.string().min(1),
    primaryCategory: interventionCategorySchema,
    officialJustification: z.string().nullish(),
    strategicContext: z.string().nullish(),
    militaryResult: z.string().nullish(),
    politicalResult: z.string().nullish(),
    humanConsequences: z.string().nullish(),
    economicConsequences: z.string().nullish(),
    territorialConsequences: z.string().nullish(),
    legalBasis: z.string().nullish(),
    certaintyLevel: certaintyLevelSchema.default("ESTABLISHED"),
    verified: z.boolean().default(false),
    needsReview: z.boolean().default(true),
    reviewNotes: z.string().nullish(),
  })
  .refine(
    (c) => !c.endDate || c.endDate >= c.startDate,
    { message: "La date de fin ne peut pas précéder la date de début", path: ["endDate"] }
  )
  .refine(
    (c) => c.isOngoing || c.endDate != null || c.needsReview,
    {
      message:
        "Un conflit terminé sans date de fin doit être marqué 'needsReview'",
      path: ["endDate"],
    }
  );

export type ConflictCreateInput = z.infer<typeof conflictCreateSchema>;

export const conflictUpdateSchema = conflictCreateSchema.innerType().innerType().partial();
export type ConflictUpdateInput = z.infer<typeof conflictUpdateSchema>;

// ---------------------------------------------------------------------------
// Filtres de liste (query string)
// ---------------------------------------------------------------------------

export const conflictListQuerySchema = z.object({
  category: interventionCategorySchema.optional(),
  region: z.string().optional(),
  country: z.string().length(3).optional(), // ISO3
  startYear: z.coerce.number().int().min(1700).max(2100).optional(),
  endYear: z.coerce.number().int().min(1700).max(2100).optional(),
  isOngoing: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z
    .enum(["startDate", "-startDate", "title", "-title"])
    .default("startDate"),
});
export type ConflictListQuery = z.infer<typeof conflictListQuerySchema>;

export const compareQuerySchema = z.object({
  conflicts: z
    .string()
    .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean))
    .pipe(z.array(slugSchema).min(2).max(3)),
});

// ---------------------------------------------------------------------------
// Autres entités
// ---------------------------------------------------------------------------

export const countrySchema = z.object({
  name: z.string().min(1),
  officialName: z.string().nullish(),
  iso2: z.string().length(2),
  iso3: z.string().length(3),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  region: z.string().nullish(),
});

export const conflictCountrySchema = z.object({
  role: conflictCountryRoleSchema,
  side: z.string().nullish(),
  description: z.string().nullish(),
});

export const interventionSchema = z.object({
  type: interventionCategorySchema,
  title: z.string().min(1),
  description: z.string().nullish(),
  startDate: isoDateSchema.nullish(),
  endDate: isoDateSchema.nullish(),
  agency: z.string().nullish(),
  isCovert: z.boolean().default(false),
  certaintyLevel: certaintyLevelSchema.default("ESTABLISHED"),
});

export const casualtyEstimateSchema = z
  .object({
    category: casualtyCategorySchema,
    minimumValue: z.number().int().min(0).nullish(),
    maximumValue: z.number().int().min(0).nullish(),
    bestEstimate: z.number().int().min(0).nullish(),
    unit: z.string().default("PERSONS"),
    description: z.string().nullish(),
    needsReview: z.boolean().default(false),
  })
  .refine(
    (c) =>
      c.minimumValue == null ||
      c.maximumValue == null ||
      c.maximumValue >= c.minimumValue,
    { message: "maximumValue doit être >= minimumValue", path: ["maximumValue"] }
  );

export const territorySchema = z.object({
  name: z.string().min(1),
  slug: slugSchema,
  formerSovereign: z.string().min(1),
  newSovereign: z.string().default("États-Unis"),
  acquisitionDate: isoDateSchema.nullish(),
  areaKm2: z.number().positive().nullish(),
  treatyName: z.string().nullish(),
  originalPrice: z.number().min(0).nullish(),
  originalCurrency: z.string().nullish(),
  inflationAdjustedValue: z.number().min(0).nullish(),
  description: z.string().nullish(),
  needsReview: z.boolean().default(true),
});

export const economicMetricSchema = z
  .object({
    stateName: z.string().nullish(),
    year: z.number().int().min(1700).max(2100),
    metricType: economicMetricTypeSchema,
    value: z.number(),
    currency: z.string().default("USD"),
    isEstimate: z.boolean().default(false),
    methodology: z.string().nullish(),
    needsReview: z.boolean().default(false),
    hasSource: z.boolean().default(false),
  })
  .refine((m) => m.hasSource || m.needsReview, {
    message:
      "Une statistique doit posséder une source ou être marquée 'needsReview'",
    path: ["needsReview"],
  });

export const sourceSchema = z.object({
  title: z.string().min(1),
  publisher: z.string().nullish(),
  url: z.string().url().nullish(),
  publicationDate: isoDateSchema.nullish(),
  accessedAt: isoDateSchema.nullish(),
  sourceType: sourceTypeSchema,
  reliabilityLevel: reliabilityLevelSchema.default("HIGH"),
  notes: z.string().nullish(),
});

export const timelineEventSchema = z.object({
  date: isoDateSchema,
  title: z.string().min(1),
  description: z.string().nullish(),
  eventType: timelineEventTypeSchema.default("EVENT"),
});
