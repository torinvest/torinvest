import { Router } from "express";
import { prisma } from "../db.js";
import { ok, notFound } from "../http.js";

export const countriesRouter = Router();

// GET /api/countries
countriesRouter.get("/", async (_req, res, next) => {
  try {
    const countries = await prisma.country.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { conflicts: true } } },
    });
    ok(res, countries);
  } catch (err) {
    next(err);
  }
});

// GET /api/countries/:iso3
countriesRouter.get("/:iso3", async (req, res, next) => {
  try {
    const country = await prisma.country.findUnique({
      where: { iso3: req.params.iso3.toUpperCase() },
      include: {
        conflicts: {
          include: {
            conflict: {
              select: {
                slug: true,
                title: true,
                startDate: true,
                endDate: true,
                isOngoing: true,
                primaryCategory: true,
              },
            },
          },
        },
      },
    });
    if (!country) {
      throw notFound(`Pays introuvable : ${req.params.iso3}`);
    }
    ok(res, country);
  } catch (err) {
    next(err);
  }
});
