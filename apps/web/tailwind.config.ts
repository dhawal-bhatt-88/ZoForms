import type { Config } from "tailwindcss";
import framePreset from "@formbuilder/ui/preset";

// Design tokens live in @formbuilder/ui (preset.ts).
export default {
  presets: [framePreset],
  content: {
    // Resolve these globs from this file's folder, not the process's working
    // directory. Without it, `next dev` started from anywhere but apps/web scans
    // no files, emits CSS with no utility classes, and Next caches that broken
    // CSS in .next/cache for every later dev server too.
    relative: true,
    files: [
      "./src/**/*.{ts,tsx}",
      // Scan the shared UI package so its Tailwind classes are generated here too.
      "../../packages/ui/src/**/*.{ts,tsx}",
    ],
  },
  plugins: [],
} satisfies Config;
