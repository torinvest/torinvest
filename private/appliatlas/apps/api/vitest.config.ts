import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Variables injectées avant le chargement des modules testés
    env: {
      NODE_ENV: "test",
      ADMIN_TOKEN: "jeton-de-test-vitest-0123456789",
    },
  },
});
