/**
 * Configuration PM2 pour l'API Atlas en production (VPS).
 * Usage (depuis private/appliatlas) :
 *   pm2 start scripts/ecosystem.config.cjs
 *
 * Port 3011 volontaire : La Forge (formation) utilise déjà 3001.
 */
module.exports = {
  apps: [
    {
      name: "usa-war-atlas-api",
      cwd: __dirname + "/..",
      script: "apps/api/dist/server.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
        API_PORT: 3011,
        CORS_ORIGIN: "https://app.torinvest-trading.com",
        DATABASE_URL: "file:./prod.db",
      },
      error_file: "logs/api-error.log",
      out_file: "logs/api-out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
