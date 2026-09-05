import { createApp } from "./app.js";
import { env } from "./env.js";
import { prisma } from "./db.js";

const app = createApp();

const server = app.listen(env.API_PORT, () => {
  console.log(
    `[api] USA WAR ATLAS API démarrée sur http://localhost:${env.API_PORT} (${env.NODE_ENV})`
  );
});

async function shutdown(signal: string) {
  console.log(`[api] ${signal} reçu, arrêt en cours...`);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
