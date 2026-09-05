import type { Response } from "express";

/** Réponse succès normalisée : { success: true, data, meta? } */
export function ok<T>(
  res: Response,
  data: T,
  meta?: Record<string, unknown>,
  status = 200
): void {
  res.status(status).json({ success: true, data, ...(meta ? { meta } : {}) });
}

/** Erreur applicative transportée jusqu'au gestionnaire central. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const notFound = (message: string) =>
  new ApiError(404, "NOT_FOUND", message);
