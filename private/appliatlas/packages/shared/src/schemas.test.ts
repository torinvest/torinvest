import { describe, expect, it } from "vitest";
import {
  casualtyEstimateSchema,
  compareQuerySchema,
  conflictCreateSchema,
  conflictListQuerySchema,
  economicMetricSchema,
  slugSchema,
  sourceSchema,
} from "./schemas.js";

const validConflict = {
  slug: "guerre-test",
  title: "Guerre de test",
  summary: "Résumé de test.",
  startDate: "1846-04-25",
  endDate: "1848-02-02",
  isOngoing: false,
  region: "Amérique du Nord",
  primaryCategory: "DIRECT_WAR",
};

describe("conflictCreateSchema", () => {
  it("accepte un conflit valide", () => {
    const parsed = conflictCreateSchema.parse(validConflict);
    expect(parsed.slug).toBe("guerre-test");
    expect(parsed.startDate).toBeInstanceOf(Date);
    expect(parsed.needsReview).toBe(true); // défaut éditorial : à relire
  });

  it("rejette une date de fin antérieure à la date de début", () => {
    const result = conflictCreateSchema.safeParse({
      ...validConflict,
      startDate: "1950-01-01",
      endDate: "1940-01-01",
    });
    expect(result.success).toBe(false);
  });

  it("accepte un conflit en cours sans date de fin", () => {
    const parsed = conflictCreateSchema.parse({
      ...validConflict,
      endDate: null,
      isOngoing: true,
    });
    expect(parsed.endDate).toBeNull();
    expect(parsed.isOngoing).toBe(true);
  });

  it("rejette une catégorie inconnue", () => {
    const result = conflictCreateSchema.safeParse({
      ...validConflict,
      primaryCategory: "NUCLEAR_WAR",
    });
    expect(result.success).toBe(false);
  });

  it("exige une catégorie", () => {
    const { primaryCategory: _omitted, ...withoutCategory } = validConflict;
    const result = conflictCreateSchema.safeParse(withoutCategory);
    expect(result.success).toBe(false);
  });
});

describe("slugSchema", () => {
  it("accepte un slug kebab-case", () => {
    expect(slugSchema.parse("guerre-du-vietnam")).toBe("guerre-du-vietnam");
  });
  it("rejette majuscules, espaces et accents", () => {
    expect(slugSchema.safeParse("Guerre du Vietnam").success).toBe(false);
    expect(slugSchema.safeParse("guerre_du_vietnam").success).toBe(false);
    expect(slugSchema.safeParse("café").success).toBe(false);
  });
});

describe("conflictListQuerySchema", () => {
  it("applique les valeurs par défaut de pagination", () => {
    const parsed = conflictListQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(20);
    expect(parsed.sort).toBe("startDate");
  });

  it("convertit les chaînes de la query string", () => {
    const parsed = conflictListQuerySchema.parse({
      page: "2",
      limit: "5",
      isOngoing: "true",
      startYear: "1900",
    });
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(5);
    expect(parsed.isOngoing).toBe(true);
    expect(parsed.startYear).toBe(1900);
  });

  it("plafonne la limite à 100", () => {
    expect(conflictListQuerySchema.safeParse({ limit: "500" }).success).toBe(
      false
    );
  });
});

describe("compareQuerySchema", () => {
  it("découpe la liste de slugs", () => {
    const parsed = compareQuerySchema.parse({
      conflicts: "guerre-du-vietnam,guerre-d-irak-2003",
    });
    expect(parsed.conflicts).toEqual([
      "guerre-du-vietnam",
      "guerre-d-irak-2003",
    ]);
  });

  it("exige au moins deux conflits", () => {
    expect(
      compareQuerySchema.safeParse({ conflicts: "guerre-du-vietnam" }).success
    ).toBe(false);
  });
});

describe("casualtyEstimateSchema", () => {
  it("rejette max < min", () => {
    const result = casualtyEstimateSchema.safeParse({
      category: "CIVILIAN",
      minimumValue: 1000,
      maximumValue: 500,
    });
    expect(result.success).toBe(false);
  });

  it("accepte des valeurs nulles (donnée à vérifier)", () => {
    const parsed = casualtyEstimateSchema.parse({
      category: "TOTAL",
      minimumValue: null,
      maximumValue: null,
      bestEstimate: null,
      needsReview: true,
    });
    expect(parsed.bestEstimate).toBeNull();
  });
});

describe("economicMetricSchema", () => {
  it("exige une année valide", () => {
    expect(
      economicMetricSchema.safeParse({
        metricType: "GDP",
        value: 100,
        hasSource: true,
      }).success
    ).toBe(false);
  });

  it("exige une source ou le statut needsReview", () => {
    const withoutSource = economicMetricSchema.safeParse({
      year: 2023,
      metricType: "GDP",
      value: 100,
      hasSource: false,
      needsReview: false,
    });
    expect(withoutSource.success).toBe(false);

    const flagged = economicMetricSchema.safeParse({
      year: 2023,
      metricType: "GDP",
      value: 100,
      hasSource: false,
      needsReview: true,
    });
    expect(flagged.success).toBe(true);
  });
});

describe("sourceSchema", () => {
  it("rejette une URL invalide", () => {
    expect(
      sourceSchema.safeParse({
        title: "Test",
        sourceType: "GOVERNMENT",
        url: "pas-une-url",
      }).success
    ).toBe(false);
  });

  it("accepte une source valide", () => {
    const parsed = sourceSchema.parse({
      title: "Costs of Major U.S. Wars",
      sourceType: "GOVERNMENT",
      url: "https://sgp.fas.org/crs/natsec/RS22926.pdf",
    });
    expect(parsed.reliabilityLevel).toBe("HIGH");
  });
});
