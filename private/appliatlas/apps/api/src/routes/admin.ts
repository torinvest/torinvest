import { Router } from "express";
import { z } from "zod";
import { conflictCreateSchema } from "@usa-war-atlas/shared";
import { prisma } from "../db.js";
import { ok } from "../http.js";
import { requireAdmin } from "../middleware/admin-auth.js";

export const adminRouter = Router();

// Toutes les routes de ce routeur exigent le jeton administrateur.
adminRouter.use(requireAdmin);

// GET /api/admin/export — export JSON complet de la base éditoriale.
adminRouter.get("/export", async (_req, res, next) => {
  try {
    const [conflicts, countries, sources, territories, adminNotes] =
      await Promise.all([
        prisma.conflict.findMany({
          include: {
            countries: { include: { country: true } },
            interventions: true,
            casualtyEstimates: true,
            timelineEvents: true,
            sources: { include: { source: true } },
          },
          orderBy: { startDate: "asc" },
        }),
        prisma.country.findMany({ orderBy: { name: "asc" } }),
        prisma.source.findMany({ orderBy: { title: "asc" } }),
        prisma.territory.findMany({
          include: { states: true, economicMetrics: true },
        }),
        prisma.adminNote.findMany(),
      ]);

    ok(res, {
      exportedAt: new Date().toISOString(),
      format: "usa-war-atlas-export-v1",
      conflicts,
      countries,
      sources,
      territories,
      adminNotes,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/import — import de conflits (champs simples, sans relations).
 * Upsert par slug : crée les conflits absents, met à jour les existants.
 * Tout conflit importé est marqué needsReview tant qu'il n'est pas relu.
 */
const importSchema = z.object({
  conflicts: z.array(conflictCreateSchema).min(1).max(200),
});

adminRouter.post("/import", async (req, res, next) => {
  try {
    const { conflicts } = importSchema.parse(req.body);

    let created = 0;
    let updated = 0;
    for (const input of conflicts) {
      const data = { ...input, needsReview: true };
      const existing = await prisma.conflict.findUnique({
        where: { slug: input.slug },
      });
      if (existing) {
        await prisma.conflict.update({ where: { slug: input.slug }, data });
        updated += 1;
      } else {
        await prisma.conflict.create({ data });
        created += 1;
      }
    }

    ok(res, { created, updated, total: conflicts.length }, undefined, 201);
  } catch (err) {
    next(err);
  }
});
