import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

// Charge le .env (racine du monorepo ou dossier courant) via l'API native
// de Node >= 20.12. Les variables déjà présentes dans l'environnement
// gardent la priorité (comportement de node --env-file).
for (const candidate of [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "..", "..", ".env"),
]) {
  if (existsSync(candidate)) {
    try {
      process.loadEnvFile(candidate);
    } catch {
      // Node < 20.12 : variables à fournir via l'environnement (PM2, Docker…)
    }
    break;
  }
}

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z.string().default("file:./dev.db"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  ADMIN_TOKEN: z.string().min(8).optional(),
});

export const env = envSchema.parse(process.env);

export const corsOrigins = env.CORS_ORIGIN.split(",").map((o) => o.trim());
