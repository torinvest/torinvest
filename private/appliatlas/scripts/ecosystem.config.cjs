/**
 * Configuration PM2 pour l'API en production (VPS OVH).
 * Usage : pm2 start scripts/ecosystem.config.cjs
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
      },
      error_file: "logs/api-error.log",
      out_file: "logs/api-out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
