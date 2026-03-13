/**
 * Vitest config for E2E tests.
 *
 * Separate from the main vitest.config.ts because:
 *   - E2E tests run against a live server (no jsdom, no mocks)
 *   - Longer timeouts (network requests)
 *   - Different include patterns
 *
 * Run: npx vitest run --config tests/e2e/vitest.e2e.config.ts
 */

import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../../src"),
    },
  },
  // Pass ALL env vars to tests (Vite strips non-prefixed by default)
  envPrefix: [],
  test: {
    globals: true,
    environment: "node",
    include: ["tests/e2e/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 30_000,
    sequence: {
      concurrent: false,
    },
    env: {
      BASE_URL: process.env.BASE_URL || "http://localhost:3004",
    },
  },
});
