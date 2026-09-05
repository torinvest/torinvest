/**
 * Seed initial - USA WAR ATLAS
 *
 * Charge les données de démonstration du package @usa-war-atlas/data.
 * Ces contenus constituent un socle éditorial à enrichir : la plupart des
 * entrées sont marquées needsReview=true et aucune donnée chiffrée fictive
 * n'est introduite (les valeurs non vérifiées sont null).
 *
 * Exécution : npm run db:seed
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const seedDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "packages",
  "data",
  "seed"
);

function loadJson<T>(file: string): T {
  return JSON.parse(readFileSync(join(seedDir, file), "utf-8")) as T;
}

interface CountrySeed {
  name: string;
  officialName: string | null;
  iso2: string;
  iso3: string;
  latitude: number | null;
  longitude: number | null;
  region: string | null;
}

interface SourceSeed {
  key: string;
  title: string;
  publisher: string | null;
  url: string | null;
  publicationDate: string | null;
  sourceType: string;
  reliabilityLevel: string;
  notes: string | null;
}

interface ConflictSeed {
  slug: string;
  title: string;
  shortTitle: string | null;
  summary: string;
  startDate: string;
  endDate: string | null;
  isOngoing: boolean;
  region: string;
  primaryCategory: string;
  officialJustification: string | null;
  strategicContext: string | null;
  militaryResult: string | null;
  politicalResult: string | null;
  humanConsequences: string | null;
  economicConsequences: string | null;
  territorialConsequences: string | null;
  legalBasis: string | null;
  certaintyLevel: string;
  verified: boolean;
  needsReview: boolean;
  reviewNotes: string | null;
  countries: Array<{
    iso3: string;
    role: string;
    side: string | null;
    description: string | null;
  }>;
  interventions: Array<{
    type: string;
    title: string;
    description: string | null;
    startDate: string | null;
    endDate: string | null;
    agency: string | null;
    isCovert: boolean;
    certaintyLevel: string;
  }>;
  casualtyEstimates: Array<{
    category: string;
    minimumValue: number | null;
    maximumValue: number | null;
    bestEstimate: number | null;
    unit: string;
    description: string | null;
    needsReview: boolean;
    sourceKey: string | null;
  }>;
  timelineEvents: Array<{
    date: string;
    title: string;
    description: string | null;
    eventType: string;
  }>;
  sources: Array<{ sourceKey: string; usageDescription: string | null }>;
}

interface TerritorySeed {
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
  conflictSlug: string | null;
  states: Array<{
    stateName: string;
    coverageType: string;
    estimatedShare: number | null;
    notes: string | null;
  }>;
  economicMetrics: Array<{
    stateName: string | null;
    year: number;
    metricType: string;
    value: number;
    currency: string;
    isEstimate: boolean;
    methodology: string | null;
    needsReview: boolean;
    sourceKey: string | null;
  }>;
}

const toDate = (value: string | null): Date | null =>
  value ? new Date(value) : null;

async function main() {
  console.log("Seed USA WAR ATLAS : démarrage...");

  // Ordre de suppression respectant les clés étrangères
  await prisma.conflictSource.deleteMany();
  await prisma.casualtyEstimate.deleteMany();
  await prisma.timelineEvent.deleteMany();
  await prisma.intervention.deleteMany();
  await prisma.conflictCountry.deleteMany();
  await prisma.economicMetric.deleteMany();
  await prisma.territoryState.deleteMany();
  await prisma.territory.deleteMany();
  await prisma.conflict.deleteMany();
  await prisma.source.deleteMany();
  await prisma.country.deleteMany();
  await prisma.adminNote.deleteMany();

  // --- Pays -----------------------------------------------------------------
  const countries = loadJson<CountrySeed[]>("countries.json");
  const countryIdByIso3 = new Map<string, string>();
  for (const c of countries) {
    const created = await prisma.country.create({ data: c });
    countryIdByIso3.set(c.iso3, created.id);
  }
  console.log(`Pays créés : ${countries.length}`);

  // --- Sources ----------------------------------------------------------------
  const sources = loadJson<SourceSeed[]>("sources.json");
  const sourceIdByKey = new Map<string, string>();
  for (const s of sources) {
    const created = await prisma.source.create({
      data: {
        title: s.title,
        publisher: s.publisher,
        url: s.url,
        publicationDate: toDate(s.publicationDate),
        accessedAt: new Date(),
        sourceType: s.sourceType,
        reliabilityLevel: s.reliabilityLevel,
        notes: s.notes,
      },
    });
    sourceIdByKey.set(s.key, created.id);
  }
  console.log(`Sources créées : ${sources.length}`);

  // --- Conflits ---------------------------------------------------------------
  const conflicts = loadJson<ConflictSeed[]>("conflicts.json");
  const conflictIdBySlug = new Map<string, string>();
  for (const c of conflicts) {
    const conflict = await prisma.conflict.create({
      data: {
        slug: c.slug,
        title: c.title,
        shortTitle: c.shortTitle,
        summary: c.summary,
        startDate: new Date(c.startDate),
        endDate: toDate(c.endDate),
        isOngoing: c.isOngoing,
        region: c.region,
        primaryCategory: c.primaryCategory,
        officialJustification: c.officialJustification,
        strategicContext: c.strategicContext,
        militaryResult: c.militaryResult,
        politicalResult: c.politicalResult,
        humanConsequences: c.humanConsequences,
        economicConsequences: c.economicConsequences,
        territorialConsequences: c.territorialConsequences,
        legalBasis: c.legalBasis,
        certaintyLevel: c.certaintyLevel,
        verified: c.verified,
        needsReview: c.needsReview,
        reviewNotes: c.reviewNotes,
      },
    });
    conflictIdBySlug.set(c.slug, conflict.id);

    for (const cc of c.countries) {
      const countryId = countryIdByIso3.get(cc.iso3);
      if (!countryId) {
        throw new Error(
          `Pays introuvable dans le seed : ${cc.iso3} (conflit ${c.slug})`
        );
      }
      await prisma.conflictCountry.create({
        data: {
          conflictId: conflict.id,
          countryId,
          role: cc.role,
          side: cc.side,
          description: cc.description,
        },
      });
    }

    for (const i of c.interventions) {
      await prisma.intervention.create({
        data: {
          conflictId: conflict.id,
          type: i.type,
          title: i.title,
          description: i.description,
          startDate: toDate(i.startDate),
          endDate: toDate(i.endDate),
          agency: i.agency,
          isCovert: i.isCovert,
          certaintyLevel: i.certaintyLevel,
        },
      });
    }

    for (const ce of c.casualtyEstimates) {
      const sourceId = ce.sourceKey ? sourceIdByKey.get(ce.sourceKey) : null;
      if (ce.sourceKey && !sourceId) {
        throw new Error(
          `Source introuvable : ${ce.sourceKey} (conflit ${c.slug})`
        );
      }
      await prisma.casualtyEstimate.create({
        data: {
          conflictId: conflict.id,
          category: ce.category,
          minimumValue: ce.minimumValue,
          maximumValue: ce.maximumValue,
          bestEstimate: ce.bestEstimate,
          unit: ce.unit,
          description: ce.description,
          needsReview: ce.needsReview,
          sourceId: sourceId ?? null,
        },
      });
    }

    for (const e of c.timelineEvents) {
      await prisma.timelineEvent.create({
        data: {
          conflictId: conflict.id,
          date: new Date(e.date),
          title: e.title,
          description: e.description,
          eventType: e.eventType,
        },
      });
    }

    for (const cs of c.sources) {
      const sourceId = sourceIdByKey.get(cs.sourceKey);
      if (!sourceId) {
        throw new Error(
          `Source introuvable : ${cs.sourceKey} (conflit ${c.slug})`
        );
      }
      await prisma.conflictSource.create({
        data: {
          conflictId: conflict.id,
          sourceId,
          usageDescription: cs.usageDescription,
        },
      });
    }

    console.log(`Conflit créé : ${c.title}`);
  }

  // --- Territoires --------------------------------------------------------------
  const territories = loadJson<TerritorySeed[]>("territories.json");
  for (const t of territories) {
    const conflictId = t.conflictSlug
      ? conflictIdBySlug.get(t.conflictSlug)
      : null;
    if (t.conflictSlug && !conflictId) {
      throw new Error(
        `Conflit introuvable : ${t.conflictSlug} (territoire ${t.slug})`
      );
    }

    await prisma.territory.create({
      data: {
        name: t.name,
        slug: t.slug,
        formerSovereign: t.formerSovereign,
        newSovereign: t.newSovereign,
        acquisitionDate: toDate(t.acquisitionDate),
        areaKm2: t.areaKm2,
        treatyName: t.treatyName,
        originalPrice: t.originalPrice,
        originalCurrency: t.originalCurrency,
        inflationAdjustedValue: t.inflationAdjustedValue,
        description: t.description,
        needsReview: t.needsReview,
        conflictId: conflictId ?? null,
        states: {
          create: t.states.map((s) => ({
            stateName: s.stateName,
            coverageType: s.coverageType,
            estimatedShare: s.estimatedShare,
            notes: s.notes,
          })),
        },
        economicMetrics: {
          create: t.economicMetrics.map((m) => {
            const sourceId = m.sourceKey
              ? sourceIdByKey.get(m.sourceKey)
              : null;
            if (m.sourceKey && !sourceId) {
              throw new Error(
                `Source introuvable : ${m.sourceKey} (territoire ${t.slug})`
              );
            }
            return {
              stateName: m.stateName,
              year: m.year,
              metricType: m.metricType,
              value: m.value,
              currency: m.currency,
              isEstimate: m.isEstimate,
              methodology: m.methodology,
              needsReview: m.needsReview,
              sourceId: sourceId ?? null,
            };
          }),
        },
      },
    });
    console.log(
      `Territoire créé : ${t.name} (${t.economicMetrics.length} métrique(s))`
    );
  }

  console.log("Seed terminé avec succès.");
}

main()
  .catch((e) => {
    console.error("Échec du seed :", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
