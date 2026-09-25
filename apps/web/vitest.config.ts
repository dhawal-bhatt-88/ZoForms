import { defineConfig } from "vitest/config";

// Unit tests only; the Playwright specs in e2e/ run through `test:e2e`.
export default defineConfig({
  test: { include: ["src/**/*.test.ts"] },
});
