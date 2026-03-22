import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@sanbao/shared": path.resolve(__dirname, "packages/shared/src"),
      "@sanbao/shared/": path.resolve(__dirname, "packages/shared/src/"),
      "@sanbao/stores": path.resolve(__dirname, "packages/stores/src"),
      "@sanbao/stores/": path.resolve(__dirname, "packages/stores/src/"),
      "@sanbao/ui": path.resolve(__dirname, "packages/ui/src"),
      "@sanbao/ui/": path.resolve(__dirname, "packages/ui/src/"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/__tests__/**/*.test.{ts,tsx}"],
    setupFiles: [
      "src/__tests__/setup.ts",
      "src/__tests__/setup-ui.tsx",
    ],
    testTimeout: 15000,
  },
});
