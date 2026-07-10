import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

/**
 * Frame component classes (`.btn`, `.input`, `.eyebrow`, `.card-mkt`, …).
 *
 * Shipped as a Tailwind plugin rather than a raw CSS file so the classes are
 * generated inside each app's own Tailwind pass — tokens resolve correctly and
 * there's no cross-package CSS `@import` for Next's css-loader to choke on.
 */
const framePlugin = plugin(({ addComponents, theme }) => {
  const colors = theme("colors") as Record<string, any>;
  addComponents({
    ".btn": {
      display: "inline-flex",
      height: "2.5rem",
      alignItems: "center",
      justifyContent: "center",
      gap: "0.5rem",
      borderRadius: "0.5rem",
      paddingLeft: "1rem",
      paddingRight: "1rem",
      fontSize: "0.875rem",
      lineHeight: "1.25rem",
      fontWeight: "600",
      transitionProperty:
        "color, background-color, border-color, text-decoration-color, fill, stroke",
      transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
      transitionDuration: "150ms",
    },
    ".btn-sm": {
      height: "2.25rem",
      paddingLeft: "0.875rem",
      paddingRight: "0.875rem",
      fontSize: "13px",
    },
    ".btn-lg": {
      height: "3rem",
      borderRadius: theme("borderRadius.xl") as string,
      paddingLeft: "1.5rem",
      paddingRight: "1.5rem",
      fontSize: "15px",
    },
    ".btn-primary": {
      backgroundColor: colors.primary,
      color: "#fff",
      "&:hover": { opacity: "0.9" },
    },
    ".btn-accent": {
      backgroundColor: colors.accent.DEFAULT,
      color: "#fff",
      "&:hover": { backgroundColor: colors.accent["2"] },
    },
    ".btn-dark": {
      backgroundColor: colors.primary,
      color: "#fff",
      "&:hover": { backgroundColor: colors.ink["2"] },
    },
    ".btn-ghost": {
      color: colors.ink.DEFAULT,
      "&:hover": { backgroundColor: colors.line.DEFAULT },
    },
    ".btn-outline": {
      border: `1px solid ${colors.line.DEFAULT}`,
      backgroundColor: colors.surface.DEFAULT,
      color: colors.ink.DEFAULT,
      "&:hover": { backgroundColor: colors.bg },
    },
    ".input": {
      width: "100%",
      borderRadius: "0.5rem",
      border: `1px solid ${colors.line.DEFAULT}`,
      backgroundColor: colors.surface.DEFAULT,
      paddingLeft: "0.75rem",
      paddingRight: "0.75rem",
      paddingTop: "0.5rem",
      paddingBottom: "0.5rem",
      fontSize: "15px",
      lineHeight: "1.5",
      color: colors.ink.DEFAULT,
      outline: "none",
      transitionProperty: "color, background-color, border-color",
      transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
      transitionDuration: "150ms",
      "&::placeholder": { color: "rgba(107, 114, 128, 0.6)" },
      "&:focus": {
        borderColor: colors.accent.DEFAULT,
        boxShadow: "0 0 0 2px rgba(109, 94, 250, 0.15)",
      },
    },
    ".eyebrow": {
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
    ".card-mkt": {
      borderRadius: "1rem",
      border: `1px solid ${colors.line.DEFAULT}`,
      backgroundColor: colors.surface.DEFAULT,
      boxShadow: theme("boxShadow.soft") as string,
    },
  });
});

/**
 * Frame design tokens — the single source of truth for the whole product.
 *
 * Ported from the prototype (`frame-prototype.html`). Every app consumes these
 * via `presets: [framePreset]` in its `tailwind.config.ts`, so colors, radii,
 * shadows, the type family, and the shared component classes live in exactly
 * one place instead of being copy-pasted per app.
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
        // fallback stack matches the prototype so unstyled flashes stay on-brand.
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
