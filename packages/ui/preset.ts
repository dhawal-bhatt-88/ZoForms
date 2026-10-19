import type { Config } from "tailwindcss";
import { frameComponents } from "./frame-components";

/** The admin app's component classes, from the hex tokens below. */
const framePlugin = frameComponents((colors) => ({
  primary: colors.primary,
  onPrimary: "#fff",
  primaryHover: { opacity: "0.9" },
  accent: colors.accent.DEFAULT,
  accentHover: colors.accent["2"],
  darkHover: colors.ink["2"],
  ink: colors.ink.DEFAULT,
  line: colors.line.DEFAULT,
  surface: colors.surface.DEFAULT,
  bg: colors.bg,
  placeholder: "rgba(107, 114, 128, 0.6)",
  focusBorder: colors.accent.DEFAULT,
  focusShadow: "0 0 0 2px rgba(109, 94, 250, 0.15)",
  eyebrow: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.5rem",
    borderRadius: "9999px",
    border: `1px solid ${colors.accent.weak}`,
    backgroundColor: colors.accent.weak,
    paddingLeft: "0.75rem",
    paddingRight: "0.75rem",
    paddingTop: "0.375rem",
    paddingBottom: "0.375rem",
    fontSize: "13px",
    fontWeight: "600",
    color: colors.accent["2"],
  },
}));

/**
 * Design tokens for the admin app.
 *
 * The web app moved to the ZoBlocks palette (`preset-zoblocks.ts`); admin keeps
 * these until it is restyled. The component classes are shared between the two
 * (`frame-components.ts`); only the colours they're given differ.
 */
const framePreset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        bg: "#F6F7F9",
        surface: { DEFAULT: "#FFFFFF", "2": "#FBFBFC", "3": "#F3F4F6" },
        ink: { DEFAULT: "#1B1D22", "2": "#3B3F47" },
        muted: "#6B7280",
        faint: "#9AA1AC",
        line: { DEFAULT: "#ECEDF0", "2": "#E2E4E9" },
        primary: "#18181B",
        accent: { DEFAULT: "#6D5EFA", "2": "#5546E6", weak: "#F0EEFE" },
        green: "#159C56",
        amber: "#C4790B",
        red: "#DC4B47",
      },
      borderRadius: {
        xl: "16px",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(20,22,28,.06), 0 1px 1px rgba(20,22,28,.04)",
        pop: "0 6px 18px -8px rgba(20,22,28,.18), 0 2px 6px -3px rgba(20,22,28,.08)",
      },
      fontFamily: {
        // `--font-hanken` is set by each app's root layout (next/font). The
        // fallback stack keeps unstyled flashes close to Hanken.
        sans: [
          "var(--font-hanken)",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [framePlugin],
};

export default framePreset;
