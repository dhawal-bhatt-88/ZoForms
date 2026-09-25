import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** @type {import('postcss-load-config').Config} */
export default {
  plugins: {
    // Point Tailwind at this app's config by absolute path. Without one it looks
    // for a config in the process's working directory, so a dev server started
    // from anywhere else builds CSS with no utilities — and Next caches that
    // broken CSS in .next for every later server too.
    tailwindcss: { config: join(here, "tailwind.config.ts") },
    autoprefixer: {},
  },
};
