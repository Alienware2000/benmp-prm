import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Unit + integration tests (the per-task green gate for non-E2E tasks).
// E2E acceptance flows live under e2e/ and run via Playwright — see playwright.config.ts.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
