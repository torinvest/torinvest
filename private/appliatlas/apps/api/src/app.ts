import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { corsOrigins, env } from "./env.js";
import { conflictsRouter } from "./routes/conflicts.js";
import { countriesRouter } from "./routes/countries.js";
import { territoriesRouter } from "./routes/territories.js";
import { sourcesRouter } from "./routes/sources.js";
import { statsRouter } from "./routes/stats.js";
import { compareRouter } from "./routes/compare.js";
import { adminRouter } from "./routes/admin.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { ok } from "./http.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: corsOrigins,
      methods: ["GET", "POST", "PUT", "DELETE"],
    })
  );
  if (env.NODE_ENV !== "test") {
    app.use(
      rateLimit({
        windowMs: env.RATE_LIMIT_WINDOW_MS,
        max: env.RATE_LIMIT_MAX,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: "Trop de requêtes, réessayez plus tard",
          },
        },
      })
    );
  }
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    ok(res, { status: "ok", timestamp: new Date().toISOString() });
  });

  app.use("/api/conflicts", conflictsRouter);
  app.use("/api/countries", countriesRouter);
  app.use("/api/territories", territoriesRouter);
  app.use("/api/sources", sourcesRouter);
  app.use("/api/stats", statsRouter);
  app.use("/api/compare", compareRouter);
  app.use("/api/admin", adminRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
