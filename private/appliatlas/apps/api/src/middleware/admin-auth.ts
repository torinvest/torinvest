import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../http.js";
import { env } from "../env.js";

/**
 * Protection simple des routes d'écriture pour le MVP :
 * jeton porté par l'en-tête Authorization: Bearer <ADMIN_TOKEN>.
 * Si ADMIN_TOKEN n'est pas défini, les routes d'écriture sont désactivées.
 * À remplacer par une vraie authentification (sessions/JWT) plus tard.
 */
export function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!env.ADMIN_TOKEN) {
    next(
      new ApiError(
        503,
        "ADMIN_DISABLED",
        "Les routes d'administration sont désactivées (ADMIN_TOKEN non configuré)"
      )
    );
    return;
  }
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (token !== env.ADMIN_TOKEN) {
    next(new ApiError(401, "UNAUTHORIZED", "Jeton administrateur invalide"));
    return;
  }
  next();
}
