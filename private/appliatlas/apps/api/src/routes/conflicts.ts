import { Router } from "express";
import type { Prisma } from "@prisma/client";
import {
  conflictCreateSchema,
  conflictListQuerySchema,
  conflictUpdateSchema,
  interventionSchema,
} from "@usa-war-atlas/shared";
import { prisma } from "../db.js";
import { ok, notFound } from "../http.js";
import { requireAdmin } from "../middleware/admin-auth.js";

export const conflictsRouter = Router();

const detailInclude = {
  countries: { include: { country: true } },
  interventions: { orderBy: { startDate: "asc" } },
  casualtyEstimates: { include: { source: true } },
  timelineEvents: { orderBy: { date: "asc" } },
  sources: { include: { source: true } },
  territories: {
    select: {
      id: true,
      slug: true,
      name: true,
      treatyName: true,
      areaKm2: true,
      originalPrice: true,
      originalCurrency: true,
    },
  },
} satisfies Prisma.ConflictInclude;

// GET /api/conflicts
conflictsRouter.get("/", async (req, res, next) => {
  try {
    const q = conflictListQuerySchema.parse(req.query);

    const where: Prisma.ConflictWhereInput = {};
    if (q.category) where.primaryCategory = q.category;
    if (q.region) where.region = q.region;
    if (q.isOngoing !== undefined) where.isOngoing = q.isOngoing;
    if (q.country) {
      where.countries = { some: { country: { iso3: q.country } } };
    }
    if (q.startYear) {
      where.startDate = { gte: new Date(`${q.startYear}-01-01`) };
    }
    if (q.endYear) {
      // Conflit commencé au plus tard à la fin de l'année demandée
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        { startDate: { lte: new Date(`${q.endYear}-12-31`) } },
      ];
    }
    if (q.search) {
      // SQLite : pas de mode insensitive natif via Prisma ; les recherches
      // restent utilisables car LIKE est insensible à la casse en ASCII.
      where.OR = [
        { title: { contains: q.search } },
        { summary: { contains: q.search } },
        { shortTitle: { contains: q.search } },
      ];
    }

    const orderBy: Prisma.ConflictOrderByWithRelationInput = q.sort.startsWith(
      "-"
    )
      ? { [q.sort.slice(1)]: "desc" }
      : { [q.sort]: "asc" };

    const [total, conflicts] = await Promise.all([
      prisma.conflict.count({ where }),
      prisma.conflict.findMany({
        where,
        orderBy,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        select: {
          id: true,
          slug: true,
          title: true,
          shortTitle: true,
          summary: true,
          startDate: true,
          endDate: true,
          isOngoing: true,
          region: true,
          primaryCategory: true,
          certaintyLevel: true,
          needsReview: true,
        },
      }),
    ]);

    ok(res, conflicts, {
      page: q.page,
      limit: q.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / q.limit)),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/conflicts/geo — conflits avec pays et coordonnées, pour la carte.
// Déclaré avant /:slug pour ne pas être capturé par la route paramétrée.
conflictsRouter.get("/geo", async (_req, res, next) => {
  try {
    const conflicts = await prisma.conflict.findMany({
      orderBy: { startDate: "asc" },
      select: {
        id: true,
        slug: true,
        title: true,
        shortTitle: true,
        startDate: true,
        endDate: true,
        isOngoing: true,
        region: true,
        primaryCategory: true,
        interventions: { select: { isCovert: true } },
        countries: {
          select: {
            role: true,
            country: {
              select: {
                name: true,
                iso3: true,
                latitude: true,
                longitude: true,
              },
            },
          },
        },
      },
    });

    ok(
      res,
      conflicts.map(({ interventions, ...c }) => ({
        ...c,
        hasCovert: interventions.some((i) => i.isCovert),
      }))
    );
  } catch (err) {
    next(err);
  }
});

// GET /api/conflicts/:slug
conflictsRouter.get("/:slug", async (req, res, next) => {
  try {
    const conflict = await prisma.conflict.findUnique({
      where: { slug: req.params.slug },
      include: detailInclude,
    });
    if (!conflict) {
      throw notFound(`Conflit introuvable : ${req.params.slug}`);
    }
    ok(res, conflict);
  } catch (err) {
    next(err);
  }
});

// POST /api/conflicts (admin)
conflictsRouter.post("/", requireAdmin, async (req, res, next) => {
  try {
    const input = conflictCreateSchema.parse(req.body);
    const created = await prisma.conflict.create({ data: input });
    ok(res, created, undefined, 201);
  } catch (err) {
    next(err);
  }
});

// PUT /api/conflicts/:id (admin)
conflictsRouter.put("/:id", requireAdmin, async (req, res, next) => {
  try {
    const input = conflictUpdateSchema.parse(req.body);
    const existing = await prisma.conflict.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) {
      throw notFound(`Conflit introuvable : ${req.params.id}`);
    }
    const updated = await prisma.conflict.update({
      where: { id: req.params.id },
      // Traçabilité éditoriale : la validation d'un dossier date la relecture
      data: input.verified === true
        ? { ...input, lastReviewedAt: new Date() }
        : input,
    });
    ok(res, updated);
  } catch (err) {
    next(err);
  }
});

// POST /api/conflicts/:id/interventions (admin)
conflictsRouter.post(
  "/:id/interventions",
  requireAdmin,
  async (req, res, next) => {
    try {
      const input = interventionSchema.parse(req.body);
      const conflict = await prisma.conflict.findUnique({
        where: { id: req.params.id },
      });
      if (!conflict) {
        throw notFound(`Conflit introuvable : ${req.params.id}`);
      }
      const created = await prisma.intervention.create({
        data: { ...input, conflictId: conflict.id },
      });
      ok(res, created, undefined, 201);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/conflicts/:id (admin)
conflictsRouter.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const existing = await prisma.conflict.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) {
      throw notFound(`Conflit introuvable : ${req.params.id}`);
    }
    await prisma.conflict.delete({ where: { id: req.params.id } });
    ok(res, { deleted: true, id: req.params.id });
  } catch (err) {
    next(err);
  }
});
