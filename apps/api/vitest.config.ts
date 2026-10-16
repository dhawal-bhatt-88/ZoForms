import { defineConfig } from "vitest/config";

// Unit tests only; the API's end-to-end checks are the scripts in the repo's e2e/.
export default defineConfig({
  test: { include: ["src/**/*.test.ts"] },
});
