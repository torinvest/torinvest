import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { ApiError } from "../http.js";
import { env } from "../env.js";

/** Gestionnaire d'erreurs centralisé : réponse JSON cohérente + journalisation. */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Paramètres ou corps de requête invalides",
        details: err.flatten(),
      },
    });
    return;
  }

  if (err instanceof ApiError) {
    res.status(err.status).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    });
    return;
  }

  console.error("[api] Erreur non gérée :", err);
  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message:
        env.NODE_ENV === "production"
          ? "Erreur interne du serveur"
          : err instanceof Error
            ? err.message
            : "Erreur inconnue",
    },
  });
}

/** 404 JSON pour les routes inexistantes. */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: `Route inconnue : ${req.method} ${req.path}`,
    },
  });
}
