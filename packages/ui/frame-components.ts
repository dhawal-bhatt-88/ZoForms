import plugin from "tailwindcss/plugin";

type Rule = Record<string, string>;

/**
 * What the shared component classes need from a palette. Each preset supplies
 * its own: `preset.ts` (admin) reads its hex tokens, `preset-zoblocks.ts` (web)
 * points at the ZoBlocks CSS variables.
 */
export interface FrameColors {
  primary: string;
  onPrimary: string;
  primaryHover: Rule;
  accent: string;
  accentHover: string;
  darkHover: string;
  ink: string;
  line: string;
  surface: string;
  bg: string;
  placeholder: string;
  focusBorder: string;
  focusShadow: string;
  /** The whole `.eyebrow` rule: the two apps don't share a look for it. */
  eyebrow: Rule;
}

/**
 * Shared component classes (`.btn`, `.input`, `.eyebrow`, …).
 *
 * Shipped as a Tailwind plugin rather than a raw CSS file so the classes are
 * generated inside each app's own Tailwind pass — tokens resolve correctly and
 * there's no cross-package CSS `@import` for Next's css-loader to choke on.
 *
 * Colours are plain CSS values: `addComponents` doesn't substitute Tailwind's
 * `<alpha-value>`, so a preset passes `rgb(var(--x))`, never the theme entry.
 */
export function frameComponents(resolve: (colors: Record<string, any>) => FrameColors) {
  return plugin(({ addComponents, theme }) => {
    const c = resolve(theme("colors") as Record<string, any>);
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
        backgroundColor: c.primary,
        color: c.onPrimary,
        "&:hover": c.primaryHover,
      },
      ".btn-accent": {
        backgroundColor: c.accent,
        color: c.onPrimary,
        "&:hover": { backgroundColor: c.accentHover },
      },
      ".btn-dark": {
        backgroundColor: c.primary,
        color: c.onPrimary,
        "&:hover": { backgroundColor: c.darkHover },
      },
      ".btn-ghost": {
        color: c.ink,
        "&:hover": { backgroundColor: c.line },
      },
      ".btn-outline": {
        border: `1px solid ${c.line}`,
        backgroundColor: c.surface,
        color: c.ink,
        "&:hover": { backgroundColor: c.bg },
      },
      ".input": {
        width: "100%",
        borderRadius: "0.5rem",
        border: `1px solid ${c.line}`,
        backgroundColor: c.surface,
        paddingLeft: "0.75rem",
        paddingRight: "0.75rem",
        paddingTop: "0.5rem",
        paddingBottom: "0.5rem",
        fontSize: "15px",
        lineHeight: "1.5",
        color: c.ink,
        outline: "none",
        transitionProperty: "color, background-color, border-color",
        transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
        transitionDuration: "150ms",
        "&::placeholder": { color: c.placeholder },
        "&:focus": {
          borderColor: c.focusBorder,
          boxShadow: c.focusShadow,
        },
      },
      ".eyebrow": c.eyebrow,
    });
  });
}
