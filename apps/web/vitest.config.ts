import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests only; the Playwright specs in e2e/ run through `test:e2e`.
// Component tests (*.test.tsx) ask for a DOM with `// @vitest-environment jsdom`.
export default defineConfig({
  esbuild: { jsx: "automatic" },
  // The `@/` alias from tsconfig.json.
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // scripts/: the contrast gate's own tests.
  test: { include: ["src/**/*.test.ts", "src/**/*.test.tsx", "scripts/**/*.test.mjs"] },
});
