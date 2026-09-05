import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Build La Forge : VITE_BASE=/atlas-embed/ VITE_API_URL=/atlas-embed
export default defineConfig({
  base: process.env.VITE_BASE || "/",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
