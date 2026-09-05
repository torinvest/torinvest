/**
 * Tests d'intégration de l'API.
 * Prérequis : base SQLite migrée et seedée (npm run db:migrate && npm run db:seed).
 */
import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "./app.js";

let app: Express;

beforeAll(() => {
  process.env.NODE_ENV = "test";
  app = createApp();
});

describe("GET /api/health", () => {
  it("répond ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("ok");
  });
});

describe("GET /api/conflicts", () => {
  it("liste les conflits avec pagination", async () => {
    const res = await request(app).get("/api/conflicts");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(20);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(20);
    expect(res.body.meta.page).toBe(1);
  });

  it("filtre par catégorie", async () => {
    const res = await request(app).get(
      "/api/conflicts?category=HYBRID_CONFLICT"
    );
    expect(res.status).toBe(200);
    for (const c of res.body.data) {
      expect(c.primaryCategory).toBe("HYBRID_CONFLICT");
    }
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it("rejette une catégorie invalide (400)", async () => {
    const res = await request(app).get("/api/conflicts?category=FAKE");
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("filtre par période", async () => {
    const res = await request(app).get(
      "/api/conflicts?startYear=1900&endYear=1980"
    );
    expect(res.status).toBe(200);
    for (const c of res.body.data) {
      const year = new Date(c.startDate).getFullYear();
      expect(year).toBeGreaterThanOrEqual(1900);
      expect(year).toBeLessThanOrEqual(1980);
    }
  });

  it("recherche par texte", async () => {
    const res = await request(app).get("/api/conflicts?search=Vietnam");
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it("pagine correctement", async () => {
    const res = await request(app).get("/api/conflicts?limit=1&page=2");
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.meta.page).toBe(2);
    expect(res.body.meta.totalPages).toBeGreaterThanOrEqual(3);
  });
});

describe("GET /api/conflicts/geo", () => {
  it("retourne les conflits avec les coordonnées des pays", async () => {
    const res = await request(app).get("/api/conflicts/geo");
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(3);
    for (const c of res.body.data) {
      expect(typeof c.hasCovert).toBe("boolean");
      expect(Array.isArray(c.countries)).toBe(true);
      for (const cc of c.countries) {
        expect(cc.country.iso3).toHaveLength(3);
        if (cc.country.latitude !== null) {
          expect(cc.country.latitude).toBeGreaterThanOrEqual(-90);
          expect(cc.country.latitude).toBeLessThanOrEqual(90);
        }
      }
    }
  });

  it("marque le Vietnam comme comportant des opérations clandestines", async () => {
    const res = await request(app).get("/api/conflicts/geo");
    const vietnam = res.body.data.find(
      (c: { slug: string }) => c.slug === "guerre-du-vietnam"
    );
    expect(vietnam).toBeDefined();
    expect(vietnam.hasCovert).toBe(true);
  });
});

describe("GET /api/conflicts/:slug", () => {
  it("retourne la fiche détaillée", async () => {
    const res = await request(app).get(
      "/api/conflicts/guerre-americano-mexicaine"
    );
    expect(res.status).toBe(200);
    const c = res.body.data;
    expect(c.title).toBe("Guerre américano-mexicaine");
    expect(c.countries.length).toBeGreaterThanOrEqual(2);
    expect(c.timelineEvents.length).toBeGreaterThanOrEqual(3);
    expect(c.sources.length).toBeGreaterThanOrEqual(1);
    // Cohérence : date de fin >= date de début
    expect(new Date(c.endDate).getTime()).toBeGreaterThan(
      new Date(c.startDate).getTime()
    );
  });

  it("retourne 404 pour un slug inconnu", async () => {
    const res = await request(app).get("/api/conflicts/conflit-inexistant");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});

describe("Cohérence éditoriale des données seedées", () => {
  it("chaque conflit a une catégorie valide et un niveau de certitude", async () => {
    const res = await request(app).get("/api/conflicts?limit=100");
    for (const c of res.body.data) {
      expect(c.primaryCategory).toBeTruthy();
      expect(c.certaintyLevel).toBeTruthy();
    }
  });

  it("un conflit terminé a une date de fin ou est marqué à vérifier", async () => {
    const res = await request(app).get("/api/conflicts?limit=100");
    for (const c of res.body.data) {
      if (!c.isOngoing) {
        expect(c.endDate !== null || c.needsReview).toBe(true);
      }
    }
  });

  it("les estimations de pertes sans chiffres sont marquées needsReview", async () => {
    const res = await request(app).get("/api/conflicts/guerre-du-vietnam");
    for (const e of res.body.data.casualtyEstimates) {
      if (
        e.minimumValue === null &&
        e.maximumValue === null &&
        e.bestEstimate === null
      ) {
        expect(e.needsReview).toBe(true);
      }
    }
  });
});

describe("GET /api/stats/overview", () => {
  it("calcule les statistiques globales", async () => {
    const res = await request(app).get("/api/stats/overview");
    expect(res.status).toBe(200);
    const s = res.body.data;
    expect(s.totalConflicts).toBeGreaterThanOrEqual(20);
    expect(s.totalSources).toBeGreaterThanOrEqual(5);
    expect(s.firstConflictYear).toBeLessThanOrEqual(1846);
    expect(Array.isArray(s.byCategory)).toBe(true);
  });
});

describe("GET /api/compare", () => {
  it("compare deux conflits dans l'ordre demandé", async () => {
    const res = await request(app).get(
      "/api/compare?conflicts=guerre-d-irak-2003,guerre-du-vietnam"
    );
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.data[0].slug).toBe("guerre-d-irak-2003");
    expect(res.body.data[1].slug).toBe("guerre-du-vietnam");
  });

  it("rejette un seul slug (400)", async () => {
    const res = await request(app).get(
      "/api/compare?conflicts=guerre-du-vietnam"
    );
    expect(res.status).toBe(400);
  });

  it("retourne 404 si un slug est inconnu", async () => {
    const res = await request(app).get(
      "/api/compare?conflicts=guerre-du-vietnam,conflit-inexistant"
    );
    expect(res.status).toBe(404);
  });
});

const ADMIN_TOKEN = "jeton-de-test-vitest-0123456789";
const auth = { Authorization: `Bearer ${ADMIN_TOKEN}` };

describe("Couverture MVP du seed (20 dossiers)", () => {
  const mvpSlugs = [
    "guerre-de-1812",
    "guerre-americano-mexicaine",
    "guerre-hispano-americaine",
    "guerre-americano-philippine",
    "premiere-guerre-mondiale",
    "seconde-guerre-mondiale",
    "guerre-de-coree",
    "guerre-du-vietnam",
    "guerre-secrete-au-laos",
    "cambodge-1969-1973",
    "afghanistan-1979-1989",
    "nicaragua-contras",
    "invasion-du-panama",
    "guerre-du-golfe",
    "intervention-en-somalie",
    "intervention-au-kosovo",
    "afghanistan-2001-2021",
    "guerre-d-irak-2003",
    "intervention-en-libye-2011",
    "syrie-lutte-contre-ei",
  ];

  it("contient les 20 slugs du MVP", async () => {
    const res = await request(app).get("/api/conflicts?limit=100");
    const slugs = new Set(res.body.data.map((c: { slug: string }) => c.slug));
    for (const slug of mvpSlugs) {
      expect(slugs.has(slug)).toBe(true);
    }
    expect(slugs.size).toBeGreaterThanOrEqual(20);
  });

  it("couvre les sept périodes de la chronologie", async () => {
    const res = await request(app).get("/api/conflicts?limit=100");
    const years = res.body.data.map((c: { startDate: string }) =>
      new Date(c.startDate).getFullYear()
    );
    expect(years.some((y: number) => y >= 1800 && y < 1900)).toBe(true); // expansion
    expect(years.some((y: number) => y >= 1898 && y < 1914)).toBe(true); // impérialisme
    expect(years.some((y: number) => y >= 1914 && y <= 1945)).toBe(true); // guerres mondiales
    expect(years.some((y: number) => y >= 1950 && y <= 1991)).toBe(true); // guerre froide
    expect(years.some((y: number) => y >= 1992 && y <= 2000)).toBe(true); // post-soviétique
    expect(years.some((y: number) => y >= 2001 && y <= 2015)).toBe(true); // terrorisme
    expect(
      res.body.data.some(
        (c: { slug: string; startDate: string; endDate: string | null }) => {
          const start = new Date(c.startDate).getFullYear();
          const end = c.endDate
            ? new Date(c.endDate).getFullYear()
            : new Date().getFullYear();
          return start >= 2014 || end >= 2016 || c.slug === "syrie-lutte-contre-ei";
        }
      )
    ).toBe(true); // rivalités contemporaines / conflits récents
  });
});

describe("Protection des routes d'administration", () => {
  it("refuse un POST sans jeton", async () => {
    const res = await request(app)
      .post("/api/conflicts")
      .send({ title: "Test" });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("refuse un DELETE sans jeton", async () => {
    const res = await request(app).delete("/api/conflicts/xyz");
    expect(res.status).toBe(401);
  });

  it("refuse un jeton invalide", async () => {
    const res = await request(app)
      .get("/api/admin/export")
      .set("Authorization", "Bearer mauvais-jeton");
    expect(res.status).toBe(401);
  });
});

describe("Cycle éditorial admin (créer, marquer, supprimer)", () => {
  const testConflict = {
    slug: "conflit-de-test-vitest",
    title: "Conflit de test (vitest)",
    summary: "Dossier temporaire créé par la suite de tests.",
    startDate: "1900-01-01",
    endDate: "1901-01-01",
    isOngoing: false,
    region: "Mondial",
    primaryCategory: "ECONOMIC_PRESSURE",
  };

  it("crée, marque vérifié puis débattu, et supprime un conflit", async () => {
    // Création
    const created = await request(app)
      .post("/api/conflicts")
      .set(auth)
      .send(testConflict);
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    expect(created.body.data.needsReview).toBe(true);

    // Marquage vérifié (doit dater la relecture)
    const verified = await request(app)
      .put(`/api/conflicts/${id}`)
      .set(auth)
      .send({ verified: true, needsReview: false });
    expect(verified.status).toBe(200);
    expect(verified.body.data.verified).toBe(true);
    expect(verified.body.data.lastReviewedAt).not.toBeNull();

    // Marquage débattu
    const disputed = await request(app)
      .put(`/api/conflicts/${id}`)
      .set(auth)
      .send({ certaintyLevel: "DISPUTED" });
    expect(disputed.status).toBe(200);
    expect(disputed.body.data.certaintyLevel).toBe("DISPUTED");

    // Ajout d'une intervention
    const intervention = await request(app)
      .post(`/api/conflicts/${id}/interventions`)
      .set(auth)
      .send({ type: "ECONOMIC_PRESSURE", title: "Embargo de test" });
    expect(intervention.status).toBe(201);

    // Suppression (cascade sur l'intervention)
    const deleted = await request(app)
      .delete(`/api/conflicts/${id}`)
      .set(auth);
    expect(deleted.status).toBe(200);

    const gone = await request(app).get(
      `/api/conflicts/${testConflict.slug}`
    );
    expect(gone.status).toBe(404);
  });

  it("rejette un conflit invalide (fin avant début)", async () => {
    const res = await request(app)
      .post("/api/conflicts")
      .set(auth)
      .send({ ...testConflict, startDate: "1950-01-01", endDate: "1940-01-01" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("Création de source (admin)", () => {
  it("crée une source valide puis la retrouve", async () => {
    const res = await request(app).post("/api/sources").set(auth).send({
      title: "Source de test (vitest)",
      publisher: "Test",
      url: "https://example.org/test",
      sourceType: "ACADEMIC",
    });
    expect(res.status).toBe(201);
    const id = res.body.data.id;

    const fetched = await request(app).get(`/api/sources/${id}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.data.title).toBe("Source de test (vitest)");

    // Nettoyage pour ne pas polluer la base de développement
    const del = await request(app).delete(`/api/sources/${id}`).set(auth);
    expect(del.status).toBe(200);
  });

  it("rejette une URL invalide", async () => {
    const res = await request(app).post("/api/sources").set(auth).send({
      title: "Mauvaise source",
      sourceType: "PRESS",
      url: "pas-une-url",
    });
    expect(res.status).toBe(400);
  });
});

describe("Export et import admin", () => {
  it("exporte l'ensemble des données", async () => {
    const res = await request(app).get("/api/admin/export").set(auth);
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.format).toBe("usa-war-atlas-export-v1");
    expect(data.conflicts.length).toBeGreaterThanOrEqual(20);
    expect(data.sources.length).toBeGreaterThanOrEqual(10);
    expect(data.territories.length).toBeGreaterThanOrEqual(2);
  });

  it("importe un conflit (upsert par slug) puis le supprime", async () => {
    const payload = {
      conflicts: [
        {
          slug: "import-de-test-vitest",
          title: "Import de test",
          summary: "Créé par le test d'import.",
          startDate: "1990-01-01",
          endDate: null,
          isOngoing: false,
          region: "Mondial",
          primaryCategory: "COVERT_OPERATION",
          needsReview: true,
        },
      ],
    };

    const first = await request(app)
      .post("/api/admin/import")
      .set(auth)
      .send(payload);
    expect(first.status).toBe(201);
    expect(first.body.data.created).toBe(1);

    // Ré-import du même slug : mise à jour, pas de doublon
    const second = await request(app)
      .post("/api/admin/import")
      .set(auth)
      .send(payload);
    expect(second.body.data.updated).toBe(1);
    expect(second.body.data.created).toBe(0);

    // L'import force needsReview
    const fetched = await request(app).get(
      "/api/conflicts/import-de-test-vitest"
    );
    expect(fetched.body.data.needsReview).toBe(true);

    // Nettoyage
    const del = await request(app)
      .delete(`/api/conflicts/${fetched.body.data.id}`)
      .set(auth);
    expect(del.status).toBe(200);
  });

  it("rejette un import invalide", async () => {
    const res = await request(app)
      .post("/api/admin/import")
      .set(auth)
      .send({ conflicts: [{ slug: "Slug Invalide !" }] });
    expect(res.status).toBe(400);
  });
});

describe("Pays, territoires et sources", () => {
  it("liste les pays", async () => {
    const res = await request(app).get("/api/countries");
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(5);
  });

  it("retourne un pays par ISO3 (insensible à la casse)", async () => {
    const res = await request(app).get("/api/countries/mex");
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Mexique");
  });

  it("retourne le territoire de la cession mexicaine avec ses États", async () => {
    const res = await request(app).get(
      "/api/territories/cession-mexicaine-1848"
    );
    expect(res.status).toBe(200);
    expect(res.body.data.states.length).toBe(7);
    expect(res.body.data.originalPrice).toBe(15000000);
  });

  it("relie la cession mexicaine à la guerre américano-mexicaine", async () => {
    const res = await request(app).get(
      "/api/territories/cession-mexicaine-1848"
    );
    expect(res.body.data.conflict.slug).toBe("guerre-americano-mexicaine");
  });

  it("expose les métriques de population 2020 sourcées (Census)", async () => {
    const res = await request(app).get(
      "/api/territories/cession-mexicaine-1848"
    );
    const population = res.body.data.economicMetrics.filter(
      (m: { metricType: string }) => m.metricType === "POPULATION"
    );
    expect(population.length).toBe(7);
    for (const m of population) {
      expect(m.year).toBe(2020);
      // Règle éditoriale : une statistique a une source ou est marquée à vérifier
      expect(m.source !== null || m.needsReview).toBe(true);
      expect(m.value).toBeGreaterThan(0);
    }
  });

  it("liste l'achat Gadsden comme acquisition distincte", async () => {
    const res = await request(app).get("/api/territories");
    const gadsden = res.body.data.find(
      (t: { slug: string }) => t.slug === "achat-gadsden"
    );
    expect(gadsden).toBeDefined();
    expect(gadsden.originalPrice).toBe(10000000);
    expect(gadsden.conflict).toBeNull();
  });

  it("expose le territoire lié sur la fiche du conflit mexicain", async () => {
    const res = await request(app).get(
      "/api/conflicts/guerre-americano-mexicaine"
    );
    expect(res.body.data.territories.length).toBe(1);
    expect(res.body.data.territories[0].slug).toBe("cession-mexicaine-1848");
  });

  it("liste les sources avec leurs conflits associés", async () => {
    const res = await request(app).get("/api/sources");
    expect(res.status).toBe(200);
    for (const s of res.body.data) {
      if (s.url) {
        expect(() => new URL(s.url)).not.toThrow();
      }
    }
  });
});
