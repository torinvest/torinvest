import { Router } from "express";
import { prisma } from "../db.js";
import { ok } from "../http.js";

export const statsRouter = Router();

// GET /api/stats/overview
statsRouter.get("/overview", async (_req, res, next) => {
  try {
    const [totalConflicts, ongoingConflicts, countriesInvolved, totalSources, byCategory, dateBounds] =
      await Promise.all([
        prisma.conflict.count(),
        prisma.conflict.count({ where: { isOngoing: true } }),
        prisma.country.count({ where: { conflicts: { some: {} } } }),
        prisma.source.count(),
        prisma.conflict.groupBy({
          by: ["primaryCategory"],
          _count: { _all: true },
        }),
        prisma.conflict.aggregate({
          _min: { startDate: true },
          _max: { startDate: true },
        }),
      ]);

    ok(res, {
      totalConflicts,
      ongoingConflicts,
      countriesInvolved,
      totalSources,
      firstConflictYear: dateBounds._min.startDate?.getFullYear() ?? null,
      latestConflictYear: dateBounds._max.startDate?.getFullYear() ?? null,
      byCategory: byCategory.map((c) => ({
        category: c.primaryCategory,
        count: c._count._all,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/stats/categories
statsRouter.get("/categories", async (_req, res, next) => {
  try {
    const byCategory = await prisma.conflict.groupBy({
      by: ["primaryCategory"],
      _count: { _all: true },
    });
    ok(
      res,
      byCategory.map((c) => ({
        category: c.primaryCategory,
        count: c._count._all,
      }))
    );
  } catch (err) {
    next(err);
  }
});

// GET /api/stats/timeline — nombre de conflits démarrés par décennie
statsRouter.get("/timeline", async (_req, res, next) => {
  try {
    const conflicts = await prisma.conflict.findMany({
      select: { startDate: true, primaryCategory: true },
    });
    const byDecade = new Map<number, number>();
    for (const c of conflicts) {
      const decade = Math.floor(c.startDate.getFullYear() / 10) * 10;
      byDecade.set(decade, (byDecade.get(decade) ?? 0) + 1);
    }
    ok(
      res,
      [...byDecade.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([decade, count]) => ({ decade, count }))
    );
  } catch (err) {
    next(err);
  }
});

// GET /api/stats/economic — métriques économiques agrégées par type
statsRouter.get("/economic", async (_req, res, next) => {
  try {
    const metrics = await prisma.economicMetric.findMany({
      include: { source: { select: { title: true, publisher: true } } },
      orderBy: [{ metricType: "asc" }, { year: "desc" }],
    });
    ok(res, metrics);
  } catch (err) {
    next(err);
  }
});
