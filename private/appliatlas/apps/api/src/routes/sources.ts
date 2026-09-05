import { Router } from "express";
import { sourceSchema } from "@usa-war-atlas/shared";
import { prisma } from "../db.js";
import { ok, notFound } from "../http.js";
import { requireAdmin } from "../middleware/admin-auth.js";

export const sourcesRouter = Router();

// POST /api/sources (admin)
sourcesRouter.post("/", requireAdmin, async (req, res, next) => {
  try {
    const input = sourceSchema.parse(req.body);
    const created = await prisma.source.create({
      data: { ...input, accessedAt: input.accessedAt ?? new Date() },
    });
    ok(res, created, undefined, 201);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/sources/:id (admin)
sourcesRouter.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const existing = await prisma.source.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) {
      throw notFound(`Source introuvable : ${req.params.id}`);
    }
    await prisma.source.delete({ where: { id: req.params.id } });
    ok(res, { deleted: true, id: req.params.id });
  } catch (err) {
    next(err);
  }
});

// GET /api/sources
sourcesRouter.get("/", async (_req, res, next) => {
  try {
    const sources = await prisma.source.findMany({
      orderBy: { title: "asc" },
      include: {
        conflicts: {
          include: {
            conflict: { select: { slug: true, title: true } },
          },
        },
      },
    });
    ok(res, sources);
  } catch (err) {
    next(err);
  }
});

// GET /api/sources/:id
sourcesRouter.get("/:id", async (req, res, next) => {
  try {
    const source = await prisma.source.findUnique({
      where: { id: req.params.id },
      include: {
        conflicts: {
          include: { conflict: { select: { slug: true, title: true } } },
        },
      },
    });
    if (!source) {
      throw notFound(`Source introuvable : ${req.params.id}`);
    }
    ok(res, source);
  } catch (err) {
    next(err);
  }
});
