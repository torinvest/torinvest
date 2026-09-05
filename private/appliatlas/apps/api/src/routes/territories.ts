import { Router } from "express";
import { prisma } from "../db.js";
import { ok, notFound } from "../http.js";

export const territoriesRouter = Router();

// GET /api/territories
territoriesRouter.get("/", async (_req, res, next) => {
  try {
    const territories = await prisma.territory.findMany({
      orderBy: { acquisitionDate: "asc" },
      include: {
        states: true,
        conflict: { select: { slug: true, title: true } },
      },
    });
    ok(res, territories);
  } catch (err) {
    next(err);
  }
});

// GET /api/territories/:slug
territoriesRouter.get("/:slug", async (req, res, next) => {
  try {
    const territory = await prisma.territory.findUnique({
      where: { slug: req.params.slug },
      include: {
        states: true,
        conflict: { select: { slug: true, title: true } },
        economicMetrics: {
          include: { source: true },
          orderBy: [{ metricType: "asc" }, { stateName: "asc" }],
        },
      },
    });
    if (!territory) {
      throw notFound(`Territoire introuvable : ${req.params.slug}`);
    }
    ok(res, territory);
  } catch (err) {
    next(err);
  }
});
