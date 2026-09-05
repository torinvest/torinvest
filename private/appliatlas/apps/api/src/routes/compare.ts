import { Router } from "express";
import { compareQuerySchema } from "@usa-war-atlas/shared";
import { prisma } from "../db.js";
import { ok, ApiError } from "../http.js";

export const compareRouter = Router();

// GET /api/compare?conflicts=slug1,slug2
compareRouter.get("/", async (req, res, next) => {
  try {
    const { conflicts: slugs } = compareQuerySchema.parse(req.query);

    const conflicts = await prisma.conflict.findMany({
      where: { slug: { in: slugs } },
      include: {
        countries: { include: { country: true } },
        casualtyEstimates: { include: { source: true } },
        sources: { include: { source: true } },
      },
    });

    const foundSlugs = new Set(conflicts.map((c) => c.slug));
    const missing = slugs.filter((s) => !foundSlugs.has(s));
    if (missing.length > 0) {
      throw new ApiError(
        404,
        "NOT_FOUND",
        `Conflit(s) introuvable(s) : ${missing.join(", ")}`
      );
    }

    // Conserver l'ordre demandé par l'utilisateur
    const ordered = slugs.map((s) => conflicts.find((c) => c.slug === s)!);

    ok(res, ordered, { compared: slugs });
  } catch (err) {
    next(err);
  }
});
