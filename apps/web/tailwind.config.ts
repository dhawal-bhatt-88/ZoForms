import type { Config } from "tailwindcss";
import framePreset from "@formbuilder/ui/preset";

// Design tokens live in @formbuilder/ui (preset.ts), ported from the prototype.
export default {
  presets: [framePreset],
  content: [
    "./src/**/*.{ts,tsx}",
    // Scan the shared UI package so its Tailwind classes are generated here too.
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  plugins: [],
} satisfies Config;
